
import React, { useState, useRef, useCallback } from 'react';
import { AppSettings, LatticeNode } from '../types';
import { getPitchRatioFromScreenDelta } from '../services/ProjectionService';
import AudioEngine from '../services/AudioEngine';
import { midiService } from '../services/MidiService';

export interface ActiveCursor {
    pointerId: number;
    currentX: number;
    currentY: number;
    originNodeId: string;
    startTime: number; 
}

interface UseLatticeInteractionProps {
    settings: AppSettings;
    audioEngine: AudioEngine;
    // We pass refs to the data needed for hit testing to avoid stale closures without frequent re-renders
    nodeMapRef: React.MutableRefObject<Map<string, LatticeNode>>;
    spatialGridRef: React.MutableRefObject<Map<string, LatticeNode[]>>;
    dynamicSizeRef: React.MutableRefObject<number>;
    dynamicCanvasRef: React.RefObject<HTMLCanvasElement>;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    onLimitInteraction: (limit: number) => void;
    uiUnlocked: boolean;
    latchStatus: 0 | 1 | 2; // 0=Off, 1=Active, 2=Frozen
}

const GRID_CELL_SIZE = 100;

export const useLatticeInteraction = ({
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
}: UseLatticeInteractionProps) => {
    
    // State - Only used for persistent latches to trigger re-renders/line updates
    const [manualLatchedNodes, setManualLatchedNodes] = useState<Map<string, string>>(new Map());
    
    // Refs - Used for high-frequency interaction (Momentary)
    const activeCursorsRef = useRef<Map<number, ActiveCursor>>(new Map());
    const cursorPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());
    const lastTouchedLimitRef = useRef<number | null>(null);
    
    // Strumming Refs
    const isStrummingRef = useRef<Map<number, boolean>>(new Map()); // pointerId -> isStrumming (started outside)
    const lastStrummedNodeRef = useRef<Map<number, string>>(new Map()); // pointerId -> nodeId (to prevent re-triggering same node)
    const strummingNodesRef = useRef<Map<string, number>>(new Map()); // nodeId -> expiryTime (for visual illumination)

    // Helper: Hit Testing
    // radiusScale: Multiplier for hit area size (1.0 = full visual size)
    const getHitNode = useCallback((
        clientX: number, 
        clientY: number, 
        radiusScale: number = 1.0
    ): LatticeNode | null => {
        if (!dynamicCanvasRef.current) return null;
        const rect = dynamicCanvasRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const centerOffset = dynamicSizeRef.current / 2;
        const spacing = settings.buttonSpacingScale;
        const baseRadius = (60 * settings.buttonSizeScale) / 2;

        const col = Math.floor(x / GRID_CELL_SIZE);
        const row = Math.floor(y / GRID_CELL_SIZE);
        
        // Check surrounding cells for edge cases
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
                    
                    // Apply hitScale to radius
                    const r = baseRadius * vis.size * radiusScale;
                    
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
    }, [settings.buttonSpacingScale, settings.buttonSizeScale, settings.limitVisuals]);

    // --- Handlers ---

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (uiUnlocked || !dynamicCanvasRef.current) return;
        e.preventDefault();

        // Track raw position for drawing lines
        cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Initial touch uses standard hit radius (1.0)
        const hitNode = getHitNode(e.clientX, e.clientY, 1.0);

        if (hitNode) {
            // Hit a node: Start standard interaction (Momentary or Latch)
            (e.target as HTMLElement).setPointerCapture(e.pointerId);

            // Interaction Trigger (Bring to front)
            const topLayer = settings.layerOrder[settings.layerOrder.length - 1];
            if (hitNode.maxPrime !== topLayer) {
                onLimitInteraction(hitNode.maxPrime);
            }
            
            lastTouchedLimitRef.current = hitNode.maxPrime;

            // Update Cursors (Ref only, no re-render)
            const newCursor: ActiveCursor = {
                pointerId: e.pointerId,
                currentX: e.clientX,
                currentY: e.clientY,
                originNodeId: hitNode.id,
                startTime: performance.now()
            };
            activeCursorsRef.current.set(e.pointerId, newCursor);

            // LOGIC SPLIT:
            // Latch Status 1 (Green/Active): Update State (Slow, triggers lines/render)
            // Latch Status 0/2 (Off/Frozen): Direct Audio (Fast, no render)
            
            if (latchStatus === 1) { 
                // ACTIVE LATCH: Update React state to persist node and draw lines
                setManualLatchedNodes(prev => {
                    const next = new Map(prev);
                    if (next.has(hitNode.id)) next.delete(hitNode.id);
                    else next.set(hitNode.id, hitNode.id);
                    return next;
                });
                // Note: TonalityDiamond's useEffect handles the audio triggering for this case
            } else {
                // MOMENTARY: Direct Audio Trigger
                // This bypasses the heavy line-generation useEffect in TonalityDiamond
                audioEngine.startVoice(`node-${hitNode.id}`, hitNode.ratio, settings.baseFrequency);
                if (settings.midiEnabled) {
                    midiService.noteOn(`node-${hitNode.id}`, hitNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);
                }
            }
        } else {
            // Missed a node: Start Strumming Mode
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            isStrummingRef.current.set(e.pointerId, true);
        }
    }, [uiUnlocked, settings, getHitNode, onLimitInteraction, latchStatus]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (uiUnlocked) return;
        
        // Always update raw position for Pitch Bend calculation or Line Drawing
        cursorPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Logic A: Active Holding/Dragging (Started on a node)
        if (activeCursorsRef.current.has(e.pointerId)) {
            const cursor = activeCursorsRef.current.get(e.pointerId)!;
            
            // --- Auto-Latch Logic ---
            // Only active in LATCH MODE (1).
            // Momentary notes (0 or 2) do NOT auto-latch/switch nodes on drag.
            // This eliminates "mouse over" latching and sonic discontinuities for momentary pitch bends.
            if (settings.autoLatchOnDrag && latchStatus === 1) {
                // Use a stable radius (0.5) for latching to avoid "skipping" at high speeds
                const hitNode = getHitNode(e.clientX, e.clientY, 0.5); 
                
                // If we hit a node and it's NOT the one we started on/currently hold
                if (hitNode && hitNode.id !== cursor.originNodeId) {
                     // Update Manual Latched Nodes
                     setManualLatchedNodes(prev => {
                        const next = new Map(prev);
                        next.set(hitNode.id, hitNode.id);
                        return next;
                    });
                    
                    // Update cursor origin to handoff interactions to new node
                    cursor.originNodeId = hitNode.id;
                    cursor.startTime = performance.now(); 
                    activeCursorsRef.current.set(e.pointerId, cursor);
                }
            }

            // --- Pitch Bend Logic ---
            // Recalculates based on the CURRENT origin node.
            // For momentary notes, the originNodeId stays constant, ensuring smooth continuous bending.
            if (settings.isPitchBendEnabled && scrollContainerRef.current) {
                const centerOffset = dynamicSizeRef.current / 2;
                const rect = scrollContainerRef.current.getBoundingClientRect();
                const canvasY = (e.clientY - rect.top) + scrollContainerRef.current.scrollTop;
                const relY = canvasY - centerOffset;
                
                const bentRatio = getPitchRatioFromScreenDelta(relY, settings.buttonSpacingScale);
                
                // Audio engine handles this cheaply
                audioEngine.glideVoice(`node-${cursor.originNodeId}`, bentRatio, settings.baseFrequency, 0.05);
                if (settings.midiEnabled) {
                    midiService.pitchBend(`node-${cursor.originNodeId}`, bentRatio, settings.baseFrequency, settings.midiPitchBendRange);
                }
            }
        }
        // Logic B: Strumming (Started outside a node)
        else if (isStrummingRef.current.get(e.pointerId)) {
            // Strumming uses standard hit radius (1.0)
            const hitNode = getHitNode(e.clientX, e.clientY, 1.0);
            
            if (hitNode) {
                const lastId = lastStrummedNodeRef.current.get(e.pointerId);
                
                // Only trigger if entering a new node
                if (lastId !== hitNode.id) {
                    // 1. Trigger Audio (Unique ID to prevent conflict with held notes)
                    const strumId = `strum-${hitNode.id}`;
                    audioEngine.startVoice(strumId, hitNode.ratio, settings.baseFrequency);
                    if (settings.midiEnabled) midiService.noteOn(strumId, hitNode.ratio, settings.baseFrequency, settings.midiPitchBendRange);

                    // 2. Schedule Stop (Legato duration)
                    setTimeout(() => {
                        audioEngine.stopVoice(strumId);
                        if (settings.midiEnabled) midiService.noteOff(strumId);
                    }, settings.strumDurationMs);

                    // 3. Visuals
                    // Illumination Ring (Active state)
                    strummingNodesRef.current.set(hitNode.id, performance.now() + settings.strumDurationMs);

                    lastStrummedNodeRef.current.set(e.pointerId, hitNode.id);
                }
            } else {
                // Reset last strummed if we leave a node, allowing re-trigger
                lastStrummedNodeRef.current.delete(e.pointerId);
            }
        }
    }, [uiUnlocked, settings, getHitNode, latchStatus]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        // Cleanup Active Cursor (Held)
        if (activeCursorsRef.current.has(e.pointerId)) {
            const cursor = activeCursorsRef.current.get(e.pointerId)!;
            
            cursorPositionsRef.current.delete(e.pointerId);
            activeCursorsRef.current.delete(e.pointerId);

            // Momentary Cleanup (State 0 and 2)
            if (latchStatus !== 1) {
                // Direct Stop for momentary notes
                audioEngine.stopVoice(`node-${cursor.originNodeId}`);
                if (settings.midiEnabled) {
                    midiService.noteOff(`node-${cursor.originNodeId}`);
                }
            }
        }

        // Cleanup Strumming Cursor
        if (isStrummingRef.current.has(e.pointerId)) {
            isStrummingRef.current.delete(e.pointerId);
            lastStrummedNodeRef.current.delete(e.pointerId);
        }
    }, [latchStatus, settings.midiEnabled]);

    return {
        activeCursorsRef, // Ref only
        manualLatchedNodes,
        setManualLatchedNodes,
        cursorPositionsRef,
        lastTouchedLimitRef,
        strummingNodesRef, // Exposed for Canvas
        handlePointerDown,
        handlePointerMove,
        handlePointerUp
    };
};
