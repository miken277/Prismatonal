
import React, { useEffect, useRef, useState } from 'react';
import { AppSettings, LatticeNode } from '../types';
import { generateLattice } from '../services/LatticeService';
import AudioEngine from '../services/AudioEngine';

interface Props {
  settings: AppSettings;
  audioEngine: AudioEngine;
}

interface ActiveTouch {
  id: number; // Pointer ID
  nodeId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  lockedAxis: 'x' | 'y' | null;
}

const TonalityDiamond: React.FC<Props> = ({ settings, audioEngine }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<LatticeNode[]>([]);
  const [activeTouches, setActiveTouches] = useState<Map<number, ActiveTouch>>(new Map());

  // Generate nodes when limit changes
  useEffect(() => {
    setNodes(generateLattice(settings.tonalityLimit));
  }, [settings.tonalityLimit]);

  // Audio Engine updates
  useEffect(() => {
    audioEngine.setPolyphony(settings.polyphony);
  }, [settings.polyphony, audioEngine]);

  const handlePointerDown = (e: React.PointerEvent, node: LatticeNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Play sound
    audioEngine.startVoice(e.pointerId, node.ratio);

    // Track touch
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
    
    // Determine Axis Lock if not set
    let lockedAxis = touch.lockedAxis;
    if (!lockedAxis) {
      const dx = Math.abs(e.clientX - touch.startX);
      const dy = Math.abs(e.clientY - touch.startY);
      if (dx > 5 || dy > 5) { // Threshold
        lockedAxis = dx > dy ? 'x' : 'y';
      }
    }

    // Calculate delta and detune
    // Visual Logic: 100px drag = 200 cents (1 whole tone) approx
    const sensitivity = 2.0; 
    let delta = 0;
    if (lockedAxis === 'x') delta = e.clientX - touch.startX;
    if (lockedAxis === 'y') delta = -(e.clientY - touch.startY); // Up is positive pitch

    // Snap logic
    let detune = delta * sensitivity;
    if (settings.isPitchSnapEnabled) {
       // Simple snap: if detune is close to 100 (semitone) or 0, pull it
       const snapStrength = 20;
       if (Math.abs(detune) < snapStrength) detune = 0;
    }

    audioEngine.bendVoice(e.pointerId, detune);

    // Update state for visual feedback
    setActiveTouches(prev => {
        const newMap = new Map(prev);
        newMap.set(e.pointerId, {
            ...touch,
            currentX: e.clientX,
            currentY: e.clientY,
            lockedAxis
        });
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

  // Calculations for layout
  // Base unit size (responsive)
  const baseSize = 60 * settings.buttonSizeScale;
  const spacing = 90 * settings.buttonSpacingScale;

  // Pre-calculate array to fix type inference issues in the map loop
  const touches: ActiveTouch[] = Array.from(activeTouches.values());

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-900 touch-none"
      style={{ perspective: '1000px' }}
    >
      {/* Diamond Container with Rotation */}
      <div 
        className="relative transition-transform duration-500 ease-out"
        style={{
          transform: `rotate(${settings.diamondRotation}deg) scale(${settings.aspectRatio}, 1)`,
          // We set width/height to 0 to act as a point of origin, 
          // allowing absolute children to spread out from the center.
          width: '0', 
          height: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {nodes.map((node) => {
          const activeTouch = touches.find(t => t.nodeId === node.id);
          const isActive = !!activeTouch;
          
          // Visual displacement
          let transformX = 0;
          let transformY = 0;

          if (isActive && activeTouch && settings.isPitchBendEnabled) {
             if (activeTouch.lockedAxis === 'x') transformX = activeTouch.currentX - activeTouch.startX;
             if (activeTouch.lockedAxis === 'y') transformY = activeTouch.currentY - activeTouch.startY;
          }

          // Grid Position
          // Center is 0,0 calculated by LatticeService
          const left = `${node.x * spacing}px`;
          const top = `${node.y * spacing}px`;

          // Dynamic text size for long fractions
          const fontSize = node.label.length > 5 ? '10px' : '12px';

          return (
            <div
              key={node.id}
              className="absolute flex items-center justify-center shadow-lg border-2 border-slate-800/50 cursor-pointer touch-none select-none transition-colors duration-75"
              style={{
                left,
                top,
                width: `${baseSize}px`,
                height: `${baseSize}px`,
                backgroundColor: settings.colors[node.limitIdentity] || '#fff',
                borderRadius: settings.buttonShape,
                transform: `translate(-50%, -50%) translate(${transformX}px, ${transformY}px)`,
                boxShadow: isActive ? `0 0 20px ${settings.colors[node.limitIdentity]}` : 'none',
                zIndex: isActive ? 10 : 1,
                opacity: isActive ? 1 : 0.8
              }}
              onPointerDown={(e) => handlePointerDown(e, node)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <span 
                className="font-bold text-black/60 pointer-events-none"
                style={{ fontSize }}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TonalityDiamond;
