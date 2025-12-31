
import { LatticeNode, LatticeLine, AppSettings, ButtonShape } from '../types';
import { MODE_COLORS } from '../constants';

interface NodeActivation {
    mode: number;
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
    activeCursors: Map<number, any>; 
    cursorPositions: Map<number, {x: number, y: number}>;
    nodeTriggerHistory: Map<string, number>;
    globalBend: number;
    effectiveScale: number;
    dynamicSize: number;
    view: ViewPort;
    time: number;
    latchMode: number;
}

// Priority for concentric rings (Lower = Inner Ring)
const MODE_PRIORITY: Record<string | number, number> = {
    0: 0, // Touch/Default (Innermost)
    3: 1, // Plucked
    'arp': 2, // Arpeggiator 
    2: 3, // Strings
    4: 4, // Voice (New, Yellow)
    1: 5  // Drone (Outermost)
};

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

    private renderStatic(canvas: HTMLCanvasElement, state: RenderState) {
        const { data, settings, effectiveScale, dynamicSize } = state;
        
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
            canvasSize: dynamicSize,
            scale: effectiveScale,
            nodesLen: data.nodes.length,
            linesLen: data.lines.length
        });

        if (deps === this.prevStaticDeps) return;
        this.prevStaticDeps = deps;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);
        
        if (canvas.width !== dynamicSize * dpr || canvas.height !== dynamicSize * dpr) {
            canvas.width = dynamicSize * dpr;
            canvas.height = dynamicSize * dpr;
        }
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        const centerOffset = dynamicSize / 2;
        const spacing = settings.buttonSpacingScale * effectiveScale;
        const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;
        const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
        const isJIOverride = settings.tuningSystem === 'ji' && settings.layoutApproach !== 'lattice' && settings.layoutApproach !== 'diamond';

        // Draw Lines
        const linesByLimit: Record<number, number[]> = {};
        for (const line of data.lines) {
            if (!linesByLimit[line.limit]) linesByLimit[line.limit] = [];
            linesByLimit[line.limit].push(
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
            const color = isJIOverride ? '#fff' : (settings.colors[limit] || '#666');
            const visualSettings = settings.limitVisuals?.[limit] || { size: 1, opacity: 1 };
            
            ctx.beginPath();
            for(let i=0; i<coords.length; i+=4) {
                ctx.moveTo(coords[i], coords[i+1]);
                ctx.lineTo(coords[i+2], coords[i+3]);
            }
            ctx.lineWidth = (limit === 1 ? 3 : 1) * visualSettings.size * effectiveScale; 
            ctx.strokeStyle = color;
            ctx.globalAlpha = (isJIOverride ? 0.15 : 0.3) * visualSettings.opacity; 
            
            if (limit === 1) ctx.setLineDash([5 * effectiveScale, 5 * effectiveScale]);
            else ctx.setLineDash([]);
            ctx.stroke();
        }
        ctx.setLineDash([]); 

        // Draw Nodes
        for (const node of data.nodes) {
            const x = node.x * spacing + centerOffset;
            const y = node.y * spacing + centerOffset;
            const cTop = isJIOverride ? '#fff' : (settings.colors[node.limitTop] || '#666');
            const cBottom = isJIOverride ? '#eee' : (settings.colors[node.limitBottom] || '#666');
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

            if (isJIOverride) {
                ctx.fillStyle = '#111';
                ctx.fill();
                ctx.lineWidth = 2 * effectiveScale;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            } else {
                const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
                grad.addColorStop(0.45, cTop);
                grad.addColorStop(0.55, cBottom);
                ctx.fillStyle = grad;
                ctx.fill();
            }

            const combinedScale = settings.buttonSizeScale * limitScale;
            if (combinedScale > 0.4) {
                ctx.fillStyle = isJIOverride ? '#fff' : 'white';
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
                    ctx.strokeStyle = isJIOverride ? 'rgba(255,255,255,0.4)' : `rgba(255,255,255,${0.8 * limitOpacity})`;
                    ctx.stroke();
                }
                ctx.fillText(node.d.toString(), x, y + (radius * spacingY));
            }
        }
    }

    private renderDynamic(bgCanvas: HTMLCanvasElement, activeCanvas: HTMLCanvasElement, state: RenderState) {
        const { 
            data, settings, visualLatchedNodes, activeLines, brightenedLines, 
            activeCursors, cursorPositions, effectiveScale, dynamicSize, view, time, latchMode 
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

        if (bgCanvas.width !== dynamicSize * dpr || bgCanvas.height !== dynamicSize * dpr) {
            bgCanvas.width = dynamicSize * dpr;
            bgCanvas.height = dynamicSize * dpr;
            activeCanvas.width = dynamicSize * dpr;
            activeCanvas.height = dynamicSize * dpr;
            bgCtx.scale(dpr, dpr);
            activeCtx.scale(dpr, dpr);
        }

        // Clear active areas
        bgCtx.clearRect(view.x, view.y, view.w, view.h);
        activeCtx.clearRect(view.x, view.y, view.w, view.h);

        // Optimization: Culling
        const viewPad = 100;
        const leftBound = view.x - viewPad;
        const rightBound = view.x + view.w + viewPad;
        const topBound = view.y - viewPad;
        const bottomBound = view.y + view.h + viewPad;

        const centerOffset = dynamicSize / 2;
        const spacing = settings.buttonSpacingScale * effectiveScale;
        const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;
        const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
        const isJIOverride = settings.tuningSystem === 'ji' && settings.layoutApproach !== 'lattice' && settings.layoutApproach !== 'diamond';

        const animationSpeed = (settings.voiceLeadingAnimationSpeed || 2.0) * 0.33;
        const rawPhase = (time * 0.001 * animationSpeed);
        const flowPhase = settings.voiceLeadingReverseDir ? (1.0 - (rawPhase % 1.0)) : (rawPhase % 1.0);

        bgCtx.lineCap = 'round';
        activeCtx.lineCap = 'round';

        // 1. Draw Brightened Lines (Background Canvas)
        if (brightenedLines.length > 0) {
            bgCtx.setLineDash([]);
            for (const line of brightenedLines) {
                const x1 = line.x1 * spacing + centerOffset;
                const y1 = line.y1 * spacing + centerOffset;
                const x2 = line.x2 * spacing + centerOffset;
                const y2 = line.y2 * spacing + centerOffset;
                if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;
                
                const limitColor = isJIOverride ? '#fff' : (settings.colors[line.limit] || '#666');
                bgCtx.beginPath();
                bgCtx.moveTo(x1, y1);
                bgCtx.lineTo(x2, y2);
                bgCtx.lineWidth = (settings.lineBrighteningWidth || 1.0) * effectiveScale;
                bgCtx.strokeStyle = limitColor;
                bgCtx.globalAlpha = isJIOverride ? 0.4 : 0.8; 
                bgCtx.stroke();
            }
        }

        // 2. Draw Active Lines (Voice Leading) (Background Canvas)
        bgCtx.setLineDash([]); 
        for (const line of activeLines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;
            if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;
            
            const limitColor = isJIOverride ? '#fff' : (settings.colors[line.limit] || '#666');
            bgCtx.beginPath();
            bgCtx.moveTo(x1, y1);
            bgCtx.lineTo(x2, y2);
            bgCtx.lineWidth = (isJIOverride ? 2 : 4) * effectiveScale;
            bgCtx.strokeStyle = limitColor;
            bgCtx.globalAlpha = 1.0;
            bgCtx.stroke();
            
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
                
                bgCtx.strokeStyle = grad;
                bgCtx.lineWidth = 10 * (0.5 + settings.voiceLeadingGlowAmount) * effectiveScale;
                bgCtx.globalAlpha = 0.3; 
                bgCtx.stroke();
                
                bgCtx.lineWidth = 4 * effectiveScale;
                bgCtx.globalAlpha = 1.0;
                bgCtx.stroke();
            }
        }

        // 3. Draw Active Nodes with Concentric Rings
        for (const [id, activations] of visualLatchedNodes.entries()) {
             const node = this.cachedNodeMap.get(id);
             if (!node) continue;
             
             const x = node.x * spacing + centerOffset;
             const y = node.y * spacing + centerOffset;
             if (x < leftBound || x > rightBound || y < topBound || y > bottomBound) continue;
             
             const cTop = isJIOverride ? '#fff' : (settings.colors[node.limitTop] || '#666');
             const vis = settings.limitVisuals?.[node.limitTop] || { size: 1 };
             const limitScale = vis.size;
             const zoomScale = settings.latchedZoomScale;
             const baseRad = baseRadius * limitScale * zoomScale;
             
             // Base Fill
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
             
             if (isJIOverride) {
                 activeCtx.fillStyle = '#fff';
             } else {
                 const grad = activeCtx.createLinearGradient(x, y - baseRad, x, y + baseRad);
                 grad.addColorStop(0.45, cTop);
                 grad.addColorStop(0.55, settings.colors[node.limitBottom] || '#666');
                 activeCtx.fillStyle = grad;
             }
             activeCtx.fill();

             // Concentric Rings for Active Modes
             const uniqueModes = new Set<number>();
             activations.forEach(a => uniqueModes.add(a.mode));
             
             const sortedModes = Array.from(uniqueModes).sort((a, b) => {
                 return (MODE_PRIORITY[a] ?? 99) - (MODE_PRIORITY[b] ?? 99);
             });

             const ringWidth = 4 * effectiveScale;
             const ringGap = 2 * effectiveScale;
             
             sortedModes.forEach((mode, index) => {
                 const color = MODE_COLORS[mode as keyof typeof MODE_COLORS] || '#ffffff';
                 // Offset starts slightly outside the node
                 const currentRadius = baseRad + ringGap + (index * (ringWidth + ringGap));
                 
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
                 
                 // Add glow for active rings
                 activeCtx.shadowBlur = 8 * effectiveScale;
                 activeCtx.shadowColor = color;
                 activeCtx.stroke();
                 activeCtx.shadowBlur = 0;
             });

             // Label Redraw (on top of fill)
             const combinedScale = settings.buttonSizeScale * limitScale * zoomScale;
             if (combinedScale > 0.4) {
                activeCtx.fillStyle = isJIOverride ? '#000' : 'white';
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
                    activeCtx.strokeStyle = isJIOverride ? 'rgba(0,0,0,0.5)' : 'white';
                    activeCtx.stroke();
                }
                activeCtx.fillText(node.d.toString(), x, y + (baseRad * spacingY));
             }
        }

        // 4. Draw Cursors / Pitch Bend Lines (Active Canvas)
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
