
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine, ButtonShape, PresetSlot, PlaybackMode, LimitType } from '../types';
import { generateLattice } from '../services/LatticeService';
import { getPitchRatioFromScreenDelta, getRainbowPeriod, PITCH_SCALE } from '../services/ProjectionService';
import AudioEngine from '../services/AudioEngine';
import { midiService } from '../services/MidiService';
import { LatticeRenderer } from '../services/LatticeRenderer';

export interface TonalityDiamondHandle {
  clearLatches: (mode?: number) => void;
  centerView: () => void;
  increaseDepth: () => void;
  decreaseDepth: () => void;
  getLatchedNodes: () => { node: LatticeNode, mode: number }[];
}

interface Props {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void;
  audioEngine: AudioEngine;
  onLimitInteraction: (limit: number) => void;
  activeChordIds: string[];
  uiUnlocked: boolean;
  latchMode: 0 | 1 | 2 | 3 | 4; // 0=Off, 1=Drone, 2=Strings, 3=Plucked, 4=Brass
  isCurrentSustainEnabled: boolean;
  globalScale?: number; 
  viewZoom?: number;
  onNodeTrigger?: (nodeId: string, ratio: number, n?: number, d?: number, limit?: number) => void;
  onSustainStatusChange?: (activeModes: number[]) => void;
}

interface ActiveCursor {
  pointerId: number;
  originNodeId: string | null; 
  hoverNodeId: string | null;
  hasMoved: boolean;
  interactionLockedNodeId: string | null; 
}

interface NodeActivation {
    mode: number;
    timestamp: number;
    presetId: string;
}

const GRID_CELL_SIZE = 100; 

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, updateSettings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked, latchMode, isCurrentSustainEnabled, globalScale = 1.0, viewZoom = 1.0, onNodeTrigger, onSustainStatusChange } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bgLineCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null); 
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null); 
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);

  const animationFrameRef = useRef<number>(0);
  const globalBendRef = useRef<number>(0);
  const rendererRef = useRef<LatticeRenderer>(new LatticeRenderer());

  const [data, setData] = useState<{ nodes: LatticeNode[], lines: LatticeLine[] }>({ nodes: [], lines: [] });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Unified Scale Calculation
  const effectiveScale = globalScale * viewZoom;
  const prevEffectiveScaleRef = useRef(effectiveScale);

  // Calculate Extent & Dynamic Size Synchronously (No State, No Re-render lag)
  const maxExtent = useMemo(() => {
      let max = 0;
      for (const n of data.nodes) {
          const absX = Math.abs(n.x);
          const absY = Math.abs(n.y);
          if (absX > max) max = absX;
          if (absY > max) max = absY;
      }
      return max;
  }, [data.nodes]);

  const dynamicSize = useMemo(() => {
      const padding = 600 * effectiveScale;
      const spacing = settings.buttonSpacingScale * effectiveScale;
      const calculatedSize = (maxExtent * spacing * 2) + padding;
      const finalSize = Math.max(calculatedSize, window.innerWidth, window.innerHeight);
      const MAX_CANVAS_SIZE = 5000;
      return Math.min(finalSize, MAX_CANVAS_SIZE);
  }, [maxExtent, settings.buttonSpacingScale, effectiveScale]);

  const prevDynamicSizeRef = useRef(dynamicSize);

  const nodeMap = useMemo(() => {
      return new Map(data.nodes.map(n => [n.id, n]));
  }, [data.nodes]);

  const spatialGrid = useMemo(() => {
      const grid = new Map<string, LatticeNode[]>();
      const centerOffset = dynamicSize / 2;
      const spacing = settings.buttonSpacingScale * effectiveScale;

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
  }, [data.nodes, settings.buttonSpacingScale, dynamicSize, effectiveScale]);

  const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
  const [persistentLatches, setPersistentLatches] = useState<Map<string, Map<number, number>>>(new Map());
  
  const nodeTriggerHistory = useRef<Map<string, number>>(new Map());

  // Notify parent of active modes
  useEffect(() => {
      if (onSustainStatusChange) {
          const modes = new Set<number>();
          persistentLatches.forEach((modeMap) => {
              modeMap.forEach((_, mode) => modes.add(mode));
          });
          onSustainStatusChange(Array.from(modes));
      }
  }, [persistentLatches, onSustainStatusChange]);

  // Voice Stealing Handler
  useEffect(() => {
      const unsubscribe = audioEngine.onVoiceSteal((voiceId) => {
          if (voiceId.startsWith('node-')) {
              const nodeId = voiceId.replace('node-', '');
              setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                  let changed = false;
                  const next = new Map(prev);
                  if (next.has(nodeId)) {
                      next.delete(nodeId);
                      changed = true;
                  }
                  return changed ? next : prev;
              });
          }
      });
      return unsubscribe;
  }, [audioEngine]);

  // Global Bend Listener
  useEffect(() => {
      const unsubscribe = midiService.onGlobalBend((semitones) => {
          globalBendRef.current = semitones;
      });
      return unsubscribe;
  }, []);

  // Register Chord Presets
  useEffect(() => {
      activeChordIds.forEach(id => {
          const chord = settings.savedChords.find(c => c.id === id);
          if (chord) {
              if (chord.soundConfig) {
                  audioEngine.registerPreset(`chord-${id}`, chord.soundConfig);
              }
              if (chord.soundConfigs) {
                  Object.entries(chord.soundConfigs).forEach(([mode, preset]) => {
                      audioEngine.registerPreset(`chord-${id}-${mode}`, preset);
                  });
              }
          }
      });
  }, [activeChordIds, settings.savedChords, audioEngine]);

  // Audio Latches Logic
  const audioLatchedNodes = useMemo(() => {
      const effective = new Map<string, NodeActivation[]>();
      
      persistentLatches.forEach((modeMap, nodeId) => {
          const activations: NodeActivation[] = [];
          modeMap.forEach((timestamp, mode) => {
              let pId = 'normal';
              if (mode === 1) pId = 'latch';
              else if (mode === 3) pId = 'strum';
              else if (mode === 4) pId = 'brass';
              activations.push({ mode, timestamp, presetId: pId });
          });
          effective.set(nodeId, activations);
      });
      
      const defaultChordMode = (latchMode === 2) ? 2 : 1; 

      activeChordIds.forEach(chordId => {
        const chordDef = settings.savedChords.find(c => c.id === chordId);
        if (chordDef) {
            chordDef.nodes.forEach(n => {
                let mode = defaultChordMode;
                let presetId = `chord-${chordId}`; 

                if (n.voiceMode) {
                    if (n.voiceMode === 'latch') mode = 1;
                    else if (n.voiceMode === 'normal') mode = 2;
                    else if (n.voiceMode === 'strum') mode = 3;
                    else if (n.voiceMode === 'brass') mode = 4;

                    if (chordDef.soundConfigs && chordDef.soundConfigs[n.voiceMode]) {
                        presetId = `chord-${chordId}-${n.voiceMode}`;
                    } else if (chordDef.soundConfig) {
                        presetId = `chord-${chordId}`;
                    } else {
                        presetId = n.voiceMode;
                    }
                } else {
                    if (chordDef.soundConfig) {
                        presetId = `chord-${chordId}`;
                    } else {
                        presetId = (latchMode === 2) ? 'normal' : 'latch';
                    }
                }

                if (!effective.has(n.id)) {
                    effective.set(n.id, []);
                }
                const existing = effective.get(n.id)!;
                if (!existing.some(a => a.mode === mode)) {
                    existing.push({ mode, timestamp: 0, presetId });
                }
            });
        }
      });
      effective.forEach((list) => { list.sort((a, b) => a.timestamp - b.timestamp); });
      return effective;
  }, [persistentLatches, activeChordIds, settings.savedChords, latchMode]);

  const visualLatchedNodes = useMemo(() => {
      const visual = new Map<string, NodeActivation[]>();
      audioLatchedNodes.forEach((v, k) => visual.set(k, [...v]));

      activeCursors.forEach(cursor => {
          const isSustainingInstrument = latchMode === 1 || latchMode === 2 || latchMode === 4;
          const isSustainActive = isCurrentSustainEnabled;
          const isBendEnabled = settings.isPitchBendEnabled && latchMode !== 3; 
          
          const isHybridMode = isSustainingInstrument && isSustainActive && isBendEnabled;
          if (isHybridMode) return; 

          const isMelodic = !isSustainingInstrument || !isSustainActive || isBendEnabled;
          if (isMelodic && cursor.hoverNodeId) {
              const nodeId = cursor.hoverNodeId;
              if (!visual.has(nodeId)) {
                  visual.set(nodeId, []);
              }
              const list = visual.get(nodeId)!;
              const activation = { mode: latchMode, timestamp: Date.now(), presetId: 'cursor' };
              list.push(activation);
              list.sort((a, b) => a.timestamp - b.timestamp);
          }
      });
      return visual;
  }, [audioLatchedNodes, activeCursors, settings.isPitchBendEnabled, latchMode, isCurrentSustainEnabled]);

  const activeLines = useMemo(() => {
    const latched = visualLatchedNodes;
    const lines = data.lines;
    const active: LatticeLine[] = [];
    const reach = settings.voiceLeadingSteps || 1;
    
    if (latched.size < 2) return [];

    if (reach === 1) {
        for (const line of lines) {
            if (latched.has(line.sourceId) && latched.has(line.targetId)) {
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
                let coordDist = 0;
                for (let k=0; k < A.coords.length; k++) {
                    coordDist += Math.abs(A.coords[k] - B.coords[k]);
                }
                const octaveDist = Math.abs(A.octave - B.octave);
                const totalDist = coordDist + octaveDist;

                if (totalDist <= 2) {
                    let lineLimit = Math.max(A.maxPrime, B.maxPrime);
                    if (coordDist === 0 && octaveDist !== 0) {
                        lineLimit = LimitType.LIMIT_2;
                    }
                    active.push({
                        id: `${A.id}-${B.id}`,
                        x1: A.x, y1: A.y, x2: B.x, y2: B.y,
                        limit: lineLimit, 
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
          if (activeIds.has(line.sourceId) || activeIds.has(line.targetId)) {
              resultLines.add(line);
              if (activeIds.has(line.sourceId)) step1Neighbors.add(line.targetId);
              if (activeIds.has(line.targetId)) step1Neighbors.add(line.sourceId);
          }
      });

      if (settings.lineBrighteningSteps === 2) {
          data.lines.forEach(line => {
              if (resultLines.has(line)) return;
              if (step1Neighbors.has(line.sourceId) || step1Neighbors.has(line.targetId)) {
                  resultLines.add(line);
              }
          });
      }
      return Array.from(resultLines);
  }, [visualLatchedNodes, data.lines, settings.lineBrighteningEnabled, settings.lineBrighteningSteps]);

  // Refs for Render Loop
  const settingsRef = useRef(settings);
  const dataRef = useRef(data);
  const activeCursorsRef = useRef<Map<number, ActiveCursor>>(activeCursors);
  const visualLatchedRef = useRef(visualLatchedNodes);
  const activeLinesRef = useRef(activeLines);
  const brightenedLinesRef = useRef(brightenedLines);
  const dynamicSizeRef = useRef(dynamicSize);
  const effectiveScaleRef = useRef(effectiveScale);
  const latchModeRef = useRef(latchMode); 
  const nodeMapRef = useRef(nodeMap);
  const spatialGridRef = useRef(spatialGrid);
  const persistentLatchesRef = useRef<Map<string, Map<number, number>>>(persistentLatches);
  const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { activeCursorsRef.current = activeCursors; }, [activeCursors]);
  useEffect(() => { visualLatchedRef.current = visualLatchedNodes; }, [visualLatchedNodes]);
  useEffect(() => { activeLinesRef.current = activeLines; }, [activeLines]);
  useEffect(() => { brightenedLinesRef.current = brightenedLines; }, [brightenedLines]);
  useEffect(() => { dynamicSizeRef.current = dynamicSize; }, [dynamicSize]);
  useEffect(() => { effectiveScaleRef.current = effectiveScale; }, [effectiveScale]);
  useEffect(() => { latchModeRef.current = latchMode; }, [latchMode]);
  useEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
  useEffect(() => { spatialGridRef.current = spatialGrid; }, [spatialGrid]);
  useEffect(() => { persistentLatchesRef.current = persistentLatches; }, [persistentLatches]);
  
  const lastTouchedLimitRef = useRef<number | null>(null);
  const depthHistoryRef = useRef<number[]>([]);

  // Update Rect on Scroll/Resize
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

  useEffect(() => { updateRect(); }, [dynamicSize]);

  useImperativeHandle(ref, () => ({
    clearLatches: (mode?: number) => {
        if (mode === undefined) {
            setPersistentLatches(new Map());
        } else {
            setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                const next = new Map();
                prev.forEach((modeMap, nodeId) => {
                    const newModeMap = new Map(modeMap);
                    if (newModeMap.has(mode)) {
                        newModeMap.delete(mode);
                    }
                    if (newModeMap.size > 0) {
                        next.set(nodeId, newModeMap);
                    }
                });
                return next;
            });
        }
    },
    centerView: () => { centerScroll(); },
    increaseDepth: () => {
        const limit = lastTouchedLimitRef.current;
        if (limit && limit > 1) {
             updateSettings((prev: AppSettings) => {
                 const currentDepth = prev.limitDepths[limit as 3|5|7|11|13|15];
                 return { ...prev, limitDepths: { ...prev.limitDepths, [limit]: currentDepth + 1 } };
             });
             depthHistoryRef.current.push(limit);
        }
    },
    decreaseDepth: () => {
        const limit = depthHistoryRef.current.pop();
        if (limit) {
            updateSettings((prev: AppSettings) => {
                 const currentDepth = prev.limitDepths[limit as 3|5|7|11|13|15];
                 return { ...prev, limitDepths: { ...prev.limitDepths, [limit]: Math.max(0, currentDepth - 1) } };
             });
        }
    },
    getLatchedNodes: () => {
        const result: { node: LatticeNode, mode: number }[] = [];
        persistentLatches.forEach((modeMap, id) => {
            const n = nodeMap.get(id);
            if (n) {
                modeMap.forEach((_, mode) => {
                    result.push({ node: n, mode });
                });
            }
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

  // Combined Zoom & Resize Stabilization
  useLayoutEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const oldScale = prevEffectiveScaleRef.current;
      const newScale = effectiveScale;
      const oldSize = prevDynamicSizeRef.current;
      const newSize = dynamicSize;

      // Case 1: Zooming (Scale Changed)
      // Keep the center of the viewport focused on the same "world" coordinate
      if (Math.abs(newScale - oldScale) > 0.0001 && oldScale > 0) {
          const viewW = container.clientWidth;
          const viewH = container.clientHeight;
          
          const currentScrollLeft = container.scrollLeft;
          const currentScrollTop = container.scrollTop;
          
          // Pixel center of viewport relative to Top-Left of content (at Old Scale)
          const centerX_px = currentScrollLeft + viewW / 2;
          const centerY_px = currentScrollTop + viewH / 2;
          
          // Relative to the 1/1 Center (at Old Scale)
          // oldSize/2 is the offset of the 1/1 point
          const centerX_rel = centerX_px - (oldSize / 2);
          const centerY_rel = centerY_px - (oldSize / 2);
          
          // Convert to "World Units" (independent of scale)
          const unitsX = centerX_rel / oldScale;
          const unitsY = centerY_rel / oldScale;
          
          // New offsets relative to 1/1 (at New Scale)
          const newCenterX_rel = unitsX * newScale;
          const newCenterY_rel = unitsY * newScale;
          
          // Convert back to pixel coordinates (at New Size)
          const newCenterX_px = newCenterX_rel + (newSize / 2);
          const newCenterY_px = newCenterY_rel + (newSize / 2);
          
          container.scrollLeft = newCenterX_px - viewW / 2;
          container.scrollTop = newCenterY_px - viewH / 2;
      } 
      // Case 2: Resizing / Data Change (Scale constant, but Size changed)
      // Symmetric expansion: Keep 1/1 in relative position (shift scroll by half the growth)
      else if (!isInitialLoad && Math.abs(newSize - oldSize) > 1.0) {
          const diff = (newSize - oldSize) / 2;
          container.scrollLeft += diff;
          container.scrollTop += diff;
      }
      
      prevEffectiveScaleRef.current = newScale;
      prevDynamicSizeRef.current = newSize;
      
      requestAnimationFrame(updateRect);
  }, [effectiveScale, dynamicSize, isInitialLoad]);

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

        setData({ nodes: result.nodes, lines: visibleLines });
        setIsGenerating(false);
    }, 10);
    return () => clearTimeout(timerId);
  }, [generationDeps]); 

  // Audio Latched Nodes Sync
  const prevAudioLatchedRef = useRef<Map<string, NodeActivation[]>>(new Map());
  useEffect(() => {
      const current = audioLatchedNodes;
      const prev = prevAudioLatchedRef.current;
      const nodes = nodeMap;
      
      current.forEach((activations, nodeId) => {
          activations.forEach(act => {
              const voiceId = `node-${nodeId}-${act.mode}`;
              const prevActivations = prev.get(nodeId);
              const wasActive = prevActivations && prevActivations.some(p => p.mode === act.mode);
              
              if (!wasActive) {
                   const node = nodes.get(nodeId); 
                   if (node) {
                       audioEngine.startVoice(voiceId, node.ratio, settings.baseFrequency, act.presetId, 'latch');
                       if (settings.midiEnabled) midiService.noteOn(voiceId, node.ratio, settings.baseFrequency, settings.midiPitchBendRange);
                   }
              }
          });
      });
      
      prev.forEach((activations, nodeId) => {
          activations.forEach(act => {
              const voiceId = `node-${nodeId}-${act.mode}`;
              const currentActivations = current.get(nodeId);
              const stillActive = currentActivations && currentActivations.some(c => c.mode === act.mode);
              if (!stillActive) {
                  audioEngine.stopVoice(voiceId);
                  if (settings.midiEnabled) midiService.noteOff(voiceId);
              }
          });
      });

      prevAudioLatchedRef.current = current;
  }, [audioLatchedNodes, nodeMap, settings.baseFrequency, settings.midiEnabled]);

  useEffect(() => {
    audioEngine.setPolyphony(settings.polyphony);
  }, [settings.polyphony]);

  // --- HIT TEST LOGIC ---
  const getHitNode = (clientX: number, clientY: number): LatticeNode | null => {
      if (!dynamicCanvasRef.current) return null;
      let rect = canvasRectRef.current;
      if (!rect) {
          rect = dynamicCanvasRef.current.getBoundingClientRect();
          canvasRectRef.current = rect;
      }
      
      const bend = globalBendRef.current;
      const pixelOffset = -bend * (PITCH_SCALE / 12) * effectiveScale;

      const x = clientX - rect.left;
      const y = clientY - (rect.top + pixelOffset); 

      const centerOffset = dynamicSizeRef.current / 2;
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
      const latchedMap = visualLatchedRef.current;
      const zoomScale = settingsRef.current.latchedZoomScale;
      
      for(const key of cellsToCheck) {
          const nodesInCell = grid.get(key);
          if (nodesInCell) {
              for (const node of nodesInCell) {
                  const nx = node.x * spacing + centerOffset;
                  const ny = node.y * spacing + centerOffset;
                  const isLatched = latchedMap.has(node.id);
                  const activeZoom = isLatched ? zoomScale : 1.0;
                  const activeRadius = baseRadius * activeZoom;

                  if (x < nx - activeRadius || x > nx + activeRadius || y < ny - activeRadius || y > ny + activeRadius) continue;
                  
                  const dx = x - nx;
                  const dy = y - ny;
                  if (dx*dx + dy*dy < activeRadius*activeRadius) return node;
              }
          }
      }
      return null;
  };

  const getVoiceParams = (mode: number, isStrumEnabled: boolean): { preset: PresetSlot, playback: PlaybackMode } => {
      switch(mode) {
          case 1: return { preset: 'latch', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 2: return { preset: 'normal', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 3: return { preset: 'strum', playback: 'trigger' };
          case 4: return { preset: 'brass', playback: isStrumEnabled ? 'trigger' : 'gate' };
          default: return { preset: 'normal', playback: isStrumEnabled ? 'trigger' : 'gate' };
      }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (audioEngine) audioEngine.resume();
      if (uiUnlocked || !dynamicCanvasRef.current) return;
      
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateRect();

      let canvasPos = { x: e.clientX, y: e.clientY };
      if (scrollContainerRef.current) {
          const r = scrollContainerRef.current.getBoundingClientRect();
          const bend = globalBendRef.current;
          const pixelOffset = -bend * (PITCH_SCALE / 12) * effectiveScale;
          canvasPos = {
              x: (e.clientX - r.left) + scrollContainerRef.current.scrollLeft,
              y: (e.clientY - r.top) + scrollContainerRef.current.scrollTop - pixelOffset
          };
      }
      cursorPositionsRef.current.set(e.pointerId, canvasPos);

      const hitNode = getHitNode(e.clientX, e.clientY);
      const nodeId = hitNode ? hitNode.id : null;

      if (hitNode) {
        nodeTriggerHistory.current.set(hitNode.id, Date.now());
        const topLayer = settings.layerOrder[settings.layerOrder.length - 1];
        if (hitNode.maxPrime !== topLayer) onLimitInteraction(hitNode.maxPrime);
        lastTouchedLimitRef.current = hitNode.maxPrime;

        if (onNodeTrigger) onNodeTrigger(hitNode.id, hitNode.ratio, hitNode.n, hitNode.d, hitNode.maxPrime);

        const isSustainingInstrument = latchMode === 1 || latchMode === 2 || latchMode === 4;
        const isSustainActive = isCurrentSustainEnabled;
        const isBendEnabled = settings.isPitchBendEnabled && latchMode !== 3; 

        if (isSustainingInstrument && isSustainActive) {
             setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                 const next = new Map(prev);
                 const nodeModes = next.get(hitNode.id) || new Map<number, number>();
                 if (nodeModes.has(latchMode)) nodeModes.delete(latchMode);
                 else nodeModes.set(latchMode, Date.now());
                 if (nodeModes.size > 0) next.set(hitNode.id, nodeModes);
                 else next.delete(hitNode.id);
                 return next;
             });
        }

        if (isBendEnabled || !isSustainActive || latchMode === 3) {
             const newCursor: ActiveCursor = {
                pointerId: e.pointerId,
                originNodeId: nodeId, 
                hoverNodeId: nodeId,
                hasMoved: false,
                interactionLockedNodeId: null
            };
            
            const nextRef = new Map(activeCursorsRef.current);
            nextRef.set(e.pointerId, newCursor);
            activeCursorsRef.current = nextRef;

            setActiveCursors(prev => {
                const next = new Map(prev);
                next.set(e.pointerId, newCursor);
                return next;
            });

            const { preset, playback } = getVoiceParams(latchMode, settings.isStrumEnabled);
            const voiceId = `cursor-${e.pointerId}-${hitNode.id}`;
            audioEngine.startVoice(voiceId, hitNode.ratio, settings.baseFrequency, preset, playback);
            if (settings.midiEnabled) midiService.noteOn(voiceId, hitNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);
        }
      } else {
          const newCursor: ActiveCursor = { pointerId: e.pointerId, originNodeId: null, hoverNodeId: null, hasMoved: false, interactionLockedNodeId: null };
          setActiveCursors(prev => { const next = new Map(prev); next.set(e.pointerId, newCursor); return next; });
          activeCursorsRef.current.set(e.pointerId, newCursor);
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (uiUnlocked) return;
    if (!activeCursorsRef.current.has(e.pointerId)) return;

    const cursor = activeCursorsRef.current.get(e.pointerId)!;
    
    let canvasPos = { x: e.clientX, y: e.clientY };
    if (scrollContainerRef.current) {
        const r = scrollContainerRef.current.getBoundingClientRect();
        const bend = globalBendRef.current;
        const pixelOffset = -bend * (PITCH_SCALE / 12) * effectiveScale;
        canvasPos = {
            x: (e.clientX - r.left) + scrollContainerRef.current.scrollLeft,
            y: (e.clientY - r.top) + scrollContainerRef.current.scrollTop - pixelOffset
        };
    }
    const prevPos = cursorPositionsRef.current.get(e.pointerId);
    cursorPositionsRef.current.set(e.pointerId, canvasPos);
    
    let hasMoved = cursor.hasMoved;
    if (!hasMoved && prevPos) {
        const dx = Math.abs(canvasPos.x - prevPos.x);
        const dy = Math.abs(canvasPos.y - prevPos.y);
        if (dx > 2 || dy > 2) hasMoved = true;
    }

    const hitNode = getHitNode(e.clientX, e.clientY);
    const hitId = hitNode ? hitNode.id : null;
    const { playback } = getVoiceParams(latchMode, settingsRef.current.isStrumEnabled);
    const isBendEnabled = settingsRef.current.isPitchBendEnabled && latchMode !== 3; 
    const isBending = isBendEnabled && !!cursor.originNodeId;

    if (isBending && dynamicCanvasRef.current) {
         const centerOffset = dynamicSizeRef.current / 2;
         const rect = canvasRectRef.current || dynamicCanvasRef.current.getBoundingClientRect();
         const bend = globalBendRef.current;
         const pixelOffset = -bend * (PITCH_SCALE / 12) * effectiveScale; 
         const originNode = nodeMapRef.current.get(cursor.originNodeId!);
         
         if (originNode) {
             const spacing = settingsRef.current.buttonSpacingScale * effectiveScale;
             const originScreenY = (rect.top + pixelOffset) + (originNode.y * spacing) + centerOffset;
             const currentDeltaY = e.clientY - originScreenY;
             const bentRatio = getPitchRatioFromScreenDelta(currentDeltaY, settingsRef.current.buttonSpacingScale * effectiveScale);
             const finalRatio = originNode.ratio * bentRatio;
             
             const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
             audioEngine.glideVoice(voiceId, finalRatio, settingsRef.current.baseFrequency);
             if (settingsRef.current.midiEnabled) midiService.pitchBend(voiceId, finalRatio, settingsRef.current.baseFrequency, settingsRef.current.midiPitchBendRange);
         }
    }

    let nextInteractionLock = cursor.interactionLockedNodeId;
    let shouldUpdateState = false;

    if (hitNode && latchMode !== 3 && isCurrentSustainEnabled && isBendEnabled) {
         if (cursor.interactionLockedNodeId !== hitNode.id) {
             const currentModes = persistentLatchesRef.current.get(hitNode.id);
             const isAlreadyLatched = currentModes && currentModes.has(latchMode);
             if (!isAlreadyLatched) {
                 setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                     const next = new Map(prev);
                     const nodeModes = next.get(hitNode.id) || new Map<number, number>();
                     nodeModes.set(latchMode, Date.now());
                     next.set(hitNode.id, nodeModes);
                     return next;
                 });
                 nodeTriggerHistory.current.set(hitNode.id, Date.now());
                 nextInteractionLock = hitNode.id;
                 shouldUpdateState = true;
             }
         }
    }

    if (cursor.hoverNodeId !== hitId) {
        shouldUpdateState = true;
        nextInteractionLock = null;
        const isLeavingOrigin = cursor.hoverNodeId === cursor.originNodeId;
        const shouldSustainBend = isBending && isLeavingOrigin;

        if (!shouldSustainBend && cursor.hoverNodeId) {
             if (playback === 'gate') {
                 const oldVoiceId = `cursor-${e.pointerId}-${cursor.hoverNodeId}`;
                 audioEngine.stopVoice(oldVoiceId);
                 if (settingsRef.current.midiEnabled) midiService.noteOff(oldVoiceId);
             }
        }

        if (hitNode) {
             const topLayer = settingsRef.current.layerOrder[settingsRef.current.layerOrder.length - 1];
             if (hitNode.maxPrime !== topLayer) onLimitInteraction(hitNode.maxPrime);
             
             const isSustainingInstrument = latchMode === 1 || latchMode === 2 || latchMode === 4;
             if (isSustainingInstrument && isCurrentSustainEnabled && !isBendEnabled) {
                const isDifferentNode = hitNode.id !== cursor.originNodeId;
                if (hasMoved || isDifferentNode) {
                    const currentModes = persistentLatchesRef.current.get(hitNode.id);
                    const isAlreadyLatched = currentModes && currentModes.has(latchMode);
                    if (!isAlreadyLatched) { 
                        setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                            const next = new Map(prev);
                            const nodeModes = next.get(hitNode.id) || new Map<number, number>();
                            nodeModes.set(latchMode, Date.now());
                            next.set(hitNode.id, nodeModes);
                            return next;
                        });
                        nodeTriggerHistory.current.set(hitNode.id, Date.now());
                    }
                }
             } 
             else if (!isBending) {
                 nodeTriggerHistory.current.set(hitNode.id, Date.now());
                 const { preset, playback } = getVoiceParams(latchMode, settingsRef.current.isStrumEnabled);
                 const voiceId = `cursor-${e.pointerId}-${hitNode.id}`;
                 audioEngine.startVoice(voiceId, hitNode.ratio, settingsRef.current.baseFrequency, preset, playback);
                 if (settingsRef.current.midiEnabled) midiService.noteOn(voiceId, hitNode.ratio, settingsRef.current.baseFrequency, settingsRef.current.midiPitchBendRange);
             }
        }
    }

    if (shouldUpdateState || (hasMoved !== cursor.hasMoved)) {
        const updatedCursor = { ...cursor, hoverNodeId: hitId, hasMoved: hasMoved, interactionLockedNodeId: nextInteractionLock };
        activeCursorsRef.current.set(e.pointerId, updatedCursor);
        setActiveCursors(prev => { const next = new Map(prev); next.set(e.pointerId, updatedCursor); return next; });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeCursorsRef.current.has(e.pointerId)) {
        const cursor = activeCursorsRef.current.get(e.pointerId)!;
        const { playback } = getVoiceParams(latchMode, settingsRef.current.isStrumEnabled);
        const isBendEnabled = settingsRef.current.isPitchBendEnabled && latchMode !== 3; 

        if (cursor.originNodeId && isBendEnabled) {
            const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
            audioEngine.stopVoice(voiceId);
            if (settingsRef.current.midiEnabled) midiService.noteOff(voiceId);
        }
        else if (cursor.hoverNodeId) {
             if (playback === 'gate') {
                 const voiceId = `cursor-${e.pointerId}-${cursor.hoverNodeId}`;
                 audioEngine.stopVoice(voiceId);
                 if (settingsRef.current.midiEnabled) midiService.noteOff(voiceId);
             }
        }
        
        cursorPositionsRef.current.delete(e.pointerId);
        const nextRef = new Map(activeCursorsRef.current);
        nextRef.delete(e.pointerId);
        activeCursorsRef.current = nextRef;
        setActiveCursors(prev => { const next = new Map(prev); next.delete(e.pointerId); return next; });
    }
  };

  const render = (time: number) => {
      const bgCanvas = bgLineCanvasRef.current;
      const staticCanvas = staticCanvasRef.current;
      const activeCanvas = dynamicCanvasRef.current;
      const wrapper = wrapperRef.current;
      const scroller = scrollContainerRef.current;
      const currentScale = effectiveScaleRef.current; 

      if (wrapper) {
          const bend = globalBendRef.current;
          const pixelOffset = -bend * (PITCH_SCALE / 12) * currentScale;
          const transform = `translate3d(0px, ${pixelOffset}px, 0px)`;
          wrapper.style.transform = transform;
      }

      if (!bgCanvas || !staticCanvas || !activeCanvas || !scroller) {
           animationFrameRef.current = requestAnimationFrame(render);
           return;
      }
      
      const viewX = scroller.scrollLeft;
      const viewY = scroller.scrollTop;
      const viewW = scroller.clientWidth;
      const viewH = scroller.clientHeight;

      rendererRef.current.render(
          bgCanvas, staticCanvas, activeCanvas,
          {
              data: dataRef.current,
              settings: settingsRef.current,
              visualLatchedNodes: visualLatchedRef.current, 
              activeLines: activeLinesRef.current,
              brightenedLines: brightenedLinesRef.current,
              activeCursors: activeCursorsRef.current,
              cursorPositions: cursorPositionsRef.current,
              nodeTriggerHistory: nodeTriggerHistory.current,
              globalBend: globalBendRef.current,
              effectiveScale: effectiveScaleRef.current,
              dynamicSize: dynamicSizeRef.current,
              view: { x: viewX, y: viewY, w: viewW, h: viewH },
              time: time,
              latchMode: latchModeRef.current
          }
      );
      animationFrameRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const backgroundStyle = useMemo(() => {
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
              const period = getRainbowPeriod(settings.buttonSpacingScale * effectiveScale);
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
                  const bgSize = settings.backgroundTiling 
                      ? `${500 * effectiveScale}px` 
                      : `${2500 * effectiveScale}px`; 
                  return { 
                      ...baseStyle, 
                      backgroundImage: `url(${settings.backgroundImageData})`, 
                      backgroundRepeat: settings.backgroundTiling ? 'repeat' : 'no-repeat', 
                      backgroundSize: bgSize, 
                      backgroundPosition: `center calc(50% + ${offset}px)` 
                  };
              }
              return { ...baseStyle, backgroundColor: 'black' };
          default: return { ...baseStyle, backgroundColor: 'black' };
      }
  }, [settings.backgroundMode, settings.backgroundYOffset, settings.tuningSystem, settings.layoutApproach, settings.rainbowOffset, settings.rainbowSaturation, settings.rainbowBrightness, settings.backgroundImageData, settings.backgroundTiling, settings.buttonSpacingScale, dynamicSize, effectiveScale, uiUnlocked]);

  return (
    <div ref={scrollContainerRef} className="w-full h-full overflow-auto bg-slate-950 relative" style={{ touchAction: 'none' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onPointerCancel={handlePointerUp}>
        <div ref={wrapperRef} className="relative" style={backgroundStyle}>
           <canvas ref={bgLineCanvasRef} className="absolute top-0 left-0 z-[5] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           <canvas ref={staticCanvasRef} className="absolute top-0 left-0 z-[10] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           <canvas ref={dynamicCanvasRef} className="absolute top-0 left-0 z-[20] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           {isGenerating && (<div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/80 p-2 rounded-full backdrop-blur-sm border border-white/10 shadow-xl"><svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="text-xs font-bold text-slate-300 pr-2">Calculating...</span></div>)}
        </div>
    </div>
  );
});

export default React.memo(TonalityDiamond);
