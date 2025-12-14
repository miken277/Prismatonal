
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine, GenerationOrigin, ButtonShape } from '../types';
import { generateLattice, getHarmonicDistance } from '../services/LatticeService';
import AudioEngine from '../services/AudioEngine';
import { midiService } from '../services/MidiService';

export interface TonalityDiamondHandle {
  clearLatches: () => void;
  centerView: () => void;
  increaseDepth: () => void;
  decreaseDepth: () => void;
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

// Spatial Grid Constants
const GRID_CELL_SIZE = 100; // Pixel size of spatial buckets

const PITCH_SCALE = 200;

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Dual Canvas Strategy
  const staticCanvasRef = useRef<HTMLCanvasElement>(null); // Background (Nodes/Lines)
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null); // Foreground (Interaction/Glows)
  
  const animationFrameRef = useRef<number>(0);
  
  // Data State
  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  
  // Optimization: Memoized Lookups & Spatial Grid
  const nodeMap = useMemo(() => {
      return new Map(data.nodes.map(n => [n.id, n]));
  }, [data.nodes]);

  // Spatial Index for O(1) Hit Testing
  const spatialGrid = useMemo(() => {
      const grid = new Map<string, LatticeNode[]>();
      const centerOffset = settings.canvasSize / 2;
      const spacing = settings.buttonSpacingScale;

      data.nodes.forEach(node => {
          const x = node.x * spacing + centerOffset;
          const y = node.y * spacing + centerOffset;
          
          // Determine grid cell
          const col = Math.floor(x / GRID_CELL_SIZE);
          const row = Math.floor(y / GRID_CELL_SIZE);
          const key = `${col},${row}`;
          
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key)!.push(node);
          
          // Add to neighbors to handle edge overlaps (simple approach: add to 3x3 block if near edge, 
          // but for simplicity we'll just check neighbors in hit test)
      });
      return grid;
  }, [data.nodes, settings.buttonSpacingScale, settings.canvasSize]);

  // Interaction State
  const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
  const [manualLatchedNodes, setManualLatchedNodes] = useState<Map<string, string>>(new Map());
  const [effectiveLatchedNodes, setEffectiveLatchedNodes] = useState<Map<string, string>>(new Map());

  // Optimization: Pre-calculate active lines to avoid O(L) scan in render loop
  const activeLines = useMemo(() => {
    const latched = effectiveLatchedNodes;
    const lines = data.lines;
    const active: LatticeLine[] = [];
    if (latched.size > 0) {
        for (const line of lines) {
            if (latched.has(line.sourceId) && latched.has(line.targetId)) {
                active.push(line);
            }
        }
    }
    return active;
  }, [data.lines, effectiveLatchedNodes]);
  
  // Refs for Render Loop (to avoid stale closures)
  const settingsRef = useRef(settings);
  const dataRef = useRef(data);
  const activeCursorsRef = useRef(activeCursors);
  const effectiveLatchedRef = useRef(effectiveLatchedNodes);
  const nodeMapRef = useRef(nodeMap);
  const activeLinesRef = useRef(activeLines);
  const spatialGridRef = useRef(spatialGrid);
  
  const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());

  // Sync Refs
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { activeCursorsRef.current = activeCursors; }, [activeCursors]);
  useEffect(() => { effectiveLatchedRef.current = effectiveLatchedNodes; }, [effectiveLatchedNodes]);
  useEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
  useEffect(() => { activeLinesRef.current = activeLines; }, [activeLines]);
  useEffect(() => { spatialGridRef.current = spatialGrid; }, [spatialGrid]);
  
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
    decreaseDepth: () => {
        setDepthOrigins(prev => {
            if (prev.length <= 1) return prev; // Keep initial origin
            const next = [...prev];
            next.pop();
            return next;
        });
    },
    getLatchedNodes: () => {
        // Use map for O(1) lookup
        const result: LatticeNode[] = [];
        effectiveLatchedNodes.forEach((_, id) => {
            const n = nodeMap.get(id);
            if (n) result.push(n);
        });
        return result;
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
  const generationDeps = useMemo(() => {
      return JSON.stringify({
          depths: settings.limitDepths,
          complexities: settings.limitComplexities,
          hidden: settings.hiddenLimits,
          ratio: settings.latticeAspectRatio,
          origins: depthOrigins
      });
  }, [settings.limitDepths, settings.limitComplexities, settings.hiddenLimits, settings.latticeAspectRatio, depthOrigins]);

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
    
    setData({ nodes: result.nodes, lines: visibleLines });
  }, [generationDeps, settings.buttonSpacingScale, settings.canvasSize]);

  // --- STATIC CANVAS RENDERER ---
  const visualDeps = useMemo(() => JSON.stringify({
      size: settings.buttonSizeScale,
      spacing: settings.buttonSpacingScale,
      colors: settings.colors,
      visuals: settings.limitVisuals,
      shape: settings.buttonShape,
      textScale: settings.nodeTextSizeScale,
      fractionBar: settings.showFractionBar,
      canvasSize: settings.canvasSize
  }), [
      settings.buttonSizeScale,
      settings.buttonSpacingScale,
      settings.colors,
      settings.limitVisuals,
      settings.buttonShape,
      settings.nodeTextSizeScale,
      settings.showFractionBar,
      settings.canvasSize
  ]);

  useEffect(() => {
      const canvas = staticCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const size = settings.canvasSize;
      
      // Resize
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
          canvas.width = size * dpr;
          canvas.height = size * dpr;
      }
      
      // Clear and Reset
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const centerOffset = size / 2;
      const spacing = settings.buttonSpacingScale;
      const baseRadius = (60 * settings.buttonSizeScale) / 2;
      const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
      
      // 1. Draw Lines
      const linesByLimit: Record<number, number[]> = {};
      for (const line of data.lines) {
          if (!linesByLimit[line.limit]) linesByLimit[line.limit] = [];
          const arr = linesByLimit[line.limit];
          arr.push(
              line.x1 * spacing + centerOffset, 
              line.y1 * spacing + centerOffset, 
              line.x2 * spacing + centerOffset, 
              line.y2 * spacing + centerOffset
          );
      }

      ctx.lineCap = 'round';
      for (const limitStr in linesByLimit) {
          const limit = parseInt(limitStr);
          const coords = linesByLimit[limit];
          const color = settings.colors[limit] || '#666';
          const visualSettings = settings.limitVisuals?.[limit] || { size: 1, opacity: 1 };
          
          ctx.beginPath();
          for(let i=0; i<coords.length; i+=4) {
              ctx.moveTo(coords[i], coords[i+1]);
              ctx.lineTo(coords[i+2], coords[i+3]);
          }
          ctx.lineWidth = (limit === 1 ? 4 : 2) * visualSettings.size;
          ctx.strokeStyle = color;
          // Lines are always a bit faint to let nodes pop
          ctx.globalAlpha = 0.3 * visualSettings.opacity; 
          
          if (limit === 1) ctx.setLineDash([5, 5]);
          else ctx.setLineDash([]);
          ctx.stroke();
      }
      ctx.setLineDash([]); 

      // 2. Draw Nodes (Idle State)
      for (const node of data.nodes) {
          const x = node.x * spacing + centerOffset;
          const y = node.y * spacing + centerOffset;
          const cTop = settings.colors[node.limitTop] || '#666';
          const cBottom = settings.colors[node.limitBottom] || '#666';
          const topVis = settings.limitVisuals?.[node.limitTop] || { size: 1, opacity: 1 };
          const limitScale = topVis.size;
          const limitOpacity = topVis.opacity;
          const radius = baseRadius * limitScale;

          // Full visibility for static nodes to prevent "dimming" look
          ctx.globalAlpha = 1.0 * limitOpacity;
          
          ctx.beginPath();
          if (isDiamond) {
              ctx.moveTo(x, y - radius);
              ctx.lineTo(x + radius, y);
              ctx.lineTo(x, y + radius);
              ctx.lineTo(x - radius, y);
          } else {
              ctx.arc(x, y, radius, 0, Math.PI * 2);
          }
          ctx.closePath();

          const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
          grad.addColorStop(0.45, cTop);
          grad.addColorStop(0.55, cBottom);
          ctx.fillStyle = grad;
          ctx.fill();

          const combinedScale = settings.buttonSizeScale * limitScale;
          if (combinedScale > 0.4) {
              ctx.fillStyle = 'white';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              let fontSize = Math.max(10, Math.min(18, 14 * combinedScale)) * settings.nodeTextSizeScale;
              ctx.font = `bold ${fontSize}px sans-serif`; 
              
              const spacingY = settings.showFractionBar ? 0.55 : 0.50;
              const nStr = node.n.toString();
              const dStr = node.d.toString();

              ctx.fillText(nStr, x, y - (radius * spacingY));
              
              if (settings.showFractionBar) {
                  ctx.beginPath();
                  ctx.moveTo(x - (radius * 0.4), y);
                  ctx.lineTo(x + (radius * 0.4), y);
                  ctx.lineWidth = 1;
                  ctx.strokeStyle = `rgba(255,255,255,${0.8 * limitOpacity})`;
                  ctx.stroke();
              }
              ctx.fillText(dStr, x, y + (radius * spacingY));
          }
      }

  }, [data, visualDeps]); 


  // --- Logic: Latches & Audio Sync ---
  useEffect(() => {
    const newEffective = new Map<string, string>(manualLatchedNodes);
    const nodes = nodeMap;

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
                        const fullNode = nodes.get(n.id);
                        if (fullNode) {
                            audioEngine.startVoice(`node-${n.id}`, fullNode.ratio, settings.baseFrequency);
                            if (settings.midiEnabled) midiService.noteOn(`node-${n.id}`, fullNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);
                        }
                     });
                 }
             });
         }
    }
    
    setEffectiveLatchedNodes(newEffective);
    prevActiveChordIds.current = activeChordIds;
  }, [manualLatchedNodes, activeChordIds, settings.savedChords, settings.chordsAlwaysRelatch, nodeMap]);

  // Audio Diffing
  const prevEffectiveRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
      const current = effectiveLatchedNodes;
      const prev = prevEffectiveRef.current;
      const nodes = nodeMap;
      
      current.forEach((originId, nodeId) => {
          if (!prev.has(nodeId)) {
               const node = nodes.get(nodeId); // O(1) Lookup
               if (node) {
                   audioEngine.startVoice(`node-${nodeId}`, node.ratio, settings.baseFrequency);
                   if (settings.midiEnabled) midiService.noteOn(`node-${nodeId}`, node.ratio, settings.baseFrequency, settings.midiPitchBendRange);
               }
          }
      });
      prev.forEach((_, nodeId) => {
          if (!current.has(nodeId)) {
              audioEngine.stopVoice(`node-${nodeId}`);
              if (settings.midiEnabled) midiService.noteOff(`node-${nodeId}`);
          }
      });

      prevEffectiveRef.current = current;
  }, [effectiveLatchedNodes, nodeMap, settings.baseFrequency]);

  // Reactive Delatching
  useEffect(() => {
    setManualLatchedNodes((prev: Map<string, string>) => {
        const next = new Map<string, string>(prev);
        let changed = false;
        
        // Use memoized map for Lookups
        const nodes = nodeMap;

        next.forEach((originId, nodeId) => {
            const node = nodes.get(nodeId);
            if (!node) { next.delete(nodeId); changed = true; return; }
            
            if (originId !== nodeId) {
                 const originNode = nodes.get(originId);
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
  }, [settings.latchShellLimit, nodeMap]); 

  useEffect(() => {
    audioEngine.setPolyphony(settings.polyphony);
  }, [settings.polyphony]);

  // Helper for Hit Testing using Spatial Grid
  const getHitNode = (clientX: number, clientY: number): LatticeNode | null => {
      if (!dynamicCanvasRef.current) return null;
      const rect = dynamicCanvasRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const centerOffset = settings.canvasSize / 2;
      const spacing = settings.buttonSpacingScale;
      const baseRadius = (60 * settings.buttonSizeScale) / 2;

      const col = Math.floor(x / GRID_CELL_SIZE);
      const row = Math.floor(y / GRID_CELL_SIZE);
      
      // Check current cell and immediate neighbors (to handle nodes on edges)
      const cellsToCheck = [
          `${col},${row}`, `${col+1},${row}`, `${col-1},${row}`,
          `${col},${row+1}`, `${col},${row-1}`,
          `${col+1},${row+1}`, `${col-1},${row-1}`,
          `${col+1},${row-1}`, `${col-1},${row+1}`
      ];
      
      const grid = spatialGridRef.current;
      
      for(const key of cellsToCheck) {
          const nodesInCell = grid.get(key);
          if (nodesInCell) {
              for (const node of nodesInCell) {
                  const nx = node.x * spacing + centerOffset;
                  const ny = node.y * spacing + centerOffset;
                  const vis = settings.limitVisuals?.[node.limitTop] || { size: 1 };
                  const r = baseRadius * vis.size;
                  
                  if (x < nx - r || x > nx + r || y < ny - r || y > ny + r) continue;
                  
                  const dx = x - nx;
                  const dy = y - ny;
                  if (dx*dx + dy*dy < r*r) {
                      return node;
                  }
              }
          }
      }
      return null;
  };

  // --- Interaction Handlers ---
  const handlePointerDown = (e: React.PointerEvent) => {
      if (uiUnlocked || !dynamicCanvasRef.current) return;
      e.preventDefault();

      cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // O(1) Hit Test
      const hitNode = getHitNode(e.clientX, e.clientY);

      if (hitNode) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        
        const newEffective = new Map(effectiveLatchedRef.current);
        if (settings.isLatchModeEnabled) {
             if (newEffective.has(hitNode.id)) newEffective.delete(hitNode.id);
             else newEffective.set(hitNode.id, hitNode.id);
        } else {
             if (!newEffective.has(hitNode.id)) newEffective.set(hitNode.id, hitNode.id);
        }
        effectiveLatchedRef.current = newEffective;

        const topLayer = settings.layerOrder[settings.layerOrder.length - 1];
        if (hitNode.maxPrime !== topLayer) {
             onLimitInteraction(hitNode.maxPrime);
        }
        
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
            if (settings.midiEnabled) midiService.noteOn(`cursor-${e.pointerId}`, hitNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);
        }
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (uiUnlocked) return;
    if (!activeCursorsRef.current.has(e.pointerId)) return;

    cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const cursor = activeCursorsRef.current.get(e.pointerId)!;

    if (settings.isPitchBendEnabled && scrollContainerRef.current) {
         const centerOffset = settings.canvasSize / 2;
         const rect = scrollContainerRef.current.getBoundingClientRect();
         const canvasY = (e.clientY - rect.top) + scrollContainerRef.current.scrollTop;
         const relY = canvasY - centerOffset;
         const effectivePitchScale = PITCH_SCALE * settings.buttonSpacingScale;
         const bentRatio = Math.pow(2, -relY / effectivePitchScale);
         
         audioEngine.glideVoice(`cursor-${e.pointerId}`, bentRatio, settings.baseFrequency, 0.05);
         if (settings.midiEnabled) midiService.pitchBend(`cursor-${e.pointerId}`, bentRatio, settings.baseFrequency, settings.midiPitchBendRange);
    }

    if (settings.isLatchModeEnabled && dynamicCanvasRef.current) {
         // Optimized Hit Test for Drag Latching
         // We only care about nodes under the finger, not checking 2000 nodes for distance
         const hitNode = getHitNode(e.clientX, e.clientY);
         
         if (hitNode && hitNode.id !== cursor.originNodeId) {
             setManualLatchedNodes(prev => {
                 if (prev.has(hitNode.id)) return prev;
                 
                 const originNode = nodeMapRef.current.get(cursor.originNodeId);
                 if (!originNode) return prev;

                 const allowedMaxIndex = settings.latchShellLimit - 2;
                 let isAllowed = true;
                 
                 if (settings.latchShellLimit === 1) {
                     if (getHarmonicDistance(hitNode.coords, originNode.coords) > 0) isAllowed = false;
                 } else {
                     for(let i=0; i<hitNode.coords.length; i++) {
                         const diff = Math.abs(hitNode.coords[i] - originNode.coords[i]);
                         if (diff > 0 && i > allowedMaxIndex) { isAllowed = false; break; }
                     }
                 }

                 if (isAllowed) {
                     const next = new Map(prev);
                     next.set(hitNode.id, cursor.originNodeId);
                     
                     const eff = new Map(effectiveLatchedRef.current);
                     eff.set(hitNode.id, cursor.originNodeId);
                     effectiveLatchedRef.current = eff;
                     
                     setLastTouchedNode({ coords: hitNode.coords, octave: hitNode.octave });
                     return next;
                 }
                 return prev;
             });
         }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeCursorsRef.current.has(e.pointerId)) {
        audioEngine.stopVoice(`cursor-${e.pointerId}`);
        if (settings.midiEnabled) midiService.noteOff(`cursor-${e.pointerId}`);
        
        const cursor = activeCursorsRef.current.get(e.pointerId)!;
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
             const eff = new Map(effectiveLatchedRef.current);
             eff.delete(cursor.originNodeId);
             effectiveLatchedRef.current = eff;
        }
    }
  };

  // --- Animation Loop ---
  useEffect(() => {
    const canvas = dynamicCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const render = (time: number) => {
        const currentSettings = settingsRef.current;
        const currentCursors = activeCursorsRef.current;
        const currentLatched = effectiveLatchedRef.current;
        const currentActiveLines = activeLinesRef.current;
        
        const size = currentSettings.canvasSize;
        
        if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            ctx.scale(dpr, dpr);
        }

        let viewX = 0, viewY = 0, viewW = size, viewH = size;
        if (scrollContainerRef.current) {
            viewX = scrollContainerRef.current.scrollLeft;
            viewY = scrollContainerRef.current.scrollTop;
            viewW = scrollContainerRef.current.clientWidth;
            viewH = scrollContainerRef.current.clientHeight;
        }
        
        // Only clear dynamic layer
        ctx.clearRect(viewX, viewY, viewW, viewH);

        const centerOffset = currentSettings.canvasSize / 2;
        const spacing = currentSettings.buttonSpacingScale;
        const baseRadius = (60 * currentSettings.buttonSizeScale) / 2;
        const isDiamond = currentSettings.buttonShape === ButtonShape.DIAMOND;
        const colorCache = currentSettings.colors;

        const animationSpeed = (currentSettings.voiceLeadingAnimationSpeed || 2.0) * 0.33;
        const rawPhase = (time * 0.001 * animationSpeed);
        const flowPhase = currentSettings.voiceLeadingReverseDir ? (1.0 - (rawPhase % 1.0)) : (rawPhase % 1.0);
        
        ctx.lineCap = 'round';

        const viewPad = 100;
        const leftBound = viewX - viewPad;
        const rightBound = viewX + viewW + viewPad;
        const topBound = viewY - viewPad;
        const bottomBound = viewY + viewH + viewPad;
        
        // --- DRAW ACTIVE LINES ---
        // Optimization: Removed shadowBlur and Composite changes.
        // Used multi-pass stroking for glow effect instead.
        
        ctx.setLineDash([]); 
        for (const line of currentActiveLines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;
            
            if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;

            const limitColor = colorCache[line.limit] || '#666';

            // Base Line (Solid)
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = 4;
            ctx.strokeStyle = limitColor;
            ctx.globalAlpha = 1.0;
            ctx.stroke();

            // Animated Pulse Overlay (Manual Glow)
            if (currentSettings.isVoiceLeadingAnimationEnabled) {
                const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                const p = flowPhase;
                
                // Simple white pulse gradient
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                const pulseWidth = 0.2;
                const start = Math.max(0, p - pulseWidth);
                const end = Math.min(1, p + pulseWidth);
                if (start > 0) grad.addColorStop(start, 'rgba(255,255,255,0)');
                grad.addColorStop(p, 'rgba(255,255,255,0.7)'); // 70% opacity white
                if (end < 1) grad.addColorStop(end, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');

                ctx.strokeStyle = grad;
                
                // Draw wide faint stroke (simulates blur)
                ctx.lineWidth = 10 * (0.5 + currentSettings.voiceLeadingGlowAmount);
                ctx.globalAlpha = 0.3; // Low opacity for "glow" look
                ctx.stroke();
                
                // Draw core hot stroke
                ctx.lineWidth = 4;
                ctx.globalAlpha = 1.0;
                ctx.stroke();
            }
        }

        // --- DRAW ACTIVE NODES ---
        const activeNodeIds = new Set<string>();
        currentLatched.forEach((_, id) => activeNodeIds.add(id));
        currentCursors.forEach(c => activeNodeIds.add(c.originNodeId));

        for (const id of activeNodeIds) {
             const node = nodeMapRef.current.get(id);
             if (!node) continue;

             const x = node.x * spacing + centerOffset;
             const y = node.y * spacing + centerOffset;
             
             if (x < leftBound || x > rightBound || y < topBound || y > bottomBound) continue;

             const cTop = colorCache[node.limitTop] || '#666';
             const cBottom = colorCache[node.limitBottom] || '#666';
             
             const vis = currentSettings.limitVisuals?.[node.limitTop] || { size: 1 };
             const limitScale = vis.size;
             const zoomScale = currentSettings.latchedZoomScale;
             const radius = baseRadius * limitScale * zoomScale;

             ctx.globalAlpha = 1.0; 
             ctx.beginPath();
             if (isDiamond) {
                ctx.moveTo(x, y - radius);
                ctx.lineTo(x + radius, y);
                ctx.lineTo(x, y + radius);
                ctx.lineTo(x - radius, y);
             } else {
                ctx.arc(x, y, radius, 0, Math.PI * 2);
             }
             ctx.closePath();

             const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
             grad.addColorStop(0.45, cTop);
             grad.addColorStop(0.55, cBottom);
             ctx.fillStyle = grad;
             ctx.fill();

             if (currentSettings.isColoredIlluminationEnabled) {
                 const rainbowPeriod = PITCH_SCALE * spacing;
                 const phase = (y % rainbowPeriod) / rainbowPeriod;
                 const hue = (currentSettings.rainbowOffset + phase * 360) % 360;
                 const sat = currentSettings.isRainbowModeEnabled ? currentSettings.rainbowSaturation : 100;
                 ctx.strokeStyle = `hsl(${hue}, ${sat}%, 60%)`;
                 ctx.lineWidth = 4;
                 ctx.stroke();
             } else {
                 ctx.strokeStyle = 'white';
                 ctx.lineWidth = 3;
                 ctx.stroke();
             }

             const combinedScale = currentSettings.buttonSizeScale * limitScale * zoomScale;
             if (combinedScale > 0.4) {
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                let fontSize = Math.max(12, Math.min(22, 16 * combinedScale)) * currentSettings.nodeTextSizeScale;
                ctx.font = `bold ${fontSize}px sans-serif`; 
                const spacingY = currentSettings.showFractionBar ? 0.55 : 0.50;
                ctx.fillText(node.n.toString(), x, y - (radius * spacingY));
                if (currentSettings.showFractionBar) {
                    ctx.beginPath();
                    ctx.moveTo(x - (radius * 0.4), y);
                    ctx.lineTo(x + (radius * 0.4), y);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'white';
                    ctx.stroke();
                }
                ctx.fillText(node.d.toString(), x, y + (radius * spacingY));
             }
        }
        
        // Cursors (Draw Lines connecting cursor to node)
        currentCursors.forEach(c => {
            const node = nodeMapRef.current.get(c.originNodeId);
            if(node) {
                 const nx = node.x * spacing + centerOffset;
                 const ny = node.y * spacing + centerOffset;
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
                 ctx.globalAlpha = 0.5;
                 ctx.stroke();
            }
        });

        animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []); 

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
           {/* Layer 1: Static Background */}
           <canvas 
             ref={staticCanvasRef}
             className="absolute top-0 left-0 z-0 pointer-events-none"
             style={{ width: '100%', height: '100%' }}
           />
           {/* Layer 2: Dynamic Interaction */}
           <canvas 
             ref={dynamicCanvasRef}
             className="absolute top-0 left-0 z-10"
             style={{ width: '100%', height: '100%' }}
           />
        </div>
    </div>
  );
});

export default TonalityDiamond;
