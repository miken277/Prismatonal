
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine, ButtonShape, PresetSlot, PlaybackMode, LimitType, SynthPreset, GenerationOrigin } from '../types';
import { getPitchRatioFromScreenDelta, PITCH_SCALE } from '../services/ProjectionService';
import AudioEngine from '../services/AudioEngine';
import { midiService } from '../services/MidiService';
import { LatticeRenderer } from '../services/LatticeRenderer';
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
}

interface ActiveCursor {
  pointerId: number;
  originNodeId: string | null; 
  hoverNodeId: string | null;
  hasMoved: boolean;
  interactionLockedNodeId: string | null; 
}

interface NodeActivation {
    mode: number | string; 
    timestamp: number;
    presetId: string;
}

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, updateSettings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked, latchMode, isCurrentSustainEnabled, globalScale = 1.0, viewZoom = 1.0, onNodeTrigger, onSustainStatusChange } = props;

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
  
  const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
  const [persistentLatches, setPersistentLatches] = useState<Map<string, Map<number, number>>>(new Map());
  const [externalTriggers, setExternalTriggers] = useState<Map<string, number>>(new Map()); 
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
  // This happens when modulating away from a center but keeping notes latched.
  const phantomNodes = useMemo(() => {
      const phantoms = new Map<string, LatticeNode>();
      audioLatchedNodes.forEach((_, id) => {
          if (!nodeMap.has(id)) {
              // Try to reconstruct the node data from ID
              const node = reconstructNode(id, settings);
              if (node) phantoms.set(id, node);
          }
      });
      // Also check active cursors if they are holding a node that disappeared
      activeCursors.forEach(cursor => {
          if (cursor.hoverNodeId && !nodeMap.has(cursor.hoverNodeId) && !phantoms.has(cursor.hoverNodeId)) {
              const node = reconstructNode(cursor.hoverNodeId, settings);
              if (node) phantoms.set(cursor.hoverNodeId, node);
          }
      });
      return phantoms;
  }, [audioLatchedNodes, activeCursors, nodeMap, settings]);

  const visualLatchedNodes = useMemo(() => {
      const visual = new Map<string, NodeActivation[]>();
      audioLatchedNodes.forEach((v, k) => visual.set(k, [...v]));

      activeCursors.forEach(cursor => {
          const isSustainingInstrument = latchMode >= 1; 
          const isSustainActive = isCurrentSustainEnabled;
          const isBendEnabled = settings.isPitchBendEnabled;
          const isModulating = settings.isModulationModeActive;
          
          if (isModulating) return;

          const isHybridMode = isSustainingInstrument && isSustainActive && isBendEnabled;
          if (isHybridMode) return; 

          const isMelodic = !isSustainingInstrument || !isSustainActive || isBendEnabled;
          if (isMelodic && cursor.hoverNodeId) {
              const nodeId = cursor.hoverNodeId;
              if (!visual.has(nodeId)) visual.set(nodeId, []);
              const list = visual.get(nodeId)!;
              const activation = { mode: latchMode, timestamp: Date.now(), presetId: 'cursor' };
              list.push(activation);
              list.sort((a, b) => a.timestamp - b.timestamp);
          }
      });

      // Add External Triggers (Arp)
      externalTriggers.forEach((timestamp, nodeId) => {
          if (!visual.has(nodeId)) visual.set(nodeId, []);
          const list = visual.get(nodeId)!;
          list.push({ mode: 'arp', timestamp, presetId: 'arpeggio' });
      });

      return visual;
  }, [audioLatchedNodes, activeCursors, settings.isPitchBendEnabled, settings.isModulationModeActive, latchMode, isCurrentSustainEnabled, externalTriggers]);

  // Calculate Harmonic Neighbors for Highlighting
  const harmonicNeighbors = useMemo(() => {
      const neighbors = new Map<string, number>();
      const activeIds = new Set<string>();
      
      activeCursors.forEach(c => { if(c.hoverNodeId) activeIds.add(c.hoverNodeId); });
      visualLatchedNodes.forEach((_, id) => activeIds.add(id));
      
      if (activeIds.size === 0) return neighbors;

      activeIds.forEach(sourceId => {
          const adj = adjacencyMap.get(sourceId);
          if (adj) {
              adj.forEach(edge => {
                  // Filter for consonance (Limit 3 and 5)
                  if (edge.limit <= 5 && !activeIds.has(edge.target)) {
                      const current = neighbors.get(edge.target) || 99;
                      if (edge.limit < current) neighbors.set(edge.target, edge.limit);
                  }
              });
          }
      });
      return neighbors;
  }, [activeCursors, visualLatchedNodes, adjacencyMap]);

  const activeLines = useMemo(() => {
    const latched = visualLatchedNodes;
    const lines = data.lines;
    const active: LatticeLine[] = [];
    const reach = settings.voiceLeadingSteps || 1;
    if (latched.size < 2) return [];

    if (reach === 1) {
        for (const line of lines) {
            if (latched.has(line.sourceId) && latched.has(line.targetId)) active.push(line);
        }
    } 
    else if (reach === 2) {
        const activeNodes = Array.from(latched.keys()).map(id => nodeMap.get(id) || phantomNodes.get(id)).filter(n => n) as LatticeNode[];
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
  }, [data.lines, visualLatchedNodes, settings.voiceLeadingSteps, nodeMap, phantomNodes]);
  
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
              if (step1Neighbors.has(line.sourceId) || step1Neighbors.has(line.targetId)) resultLines.add(line);
          });
      }
      return Array.from(resultLines);
  }, [visualLatchedNodes, data.lines, settings.lineBrighteningEnabled, settings.lineBrighteningSteps]);

  // Refs for Render Loop - CRITICAL FIX: Use useLayoutEffect to sync immediately before paint
  const settingsRef = useRef(settings);
  const dataRef = useRef(data);
  const activeCursorsRef = useRef<Map<number, ActiveCursor>>(activeCursors);
  const visualLatchedRef = useRef(visualLatchedNodes);
  const phantomNodesRef = useRef(phantomNodes);
  const activeLinesRef = useRef(activeLines);
  const brightenedLinesRef = useRef(brightenedLines);
  const harmonicNeighborsRef = useRef(harmonicNeighbors);
  const effectiveScaleRef = useRef(effectiveScale);
  const latchModeRef = useRef(latchMode);
  const nodeMapRef = useRef(nodeMap);
  const spatialGridRef = useRef(spatialGrid);
  const persistentLatchesRef = useRef<Map<string, Map<number, number>>>(persistentLatches);
  const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const centerOffsetRef = useRef(centerOffset);

  useLayoutEffect(() => { settingsRef.current = settings; }, [settings]);
  useLayoutEffect(() => { dataRef.current = data; }, [data]);
  useLayoutEffect(() => { activeCursorsRef.current = activeCursors; }, [activeCursors]);
  useLayoutEffect(() => { visualLatchedRef.current = visualLatchedNodes; }, [visualLatchedNodes]);
  useLayoutEffect(() => { phantomNodesRef.current = phantomNodes; }, [phantomNodes]);
  useLayoutEffect(() => { activeLinesRef.current = activeLines; }, [activeLines]);
  useLayoutEffect(() => { brightenedLinesRef.current = brightenedLines; }, [brightenedLines]);
  useLayoutEffect(() => { harmonicNeighborsRef.current = harmonicNeighbors; }, [harmonicNeighbors]);
  useLayoutEffect(() => { effectiveScaleRef.current = effectiveScale; }, [effectiveScale]);
  useLayoutEffect(() => { latchModeRef.current = latchMode; }, [latchMode]);
  useLayoutEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
  useLayoutEffect(() => { spatialGridRef.current = spatialGrid; }, [spatialGrid]);
  useLayoutEffect(() => { persistentLatchesRef.current = persistentLatches; }, [persistentLatches]);
  useLayoutEffect(() => { centerOffsetRef.current = centerOffset; }, [centerOffset]);
  
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

  useImperativeHandle(ref, () => ({
    clearLatches: (mode?: number) => {
        if (mode === undefined) setPersistentLatches(new Map());
        else {
            setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                const next = new Map();
                prev.forEach((modeMap, nodeId) => {
                    const newModeMap = new Map(modeMap);
                    if (newModeMap.has(mode)) newModeMap.delete(mode);
                    if (newModeMap.size > 0) next.set(nodeId, newModeMap);
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

  // Adjust scroll position when dynamic size changes to keep view centered relative to content
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
          const newCenterY_from_origin = normY * newSpacing;

          container.scrollLeft = (newCenterX_from_origin + centerOffset) - viewW / 2;
          container.scrollTop = (newCenterY_from_origin + centerOffset) - viewH / 2;
          
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
                   const node = nodes.get(nodeId) || phantoms.get(nodeId); 
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
  }, [audioLatchedNodes, nodeMap, phantomNodes, settings.baseFrequency, settings.midiEnabled]);

  useEffect(() => {
    audioEngine.setPolyphony(settings.polyphony);
  }, [settings.polyphony]);

  const getHitNode = (clientX: number, clientY: number): LatticeNode | null => {
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

                  // Simple circle hit test
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
          case 3: return { preset: 'strum', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 4: return { preset: 'brass', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 5: return { preset: 'keys', playback: isStrumEnabled ? 'trigger' : 'gate' };
          case 6: return { preset: 'percussion', playback: isStrumEnabled ? 'trigger' : 'gate' };
          default: return { preset: 'normal', playback: isStrumEnabled ? 'trigger' : 'gate' };
      }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (audioEngine) audioEngine.resume();

      if (uiUnlocked) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      updateRect();

      let canvasPos = { x: e.clientX, y: e.clientY };
      cursorPositionsRef.current.set(e.pointerId, canvasPos);

      const hitNode = getHitNode(e.clientX, e.clientY);
      const nodeId = hitNode ? hitNode.id : null;

      if (hitNode) {
        // --- MODULATION LOGIC ---
        if (settings.isModulationModeActive) {
            const newOrigin: GenerationOrigin = {
                coords: hitNode.coords,
                octave: hitNode.octave
            };
            
            const newPath = [...settings.modulationPath, newOrigin];
            
            const currentOrigin = settings.modulationPath[settings.modulationPath.length - 1];
            const isSame = currentOrigin.coords.every((v, i) => v === hitNode.coords[i]) && currentOrigin.octave === hitNode.octave;
            
            if (!isSame) {
                updateSettings({ 
                    modulationPath: newPath,
                    isModulationModeActive: false
                });
            }
            return; 
        }

        nodeTriggerHistory.current.set(hitNode.id, Date.now());

        const topLayer = settings.layerOrder[settings.layerOrder.length - 1];
        if (hitNode.maxPrime !== topLayer) onLimitInteraction(hitNode.maxPrime);
        lastTouchedLimitRef.current = hitNode.maxPrime;

        if (onNodeTrigger) {
            onNodeTrigger(hitNode.id, hitNode.ratio, hitNode.n, hitNode.d, hitNode.maxPrime);
        }

        const isSustainingInstrument = latchMode >= 1;
        const isSustainActive = isCurrentSustainEnabled;
        const isBendEnabled = settings.isPitchBendEnabled; 

        if (isSustainingInstrument && isSustainActive) {
             setPersistentLatches((prev: Map<string, Map<number, number>>) => {
                 const next = new Map(prev);
                 const nodeModes = next.get(hitNode.id) || new Map<number, number>();
                 
                 if (nodeModes.has(latchMode)) {
                     nodeModes.delete(latchMode);
                 } else {
                     nodeModes.set(latchMode, Date.now());
                 }
                 
                 if (nodeModes.size > 0) next.set(hitNode.id, nodeModes);
                 else next.delete(hitNode.id);
                 return next;
             });
        }

        if (isBendEnabled || !isSustainActive) {
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
          const newCursor: ActiveCursor = {
              pointerId: e.pointerId,
              originNodeId: null, 
              hoverNodeId: null,
              hasMoved: false,
              interactionLockedNodeId: null
          };
          setActiveCursors(prev => {
              const next = new Map(prev);
              next.set(e.pointerId, newCursor);
              return next;
          });
          activeCursorsRef.current.set(e.pointerId, newCursor);
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (uiUnlocked) return;
    if (!activeCursorsRef.current.has(e.pointerId)) return;

    const cursor = activeCursorsRef.current.get(e.pointerId)!;
    
    let worldY = e.clientY;
    if (scrollContainerRef.current) {
        const r = scrollContainerRef.current.getBoundingClientRect();
        const bend = globalBendRef.current;
        const pixelOffset = -bend * (PITCH_SCALE / 12) * effectiveScale;
        worldY = (e.clientY - r.top) - pixelOffset + scrollContainerRef.current.scrollTop;
    }
    
    if (scrollContainerRef.current) {
        const r = scrollContainerRef.current.getBoundingClientRect();
        cursorPositionsRef.current.set(e.pointerId, { 
            x: e.clientX - r.left + scrollContainerRef.current.scrollLeft, 
            y: e.clientY - r.top + scrollContainerRef.current.scrollTop 
        });
    }
    
    let hasMoved = cursor.hasMoved;
    const hitNode = getHitNode(e.clientX, e.clientY);
    const hitId = hitNode ? hitNode.id : null;

    const { playback } = getVoiceParams(latchMode, settingsRef.current.isStrumEnabled);
    
    const isSustainingInstrument = latchMode >= 1;
    const isSustainActive = isCurrentSustainEnabled;
    const isBendEnabled = settingsRef.current.isPitchBendEnabled; 
    
    const isBending = isBendEnabled && !!cursor.originNodeId;

    if (isBending && dynamicCanvasRef.current) {
         const originNode = nodeMapRef.current.get(cursor.originNodeId!) || phantomNodesRef.current.get(cursor.originNodeId!);
         if (originNode) {
             const spacing = settingsRef.current.buttonSpacingScale * effectiveScale;
             const originWorldY = (originNode.y * spacing) + centerOffset;
             const currentDeltaY = worldY - originWorldY;
             const bentRatio = getPitchRatioFromScreenDelta(currentDeltaY, settingsRef.current.buttonSpacingScale * effectiveScale);
             const finalRatio = originNode.ratio * bentRatio;
             
             const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
             audioEngine.glideVoice(voiceId, finalRatio, settingsRef.current.baseFrequency);
             if (settingsRef.current.midiEnabled) midiService.pitchBend(voiceId, finalRatio, settingsRef.current.baseFrequency, settingsRef.current.midiPitchBendRange);
         }
    }

    let nextInteractionLock = cursor.interactionLockedNodeId;
    let shouldUpdateState = false;

    if (hitNode) {
         if (isSustainingInstrument && isSustainActive && isBendEnabled) {
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
             
             if (isSustainingInstrument && isSustainActive && !isBendEnabled) {
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
        const updatedCursor = { 
            ...cursor, 
            hoverNodeId: hitId, 
            hasMoved: hasMoved, 
            interactionLockedNodeId: nextInteractionLock 
        };
        
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
        const { playback } = getVoiceParams(latchMode, settingsRef.current.isStrumEnabled);
        
        const isBendEnabled = settingsRef.current.isPitchBendEnabled; 

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

        setActiveCursors(prev => {
            const next = new Map(prev);
            next.delete(e.pointerId);
            return next;
        });
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

      rendererRef.current.render(
          bgCanvas,
          staticCanvas,
          activeCanvas,
          {
              data: dataRef.current,
              settings: settingsRef.current,
              visualLatchedNodes: visualLatchedRef.current, 
              activeLines: activeLinesRef.current,
              brightenedLines: brightenedLinesRef.current,
              harmonicNeighbors: harmonicNeighborsRef.current, 
              activeCursors: activeCursorsRef.current,
              cursorPositions: cursorPositionsRef.current,
              nodeTriggerHistory: nodeTriggerHistory.current,
              globalBend: globalBendRef.current,
              effectiveScale: effectiveScaleRef.current,
              centerOffset: centerOffsetRef.current,
              view: { x: viewX, y: viewY, w: viewW, h: viewH },
              time: time,
              latchMode: latchModeRef.current,
              phantomNodes: phantomNodesRef.current
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
        {/* Fixed Layer for Background and Canvases */}
        <div className="sticky top-0 left-0 w-full h-full z-0 overflow-hidden pointer-events-none">
             {/* Background */}
             <div style={bgStyles.base} className="absolute inset-0 w-full h-full z-0" />
             
             {/* Canvas Layers */}
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
        
        {/* Scroll Spacer */}
        <div style={{ width: dynamicSize, height: dynamicSize, pointerEvents: 'none' }} />
    </div>
  );
});

export default React.memo(TonalityDiamond);
