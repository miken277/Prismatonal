
import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { AppSettings, LatticeNode, LatticeLine } from '../types';
import { generateLattice } from '../services/LatticeService';
import AudioEngine from '../services/AudioEngine';

interface Props {
  settings: AppSettings;
  audioEngine: AudioEngine;
  onLimitInteraction: (limit: number) => void;
}

interface ActiveTouch {
  id: number;
  nodeId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  lockedAxis: 'x' | 'y' | null;
}

const TonalityDiamond: React.FC<Props> = ({ settings, audioEngine, onLimitInteraction }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  const [activeTouches, setActiveTouches] = useState<Map<number, ActiveTouch>>(new Map());
  
  // Track if we have done the initial scroll centering to avoid jumping during re-renders
  const [hasCentered, setHasCentered] = useState(false);

  // Generate Data
  useEffect(() => {
    const result = generateLattice(settings);
    
    // Filter out nodes based on hiddenLimits (visual hiding)
    const visibleNodes = result.nodes.filter(n => !settings.hiddenLimits.includes(n.maxPrime));
    
    // Ensure 1/1 (Limit 1) is handled correctly if settings dictate, though typically 1 limit isn't "hidden" structurally.
    // If user hides "1" via settings (now allowed), we respect it here.
    
    const visibleLines = result.lines.filter(l => !settings.hiddenLimits.includes(l.limit));
    
    setData({ nodes: visibleNodes, lines: visibleLines });
  }, [settings]);

  // Initial Center Scroll
  // We center based on the canvas size, not the content bounding box.
  // This keeps 1/1 locked in the center of the scroll area.
  useLayoutEffect(() => {
    if (scrollContainerRef.current && !hasCentered) {
        const center = settings.canvasSize / 2;
        const viewportW = scrollContainerRef.current.clientWidth;
        const viewportH = scrollContainerRef.current.clientHeight;

        scrollContainerRef.current.scrollLeft = center - viewportW / 2;
        scrollContainerRef.current.scrollTop = center - viewportH / 2;
        setHasCentered(true);
    }
  }, [settings.canvasSize, hasCentered]);

  useEffect(() => {
    audioEngine.setPolyphony(settings.polyphony);
  }, [settings.polyphony, audioEngine]);

  const handlePointerDown = (e: React.PointerEvent, node: LatticeNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    onLimitInteraction(node.maxPrime);
    
    audioEngine.startVoice(e.pointerId, node.ratio);
    setActiveTouches(prev => {
      const newMap = new Map(prev);
      newMap.set(e.pointerId, {
        id: e.pointerId,
        nodeId: node.id,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        lockedAxis: null
      });
      return newMap;
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!settings.isPitchBendEnabled || !activeTouches.has(e.pointerId)) return;
    const touch = activeTouches.get(e.pointerId)!;
    
    let lockedAxis = touch.lockedAxis;
    if (!lockedAxis) {
      const dx = Math.abs(e.clientX - touch.startX);
      const dy = Math.abs(e.clientY - touch.startY);
      if (dx > 5 || dy > 5) {
        lockedAxis = dx > dy ? 'x' : 'y';
      }
    }

    const sensitivity = 2.0; 
    let delta = 0;
    if (lockedAxis === 'x') delta = e.clientX - touch.startX;
    if (lockedAxis === 'y') delta = -(e.clientY - touch.startY);

    let detune = delta * sensitivity;
    if (settings.isPitchSnapEnabled) {
       const snapStrength = 20;
       if (Math.abs(detune) < snapStrength) detune = 0;
    }

    audioEngine.bendVoice(e.pointerId, detune);

    setActiveTouches(prev => {
        const newMap = new Map(prev);
        newMap.set(e.pointerId, { ...touch, currentX: e.clientX, currentY: e.clientY, lockedAxis });
        return newMap;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    audioEngine.stopVoice(e.pointerId);
    setActiveTouches(prev => {
      const newMap = new Map(prev);
      newMap.delete(e.pointerId);
      return newMap;
    });
  };

  const getColor = (limit: number): string => settings.colors[limit] || '#64748b';

  const baseSize = 60 * settings.buttonSizeScale;
  const touches: ActiveTouch[] = Array.from(activeTouches.values());
  
  // Center Offset: (0,0) in math space = (canvasSize/2, canvasSize/2) in screen space
  const centerOffset = settings.canvasSize / 2;
  const spacing = settings.buttonSpacingScale;

  return (
    <div 
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto bg-slate-950 relative"
        style={{ touchAction: 'none' }}
    >
        <div 
            ref={contentRef}
            className="relative"
            style={{ 
                width: settings.canvasSize, 
                height: settings.canvasSize,
            }}
        >
            {/* SVG Layer for Lines */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                {data.lines.map(line => {
                    // Apply spacing scale and offset
                    const x1 = line.x1 * spacing + centerOffset;
                    const y1 = line.y1 * spacing + centerOffset;
                    const x2 = line.x2 * spacing + centerOffset;
                    const y2 = line.y2 * spacing + centerOffset;
                    const color = getColor(line.limit);
                    
                    return (
                        <line 
                            key={line.id}
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={color}
                            strokeWidth={2}
                            strokeOpacity={0.3}
                        />
                    );
                })}
            </svg>

            {/* Nodes Layer */}
            {data.nodes.map((node) => {
                const activeTouch = touches.find(t => t.nodeId === node.id);
                const isActive = !!activeTouch;
                
                let transformX = 0;
                let transformY = 0;

                if (isActive && activeTouch && settings.isPitchBendEnabled) {
                    if (activeTouch.lockedAxis === 'x') transformX = activeTouch.currentX - activeTouch.startX;
                    if (activeTouch.lockedAxis === 'y') transformY = activeTouch.currentY - activeTouch.startY;
                }

                const left = node.x * spacing + centerOffset;
                const top = node.y * spacing + centerOffset;
                
                // Color logic
                const cTop = getColor(node.limitTop);
                const cBottom = getColor(node.limitBottom);
                const background = `linear-gradient(to bottom, ${cTop} 50%, ${cBottom} 50%)`;

                // Z-Index Logic based on Layer Order
                // Find index in layerOrder array. Higher index = Higher Z.
                const layerIndex = settings.layerOrder.indexOf(node.maxPrime);
                const zIndex = isActive ? 100 : (10 + layerIndex);

                return (
                    <div
                        key={node.id}
                        className="absolute flex items-center justify-center shadow-md cursor-pointer touch-none select-none transition-transform"
                        style={{
                            left: `${left}px`,
                            top: `${top}px`,
                            width: `${baseSize}px`,
                            height: `${baseSize}px`,
                            background: background,
                            borderRadius: settings.buttonShape,
                            transform: `translate(-50%, -50%) translate(${transformX}px, ${transformY}px) scale(${isActive ? 1.1 : 1})`,
                            boxShadow: isActive ? `0 0 25px white` : '0 4px 6px rgba(0,0,0,0.6)',
                            zIndex: zIndex,
                            opacity: isActive ? 1 : 0.95,
                            border: '2px solid rgba(255,255,255,0.3)'
                        }}
                        onPointerDown={(e) => handlePointerDown(e, node)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    >
                        <div className="flex flex-col w-full h-full text-white font-bold leading-none text-shadow-sm">
                            <span className="flex-1 flex items-center justify-center pt-1" style={{ fontSize: '11px' }}>{node.n}</span>
                            <span className="flex-1 flex items-center justify-center pb-1 border-t border-white/20" style={{ fontSize: '11px' }}>{node.d}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default TonalityDiamond;
