
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine, ButtonShape } from '../types';
import { getHarmonicDistance, generateLattice } from '../services/LatticeService';
import { getPitchRatioFromScreenDelta, getRainbowPeriod } from '../services/ProjectionService';
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
  updateSettings: (s: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void;
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

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, updateSettings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Dual Canvas Strategy
  const staticCanvasRef = useRef<HTMLCanvasElement>(null); // Background (Nodes/Lines)
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null); // Foreground (Interaction/Glows)
  
  const animationFrameRef = useRef<number>(0);
  
  // Data State
  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Auto-calculated Dimensions
  // We initialize with window size to prevent flash, but it will update immediately
  const [dynamicSize, setDynamicSize] = useState(2000);
  const prevDynamicSizeRef = useRef(2000);

  // Optimization: Memoized Lookups & Spatial Grid
  const nodeMap = useMemo(() => {
      return new Map(data.nodes.map(n => [n.id, n]));
  }, [data.nodes]);

  // Spatial Index for O(1) Hit Testing
  const spatialGrid = useMemo(() => {
      const grid = new Map<string, LatticeNode[]>();
      // CRITICAL: Use the Dynamic Size for centering, not the settings.canvasSize
      const centerOffset = dynamicSize / 2;
      const spacing = settings.buttonSpacingScale;

      data.nodes.forEach(node => {
          const x = node.x * spacing + centerOffset;
          const y = node.y * spacing + centerOffset;
          
          const col = Math.floor(x / GRID_CELL_SIZE);
          const row = Math.floor(y / GRID_CELL_SIZE);
          const key = `${col},${row}`;
          
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key)!.push(node);
      });
      return grid;
  }, [data.nodes, settings.buttonSpacingScale, dynamicSize]);

  // Interaction State
  const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
  const [manualLatchedNodes, setManualLatchedNodes] = useState<Map<string, string>>(new Map());
  const [effectiveLatchedNodes, setEffectiveLatchedNodes] = useState<Map<string, string>>(new Map());

  // Optimization: Pre-calculate active lines
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
  
  // Refs for Render Loop
  const settingsRef = useRef(settings);
  const dataRef = useRef(data);
  const activeCursorsRef = useRef(activeCursors);
  const effectiveLatchedRef = useRef(effectiveLatchedNodes);
  const nodeMapRef = useRef(nodeMap);
  const activeLinesRef = useRef(activeLines);
  const spatialGridRef = useRef(spatialGrid);
  const dynamicSizeRef = useRef(dynamicSize);
  
  const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());

  // Sync Refs
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { activeCursorsRef.current = activeCursors; }, [activeCursors]);
  useEffect(() => { effectiveLatchedRef.current = effectiveLatchedNodes; }, [effectiveLatchedNodes]);
  useEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
  useEffect(() => { activeLinesRef.current = activeLines; }, [activeLines]);
  useEffect(() => { spatialGridRef.current = spatialGrid; }, [spatialGrid]);
  useEffect(() => { dynamicSizeRef.current = dynamicSize; }, [dynamicSize]);
  
  // Depth Interaction State
  const lastTouchedLimitRef = useRef<number | null>(null);
  const depthHistoryRef = useRef<number[]>([]);
  const [hasCentered, setHasCentered] = useState(false);
  const prevActiveChordIds = useRef<string[]>([]);

  // --- External API ---
  useImperativeHandle(ref, () => ({
    clearLatches: () => setManualLatchedNodes(new Map()),
    centerView: () => {
        centerScroll();
    },
    increaseDepth: () => {
        const limit = lastTouchedLimitRef.current;
        if (limit && limit > 1) {
             updateSettings((prev: AppSettings) => {
                 const currentDepth = prev.limitDepths[limit as 3|5|7|11|13];
                 return {
                     ...prev,
                     limitDepths: {
                         ...prev.limitDepths,
                         [limit]: currentDepth + 1
                     }
                 };
             });
             depthHistoryRef.current.push(limit);
        }
    },
    decreaseDepth: () => {
        const limit = depthHistoryRef.current.pop();
        if (limit) {
            updateSettings((prev: AppSettings) => {
                 const currentDepth = prev.limitDepths[limit as 3|5|7|11|13];
                 return {
                     ...prev,
                     limitDepths: {
                         ...prev.limitDepths,
                         [limit]: Math.max(0, currentDepth - 1)
                     }
                 };
             });
        }
    },
    getLatchedNodes: () => {
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
        const center = dynamicSize / 2;
        const viewportW = scrollContainerRef.current.clientWidth;
        const viewportH = scrollContainerRef.current.clientHeight;
        scrollContainerRef.current.scrollLeft = center - viewportW / 2;
        scrollContainerRef.current.scrollTop = center - viewportH / 2;
      }
  };

  // Recenter when dynamic size changes significantly
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (!hasCentered && dynamicSize > 0) {
        centerScroll();
        setHasCentered(true);
    } else if (dynamicSize !== prevDynamicSizeRef.current) {
        // When size changes (e.g. depth increase), the content origin (center) shifts.
        // We must adjust scroll to keep the viewport stationary relative to the content.
        const diff = (dynamicSize - prevDynamicSizeRef.current) / 2;
        container.scrollLeft += diff;
        container.scrollTop += diff;
    }
    prevDynamicSizeRef.current = dynamicSize;
  }, [dynamicSize]);

  // --- Data Generation (Main Thread Revert) ---
  // Memoize dependency string to avoid deep object comparison in useEffect
  const generationDeps = useMemo(() => {
      return JSON.stringify({
          depths: settings.limitDepths,
          complexities: settings.limitComplexities,
          hidden: settings.hiddenLimits,
          ratio: settings.latticeAspectRatio
      });
  }, [settings.limitDepths, settings.limitComplexities, settings.hiddenLimits, settings.latticeAspectRatio]);

  useEffect(() => {
    setIsGenerating(true);

    // Use setTimeout to yield to the renderer so the "Calculating..." spinner appears
    const timerId = setTimeout(() => {
        const effectiveSettings: AppSettings = JSON.parse(JSON.stringify(settings));
        const hiddenLimits = effectiveSettings.hiddenLimits || [];

        // Zero out depths for hidden limits to prevent unnecessary generation
        hiddenLimits.forEach((limit: number) => {
            // @ts-ignore
            if (effectiveSettings.limitDepths[limit] !== undefined) {
                // @ts-ignore
                effectiveSettings.limitDepths[limit] = 0;
            }
        });

        // Generate
        const result = generateLattice(effectiveSettings);

        // Filter lines
        const visibleNodeIds = new Set(result.nodes.map(n => n.id));
        const visibleLines = result.lines.filter(l => {
            if (hiddenLimits.includes(l.limit)) return false;
            if (!visibleNodeIds.has(l.sourceId) || !visibleNodeIds.has(l.targetId)) return false;
            return true;
        });

        // Calc Dynamic Size
        let maxExtent = 0;
        for (const n of result.nodes) {
            const absX = Math.abs(n.x);
            const absY = Math.abs(n.y);
            if (absX > maxExtent) maxExtent = absX;
            if (absY > maxExtent) maxExtent = absY;
        }

        const padding = 600; 
        const spacing = settingsRef.current.buttonSpacingScale; // Use ref to get latest
        const calculatedSize = (maxExtent * spacing * 2) + padding;
        const finalSize = Math.max(calculatedSize, window.innerWidth, window.innerHeight);

        if (Math.abs(finalSize - dynamicSizeRef.current) > 50) {
            setDynamicSize(finalSize);
        }

        setData({ nodes: result.nodes, lines: visibleLines });
        setIsGenerating(false);
    }, 10);

    return () => clearTimeout(timerId);
    
  }, [generationDeps]); 
  
  // Separate effect for Spacing Scale changes (visual only, no regen needed)
  useEffect(() => {
      let maxExtent = 0;
      for (const n of data.nodes) {
          const absX = Math.abs(n.x);
          const absY = Math.abs(n.y);
          if (absX > maxExtent) maxExtent = absX;
          if (absY > maxExtent) maxExtent = absY;
      }
      
      const padding = 600; 
      const spacing = settings.buttonSpacingScale;
      const calculatedSize = (maxExtent * spacing * 2) + padding;
      const finalSize = Math.max(calculatedSize, window.innerWidth, window.innerHeight);
      
      if (Math.abs(finalSize - dynamicSize) > 50) {
          setDynamicSize(finalSize);
      }
  }, [settings.buttonSpacingScale]);


  // --- STATIC CANVAS RENDERER ---
  const visualDeps = useMemo(() => JSON.stringify({
      size: settings.buttonSizeScale,
      spacing: settings.buttonSpacingScale,
      colors: settings.colors,
      visuals: settings.limitVisuals,
      shape: settings.buttonShape,
      textScale: settings.nodeTextSizeScale,
      fractionBar: settings.showFractionBar,
      canvasSize: dynamicSize 
  }), [
      settings.buttonSizeScale,
      settings.buttonSpacingScale,
      settings.colors,
      settings.limitVisuals,
      settings.buttonShape,
      settings.nodeTextSizeScale,
      settings.showFractionBar,
      dynamicSize
  ]);

  useEffect(() => {
      const canvas = staticCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const size = dynamicSize;
      
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
          ctx.globalAlpha = 0.3 * visualSettings.opacity; 
          
          if (limit === 1) ctx.setLineDash([5, 5]);
          else ctx.setLineDash([]);
          ctx.stroke();
      }
      ctx.setLineDash([]); 

      // 2. Draw Nodes
      for (const node of data.nodes) {
          const x = node.x * spacing + centerOffset;
          const y = node.y * spacing + centerOffset;
          const cTop = settings.colors[node.limitTop] || '#666';
          const cBottom = settings.colors[node.limitBottom] || '#666';
          const topVis = settings.limitVisuals?.[node.limitTop] || { size: 1, opacity: 1 };
          const limitScale = topVis.size;
          const limitOpacity = topVis.opacity;
          const radius = baseRadius * limitScale;

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
               const node = nodes.get(nodeId); 
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

  // Helper for Hit Testing
  const getHitNode = (clientX: number, clientY: number): LatticeNode | null => {
      if (!dynamicCanvasRef.current) return null;
      const rect = dynamicCanvasRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const centerOffset = dynamicSizeRef.current / 2;
      const spacing = settings.buttonSpacingScale;
      const baseRadius = (60 * settings.buttonSizeScale) / 2;

      const col = Math.floor(x / GRID_CELL_SIZE);
      const row = Math.floor(y / GRID_CELL_SIZE);
      
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
        
        // Track for Increase Depth Logic
        lastTouchedLimitRef.current = hitNode.maxPrime;

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
         const centerOffset = dynamicSizeRef.current / 2;
         const rect = scrollContainerRef.current.getBoundingClientRect();
         const canvasY = (e.clientY - rect.top) + scrollContainerRef.current.scrollTop;
         const relY = canvasY - centerOffset;
         
         // Use unified Pitch Ratio calculation
         const bentRatio = getPitchRatioFromScreenDelta(relY, settings.buttonSpacingScale);
         
         audioEngine.glideVoice(`cursor-${e.pointerId}`, bentRatio, settings.baseFrequency, 0.05);
         if (settings.midiEnabled) midiService.pitchBend(`cursor-${e.pointerId}`, bentRatio, settings.baseFrequency, settings.midiPitchBendRange);
    }

    if (settings.isLatchModeEnabled && dynamicCanvasRef.current) {
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
                     
                     // Update track logic for dragging too? Maybe. 
                     // Usually focus logic tracks 'down', but if dragging expands reach, maybe update last touched.
                     lastTouchedLimitRef.current = hitNode.maxPrime;
                     
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
        const size = dynamicSizeRef.current;
        
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
        
        ctx.clearRect(viewX, viewY, viewW, viewH);

        const centerOffset = size / 2;
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
        ctx.setLineDash([]); 
        for (const line of currentActiveLines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;
            
            if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;

            const limitColor = colorCache[line.limit] || '#666';

            // Base Line
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = 4;
            ctx.strokeStyle = limitColor;
            ctx.globalAlpha = 1.0;
            ctx.stroke();

            // Animated Pulse
            if (currentSettings.isVoiceLeadingAnimationEnabled) {
                const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                const p = flowPhase;
                
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                const pulseWidth = 0.2;
                const start = Math.max(0, p - pulseWidth);
                const end = Math.min(1, p + pulseWidth);
                if (start > 0) grad.addColorStop(start, 'rgba(255,255,255,0)');
                grad.addColorStop(p, 'rgba(255,255,255,0.7)'); 
                if (end < 1) grad.addColorStop(end, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');

                ctx.strokeStyle = grad;
                
                ctx.lineWidth = 10 * (0.5 + currentSettings.voiceLeadingGlowAmount);
                ctx.globalAlpha = 0.3; 
                ctx.stroke();
                
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
                 const rainbowPeriod = getRainbowPeriod(spacing); // Use Helper
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

  const rainbowPeriod = getRainbowPeriod(settings.buttonSpacingScale);

  // New Gradient Logic using linear-gradient + percentages
  const rainbowBackgroundFixed = useMemo(() => {
    if (settings.isRainbowModeEnabled) {
        const stops: string[] = [];
        const steps = 6;
        for (let i = 0; i <= steps; i++) {
            const pct = (i / steps) * 100;
            const hue = (settings.rainbowOffset + i * 60); 
            stops.push(`hsl(${hue}, ${settings.rainbowSaturation}%, ${settings.rainbowBrightness}%) ${pct}%`);
        }
        return `linear-gradient(to bottom, ${stops.join(', ')})`;
    }
    return undefined;
  }, [settings.isRainbowModeEnabled, settings.rainbowOffset, settings.rainbowSaturation, settings.rainbowBrightness]);

  const bgOffsetY = (dynamicSize / 2) - (rainbowPeriod / 3);

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
                width: dynamicSize, 
                height: dynamicSize,
                backgroundImage: rainbowBackgroundFixed,
                backgroundSize: `100% ${rainbowPeriod}px`,
                backgroundRepeat: 'repeat',
                backgroundPosition: `0px ${bgOffsetY}px`,
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

           {/* Loading Indicator */}
           {isGenerating && (
             <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/80 p-2 rounded-full backdrop-blur-sm border border-white/10 shadow-xl">
                 <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 <span className="text-xs font-bold text-slate-300 pr-2">Calculating...</span>
             </div>
           )}
        </div>
    </div>
  );
});

export default React.memo(TonalityDiamond);
