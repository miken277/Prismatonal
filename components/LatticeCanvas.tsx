
import React, { useRef, useEffect, useMemo } from 'react';
import { AppSettings, LatticeNode, LatticeLine, ButtonShape } from '../types';
import { getRainbowPeriod } from '../services/ProjectionService';
import { ActiveCursor } from '../hooks/useLatticeInteraction';

interface Props {
    settings: AppSettings;
    data: { nodes: LatticeNode[], lines: LatticeLine[] };
    dynamicSize: number;
    activeLines: LatticeLine[];
    reinforcedLines: LatticeLine[];
    effectiveLatchedNodes: Map<string, string>;
    activeCursorsRef: React.MutableRefObject<Map<number, ActiveCursor>>;
    cursorPositionsRef: React.MutableRefObject<Map<number, {x: number, y: number}>>;
    nodeMapRef: React.MutableRefObject<Map<string, LatticeNode>>;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    dynamicCanvasRef: React.RefObject<HTMLCanvasElement>; // Treated as Foreground Canvas
    isGenerating: boolean;
    uiUnlocked: boolean;
    latchStatus: 0 | 1 | 2;
    strummingNodesRef?: React.MutableRefObject<Map<string, number>>; // nodeId -> expiryTime
}

const LatticeCanvas: React.FC<Props> = ({
    settings,
    data,
    dynamicSize,
    activeLines,
    reinforcedLines,
    effectiveLatchedNodes,
    activeCursorsRef,
    cursorPositionsRef,
    nodeMapRef,
    scrollContainerRef,
    dynamicCanvasRef,
    isGenerating,
    uiUnlocked,
    latchStatus,
    strummingNodesRef
}) => {
    const staticCanvasRef = useRef<HTMLCanvasElement>(null);
    const dynamicBgCanvasRef = useRef<HTMLCanvasElement>(null); // New Background Dynamic Layer
    const animationFrameRef = useRef<number>(0);
    
    // Refs to keep the animation loop fresh without re-binding
    const settingsRef = useRef(settings);
    const effectiveLatchedRef = useRef(effectiveLatchedNodes);
    const activeLinesRef = useRef(activeLines);
    const reinforcedLinesRef = useRef(reinforcedLines);
    const dynamicSizeRef = useRef(dynamicSize);
    const latchStatusRef = useRef(latchStatus);

    // Reuse a set for active node rendering to avoid allocation in the loop
    const activeNodeIdsSetRef = useRef<Set<string>>(new Set());

    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { effectiveLatchedRef.current = effectiveLatchedNodes; }, [effectiveLatchedNodes]);
    useEffect(() => { activeLinesRef.current = activeLines; }, [activeLines]);
    useEffect(() => { reinforcedLinesRef.current = reinforcedLines; }, [reinforcedLines]);
    useEffect(() => { dynamicSizeRef.current = dynamicSize; }, [dynamicSize]);
    useEffect(() => { latchStatusRef.current = latchStatus; }, [latchStatus]);

    // --- STATIC RENDERER (Background Nodes & Lines) ---
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
        settings.buttonSizeScale, settings.buttonSpacingScale, settings.colors, settings.limitVisuals,
        settings.buttonShape, settings.nodeTextSizeScale, settings.showFractionBar, dynamicSize
    ]);

    useEffect(() => {
        const canvas = staticCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const size = dynamicSize;
        
        if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
        }
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        const centerOffset = size / 2;
        const spacing = settings.buttonSpacingScale;
        const baseRadius = (60 * settings.buttonSizeScale) / 2;
        const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
        
        // Draw Lines (Static Background Lines)
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

        // Draw Nodes
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

    }, [data, visualDeps, dynamicSize]);

    // --- DYNAMIC RENDERER (Animation Loop) ---
    useEffect(() => {
        const canvasFg = dynamicCanvasRef.current;
        const canvasBg = dynamicBgCanvasRef.current;

        if (!canvasFg || !canvasBg) return;

        const ctxFg = canvasFg.getContext('2d', { alpha: true });
        const ctxBg = canvasBg.getContext('2d', { alpha: true });
        
        if (!ctxFg || !ctxBg) return;

        const dpr = window.devicePixelRatio || 1;

        const render = (time: number) => {
            const currentSettings = settingsRef.current;
            const currentCursors = activeCursorsRef.current;
            const currentLatched = effectiveLatchedRef.current;
            const currentActiveLines = activeLinesRef.current;
            const currentReinforcedLines = reinforcedLinesRef.current;
            const status = latchStatusRef.current;
            const size = dynamicSizeRef.current;
            const nodeMap = nodeMapRef.current;
            
            // Resize logic for both canvases
            if (canvasFg.width !== size * dpr || canvasFg.height !== size * dpr) {
                canvasFg.width = size * dpr;
                canvasFg.height = size * dpr;
                ctxFg.scale(dpr, dpr);
                
                canvasBg.width = size * dpr;
                canvasBg.height = size * dpr;
                ctxBg.scale(dpr, dpr);
            }

            // Viewport culling optimization
            let viewX = 0, viewY = 0, viewW = size, viewH = size;
            if (scrollContainerRef.current) {
                viewX = scrollContainerRef.current.scrollLeft;
                viewY = scrollContainerRef.current.scrollTop;
                viewW = scrollContainerRef.current.clientWidth;
                viewH = scrollContainerRef.current.clientHeight;
            }
            
            ctxFg.clearRect(viewX, viewY, viewW, viewH);
            ctxBg.clearRect(viewX, viewY, viewW, viewH);

            const centerOffset = size / 2;
            const spacing = currentSettings.buttonSpacingScale;
            const baseRadius = (60 * currentSettings.buttonSizeScale) / 2;
            const isDiamond = currentSettings.buttonShape === ButtonShape.DIAMOND;
            const colorCache = currentSettings.colors;

            const animationSpeed = (currentSettings.voiceLeadingAnimationSpeed || 2.0) * 0.33;
            const rawPhase = (time * 0.001 * animationSpeed);
            const flowPhase = currentSettings.voiceLeadingReverseDir ? (1.0 - (rawPhase % 1.0)) : (rawPhase % 1.0);
            
            const viewPad = 100;
            const leftBound = viewX - viewPad;
            const rightBound = viewX + viewW + viewPad;
            const topBound = viewY - viewPad;
            const bottomBound = viewY + viewH + viewPad;

            // DRAW REINFORCED LINES (Layer 0 - Background)
            // No clipping needed as they are behind the static node layer
            ctxBg.lineCap = 'round';
            ctxBg.setLineDash([]);
            
            for (const line of currentReinforcedLines) {
                const x1 = line.x1 * spacing + centerOffset;
                const y1 = line.y1 * spacing + centerOffset;
                const x2 = line.x2 * spacing + centerOffset;
                const y2 = line.y2 * spacing + centerOffset;
                
                if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;

                const limitColor = colorCache[line.limit] || '#666';
                const vis = currentSettings.limitVisuals?.[line.limit] || { size: 1, opacity: 1 };
                
                ctxBg.beginPath();
                ctxBg.moveTo(x1, y1);
                ctxBg.lineTo(x2, y2);
                ctxBg.lineWidth = (line.limit === 1 ? 4 : 2) * vis.size;
                ctxBg.strokeStyle = limitColor;
                ctxBg.globalAlpha = 0.6 * vis.opacity; 
                ctxBg.stroke();
            }
            
            // DRAW ACTIVE LINES (Layer 2 - Foreground)
            // MUST be clipped to node boundaries to not draw over static text
            ctxFg.lineCap = 'round';
            
            for (const line of currentActiveLines) {
                let x1 = line.x1 * spacing + centerOffset;
                let y1 = line.y1 * spacing + centerOffset;
                let x2 = line.x2 * spacing + centerOffset;
                let y2 = line.y2 * spacing + centerOffset;
                
                if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;

                const srcNode = nodeMap.get(line.sourceId);
                const tgtNode = nodeMap.get(line.targetId);
                
                // Clip logic
                if (srcNode && tgtNode) {
                    const r1 = baseRadius * (currentSettings.limitVisuals?.[srcNode.limitTop]?.size || 1.0);
                    const r2 = baseRadius * (currentSettings.limitVisuals?.[tgtNode.limitTop]?.size || 1.0);
                    
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist > r1 + r2) {
                        const ux = dx / dist;
                        const uy = dy / dist;
                        
                        // Clip start
                        x1 += ux * (r1 - 1); // -1 pixel for slight overlap/anti-alias gap prevention
                        y1 += uy * (r1 - 1);
                        
                        // Clip end
                        x2 -= ux * (r2 - 1);
                        y2 -= uy * (r2 - 1);
                    }
                }

                const limitColor = colorCache[line.limit] || '#666';

                ctxFg.beginPath();
                ctxFg.moveTo(x1, y1);
                ctxFg.lineTo(x2, y2);
                ctxFg.lineWidth = 4;
                ctxFg.strokeStyle = limitColor;
                ctxFg.globalAlpha = 1.0;
                ctxFg.stroke();

                // Animated Pulse (Optional - can be optimized out if laggy)
                if (currentSettings.isVoiceLeadingAnimationEnabled) {
                    const grad = ctxFg.createLinearGradient(x1, y1, x2, y2);
                    const p = flowPhase;
                    
                    grad.addColorStop(0, 'rgba(255,255,255,0)');
                    const pulseWidth = 0.2;
                    const start = Math.max(0, p - pulseWidth);
                    const end = Math.min(1, p + pulseWidth);
                    if (start > 0) grad.addColorStop(start, 'rgba(255,255,255,0)');
                    grad.addColorStop(p, 'rgba(255,255,255,0.7)'); 
                    if (end < 1) grad.addColorStop(end, 'rgba(255,255,255,0)');
                    grad.addColorStop(1, 'rgba(255,255,255,0)');

                    ctxFg.strokeStyle = grad;
                    ctxFg.lineWidth = 10 * (0.5 + currentSettings.voiceLeadingGlowAmount);
                    ctxFg.globalAlpha = 0.3; 
                    ctxFg.stroke();
                    // Restore main line
                    ctxFg.lineWidth = 4;
                    ctxFg.globalAlpha = 1.0;
                    ctxFg.stroke();
                }
            }

            // DRAW ACTIVE NODES (Foreground Layer)
            // ONLY drawing illumination rings to preserve high-quality text from static layer
            const activeSet = activeNodeIdsSetRef.current;
            activeSet.clear(); 
            currentLatched.forEach((_, id) => activeSet.add(id));
            currentCursors.forEach(c => activeSet.add(c.originNodeId));
            
            if (strummingNodesRef) {
                const now = performance.now();
                strummingNodesRef.current.forEach((expiry, id) => {
                    if (expiry > now) activeSet.add(id);
                    else strummingNodesRef.current.delete(id);
                });
            }

            if (activeSet.size > 0) {
                for (const id of activeSet) {
                    const node = nodeMap.get(id);
                    if (!node) continue;

                    const x = node.x * spacing + centerOffset;
                    const y = node.y * spacing + centerOffset;
                    
                    if (x < leftBound || x > rightBound || y < topBound || y > bottomBound) continue;

                    const vis = currentSettings.limitVisuals?.[node.limitTop] || { size: 1 };
                    const limitScale = vis.size;
                    const radius = baseRadius * limitScale; 

                    ctxFg.globalAlpha = 1.0; 
                    ctxFg.beginPath();
                    if (isDiamond) {
                        ctxFg.moveTo(x, y - radius);
                        ctxFg.lineTo(x + radius, y);
                        ctxFg.lineTo(x, y + radius);
                        ctxFg.lineTo(x - radius, y);
                    } else {
                        ctxFg.arc(x, y, radius, 0, Math.PI * 2);
                    }
                    ctxFg.closePath();

                    // ILLUMINATION LOGIC
                    // We do NOT fill the node or draw text here. Just the stroke/glow.
                    if (currentSettings.isColoredIlluminationEnabled) {
                        const rainbowPeriod = getRainbowPeriod(spacing); 
                        const bgOffsetY = (size / 2) - (rainbowPeriod / 3);
                        const relativeY = y - bgOffsetY;
                        const normalizedY = ((relativeY % rainbowPeriod) + rainbowPeriod) % rainbowPeriod;
                        const phase = normalizedY / rainbowPeriod;
                        const hue = (currentSettings.rainbowOffset + phase * 360) % 360;
                        const sat = currentSettings.isRainbowModeEnabled ? currentSettings.rainbowSaturation : 100;
                        
                        // Main Ring - Sharp and bright
                        ctxFg.strokeStyle = `hsl(${hue}, ${sat}%, 70%)`;
                        ctxFg.lineWidth = 3; 
                        ctxFg.stroke();
                        
                        // Outer Glow Ring - Subtle but distinct
                        ctxFg.strokeStyle = `hsl(${hue}, ${sat}%, 60%)`;
                        ctxFg.lineWidth = 6;
                        ctxFg.globalAlpha = 0.5;
                        ctxFg.stroke();
                        ctxFg.globalAlpha = 1.0;

                    } else {
                        // Standard White Illumination
                        ctxFg.strokeStyle = 'white';
                        ctxFg.lineWidth = 3;
                        ctxFg.stroke();
                        
                        ctxFg.lineWidth = 6;
                        ctxFg.globalAlpha = 0.3;
                        ctxFg.stroke();
                        ctxFg.globalAlpha = 1.0;
                    }
                }
            }
            
            // DRAW CURSOR CONNECTORS
            if (currentCursors.size > 0 && (currentSettings.isPitchBendEnabled || status !== 2)) {
                ctxFg.strokeStyle = 'white';
                ctxFg.lineWidth = 2;
                ctxFg.globalAlpha = 0.5;
                ctxFg.beginPath();
                currentCursors.forEach(c => {
                    const node = nodeMap.get(c.originNodeId);
                    if(node) {
                        const nx = node.x * spacing + centerOffset;
                        const ny = node.y * spacing + centerOffset;
                        const pos = cursorPositionsRef.current.get(c.pointerId);
                        if (pos) {
                            let cx = 0, cy = 0;
                            if (scrollContainerRef.current) {
                                const r = scrollContainerRef.current.getBoundingClientRect();
                                cx = (pos.x - r.left) + scrollContainerRef.current.scrollLeft;
                                cy = (pos.y - r.top) + scrollContainerRef.current.scrollTop;
                            }
                            ctxFg.moveTo(nx, ny);
                            ctxFg.lineTo(cx, cy);
                        }
                    }
                });
                ctxFg.stroke();
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, []); 

    const rainbowPeriod = getRainbowPeriod(settings.buttonSpacingScale);
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
           {/* Layer 0: Background Dynamic (Reinforced Lines) - z-index 5 */}
           <canvas 
             ref={dynamicBgCanvasRef}
             className="absolute top-0 left-0 z-[5] pointer-events-none"
             style={{ width: '100%', height: '100%' }}
           />

           {/* Layer 1: Static (Background Nodes) - z-index 10 */}
           <canvas 
             ref={staticCanvasRef}
             className="absolute top-0 left-0 z-[10] pointer-events-none"
             style={{ width: '100%', height: '100%' }}
           />

           {/* Layer 2: Foreground Dynamic (Active Elements) - z-index 20 */}
           <canvas 
             ref={dynamicCanvasRef}
             className="absolute top-0 left-0 z-[20]"
             style={{ width: '100%', height: '100%' }}
           />

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
    );
};

export default React.memo(LatticeCanvas);
