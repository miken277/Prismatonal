import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine, ButtonShape } from '../types';
import { generateLattice } from '../services/LatticeService';
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
  latchMode: 0 | 1 | 2; // 0=Off, 1=LatchAll, 2=Sustain
  globalScale?: number; 
  viewZoom?: number;
  onNodeTrigger?: (nodeId: string, ratio: number, n?: number, d?: number, limit?: number) => void;
}

interface ActiveCursor {
  pointerId: number;
  currentX: number;
  currentY: number;
  originNodeId: string | null; 
  hoverNodeId: string | null;
  hasMoved: boolean; // Track if movement occurred for Bend persistence
}

const GRID_CELL_SIZE = 100; 

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, updateSettings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked, latchMode, globalScale = 1.0, viewZoom = 1.0, onNodeTrigger } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bgLineCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null); 
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null); 
  
  // Cache the bounding rect to avoid reflows on every pointer move
  const canvasRectRef = useRef<DOMRect | null>(null);

  const animationFrameRef = useRef<number>(0);
  
  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [dynamicSize, setDynamicSize] = useState(2000);
  const prevDynamicSizeRef = useRef(2000);

  const nodeMap = useMemo(() => {
      return new Map(data.nodes.map(n => [n.id, n]));
  }, [data.nodes]);

  const spatialGrid = useMemo(() => {
      const grid = new Map<string, LatticeNode[]>();
      const centerOffset = dynamicSize / 2;
      const spacing = settings.buttonSpacingScale * globalScale * viewZoom;

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
  }, [data.nodes, settings.buttonSpacingScale, dynamicSize, globalScale, viewZoom]);

  const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
  const [persistentLatches, setPersistentLatches] = useState<Map<string, string>>(new Map());

  // Listen for voice stealing from AudioEngine to update persistent latches visually
  useEffect(() => {
      const unsubscribe = audioEngine.onVoiceSteal((voiceId) => {
          if (voiceId.startsWith('node-')) {
              const nodeId = voiceId.replace('node-', '');
              setPersistentLatches(prev => {
                  if (prev.has(nodeId)) {
                      const next = new Map(prev);
                      next.delete(nodeId);
                      return next;
                  }
                  return prev;
              });
          }
      });
      return unsubscribe;
  }, [audioEngine]);

  const audioLatchedNodes = useMemo(() => {
      const effective = new Map<string, string>(persistentLatches);
      activeChordIds.forEach(chordId => {
        const chordDef = settings.savedChords.find(c => c.id === chordId);
        if (chordDef) {
            chordDef.nodes.forEach(n => {
                if (!effective.has(n.id)) effective.set(n.id, n.id);
            });
        }
      });
      return effective;
  }, [persistentLatches, activeChordIds, settings.savedChords]);

  const visualLatchedNodes = useMemo(() => {
      const visual = new Map(audioLatchedNodes);
      const isDiamond = settings.layoutApproach === 'diamond';

      activeCursors.forEach(cursor => {
          const isBending = settings.isPitchBendEnabled && !!cursor.originNodeId && latchMode !== 1;

          if (isBending && isDiamond) {
              if (cursor.originNodeId) {
                  visual.set(cursor.originNodeId, cursor.originNodeId);
              }
          } else {
              if (cursor.hoverNodeId) {
                  visual.set(cursor.hoverNodeId, cursor.hoverNodeId);
              }
          }
      });
      return visual;
  }, [audioLatchedNodes, activeCursors, settings.layoutApproach, settings.isPitchBendEnabled, latchMode]);

  const activeLines = useMemo(() => {
    const latched = visualLatchedNodes;
    const lines = data.lines;
    const active: LatticeLine[] = [];
    const reach = settings.voiceLeadingSteps || 1;
    
    if (latched.size < 2) return [];

    if (reach === 1) {
        for (const line of lines) {
            const s = line.sourceId;
            const t = line.targetId;
            if (latched.has(s) && latched.has(t)) {
                active.push(line);
            }
        }
    } 
    else if (reach === 2) {
        const activeNodes = Array.from(latched.keys()).map(id => nodeMap.get(id)).filter(n => n) as LatticeNode[];
        for (let i=0; i<activeNodes.length; i++) {
            for (let j=i+1; j<activeNodes.length; j++) {
                const A = activeNodes[i];
                const B = activeNodes[j];
                let dist = 0;
                for (let k=0; k < A.coords.length; k++) {
                    dist += Math.abs(A.coords[k] - B.coords[k]);
                }
                dist += Math.abs(A.octave - B.octave); 

                if (dist <= 2) {
                    const maxP = Math.max(A.maxPrime, B.maxPrime);
                    active.push({
                        id: `${A.id}-${B.id}`,
                        x1: A.x, y1: A.y,
                        x2: B.x, y2: B.y,
                        limit: maxP,
                        sourceId: A.id, targetId: B.id
                    });
                }
            }
        }
    }
    return active;
  }, [data.lines, visualLatchedNodes, settings.voiceLeadingSteps, nodeMap]);
  
  const brightenedLines = useMemo(() => {
      if (!settings.lineBrighteningEnabled || visualLatchedNodes.size === 0) return [];
      const activeIds = new Set(visualLatchedNodes.keys());
      const resultLines = new Set<LatticeLine>();
      const step1Neighbors = new Set<string>();

      data.lines.forEach(line => {
          const sActive = activeIds.has(line.sourceId);
          const tActive = activeIds.has(line.targetId);
          if (sActive || tActive) {
              resultLines.add(line);
              if (sActive) step1Neighbors.add(line.targetId);
              if (tActive) step1Neighbors.add(line.sourceId);
          }
      });

      if (settings.lineBrighteningSteps === 2) {
          data.lines.forEach(line => {
              if (resultLines.has(line)) return;
              const sNeighbor = step1Neighbors.has(line.sourceId);
              const tNeighbor = step1Neighbors.has(line.targetId);
              if (sNeighbor || tNeighbor) {
                  resultLines.add(line);
              }
          });
      }
      return Array.from(resultLines);
  }, [visualLatchedNodes, data.lines, settings.lineBrighteningEnabled, settings.lineBrighteningSteps]);

  const settingsRef = useRef(settings);
  const dataRef = useRef(data);
  const activeCursorsRef = useRef<Map<number, ActiveCursor>>(activeCursors);
  const visualLatchedRef = useRef(visualLatchedNodes);
  const nodeMapRef = useRef(nodeMap);
  const activeLinesRef = useRef(activeLines);
  const brightenedLinesRef = useRef(brightenedLines);
  const spatialGridRef = useRef(spatialGrid);
  const dynamicSizeRef = useRef(dynamicSize);
  const globalScaleRef = useRef(globalScale);
  const viewZoomRef = useRef(viewZoom);
  const persistentLatchesRef = useRef(persistentLatches);
  
  const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { activeCursorsRef.current = activeCursors; }, [activeCursors]);
  useEffect(() => { visualLatchedRef.current = visualLatchedNodes; }, [visualLatchedNodes]);
  useEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
  useEffect(() => { activeLinesRef.current = activeLines; }, [activeLines]);
  useEffect(() => { brightenedLinesRef.current = brightenedLines; }, [brightenedLines]);
  useEffect(() => { spatialGridRef.current = spatialGrid; }, [spatialGrid]);
  useEffect(() => { dynamicSizeRef.current = dynamicSize; }, [dynamicSize]);
  useEffect(() => { globalScaleRef.current = globalScale; }, [globalScale]);
  useEffect(() => { viewZoomRef.current = viewZoom; }, [viewZoom]);
  useEffect(() => { persistentLatchesRef.current = persistentLatches; }, [persistentLatches]);
  
  const lastTouchedLimitRef = useRef<number | null>(null);
  const depthHistoryRef = useRef<number[]>([]);
  const prevActiveChordIds = useRef<string[]>([]);

  const updateRect = () => {
      if (dynamicCanvasRef.current) {
          canvasRectRef.current = dynamicCanvasRef.current.getBoundingClientRect();
      }
  };

  useEffect(() => {
      window.addEventListener('resize', updateRect);
      const scroller = scrollContainerRef.current;
      if (scroller) scroller.addEventListener('scroll', updateRect);
      updateRect();
      return () => {
          window.removeEventListener('resize', updateRect);
          if (scroller) scroller.removeEventListener('scroll', updateRect);
      };
  }, []);

  useEffect(() => {
      updateRect();
  }, [dynamicSize]);

  useEffect(() => {
      const handleBlur = () => {
          if (activeCursorsRef.current.size > 0) {
              setActiveCursors(new Map());
              cursorPositionsRef.current.clear();
              audioEngine.stopAll();
              midiService.panic();
          }
      };
      window.addEventListener('blur', handleBlur);
      return () => window.removeEventListener('blur', handleBlur);
  }, []);

  useImperativeHandle(ref, () => ({
    clearLatches: () => setPersistentLatches(new Map()),
    centerView: () => { centerScroll(); },
    increaseDepth: () => {
        const limit = lastTouchedLimitRef.current;
        if (limit && limit > 1) {
             updateSettings((prev: AppSettings) => {
                 const currentDepth = prev.limitDepths[limit as 3|5|7|11|13];
                 return { ...prev, limitDepths: { ...prev.limitDepths, [limit]: currentDepth + 1 } };
             });
             depthHistoryRef.current.push(limit);
        }
    },
    decreaseDepth: () => {
        const limit = depthHistoryRef.current.pop();
        if (limit) {
            updateSettings((prev: AppSettings) => {
                 const currentDepth = prev.limitDepths[limit as 3|5|7|11|13];
                 return { ...prev, limitDepths: { ...prev.limitDepths, [limit]: Math.max(0, currentDepth - 1) } };
             });
        }
    },
    getLatchedNodes: () => {
        const result: LatticeNode[] = [];
        audioLatchedNodes.forEach((_, id) => {
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
        requestAnimationFrame(updateRect);
      }
  };

  useEffect(() => {
      if (isInitialLoad && !isGenerating && data.nodes.length > 0) {
          centerScroll();
          setIsInitialLoad(false);
      }
  }, [isGenerating, data.nodes.length, isInitialLoad, dynamicSize]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    if (!isInitialLoad && dynamicSize !== prevDynamicSizeRef.current) {
        const diff = (dynamicSize - prevDynamicSizeRef.current) / 2;
        container.scrollLeft += diff;
        container.scrollTop += diff;
        requestAnimationFrame(updateRect);
    }
    prevDynamicSizeRef.current = dynamicSize;
  }, [dynamicSize, isInitialLoad]);

  const generationDeps = useMemo(() => {
      return JSON.stringify({
          tuning: settings.tuningSystem,
          layout: settings.layoutApproach,
          depths: settings.limitDepths,
          complexities: settings.limitComplexities,
          hidden: settings.hiddenLimits,
          ratio: settings.latticeAspectRatio,
          skin: settings.activeSkin
      });
  }, [settings.tuningSystem, settings.layoutApproach, settings.limitDepths, settings.limitComplexities, settings.hiddenLimits, settings.latticeAspectRatio, settings.activeSkin]);

  useEffect(() => {
    setIsGenerating(true);
    const timerId = setTimeout(() => {
        const effectiveSettings: AppSettings = JSON.parse(JSON.stringify(settings));
        const hiddenLimits = effectiveSettings.hiddenLimits || [];
        hiddenLimits.forEach((limit: number) => {
            // @ts-ignore
            if (effectiveSettings.limitDepths[limit] !== undefined) effectiveSettings.limitDepths[limit] = 0;
        });

        const result = generateLattice(effectiveSettings);
        const visibleNodeIds = new Set(result.nodes.map(n => n.id));
        const visibleLines = result.lines.filter(l => {
            if (hiddenLimits.includes(l.limit)) return false;
            if (!visibleNodeIds.has(l.sourceId) || !visibleNodeIds.has(l.targetId)) return false;
            return true;
        });

        let maxExtent = 0;
        for (const n of result.nodes) {
            const absX = Math.abs(n.x);
            const absY = Math.abs(n.y);
            if (absX > maxExtent) maxExtent = absX;
            if (absY > maxExtent) maxExtent = absY;
        }

        const padding = 600; 
        const spacing = settingsRef.current.buttonSpacingScale * globalScale * viewZoom; 
        const calculatedSize = (maxExtent * spacing * 2) + padding;
        const finalSize = Math.max(calculatedSize, window.innerWidth, window.innerHeight);

        const MAX_CANVAS_SIZE = 5000; // Increased for linear layout
        const clampedSize = Math.min(finalSize, MAX_CANVAS_SIZE);

        if (Math.abs(clampedSize - dynamicSizeRef.current) > 50) {
            setDynamicSize(clampedSize);
        }

        setData({ nodes: result.nodes, lines: visibleLines });
        setIsGenerating(false);
    }, 10);
    return () => clearTimeout(timerId);
  }, [generationDeps]); 
  
  useEffect(() => {
      let maxExtent = 0;
      for (const n of data.nodes) {
          const absX = Math.abs(n.x);
          const absY = Math.abs(n.y);
          if (absX > maxExtent) maxExtent = absX;
          if (absY > maxExtent) maxExtent = absY;
      }
      const padding = 600; 
      const spacing = settings.buttonSpacingScale * globalScale * viewZoom;
      const calculatedSize = (maxExtent * spacing * 2) + padding;
      const finalSize = Math.max(calculatedSize, window.innerWidth, window.innerHeight);
      
      const MAX_CANVAS_SIZE = 5000;
      const clampedSize = Math.min(finalSize, MAX_CANVAS_SIZE);

      if (Math.abs(clampedSize - dynamicSize) > 50) setDynamicSize(clampedSize);
  }, [settings.buttonSpacingScale, globalScale, viewZoom]);


  const visualDeps = useMemo(() => JSON.stringify({
      tuning: settings.tuningSystem,
      layout: settings.layoutApproach,
      skin: settings.activeSkin,
      size: settings.buttonSizeScale,
      spacing: settings.buttonSpacingScale,
      colors: settings.colors,
      shape: settings.buttonShape,
      textScale: settings.nodeTextSizeScale,
      fractionBar: settings.showFractionBar,
      canvasSize: dynamicSize,
      globalScale: globalScale,
      viewZoom: viewZoom,
      baseLineWidth: settings.baseLineWidth,
      lineBrighteningWidth: settings.lineBrighteningWidth
  }), [settings.tuningSystem, settings.layoutApproach, settings.activeSkin, settings.buttonSizeScale, settings.buttonSpacingScale, settings.colors, settings.buttonShape, settings.nodeTextSizeScale, settings.showFractionBar, dynamicSize, globalScale, viewZoom, settings.baseLineWidth, settings.lineBrighteningWidth]);

  useEffect(() => {
      const canvas = staticCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);
      const size = dynamicSize;
      
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
          canvas.width = size * dpr;
          canvas.height = size * dpr;
      }
      
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const centerOffset = size / 2;
      const effectiveScale = globalScale * viewZoom;
      const spacing = settings.buttonSpacingScale * effectiveScale;
      const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;
      const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;

      const isJIOverride = settings.tuningSystem === 'ji' && settings.layoutApproach !== 'lattice' && settings.layoutApproach !== 'diamond';
      
      const linesByLimit: Record<number, number[]> = {};
      for (const line of data.lines) {
          if (!linesByLimit[line.limit]) linesByLimit[line.limit] = [];
          const arr = linesByLimit[line.limit];
          arr.push(line.x1 * spacing + centerOffset, line.y1 * spacing + centerOffset, line.x2 * spacing + centerOffset, line.y2 * spacing + centerOffset);
      }

      ctx.lineCap = 'round';
      const baseWidth = settings.baseLineWidth || 1.0;
      
      for (const limitStr in linesByLimit) {
          const limit = parseInt(limitStr);
          const coords = linesByLimit[limit];
          const color = isJIOverride ? '#fff' : (settings.colors[limit] || '#666');
          
          ctx.beginPath();
          for(let i=0; i<coords.length; i+=4) {
              ctx.moveTo(coords[i], coords[i+1]);
              ctx.lineTo(coords[i+2], coords[i+3]);
          }
          // Make Limit 1 (Identity) lines significantly thicker than base width to standout
          ctx.lineWidth = (limit === 1 ? Math.max(2.5, baseWidth * 2.5) : baseWidth) * effectiveScale; 
          ctx.strokeStyle = color;
          ctx.globalAlpha = (isJIOverride ? 0.15 : 0.3); 
          
          if (limit === 1) ctx.setLineDash([5 * effectiveScale, 5 * effectiveScale]);
          else ctx.setLineDash([]);
          ctx.stroke();
      }
      ctx.setLineDash([]); 

      for (const node of data.nodes) {
          const x = node.x * spacing + centerOffset;
          const y = node.y * spacing + centerOffset;
          const cTop = isJIOverride ? '#fff' : (settings.colors[node.limitTop] || '#666');
          const cBottom = isJIOverride ? '#eee' : (settings.colors[node.limitBottom] || '#666');
          
          const radius = baseRadius;

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

          if (isJIOverride) {
              ctx.fillStyle = '#111';
              ctx.fill();
              ctx.lineWidth = 2 * effectiveScale;
              ctx.strokeStyle = '#fff';
              ctx.stroke();
          } else {
              const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
              grad.addColorStop(0.45, cTop);
              grad.addColorStop(0.55, cBottom);
              ctx.fillStyle = grad;
              ctx.fill();
          }

          const combinedScale = settings.buttonSizeScale * viewZoom; // Use viewZoom to scale text readability
          if (combinedScale > 0.4) {
              ctx.fillStyle = isJIOverride ? '#fff' : 'white';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              let fontSize = Math.max(10, Math.min(18, 14 * combinedScale)) * settings.nodeTextSizeScale * effectiveScale;
              ctx.font = `bold ${fontSize}px sans-serif`; 
              
              const spacingY = settings.showFractionBar ? 0.55 : 0.50;
              ctx.fillText(node.n.toString(), x, y - (radius * spacingY));
              if (settings.showFractionBar) {
                  ctx.beginPath();
                  ctx.moveTo(x - (radius * 0.4), y);
                  ctx.lineTo(x + (radius * 0.4), y);
                  ctx.lineWidth = 1 * effectiveScale;
                  ctx.strokeStyle = isJIOverride ? 'rgba(255,255,255,0.4)' : `rgba(255,255,255,0.8)`;
                  ctx.stroke();
              }
              ctx.fillText(node.d.toString(), x, y + (radius * spacingY));
          }
      }
  }, [data, visualDeps]); 

  useEffect(() => {
    if (settings.chordsAlwaysRelatch) {
         const newChords = activeChordIds.filter(id => !prevActiveChordIds.current.includes(id));
         if (newChords.length > 0) {
             const nodes = nodeMap;
             newChords.forEach(chordId => {
                 const chordDef = settings.savedChords.find(c => c.id === chordId);
                 if (chordDef) {
                     chordDef.nodes.forEach(n => {
                        const fullNode = nodes.get(n.id);
                        if (fullNode) {
                            audioEngine.startVoice(`node-${n.id}`, fullNode.ratio, settings.baseFrequency, 'latch');
                            if (settings.midiEnabled) midiService.noteOn(`node-${n.id}`, fullNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);
                        }
                     });
                 }
             });
         }
    }
    prevActiveChordIds.current = activeChordIds;
  }, [activeChordIds, settings.savedChords, settings.chordsAlwaysRelatch, nodeMap]);

  const prevAudioLatchedRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
      const current = audioLatchedNodes;
      const prev = prevAudioLatchedRef.current;
      const nodes = nodeMap;
      
      current.forEach((originId, nodeId) => {
          if (!prev.has(nodeId)) {
               const node = nodes.get(nodeId); 
               if (node) {
                   audioEngine.startVoice(`node-${nodeId}`, node.ratio, settings.baseFrequency, 'latch');
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

      prevAudioLatchedRef.current = current;
  }, [audioLatchedNodes, nodeMap, settings.baseFrequency, settings.midiEnabled]);

  useEffect(() => {
    audioEngine.setPolyphony(settings.polyphony);
  }, [settings.polyphony]);

  const getHitNode = (clientX: number, clientY: number): LatticeNode | null => {
      if (!dynamicCanvasRef.current) return null;
      let rect = canvasRectRef.current;
      if (!rect) {
          rect = dynamicCanvasRef.current.getBoundingClientRect();
          canvasRectRef.current = rect;
      }
      
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const centerOffset = dynamicSizeRef.current / 2;
      const effectiveScale = globalScaleRef.current * viewZoomRef.current;
      const spacing = settings.buttonSpacingScale * effectiveScale;
      const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;

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
                  const r = baseRadius;
                  
                  if (x < nx - r || x > nx + r || y < ny - r || y > ny + r) continue;
                  
                  const dx = x - nx;
                  const dy = y - ny;
                  if (dx*dx + dy*dy < r*r) return node;
              }
          }
      }
      return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (audioEngine) audioEngine.resume();

      if (uiUnlocked || !dynamicCanvasRef.current) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const hitNode = getHitNode(e.clientX, e.clientY);
      const nodeId = hitNode ? hitNode.id : null;

      const newCursor: ActiveCursor = {
          pointerId: e.pointerId,
          currentX: e.clientX,
          currentY: e.clientY,
          originNodeId: nodeId, 
          hoverNodeId: nodeId,
          hasMoved: false
      };

      const nextRef = new Map(activeCursorsRef.current);
      nextRef.set(e.pointerId, newCursor);
      activeCursorsRef.current = nextRef;

      setActiveCursors(prev => {
          const next = new Map(prev);
          next.set(e.pointerId, newCursor);
          return next;
      });

      if (hitNode) {
        const topLayer = settings.layerOrder[settings.layerOrder.length - 1];
        if (hitNode.maxPrime !== topLayer) onLimitInteraction(hitNode.maxPrime);
        lastTouchedLimitRef.current = hitNode.maxPrime;

        if (onNodeTrigger) {
            onNodeTrigger(hitNode.id, hitNode.ratio, hitNode.n, hitNode.d, hitNode.maxPrime);
        }

        const isPersistentlyLatched = persistentLatches.has(hitNode.id);
        const isAudioLatched = audioLatchedNodes.has(hitNode.id);

        if (latchMode === 1) {
             setPersistentLatches(prev => {
                 const next = new Map(prev);
                 if (isPersistentlyLatched) next.delete(hitNode.id);
                 else next.set(hitNode.id, hitNode.id);
                 return next;
             });
        }
        else {
            if (isPersistentlyLatched) {
                setPersistentLatches(prev => {
                    const next = new Map(prev);
                    next.delete(hitNode.id);
                    return next;
                });
            } else if (!isAudioLatched) {
                const voiceId = `cursor-${e.pointerId}-${hitNode.id}`;
                const voiceType = 'normal'; 
                audioEngine.startVoice(voiceId, hitNode.ratio, settings.baseFrequency, voiceType);
                if (settings.midiEnabled) midiService.noteOn(voiceId, hitNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);
            }
        }
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (uiUnlocked) return;
    
    // Safety check: verify this cursor exists in REF
    if (!activeCursorsRef.current.has(e.pointerId)) return;

    // Direct ref usage prevents stale closure state
    const cursor = activeCursorsRef.current.get(e.pointerId)!;
    
    cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    const hitNode = getHitNode(e.clientX, e.clientY);
    const hitId = hitNode ? hitNode.id : null;

    const deltaMoveX = Math.abs(e.clientX - cursor.currentX);
    const deltaMoveY = Math.abs(e.clientY - cursor.currentY);
    
    let hasMoved = cursor.hasMoved;
    if (!hasMoved && (deltaMoveX > 3 || deltaMoveY > 3)) {
        hasMoved = true;
    }

    // Determine if bending is active for THIS cursor
    const isBendEnabled = settingsRef.current.isPitchBendEnabled;
    const isOriginActive = !!cursor.originNodeId;
    const isBending = isBendEnabled && isOriginActive && latchMode !== 1;

    // --- BEND AUDIO LOGIC ---
    if (isBending && cursor.originNodeId && dynamicCanvasRef.current) {
         const centerOffset = dynamicSizeRef.current / 2;
         // Optimization: Use cached rect if available, fallback to getBoundingClientRect
         const rect = canvasRectRef.current || dynamicCanvasRef.current.getBoundingClientRect();
         
         const originNode = nodeMapRef.current.get(cursor.originNodeId);
         if (originNode) {
             const effectiveScale = globalScaleRef.current * viewZoomRef.current;
             const spacing = settingsRef.current.buttonSpacingScale * effectiveScale;
             const originScreenY = rect.top + (originNode.y * spacing) + centerOffset;
             const deltaY = e.clientY - originScreenY;
             const bentRatio = getPitchRatioFromScreenDelta(deltaY, settingsRef.current.buttonSpacingScale * effectiveScale);
             const finalRatio = originNode.ratio * bentRatio;
             
             const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
             audioEngine.glideVoice(voiceId, finalRatio, settingsRef.current.baseFrequency);
             if (settingsRef.current.midiEnabled) midiService.pitchBend(voiceId, finalRatio, settingsRef.current.baseFrequency, settingsRef.current.midiPitchBendRange);
         }
    }

    // --- NODE CHANGE / STOP LOGIC ---
    if (cursor.hoverNodeId !== hitId) {
        
        // Logic: Stop the old note UNLESS we are bending from origin
        // If bending, the voice (originNodeId) must persist even if we hover null or another node
        
        const isLeavingOrigin = cursor.hoverNodeId === cursor.originNodeId;
        const shouldSustainBend = isBending && isLeavingOrigin;

        if (latchMode === 0) {
             if (shouldSustainBend) {
                 // Do not stop voice. It is sustaining for the bend.
             } else if (cursor.hoverNodeId) {
                 // Stop the previous note if we are simply moving between nodes (strum) or leaving without bend
                 const oldVoiceId = `cursor-${e.pointerId}-${cursor.hoverNodeId}`;
                 audioEngine.stopVoice(oldVoiceId);
                 if (settingsRef.current.midiEnabled) midiService.noteOff(oldVoiceId);
             }
        }

        // Logic: Trigger NEW note if we hit a node
        // BUT if bending, we generally DON'T trigger new notes (monophonic bend gesture)
        // Unless user wants to slide over notes? Usually bend implies holding the origin.
        
        if (hitNode) {
             const topLayer = settingsRef.current.layerOrder[settingsRef.current.layerOrder.length - 1];
             if (hitNode.maxPrime !== topLayer) onLimitInteraction(hitNode.maxPrime);
             
             if (latchMode === 1) {
                // Full Latch Logic (Toggle)
                const isAlreadyLatched = persistentLatchesRef.current.has(hitNode.id);
                if (!isAlreadyLatched) {
                    setPersistentLatches(prev => {
                        if (prev.has(hitNode.id)) return prev;
                        const next = new Map(prev);
                        next.set(hitNode.id, hitNode.id);
                        return next;
                    });
                }
             } 
             else {
                 // Normal/Partial Mode
                 const isAlreadyLatched = audioLatchedNodes.has(hitNode.id);
                 
                 // Don't retrigger if already playing via latch
                 // Don't trigger new notes if we are currently performing a bend on the origin
                 if (!isAlreadyLatched && !isBending) {
                     const voiceId = `cursor-${e.pointerId}-${hitNode.id}`;
                     audioEngine.startVoice(voiceId, hitNode.ratio, settingsRef.current.baseFrequency, 'strum');
                     if (settingsRef.current.midiEnabled) midiService.noteOn(voiceId, hitNode.ratio, settingsRef.current.baseFrequency, settingsRef.current.midiPitchBendRange);
                 }
             }
        }
        
        // Update State & Ref
        const updatedCursor = { ...cursor, hoverNodeId: hitId, hasMoved: hasMoved };
        activeCursorsRef.current.set(e.pointerId, updatedCursor);
        
        setActiveCursors(prev => {
            const next = new Map(prev);
            next.set(e.pointerId, updatedCursor);
            return next;
        });

    } else if (hasMoved !== cursor.hasMoved) {
        // Just update movement status if nothing else changed
        const updatedCursor = { ...cursor, hasMoved: true };
        activeCursorsRef.current.set(e.pointerId, updatedCursor);
        
        setActiveCursors(prev => {
            const next = new Map(prev);
            next.set(e.pointerId, updatedCursor);
            return next;
        });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeCursorsRef.current.has(e.pointerId)) {
        const cursor = activeCursorsRef.current.get(e.pointerId)!;
        const isBending = settingsRef.current.isPitchBendEnabled && cursor.originNodeId && latchMode !== 1;
        
        if (latchMode === 1) {
            // Full Latch: notes persist
        } else {
            // Stop logic for Normal/Partial
            
            if (isBending && cursor.originNodeId) {
                // If we were bending, stop the origin voice
                const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
                audioEngine.stopVoice(voiceId);
                if (settingsRef.current.midiEnabled) midiService.noteOff(voiceId);
            } 
            else if (cursor.hoverNodeId) {
                 // Otherwise stop the last hovered note
                 const voiceId = `cursor-${e.pointerId}-${cursor.hoverNodeId}`;
                 audioEngine.stopVoice(voiceId);
                 if (settingsRef.current.midiEnabled) midiService.noteOff(voiceId);
            }
        }
        
        cursorPositionsRef.current.delete(e.pointerId);
        
        const nextRef = new Map(activeCursorsRef.current);
        nextRef.delete(e.pointerId);
        activeCursorsRef.current = nextRef;

        setActiveCursors(prev => {
            const next = new Map(prev);
            next.delete(e.pointerId);
            return next;
        });
    }
  };

  const render = (time: number) => {
      const bgCanvas = bgLineCanvasRef.current;
      const activeCanvas = dynamicCanvasRef.current;
      if (!bgCanvas || !activeCanvas) {
           animationFrameRef.current = requestAnimationFrame(render);
           return;
      }
      
      const bgCtx = bgCanvas.getContext('2d', { alpha: true });
      const activeCtx = activeCanvas.getContext('2d', { alpha: true });
      if (!bgCtx || !activeCtx) return; 
      
      const currentSettings = settingsRef.current;
      const currentVisualLatched = visualLatchedRef.current; 
      const currentActiveLines = activeLinesRef.current;
      const currentBrightenedLines = brightenedLinesRef.current;
      const size = dynamicSizeRef.current;
      const cursors = activeCursorsRef.current;
      const currentGlobalScale = globalScaleRef.current * viewZoomRef.current; // Multiply global scale by zoom

      const isJIOverride = currentSettings.tuningSystem === 'ji' && currentSettings.layoutApproach !== 'lattice' && currentSettings.layoutApproach !== 'diamond';
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);

      if (bgCanvas.width !== size * dpr || bgCanvas.height !== size * dpr) {
            bgCanvas.width = size * dpr;
            bgCanvas.height = size * dpr;
            activeCanvas.width = size * dpr;
            activeCanvas.height = size * dpr;
            bgCtx.scale(dpr, dpr);
            activeCtx.scale(dpr, dpr);
      }

      let viewX = 0, viewY = 0, viewW = size, viewH = size;
      if (scrollContainerRef.current) {
          viewX = scrollContainerRef.current.scrollLeft;
          viewY = scrollContainerRef.current.scrollTop;
          viewW = scrollContainerRef.current.clientWidth;
          viewH = scrollContainerRef.current.clientHeight;
      }
      
      bgCtx.clearRect(viewX, viewY, viewW, viewH);
      activeCtx.clearRect(viewX, viewY, viewW, viewH);

      const centerOffset = size / 2;
      const spacing = currentSettings.buttonSpacingScale * currentGlobalScale;
      const baseRadius = (60 * currentSettings.buttonSizeScale * currentGlobalScale) / 2;
      const isDiamond = currentSettings.buttonShape === ButtonShape.DIAMOND;
      const colorCache = currentSettings.colors;

      const animationSpeed = (currentSettings.voiceLeadingAnimationSpeed || 2.0) * 0.33;
      const rawPhase = (time * 0.001 * animationSpeed);
      const flowPhase = currentSettings.voiceLeadingReverseDir ? (1.0 - (rawPhase % 1.0)) : (rawPhase % 1.0);
      
      bgCtx.lineCap = 'round';
      activeCtx.lineCap = 'round';

      const viewPad = 100;
      const leftBound = viewX - viewPad;
      const rightBound = viewX + viewW + viewPad;
      const topBound = viewY - viewPad;
      const bottomBound = viewY + viewH + viewPad;
      
      if (currentBrightenedLines.length > 0) {
            bgCtx.setLineDash([]);
            const brightWidth = currentSettings.lineBrighteningWidth || 1.0;
            for (const line of currentBrightenedLines) {
                const x1 = line.x1 * spacing + centerOffset;
                const y1 = line.y1 * spacing + centerOffset;
                const x2 = line.x2 * spacing + centerOffset;
                const y2 = line.y2 * spacing + centerOffset;
                if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;
                const limitColor = isJIOverride ? '#fff' : (colorCache[line.limit] || '#666');
                bgCtx.beginPath();
                bgCtx.moveTo(x1, y1);
                bgCtx.lineTo(x2, y2);
                bgCtx.lineWidth = brightWidth * currentGlobalScale;
                bgCtx.strokeStyle = limitColor;
                bgCtx.globalAlpha = isJIOverride ? 0.4 : 0.8; 
                bgCtx.stroke();
            }
      }

      bgCtx.setLineDash([]); 
      for (const line of currentActiveLines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;
            if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;
            const limitColor = isJIOverride ? '#fff' : (colorCache[line.limit] || '#666');
            bgCtx.beginPath();
            bgCtx.moveTo(x1, y1);
            bgCtx.lineTo(x2, y2);
            bgCtx.lineWidth = (isJIOverride ? 2 : 4) * currentGlobalScale;
            bgCtx.strokeStyle = limitColor;
            bgCtx.globalAlpha = 1.0;
            bgCtx.stroke();
            if (currentSettings.isVoiceLeadingAnimationEnabled) {
                const grad = bgCtx.createLinearGradient(x1, y1, x2, y2);
                const p = flowPhase;
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                const pulseWidth = 0.2;
                const start = Math.max(0, p - pulseWidth);
                const end = Math.min(1, p + pulseWidth);
                if (start > 0) grad.addColorStop(start, 'rgba(255,255,255,0)');
                grad.addColorStop(p, isJIOverride ? 'rgba(255,255,255,1.0)' : 'rgba(255,255,255,0.7)'); 
                if (end < 1) grad.addColorStop(end, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                bgCtx.strokeStyle = grad;
                bgCtx.lineWidth = 10 * (0.5 + currentSettings.voiceLeadingGlowAmount) * currentGlobalScale;
                bgCtx.globalAlpha = 0.3; 
                bgCtx.stroke();
                bgCtx.lineWidth = 4 * currentGlobalScale;
                bgCtx.globalAlpha = 1.0;
                bgCtx.stroke();
            }
      }

      for (const id of currentVisualLatched.keys()) {
             const node = nodeMapRef.current.get(id);
             if (!node) continue;
             const x = node.x * spacing + centerOffset;
             const y = node.y * spacing + centerOffset;
             if (x < leftBound || x > rightBound || y < topBound || y > bottomBound) continue;
             const cTop = isJIOverride ? '#fff' : (colorCache[node.limitTop] || '#666');
             const zoomScale = currentSettings.latchedZoomScale;
             const radius = baseRadius * zoomScale;
             activeCtx.globalAlpha = 1.0; 
             activeCtx.beginPath();
             if (isDiamond) {
                activeCtx.moveTo(x, y - radius);
                activeCtx.lineTo(x + radius, y);
                activeCtx.lineTo(x, y + radius);
                activeCtx.lineTo(x - radius, y);
             } else {
                activeCtx.arc(x, y, radius, 0, Math.PI * 2);
             }
             activeCtx.closePath();
             
             if (isJIOverride) {
                 activeCtx.fillStyle = '#fff'; // Latched nodes glow pure white in alternate layouts
             } else {
                 const grad = activeCtx.createLinearGradient(x, y - radius, x, y + radius);
                 grad.addColorStop(0.45, cTop);
                 grad.addColorStop(0.55, colorCache[node.limitBottom] || '#666');
                 activeCtx.fillStyle = grad;
             }
             activeCtx.fill();

             if (currentSettings.isColoredIlluminationEnabled && !isJIOverride) {
                 const rp = getRainbowPeriod(currentSettings.buttonSpacingScale * currentGlobalScale);
                 const phase = (y % rp) / rp;
                 const hue = (currentSettings.rainbowOffset + phase * 360) % 360;
                 const sat = currentSettings.isRainbowModeEnabled ? currentSettings.rainbowSaturation : 100;
                 activeCtx.strokeStyle = `hsl(${hue}, ${sat}%, 60%)`;
                 activeCtx.lineWidth = 4 * currentGlobalScale;
             } else {
                 activeCtx.strokeStyle = isJIOverride ? '#fff' : 'white';
                 activeCtx.lineWidth = isJIOverride ? 4 * currentGlobalScale : 3 * currentGlobalScale;
                 if (isJIOverride) {
                    activeCtx.shadowBlur = 10 * currentGlobalScale;
                    activeCtx.shadowColor = '#fff';
                 }
             }
             activeCtx.stroke();
             activeCtx.shadowBlur = 0; // Reset

             const combinedScale = currentSettings.buttonSizeScale * zoomScale;
             if (combinedScale > 0.4) {
                activeCtx.fillStyle = isJIOverride ? '#000' : 'white';
                activeCtx.textAlign = 'center';
                activeCtx.textBaseline = 'middle';
                let fontSize = Math.max(12, Math.min(22, 16 * combinedScale)) * currentSettings.nodeTextSizeScale * currentGlobalScale;
                activeCtx.font = `bold ${fontSize}px sans-serif`; 
                const spacingY = currentSettings.showFractionBar ? 0.55 : 0.50;
                activeCtx.fillText(node.n.toString(), x, y - (radius * spacingY));
                if (currentSettings.showFractionBar) {
                    activeCtx.beginPath();
                    activeCtx.moveTo(x - (radius * 0.4), y);
                    activeCtx.lineTo(x + (radius * 0.4), y);
                    activeCtx.lineWidth = 1 * currentGlobalScale;
                    activeCtx.strokeStyle = isJIOverride ? 'rgba(0,0,0,0.5)' : 'white';
                    activeCtx.stroke();
                }
                activeCtx.fillText(node.d.toString(), x, y + (radius * spacingY));
             }
      }
      
      if (currentSettings.isPitchBendEnabled) {
            cursors.forEach(c => {
                if (c.originNodeId) { 
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
                         activeCtx.beginPath();
                         activeCtx.moveTo(nx, ny);
                         activeCtx.lineTo(cx, cy);
                         activeCtx.strokeStyle = isJIOverride ? '#fff' : 'white';
                         activeCtx.lineWidth = 2 * currentGlobalScale;
                         activeCtx.globalAlpha = 0.5;
                         activeCtx.stroke();
                         activeCtx.globalAlpha = 1.0;
                    }
                }
            });
      }

      animationFrameRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []); 

  const getBackgroundStyle = () => {
      const mode = settings.backgroundMode;
      const offset = settings.backgroundYOffset || 0;
      const isJIOverride = settings.tuningSystem === 'ji' && settings.layoutApproach !== 'lattice' && settings.layoutApproach !== 'diamond';

      const baseStyle: React.CSSProperties = {
          minWidth: '100%', minHeight: '100%', width: dynamicSize, height: dynamicSize,
          pointerEvents: uiUnlocked ? 'none' : 'auto',
          backgroundPosition: `center calc(50% + ${offset}px)`,
          backgroundRepeat: 'no-repeat', backgroundSize: 'cover'
      };

      if (isJIOverride) {
          return { ...baseStyle, backgroundColor: 'black', backgroundImage: 'none' };
      }

      switch(mode) {
          case 'rainbow':
              const period = getRainbowPeriod(settings.buttonSpacingScale * globalScale * viewZoom);
              const stops = [];
              for(let i=0; i<=6; i++) {
                  const pct = (i/6)*100;
                  const hue = (settings.rainbowOffset + i*60);
                  stops.push(`hsl(${hue}, ${settings.rainbowSaturation}%, ${settings.rainbowBrightness}%) ${pct}%`);
              }
              return { ...baseStyle, backgroundImage: `linear-gradient(to bottom, ${stops.join(', ')})`, backgroundSize: `100% ${period}px`, backgroundRepeat: 'repeat', backgroundPosition: `0px calc(50% + ${offset}px)` };
          case 'charcoal': return { ...baseStyle, backgroundColor: '#18181b' }; 
          case 'midnight_blue': return { ...baseStyle, backgroundColor: '#0a0a23' }; 
          case 'deep_maroon': return { ...baseStyle, backgroundColor: '#3e0000' };
          case 'forest_green': return { ...baseStyle, backgroundColor: '#002200' };
          case 'slate_grey': return { ...baseStyle, backgroundColor: '#334155' };
          case 'image':
              if (settings.backgroundImageData) {
                  return { ...baseStyle, backgroundImage: `url(${settings.backgroundImageData})`, backgroundRepeat: settings.backgroundTiling ? 'repeat' : 'no-repeat', backgroundSize: settings.backgroundTiling ? 'auto' : 'contain', backgroundPosition: `center calc(50% + ${offset}px)` };
              }
              return { ...baseStyle, backgroundColor: 'black' };
          default: return { ...baseStyle, backgroundColor: 'black' };
      }
  };

  return (
    <div ref={scrollContainerRef} className="w-full h-full overflow-auto bg-slate-950 relative" style={{ touchAction: 'none' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onPointerCancel={handlePointerUp}>
        <div className="relative" style={getBackgroundStyle()}>
           <canvas ref={bgLineCanvasRef} className="absolute top-0 left-0 z-[5] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           <canvas ref={staticCanvasRef} className="absolute top-0 left-0 z-[10] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           <canvas ref={dynamicCanvasRef} className="absolute top-0 left-0 z-[20] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           {isGenerating && (<div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/80 p-2 rounded-full backdrop-blur-sm border border-white/10 shadow-xl"><svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="text-xs font-bold text-slate-300 pr-2">Calculating...</span></div>)}
        </div>
    </div>
  );
});

export default React.memo(TonalityDiamond);