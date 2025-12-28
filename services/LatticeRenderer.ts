
import { LatticeNode, LatticeLine, AppSettings, ButtonShape } from '../types';
import { getRainbowPeriod, PITCH_SCALE } from './ProjectionService';

export interface RenderState {
    data: { nodes: LatticeNode[], lines: LatticeLine[] };
    settings: AppSettings;
    visualLatchedNodes: Map<string, number>;
    activeLines: LatticeLine[];
    brightenedLines: LatticeLine[];
    activeCursors: Map<number, any>;
    cursorPositions: Map<number, {x: number, y: number}>;
    nodeTriggerHistory: Map<string, number>;
    globalBend: number;
    effectiveScale: number;
    dynamicSize: number;
    view: { x: number, y: number, w: number, h: number };
    time: number;
}

export class LatticeRenderer {
    
    public render(
        bgCanvas: HTMLCanvasElement, 
        staticCanvas: HTMLCanvasElement, 
        dynamicCanvas: HTMLCanvasElement, 
        state: RenderState
    ) {
        const { 
            data, settings, visualLatchedNodes, activeLines, brightenedLines, 
            activeCursors, cursorPositions, nodeTriggerHistory, 
            globalBend, effectiveScale, dynamicSize, view, time 
        } = state;

        const bgCtx = bgCanvas.getContext('2d', { alpha: true });
        const staticCtx = staticCanvas.getContext('2d', { alpha: true });
        const activeCtx = dynamicCanvas.getContext('2d', { alpha: true });

        if (!bgCtx || !staticCtx || !activeCtx) return;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);
        
        // Sync canvas dimensions
        if (bgCanvas.width !== dynamicSize * dpr || bgCanvas.height !== dynamicSize * dpr) {
            [bgCanvas, staticCanvas, dynamicCanvas].forEach(c => {
                c.width = dynamicSize * dpr;
                c.height = dynamicSize * dpr;
            });
            bgCtx.scale(dpr, dpr);
            staticCtx.scale(dpr, dpr);
            activeCtx.scale(dpr, dpr);
        } else {
            // Ensure transform is reset if we don't resize, to prevent drift or accumulation
            bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        // View Culling Calculation
        const pixelOffset = -globalBend * (PITCH_SCALE / 12) * effectiveScale;
        const viewPad = 300; 
        const leftBound = view.x - viewPad;
        const rightBound = view.x + view.w + viewPad;
        const topBound = view.y - viewPad - pixelOffset; 
        const bottomBound = view.y + view.h + viewPad - pixelOffset;

        // Clear Viewport (optimization: only clear visible area + padding)
        const clearX = Math.max(0, leftBound);
        const clearY = Math.max(0, topBound);
        const clearW = Math.min(dynamicSize, rightBound) - clearX;
        const clearH = Math.min(dynamicSize, bottomBound) - clearY;

        bgCtx.clearRect(0, 0, dynamicSize, dynamicSize); // BG lines change rarely, could optimize, but they handle active animations
        // For static, we might want to redraw everything if it changes, but here we redraw per frame for simplicity in this refactor
        staticCtx.clearRect(0, 0, dynamicSize, dynamicSize); 
        activeCtx.clearRect(0, 0, dynamicSize, dynamicSize);

        const centerOffset = dynamicSize / 2;
        const spacing = settings.buttonSpacingScale * effectiveScale;
        const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;
        const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
        const colorCache = settings.colors;
        const isJIOverride = settings.tuningSystem === 'ji' && settings.layoutApproach !== 'lattice' && settings.layoutApproach !== 'diamond';

        // --- 1. RENDER BACKGROUND LINES (Active & Static) ---
        bgCtx.lineCap = 'round';
        
        // A. Static Grid Lines (Only if not brightened/active)
        // Optimization: We could skip static lines if we cached them, but drawing lines is cheap.
        const baseWidth = settings.baseLineWidth || 1.0;
        const linesByLimit: Record<number, number[]> = {};
        
        // Group lines by limit for batch drawing
        for (const line of data.lines) {
            // Skip lines that are currently "active" (drawn later)
            // Note: This check is O(N*M) effectively if arrays are large, but usually small enough.
            // For max performance, activeLines should be a Set of IDs.
            // Optimization: Just draw everything, active lines draw ON TOP.
            
            if (!linesByLimit[line.limit]) linesByLimit[line.limit] = [];
            const arr = linesByLimit[line.limit];
            arr.push(line.x1 * spacing + centerOffset, line.y1 * spacing + centerOffset, line.x2 * spacing + centerOffset, line.y2 * spacing + centerOffset);
        }

        for (const limitStr in linesByLimit) {
            const limit = parseInt(limitStr);
            const coords = linesByLimit[limit];
            const color = isJIOverride ? '#fff' : (colorCache[limit] || '#666');
            
            bgCtx.beginPath();
            for(let i=0; i<coords.length; i+=4) {
                // Simple culling
                if (Math.max(coords[i], coords[i+2]) < leftBound || Math.min(coords[i], coords[i+2]) > rightBound || 
                    Math.max(coords[i+1], coords[i+3]) < topBound || Math.min(coords[i+1], coords[i+3]) > bottomBound) continue;
                
                bgCtx.moveTo(coords[i], coords[i+1]);
                bgCtx.lineTo(coords[i+2], coords[i+3]);
            }
            bgCtx.lineWidth = (limit === 1 ? Math.max(2.5, baseWidth * 2.5) : baseWidth) * effectiveScale; 
            bgCtx.strokeStyle = color;
            bgCtx.globalAlpha = (isJIOverride ? 0.15 : 0.3); 
            
            if (limit === 1) bgCtx.setLineDash([5 * effectiveScale, 5 * effectiveScale]);
            else bgCtx.setLineDash([]);
            bgCtx.stroke();
        }
        bgCtx.setLineDash([]); 

        // B. Brightened Lines (Voice Leading Hints)
        if (brightenedLines.length > 0) {
            const brightWidth = settings.lineBrighteningWidth || 1.0;
            for (const line of brightenedLines) {
                const x1 = line.x1 * spacing + centerOffset;
                const y1 = line.y1 * spacing + centerOffset;
                const x2 = line.x2 * spacing + centerOffset;
                const y2 = line.y2 * spacing + centerOffset;
                
                if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;
                
                const limitColor = isJIOverride ? '#fff' : (colorCache[line.limit] || '#666');
                bgCtx.beginPath();
                bgCtx.moveTo(x1, y1);
                bgCtx.lineTo(x2, y2);
                bgCtx.lineWidth = brightWidth * effectiveScale;
                bgCtx.strokeStyle = limitColor;
                bgCtx.globalAlpha = isJIOverride ? 0.4 : 0.8; 
                bgCtx.stroke();
            }
        }

        // C. Active Lines (Currently sounding intervals)
        const animationSpeed = (settings.voiceLeadingAnimationSpeed || 2.0) * 0.33;
        const rawPhase = (time * 0.001 * animationSpeed);
        const flowPhase = settings.voiceLeadingReverseDir ? (1.0 - (rawPhase % 1.0)) : (rawPhase % 1.0);

        for (const line of activeLines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;
            
            if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;
            
            const limitColor = isJIOverride ? '#fff' : (colorCache[line.limit] || '#666');
            
            // Solid base
            bgCtx.beginPath();
            bgCtx.moveTo(x1, y1);
            bgCtx.lineTo(x2, y2);
            bgCtx.lineWidth = (isJIOverride ? 2 : 4) * effectiveScale;
            bgCtx.strokeStyle = limitColor;
            bgCtx.globalAlpha = 1.0;
            bgCtx.stroke();

            // Animated flow
            if (settings.isVoiceLeadingAnimationEnabled) {
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
                
                bgCtx.beginPath();
                bgCtx.moveTo(x1, y1);
                bgCtx.lineTo(x2, y2);
                
                // Glow
                bgCtx.strokeStyle = grad;
                bgCtx.lineWidth = 10 * (0.5 + settings.voiceLeadingGlowAmount) * effectiveScale;
                bgCtx.globalAlpha = 0.3; 
                bgCtx.stroke();
                
                // Core
                bgCtx.lineWidth = 4 * effectiveScale;
                bgCtx.globalAlpha = 1.0;
                bgCtx.stroke();
            }
        }

        // --- 2. RENDER STATIC NODES ---
        // Iterate all nodes
        for (const node of data.nodes) {
            const x = node.x * spacing + centerOffset;
            const y = node.y * spacing + centerOffset;
            
            // Cull
            if (x < leftBound || x > rightBound || y < topBound || y > bottomBound) continue;

            const cTop = isJIOverride ? '#fff' : (colorCache[node.limitTop] || '#666');
            const cBottom = isJIOverride ? '#eee' : (colorCache[node.limitBottom] || '#666');
            
            const radius = baseRadius; // Static nodes always base size

            staticCtx.globalAlpha = 1.0;
            staticCtx.beginPath();
            if (isDiamond) {
                staticCtx.moveTo(x, y - radius);
                staticCtx.lineTo(x + radius, y);
                staticCtx.lineTo(x, y + radius);
                staticCtx.lineTo(x - radius, y);
            } else {
                staticCtx.arc(x, y, radius, 0, Math.PI * 2);
            }
            staticCtx.closePath();

            if (isJIOverride) {
                staticCtx.fillStyle = '#111';
                staticCtx.fill();
                staticCtx.lineWidth = 2 * effectiveScale;
                staticCtx.strokeStyle = '#fff';
                staticCtx.stroke();
            } else {
                const grad = staticCtx.createLinearGradient(x, y - radius, x, y + radius);
                grad.addColorStop(0.45, cTop);
                grad.addColorStop(0.55, cBottom);
                staticCtx.fillStyle = grad;
                staticCtx.fill();
            }

            const combinedScale = settings.buttonSizeScale; 
            if (combinedScale > 0.4) {
                staticCtx.fillStyle = isJIOverride ? '#fff' : 'white';
                staticCtx.textAlign = 'center';
                staticCtx.textBaseline = 'middle';
                let fontSize = Math.max(10, Math.min(18, 14 * combinedScale)) * settings.nodeTextSizeScale * effectiveScale;
                staticCtx.font = `bold ${fontSize}px sans-serif`; 
                
                const spacingY = settings.showFractionBar ? 0.55 : 0.50;
                staticCtx.fillText(node.n.toString(), x, y - (radius * spacingY));
                if (settings.showFractionBar) {
                    staticCtx.beginPath();
                    staticCtx.moveTo(x - (radius * 0.4), y);
                    staticCtx.lineTo(x + (radius * 0.4), y);
                    staticCtx.lineWidth = 1 * effectiveScale;
                    staticCtx.strokeStyle = isJIOverride ? 'rgba(255,255,255,0.4)' : `rgba(255,255,255,0.8)`;
                    staticCtx.stroke();
                }
                staticCtx.fillText(node.d.toString(), x, y + (radius * spacingY));
            }
        }

        // --- 3. RENDER ACTIVE OVERLAYS (Latched Nodes, Ripples, Cursors) ---
        activeCtx.lineCap = 'round';

        // A. Latched/Active Nodes
        for (const id of visualLatchedNodes.keys()) {
             // Find node data
             // Optimization: nodeMap should be passed or we assume O(N) lookup. 
             // Ideally map is passed in state. For now, find is okay for small N active nodes.
             const node = data.nodes.find(n => n.id === id); 
             if (!node) continue;

             const x = node.x * spacing + centerOffset;
             const y = node.y * spacing + centerOffset;
             
             if (x < leftBound || x > rightBound || y < topBound || y > bottomBound) continue;

             const cTop = isJIOverride ? '#fff' : (colorCache[node.limitTop] || '#666');
             const zoomScale = settings.latchedZoomScale;
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
                 activeCtx.fillStyle = '#fff';
             } else {
                 const grad = activeCtx.createLinearGradient(x, y - radius, x, y + radius);
                 grad.addColorStop(0.45, cTop);
                 grad.addColorStop(0.55, colorCache[node.limitBottom] || '#666');
                 activeCtx.fillStyle = grad;
             }
             activeCtx.fill();

             // Outline / Halo
             if (settings.isColoredIlluminationEnabled && !isJIOverride) {
                 const rp = getRainbowPeriod(settings.buttonSpacingScale * effectiveScale);
                 const phase = (y % rp) / rp;
                 const hue = (settings.rainbowOffset + phase * 360) % 360;
                 const sat = settings.isRainbowModeEnabled ? settings.rainbowSaturation : 100;
                 activeCtx.strokeStyle = `hsl(${hue}, ${sat}%, 60%)`;
                 activeCtx.lineWidth = 4 * effectiveScale;
             } else {
                 activeCtx.strokeStyle = isJIOverride ? '#fff' : 'white';
                 activeCtx.lineWidth = isJIOverride ? 4 * effectiveScale : 3 * effectiveScale;
                 if (isJIOverride) {
                    activeCtx.shadowBlur = 10 * effectiveScale;
                    activeCtx.shadowColor = '#fff';
                 }
             }
             activeCtx.stroke();
             activeCtx.shadowBlur = 0; 

             // Text Label
             const combinedScale = settings.buttonSizeScale * zoomScale;
             if (combinedScale > 0.4) {
                activeCtx.fillStyle = isJIOverride ? '#000' : 'white';
                activeCtx.textAlign = 'center';
                activeCtx.textBaseline = 'middle';
                let fontSize = Math.max(12, Math.min(22, 16 * combinedScale)) * settings.nodeTextSizeScale * effectiveScale;
                activeCtx.font = `bold ${fontSize}px sans-serif`; 
                const spacingY = settings.showFractionBar ? 0.55 : 0.50;
                activeCtx.fillText(node.n.toString(), x, y - (radius * spacingY));
                if (settings.showFractionBar) {
                    activeCtx.beginPath();
                    activeCtx.moveTo(x - (radius * 0.4), y);
                    activeCtx.lineTo(x + (radius * 0.4), y);
                    activeCtx.lineWidth = 1 * effectiveScale;
                    activeCtx.strokeStyle = isJIOverride ? 'rgba(0,0,0,0.5)' : 'white';
                    activeCtx.stroke();
                }
                activeCtx.fillText(node.d.toString(), x, y + (radius * spacingY));
             }
        }

        // B. Trigger Ripples
        const now = Date.now();
        const rippleDuration = 500; 
        activeCtx.lineWidth = 2 * effectiveScale;
        activeCtx.strokeStyle = 'white';
        
        nodeTriggerHistory.forEach((timestamp, nodeId) => {
            const age = now - timestamp;
            if (age > rippleDuration) return; // Cleanup handled in component usually, but we skip render here
            
            const node = data.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const x = node.x * spacing + centerOffset;
            const y = node.y * spacing + centerOffset;
            
            if (x < leftBound || x > rightBound || y < topBound || y > bottomBound) return;

            const progress = age / rippleDuration;
            const eased = 1 - Math.pow(1 - progress, 3);
            const rippleRadius = baseRadius * (1 + eased * 1.5);
            const opacity = 1.0 - progress;
            
            activeCtx.beginPath();
            activeCtx.arc(x, y, rippleRadius, 0, Math.PI * 2);
            activeCtx.globalAlpha = opacity;
            activeCtx.stroke();
        });
        activeCtx.globalAlpha = 1.0;

        // C. Pitch Bend Cursors
        if (settings.isPitchBendEnabled) {
            activeCursors.forEach(c => {
                if (c.originNodeId) {
                    const node = data.nodes.find(n => n.id === c.originNodeId);
                    if (node) {
                         const nx = node.x * spacing + centerOffset;
                         const ny = node.y * spacing + centerOffset;
                         
                         const pos = cursorPositions.get(c.pointerId);
                         if (!pos) return;
                         
                         // Map screen space back to canvas space using View scroll
                         const cx = (pos.x - view.x) + view.x; // Wait, view.x is scrollLeft.
                         // Logic check: component passed us view.x/y as scroll positions.
                         // The event coordinates `pos.x` are clientX (screen relative).
                         // We need activeCanvas relative coords.
                         // activeCanvas is absolute size `dynamicSize`.
                         // But we are drawing inside a transformed container or handled via scroll?
                         // The component handles scrolling via `overflow: auto` on container.
                         // The canvases are inside `wrapperRef` which is sized to `dynamicSize`.
                         // So canvas coords = scrollLeft + clientX - containerLeft.
                         
                         // We need the bounding rect of the scroll container to normalize clientX
                         // NOTE: The `cursorPositions` passed in state should ideally be pre-calculated to CANVAS coordinates
                         // to keep the renderer pure. However, `TonalityDiamond` logic passes raw clientX/Y currently.
                         // Let's assume the passed `cursorPositions` are raw clientX/Y and we use `view` to adjust.
                         // Actually, let's fix this by calculating the canvas-relative coords here.
                         // But we don't have the container rect.
                         // Standard fix: The component calculates canvas-relative coords before passing to renderer.
                         // SEE COMPONENT UPDATE below.
                         
                         // For now, assuming cursorPositions are raw clientX/Y, we can't accurately draw without container Rect.
                         // I will update the Component to pass canvas-relative coordinates in `cursorPositions`.
                         
                         const cx_rel = pos.x; // Now assuming this is pre-transformed to Canvas Space
                         const cy_rel = pos.y;

                         activeCtx.beginPath();
                         activeCtx.moveTo(nx, ny);
                         activeCtx.lineTo(cx_rel, cy_rel);
                         activeCtx.strokeStyle = isJIOverride ? '#fff' : 'white';
                         activeCtx.lineWidth = 2 * effectiveScale;
                         activeCtx.globalAlpha = 0.5;
                         activeCtx.stroke();
                         activeCtx.globalAlpha = 1.0;
                    }
                }
            });
        }
    }
}
