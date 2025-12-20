
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AppSettings, LatticeNode } from '../types';
import { getPitchRatioFromScreenDelta } from '../services/ProjectionService';
import AudioEngine from '../services/AudioEngine';

const GRID_CELL_SIZE = 100;

interface ActiveCursor {
  pointerId: number;
  currentX: number;
  currentY: number;
  originNodeId: string | null; 
  hoverNodeId: string | null;
  hasMoved: boolean;
}

export const useLatticeInteraction = (
    settings: AppSettings,
    audioEngine: AudioEngine,
    midiService: any,
    nodeMap: Map<string, LatticeNode>,
    spatialGrid: Map<string, LatticeNode[]>,
    dynamicSize: number,
    globalScale: number,
    activeChordIds: string[],
    latchMode: 0 | 1 | 2,
    uiUnlocked: boolean,
    scrollContainerRef: React.RefObject<HTMLDivElement>,
    dynamicCanvasRef: React.RefObject<HTMLCanvasElement>,
    onLimitInteraction: (limit: number) => void,
    onNodeTrigger?: (nodeId: string, ratio: number, n?: number, d?: number, limit?: number) => void
) => {
    const [activeCursors, setActiveCursors] = useState<Map<number, ActiveCursor>>(new Map());
    const [persistentLatches, setPersistentLatches] = useState<Map<string, string>>(new Map());
    const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());
    
    // Track the full node data for generation origin expansion
    const lastTouchedNodeRef = useRef<{ coords: number[], octave: number } | null>(null);
    
    // Refs for closure access in event handlers
    const settingsRef = useRef(settings);
    const nodeMapRef = useRef(nodeMap);
    const spatialGridRef = useRef(spatialGrid);
    const activeCursorsRef = useRef(activeCursors);
    const persistentLatchesRef = useRef(persistentLatches);
    const dynamicSizeRef = useRef(dynamicSize);
    const globalScaleRef = useRef(globalScale);
    const lastTouchedLimitRef = useRef<number | null>(null);

    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
    useEffect(() => { spatialGridRef.current = spatialGrid; }, [spatialGrid]);
    useEffect(() => { activeCursorsRef.current = activeCursors; }, [activeCursors]);
    useEffect(() => { persistentLatchesRef.current = persistentLatches; }, [persistentLatches]);
    useEffect(() => { dynamicSizeRef.current = dynamicSize; }, [dynamicSize]);
    useEffect(() => { globalScaleRef.current = globalScale; }, [globalScale]);

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
        activeCursors.forEach(cursor => {
            if (cursor.hoverNodeId) {
                visual.set(cursor.hoverNodeId, cursor.hoverNodeId);
            }
        });
        return visual;
    }, [audioLatchedNodes, activeCursors]);

    // Handle blur to clear cursors
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
    }, [audioEngine, midiService]);

    // Chord re-latch logic
    const prevActiveChordIds = useRef<string[]>([]);
    useEffect(() => {
        if (settings.chordsAlwaysRelatch) {
             const newChords = activeChordIds.filter(id => !prevActiveChordIds.current.includes(id));
             if (newChords.length > 0) {
                 newChords.forEach(chordId => {
                     const chordDef = settings.savedChords.find(c => c.id === chordId);
                     if (chordDef) {
                         chordDef.nodes.forEach(n => {
                            const fullNode = nodeMap.get(n.id);
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
    }, [activeChordIds, settings.savedChords, settings.chordsAlwaysRelatch, nodeMap, settings.baseFrequency, settings.midiEnabled, settings.midiPitchBendRange, audioEngine, midiService]);

    // Audio sync for latched nodes
    const prevAudioLatchedRef = useRef<Map<string, string>>(new Map());
    useEffect(() => {
        const current = audioLatchedNodes;
        const prev = prevAudioLatchedRef.current;
        
        current.forEach((originId, nodeId) => {
            if (!prev.has(nodeId)) {
                 const node = nodeMap.get(nodeId); 
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
    }, [audioLatchedNodes, nodeMap, settings.baseFrequency, settings.midiEnabled, settings.midiPitchBendRange, audioEngine, midiService]);

    const getHitNode = (clientX: number, clientY: number): LatticeNode | null => {
        if (!dynamicCanvasRef.current) return null;
        const rect = dynamicCanvasRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
  
        const centerOffset = dynamicSizeRef.current / 2;
        const spacing = settingsRef.current.buttonSpacingScale * globalScaleRef.current;
        const baseRadius = (60 * settingsRef.current.buttonSizeScale * globalScaleRef.current) / 2;
  
        // When checking hit, we must account for the potentially larger size in alternate layouts
        const isAlternateJILayout = settingsRef.current.tuningSystem === 'ji' && settingsRef.current.layoutApproach !== 'lattice';
        const layoutSizeMult = isAlternateJILayout ? 1.5 : 1.0; 
  
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
                    const vis = settingsRef.current.limitVisuals?.[node.limitTop] || { size: 1 };
                    const r = baseRadius * vis.size * layoutSizeMult;
                    
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
  
        setActiveCursors(prev => {
            const next = new Map(prev);
            next.set(e.pointerId, {
                pointerId: e.pointerId,
                currentX: e.clientX,
                currentY: e.clientY,
                originNodeId: nodeId, 
                hoverNodeId: nodeId,
                hasMoved: false
            });
            return next;
        });
  
        if (hitNode) {
          const topLayer = settings.layerOrder[settings.layerOrder.length - 1];
          if (hitNode.maxPrime !== topLayer) onLimitInteraction(hitNode.maxPrime);
          lastTouchedLimitRef.current = hitNode.maxPrime;
          lastTouchedNodeRef.current = { coords: hitNode.coords, octave: hitNode.octave };
  
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
                  // Mode 2 triggers 'normal' voice now, distinct from Mode 1 'latch' voice
                  const voiceType = 'normal'; 
                  audioEngine.startVoice(voiceId, hitNode.ratio, settings.baseFrequency, voiceType);
                  if (settings.midiEnabled) midiService.noteOn(voiceId, hitNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);
              }
          }
        }
    };
  
    const handlePointerMove = (e: React.PointerEvent) => {
      if (uiUnlocked) return;
      if (!activeCursorsRef.current.has(e.pointerId)) return;
  
      cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      
      const cursor = activeCursorsRef.current.get(e.pointerId)!;
      const hitNode = getHitNode(e.clientX, e.clientY);
      const hitId = hitNode ? hitNode.id : null;
  
      const deltaMoveX = Math.abs(e.clientX - cursor.currentX);
      const deltaMoveY = Math.abs(e.clientY - cursor.currentY);
      let hasMoved = cursor.hasMoved;
      if (deltaMoveX > 3 || deltaMoveY > 3) {
          hasMoved = true;
      }
  
      if (cursor.originNodeId && settings.isPitchBendEnabled && latchMode !== 1 && scrollContainerRef.current) {
           const centerOffset = dynamicSizeRef.current / 2;
           const rect = scrollContainerRef.current.getBoundingClientRect();
           const originNode = nodeMapRef.current.get(cursor.originNodeId);
           if (originNode) {
               const spacing = settings.buttonSpacingScale * globalScaleRef.current;
               const originScreenY = (originNode.y * spacing + centerOffset) + rect.top - scrollContainerRef.current.scrollTop;
               const deltaY = e.clientY - originScreenY;
               const bentRatio = getPitchRatioFromScreenDelta(deltaY, settings.buttonSpacingScale * globalScaleRef.current);
               const finalRatio = originNode.ratio * bentRatio;
               
               const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
               audioEngine.glideVoice(voiceId, finalRatio, settings.baseFrequency);
               if (settings.midiEnabled) midiService.pitchBend(voiceId, finalRatio, settings.baseFrequency, settings.midiPitchBendRange);
           }
      }
  
      if (cursor.hoverNodeId !== hitId) {
          if (latchMode === 0 && cursor.hoverNodeId) {
               const isBendingOrigin = settings.isPitchBendEnabled && cursor.originNodeId && cursor.originNodeId === cursor.hoverNodeId;
               
               if (!isBendingOrigin) {
                   const oldVoiceId = `cursor-${e.pointerId}-${cursor.hoverNodeId}`;
                   audioEngine.stopVoice(oldVoiceId);
                   if (settings.midiEnabled) midiService.noteOff(oldVoiceId);
               }
          }
  
          if (hitNode) {
               const topLayer = settingsRef.current.layerOrder[settingsRef.current.layerOrder.length - 1];
               if (hitNode.maxPrime !== topLayer) onLimitInteraction(hitNode.maxPrime);
               
               if (latchMode === 1) {
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
                   const isAlreadyLatched = audioLatchedNodes.has(hitNode.id);
                   const isBending = settingsRef.current.isPitchBendEnabled && cursor.originNodeId;
                   
                   if (!isAlreadyLatched && !isBending) {
                       const voiceId = `cursor-${e.pointerId}-${hitNode.id}`;
                       audioEngine.startVoice(voiceId, hitNode.ratio, settings.baseFrequency, 'strum');
                       if (settings.midiEnabled) midiService.noteOn(voiceId, hitNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);
                   }
               }
          }
          
          setActiveCursors((prev: Map<number, ActiveCursor>) => {
              const next = new Map(prev);
              const c = next.get(e.pointerId);
              if(c) { 
                  const updatedCursor = { ...c, hoverNodeId: hitId, hasMoved };
                  next.set(e.pointerId, updatedCursor); 
              }
              return next;
          });
      }
    };
  
    const handlePointerUp = (e: React.PointerEvent) => {
      if (activeCursorsRef.current.has(e.pointerId)) {
          const cursor = activeCursorsRef.current.get(e.pointerId)!;
          
          if (cursor.originNodeId) {
              if (latchMode !== 1) {
                  const voiceId = `cursor-${e.pointerId}-${cursor.originNodeId}`;
                  audioEngine.stopVoice(voiceId);
                  if (settings.midiEnabled) midiService.noteOff(voiceId);
              }
          } 
          else if (cursor.hoverNodeId && cursor.hoverNodeId !== cursor.originNodeId && latchMode === 0) {
               const voiceId = `cursor-${e.pointerId}-${cursor.hoverNodeId}`;
               audioEngine.stopVoice(voiceId);
               if (settings.midiEnabled) midiService.noteOff(voiceId);
          }
          
          cursorPositionsRef.current.delete(e.pointerId);
          setActiveCursors(prev => {
              const next = new Map(prev);
              next.delete(e.pointerId);
              return next;
          });
      }
    };

    return {
        activeCursors,
        persistentLatches,
        setPersistentLatches,
        cursorPositionsRef,
        visualLatchedNodes,
        audioLatchedNodes,
        lastTouchedLimitRef,
        lastTouchedNodeRef,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp
    };
};
