
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine, ButtonShape, PresetSlot, PlaybackMode, LimitType, SynthPreset, GenerationOrigin } from '../types';
import { getPitchRatioFromScreenDelta, PITCH_SCALE } from '../services/ProjectionService';
import AudioEngine from '../services/AudioEngine';
import { midiService } from '../services/MidiService';
import { LatticeRenderer, RenderState } from '../services/LatticeRenderer';
import { useLatticeData } from '../hooks/useLatticeData';
import { GRID_CELL_SIZE } from '../constants';
import { reconstructNode } from '../services/LatticeService';

export interface TonalityDiamondHandle {
  clearLatches: (mode?: number) => void;
  centerView: () => void;
  increaseDepth: () => void;
  decreaseDepth: () => void;
  getLatchedNodes: () => { node: LatticeNode, mode: number }[];
  triggerVisual: (nodeId: string, active: boolean) => void; 
}

interface Props {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void;
  audioEngine: AudioEngine;
  onLimitInteraction: (limit: number) => void;
  activeChordIds: string[];
  uiUnlocked: boolean;
  latchMode: 0 | 1 | 2 | 3 | 4 | 5 | 6; 
  isCurrentSustainEnabled: boolean;
  globalScale?: number; 
  viewZoom?: number;
  onNodeTrigger?: (nodeId: string, ratio: number, n?: number, d?: number, limit?: number) => void;
  onSustainStatusChange?: (activeModes: number[]) => void;
  onClearActiveChords?: () => void;
}

interface ActiveCursor {
  pointerId: number;
  originNodeId: string | null; 
  hoverNodeId: string | null;
  hasMoved: boolean;
  interactionLockedNodeId: string | null;
  isShiftAnchor?: boolean; 
  pendingUnlatch?: boolean; 
}

interface NodeActivation {
    mode: number | string; 
    timestamp: number;
    presetId: string;
}

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, updateSettings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked, latchMode, isCurrentSustainEnabled, globalScale = 1.0, viewZoom = 1.0, onNodeTrigger, onSustainStatusChange, onClearActiveChords } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bgLineCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null); 
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null); 
  const canvasRectRef = useRef<DOMRect | null>(null);

  const animationFrameRef = useRef<number>(0);
  const globalBendRef = useRef<number>(0);
  const rendererRef = useRef<LatticeRenderer>(new LatticeRenderer());

  const effectiveScale = globalScale * viewZoom;
  const prevEffectiveScaleRef = useRef(effectiveScale);

  // --- USE LATTICE DATA HOOK ---
  const {
      data,
      isGenerating,
      nodeMap,
      spatialGrid,
      adjacencyMap,
      dynamicSize,
      centerOffset
  } = useLatticeData(settings, effectiveScale);

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevDynamicSizeRef = useRef(dynamicSize);
  
  // OPTIMIZATION: activeCursors moved to Ref only to prevent re-renders on every move
  const activeCursorsRef = useRef<Map<number, ActiveCursor>>(new Map());
  const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const lastBendUpdateRef = useRef<number>(0); // For throttling glide messages

  const [persistentLatches, setPersistentLatches] = useState<Map<string, Map<number, number>>>(new Map());
  const [shiftingNodeIds, setShiftingNodeIds] = useState<Set<string>>(new Set()); 
  const [externalTriggers, setExternalTriggers] = useState<Map<string, number>>(new Map()); 
  const nodeTriggerHistory = useRef<Map<string, number>>(new Map());

  // Visual Cache Refs (Dirty Flag Pattern)
  const visualsDirtyRef = useRef(true);
  const cachedVisualLatchedNodes = useRef<Map<string, NodeActivation[]>>(new Map());
  const cachedActiveLines = useRef<any[]>([]);
  const cachedBrightenedLines = useRef<any[]>([]);
  const cachedShiftGhostNodes = useRef<Map<string, LatticeNode>>(new Map());
  const cachedHarmonicNeighbors = useRef<Map<string, number>>(new Map());

  // --- GROUPING STATE FOR INDEPENDENT SHIFTING ---
  const [nodeGroups, setNodeGroups] = useState<Map<string, string>>(new Map());
  const activeGroupId = useRef<string>(`group-${Date.now()}`);

  useEffect(() => {
      if (!settings.isShiftModeActive) {
          activeGroupId.current = `group-${Date.now()}`;
      }
  }, [settings.isShiftModeActive]);

  const transferredVoicesRef = useRef<Set<string>>(new Set());
  const isSustainEnabledRef = useRef(isCurrentSustainEnabled);
  useEffect(() => { isSustainEnabledRef.current = isCurrentSustainEnabled; }, [isCurrentSustainEnabled]);

  const shiftingNodeIdsRef = useRef(shiftingNodeIds);
  useEffect(() => { shiftingNodeIdsRef.current = shiftingNodeIds; visualsDirtyRef.current = true; }, [shiftingNodeIds]);

  // Mark visuals dirty when key props change
  useEffect(() => { visualsDirtyRef.current = true; }, [
      persistentLatches, activeChordIds, externalTriggers, latchMode, isCurrentSustainEnabled, 
      settings.voiceLeadingSteps, settings.lineBrighteningEnabled, settings.isShiftModeActive, settings.limitVisuals
  ]);

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
              setNodeGroups(prev => {
                  const next = new Map(prev);
                  if (next.has(nodeId)) {
                      next.delete(nodeId);
                      return next;
                  }
                  return prev;
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
              if (chord.soundConfig) audioEngine.registerPreset(`chord-${id}`, chord.soundConfig);
              if (chord.soundConfigs) {
                  Object.entries(chord.soundConfigs).forEach(([mode, preset]) => {
                      const p = preset as SynthPreset;
                      if (!p) return;
                      const safeId = p.id && String(p.id).startsWith('chord-') 
                          ? String(p.id) 
                          : `chord-${id}-${mode}`;
                      audioEngine.registerPreset(safeId, p);
                  });
              }
          }
      });
  }, [activeChordIds, settings.savedChords, audioEngine]);

  // Aggregates all activations
  const audioLatchedNodes = useMemo(() => {
      const effective = new Map<string, NodeActivation[]>();
      
      persistentLatches.forEach((modeMap, nodeId) => {
          const activations: NodeActivation[] = [];
          modeMap.forEach((timestamp, mode) => {
              let pId = 'normal';
              if (mode === 1) pId = 'latch';
              else if (mode === 3) pId = 'strum';
              else if (mode === 4) pId = 'brass';
              else if (mode === 5) pId = 'keys';
              else if (mode === 6) pId = 'percussion';
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
                    else if (n.voiceMode === 'keys') mode = 5;
                    else if (n.voiceMode === 'percussion') mode = 6;

                    if (chordDef.soundConfigs && chordDef.soundConfigs[n.voiceMode]) {
                        const specificPreset = chordDef.soundConfigs[n.voiceMode];
                        if (specificPreset?.id && String(specificPreset.id).startsWith('chord-')) {
                            presetId = String(specificPreset.id);
                        } else {
                            presetId = `chord-${chordId}-${n.voiceMode}`;
                        }
                    }
                    else if (chordDef.soundConfig) presetId = `chord-${chordId}`;
                    else presetId = n.voiceMode;
                } else {
                    if (chordDef.soundConfig) presetId = `chord-${chordId}`;
                    else presetId = (latchMode === 2) ? 'normal' : 'latch';
                }

                if (!effective.has(n.id)) effective.set(n.id, []);
                const existing = effective.get(n.id)!;
                if (!existing.some(a => a.mode === mode)) existing.push({ mode, timestamp: 0, presetId });
            });
        }
      });
      effective.forEach((list) => list.sort((a, b) => a.timestamp - b.timestamp));
      return effective;
  }, [persistentLatches, activeChordIds, settings.savedChords, latchMode]);

  // Identify nodes that are active but not present in the current lattice generation (Phantoms)
  const phantomNodes = useMemo(() => {
      const phantoms = new Map<string, LatticeNode>();
      audioLatchedNodes.forEach((_, id) => {
          if (!nodeMap.has(id)) {
              const node = reconstructNode(id, settings);
              if (node) phantoms.set(id, node);
          }
      });
      // Note: We check activeCursors in the render loop now for phantoms to avoid state dep
      return phantoms;
  }, [audioLatchedNodes, nodeMap, settings]);

  // Refs for Render Loop
  const settingsRef = useRef(settings);
  const dataRef = useRef(data);
  const effectiveScaleRef = useRef(effectiveScale);
  const latchModeRef = useRef(latchMode);
  const nodeMapRef = useRef(nodeMap);
  const spatialGridRef = useRef(spatialGrid);
  const persistentLatchesRef = useRef<Map<string, Map<number, number>>>(persistentLatches);
  const audioLatchedNodesRef = useRef(audioLatchedNodes);
  const centerOffsetRef = useRef(centerOffset);
  const nodeGroupsRef = useRef(nodeGroups);
  const phantomNodesRef = useRef(phantomNodes);
  const adjacencyMapRef = useRef(adjacencyMap);

  useLayoutEffect(() => { settingsRef.current = settings; }, [settings]);
  useLayoutEffect(() => { dataRef.current = data; }, [data]);
  useLayoutEffect(() => { effectiveScaleRef.current = effectiveScale; }, [effectiveScale]);
  useLayoutEffect(() => { latchModeRef.current = latchMode; }, [latchMode]);
  useLayoutEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
  useLayoutEffect(() => { spatialGridRef.current = spatialGrid; }, [spatialGrid]);
  useLayoutEffect(() => { persistentLatchesRef.current = persistentLatches; }, [persistentLatches]);
  useLayoutEffect(() => { audioLatchedNodesRef.current = audioLatchedNodes; }, [audioLatchedNodes]);
  useLayoutEffect(() => { centerOffsetRef.current = centerOffset; }, [centerOffset]);
  useLayoutEffect(() => { nodeGroupsRef.current = nodeGroups; }, [nodeGroups]);
  useLayoutEffect(() => { phantomNodesRef.current = phantomNodes; }, [phantomNodes]);
  useLayoutEffect(() => { adjacencyMapRef.current = adjacencyMap; }, [adjacencyMap]);
  
  const lastTouchedLimitRef = useRef<number | null>(null);
  const depthHistoryRef = useRef<number[]>([]);

  const updateRect = () => {
      if (scrollContainerRef.current) {
          canvasRectRef.current = scrollContainerRef.current.getBoundingClientRect();
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

  // --- DERIVED CALCULATIONS (Moved out of React State for Performance) ---
  
  const updateVisualState = () => {
      const activeCursors = activeCursorsRef.current;
      const audioLatched = audioLatchedNodesRef.current;
      const nodeMap = nodeMapRef.current;
      const phantoms = phantomNodesRef.current;
      const settings = settingsRef.current;
      const mode = latchModeRef.current;
      const isSustainActive = isSustainEnabledRef.current;
      const lines = dataRef.current.lines;
      const adjacency = adjacencyMapRef.current;

      // 1. Calculate Visual Latched Nodes
      const visual = new Map<string, NodeActivation[]>();
      audioLatched.forEach((v, k) => visual.set(k, [...v]));

      activeCursors.forEach(cursor => {
          const isSustainingInstrument = mode >= 1; 
          const isBendEnabled = settings.isPitchBendEnabled;
          const isShiftMode = settings.isShiftModeActive;
          const isModulating = settings.isModulationModeActive;
          
          if (isModulating) return;

          const showCursor = !isShiftMode && (isBendEnabled || !isSustainingInstrument || !isSustainActive || cursor.isShiftAnchor);

          if (showCursor && cursor.hoverNodeId) {
              const nodeId = cursor.hoverNodeId;
              if (!visual.has(nodeId)) visual.set(nodeId, []);
              const list = visual.get(nodeId)!;
              const activation = { mode: mode, timestamp: Date.now(), presetId: 'cursor' };
              list.push(activation);
          }
      });

      // Add Phantoms from cursors if missing
      activeCursors.forEach(cursor => {
          if (cursor.hoverNodeId && !nodeMap.has(cursor.hoverNodeId) && !phantoms.has(cursor.hoverNodeId)) {
              const node = reconstructNode(cursor.hoverNodeId, settings);
              if (node) phantoms.set(cursor.hoverNodeId, node);
          }
      });

      cachedVisualLatchedNodes.current = visual;

      // 2. Calculate Active Lines
      const activeLinesArr: any[] = [];
      const reach = settings.voiceLeadingSteps || 1;
      
      if (visual.size >= 2) {
          if (reach === 1) {
              for (const line of lines) {
                  if (visual.has(line.sourceId) && visual.has(line.targetId)) activeLinesArr.push(line);
              }
          } 
          else if (reach === 2) {
              const activeNodes = Array.from(visual.keys()).map(id => nodeMap.get(id) || phantoms.get(id)).filter(n => n) as LatticeNode[];
              for (let i=0; i<activeNodes.length; i++) {
                  for (let j=i+1; j<activeNodes.length; j++) {
                      const A = activeNodes[i];
                      const B = activeNodes[j];
                      let coordDist = 0;
                      for (let k=0; k < A.coords.length; k++) coordDist += Math.abs(A.coords[k] - B.coords[k]);
                      const octaveDist = Math.abs(A.octave - B.octave);
                      const totalDist = coordDist + octaveDist;

                      if (totalDist <= 2) {
                          let lineLimit = Math.max(A.maxPrime, B.maxPrime);
                          if (coordDist === 0 && octaveDist !== 0) lineLimit = LimitType.LIMIT_2;
                          activeLinesArr.push({
                              id: `${A.id}-${B.id}`,
                              x1: A.x, y1: A.y, x2: B.x, y2: B.y,
                              limit: lineLimit, 
                              sourceId: A.id, targetId: B.id
                          });
                      }
                  }
              }
          }
      }
      cachedActiveLines.current = activeLinesArr;

      // 3. Brightened Lines
      const brightLinesArr: any[] = [];
      if (settings.lineBrighteningEnabled && visual.size > 0) {
          const activeIds = new Set(visual.keys());
          const resultSet = new Set<any>();
          const step1Neighbors = new Set<string>();

          lines.forEach(line => {
              if (activeIds.has(line.sourceId) || activeIds.has(line.targetId)) {
                  resultSet.add(line);
                  if (activeIds.has(line.sourceId)) step1Neighbors.add(line.targetId);
                  if (activeIds.has(line.targetId)) step1Neighbors.add(line.sourceId);
              }
          });

          if (settings.lineBrighteningSteps === 2) {
              lines.forEach(line => {
                  if (resultSet.has(line)) return;
                  if (step1Neighbors.has(line.sourceId) || step1Neighbors.has(line.targetId)) resultSet.add(line);
              });
          }
          brightLinesArr.push(...Array.from(resultSet));
      }
      cachedBrightenedLines.current = brightLinesArr;

      // 4. Shift Ghosts
      const ghosts = new Map<string, LatticeNode>();
      if (settings.isShiftModeActive) {
          let anchorCursor: ActiveCursor | null = null;
          for (const c of activeCursors.values()) {
              if (c.isShiftAnchor && c.originNodeId && c.hoverNodeId) {
                  anchorCursor = c;
                  break;
              }
          }

          if (anchorCursor && anchorCursor.originNodeId && anchorCursor.hoverNodeId) {
              const anchorNode = nodeMap.get(anchorCursor.originNodeId) || phantoms.get(anchorCursor.originNodeId);
              const targetNode = nodeMap.get(anchorCursor.hoverNodeId) || phantoms.get(anchorCursor.hoverNodeId);

              if (anchorNode && targetNode) {
                  const transpositionRatio = targetNode.ratio / anchorNode.ratio;
                  const diffCoords = targetNode.coords.map((c, i) => c - (anchorNode.coords[i] || 0));

                  shiftingNodeIdsRef.current.forEach((sourceId) => {
                      const sourceNode = nodeMap.get(sourceId) || phantoms.get(sourceId);
                      if (sourceNode) {
                          const maxLength = Math.max(sourceNode.coords.length, diffCoords.length);
                          const newCoords: number[] = [];
                          for(let i=0; i<maxLength; i++) {
                              const val = (sourceNode.coords[i] || 0) + (diffCoords[i] || 0);
                              newCoords.push(val);
                          }
                          const tempId = `${newCoords.join(',')}:0`;
                          const tempNode = reconstructNode(tempId, settings);
                          if (tempNode) {
                              const normalizedBaseRatio = tempNode.ratio;
                              const idealRatio = sourceNode.ratio * transpositionRatio;
                              const neededOctave = Math.round(Math.log2(idealRatio / normalizedBaseRatio));
                              const newId = `${newCoords.join(',')}:${neededOctave}`;
                              const existing = nodeMap.get(newId);
                              if (existing) ghosts.set(newId, existing);
                              else {
                                  const ghost = reconstructNode(newId, settings);
                                  if (ghost) ghosts.set(newId, ghost);
                              }
                          }
                      }
                  });
              }
          }
      }
      cachedShiftGhostNodes.current = ghosts;
  };

  useImperativeHandle(ref, () => ({
    clearLatches: (mode?: number) => {
        if (mode === undefined) {
            setPersistentLatches(new Map());
            setNodeGroups(new Map());
        }
        else {
            setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                const next = new Map();
                const nodeIdsToRemove: string[] = [];
                prev.forEach((modeMap, nodeId) => {
                    const newModeMap = new Map(modeMap);
                    if (newModeMap.has(mode)) newModeMap.delete(mode);
                    if (newModeMap.size > 0) next.set(nodeId, newModeMap);
                    else nodeIdsToRemove.push(nodeId);
                });
                
                if (nodeIdsToRemove.length > 0) {
                    setNodeGroups(gPrev => {
                        const gNext = new Map(gPrev);
                        nodeIdsToRemove.forEach(id => gNext.delete(id));
                        return gNext;
                    });
                }
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
            const n = nodeMap.get(id) || phantomNodes.get(id);
            if (n) {
                modeMap.forEach((_, mode) => result.push({ node: n, mode }));
            }
        });
        return result;
    },
    triggerVisual: (nodeId: string, active: boolean) => {
        setExternalTriggers(prev => {
            const next = new Map(prev);
            if (active) next.set(nodeId, Date.now());
            else next.delete(nodeId);
            return next;
        });
    }
  }));

  const centerScroll = () => {
      if (scrollContainerRef.current) {
        const viewportW = scrollContainerRef.current.clientWidth;
        const viewportH = scrollContainerRef.current.clientHeight;
        scrollContainerRef.current.scrollLeft = centerOffset - viewportW / 2;
        scrollContainerRef.current.scrollTop = centerOffset - viewportH / 2;
        requestAnimationFrame(updateRect);
      }
  };

  useEffect(() => {
      if (isInitialLoad && !isGenerating && data.nodes.length > 0) {
          requestAnimationFrame(centerScroll);
          setIsInitialLoad(false);
      }
  }, [isGenerating, data.nodes.length, isInitialLoad]);

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

  useLayoutEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const oldScale = prevEffectiveScaleRef.current;
      const newScale = effectiveScale;

      if (oldScale !== newScale && oldScale > 0) {
          const viewW = container.clientWidth;
          const viewH = container.clientHeight;
          
          const oldSpacing = settingsRef.current.buttonSpacingScale * oldScale;
          const newSpacing = settingsRef.current.buttonSpacingScale * newScale;

          const currentScrollLeft = container.scrollLeft;
          const currentScrollTop = container.scrollTop;

          const centerX_from_origin = (currentScrollLeft + viewW / 2) - centerOffset;
          const centerY_from_origin = (currentScrollTop + viewH / 2) - centerOffset;

          const normX = centerX_from_origin / oldSpacing;
          const normY = centerY_from_origin / oldSpacing;

          const newCenterX_from_origin = normX * newSpacing;
          const newCenterY_from_1_1 = normY * newSpacing;

          container.scrollLeft = (newCenterX_from_origin + centerOffset) - viewW / 2;
          container.scrollTop = (newCenterY_from_1_1 + centerOffset) - viewH / 2;
          
          requestAnimationFrame(updateRect);
      }
      
      prevEffectiveScaleRef.current = newScale;
  }, [effectiveScale]);

  
  const prevAudioLatchedRef = useRef<Map<string, NodeActivation[]>>(new Map());
  useEffect(() => {
      const current = audioLatchedNodes;
      const prev = prevAudioLatchedRef.current;
      const nodes = nodeMap;
      const phantoms = phantomNodes;
      
      current.forEach((activations, nodeId) => {
          activations.forEach(act => {
              const voiceId = `node-${nodeId}-${act.mode}`;
              const prevActivations = prev.get(nodeId);
              const wasActive = prevActivations && prevActivations.some(p => p.mode === act.mode);
              
              if (!wasActive) {
                   if (transferredVoicesRef.current.has(voiceId)) {
                       transferredVoicesRef.current.delete(voiceId);
                   } else {
                       const node = nodes.get(nodeId) || phantoms.get(nodeId); 
                       if (node) {
                           audioEngine.startVoice(voiceId, node.ratio, settings.baseFrequency, act.presetId, 'latch');
                           if (settings.midiEnabled) midiService.noteOn(voiceId, node.ratio, settings.baseFrequency, settings.midiPitchBendRange);
                       }
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
  }, [audioLatchedNodes, nodeMap, phantomNodes, settings.baseFrequency, settings.midiEnabled]);

  useEffect(() => {
    audioEngine.setPolyphony(settings.polyphony);
  }, [settings.polyphony]);

  // Helper to extract full latch map including active chords
  const getAllLatchesAsMap = () => {
      const map = new Map<string, Map<number, number>>();
      audioLatchedNodesRef.current.forEach((activations, nodeId) => {
          const modeMap = new Map<number, number>();
          activations.forEach(a => {
              if (typeof a.mode === 'number') {
                  modeMap.set(a.mode, a.timestamp);
              }
          });
          if (modeMap.size > 0) map.set(nodeId, modeMap);
      });
      return map;
  };

  // Reusable hit test logic
  const findNodeAtPosition = (clientX: number, clientY: number, fuzzy: boolean = false): LatticeNode | null => {
      if (!scrollContainerRef.current) return null;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const bend = globalBendRef.current;
      const pixelOffset = -bend * (PITCH_SCALE / 12) * effectiveScale;
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const scrollTop = scrollContainerRef.current.scrollTop;

      const viewportX = clientX - rect.left;
      const viewportY = clientY - rect.top;

      const x = viewportX + scrollLeft;
      const y = (viewportY - pixelOffset) + scrollTop;

      const spacing = settingsRef.current.buttonSpacingScale * effectiveScale;
      const baseRadius = (60 * settingsRef.current.buttonSizeScale * effectiveScale) / 2;
      
      const hitRadius = fuzzy ? spacing * 0.6 : baseRadius * settingsRef.current.latchedZoomScale;
      const hitDistSq = hitRadius * hitRadius;

      const col = Math.floor(x / GRID_CELL_SIZE);
      const row = Math.floor(y / GRID_CELL_SIZE);
      
      const cellsToCheck = [
          `${col},${row}`, `${col+1},${row}`, `${col-1},${row}`,
          `${col},${row+1}`, `${col},${row-1}`,
          `${col+1},${row+1}`, `${col-1},${row-1}`,
          `${col+1},${row-1}`, `${col-1},${row+1}`
      ];
      
      const grid = spatialGridRef.current;
      const center = centerOffsetRef.current;

      for(const key of cellsToCheck) {
          const nodesInCell = grid.get(key);
          if (nodesInCell) {
              for (const node of nodesInCell) {
                  const nx = node.x * spacing + center;
                  const ny = node.y * spacing + center;
                  const dx = x - nx;
                  const dy = y - ny;
                  if (dx*dx + dy*dy < hitDistSq) return node;
              }
          }
      }

      for (const node of phantomNodesRef.current.values()) {
          const nx = node.x * spacing + center;
          const ny = node.y * spacing + center;
          const dx = x - nx;
          const dy = y - ny;
          if (dx*dx + dy*dy < hitDistSq) return node;
      }

      return null;
  };

  const getVoiceParams = (mode: number, isStrumEnabled: boolean): { preset: PresetSlot, playback: PlaybackMode } => {
      switch(mode) {
          case 1: return { preset: 'latch', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 2: return { preset: 'normal', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 3: return { preset: 'strum', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 4: return { preset: 'brass', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 5: return { preset: 'keys', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 6: return { preset: 'percussion', playback: isStrumEnabled ? 'trigger' : 'gate' };
          default: return { preset: 'normal', playback: isStrumEnabled ? 'trigger' : 'gate' };
      }
  };

  const triggerModulation = (node: LatticeNode) => {
        const newOrigin: GenerationOrigin = {
            coords: node.coords,
            octave: node.octave
        };
        const newPath = [...settingsRef.current.modulationPath, newOrigin];
        updateSettings({ modulationPath: newPath, isModulationModeActive: false });
  };

  const executeShift = (
      anchorNode: LatticeNode, 
      targetNode: LatticeNode, 
      currentLatches: Map<string, Map<number, number>>,
      shiftingGroup: Set<string> 
  ) => {
      if (anchorNode.id === targetNode.id) return null;

      const transpositionRatio = targetNode.ratio / anchorNode.ratio;
      const diffCoords = targetNode.coords.map((c, i) => c - (anchorNode.coords[i] || 0));
      
      const newLatches = new Map<string, Map<number, number>>(currentLatches); 
      const nodesToMove = new Map<string, Map<number, number>>();
      const idMappings = new Map<string, string>(); 
      
      shiftingGroup.forEach(sourceId => {
          const modes = newLatches.get(sourceId);
          if (modes) {
              nodesToMove.set(sourceId, modes);
              newLatches.delete(sourceId); 
          }
      });

      nodesToMove.forEach((modes, sourceId) => {
          const sourceNode = nodeMapRef.current.get(sourceId) || phantomNodesRef.current.get(sourceId);
          if (sourceNode) {
              const maxLength = Math.max(sourceNode.coords.length, diffCoords.length);
              const newCoords: number[] = [];
              for(let i=0; i<maxLength; i++) {
                  const s = sourceNode.coords[i] || 0;
                  const d = diffCoords[i] || 0;
                  newCoords.push(Math.round(s + d));
              }
              
              const tempId = `${newCoords.join(',')}:0`;
              const tempNode = reconstructNode(tempId, settingsRef.current);
              
              if (tempNode) {
                  const normalizedBaseRatio = tempNode.ratio;
                  const idealRatio = sourceNode.ratio * transpositionRatio;
                  const neededOctave = Math.round(Math.log2(idealRatio / normalizedBaseRatio));
                  const newId = `${newCoords.join(',')}:${neededOctave}`;
                  const newNode = reconstructNode(newId, settingsRef.current);

                  if (newNode) {
                      idMappings.set(sourceId, newId);
                      modes.forEach((ts, m) => {
                          const oldVoiceId = `node-${sourceId}-${m}`;
                          const newVoiceId = `node-${newId}-${m}`;
                          audioEngine.transferVoice(oldVoiceId, newVoiceId, newNode.ratio, settingsRef.current.baseFrequency);
                          transferredVoicesRef.current.add(newVoiceId);
                      });
                      const targetModes = newLatches.get(newId) || new Map<number, number>();
                      modes.forEach((ts, m) => targetModes.set(m, Date.now()));
                      newLatches.set(newId, targetModes);
                  }
              }
          }
      });

      return { latches: newLatches, moves: idMappings };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (audioEngine) audioEngine.resume();
      if (uiUnlocked) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      updateRect();
      cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      visualsDirtyRef.current = true; // Flag update

      const hitNode = findNodeAtPosition(e.clientX, e.clientY, false);
      const nodeId = hitNode ? hitNode.id : null;

      if (hitNode) {
        if (settingsRef.current.isModulationModeActive && !settingsRef.current.isShiftModeActive) {
            triggerModulation(hitNode);
            return; 
        }

        const isShiftMode = settingsRef.current.isShiftModeActive;
        const allLatches = getAllLatchesAsMap(); 
        const isClickedLatched = allLatches.has(hitNode.id);

        if (isShiftMode) {
             let anchorNode = null;
             let effectiveShiftingGroup = new Set<string>();
             
             if (isClickedLatched) {
                 const groupId = nodeGroupsRef.current.get(hitNode.id);
                 if (groupId) {
                     nodeGroupsRef.current.forEach((gid, nid) => {
                         if (gid === groupId && allLatches.has(nid)) {
                             effectiveShiftingGroup.add(nid);
                         }
                     });
                 } else {
                     const activeChords = settingsRef.current.savedChords.filter(c => activeChordIds.includes(c.id));
                     const parentChord = activeChords.find(c => c.nodes.some(n => n.id === hitNode.id));
                     
                     if (parentChord) {
                         parentChord.nodes.forEach(n => {
                             if (allLatches.has(n.id)) effectiveShiftingGroup.add(n.id);
                         });
                     } else {
                         effectiveShiftingGroup.add(hitNode.id);
                     }
                 }
                 anchorNode = hitNode;
             } 
             
             if (anchorNode) {
                 setShiftingNodeIds(effectiveShiftingGroup); // State Update!
                 shiftingNodeIdsRef.current = effectiveShiftingGroup;

                 activeCursorsRef.current.set(e.pointerId, {
                    pointerId: e.pointerId,
                    originNodeId: anchorNode.id, 
                    hoverNodeId: anchorNode.id,
                    hasMoved: false,
                    interactionLockedNodeId: null,
                    isShiftAnchor: true
                });
                return;
             }
        }

        nodeTriggerHistory.current.set(hitNode.id, Date.now());

        const topLayer = settingsRef.current.layerOrder[settingsRef.current.layerOrder.length - 1];
        if (hitNode.maxPrime !== topLayer) onLimitInteraction(hitNode.maxPrime);
        lastTouchedLimitRef.current = hitNode.maxPrime;

        if (onNodeTrigger) {
            onNodeTrigger(hitNode.id, hitNode.ratio, hitNode.n, hitNode.d, hitNode.maxPrime);
        }

        const mode = latchModeRef.current;
        const isSustainingInstrument = mode >= 1;
        const isSustainActive = isSustainEnabledRef.current;
        const isBendEnabled = settingsRef.current.isPitchBendEnabled; 

        let pendingUnlatch = false;

        if (isSustainingInstrument && isSustainActive && !isShiftMode) {
             const nodeModes = persistentLatchesRef.current.get(hitNode.id);
             const isAlreadyLatched = nodeModes && nodeModes.has(mode);

             if (isBendEnabled && isAlreadyLatched) {
                 pendingUnlatch = true;
             } else {
                 setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                     const next = new Map(prev);
                     const nModes = next.get(hitNode.id) || new Map<number, number>();
                     
                     if (nModes.has(mode)) {
                         nModes.delete(mode);
                         if (nModes.size === 0) {
                             next.delete(hitNode.id);
                             setNodeGroups(gPrev => {
                                 const gNext = new Map(gPrev);
                                 gNext.delete(hitNode.id);
                                 return gNext;
                             });
                         } else {
                             next.set(hitNode.id, nModes);
                         }
                     } else {
                         nModes.set(mode, Date.now());
                         next.set(hitNode.id, nModes);
                         setNodeGroups(gPrev => {
                             const gNext = new Map(gPrev);
                             gNext.set(hitNode.id, activeGroupId.current);
                             return gNext;
                         });
                     }
                     return next;
                 });
             }
        }

        if (((isBendEnabled || !isSustainActive) && !isShiftMode) && !pendingUnlatch) {
            activeCursorsRef.current.set(e.pointerId, {
                pointerId: e.pointerId,
                originNodeId: nodeId, 
                hoverNodeId: nodeId,
                hasMoved: false,
                interactionLockedNodeId: null,
                isShiftAnchor: false,
                pendingUnlatch: false
            });

            const { preset, playback } = getVoiceParams(mode, settingsRef.current.isStrumEnabled);
            const voiceId = `cursor-${e.pointerId}-${hitNode.id}`;
            
            audioEngine.startVoice(voiceId, hitNode.ratio, settingsRef.current.baseFrequency, preset, playback);
            if (settingsRef.current.midiEnabled) midiService.noteOn(voiceId, hitNode.ratio, settingsRef.current.baseFrequency, settingsRef.current.midiPitchBendRange);
        } else if (pendingUnlatch) {
            activeCursorsRef.current.set(e.pointerId, {
                pointerId: e.pointerId,
                originNodeId: nodeId, 
                hoverNodeId: nodeId,
                hasMoved: false,
                interactionLockedNodeId: null,
                isShiftAnchor: false,
                pendingUnlatch: true
            });
        }
      } else {
          activeCursorsRef.current.set(e.pointerId, {
              pointerId: e.pointerId,
              originNodeId: null, 
              hoverNodeId: null,
              hasMoved: false,
              interactionLockedNodeId: null,
              isShiftAnchor: false
          });
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (uiUnlocked) return;
    const cursor = activeCursorsRef.current.get(e.pointerId);
    if (!cursor) return;

    if (scrollContainerRef.current) {
        const r = scrollContainerRef.current.getBoundingClientRect();
        cursorPositionsRef.current.set(e.pointerId, { 
            x: e.clientX - r.left + scrollContainerRef.current.scrollLeft, 
            y: e.clientY - r.top + scrollContainerRef.current.scrollTop 
        });
        visualsDirtyRef.current = true;
    }
    
    let worldY = e.clientY;
    if (scrollContainerRef.current) {
        const r = scrollContainerRef.current.getBoundingClientRect();
        const bend = globalBendRef.current;
        const pixelOffset = -bend * (PITCH_SCALE / 12) * effectiveScale;
        worldY = (e.clientY - r.top) - pixelOffset + scrollContainerRef.current.scrollTop;
    }
    
    let hasMoved = cursor.hasMoved;
    const hitNode = findNodeAtPosition(e.clientX, e.clientY, false);
    const hitId = hitNode ? hitNode.id : null;

    const { playback } = getVoiceParams(latchModeRef.current, settingsRef.current.isStrumEnabled);
    
    const isSustainingInstrument = latchModeRef.current >= 1;
    const isSustainActive = isSustainEnabledRef.current;
    const isBendEnabled = settingsRef.current.isPitchBendEnabled; 
    const isShiftMode = settingsRef.current.isShiftModeActive;
    
    // --- SHIFT LOGIC (Glide) ---
    if (isShiftMode && cursor.isShiftAnchor && cursor.originNodeId) {
         // Throttle shift updates for performance
         if (Date.now() - lastBendUpdateRef.current > 30) {
             const anchorNode = nodeMapRef.current.get(cursor.originNodeId) || phantomNodesRef.current.get(cursor.originNodeId);
             if (anchorNode) {
                 const spacing = settingsRef.current.buttonSpacingScale * effectiveScale;
                 const originWorldY = (anchorNode.y * spacing) + centerOffsetRef.current;
                 const currentDeltaY = worldY - originWorldY;
                 const glideRatio = getPitchRatioFromScreenDelta(currentDeltaY, settingsRef.current.buttonSpacingScale * effectiveScale);
                 
                 const shiftingGroup = shiftingNodeIdsRef.current;
                 audioLatchedNodesRef.current.forEach((activations, nodeId) => {
                     if (!shiftingGroup.has(nodeId)) return; 
    
                     const node = nodeMapRef.current.get(nodeId) || phantomNodesRef.current.get(nodeId);
                     if (node) {
                         const targetRatio = node.ratio * glideRatio;
                         activations.forEach(act => {
                             const voiceId = `node-${nodeId}-${act.mode}`;
                             audioEngine.glideVoice(voiceId, targetRatio, settingsRef.current.baseFrequency);
                         });
                     }
                 });
             }
             lastBendUpdateRef.current = Date.now();
         }
    }

    // --- BEND LOGIC ---
    const isBending = isBendEnabled && !!cursor.originNodeId && !isShiftMode;

    if (isBending && dynamicCanvasRef.current) {
         if (Date.now() - lastBendUpdateRef.current > 30) {
             const originNode = nodeMapRef.current.get(cursor.originNodeId!) || phantomNodesRef.current.get(cursor.originNodeId!);
             if (originNode) {
                 const spacing = settingsRef.current.buttonSpacingScale * effectiveScale;
                 const originWorldY = (originNode.y * spacing) + centerOffsetRef.current;
                 const currentDeltaY = worldY - originWorldY;
                 const bentRatio = getPitchRatioFromScreenDelta(currentDeltaY, settingsRef.current.buttonSpacingScale * effectiveScale);
                 const finalRatio = originNode.ratio * bentRatio;
                 
                 const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
                 audioEngine.glideVoice(voiceId, finalRatio, settingsRef.current.baseFrequency);
                 if (settingsRef.current.midiEnabled) midiService.pitchBend(voiceId, finalRatio, settingsRef.current.baseFrequency, settingsRef.current.midiPitchBendRange);
    
                 if (cursor.pendingUnlatch || persistentLatchesRef.current.has(cursor.originNodeId!)) {
                     const latchedModes = persistentLatchesRef.current.get(cursor.originNodeId!);
                     if (latchedModes) {
                         latchedModes.forEach((_, mode) => {
                             const latchedVoiceId = `node-${cursor.originNodeId}-${mode}`;
                             audioEngine.glideVoice(latchedVoiceId, finalRatio, settingsRef.current.baseFrequency);
                         });
                     }
                 }
             }
             lastBendUpdateRef.current = Date.now();
         }
    }

    let nextInteractionLock = cursor.interactionLockedNodeId;
    let needsRefUpdate = false;

    if (hitNode) {
         if (isSustainingInstrument && isSustainActive && isBendEnabled && !isShiftMode) {
             if (cursor.interactionLockedNodeId !== hitNode.id) {
                 const currentModes = persistentLatchesRef.current.get(hitNode.id);
                 const mode = latchModeRef.current;
                 const isAlreadyLatched = currentModes && currentModes.has(mode);

                 if (!isAlreadyLatched) {
                     setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                         const next = new Map(prev);
                         const nodeModes = next.get(hitNode.id) || new Map<number, number>();
                         nodeModes.set(mode, Date.now());
                         next.set(hitNode.id, nodeModes);
                         return next;
                     });
                     setNodeGroups(gPrev => {
                         const gNext = new Map(gPrev);
                         gNext.set(hitNode.id, activeGroupId.current);
                         return gNext;
                     });
                     
                     nodeTriggerHistory.current.set(hitNode.id, Date.now());
                     nextInteractionLock = hitNode.id;
                     needsRefUpdate = true;
                 }
             }
         }
    }

    if (cursor.hoverNodeId !== hitId) {
        needsRefUpdate = true;
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
             
             if (isSustainingInstrument && isSustainActive && !isShiftMode) {
                const isDifferentNode = hitNode.id !== cursor.originNodeId;
                if (hasMoved || isDifferentNode) {
                    const currentModes = persistentLatchesRef.current.get(hitNode.id);
                    const mode = latchModeRef.current;
                    const isAlreadyLatched = currentModes && currentModes.has(mode);
                    
                    if (!isAlreadyLatched) { 
                        setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                            const next = new Map(prev);
                            const nodeModes = next.get(hitNode.id) || new Map<number, number>();
                            nodeModes.set(mode, Date.now());
                            next.set(hitNode.id, nodeModes);
                            return next;
                        });
                        setNodeGroups(gPrev => {
                             const gNext = new Map(gPrev);
                             gNext.set(hitNode.id, activeGroupId.current);
                             return gNext;
                         });
                        nodeTriggerHistory.current.set(hitNode.id, Date.now());
                    }
                }
             } 
             else if (!isBending && !isShiftMode) {
                 nodeTriggerHistory.current.set(hitNode.id, Date.now());

                 const { preset, playback } = getVoiceParams(latchModeRef.current, settingsRef.current.isStrumEnabled);
                 const voiceId = `cursor-${e.pointerId}-${hitNode.id}`;
                 
                 audioEngine.startVoice(voiceId, hitNode.ratio, settingsRef.current.baseFrequency, preset, playback);
                 if (settingsRef.current.midiEnabled) midiService.noteOn(voiceId, hitNode.ratio, settingsRef.current.baseFrequency, settingsRef.current.midiPitchBendRange);
             }
        }
    }

    // Only update ref if logical state changed or movement started (not every pixel if stable)
    if (needsRefUpdate || (hasMoved !== cursor.hasMoved)) {
        const updatedCursor = { 
            ...cursor, 
            hoverNodeId: hitId, 
            hasMoved: hasMoved, 
            interactionLockedNodeId: nextInteractionLock 
        };
        activeCursorsRef.current.set(e.pointerId, updatedCursor);
        visualsDirtyRef.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeCursorsRef.current.has(e.pointerId)) {
        const cursor = activeCursorsRef.current.get(e.pointerId)!;
        const mode = latchModeRef.current;
        const { playback } = getVoiceParams(mode, settingsRef.current.isStrumEnabled);
        
        const isBendEnabled = settingsRef.current.isPitchBendEnabled; 
        const isShiftMode = settingsRef.current.isShiftModeActive;
        const isSustainActive = isSustainEnabledRef.current;

        // --- SHIFT LOGIC (Commit) ---
        if (isShiftMode && cursor.isShiftAnchor && cursor.originNodeId) {
            const anchorNode = nodeMapRef.current.get(cursor.originNodeId) || phantomNodesRef.current.get(cursor.originNodeId);
            let targetNode = findNodeAtPosition(e.clientX, e.clientY, true); 
            if (!targetNode && cursor.hoverNodeId) {
                 targetNode = nodeMapRef.current.get(cursor.hoverNodeId) || phantomNodesRef.current.get(cursor.hoverNodeId) || null;
            }

            const shiftingGroup = shiftingNodeIdsRef.current;

            if (anchorNode && targetNode) {
                if (anchorNode.id !== targetNode.id) {
                    const allLatches = getAllLatchesAsMap();
                    const shiftResult = executeShift(anchorNode, targetNode, allLatches, shiftingGroup);
                    if (shiftResult) {
                        setPersistentLatches(shiftResult.latches);
                        setNodeGroups(gPrev => {
                            const gNext = new Map(gPrev);
                            shiftResult.moves.forEach((newId, oldId) => {
                                const grp = gNext.get(oldId);
                                if (grp) {
                                    gNext.delete(oldId);
                                    gNext.set(newId, grp);
                                }
                            });
                            return gNext;
                        });

                        if (onClearActiveChords) onClearActiveChords();
                        if (settingsRef.current.isModulationModeActive) triggerModulation(targetNode);
                    }
                } else {
                    if (settingsRef.current.isModulationModeActive) triggerModulation(targetNode);
                }
            } else if (!targetNode) {
                const newLatches = new Map<string, Map<number, number>>(persistentLatchesRef.current);
                const nodesToRemove: string[] = [];
                shiftingGroup.forEach(sourceId => {
                    newLatches.delete(sourceId);
                    nodesToRemove.push(sourceId);
                });
                setPersistentLatches(newLatches);
                setNodeGroups(gPrev => {
                    const gNext = new Map(gPrev);
                    nodesToRemove.forEach(id => gNext.delete(id));
                    return gNext;
                });
            }
            
            setShiftingNodeIds(new Set());
            shiftingNodeIdsRef.current = new Set();
        } 
        // --- NORMAL LOGIC ---
        else {
            if (cursor.pendingUnlatch && cursor.originNodeId) {
                if (cursor.hoverNodeId === cursor.originNodeId) {
                    setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                         const next = new Map(prev);
                         const nModes = next.get(cursor.originNodeId!) || new Map<number, number>();
                         nModes.delete(mode);
                         if (nModes.size > 0) next.set(cursor.originNodeId!, nModes);
                         else {
                             next.delete(cursor.originNodeId!);
                             setNodeGroups(gPrev => {
                                 const gNext = new Map(gPrev);
                                 gNext.delete(cursor.originNodeId!);
                                 return gNext;
                             });
                         }
                         return next;
                     });
                } else {
                    const node = nodeMapRef.current.get(cursor.originNodeId) || phantomNodesRef.current.get(cursor.originNodeId);
                    if (node) {
                        const latchedModes = persistentLatchesRef.current.get(cursor.originNodeId!);
                        if (latchedModes) {
                             latchedModes.forEach((_, m) => {
                                 const latchedVoiceId = `node-${cursor.originNodeId}-${m}`;
                                 audioEngine.glideVoice(latchedVoiceId, node.ratio, settingsRef.current.baseFrequency);
                             });
                        }
                    }
                }
            }
            else if (cursor.originNodeId && isBendEnabled && !isShiftMode) {
                const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
                
                if (isSustainActive && cursor.hoverNodeId) {
                     setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                         const next = new Map(prev);
                         const nodeModes = next.get(cursor.hoverNodeId!) || new Map<number, number>();
                         nodeModes.set(mode === 0 ? 2 : mode, Date.now());
                         next.set(cursor.hoverNodeId!, nodeModes);
                         return next;
                     });
                     setNodeGroups(gPrev => {
                         const gNext = new Map(gPrev);
                         gNext.set(cursor.hoverNodeId!, activeGroupId.current);
                         return gNext;
                     });
                }

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
        }
        
        cursorPositionsRef.current.delete(e.pointerId);
        activeCursorsRef.current.delete(e.pointerId);
        visualsDirtyRef.current = true;
    }
  };

  const render = (time: number) => {
      const bgCanvas = bgLineCanvasRef.current;
      const staticCanvas = staticCanvasRef.current;
      const activeCanvas = dynamicCanvasRef.current;
      const scroller = scrollContainerRef.current;
      
      const currentScale = effectiveScaleRef.current; 

      if (!bgCanvas || !staticCanvas || !activeCanvas || !scroller) {
           animationFrameRef.current = requestAnimationFrame(render);
           return;
      }
      
      const viewX = scroller.scrollLeft;
      const viewY = scroller.scrollTop;
      const viewW = scroller.clientWidth;
      const viewH = scroller.clientHeight;

      // Update Visual State Imperatively inside RAF loop
      if (visualsDirtyRef.current) {
          updateVisualState();
          visualsDirtyRef.current = false;
      }

      rendererRef.current.render(
          bgCanvas,
          staticCanvas,
          activeCanvas,
          {
              data: dataRef.current,
              settings: settingsRef.current,
              visualLatchedNodes: cachedVisualLatchedNodes.current, 
              activeLines: cachedActiveLines.current,
              brightenedLines: cachedBrightenedLines.current,
              harmonicNeighbors: cachedHarmonicNeighbors.current, 
              activeCursors: activeCursorsRef.current,
              cursorPositions: cursorPositionsRef.current,
              nodeTriggerHistory: nodeTriggerHistory.current,
              globalBend: globalBendRef.current,
              effectiveScale: effectiveScaleRef.current,
              centerOffset: centerOffsetRef.current,
              view: { x: viewX, y: viewY, w: viewW, h: viewH },
              time: time,
              latchMode: latchModeRef.current,
              phantomNodes: phantomNodesRef.current,
              shiftGhostNodes: cachedShiftGhostNodes.current 
          }
      );

      animationFrameRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const getBackgroundStyles = () => {
      const mode = settings.backgroundMode;
      const offset = settings.backgroundYOffset || 0;
      const isJIOverride = settings.tuningSystem === 'ji' && settings.layoutApproach !== 'lattice' && settings.layoutApproach !== 'diamond';
      
      const baseStyle: React.CSSProperties = {
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%', 
          pointerEvents: 'none',
          backgroundPosition: `center calc(50% + ${offset}px)`,
          backgroundRepeat: 'no-repeat', 
          backgroundSize: 'cover',
          backgroundColor: 'black' 
      };

      if (isJIOverride) {
          return { base: baseStyle };
      }

      switch (mode) {
          case 'gradient': {
              const type = settings.gradientType === 'radial' ? 'radial-gradient' : 'linear-gradient';
              const direction = settings.gradientType === 'linear' ? `${settings.gradientAngle}deg,` : 'circle at center,';
              const start = settings.gradientColorStart || '#000000';
              const end = settings.gradientColorEnd || '#000000';
              baseStyle.backgroundImage = `${type}(${direction} ${start}, ${end})`;
              baseStyle.backgroundColor = 'transparent'; 
              break;
          }
          case 'image': {
              if (settings.backgroundImageData) {
                  const tint = settings.bgImageTint || '#000000';
                  const strength = settings.bgImageTintStrength || 0;
                  const hexToRgba = (hex: string, alpha: number) => {
                      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                      return result ? `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})` : 'rgba(0,0,0,0)';
                  };
                  const tintRgba = hexToRgba(tint, strength);
                  baseStyle.backgroundImage = `linear-gradient(${tintRgba}, ${tintRgba}), url("${settings.backgroundImageData}")`;
                  baseStyle.backgroundColor = 'transparent'; 
                  baseStyle.backgroundRepeat = settings.backgroundTiling ? 'repeat' : 'no-repeat';
                  baseStyle.backgroundSize = settings.backgroundTiling ? 'auto' : 'cover'; 
                  if (settings.bgImageGamma !== 1.0) {
                      baseStyle.filter = `brightness(${settings.bgImageGamma})`;
                  }
              }
              break;
          }
          case 'solid':
          default: {
              baseStyle.backgroundColor = settings.solidColor || '#ffffff';
              baseStyle.backgroundImage = 'none';
              break;
          }
      }

      return { base: baseStyle };
  };

  const bgStyles = getBackgroundStyles();

  return (
    <div 
        ref={scrollContainerRef} 
        className="w-full h-full overflow-auto relative bg-black" 
        style={{ touchAction: 'none' }} 
        onPointerDown={handlePointerDown} 
        onPointerMove={handlePointerMove} 
        onPointerUp={handlePointerUp} 
        onPointerLeave={handlePointerUp} 
        onPointerCancel={handlePointerUp}
    >
        <div className="sticky top-0 left-0 w-full h-full z-0 overflow-hidden pointer-events-none">
             <div style={bgStyles.base} className="absolute inset-0 w-full h-full z-0" />
             <canvas ref={bgLineCanvasRef} className="absolute top-0 left-0 w-full h-full z-[5]" />
             <canvas ref={staticCanvasRef} className="absolute top-0 left-0 w-full h-full z-[10]" />
             <canvas ref={dynamicCanvasRef} className="absolute top-0 left-0 w-full h-full z-[20]" />
             
             {isGenerating && (
                <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/80 p-2 rounded-full backdrop-blur-sm border border-white/10 shadow-xl pointer-events-none">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-xs font-bold text-slate-300 pr-2">Calculating...</span>
                </div>
            )}
        </div>
        <div style={{ width: dynamicSize, height: dynamicSize, pointerEvents: 'none' }} />
    </div>
  );
});

export default React.memo(TonalityDiamond);
