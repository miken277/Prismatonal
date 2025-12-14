
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef } from 'react';
import { AppSettings, LatticeNode, LatticeLine, GenerationOrigin, ButtonShape } from '../types';
import { generateLattice, getHarmonicDistance } from '../services/LatticeService';
import AudioEngine from '../services/AudioEngine';

export interface TonalityDiamondHandle {
  clearLatches: () => void;
  centerView: () => void;
  increaseDepth: () => void;
  getLatchedNodes: () => LatticeNode[];
}

interface Props {
  settings: AppSettings;
  audioEngine: AudioEngine;
  onLimitInteraction: (limit: number) => void;
  activeChordIds: string[];
  uiUnlocked: boolean;
}

interface ActiveCursor {
  pointerId: number;
  currentX: number;
  currentY: number;
  originNodeId: string; 
}

// Helper to lighten color for gradient center (0.0 to 1.0 amount, where 1.0 is white)
const lightenColor = (color: string, amount: number) => {
    if (color.startsWith('#') && color.length === 7) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const nr = Math.round(r + (255 - r) * amount);
        const ng = Math.round(g + (255 - g) * amount);
        const nb = Math.round(b + (255 - b) * amount);

        return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
    }
    return color;
};

// --- SPATIAL HASH SYSTEM ---
class SpatialHash {
  private cellSize: number;
  private cells: Map<string, LatticeNode[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  key(x: number, y: number) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(node: LatticeNode, x: number, y: number) {
    const k = this.key(x, y);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k)!.push(node);
  }

  query(x: number, y: number): LatticeNode[] {
    const results: LatticeNode[] = [];
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const k = `${cx + i},${cy + j}`;
        const cell = this.cells.get(k);
        if (cell) {
          for (let n = 0; n < cell.length; n++) {
            results.push(cell[n]);
          }
        }
      }
    }
    return results;
  }
  
  clear() {
    this.cells.clear();
  }
}

const PITCH_SCALE = 200;
const LIMIT_TO_INDEX: {[key: number]: number} = { 3: 0, 5: 1, 7: 2, 11: 3, 13: 4 };

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Data State
  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  const [spatialHash] = useState(() => new SpatialHash(150)); 
  
  // Interaction State
  const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
  const [manualLatchedNodes, setManualLatchedNodes] = useState<Map<string, string>>(new Map());
  const [effectiveLatchedNodes, setEffectiveLatchedNodes] = useState<Map<string, string>>(new Map());
  
  // Refs for Render Loop (Source of Truth for Animation)
  const settingsRef = useRef(settings);
  const dataRef = useRef(data);
  const activeCursorsRef = useRef(activeCursors);
  const effectiveLatchedRef = useRef(effectiveLatchedNodes);
  
  // NEW: Ref for Cursor Positions to bypass React State during high-freq drag events
  const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());

  // Sync Refs
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { activeCursorsRef.current = activeCursors; }, [activeCursors]);
  useEffect(() => { effectiveLatchedRef.current = effectiveLatchedNodes; }, [effectiveLatchedNodes]);
  
  // Generation State
  const [depthOrigins, setDepthOrigins] = useState<GenerationOrigin[]>([{coords: [0,0,0,0,0], octave: 0}]);
  const [lastTouchedNode, setLastTouchedNode] = useState<GenerationOrigin | null>(null);
  const [hasCentered, setHasCentered] = useState(false);
  const prevActiveChordIds = useRef<string[]>([]);

  // --- External API ---
  useImperativeHandle(ref, () => ({
    clearLatches: () => setManualLatchedNodes(new Map()),
    centerView: () => {
        if (settings.centerResetsDepth) {
            setDepthOrigins([{coords: [0,0,0,0,0], octave: 0}]);
            setLastTouchedNode(null);
        }
        centerScroll();
    },
    increaseDepth: () => {
        if (lastTouchedNode) {
            setDepthOrigins(prev => {
                const exists = prev.some(o => 
                    o.octave === lastTouchedNode.octave &&
                    o.coords.every((val, i) => val === lastTouchedNode.coords[i])
                );
                if (exists) return prev;
                return [...prev, { coords: [...lastTouchedNode.coords], octave: lastTouchedNode.octave }];
            });
        }
    },
    getLatchedNodes: () => {
        return data.nodes.filter(n => effectiveLatchedNodes.has(n.id));
    }
  }));

  const centerScroll = () => {
      if (scrollContainerRef.current) {
        const center = settings.canvasSize / 2;
        const viewportW = scrollContainerRef.current.clientWidth;
        const viewportH = scrollContainerRef.current.clientHeight;
        scrollContainerRef.current.scrollLeft = center - viewportW / 2;
        scrollContainerRef.current.scrollTop = center - viewportH / 2;
      }
  };

  useLayoutEffect(() => {
    if (!hasCentered && scrollContainerRef.current) {
        centerScroll();
        setHasCentered(true);
    }
  }, [settings.canvasSize]);

  // --- Data Generation ---
  useEffect(() => {
    const effectiveSettings = { ...settings, limitDepths: { ...settings.limitDepths } };
    const hiddenLimits = settings.hiddenLimits as number[]; 

    hiddenLimits.forEach(limit => {
        if (limit in effectiveSettings.limitDepths) {
            effectiveSettings.limitDepths[limit as 3|5|7|11|13] = 0;
        }
    });

    const result = generateLattice(effectiveSettings, depthOrigins);
    
    const visibleNodeIds = new Set(result.nodes.map(n => n.id));

    const visibleLines = result.lines.filter(l => {
        if (hiddenLimits.includes(l.limit)) return false;
        if (!visibleNodeIds.has(l.sourceId) || !visibleNodeIds.has(l.targetId)) return false;
        return true;
    });
    
    spatialHash.clear();
    const centerOffset = settings.canvasSize / 2;
    const spacing = settings.buttonSpacingScale;

    result.nodes.forEach(node => {
        const x = node.x * spacing + centerOffset;
        const y = node.y * spacing + centerOffset;
        spatialHash.insert(node, x, y);
    });

    setData({ nodes: result.nodes, lines: visibleLines });
  }, [
      settings.limitDepths, 
      settings.limitComplexities, 
      settings.hiddenLimits,
      settings.latticeAspectRatio, 
      depthOrigins, 
      settings.buttonSpacingScale, 
      settings.canvasSize
  ]);

  // --- Logic: Latches & Audio Sync ---
  useEffect(() => {
    const newEffective = new Map<string, string>(manualLatchedNodes);
    
    activeChordIds.forEach(chordId => {
        const chordDef = settings.savedChords.find(c => c.id === chordId);
        if (chordDef) {
            chordDef.nodes.forEach(n => {
                if (!newEffective.has(n.id)) newEffective.set(n.id, n.id);
            });
        }
    });
    
    if (settings.chordsAlwaysRelatch) {
         const newChords = activeChordIds.filter(id => !prevActiveChordIds.current.includes(id));
         if (newChords.length > 0) {
             newChords.forEach(chordId => {
                 const chordDef = settings.savedChords.find(c => c.id === chordId);
                 if (chordDef) {
                     chordDef.nodes.forEach(n => {
                        const fullNode = data.nodes.find(dn => dn.id === n.id);
                        if (fullNode) audioEngine.startVoice(`node-${n.id}`, fullNode.ratio, settings.baseFrequency);
                     });
                 }
             });
         }
    }
    
    setEffectiveLatchedNodes(newEffective);
    prevActiveChordIds.current = activeChordIds;
  }, [manualLatchedNodes, activeChordIds, settings.savedChords, settings.chordsAlwaysRelatch, data.nodes, settings.baseFrequency]);

  // Audio Diffing
  const prevEffectiveRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
      const current = effectiveLatchedNodes;
      const prev = prevEffectiveRef.current;
      
      current.forEach((originId, nodeId) => {
          if (!prev.has(nodeId)) {
               const node = data.nodes.find(n => n.id === nodeId);
               if (node) audioEngine.startVoice(`node-${nodeId}`, node.ratio, settings.baseFrequency);
          }
      });
      prev.forEach((_, nodeId) => {
          if (!current.has(nodeId)) audioEngine.stopVoice(`node-${nodeId}`);
      });

      prevEffectiveRef.current = current;
  }, [effectiveLatchedNodes, data.nodes, settings.baseFrequency]);

  // Reactive Delatching
  useEffect(() => {
    setManualLatchedNodes((prev: Map<string, string>) => {
        const next = new Map<string, string>(prev);
        let changed = false;
        const visibleNodeMap = new Map<string, LatticeNode>(data.nodes.map(n => [n.id, n]));

        next.forEach((originId, nodeId) => {
            const node = visibleNodeMap.get(nodeId);
            if (!node) { next.delete(nodeId); changed = true; return; }
            
            if (originId !== nodeId) {
                 const originNode = visibleNodeMap.get(originId);
                 if (!originNode) { next.delete(nodeId); changed = true; return; }

                 const allowedMaxIndex = settings.latchShellLimit - 2; 
                 let isAllowed = true;
                 if (settings.latchShellLimit === 1) {
                     const dist = getHarmonicDistance(node.coords, originNode.coords);
                     if (dist > 0) isAllowed = false;
                 } else {
                     for(let i=0; i<node.coords.length; i++) {
                        const diff = Math.abs(node.coords[i] - originNode.coords[i]);
                        if (diff > 0 && i > allowedMaxIndex) { isAllowed = false; break; }
                     }
                 }
                 if (!isAllowed) { next.delete(nodeId); changed = true; }
            }
        });
        return changed ? next : prev;
    });
  }, [settings.latchShellLimit, data.nodes]); 

  useEffect(() => {
    audioEngine.setPolyphony(settings.polyphony);
  }, [settings.polyphony]);

  // --- Interaction Handlers ---
  const handlePointerDown = (e: React.PointerEvent) => {
      if (uiUnlocked || !canvasRef.current) return;
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update Cursor Position Ref immediately (for instant responsiveness)
      cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const candidates = spatialHash.query(x, y);
      const centerOffset = settings.canvasSize / 2;
      const spacing = settings.buttonSpacingScale;
      const radius = (60 * settings.buttonSizeScale) / 2;
      const radiusSq = radius * radius;

      let hitNode: LatticeNode | null = null;
      for (const node of candidates) {
          const nx = node.x * spacing + centerOffset;
          const ny = node.y * spacing + centerOffset;
          const dx = x - nx;
          const dy = y - ny;
          if (dx*dx + dy*dy < radiusSq) {
              hitNode = node;
              break; 
          }
      }

      if (hitNode) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        
        // Optimistic UI Update: Update Ref Immediately for instant feedback in render loop
        const newEffective = new Map(effectiveLatchedRef.current);
        if (settings.isLatchModeEnabled) {
             if (newEffective.has(hitNode.id)) newEffective.delete(hitNode.id);
             else newEffective.set(hitNode.id, hitNode.id);
        } else {
             if (!newEffective.has(hitNode.id)) newEffective.set(hitNode.id, hitNode.id);
        }
        effectiveLatchedRef.current = newEffective;

        // React State updates
        onLimitInteraction(hitNode.maxPrime);
        setLastTouchedNode({ coords: hitNode.coords, octave: hitNode.octave });

        setActiveCursors(prev => {
            const next = new Map(prev);
            next.set(e.pointerId, {
                pointerId: e.pointerId,
                currentX: e.clientX,
                currentY: e.clientY,
                originNodeId: hitNode!.id
            });
            return next;
        });

        setManualLatchedNodes(prev => {
            const next = new Map(prev);
            if (settings.isLatchModeEnabled) {
                if (next.has(hitNode!.id)) next.delete(hitNode!.id);
                else next.set(hitNode!.id, hitNode!.id);
            } else {
                if (!next.has(hitNode!.id)) next.set(hitNode!.id, hitNode!.id);
            }
            return next;
        });

        if (settings.isPitchBendEnabled) {
            audioEngine.startVoice(`cursor-${e.pointerId}`, hitNode.ratio, settings.baseFrequency);
        }
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (uiUnlocked) return;
    
    // Check if we are tracking this pointer (it went down on a node)
    if (!activeCursorsRef.current.has(e.pointerId)) return;

    // PERFORMANCE FIX: Update Position Ref ONLY. Do NOT trigger React setState here.
    // This removes main-thread bottleneck causing audio glitches and visual lag.
    cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const cursor = activeCursorsRef.current.get(e.pointerId)!;

    // Handle Pitch Bend (Audio) directly from event data
    if (settings.isPitchBendEnabled && scrollContainerRef.current) {
         const centerOffset = settings.canvasSize / 2;
         const rect = scrollContainerRef.current.getBoundingClientRect();
         const canvasY = (e.clientY - rect.top) + scrollContainerRef.current.scrollTop;
         const relY = canvasY - centerOffset;
         const effectivePitchScale = PITCH_SCALE * settings.buttonSpacingScale;
         const bentRatio = Math.pow(2, -relY / effectivePitchScale);
         
         audioEngine.glideVoice(`cursor-${e.pointerId}`, bentRatio, settings.baseFrequency, 0.05);
    }

    // Handle Latching (Visual/State)
    if (settings.isLatchModeEnabled && canvasRef.current) {
         const canvasRect = canvasRef.current.getBoundingClientRect();
         const cx = e.clientX - canvasRect.left;
         const cy = e.clientY - canvasRect.top;
         
         const candidates = spatialHash.query(cx, cy);
         const spacing = settings.buttonSpacingScale;
         const centerOffset = settings.canvasSize / 2;
         const radius = (60 * settings.buttonSizeScale) / 2;
         const radiusSq = radius * radius;

         for (const node of candidates) {
             if (node.id === cursor.originNodeId) continue;
             const nx = node.x * spacing + centerOffset;
             const ny = node.y * spacing + centerOffset;
             const dx = cx - nx;
             const dy = cy - ny;
             
             if (dx*dx + dy*dy < radiusSq) {
                 setManualLatchedNodes(prev => {
                     if (prev.has(node.id)) return prev;
                     
                     // Compatibility Checks...
                     const originNode = data.nodes.find(n => n.id === cursor.originNodeId);
                     if (!originNode) return prev;

                     const allowedMaxIndex = settings.latchShellLimit - 2;
                     let isAllowed = true;
                     
                     if (settings.latchShellLimit === 1) {
                         if (getHarmonicDistance(node.coords, originNode.coords) > 0) isAllowed = false;
                     } else {
                         for(let i=0; i<node.coords.length; i++) {
                             const diff = Math.abs(node.coords[i] - originNode.coords[i]);
                             if (diff > 0 && i > allowedMaxIndex) { isAllowed = false; break; }
                         }
                     }

                     if (isAllowed) {
                         // We found a new node! Update state and refs.
                         const next = new Map(prev);
                         next.set(node.id, cursor.originNodeId);
                         
                         // Optimistic Update
                         const eff = new Map(effectiveLatchedRef.current);
                         eff.set(node.id, cursor.originNodeId);
                         effectiveLatchedRef.current = eff;
                         
                         setLastTouchedNode({ coords: node.coords, octave: node.octave });
                         return next;
                     }
                     return prev;
                 });
             }
         }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // Check if valid cursor
    if (activeCursorsRef.current.has(e.pointerId)) {
        audioEngine.stopVoice(`cursor-${e.pointerId}`);
        const cursor = activeCursorsRef.current.get(e.pointerId)!;
        
        // Cleanup Refs
        cursorPositionsRef.current.delete(e.pointerId);
        
        setActiveCursors(prev => {
            const next = new Map(prev);
            next.delete(e.pointerId);
            return next;
        });

        if (!settings.isLatchModeEnabled) {
             setManualLatchedNodes(prev => {
                 const next = new Map(prev);
                 next.delete(cursor.originNodeId);
                 return next;
             });
             // Optimistic cleanup
             const eff = new Map(effectiveLatchedRef.current);
             eff.delete(cursor.originNodeId);
             effectiveLatchedRef.current = eff;
        }
    }
  };

  // --- Animation Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const render = (time: number) => {
        // READ LATEST DATA FROM REFS
        const currentSettings = settingsRef.current;
        const currentData = dataRef.current;
        const currentCursors = activeCursorsRef.current;
        const currentLatched = effectiveLatchedRef.current;
        
        const size = currentSettings.canvasSize;
        
        if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            ctx.scale(dpr, dpr);
        }

        // Viewport Culling
        let viewX = 0, viewY = 0, viewW = size, viewH = size;
        if (scrollContainerRef.current) {
            viewX = scrollContainerRef.current.scrollLeft;
            viewY = scrollContainerRef.current.scrollTop;
            viewW = scrollContainerRef.current.clientWidth;
            viewH = scrollContainerRef.current.clientHeight;
        }
        const pad = 100;
        
        ctx.clearRect(viewX, viewY, viewW, viewH);

        const centerOffset = currentSettings.canvasSize / 2;
        const spacing = currentSettings.buttonSpacingScale;
        const baseRadius = (60 * currentSettings.buttonSizeScale) / 2;
        const isDiamond = currentSettings.buttonShape === ButtonShape.DIAMOND;
        const colorCache = currentSettings.colors;

        // Animation Phase for Voice Leading Lines
        const animationSpeed = (currentSettings.voiceLeadingAnimationSpeed || 2.0) * 0.33;
        const rawPhase = (time * 0.001 * animationSpeed);
        const flowPhase = currentSettings.voiceLeadingReverseDir ? (1.0 - (rawPhase % 1.0)) : (rawPhase % 1.0);
        
        ctx.lineCap = 'round';

        // Prepare active node list for voice leading checks
        const activeNodesList = currentSettings.isVoiceLeadingEnabled 
            ? currentData.nodes.filter(n => currentLatched.has(n.id)) 
            : [];
        const isVoiceLeading = currentSettings.isVoiceLeadingEnabled && activeNodesList.length > 0;
        const allowedMaxIndex = currentSettings.latchShellLimit - 2;

        // DRAW LINES
        for (const line of currentData.lines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;

            if (Math.max(x1, x2) < viewX - pad || Math.min(x1, x2) > viewX + viewW + pad ||
                Math.max(y1, y2) < viewY - pad || Math.min(y1, y2) > viewY + viewH + pad) {
                continue;
            }

            const active1 = currentLatched.has(line.sourceId);
            const active2 = currentLatched.has(line.targetId);
            const limitColor = colorCache[line.limit] || '#666';

            // Draw Base Line
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);

            if (active1 && active2) {
                // Active Line - Solid, Bright, Glowing
                ctx.lineWidth = 5;
                ctx.setLineDash([]); 
                
                if (currentSettings.isVoiceLeadingAnimationEnabled) {
                    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                    const p = flowPhase;
                    
                    const startStop = Math.max(0, p - 0.2);
                    const endStop = Math.min(1, p + 0.2);
                    const pulseColor = lightenColor(limitColor, 0.33);

                    grad.addColorStop(0, limitColor);
                    if (startStop > 0) grad.addColorStop(startStop, limitColor);
                    grad.addColorStop(p, pulseColor);
                    if (endStop < 1) grad.addColorStop(endStop, limitColor);
                    grad.addColorStop(1, limitColor);

                    ctx.strokeStyle = grad;
                    ctx.shadowColor = limitColor;
                    ctx.shadowBlur = 15 * currentSettings.voiceLeadingGlowAmount;
                    ctx.globalAlpha = 1.0;
                } else {
                    ctx.strokeStyle = limitColor;
                    ctx.globalAlpha = 1.0;
                    ctx.shadowBlur = 0;
                }
                
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';

            } else {
                ctx.lineWidth = line.limit === 1 ? 4 : 2;
                ctx.strokeStyle = limitColor;
                if (isVoiceLeading) ctx.globalAlpha = 0.05; 
                else ctx.globalAlpha = 0.15;
                ctx.setLineDash(line.limit === 1 ? [5, 5] : []);
                ctx.stroke();
            }
        }

        // DRAW NODES
        for (const node of currentData.nodes) {
            const x = node.x * spacing + centerOffset;
            const y = node.y * spacing + centerOffset;

            if (x < viewX - pad || x > viewX + viewW + pad || y < viewY - pad || y > viewY + viewH + pad) continue;

            const isLatched = currentLatched.has(node.id);
            let isHovered = false;
            // Optimised hover check: Check if cursor ID in state implies hover? 
            // Actually, we just check existence in state, which is enough to indicate "pressed"
            // But we specifically need to know if *this* node is the origin.
            for (const c of currentCursors.values()) {
                if (c.originNodeId === node.id) { isHovered = true; break; }
            }
            
            const isActive = isLatched || isHovered;
            let scale = 1.0;
            let opacity = 0.95;

            if (isVoiceLeading) {
                 if (isActive) {
                     scale = currentSettings.latchedZoomScale;
                     opacity = 1.0;
                 } else {
                     let isCompatible = false;
                     let minDist = Infinity;
                     
                     for (const an of activeNodesList) {
                         if (Math.abs(an.x - node.x) > 2000) continue; 

                         let valid = true;
                         if (currentSettings.latchShellLimit === 1) {
                             if (getHarmonicDistance(node.coords, an.coords) > 0) valid = false;
                         } else {
                             for(let i=0; i<node.coords.length; i++) {
                                 const diff = Math.abs(node.coords[i] - an.coords[i]);
                                 if (diff > 0 && i > allowedMaxIndex) { valid = false; break; }
                             }
                         }

                         if (valid) {
                             isCompatible = true;
                             const d = getHarmonicDistance(node.coords, an.coords);
                             if (d < minDist) minDist = d;
                         }
                     }
                     
                     if (!isCompatible) {
                         // Modified values: Brighter opacity (0.4 vs 0.1) and Larger scale (0.7 vs 0.5)
                         opacity = 0.4; 
                         scale = 0.7;
                     } else {
                         const visibility = Math.max(0.2, 1 - (minDist * currentSettings.voiceLeadingStrength));
                         scale = Math.max(0.5, 0.5 + (visibility * 0.5));
                         opacity = visibility;
                     }
                 }
            } else {
                scale = isActive ? currentSettings.latchedZoomScale : 1.0;
                opacity = isActive ? 1.0 : 0.95;
            }

            const radius = baseRadius * scale;
            const cTop = colorCache[node.limitTop] || '#666';
            const cBottom = colorCache[node.limitBottom] || '#666';
            
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            if (isDiamond) {
                ctx.moveTo(x, y - radius);
                ctx.lineTo(x + radius, y);
                ctx.lineTo(x, y + radius);
                ctx.lineTo(x - radius, y);
                ctx.closePath();
            } else {
                ctx.arc(x, y, radius, 0, Math.PI * 2);
            }

            const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
            grad.addColorStop(0.45, cTop);
            grad.addColorStop(0.55, cBottom);
            ctx.fillStyle = grad;
            ctx.fill();

            // "Selection Aura"
            if (isActive && currentSettings.isColoredIlluminationEnabled) {
                 const rainbowPeriod = PITCH_SCALE * spacing;
                 const phase = (y % rainbowPeriod) / rainbowPeriod;
                 const hue = (currentSettings.rainbowOffset + phase * 360) % 360;
                 const sat = currentSettings.isRainbowModeEnabled ? currentSettings.rainbowSaturation : 100;
                 
                 ctx.strokeStyle = `hsl(${hue}, ${sat}%, 60%)`;
                 ctx.lineWidth = 4;
                 ctx.stroke();
            } else if (isActive) {
                 ctx.strokeStyle = 'white';
                 ctx.lineWidth = 3;
                 ctx.stroke();
            }

            if (scale > 0.6) {
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = Math.max(9, Math.min(14, 11 * scale));
                ctx.font = `bold ${fontSize}px sans-serif`; 
                
                ctx.fillText(node.n.toString(), x, y - (radius * 0.3));
                ctx.beginPath();
                ctx.moveTo(x - (radius * 0.4), y);
                ctx.lineTo(x + (radius * 0.4), y);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.stroke();
                ctx.fillText(node.d.toString(), x, y + (radius * 0.4));
            }
        }
        
        // Draw User Cursors from Ref for high frame rate smoothness
        currentCursors.forEach(c => {
            const node = currentData.nodes.find(n => n.id === c.originNodeId);
            if(node) {
                 const nx = node.x * spacing + centerOffset;
                 const ny = node.y * spacing + centerOffset;
                 
                 // Get cursor position directly from Ref (most up to date, bypasses React)
                 const pos = cursorPositionsRef.current.get(c.pointerId);
                 if (!pos) return;

                 let cx = 0, cy = 0;
                 if (scrollContainerRef.current) {
                     const r = scrollContainerRef.current.getBoundingClientRect();
                     cx = (pos.x - r.left) + scrollContainerRef.current.scrollLeft;
                     cy = (pos.y - r.top) + scrollContainerRef.current.scrollTop;
                 }
                 
                 ctx.beginPath();
                 ctx.moveTo(nx, ny);
                 ctx.lineTo(cx, cy);
                 ctx.strokeStyle = 'white';
                 ctx.lineWidth = 2;
                 ctx.setLineDash([]);
                 ctx.globalAlpha = 0.5;
                 ctx.stroke();
            }
        });

        animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []); // Run once on mount

  // Rainbow Background Style
  const rainbowBackgroundFixed = (() => {
    if (settings.isRainbowModeEnabled) {
        const stops: string[] = [];
        const steps = 6;
        const rainbowPeriod = PITCH_SCALE * settings.buttonSpacingScale;
        for (let i = 0; i <= steps; i++) {
            const pct = i / steps;
            const px = pct * rainbowPeriod;
            const hue = (settings.rainbowOffset + i * 60); 
            stops.push(`hsl(${hue}, ${settings.rainbowSaturation}%, ${settings.rainbowBrightness}%) ${px.toFixed(1)}px`);
        }
        return `repeating-linear-gradient(to bottom, ${stops.join(', ')})`;
    }
    return undefined;
  })();

  return (
    <div 
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto bg-slate-950 relative"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
    >
        <div 
            className="relative"
            style={{ 
                width: settings.canvasSize, 
                height: settings.canvasSize,
                background: rainbowBackgroundFixed,
                pointerEvents: uiUnlocked ? 'none' : 'auto',
            }}
        >
           <canvas 
             ref={canvasRef}
             style={{ width: '100%', height: '100%' }}
           />
        </div>
    </div>
  );
});

export default TonalityDiamond;
