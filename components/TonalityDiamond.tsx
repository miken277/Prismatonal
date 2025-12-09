
import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { AppSettings, LatticeNode, LatticeLine } from '../types';
import { generateLattice, getHarmonicDistance } from '../services/LatticeService';
import AudioEngine from '../services/AudioEngine';

interface Props {
  settings: AppSettings;
  audioEngine: AudioEngine;
  onLimitInteraction: (limit: number) => void;
}

interface ActiveTouch {
  id: number;
  nodeId: string; // The "Anchor" node for the current bend
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  
  // Dynamic bending state
  targetNodeId: string | null;
  bendAmount: number; // 0 to 1
}

interface LatchedVoice {
  voiceId: number;
  nodeId: string;
}

const TonalityDiamond: React.FC<Props> = ({ settings, audioEngine, onLimitInteraction }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  const [activeTouches, setActiveTouches] = useState<Map<number, ActiveTouch>>(new Map());
  const [latchedVoices, setLatchedVoices] = useState<Map<string, number>>(new Map()); // nodeId -> voiceId
  
  const [lastPlayedCoords, setLastPlayedCoords] = useState<number[]>([0, 0, 0, 0, 0]); 

  const [hasCentered, setHasCentered] = useState(false);

  useEffect(() => {
    const result = generateLattice(settings);
    // Filter out nodes based on visibility, but we need them for logic?
    // Better to filter just visual rendering or keep them all for connectivity?
    // Let's filter visually but keep structure if needed. For now, strict filter.
    const visibleNodes = result.nodes.filter(n => !settings.hiddenLimits.includes(n.maxPrime));
    const visibleLines = result.lines.filter(l => !settings.hiddenLimits.includes(l.limit));
    setData({ nodes: visibleNodes, lines: visibleLines });
  }, [settings]);

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
    
    // Tap to stop Latched Voice
    if (latchedVoices.has(node.id)) {
        const voiceId = latchedVoices.get(node.id)!;
        audioEngine.stopVoice(voiceId);
        setLatchedVoices(prev => {
            const next = new Map(prev);
            next.delete(node.id);
            return next;
        });
        return;
    }

    onLimitInteraction(node.maxPrime);
    setLastPlayedCoords(node.coords);
    
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
        targetNodeId: null,
        bendAmount: 0
      });
      return newMap;
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeTouches.has(e.pointerId)) return;
    const touch = activeTouches.get(e.pointerId)!;
    
    const centerOffset = settings.canvasSize / 2;
    const spacing = settings.buttonSpacingScale;

    // 1. Calculate Vector from Start to Current
    const dx = e.clientX - touch.startX;
    const dy = e.clientY - touch.startY;
    
    // 2. Vector-based Bend Logic
    if (settings.isPitchBendEnabled) {
        const anchorNode = data.nodes.find(n => n.id === touch.nodeId);
        if (!anchorNode) return;

        const anchorX = anchorNode.x * spacing + centerOffset;
        const anchorY = anchorNode.y * spacing + centerOffset;

        // Find neighbors (connected via lines)
        const connectedLines = data.lines.filter(l => 
            (l.x1 === anchorNode.x && l.y1 === anchorNode.y) || 
            (l.x2 === anchorNode.x && l.y2 === anchorNode.y)
        );

        let bestTarget: LatticeNode | null = null;
        let bestProjection = 0;
        let bestDistSq = 0;

        connectedLines.forEach(line => {
             const isStart = (line.x1 === anchorNode.x && line.y1 === anchorNode.y);
             const nx = isStart ? line.x2 : line.x1;
             const ny = isStart ? line.y2 : line.y1;
             
             // Visual Vector to neighbor
             const vx = (nx * spacing + centerOffset) - anchorX;
             const vy = (ny * spacing + centerOffset) - anchorY;
             
             // Dot Product projection
             // Project drag vector onto neighbor vector
             const vMagSq = vx*vx + vy*vy;
             const dot = dx*vx + dy*vy;
             
             const projection = dot / vMagSq; // 0 to 1 scalar along the line
             
             if (projection > 0 && projection > bestProjection) {
                 const neighbor = data.nodes.find(n => n.x === nx && n.y === ny);
                 if (neighbor) {
                     bestProjection = projection;
                     bestTarget = neighbor;
                     bestDistSq = vMagSq;
                 }
             }
        });

        // 3. Apply Bend or Handoff
        if (bestTarget && bestTarget.id) {
            // Cap at 1.0 (arrived at neighbor)
            const amount = Math.min(1.0, bestProjection);
            
            // Calculate frequency: Geometric interpolation
            // F = F_start * (F_target / F_start) ^ amount
            const ratioRatio = bestTarget.ratio / anchorNode.ratio;
            const currentRatio = anchorNode.ratio * Math.pow(ratioRatio, amount);
            
            audioEngine.glideVoice(e.pointerId, currentRatio, 0.02); // Fast glide for bend responsiveness

            // Check for Handoff (Legato / Glissando)
            // If we are significantly past the midpoint or close to the target, switch anchor
            if (amount >= 0.95) {
                 onLimitInteraction(bestTarget.maxPrime);
                 setLastPlayedCoords(bestTarget.coords);
                 
                 // Update touch state to new anchor
                 setActiveTouches(prev => {
                     const newMap = new Map(prev);
                     newMap.set(e.pointerId, {
                         ...touch,
                         nodeId: bestTarget!.id,
                         // Reset start to new node position to allow continuous bending
                         // We need screen coords of the new node
                         startX: e.clientX, // Resetting startX/Y to current assumes we are AT the node. 
                         // But we might be slightly off. Ideally, we snap the 'virtual' start to the node center.
                         startY: e.clientY,
                         currentX: e.clientX,
                         currentY: e.clientY,
                         targetNodeId: null,
                         bendAmount: 0
                     });
                     return newMap;
                 });
            } else {
                 // Just update visual bend
                 setActiveTouches(prev => {
                     const newMap = new Map(prev);
                     newMap.set(e.pointerId, {
                         ...touch,
                         currentX: e.clientX,
                         currentY: e.clientY,
                         targetNodeId: bestTarget!.id,
                         bendAmount: amount
                     });
                     return newMap;
                 });
            }
        } else {
            // No valid target, stick to anchor (or minor wobble)
            setActiveTouches(prev => {
                 const newMap = new Map(prev);
                 newMap.set(e.pointerId, {
                     ...touch,
                     currentX: e.clientX,
                     currentY: e.clientY,
                     targetNodeId: null,
                     bendAmount: 0
                 });
                 return newMap;
             });
        }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const touch = activeTouches.get(e.pointerId);
    
    // --- Momentum Logic ---
    // If momentum enabled, latch the note at its CURRENT pitch (even if bent)
    if (settings.isMomentumEnabled && touch) {
         // Latch the anchor node
         // If bent halfway, maybe we should latch the target? 
         // For now, latch the current Anchor (which updates on handoff)
         const nodeToLatch = touch.nodeId;
         
         setLatchedVoices(prev => {
            const newMap = new Map(prev);
            newMap.set(nodeToLatch, e.pointerId);
            return newMap;
         });

         // Voice keeps running, remove touch tracker
         setActiveTouches(prev => {
            const newMap = new Map(prev);
            newMap.delete(e.pointerId);
            return newMap;
         });
    } else {
        audioEngine.stopVoice(e.pointerId);
        setActiveTouches(prev => {
          const newMap = new Map(prev);
          newMap.delete(e.pointerId);
          return newMap;
        });
    }
  };

  const getColor = (limit: number): string => settings.colors[limit] || '#64748b';

  const baseSize = 60 * settings.buttonSizeScale;
  const touches: ActiveTouch[] = Array.from(activeTouches.values());
  const centerOffset = settings.canvasSize / 2;
  const spacing = settings.buttonSpacingScale;
  
  const activeNodeIds = new Set([...touches.map(t => t.nodeId), ...latchedVoices.keys()]);

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
                    const x1 = line.x1 * spacing + centerOffset;
                    const y1 = line.y1 * spacing + centerOffset;
                    const x2 = line.x2 * spacing + centerOffset;
                    const y2 = line.y2 * spacing + centerOffset;
                    const color = getColor(line.limit);
                    
                    // Only show lines connected to active/focused nodes or high level grid
                    // To avoid clutter with the vertical layout
                    
                    return (
                        <line 
                            key={line.id}
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={color}
                            strokeWidth={line.limit === 1 ? 4 : 2} // Thicker for Octaves
                            strokeOpacity={line.limit === 1 ? 0.4 : 0.2}
                            strokeDasharray={line.limit === 1 ? "5,5" : "0"} // Dashed for Octaves
                        />
                    );
                })}
                
                {/* Active Pitch Bend Lines (Straight) */}
                {touches.map(touch => {
                    if (!touch.targetNodeId || !touch.nodeId) return null;
                    const startNode = data.nodes.find(n => n.id === touch.nodeId);
                    const targetNode = data.nodes.find(n => n.id === touch.targetNodeId);
                    if (!startNode || !targetNode) return null;
                    
                    const x1 = startNode.x * spacing + centerOffset;
                    const y1 = startNode.y * spacing + centerOffset;
                    const x2 = targetNode.x * spacing + centerOffset;
                    const y2 = targetNode.y * spacing + centerOffset;
                    
                    return (
                        <line 
                           key={`bend-${touch.id}`}
                           x1={x1} y1={y1} x2={x2} y2={y2}
                           stroke="white"
                           strokeWidth={4}
                           strokeOpacity={0.6 + (touch.bendAmount * 0.4)}
                        />
                    );
                })}
            </svg>

            {/* Nodes Layer */}
            {data.nodes.map((node) => {
                const activeTouch = touches.find(t => t.nodeId === node.id);
                const isLatched = latchedVoices.has(node.id);
                const isActive = !!activeTouch || isLatched;
                const isTarget = touches.some(t => t.targetNodeId === node.id);
                
                const left = node.x * spacing + centerOffset;
                const top = node.y * spacing + centerOffset;
                
                const cTop = getColor(node.limitTop);
                const cBottom = getColor(node.limitBottom);
                const background = `linear-gradient(to bottom, ${cTop} 50%, ${cBottom} 50%)`;

                const layerIndex = settings.layerOrder.indexOf(node.maxPrime);
                const zIndex = isActive ? 100 : (10 + layerIndex);

                let scale = 1.0;
                let opacity = 0.95;
                
                if (settings.isVoiceLeadingEnabled) {
                  const dist = getHarmonicDistance(node.coords, lastPlayedCoords);
                  
                  // Modify distance check: Include Pitch Proximity?
                  // For now, stick to harmonic distance + active state
                  if (!isActive && !isTarget) {
                    const falloff = settings.voiceLeadingStrength; 
                    const visibility = Math.max(0.25, 1 - (dist * falloff));
                    scale = Math.max(0.4, visibility);
                    opacity = Math.max(0.15, visibility);
                  } else {
                    scale = 1.2; 
                    opacity = 1.0;
                  }
                } else {
                    scale = (isActive || isTarget) ? 1.2 : 1.0;
                    opacity = (isActive || isTarget) ? 1.0 : 0.95;
                }

                return (
                    <div
                        key={node.id}
                        className="absolute flex items-center justify-center shadow-md cursor-pointer touch-none select-none transition-transform duration-100 ease-out"
                        style={{
                            left: `${left}px`,
                            top: `${top}px`,
                            width: `${baseSize}px`,
                            height: `${baseSize}px`,
                            background: background,
                            borderRadius: settings.buttonShape,
                            transform: `translate(-50%, -50%) scale(${scale})`,
                            boxShadow: isActive ? `0 0 35px white` : '0 4px 6px rgba(0,0,0,0.6)',
                            zIndex: zIndex,
                            opacity: opacity,
                            border: isLatched ? '3px solid white' : (isActive ? '2px solid white' : '2px solid rgba(255,255,255,0.3)'),
                            filter: isActive ? 'brightness(1.3)' : 'none'
                        }}
                        onPointerDown={(e) => handlePointerDown(e, node)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    >
                        <div className={`flex flex-col w-full h-full text-white font-bold leading-none text-shadow-sm transition-opacity ${scale < 0.6 ? 'opacity-0' : 'opacity-100'}`}>
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
