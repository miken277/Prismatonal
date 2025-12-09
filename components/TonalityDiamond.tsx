
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef } from 'react';
import { AppSettings, LatticeNode, LatticeLine } from '../types';
import { generateLattice, getHarmonicDistance } from '../services/LatticeService';
import AudioEngine from '../services/AudioEngine';

export interface TonalityDiamondHandle {
  clearLatches: () => void;
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

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>(({ settings, audioEngine, onLimitInteraction }, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  
  // Track latched nodes: Key = NodeID, Value = OriginNodeID (The note that caused the latch)
  const [latchedNodes, setLatchedNodes] = useState<Map<string, string>>(new Map());
  
  // Track active pointers (cursors) for bending and "drawing"
  const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
  
  const [hasCentered, setHasCentered] = useState(false);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    clearLatches: () => {
      setLatchedNodes(new Map()); // Visual clear
    }
  }));

  useEffect(() => {
    const result = generateLattice(settings);
    const visibleNodes = result.nodes.filter(n => !settings.hiddenLimits.includes(n.maxPrime));
    const visibleLines = result.lines.filter(l => !settings.hiddenLimits.includes(l.limit));
    setData({ nodes: visibleNodes, lines: visibleLines });
  }, [settings]);

  // Reactive Delatching Logic
  useEffect(() => {
    setLatchedNodes(prev => {
        const next = new Map<string, string>(prev);
        let changed = false;

        const visibleNodeMap = new Map<string, LatticeNode>();
        data.nodes.forEach(n => visibleNodeMap.set(n.id, n));

        next.forEach((originId, nodeId) => {
            const node = visibleNodeMap.get(nodeId);
            
            // Check 1: Is the node still visible/existent in the new grid?
            if (!node) {
                audioEngine.stopVoice(`node-${nodeId}`);
                next.delete(nodeId);
                changed = true;
                return;
            }

            // Check 2: Latch Limit Constraint (Unified Logic)
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
            audioEngine.startVoice(`node-${nodeId}`, ratio);
        }
        return newMap;
    });
  };

  const latchOn = (nodeId: string, ratio: number, originId: string) => {
      setLatchedNodes(prev => {
          if (prev.has(nodeId)) return prev; 
          const newMap = new Map(prev);
          newMap.set(nodeId, originId);
          audioEngine.startVoice(`node-${nodeId}`, ratio);
          return newMap;
      });
  };

  const handlePointerDown = (e: React.PointerEvent, node: LatticeNode) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    onLimitInteraction(node.maxPrime);
    
    if (settings.isLatchModeEnabled) {
        toggleLatch(node.id, node.ratio);
    } else {
        latchOn(node.id, node.ratio, node.id);
    }

    if (settings.isPitchBendEnabled) {
        const cursorId = `cursor-${e.pointerId}`;
        audioEngine.startVoice(cursorId, node.ratio);
        
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
    }
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
        
        audioEngine.glideVoice(`cursor-${e.pointerId}`, bentRatio, 0.05);

        if (settings.isLatchModeEnabled) {
            const spacing = settings.buttonSpacingScale;
            
            for (const node of data.nodes) {
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
  // To ensure a continuous, vibrant rainbow we use multiple stops rather than a single 0-360 interpolation.
  const rainbowPeriod = PITCH_SCALE * spacing;
  
  let rainbowBackgroundFixed: string | undefined = undefined;
  
  if (settings.isRainbowModeEnabled) {
      const stops: string[] = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
          const pct = i / steps;
          const px = pct * rainbowPeriod;
          // Calculate hue: Start at offset, cycle once (360) over the period.
          const hue = (settings.rainbowOffset + i * 60); 
          stops.push(`hsl(${hue}, ${settings.rainbowSaturation}%, ${settings.rainbowBrightness}%) ${px.toFixed(1)}px`);
      }
      // Use repeating-linear-gradient with explicit stops
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
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                {data.lines.map(line => {
                    const x1 = line.x1 * spacing + centerOffset;
                    const y1 = line.y1 * spacing + centerOffset;
                    const x2 = line.x2 * spacing + centerOffset;
                    const y2 = line.y2 * spacing + centerOffset;
                    const color = getColor(line.limit);
                    
                    const n1 = data.nodes.find(n => Math.abs(n.x - line.x1) < 0.1 && Math.abs(n.y - line.y1) < 0.1);
                    const n2 = data.nodes.find(n => Math.abs(n.x - line.x2) < 0.1 && Math.abs(n.y - line.y2) < 0.1);
                    
                    let lineOpacity = 0.1;
                    let lineWidth = line.limit === 1 ? 4 : 2;

                    if (n1 && n2) {
                        const n1Active = latchedNodes.has(n1.id);
                        const n2Active = latchedNodes.has(n2.id);

                        if (n1Active && n2Active) {
                             lineOpacity = 1.0;
                             lineWidth = 6;
                        } else if (n1Active || n2Active) {
                             lineOpacity = 0.6;
                             lineWidth = 3;
                        } else if (settings.isVoiceLeadingEnabled && activeNodes.length > 0) {
                             lineOpacity = 0.05;
                        }
                    }

                    return (
                        <line 
                            key={line.id}
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={color}
                            strokeWidth={lineWidth}
                            strokeOpacity={lineOpacity}
                            strokeDasharray={line.limit === 1 ? "5,5" : "0"} 
                        />
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
                const isLatched = latchedNodes.has(node.id);
                const isHovered = cursors.some(c => c.originNodeId === node.id); 
                const isActive = isLatched || isHovered;
                
                const left = node.x * spacing + centerOffset;
                const top = node.y * spacing + centerOffset;
                
                const cTop = getColor(node.limitTop);
                const cBottom = getColor(node.limitBottom);
                const background = `linear-gradient(to bottom, ${cTop} 50%, ${cBottom} 50%)`;

                const layerIndex = settings.layerOrder.indexOf(node.maxPrime);
                const zIndex = isActive ? 80 : (10 + layerIndex);

                let scale = 1.0;
                let opacity = 0.95;
                
                if (settings.isVoiceLeadingEnabled && activeNodes.length > 0) {
                    if (isActive) {
                        scale = 1.3;
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
                    scale = isActive ? 1.3 : 1.0;
                    opacity = isActive ? 1.0 : 0.95;
                }

                // Colored Illumination calculation
                let boxShadowColor = 'white';
                let borderColor = isLatched ? 'white' : (isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)');
                
                if (settings.isColoredIlluminationEnabled) {
                     // The background gradient repeats every `rainbowPeriod`.
                     // The gradient starts at 0px (top) with hue = offset.
                     // At Y = top, the hue has progressed by (top / period) * 360.
                     
                     // We use standard mod logic. Since `top` can be effectively any positive value (canvas is large),
                     // and CSS repeating-linear-gradient handles the tiling, we math it:
                     
                     const phase = (top % rainbowPeriod) / rainbowPeriod;
                     const hue = (settings.rainbowOffset + phase * 360) % 360;
                     
                     if (isLatched || isHovered) {
                         // High saturation/lightness for the "Illumination" effect
                         boxShadowColor = `hsl(${hue}, 100%, 70%)`;
                         borderColor = `hsl(${hue}, 100%, 80%)`;
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
                            boxShadow: isLatched ? `0 0 35px ${boxShadowColor}` : (isHovered ? `0 0 15px ${boxShadowColor}` : '0 4px 6px rgba(0,0,0,0.6)'),
                            zIndex: zIndex,
                            opacity: opacity,
                            border: settings.isColoredIlluminationEnabled && (isLatched || isHovered) ? `3px solid ${borderColor}` : (isLatched ? '3px solid white' : (isHovered ? '2px solid rgba(255,255,255,0.8)' : '2px solid rgba(255,255,255,0.3)')),
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
});

export default TonalityDiamond;
