
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef } from 'react';
import { AppSettings, LatticeNode, LatticeLine } from '../types';
import { generateLattice, getHarmonicDistance } from '../services/LatticeService';
import AudioEngine from '../services/AudioEngine';

export interface TonalityDiamondHandle {
  clearLatches: () => void;
  centerView: () => void;
  increaseDepth: () => void;
}

interface Props {
  settings: AppSettings;
  audioEngine: AudioEngine;
  onLimitInteraction: (limit: number) => void;
}

interface ActiveCursor {
  pointerId: number;
  currentX: number;
  currentY: number;
  originNodeId: string; // The node where the touch started
}

const PITCH_SCALE = 200; // Pixels per octave, matches LatticeService

// Map prime limits to their coordinate index in the coords array
const LIMIT_TO_INDEX: {[key: number]: number} = {
    3: 0,
    5: 1,
    7: 2,
    11: 3,
    13: 4
};

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>(({ settings, audioEngine, onLimitInteraction }, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  
  // Track latched nodes
  const [latchedNodes, setLatchedNodes] = useState<Map<string, string>>(new Map());
  
  // Track active pointers
  const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
  
  // Track the origins for depth generation (Array of coordinate arrays)
  const [depthOrigins, setDepthOrigins] = useState<number[][]>([[0,0,0,0,0]]);
  
  // Track last touched node for Increasing Depth
  const [lastTouchedNodeCoords, setLastTouchedNodeCoords] = useState<number[] | null>(null);

  const [hasCentered, setHasCentered] = useState(false);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    clearLatches: () => {
      setLatchedNodes(new Map()); // Visual clear
    },
    centerView: () => {
        if (settings.centerResetsDepth) {
            setDepthOrigins([[0,0,0,0,0]]);
            setLastTouchedNodeCoords(null);
        }

        if (scrollContainerRef.current) {
            const center = settings.canvasSize / 2;
            const viewportW = scrollContainerRef.current.clientWidth;
            const viewportH = scrollContainerRef.current.clientHeight;
            scrollContainerRef.current.scrollLeft = center - viewportW / 2;
            scrollContainerRef.current.scrollTop = center - viewportH / 2;
        }
    },
    increaseDepth: () => {
        if (lastTouchedNodeCoords) {
            setDepthOrigins(prev => {
                // Check if already exists to prevent dupes in array
                const exists = prev.some(o => o.every((val, i) => val === lastTouchedNodeCoords[i]));
                if (exists) return prev;
                return [...prev, [...lastTouchedNodeCoords]];
            });
        }
    }
  }));

  useEffect(() => {
    // Pass the depthOrigins array to generation service
    const result = generateLattice(settings, depthOrigins);
    
    // Strict Filtering Logic based on hiddenLimits for VISIBILITY
    const visibleNodes = result.nodes.filter(n => {
        // Check all hidden limits
        for (const limit of settings.hiddenLimits) {
            const idx = LIMIT_TO_INDEX[limit];
            if (idx !== undefined && n.coords[idx] !== 0) return false;
        }
        return true;
    });

    const visibleLines = result.lines.filter(l => !settings.hiddenLimits.includes(l.limit));
    
    setData({ nodes: visibleNodes, lines: visibleLines });
  }, [settings, depthOrigins]);

  // Reactive Delatching Logic
  useEffect(() => {
    setLatchedNodes(prev => {
        const next = new Map<string, string>(prev);
        let changed = false;

        const visibleNodeMap = new Map<string, LatticeNode>();
        data.nodes.forEach(n => visibleNodeMap.set(n.id, n));

        next.forEach((originId, nodeId) => {
            const node = visibleNodeMap.get(nodeId);
            if (!node) {
                audioEngine.stopVoice(`node-${nodeId}`);
                next.delete(nodeId);
                changed = true;
                return;
            }

            if (originId !== nodeId) {
                 const originNode = visibleNodeMap.get(originId);
                 if (!originNode) {
                     audioEngine.stopVoice(`node-${nodeId}`);
                     next.delete(nodeId);
                     changed = true;
                     return;
                 }

                 const allowedMaxIndex = settings.latchShellLimit - 2; 
                 let isAllowed = true;
                 if (settings.latchShellLimit === 1) {
                     const dist = getHarmonicDistance(node.coords, originNode.coords);
                     if (dist > 0) isAllowed = false;
                 } else {
                     for(let i=0; i<node.coords.length; i++) {
                        const diff = Math.abs(node.coords[i] - originNode.coords[i]);
                        if (diff > 0 && i > allowedMaxIndex) {
                            isAllowed = false;
                            break;
                        }
                     }
                 }

                 if (!isAllowed) {
                     audioEngine.stopVoice(`node-${nodeId}`);
                     next.delete(nodeId);
                     changed = true;
                 }
            }
        });

        return changed ? next : prev;
    });
  }, [settings, data.nodes, audioEngine]);


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

  // --- Logic Helpers ---

  const toggleLatch = (nodeId: string, ratio: number) => {
    setLatchedNodes(prev => {
        const newMap = new Map(prev);
        if (newMap.has(nodeId)) {
            newMap.delete(nodeId);
            audioEngine.stopVoice(`node-${nodeId}`);
        } else {
            newMap.set(nodeId, nodeId);
            audioEngine.startVoice(`node-${nodeId}`, ratio, settings.baseFrequency);
        }
        return newMap;
    });
  };

  const latchOn = (nodeId: string, ratio: number, originId: string) => {
      setLatchedNodes(prev => {
          if (prev.has(nodeId)) return prev; 
          const newMap = new Map(prev);
          newMap.set(nodeId, originId);
          audioEngine.startVoice(`node-${nodeId}`, ratio, settings.baseFrequency);
          return newMap;
      });
  };

  const handlePointerDown = (e: React.PointerEvent, node: LatticeNode) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    onLimitInteraction(node.maxPrime);
    setLastTouchedNodeCoords(node.coords);
    
    // Toggle Logic
    if (settings.isLatchModeEnabled) {
        toggleLatch(node.id, node.ratio);
    } else {
        latchOn(node.id, node.ratio, node.id);
    }

    if (settings.isPitchBendEnabled) {
        const cursorId = `cursor-${e.pointerId}`;
        audioEngine.startVoice(cursorId, node.ratio, settings.baseFrequency);
    }
    
    setActiveCursors(prev => {
        const next = new Map(prev);
        next.set(e.pointerId, {
            pointerId: e.pointerId,
            currentX: e.clientX,
            currentY: e.clientY,
            originNodeId: node.id
        });
        return next;
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeCursors.has(e.pointerId)) return;
    const cursor = activeCursors.get(e.pointerId)!;
    
    setActiveCursors(prev => {
        const next = new Map(prev);
        next.set(e.pointerId, {
            ...cursor,
            currentX: e.clientX,
            currentY: e.clientY
        });
        return next;
    });

    if (settings.isPitchBendEnabled && scrollContainerRef.current) {
        const centerOffset = settings.canvasSize / 2;
        const scrollLeft = scrollContainerRef.current.scrollLeft;
        const scrollTop = scrollContainerRef.current.scrollTop;
        
        const canvasY = e.clientY + scrollTop;
        const relY = canvasY - centerOffset;
        
        const effectivePitchScale = PITCH_SCALE * settings.buttonSpacingScale;
        const bentRatio = Math.pow(2, -relY / effectivePitchScale);
        
        audioEngine.glideVoice(`cursor-${e.pointerId}`, bentRatio, settings.baseFrequency, 0.05);

        if (settings.isLatchModeEnabled) {
            const spacing = settings.buttonSpacingScale;
            
            for (const node of data.nodes) {
                // BUG FIX: Ignore the node we started on to prevent re-triggering logic during micro-movements
                if (node.id === cursor.originNodeId) continue;

                const nx = (node.x * spacing + centerOffset) - scrollLeft;
                const ny = (node.y * spacing + centerOffset) - scrollTop;
                
                const radius = (60 * settings.buttonSizeScale) / 2;
                const dx = e.clientX - nx;
                const dy = e.clientY - ny;
                const distSq = dx*dx + dy*dy;

                if (distSq < radius * radius) {
                    if (!latchedNodes.has(node.id)) {
                         const originNode = data.nodes.find(n => n.id === cursor.originNodeId);
                         if (originNode) {
                             const allowedMaxIndex = settings.latchShellLimit - 2; 
                             
                             let isAllowed = true;
                             if (settings.latchShellLimit === 1) {
                                 const hDist = getHarmonicDistance(node.coords, originNode.coords);
                                 if (hDist > 0) isAllowed = false;
                             } else {
                                 for(let i=0; i<node.coords.length; i++) {
                                     const diff = Math.abs(node.coords[i] - originNode.coords[i]);
                                     if (diff > 0 && i > allowedMaxIndex) {
                                         isAllowed = false;
                                         break;
                                     }
                                 }
                             }

                             if (isAllowed) {
                                 latchOn(node.id, node.ratio, cursor.originNodeId);
                                 setLastTouchedNodeCoords(node.coords);
                             }
                         }
                    }
                }
            }
        }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeCursors.has(e.pointerId)) {
        audioEngine.stopVoice(`cursor-${e.pointerId}`);
        setActiveCursors(prev => {
            const next = new Map(prev);
            next.delete(e.pointerId);
            return next;
        });
    }

    if (!settings.isLatchModeEnabled) {
        const cursor = activeCursors.get(e.pointerId);
        if (cursor) {
             if (latchedNodes.has(cursor.originNodeId)) {
                 setLatchedNodes(prev => {
                     const next = new Map(prev);
                     next.delete(cursor.originNodeId);
                     audioEngine.stopVoice(`node-${cursor.originNodeId}`);
                     return next;
                 });
             }
        }
    }
  };

  const getColor = (limit: number): string => settings.colors[limit] || '#64748b';

  const baseSize = 60 * settings.buttonSizeScale;
  const cursors: ActiveCursor[] = Array.from(activeCursors.values());
  const centerOffset = settings.canvasSize / 2;
  const spacing = settings.buttonSpacingScale;
  
  const activeNodes = data.nodes.filter(n => latchedNodes.has(n.id));

  // Rainbow Generation
  const rainbowPeriod = PITCH_SCALE * spacing;
  let rainbowBackgroundFixed: string | undefined = undefined;
  
  if (settings.isRainbowModeEnabled) {
      const stops: string[] = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
          const pct = i / steps;
          const px = pct * rainbowPeriod;
          const hue = (settings.rainbowOffset + i * 60); 
          stops.push(`hsl(${hue}, ${settings.rainbowSaturation}%, ${settings.rainbowBrightness}%) ${px.toFixed(1)}px`);
      }
      rainbowBackgroundFixed = `repeating-linear-gradient(to bottom, ${stops.join(', ')})`;
  }
  
  return (
    <div 
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto bg-slate-950 relative"
        style={{ touchAction: 'none' }}
    >
        <div 
            className="relative"
            style={{ 
                width: settings.canvasSize, 
                height: settings.canvasSize,
                background: rainbowBackgroundFixed,
            }}
        >
            <style>{`
              @keyframes flowAnimation {
                to { stroke-dashoffset: -100; }
              }
              .animate-flow {
                animation: flowAnimation ${settings.voiceLeadingAnimationSpeed}s linear infinite;
              }
            `}</style>
            
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                {/* Glow Filter Definition */}
                <defs>
                   <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation={settings.voiceLeadingGlowAmount * 4} result="coloredBlur"/>
                      <feMerge>
                         <feMergeNode in="coloredBlur"/>
                         <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                   </filter>
                </defs>

                {data.lines.map(line => {
                    let x1 = line.x1 * spacing + centerOffset;
                    let y1 = line.y1 * spacing + centerOffset;
                    let x2 = line.x2 * spacing + centerOffset;
                    let y2 = line.y2 * spacing + centerOffset;
                    
                    // Culling: Do not render lines outside the canvas bounds
                    if (x1 < 0 || x1 > settings.canvasSize || y1 < 0 || y1 > settings.canvasSize ||
                        x2 < 0 || x2 > settings.canvasSize || y2 < 0 || y2 > settings.canvasSize) {
                        return null;
                    }

                    const n1 = data.nodes.find(n => Math.abs(n.x - line.x1) < 0.1 && Math.abs(n.y - line.y1) < 0.1);
                    const n2 = data.nodes.find(n => Math.abs(n.x - line.x2) < 0.1 && Math.abs(n.y - line.y2) < 0.1);
                    
                    if (!n1 || !n2) return null;

                    const limitColor = getColor(line.limit);
                    
                    let strokeColor = limitColor;
                    let lineOpacity = 0.1;
                    let lineWidth = line.limit === 1 ? 4 : 2;
                    let isVoiceLeadingActive = false;
                    let lineStyle = {};

                    const n1Active = latchedNodes.has(n1.id);
                    const n2Active = latchedNodes.has(n2.id);

                    if (n1Active && n2Active) {
                        // Voice Leading Connection Active
                        lineOpacity = 1.0;
                        lineWidth = 5;
                        strokeColor = limitColor; // Keep limit color
                        isVoiceLeadingActive = true;
                        
                        // Brighten effect for active lines
                        lineStyle = { 
                            filter: `brightness(1.5) drop-shadow(0 0 5px ${limitColor})` 
                        };
                        
                        // Directional Logic
                        const axisIndex = LIMIT_TO_INDEX[line.limit];
                        if (axisIndex !== undefined) {
                            const c1 = n1.coords[axisIndex];
                            const c2 = n2.coords[axisIndex];
                            
                            // Default: Low -> High
                            let swap = c1 > c2;
                            if (settings.voiceLeadingReverseDir) swap = !swap;

                            if (swap) {
                                const tempX = x1; const tempY = y1;
                                x1 = x2; y1 = y2;
                                x2 = tempX; y2 = tempY;
                            }
                        }

                    } else if (n1Active || n2Active) {
                        lineOpacity = 0.6;
                        lineWidth = 3;
                    } else if (settings.isVoiceLeadingEnabled && activeNodes.length > 0) {
                        lineOpacity = 0.05;
                    }

                    // Calculate Glow/Lobe parameters
                    const glowWidthMultiplier = 1 + (settings.voiceLeadingGlowAmount * 3); // 1x to 4x
                    const animStrokeWidth = lineWidth * glowWidthMultiplier; 

                    return (
                        <g key={line.id}>
                            {/* Base Line - Colored */}
                            <line 
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke={strokeColor}
                                strokeWidth={lineWidth}
                                strokeOpacity={lineOpacity}
                                strokeDasharray={line.limit === 1 ? "5,5" : "0"} 
                                style={lineStyle}
                            />
                            {/* Animation Overlay - Moving Glowing Lobes */}
                            {isVoiceLeadingActive && settings.isVoiceLeadingAnimationEnabled && (
                                <line 
                                    x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke="white"
                                    strokeWidth={animStrokeWidth}
                                    strokeOpacity={0.9}
                                    strokeLinecap="round" 
                                    strokeDasharray={`0 100`} // Dots with long gaps
                                    filter="url(#glow)"
                                    className="animate-flow"
                                />
                            )}
                        </g>
                    );
                })}
                
                {cursors.map(cursor => {
                    const node = data.nodes.find(n => n.id === cursor.originNodeId);
                    if (!node) return null;
                    const nx = node.x * spacing + centerOffset;
                    const ny = node.y * spacing + centerOffset;
                    const cx = cursor.currentX + (scrollContainerRef.current?.scrollLeft || 0);
                    const cy = cursor.currentY + (scrollContainerRef.current?.scrollTop || 0);
                    return (
                         <line 
                           key={`drag-${cursor.pointerId}`}
                           x1={nx} y1={ny} x2={cx} y2={cy}
                           stroke="white"
                           strokeWidth={2}
                           strokeOpacity={0.5}
                         />
                    );
                })}
            </svg>

            {data.nodes.map((node) => {
                const left = node.x * spacing + centerOffset;
                const top = node.y * spacing + centerOffset;

                // Culling: If the node is outside the canvas area, do not render.
                if (left < -50 || left > settings.canvasSize + 50 || top < -50 || top > settings.canvasSize + 50) {
                    return null;
                }

                const isLatched = latchedNodes.has(node.id);
                const isHovered = cursors.some(c => c.originNodeId === node.id); 
                const isActive = isLatched || isHovered;
                
                const cTop = getColor(node.limitTop);
                const cBottom = getColor(node.limitBottom);
                const background = `linear-gradient(to bottom, ${cTop} 50%, ${cBottom} 50%)`;

                const layerIndex = settings.layerOrder.indexOf(node.maxPrime);
                const zIndex = isActive ? 80 : (10 + layerIndex);

                let scale = 1.0;
                let opacity = 0.95;
                
                if (settings.isVoiceLeadingEnabled && activeNodes.length > 0) {
                    if (isActive) {
                        scale = settings.latchedZoomScale;
                        opacity = 1.0;
                    } else {
                        // Unified Voice Leading Logic
                        const allowedMaxIndex = settings.latchShellLimit - 2; 
                        let isCompatible = false;
                        let minDist = Infinity;
                        
                        for (const activeNode of activeNodes) {
                             let valid = true;
                             if (settings.latchShellLimit === 1) {
                                 const hDist = getHarmonicDistance(node.coords, activeNode.coords);
                                 if (hDist > 0) valid = false;
                             } else {
                                 for(let i=0; i<node.coords.length; i++) {
                                     const diff = Math.abs(node.coords[i] - activeNode.coords[i]);
                                     if (diff > 0 && i > allowedMaxIndex) {
                                         valid = false;
                                         break;
                                     }
                                 }
                             }
                            
                             if (valid) {
                                isCompatible = true;
                                const d = getHarmonicDistance(node.coords, activeNode.coords);
                                if (d < minDist) minDist = d;
                             }
                        }

                        if (!isCompatible) {
                            opacity = 0.15; 
                            scale = 0.4;
                        } else {
                             const falloff = settings.voiceLeadingStrength; 
                             const visibility = Math.max(0.15, 1 - (minDist * falloff));
                             scale = Math.max(0.4, 0.5 + (visibility * 0.5));
                             opacity = visibility;
                        }
                    }
                } else {
                    scale = isActive ? settings.latchedZoomScale : 1.0;
                    opacity = isActive ? 1.0 : 0.95;
                }

                // Colored Illumination calculation
                let boxShadowColor = 'white';
                let borderColor = isLatched ? 'white' : (isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)');
                let borderStyle = isLatched ? '3px solid white' : (isHovered ? '2px solid rgba(255,255,255,0.8)' : '2px solid rgba(255,255,255,0.3)');

                if (settings.isColoredIlluminationEnabled) {
                     const phase = (top % rainbowPeriod) / rainbowPeriod;
                     const hue = (settings.rainbowOffset + phase * 360) % 360;
                     // Use settings saturation or max if rainbow mode off, but usually settings makes sense if consistent
                     const sat = settings.isRainbowModeEnabled ? settings.rainbowSaturation : 100;
                     
                     // Visible active color for Outline
                     const activeColor = `hsl(${hue}, ${sat}%, 60%)`;
                     
                     if (isActive) {
                        borderColor = activeColor;
                        // Tight matching shadow, not diffuse glow
                        boxShadowColor = activeColor;
                        borderStyle = `4px solid ${borderColor}`;
                     }
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
                            boxShadow: isActive ? `0 0 10px ${boxShadowColor}` : '0 4px 6px rgba(0,0,0,0.6)',
                            zIndex: zIndex,
                            opacity: opacity,
                            border: borderStyle,
                            filter: isActive ? 'brightness(1.1)' : 'none'
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
});

export default TonalityDiamond;
