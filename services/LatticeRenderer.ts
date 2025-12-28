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
    // Cache keys to prevent unnecessary redraws
    private lastData: any = null;
    private lastSettingsSignature: string = '';
    private lastSize: number = 0;
    private lastScale: number = 0;
    
    // Track if BG lines need update (dependent on brightened/active lines mostly, but brightened lines modify BG appearance)
    private lastBrightenedLines: LatticeLine[] = [];
    
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
        
        let needsFullRedraw = false;

        // Sync canvas dimensions
        if (bgCanvas.width !== dynamicSize * dpr || bgCanvas.height !== dynamicSize * dpr) {
            [bgCanvas, staticCanvas, dynamicCanvas].forEach(c => {
                c.width = dynamicSize * dpr;
                c.height = dynamicSize * dpr;
            });
            bgCtx.scale(dpr, dpr);
            staticCtx.scale(dpr, dpr);
            activeCtx.scale(dpr, dpr);
            needsFullRedraw = true;
        } else {
            // Ensure transform is reset if we don't resize, to prevent drift or accumulation
            bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        const settingsSig = JSON.stringify({
            spacing: settings.buttonSpacingScale,
            size: settings.buttonSizeScale,
            colors: settings.colors,
            layout: settings.layoutApproach,
            vis: settings.limitVisuals,
            shape: settings.buttonShape,
            text: settings.nodeTextSizeScale,
            fraction: settings.showFractionBar,
            width: settings.baseLineWidth,
            bright: settings.lineBrighteningWidth
        });

        // Determine if static layers need update
        const staticDirty = needsFullRedraw || 
                            data !== this.lastData || 
                            settingsSig !== this.lastSettingsSignature ||
                            effectiveScale !== this.lastScale ||
                            dynamicSize !== this.lastSize;

        // Determine if background lines need update (e.g. line brightening on hover)
        const bgDirty = staticDirty || brightenedLines !== this.lastBrightenedLines;

        if (staticDirty) {
            this.lastData = data;
            this.lastSettingsSignature = settingsSig;
            this.lastScale = effectiveScale;
            this.lastSize = dynamicSize;
        }
        
        if (bgDirty) {
            this.lastBrightenedLines = brightenedLines;
        }

        // View Culling Calculation
        const pixelOffset = -globalBend * (PITCH_SCALE / 12) * effectiveScale;
        const viewPad = 300; 
        const leftBound = view.x - viewPad;
        const rightBound = view.x + view.w + viewPad;
        const topBound = view.y - viewPad - pixelOffset; 
        const bottomBound = view.y + view.h + viewPad - pixelOffset;

        const centerOffset = dynamicSize / 2;
        const spacing = settings.buttonSpacingScale * effectiveScale;
        const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;
        const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
        const colorCache = settings.colors;
        const isJIOverride = settings.tuningSystem === 'ji' && settings.layoutApproach !== 'lattice' && settings.layoutApproach !== 'diamond';

        // --- 1. RENDER BACKGROUND LINES (Cached) ---
        if (bgDirty) {
            bgCtx.clearRect(0, 0, dynamicSize, dynamicSize);
            bgCtx.lineCap = 'round';
            
            const baseWidth = settings.baseLineWidth || 1.0;
            const linesByLimit: Record<number, number[]> = {};
            
            // Group lines by limit for batch drawing
            for (const line of data.lines) {
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
                    // Culling for initial draw
                    if (Math.max(coords[i], coords[i+2]) < 0 || Math.min(coords[i], coords[i+2]) > dynamicSize || 
                        Math.max(coords[i+1], coords[i+3]) < 0 || Math.min(coords[i+1], coords[i+3]) > dynamicSize) continue;
                    
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

            // Brightened Lines (Voice Leading Hints)
            if (brightenedLines.length > 0) {
                const brightWidth = settings.lineBrighteningWidth || 1.0;
                for (const line of brightenedLines) {
                    const x1 = line.x1 * spacing + centerOffset;
                    const y1 = line.y1 * spacing + centerOffset;
                    const x2 = line.x2 * spacing + centerOffset;
                    const y2 = line.y2 * spacing + centerOffset;
                    
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
        }

        // --- 2. RENDER STATIC NODES (Cached) ---
        if (staticDirty) {
            staticCtx.clearRect(0, 0, dynamicSize, dynamicSize);
            for (const node of data.nodes) {
                const x = node.x * spacing + centerOffset;
                const y = node.y * spacing + centerOffset;
                
                // Aggressive culling not needed for static if cached, but good practice
                // Note: Static canvas needs full content for scrolling if we don't redraw on scroll
                // But current architecture uses native scroll on container, so we MUST draw everything.
                
                const cTop = isJIOverride ? '#fff' : (colorCache[node.limitTop] || '#666');
                const cBottom = isJIOverride ? '#eee' : (colorCache[node.limitBottom] || '#666');
                
                const radius = baseRadius; 

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
        }

        // --- 3. RENDER ACTIVE OVERLAYS (Every Frame) ---
        // Clear Active Canvas (Consider Viewport Optimization)
        // Optimization: Clearing visible rect is safer for fill-rate, but clearing full canvas handles artifacts.
        // Given 25MP worst case, let's try to clear mostly what we see + margin
        // To be safe against fast scrolls, we clear slightly more.
        const clearX = Math.max(0, leftBound);
        const clearY = Math.max(0, topBound);
        const clearW = Math.min(dynamicSize, rightBound) - clearX;
        const clearH = Math.min(dynamicSize, bottomBound) - clearY;
        
        // Due to pitch bend offset, bottomBound might be larger than canvas.
        // Safe approach for dynamic: clear whole thing if small, or viewport if large.
        activeCtx.clearRect(0, 0, dynamicSize, dynamicSize);

        activeCtx.lineCap = 'round';

        // A. Active Lines (Currently sounding intervals)
        // Note: Active Lines animate, so they belong in dynamic loop or separate animated layer
        // Since we moved BG lines to cached canvas, active lines must be drawn on activeCtx or a separate layer.
        // Let's draw them on activeCtx for animation smoothness.
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
            activeCtx.beginPath();
            activeCtx.moveTo(x1, y1);
            activeCtx.lineTo(x2, y2);
            activeCtx.lineWidth = (isJIOverride ? 2 : 4) * effectiveScale;
            activeCtx.strokeStyle = limitColor;
            activeCtx.globalAlpha = 1.0;
            activeCtx.stroke();

            // Animated flow
            if (settings.isVoiceLeadingAnimationEnabled) {
                const grad = activeCtx.createLinearGradient(x1, y1, x2, y2);
                const p = flowPhase;
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                const pulseWidth = 0.2;
                const start = Math.max(0, p - pulseWidth);
                const end = Math.min(1, p + pulseWidth);
                if (start > 0) grad.addColorStop(start, 'rgba(255,255,255,0)');
                grad.addColorStop(p, isJIOverride ? 'rgba(255,255,255,1.0)' : 'rgba(255,255,255,0.7)'); 
                if (end < 1) grad.addColorStop(end, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                
                activeCtx.beginPath();
                activeCtx.moveTo(x1, y1);
                activeCtx.lineTo(x2, y2);
                
                // Glow
                activeCtx.strokeStyle = grad;
                activeCtx.lineWidth = 10 * (0.5 + settings.voiceLeadingGlowAmount) * effectiveScale;
                activeCtx.globalAlpha = 0.3; 
                activeCtx.stroke();
                
                // Core
                activeCtx.lineWidth = 4 * effectiveScale;
                activeCtx.globalAlpha = 1.0;
                activeCtx.stroke();
            }
        }

        // B. Latched/Active Nodes
        for (const id of visualLatchedNodes.keys()) {
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

        // C. Trigger Ripples
        const now = Date.now();
        const rippleDuration = 500; 
        activeCtx.lineWidth = 2 * effectiveScale;
        activeCtx.strokeStyle = 'white';
        
        nodeTriggerHistory.forEach((timestamp, nodeId) => {
            const age = now - timestamp;
            if (age > rippleDuration) return;
            
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

        // D. Pitch Bend Cursors
        if (settings.isPitchBendEnabled) {
            activeCursors.forEach(c => {
                if (c.originNodeId) {
                    const node = data.nodes.find(n => n.id === c.originNodeId);
                    if (node) {
                         const nx = node.x * spacing + centerOffset;
                         const ny = node.y * spacing + centerOffset;
                         
                         const pos = cursorPositions.get(c.pointerId);
                         if (!pos) return;
                         
                         // Pos is already canvas-relative from component logic
                         const cx_rel = pos.x; 
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