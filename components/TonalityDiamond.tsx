
import React, { useEffect, useRef, useState, useLayoutEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine } from '../types';
import AudioEngine from '../services/AudioEngine';
import { midiService } from '../services/MidiService';
import { useLatticeInteraction } from '../hooks/useLatticeInteraction';
import { useLatticeGeneration } from '../hooks/useLatticeGeneration';
import LatticeCanvas from './LatticeCanvas';

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
  latchStatus: 0 | 1 | 2;
}

const GRID_CELL_SIZE = 100;

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, updateSettings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked, latchStatus } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // 1. Data Generation Hook
  const { data, isGenerating, dynamicSize } = useLatticeGeneration(settings);
  const prevDynamicSizeRef = useRef(2000);

  // 2. Memoized Lookups (Data Derivative)
  const nodeMap = useMemo(() => new Map(data.nodes.map(n => [n.id, n])), [data.nodes]);

  const spatialGrid = useMemo(() => {
      const grid = new Map<string, LatticeNode[]>();
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

  // Refs for Hooks
  const nodeMapRef = useRef(nodeMap);
  const spatialGridRef = useRef(spatialGrid);
  const dynamicSizeRef = useRef(dynamicSize);

  useEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
  useEffect(() => { spatialGridRef.current = spatialGrid; }, [spatialGrid]);
  useEffect(() => { dynamicSizeRef.current = dynamicSize; }, [dynamicSize]);

  // 3. Interaction Hook
  const {
      activeCursorsRef, // Ref only
      manualLatchedNodes, // State
      setManualLatchedNodes,
      cursorPositionsRef,
      lastTouchedLimitRef,
      strummingNodesRef,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp
  } = useLatticeInteraction({
      settings,
      audioEngine,
      nodeMapRef,
      spatialGridRef,
      dynamicSizeRef,
      dynamicCanvasRef,
      scrollContainerRef,
      onLimitInteraction,
      uiUnlocked,
      latchStatus
  });

  const [effectiveLatchedNodes, setEffectiveLatchedNodes] = useState<Map<string, string>>(new Map());

  // Optimization: Pre-calculate active (both latched) and reinforced (one latched) lines
  // This now ONLY runs when permanent latches or chords change, not on every momentary tap!
  const { activeLines, reinforcedLines } = useMemo(() => {
    const latched = effectiveLatchedNodes;
    const lines = data.lines;
    const active: LatticeLine[] = [];
    const reinforced: LatticeLine[] = [];
    
    if (latched.size > 0) {
        for (const line of lines) {
            const s = latched.has(line.sourceId);
            const t = latched.has(line.targetId);
            
            if (s && t) {
                active.push(line);
            } else if (s || t) {
                reinforced.push(line);
            }
        }
    }
    return { activeLines: active, reinforcedLines: reinforced };
  }, [data.lines, effectiveLatchedNodes]);
  
  // Depth History for Undo/Redo Depth
  const depthHistoryRef = useRef<number[]>([]);
  const [hasCentered, setHasCentered] = useState(false);
  const prevActiveChordIds = useRef<string[]>([]);

  // --- External API ---
  useImperativeHandle(ref, () => ({
    clearLatches: () => setManualLatchedNodes(new Map()),
    centerView: () => centerScroll(),
    increaseDepth: () => {
        const limit = lastTouchedLimitRef.current;
        if (limit && limit > 1) {
             updateSettings((prev: AppSettings) => {
                 const currentDepth = prev.limitDepths[limit as 3|5|7|11|13];
                 return {
                     ...prev,
                     limitDepths: { ...prev.limitDepths, [limit]: currentDepth + 1 }
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
                     limitDepths: { ...prev.limitDepths, [limit]: Math.max(0, currentDepth - 1) }
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

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (!hasCentered && dynamicSize > 0) {
        centerScroll();
        setHasCentered(true);
    } else if (dynamicSize !== prevDynamicSizeRef.current) {
        const diff = (dynamicSize - prevDynamicSizeRef.current) / 2;
        container.scrollLeft += diff;
        container.scrollTop += diff;
    }
    prevDynamicSizeRef.current = dynamicSize;
  }, [dynamicSize]);

  // --- LOGIC: Effective Latches (Chords + Manual) ---
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
    
    // Always Relatch Chords Logic
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

  // Audio Diffing (For Permanent Latches Only)
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
        <LatticeCanvas 
            settings={settings}
            data={data}
            dynamicSize={dynamicSize}
            activeLines={activeLines}
            reinforcedLines={reinforcedLines}
            effectiveLatchedNodes={effectiveLatchedNodes}
            activeCursorsRef={activeCursorsRef}
            cursorPositionsRef={cursorPositionsRef}
            nodeMapRef={nodeMapRef}
            scrollContainerRef={scrollContainerRef}
            dynamicCanvasRef={dynamicCanvasRef}
            isGenerating={isGenerating}
            uiUnlocked={uiUnlocked}
            latchStatus={latchStatus}
            strummingNodesRef={strummingNodesRef}
        />
    </div>
  );
});

export default React.memo(TonalityDiamond);
