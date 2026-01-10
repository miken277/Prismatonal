
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
    harmonicNeighbors: Map<string, number>; 
    activeCursors: Map<number, any>; 
    cursorPositions: Map<number, {x: number, y: number}>;
    nodeTriggerHistory: Map<string, number>;
    globalBend: number;
    effectiveScale: number;
    centerOffset: number; 
    view: ViewPort;
    time: number;
    latchMode: number;
    phantomNodes?: Map<string, LatticeNode>; 
    shiftGhostNodes?: Map<string, LatticeNode>; // Changed from internal Set logic to explicit Map of Nodes
}

const MODE_PRIORITY: Record<string | number, number> = {
    0: 0, 
    3: 1, 
    2: 2, 
    4: 3, 
    5: 4, 
    'arp': 5, 
    1: 6  
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
                return { bg: '#f8fafc', line: '#94a3b8', lineDim: 'rgba(148, 163, 184, 0.2)', nodeText: '#334155', nodeStroke: '#334155', nodeFill: () => '#ffffff', shadow: 'rgba(0,0,0,0.1)' };
            case 'blueprint':
                return { bg: '#1e3a8a', line: 'rgba(147, 197, 253, 0.4)', lineDim: 'rgba(147, 197, 253, 0.1)', nodeText: '#dbeafe', nodeStroke: '#93c5fd', nodeFill: () => '#172554', shadow: 'rgba(0,0,0,0.3)' };
            case 'cyber':
                return { bg: '#000000', line: '#333333', lineDim: '#111111', nodeText: '#ffffff', nodeStroke: '#444444', nodeFill: () => '#000000', shadow: '#00ff00' };
            case 'default':
            default:
                return { bg: 'transparent', line: '#666', lineDim: 'rgba(255,255,255,0.1)', nodeText: '#ffffff', nodeStroke: 'transparent', nodeFill: (limit, map) => map[limit] || '#666', shadow: 'black' };
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
            path: settings.modulationPath,
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

        // Draw Nodes (Lines removed per request)
        for (const node of data.nodes) {
            const x = node.x * spacing + centerOffset;
            const y = node.y * spacing + centerOffset;
            if (x < cullLeft || x > cullRight || y < cullTop || y > cullBottom) continue;

            const topVis = settings.limitVisuals?.[node.limitTop] || { size: 1, opacity: 1 };
            const radius = Math.max(0, baseRadius * topVis.size);

            if (node.isGhost) {
                // Ghost Node Trace: Outline only, no fill, very faint
                ctx.globalAlpha = 0.15;
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 1 * effectiveScale;
                ctx.beginPath();
                if (isDiamond) {
                    ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y);
                } else {
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.globalAlpha = 1.0;
                continue; 
            }

            ctx.globalAlpha = 1.0 * topVis.opacity;
            ctx.beginPath();
            if (isDiamond) {
                ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y);
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
                const cTop = settings.colors[node.limitTop] || '#666';
                const cBottom = settings.colors[node.limitBottom] || '#666';
                const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
                grad.addColorStop(0.45, cTop); grad.addColorStop(0.55, cBottom);
                ctx.fillStyle = grad; ctx.fill();
            }

            if (settings.buttonSizeScale * topVis.size > 0.4) {
                ctx.fillStyle = skin.nodeText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                let fontSize = Math.max(10, Math.min(18, 14 * settings.buttonSizeScale * topVis.size)) * settings.nodeTextSizeScale * effectiveScale;
                ctx.font = `bold ${fontSize}px sans-serif`; 
                const spacingY = settings.showFractionBar ? 0.55 : 0.50;
                ctx.fillText(node.n.toString(), x, y - (radius * spacingY));
                if (settings.showFractionBar) {
                    ctx.beginPath(); ctx.moveTo(x - (radius * 0.4), y); ctx.lineTo(x + (radius * 0.4), y);
                    ctx.lineWidth = 1 * effectiveScale; ctx.strokeStyle = isFlatSkin ? 'rgba(0,0,0,0.2)' : `rgba(255,255,255,0.8)`;
                    ctx.stroke();
                }
                ctx.fillText(node.d.toString(), x, y + (radius * spacingY));
            }
        }
    }

    private renderDynamic(bgCanvas: HTMLCanvasElement, activeCanvas: HTMLCanvasElement, state: RenderState) {
        const { 
            data, settings, visualLatchedNodes, activeLines, brightenedLines, phantomNodes, shiftGhostNodes,
            effectiveScale, centerOffset, view, time 
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
            bgCanvas.width = view.w * dpr; bgCanvas.height = view.h * dpr;
            activeCanvas.width = view.w * dpr; activeCanvas.height = view.h * dpr;
        }
        
        bgCtx.setTransform(1, 0, 0, 1, 0, 0); activeCtx.setTransform(1, 0, 0, 1, 0, 0);
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height); activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
        bgCtx.scale(dpr, dpr); activeCtx.scale(dpr, dpr);
        bgCtx.translate(-view.x, -view.y); activeCtx.translate(-view.x, -view.y);

        const spacing = settings.buttonSpacingScale * effectiveScale;
        const baseRadius = (60 * settings.buttonSizeScale * effectiveScale) / 2;
        const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
        
        const skin = this.getSkinConfig(settings.activeSkin, activeCtx);
        const isFlatSkin = settings.activeSkin !== 'default';

        const cullPad = 200;
        const cullLeft = view.x - cullPad; const cullRight = view.x + view.w + cullPad;
        const cullTop = view.y - cullPad; const cullBottom = view.y + view.h + cullPad;

        bgCtx.lineCap = 'round'; activeCtx.lineCap = 'round';

        // --- DRAW MODULATION PATH ---
        if (settings.modulationPath.length > 1) {
            bgCtx.beginPath();
            let started = false;
            
            settings.modulationPath.forEach((p) => {
                const originId = `${p.coords.join(',')}:${p.octave}`;
                const node = this.cachedNodeMap.get(originId);
                
                if (node) {
                    const sx = node.x * spacing + centerOffset;
                    const sy = node.y * spacing + centerOffset;
                    if (!started) {
                        bgCtx.moveTo(sx, sy);
                        started = true;
                    } else {
                        bgCtx.lineTo(sx, sy);
                    }
                }
            });
            
            if (started) {
                bgCtx.lineWidth = 2 * effectiveScale;
                bgCtx.strokeStyle = '#22d3ee'; // Cyan
                bgCtx.setLineDash([10 * effectiveScale, 10 * effectiveScale]);
                bgCtx.lineDashOffset = -time * 0.05;
                bgCtx.stroke();
                bgCtx.setLineDash([]);
                
                // Draw dots at pivots
                settings.modulationPath.forEach(p => {
                    const originId = `${p.coords.join(',')}:${p.octave}`;
                    const node = this.cachedNodeMap.get(originId);
                    if (node) {
                        const sx = node.x * spacing + centerOffset;
                        const sy = node.y * spacing + centerOffset;
                        bgCtx.beginPath();
                        bgCtx.arc(sx, sy, 4 * effectiveScale, 0, Math.PI * 2);
                        bgCtx.fillStyle = '#22d3ee';
                        bgCtx.fill();
                    }
                });
            }
        }

        // --- RENDER GHOSTS (SHIFT MODE) ---
        if (shiftGhostNodes && shiftGhostNodes.size > 0) {
            shiftGhostNodes.forEach((ghostNode) => {
                const gx = ghostNode.x * spacing + centerOffset;
                const gy = ghostNode.y * spacing + centerOffset;
                if (gx < cullLeft || gx > cullRight || gy < cullTop || gy > cullBottom) return;

                const gRadius = Math.max(0, baseRadius * settings.latchedZoomScale);
                activeCtx.beginPath();
                if (isDiamond) {
                    activeCtx.moveTo(gx, gy - gRadius); activeCtx.lineTo(gx + gRadius, gy); activeCtx.lineTo(gx, gy + gRadius); activeCtx.lineTo(gx - gRadius, gy);
                } else {
                    activeCtx.arc(gx, gy, gRadius, 0, Math.PI * 2);
                }
                activeCtx.closePath();
                activeCtx.fillStyle = 'rgba(6, 182, 212, 0.2)'; // Cyan tint
                activeCtx.fill();
                activeCtx.strokeStyle = '#22d3ee';
                activeCtx.lineWidth = 2 * effectiveScale;
                activeCtx.setLineDash([4 * effectiveScale, 4 * effectiveScale]);
                activeCtx.stroke();
                activeCtx.setLineDash([]);
            });
        }

        // 1. Draw Brightened Lines (Neighbor Hints)
        if (brightenedLines.length > 0) {
            for (const line of brightenedLines) {
                const x1 = line.x1 * spacing + centerOffset; const y1 = line.y1 * spacing + centerOffset;
                const x2 = line.x2 * spacing + centerOffset; const y2 = line.y2 * spacing + centerOffset;
                if (Math.max(x1, x2) < cullLeft || Math.min(x1, x2) > cullRight || Math.max(y1, y2) < cullTop || Math.min(y1, y2) > cullBottom) continue;
                
                activeCtx.beginPath(); activeCtx.moveTo(x1, y1); activeCtx.lineTo(x2, y2);
                activeCtx.lineWidth = 1 * effectiveScale;
                activeCtx.strokeStyle = settings.colors[line.limit] || '#666';
                activeCtx.globalAlpha = 0.8; activeCtx.stroke();
            }
        }

        // 2. Draw Active Lines (Strong connection)
        for (const line of activeLines) {
            const x1 = line.x1 * spacing + centerOffset; const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset; const y2 = line.y2 * spacing + centerOffset;
            if (Math.max(x1, x2) < cullLeft || Math.min(x1, x2) > cullRight || Math.max(y1, y2) < cullTop || Math.min(y1, y2) > cullBottom) continue;
            
            activeCtx.beginPath(); activeCtx.moveTo(x1, y1); activeCtx.lineTo(x2, y2);
            activeCtx.lineWidth = 4 * effectiveScale;
            activeCtx.strokeStyle = settings.colors[line.limit] || '#666';
            activeCtx.globalAlpha = 1.0; activeCtx.stroke();
        }

        // 3. Draw Active Nodes (Normal & Phantom)
        for (const [id, activations] of visualLatchedNodes.entries()) {
             // Check both main grid and phantom fallback
             const node = this.cachedNodeMap.get(id) || phantomNodes?.get(id);
             if (!node) continue;
             
             const isPhantom = !!(phantomNodes?.has(id));
             
             const x = node.x * spacing + centerOffset; const y = node.y * spacing + centerOffset;
             if (x < cullLeft || x > cullRight || y < cullTop || y > cullBottom) continue;
             
             const cTop = settings.colors[node.limitTop] || '#666';
             const vis = settings.limitVisuals?.[node.limitTop] || { size: 1 };
             const radius = Math.max(0, baseRadius * vis.size * settings.latchedZoomScale);
             
             activeCtx.beginPath();
             if (isDiamond) {
                activeCtx.moveTo(x, y - radius); activeCtx.lineTo(x + radius, y); activeCtx.lineTo(x, y + radius); activeCtx.lineTo(x - radius, y);
             } else {
                activeCtx.arc(x, y, radius, 0, Math.PI * 2);
             }
             activeCtx.closePath();
             
             if (isFlatSkin) {
                 activeCtx.fillStyle = skin.nodeFill(node.limitTop, settings.colors) as string;
             } else {
                 const grad = activeCtx.createLinearGradient(x, y - radius, x, y + radius);
                 grad.addColorStop(0.45, cTop); grad.addColorStop(0.55, settings.colors[node.limitBottom] || '#666');
                 activeCtx.fillStyle = grad;
             }
             
             // Phantom Visual Style: Reduced Opacity or Dashed Outline
             if (isPhantom) {
                 activeCtx.globalAlpha = 0.5; // "Ghost" look
                 activeCtx.fill();
                 activeCtx.globalAlpha = 1.0;
                 
                 // Draw dashed outline for phantom
                 activeCtx.setLineDash([4 * effectiveScale, 4 * effectiveScale]);
                 activeCtx.strokeStyle = '#fff';
                 activeCtx.lineWidth = 2 * effectiveScale;
                 activeCtx.stroke();
                 activeCtx.setLineDash([]);
             } else {
                 activeCtx.fill();
             }

             const uniqueModes = new Set<number | string>();
             activations.forEach(a => uniqueModes.add(a.mode));
             const sortedModes = Array.from(uniqueModes).sort((a, b) => (MODE_PRIORITY[a] ?? 99) - (MODE_PRIORITY[b] ?? 99));

             sortedModes.forEach((mode, index) => {
                 const color = MODE_COLORS[mode as keyof typeof MODE_COLORS] || '#ffffff';
                 const currentRadius = radius + (2 * effectiveScale) + (index * 6 * effectiveScale);
                 activeCtx.beginPath();
                 if (isDiamond) {
                    activeCtx.moveTo(x, y - currentRadius); activeCtx.lineTo(x + currentRadius, y); activeCtx.lineTo(x, y + currentRadius); activeCtx.lineTo(x - currentRadius, y);
                 } else {
                    activeCtx.arc(x, y, currentRadius, 0, Math.PI * 2);
                 }
                 activeCtx.closePath();
                 activeCtx.strokeStyle = color; activeCtx.lineWidth = 4 * effectiveScale;
                 if (isPhantom) activeCtx.setLineDash([3 * effectiveScale, 3 * effectiveScale]);
                 activeCtx.stroke();
                 activeCtx.setLineDash([]);
             });

             // RE-DRAW TEXT on top of active node
             if (settings.buttonSizeScale * vis.size > 0.4) {
                activeCtx.fillStyle = 'white'; 
                activeCtx.shadowColor = 'black';
                activeCtx.shadowBlur = 4;
                activeCtx.textAlign = 'center'; activeCtx.textBaseline = 'middle';
                let fontSize = Math.max(12, Math.min(22, 16 * settings.buttonSizeScale * vis.size * settings.latchedZoomScale)) * settings.nodeTextSizeScale * effectiveScale;
                activeCtx.font = `bold ${fontSize}px sans-serif`; 
                const spacingY = settings.showFractionBar ? 0.55 : 0.50;
                activeCtx.fillText(node.n.toString(), x, y - (radius * spacingY));
                if (settings.showFractionBar) {
                    activeCtx.beginPath(); activeCtx.moveTo(x - (radius * 0.4), y); activeCtx.lineTo(x + (radius * 0.4), y);
                    activeCtx.lineWidth = 1 * effectiveScale; 
                    activeCtx.strokeStyle = 'white';
                    activeCtx.stroke();
                }
                activeCtx.fillText(node.d.toString(), x, y + (radius * spacingY));
                activeCtx.shadowBlur = 0; 
            }
        }
    }
}
