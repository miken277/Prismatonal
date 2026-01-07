
import { LatticeNode, LatticeLine, AppSettings, ButtonShape } from '../types';
import { MODE_COLORS } from '../constants';

interface NodeActivation {
    mode: number | string;
    timestamp: number;
    presetId: string;
}

interface ViewPort {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface RenderState {
    data: { nodes: LatticeNode[], lines: LatticeLine[] };
    settings: AppSettings;
    visualLatchedNodes: Map<string, NodeActivation[]>;
    activeLines: LatticeLine[];
    brightenedLines: LatticeLine[];
    harmonicNeighbors: Map<string, number>; // Maps NodeID -> Lowest Limit connecting to it
    activeCursors: Map<number, any>; 
    cursorPositions: Map<number, {x: number, y: number}>;
    nodeTriggerHistory: Map<string, number>;
    globalBend: number;
    effectiveScale: number;
    centerOffset: number; 
    view: ViewPort;
    time: number;
    latchMode: number;
}

// Render Order Priority (Highest = Topmost/Outer Ring)
const MODE_PRIORITY: Record<string | number, number> = {
    0: 0, // Cursor
    3: 1, // Strum
    2: 2, // Strings
    4: 3, // Brass
    5: 4, // Keys
    'arp': 5, // Arp
    1: 6  // Drone (Top)
};

interface SkinColors {
    bg: string;
    line: string;
    lineDim: string;
    nodeText: string;
    nodeStroke: string;
    nodeFill: (limit: number, colorMap: Record<number, string>) => string | CanvasGradient;
    shadow: string;
}

export class LatticeRenderer {
    private prevStaticDeps: string = "";
    private cachedDataNodes: LatticeNode[] | null = null;
    private cachedNodeMap: Map<string, LatticeNode> = new Map();

    render(
        bgCanvas: HTMLCanvasElement,
        staticCanvas: HTMLCanvasElement,
        activeCanvas: HTMLCanvasElement,
        state: RenderState
    ) {
        this.renderStatic(staticCanvas, state);
        this.renderDynamic(bgCanvas, activeCanvas, state);
    }

    private getSkinConfig(skin: string, ctx: CanvasRenderingContext2D): SkinColors {
        switch (skin) {
            case 'paper':
                return {
                    bg: '#f8fafc', // Slate-50
                    line: '#94a3b8', // Slate-400
                    lineDim: 'rgba(148, 163, 184, 0.2)',
                    nodeText: '#334155', // Slate-700
                    nodeStroke: '#334155',
                    nodeFill: () => '#ffffff',
                    shadow: 'rgba(0,0,0,0.1)'
                };
            case 'blueprint':
                return {
                    bg: '#1e3a8a', // Blue-900
                    line: 'rgba(147, 197, 253, 0.4)', // Blue-300
                    lineDim: 'rgba(147, 197, 253, 0.1)',
                    nodeText: '#dbeafe', // Blue-100
                    nodeStroke: '#93c5fd',
                    nodeFill: () => '#172554', // Blue-950
                    shadow: 'rgba(0,0,0,0.3)'
                };
            case 'cyber':
                return {
                    bg: '#000000',
                    line: '#333333',
                    lineDim: '#111111',
                    nodeText: '#ffffff',
                    nodeStroke: '#444444',
                    nodeFill: () => '#000000',
                    shadow: '#00ff00'
                };
            case 'default':
            default:
                return {
                    bg: 'transparent',
                    line: '#666',
                    lineDim: 'rgba(255,255,255,0.1)',
                    nodeText: '#ffffff',
                    nodeStroke: 'transparent',
                    nodeFill: (limit, map) => map[limit] || '#666',
                    shadow: 'black'
                };
        }
    }

    private renderStatic(canvas: HTMLCanvasElement, state: RenderState) {
        const { data, settings, effectiveScale, centerOffset, view } = state;
        
        const deps = JSON.stringify({
            tuning: settings.tuningSystem,
            layout: settings.layoutApproach,
            skin: settings.activeSkin,
            size: settings.buttonSizeScale,
            spacing: settings.buttonSpacingScale,
            colors: settings.colors,
            visuals: settings.limitVisuals,
            shape: settings.buttonShape,
            textScale: settings.nodeTextSizeScale,
            fractionBar: settings.showFractionBar,
            scale: effectiveScale,
            nodesLen: data.nodes.length,
            linesLen: data.lines.length,
            vx: view.x, vy: view.y, vw: view.w, vh: view.h 
        });

        if (deps === this.prevStaticDeps) return;
        this.prevStaticDeps = deps;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);
        
        if (canvas.width !== view.w * dpr || canvas.height !== view.h * dpr) {
            canvas.width = view.w * dpr;
            canvas.height = view.h * dpr;
        }
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        
        ctx.translate(-view.x, -view.y);

        const spacing = settings.buttonSpacingScale * effectiveScale;
        const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;
        const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
        
        const skin = this.getSkinConfig(settings.activeSkin, ctx);
        const isFlatSkin = settings.activeSkin !== 'default';

        const cullPad = 200;
        const cullLeft = view.x - cullPad;
        const cullRight = view.x + view.w + cullPad;
        const cullTop = view.y - cullPad;
        const cullBottom = view.y + view.h + cullPad;

        // Draw Lines with Consonance Weighting
        const linesByLimit: Record<number, number[]> = {};
        for (const line of data.lines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;

            if (Math.max(x1, x2) < cullLeft || Math.min(x1, x2) > cullRight || Math.max(y1, y2) < cullTop || Math.min(y1, y2) > cullBottom) continue;

            if (!linesByLimit[line.limit]) linesByLimit[line.limit] = [];
            linesByLimit[line.limit].push(x1, y1, x2, y2);
        }

        ctx.lineCap = 'round';
        for (const limitStr in linesByLimit) {
            const limit = parseInt(limitStr);
            const coords = linesByLimit[limit];
            
            let color = settings.colors[limit] || '#666';
            if (isFlatSkin) {
                color = limit === 1 ? skin.line : skin.lineDim;
            }

            const visualSettings = settings.limitVisuals?.[limit] || { size: 1, opacity: 1 };
            
            // Consonance Weighting Logic
            let weight = 1.0;
            let baseAlpha = 0.3;

            if (limit === 1) { weight = 3.0; baseAlpha = 0.5; } // Octave
            else if (limit === 3) { weight = 2.5; baseAlpha = 0.45; } // P5 (Strong)
            else if (limit === 5) { weight = 1.8; baseAlpha = 0.35; } // M3 (Medium)
            else { weight = 0.8; baseAlpha = 0.2; } // 7, 11, 13 etc (Weak)

            ctx.beginPath();
            for(let i=0; i<coords.length; i+=4) {
                ctx.moveTo(coords[i], coords[i+1]);
                ctx.lineTo(coords[i+2], coords[i+3]);
            }
            
            ctx.lineWidth = weight * visualSettings.size * effectiveScale;
            ctx.strokeStyle = color;
            ctx.globalAlpha = isFlatSkin ? 1.0 : baseAlpha * visualSettings.opacity;
            
            if (limit === 1) ctx.setLineDash([5 * effectiveScale, 5 * effectiveScale]);
            else ctx.setLineDash([]);
            ctx.stroke();
        }
        ctx.setLineDash([]); 

        // Draw Nodes
        for (const node of data.nodes) {
            const x = node.x * spacing + centerOffset;
            const y = node.y * spacing + centerOffset;
            
            if (x < cullLeft || x > cullRight || y < cullTop || y > cullBottom) continue;

            const topVis = settings.limitVisuals?.[node.limitTop] || { size: 1, opacity: 1 };
            const limitScale = topVis.size;
            const limitOpacity = topVis.opacity;
            const radius = Math.max(0, baseRadius * limitScale);

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

            if (isFlatSkin) {
                ctx.fillStyle = skin.nodeFill(node.limitTop, settings.colors) as string;
                ctx.fill();
                ctx.lineWidth = 2 * effectiveScale;
                ctx.strokeStyle = skin.nodeStroke;
                ctx.stroke();
            } else {
                // Default Gradient
                const cTop = settings.colors[node.limitTop] || '#666';
                const cBottom = settings.colors[node.limitBottom] || '#666';
                const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
                grad.addColorStop(0.45, cTop);
                grad.addColorStop(0.55, cBottom);
                ctx.fillStyle = grad;
                ctx.fill();
            }

            const combinedScale = settings.buttonSizeScale * limitScale;
            if (combinedScale > 0.4) {
                ctx.fillStyle = skin.nodeText;
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
                    ctx.strokeStyle = isFlatSkin ? 'rgba(0,0,0,0.2)' : `rgba(255,255,255,${0.8 * limitOpacity})`;
                    if (settings.activeSkin === 'cyber') ctx.strokeStyle = '#fff';
                    ctx.stroke();
                }
                ctx.fillText(node.d.toString(), x, y + (radius * spacingY));
            }
        }
    }

    private renderDynamic(bgCanvas: HTMLCanvasElement, activeCanvas: HTMLCanvasElement, state: RenderState) {
        const { 
            data, settings, visualLatchedNodes, activeLines, brightenedLines, harmonicNeighbors,
            activeCursors, cursorPositions, effectiveScale, centerOffset, view, time, latchMode 
        } = state;

        if (this.cachedDataNodes !== data.nodes) {
            this.cachedNodeMap = new Map(data.nodes.map(n => [n.id, n]));
            this.cachedDataNodes = data.nodes;
        }

        const bgCtx = bgCanvas.getContext('2d', { alpha: true });
        const activeCtx = activeCanvas.getContext('2d', { alpha: true });
        if (!bgCtx || !activeCtx) return;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);

        if (bgCanvas.width !== view.w * dpr || bgCanvas.height !== view.h * dpr) {
            bgCanvas.width = view.w * dpr;
            bgCanvas.height = view.h * dpr;
            activeCanvas.width = view.w * dpr;
            activeCanvas.height = view.h * dpr;
        }
        
        bgCtx.setTransform(1, 0, 0, 1, 0, 0);
        activeCtx.setTransform(1, 0, 0, 1, 0, 0);

        // Clear only viewport
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);

        // Transform
        bgCtx.scale(dpr, dpr);
        activeCtx.scale(dpr, dpr);
        bgCtx.translate(-view.x, -view.y);
        activeCtx.translate(-view.x, -view.y);

        const spacing = settings.buttonSpacingScale * effectiveScale;
        const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;
        const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
        
        const skin = this.getSkinConfig(settings.activeSkin, activeCtx);
        const isFlatSkin = settings.activeSkin !== 'default';

        const animationSpeed = (settings.voiceLeadingAnimationSpeed || 2.0) * 0.33;
        const rawPhase = (time * 0.001 * animationSpeed);
        const flowPhase = settings.voiceLeadingReverseDir ? (1.0 - (rawPhase % 1.0)) : (rawPhase % 1.0);

        const cullPad = 200;
        const cullLeft = view.x - cullPad;
        const cullRight = view.x + view.w + cullPad;
        const cullTop = view.y - cullPad;
        const cullBottom = view.y + view.h + cullPad;

        bgCtx.lineCap = 'round';
        activeCtx.lineCap = 'round';

        // 0. Draw Harmonic Neighbor Hints
        // Drawn on activeCtx but behind active nodes (since active nodes are drawn later in this function)
        // These will overlay the static nodes (z-index 20 vs 10), effectively tinting them
        if (harmonicNeighbors.size > 0) {
            for (const [id, limit] of harmonicNeighbors.entries()) {
                const node = this.cachedNodeMap.get(id);
                if (!node) continue;
                
                const x = node.x * spacing + centerOffset;
                const y = node.y * spacing + centerOffset;
                
                if (x < cullLeft || x > cullRight || y < cullTop || y > cullBottom) continue;

                // Determine highlight color based on limit
                const color = settings.colors[limit] || '#ffffff';
                const vis = settings.limitVisuals?.[node.limitTop] || { size: 1 };
                const limitScale = vis.size;
                const radius = Math.max(0, baseRadius * limitScale * 1.3); // Slight halo

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

                // Draw a stroke ring
                activeCtx.lineWidth = 3 * effectiveScale;
                activeCtx.strokeStyle = color;
                activeCtx.globalAlpha = 0.6;
                activeCtx.stroke();
                
                // Draw a fill tint
                activeCtx.fillStyle = color;
                activeCtx.globalAlpha = 0.15;
                activeCtx.fill();
            }
        }

        // 1. Draw Brightened Lines
        if (brightenedLines.length > 0) {
            bgCtx.setLineDash([]);
            for (const line of brightenedLines) {
                const x1 = line.x1 * spacing + centerOffset;
                const y1 = line.y1 * spacing + centerOffset;
                const x2 = line.x2 * spacing + centerOffset;
                const y2 = line.y2 * spacing + centerOffset;
                
                if (Math.max(x1, x2) < cullLeft || Math.min(x1, x2) > cullRight || Math.max(y1, y2) < cullTop || Math.min(y1, y2) > cullBottom) continue;
                
                let limitColor = settings.colors[line.limit] || '#666';
                if (isFlatSkin) limitColor = skin.line;

                bgCtx.beginPath();
                bgCtx.moveTo(x1, y1);
                bgCtx.lineTo(x2, y2);
                bgCtx.lineWidth = (settings.lineBrighteningWidth || 1.0) * effectiveScale;
                bgCtx.strokeStyle = limitColor;
                bgCtx.globalAlpha = isFlatSkin ? 0.6 : 0.8; 
                bgCtx.stroke();
            }
        }

        // 2. Draw Active Lines
        bgCtx.setLineDash([]); 
        for (const line of activeLines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;
            if (Math.max(x1, x2) < cullLeft || Math.min(x1, x2) > cullRight || Math.max(y1, y2) < cullTop || Math.min(y1, y2) > cullBottom) continue;
            
            let limitColor = settings.colors[line.limit] || '#666';
            if (isFlatSkin) limitColor = skin.nodeStroke;

            bgCtx.beginPath();
            bgCtx.moveTo(x1, y1);
            bgCtx.lineTo(x2, y2);
            bgCtx.lineWidth = (isFlatSkin ? 2 : 4) * effectiveScale;
            bgCtx.strokeStyle = limitColor;
            bgCtx.globalAlpha = 1.0;
            bgCtx.stroke();
            
            if (settings.isVoiceLeadingAnimationEnabled) {
                const grad = bgCtx.createLinearGradient(x1, y1, x2, y2);
                const p = flowPhase;
                const bright = isFlatSkin ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)';
                const clear = 'rgba(255,255,255,0)';
                
                grad.addColorStop(0, clear);
                const pulseWidth = 0.2;
                const start = Math.max(0, p - pulseWidth);
                const end = Math.min(1, p + pulseWidth);
                if (start > 0) grad.addColorStop(start, clear);
                grad.addColorStop(p, bright); 
                if (end < 1) grad.addColorStop(end, clear);
                grad.addColorStop(1, clear);
                
                bgCtx.strokeStyle = grad;
                bgCtx.lineWidth = 10 * (0.5 + settings.voiceLeadingGlowAmount) * effectiveScale;
                bgCtx.globalAlpha = 0.3; 
                bgCtx.stroke();
                
                bgCtx.lineWidth = 4 * effectiveScale;
                bgCtx.globalAlpha = 1.0;
                bgCtx.stroke();
            }
        }

        // 3. Draw Active Nodes
        for (const [id, activations] of visualLatchedNodes.entries()) {
             const node = this.cachedNodeMap.get(id);
             if (!node) continue;
             
             const x = node.x * spacing + centerOffset;
             const y = node.y * spacing + centerOffset;
             
             if (x < cullLeft || x > cullRight || y < cullTop || y > cullBottom) continue;
             
             const cTop = settings.colors[node.limitTop] || '#666';
             const cBottom = settings.colors[node.limitBottom] || '#666';
             const vis = settings.limitVisuals?.[node.limitTop] || { size: 1 };
             const limitScale = vis.size;
             const zoomScale = settings.latchedZoomScale;
             const baseRad = Math.max(0, baseRadius * limitScale * zoomScale);
             
             activeCtx.globalAlpha = 1.0; 
             activeCtx.beginPath();
             if (isDiamond) {
                activeCtx.moveTo(x, y - baseRad);
                activeCtx.lineTo(x + baseRad, y);
                activeCtx.lineTo(x, y + baseRad);
                activeCtx.lineTo(x - baseRad, y);
             } else {
                activeCtx.arc(x, y, baseRad, 0, Math.PI * 2);
             }
             activeCtx.closePath();
             
             if (isFlatSkin) {
                 activeCtx.fillStyle = '#ffffff'; 
                 if (settings.activeSkin === 'cyber') activeCtx.fillStyle = '#000000';
                 if (settings.activeSkin === 'blueprint') activeCtx.fillStyle = '#dbeafe';
             } else {
                 const grad = activeCtx.createLinearGradient(x, y - baseRad, x, y + baseRad);
                 grad.addColorStop(0.45, cTop);
                 grad.addColorStop(0.55, cBottom);
                 activeCtx.fillStyle = grad;
             }
             activeCtx.fill();

             const uniqueModes = new Set<number | string>();
             activations.forEach(a => uniqueModes.add(a.mode));
             
             // Sort using explicit priority
             const sortedModes = Array.from(uniqueModes).sort((a, b) => {
                 return (MODE_PRIORITY[a] ?? 99) - (MODE_PRIORITY[b] ?? 99);
             });

             const ringWidth = 4 * effectiveScale;
             const ringGap = 2 * effectiveScale;
             
             sortedModes.forEach((mode, index) => {
                 const color = MODE_COLORS[mode as keyof typeof MODE_COLORS] || '#ffffff';
                 
                 // Special FX for Strum (3) and Arp
                 // Strum Ripple: If mode is 3, find the activation time and draw an expanding ring
                 if (mode === 3 || mode === 'arp') {
                     const activation = activations.find(a => a.mode === mode);
                     if (activation) {
                         const age = time - activation.timestamp;
                         if (age < 500) { // 500ms ripple
                             const rippleProgress = age / 500;
                             const rippleRadius = Math.max(0, baseRad + (rippleProgress * 40 * effectiveScale));
                             const rippleAlpha = 1.0 - rippleProgress;
                             
                             activeCtx.beginPath();
                             activeCtx.arc(x, y, rippleRadius, 0, Math.PI * 2);
                             activeCtx.strokeStyle = color;
                             activeCtx.lineWidth = 2 * effectiveScale;
                             activeCtx.globalAlpha = rippleAlpha;
                             activeCtx.stroke();
                         }
                     }
                 }

                 const currentRadius = Math.max(0, baseRad + ringGap + (index * (ringWidth + ringGap)));
                 
                 activeCtx.beginPath();
                 if (isDiamond) {
                    activeCtx.moveTo(x, y - currentRadius);
                    activeCtx.lineTo(x + currentRadius, y);
                    activeCtx.lineTo(x, y + currentRadius);
                    activeCtx.lineTo(x - currentRadius, y);
                 } else {
                    activeCtx.arc(x, y, currentRadius, 0, Math.PI * 2);
                 }
                 activeCtx.closePath();
                 
                 activeCtx.strokeStyle = color;
                 activeCtx.lineWidth = ringWidth;
                 activeCtx.globalAlpha = 0.8;
                 
                 activeCtx.shadowBlur = 8 * effectiveScale;
                 activeCtx.shadowColor = color;
                 activeCtx.stroke();
                 activeCtx.shadowBlur = 0;
             });

             const combinedScale = settings.buttonSizeScale * limitScale * zoomScale;
             if (combinedScale > 0.4) {
                activeCtx.fillStyle = isFlatSkin ? skin.nodeStroke : 'white';
                if (settings.activeSkin === 'cyber') activeCtx.fillStyle = '#00ff00';
                
                activeCtx.textAlign = 'center';
                activeCtx.textBaseline = 'middle';
                let fontSize = Math.max(12, Math.min(22, 16 * combinedScale)) * settings.nodeTextSizeScale * effectiveScale;
                activeCtx.font = `bold ${fontSize}px sans-serif`; 
                const spacingY = settings.showFractionBar ? 0.55 : 0.50;
                activeCtx.fillText(node.n.toString(), x, y - (baseRad * spacingY));
                if (settings.showFractionBar) {
                    activeCtx.beginPath();
                    activeCtx.moveTo(x - (baseRad * 0.4), y);
                    activeCtx.lineTo(x + (baseRad * 0.4), y);
                    activeCtx.lineWidth = 1 * effectiveScale;
                    activeCtx.strokeStyle = isFlatSkin ? 'rgba(0,0,0,0.5)' : 'white';
                    activeCtx.stroke();
                }
                activeCtx.fillText(node.d.toString(), x, y + (baseRad * spacingY));
             }
        }

        // 4. Draw Cursors
        if (settings.isPitchBendEnabled && latchMode !== 3) {
            activeCursors.forEach(c => {
                if (c.originNodeId) { 
                    const node = this.cachedNodeMap.get(c.originNodeId);
                    if(node) {
                         const nx = node.x * spacing + centerOffset;
                         const ny = node.y * spacing + centerOffset;
                         const pos = cursorPositions.get(c.pointerId);
                         if (!pos) return;
                         
                         const cx = pos.x;
                         const cy = pos.y;
                         
                         activeCtx.beginPath();
                         activeCtx.moveTo(nx, ny);
                         activeCtx.lineTo(cx, cy);
                         activeCtx.strokeStyle = isFlatSkin ? skin.nodeStroke : 'white';
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
