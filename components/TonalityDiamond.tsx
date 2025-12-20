
import React, { useEffect, useRef, useLayoutEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { AppSettings, LatticeNode, ButtonShape } from '../types';
import { getRainbowPeriod } from '../services/ProjectionService';
import AudioEngine from '../services/AudioEngine';
import { midiService } from '../services/MidiService';
import { useLatticeData } from '../hooks/useLatticeData';
import { useLatticeVisuals } from '../hooks/useLatticeVisuals';
import { useLatticeInteraction } from '../hooks/useLatticeInteraction';

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
  latchMode: 0 | 1 | 2; 
  globalScale?: number; 
  onNodeTrigger?: (nodeId: string, ratio: number, n?: number, d?: number, limit?: number) => void;
}

const TonalityDiamond = forwardRef<TonalityDiamondHandle, Props>((props, ref) => {
  const { settings, updateSettings, audioEngine, onLimitInteraction, activeChordIds, uiUnlocked, latchMode, globalScale = 1.0, onNodeTrigger } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bgLineCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null); 
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null); 
  
  const animationFrameRef = useRef<number>(0);
  
  const { data, isGenerating, isInitialLoad, setIsInitialLoad, dynamicSize, dynamicSizeRef: hookDynamicSizeRef } = useLatticeData(settings, globalScale);
  const prevDynamicSizeRef = useRef(2000);

  // Derive static grid separately to pass to interaction hook before getting visual latches
  const nodeMap = useMemo(() => new Map(data.nodes.map(n => [n.id, n])), [data.nodes]);
  const spatialGrid = useMemo(() => {
      const grid = new Map<string, LatticeNode[]>();
      const centerOffset = dynamicSize / 2;
      const spacing = settings.buttonSpacingScale * globalScale;
      const GRID_CELL_SIZE = 100;

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
  }, [data.nodes, settings.buttonSpacingScale, dynamicSize, globalScale]);

  const { 
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
  } = useLatticeInteraction(
      settings, audioEngine, midiService, nodeMap, spatialGrid, dynamicSize, globalScale, 
      activeChordIds, latchMode, uiUnlocked, scrollContainerRef, dynamicCanvasRef, 
      onLimitInteraction, onNodeTrigger
  );

  const { activeLines, brightenedLines } = useLatticeVisuals(data, settings, dynamicSize, globalScale, visualLatchedNodes);

  // Refs for Render Loop
  const settingsRef = useRef(settings);
  const activeCursorsRef = useRef(activeCursors);
  const visualLatchedRef = useRef(visualLatchedNodes);
  const activeLinesRef = useRef(activeLines);
  const brightenedLinesRef = useRef(brightenedLines);
  const nodeMapRef = useRef(nodeMap);
  const globalScaleRef = useRef(globalScale);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { activeCursorsRef.current = activeCursors; }, [activeCursors]);
  useEffect(() => { visualLatchedRef.current = visualLatchedNodes; }, [visualLatchedNodes]);
  useEffect(() => { activeLinesRef.current = activeLines; }, [activeLines]);
  useEffect(() => { brightenedLinesRef.current = brightenedLines; }, [brightenedLines]);
  useEffect(() => { nodeMapRef.current = nodeMap; }, [nodeMap]);
  useEffect(() => { globalScaleRef.current = globalScale; }, [globalScale]);

  useImperativeHandle(ref, () => ({
    clearLatches: () => setPersistentLatches(new Map()),
    centerView: () => { centerScroll(); },
    increaseDepth: () => {
        const lastNode = lastTouchedNodeRef.current;
        if (lastNode) {
             updateSettings((prev: AppSettings) => {
                 return { 
                     ...prev, 
                     generationOrigins: [...prev.generationOrigins, lastNode] 
                 };
             });
        }
    },
    decreaseDepth: () => {
        updateSettings((prev: AppSettings) => {
             if (prev.generationOrigins.length <= 1) return prev; 
             const newOrigins = [...prev.generationOrigins];
             newOrigins.pop();
             return { ...prev, generationOrigins: newOrigins };
        });
    },
    getLatchedNodes: () => {
        const result: LatticeNode[] = [];
        audioLatchedNodes.forEach((_, id) => {
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

  useEffect(() => {
      if (isInitialLoad && !isGenerating && data.nodes.length > 0) {
          centerScroll();
          setIsInitialLoad(false);
      }
  }, [isGenerating, data.nodes.length, isInitialLoad, dynamicSize]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    if (!isInitialLoad && dynamicSize !== prevDynamicSizeRef.current) {
        const diff = (dynamicSize - prevDynamicSizeRef.current) / 2;
        container.scrollLeft += diff;
        container.scrollTop += diff;
    }
    prevDynamicSizeRef.current = dynamicSize;
  }, [dynamicSize, isInitialLoad]);

  const visualDeps = useMemo(() => JSON.stringify({
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
      globalScale: globalScale 
  }), [settings.tuningSystem, settings.layoutApproach, settings.activeSkin, settings.buttonSizeScale, settings.buttonSpacingScale, settings.colors, settings.limitVisuals, settings.buttonShape, settings.nodeTextSizeScale, settings.showFractionBar, dynamicSize, globalScale]);

  // --- STATIC CANVAS RENDER ---
  useEffect(() => {
      const canvas = staticCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);
      const size = dynamicSize;
      
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
          canvas.width = size * dpr;
          canvas.height = size * dpr;
      }
      
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const centerOffset = size / 2;
      const spacing = settings.buttonSpacingScale * globalScale;
      const baseRadius = (60 * settings.buttonSizeScale * globalScale) / 2;
      const isDiamond = settings.buttonShape === ButtonShape.DIAMOND;
      const skin = settings.activeSkin;

      // Skin Constants
      const isMinimal = skin === 'minimal';
      const isTechnical = skin === 'technical';
      const isOrganic = skin === 'organic';

      const isAlternateJILayout = settings.tuningSystem === 'ji' && settings.layoutApproach !== 'lattice';
      const layoutSizeMult = isAlternateJILayout ? 1.5 : 1.0; 
      
      // Batch lines by limit
      const linesByLimit: Record<number, number[]> = {};
      for (const line of data.lines) {
          if (!linesByLimit[line.limit]) linesByLimit[line.limit] = [];
          const arr = linesByLimit[line.limit];
          arr.push(line.x1 * spacing + centerOffset, line.y1 * spacing + centerOffset, line.x2 * spacing + centerOffset, line.y2 * spacing + centerOffset);
      }

      ctx.lineCap = isTechnical ? 'butt' : 'round';
      
      // DRAW LINES
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
          
          // Skin: Line Styles
          if (isTechnical) {
              ctx.lineWidth = 0.5 * globalScale;
              ctx.strokeStyle = color;
              ctx.globalAlpha = 0.6 * visualSettings.opacity;
              if (limit !== 1) ctx.setLineDash([2 * globalScale, 4 * globalScale]);
              else ctx.setLineDash([]);
          } 
          else if (isMinimal) {
              ctx.lineWidth = (limit === 1 ? 2 : 1) * globalScale;
              ctx.strokeStyle = limit === 1 ? '#475569' : '#334155'; // Slate greys
              ctx.globalAlpha = 0.4 * visualSettings.opacity;
              ctx.setLineDash([]);
          } 
          else if (isOrganic) {
              ctx.lineWidth = (limit === 1 ? 4 : 2) * visualSettings.size * globalScale;
              ctx.strokeStyle = color;
              ctx.globalAlpha = 0.15 * visualSettings.opacity; // Very soft
              ctx.setLineDash([]);
          }
          else {
              // Default
              ctx.lineWidth = (limit === 1 ? 3 : 1) * visualSettings.size * globalScale; 
              ctx.strokeStyle = color;
              ctx.globalAlpha = (isAlternateJILayout ? 0.5 : 0.3) * visualSettings.opacity; 
              if (limit === 1) ctx.setLineDash([5 * globalScale, 5 * globalScale]);
              else ctx.setLineDash([]);
          }
          ctx.stroke();
      }
      ctx.setLineDash([]); 

      // DRAW NODES
      for (const node of data.nodes) {
          const x = node.x * spacing + centerOffset;
          const y = node.y * spacing + centerOffset;
          const cTop = settings.colors[node.limitTop] || '#666';
          const cBottom = settings.colors[node.limitBottom] || '#666';
          const topVis = settings.limitVisuals?.[node.limitTop] || { size: 1, opacity: 1 };
          const limitScale = topVis.size;
          const limitOpacity = topVis.opacity;
          
          const radius = baseRadius * limitScale * layoutSizeMult;

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

          // Skin: Fill/Stroke Styles
          if (isTechnical) {
              ctx.fillStyle = '#0f172a'; // Dark bg
              ctx.fill();
              ctx.lineWidth = 2 * globalScale;
              ctx.strokeStyle = cTop;
              ctx.stroke();
          } 
          else if (isMinimal) {
              ctx.fillStyle = cTop; // Flat color
              ctx.fill();
              // No stroke
          }
          else if (isOrganic) {
              const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
              grad.addColorStop(0, cTop);
              grad.addColorStop(1, 'rgba(0,0,0,0)'); // Fade out
              ctx.fillStyle = grad;
              ctx.globalAlpha = 0.8 * limitOpacity;
              ctx.fill();
              ctx.globalAlpha = 1.0 * limitOpacity;
          }
          else {
              // Default
              const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
              grad.addColorStop(0.45, cTop);
              grad.addColorStop(0.55, cBottom);
              ctx.fillStyle = grad;
              ctx.fill();
          }

          const combinedScale = settings.buttonSizeScale * limitScale * layoutSizeMult;
          if (combinedScale > 0.4) {
              
              if (isTechnical) {
                  ctx.fillStyle = cTop;
                  ctx.font = `normal ${Math.max(10, 12 * combinedScale * globalScale)}px monospace`;
              } else if (isMinimal) {
                  ctx.fillStyle = 'rgba(255,255,255,0.9)';
                  ctx.font = `bold ${Math.max(10, 14 * combinedScale * globalScale)}px sans-serif`;
              } else if (isOrganic) {
                  ctx.fillStyle = 'white';
                  ctx.font = `italic ${Math.max(10, 14 * combinedScale * globalScale)}px serif`;
              } else {
                  ctx.fillStyle = 'white';
                  ctx.font = `bold ${Math.max(10, Math.min(18, 14 * combinedScale)) * settings.nodeTextSizeScale * globalScale}px sans-serif`; 
              }

              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              const spacingY = settings.showFractionBar ? 0.55 : 0.50;
              
              // Organic skin hides numbers on small nodes for cleanliness
              if (!isOrganic || combinedScale > 0.6) {
                  ctx.fillText(node.n.toString(), x, y - (radius * spacingY));
                  
                  if (settings.showFractionBar) {
                      ctx.beginPath();
                      ctx.moveTo(x - (radius * 0.4), y);
                      ctx.lineTo(x + (radius * 0.4), y);
                      ctx.lineWidth = 1 * globalScale;
                      ctx.strokeStyle = isTechnical ? cTop : `rgba(255,255,255,${0.8 * limitOpacity})`;
                      ctx.stroke();
                  }
                  
                  ctx.fillText(node.d.toString(), x, y + (radius * spacingY));
              }
          }
      }
  }, [data, visualDeps]); 

  // --- DYNAMIC CANVAS RENDER ---
  const render = (time: number) => {
      const bgCanvas = bgLineCanvasRef.current;
      const activeCanvas = dynamicCanvasRef.current;
      if (!bgCanvas || !activeCanvas) {
           animationFrameRef.current = requestAnimationFrame(render);
           return;
      }
      
      const bgCtx = bgCanvas.getContext('2d', { alpha: true });
      const activeCtx = activeCanvas.getContext('2d', { alpha: true });
      if (!bgCtx || !activeCtx) return; 
      
      const currentSettings = settingsRef.current;
      const currentVisualLatched = visualLatchedRef.current; 
      const currentActiveLines = activeLinesRef.current;
      const currentBrightenedLines = brightenedLinesRef.current;
      const size = hookDynamicSizeRef.current;
      const cursors = activeCursorsRef.current;
      const currentGlobalScale = globalScaleRef.current;

      const skin = currentSettings.activeSkin;
      const isMinimal = skin === 'minimal';
      const isTechnical = skin === 'technical';
      const isOrganic = skin === 'organic';

      const isAlternateJILayout = currentSettings.tuningSystem === 'ji' && currentSettings.layoutApproach !== 'lattice';
      const layoutSizeMult = isAlternateJILayout ? 1.5 : 1.0; 
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);

      if (bgCanvas.width !== size * dpr || bgCanvas.height !== size * dpr) {
            bgCanvas.width = size * dpr;
            bgCanvas.height = size * dpr;
            activeCanvas.width = size * dpr;
            activeCanvas.height = size * dpr;
            bgCtx.scale(dpr, dpr);
            activeCtx.scale(dpr, dpr);
      }

      let viewX = 0, viewY = 0, viewW = size, viewH = size;
      if (scrollContainerRef.current) {
          viewX = scrollContainerRef.current.scrollLeft;
          viewY = scrollContainerRef.current.scrollTop;
          viewW = scrollContainerRef.current.clientWidth;
          viewH = scrollContainerRef.current.clientHeight;
      }
      
      bgCtx.clearRect(viewX, viewY, viewW, viewH);
      activeCtx.clearRect(viewX, viewY, viewW, viewH);

      const centerOffset = size / 2;
      const spacing = currentSettings.buttonSpacingScale * currentGlobalScale;
      const baseRadius = (60 * currentSettings.buttonSizeScale * currentGlobalScale) / 2;
      const isDiamond = currentSettings.buttonShape === ButtonShape.DIAMOND;
      const colorCache = currentSettings.colors;

      const animationSpeed = (currentSettings.voiceLeadingAnimationSpeed || 2.0) * 0.33;
      const rawPhase = (time * 0.001 * animationSpeed);
      const flowPhase = currentSettings.voiceLeadingReverseDir ? (1.0 - (rawPhase % 1.0)) : (rawPhase % 1.0);
      
      bgCtx.lineCap = isTechnical ? 'butt' : 'round';
      activeCtx.lineCap = isTechnical ? 'butt' : 'round';

      const viewPad = 100;
      const leftBound = viewX - viewPad;
      const rightBound = viewX + viewW + viewPad;
      const topBound = viewY - viewPad;
      const bottomBound = viewY + viewH + viewPad;
      
      // Active Lines Rendering (Background Canvas)
      if (currentBrightenedLines.length > 0) {
            bgCtx.setLineDash([]);
            for (const line of currentBrightenedLines) {
                const x1 = line.x1 * spacing + centerOffset;
                const y1 = line.y1 * spacing + centerOffset;
                const x2 = line.x2 * spacing + centerOffset;
                const y2 = line.y2 * spacing + centerOffset;
                if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;
                const limitColor = colorCache[line.limit] || '#666';
                bgCtx.beginPath();
                bgCtx.moveTo(x1, y1);
                bgCtx.lineTo(x2, y2);
                
                if (isTechnical) {
                    bgCtx.lineWidth = 1 * currentGlobalScale;
                    bgCtx.strokeStyle = limitColor;
                    bgCtx.globalAlpha = 1.0;
                } else if (isMinimal) {
                    bgCtx.lineWidth = 2 * currentGlobalScale;
                    bgCtx.strokeStyle = limitColor; 
                    bgCtx.globalAlpha = 0.6;
                } else if (isOrganic) {
                    bgCtx.lineWidth = 4 * currentGlobalScale;
                    bgCtx.strokeStyle = limitColor;
                    bgCtx.globalAlpha = 0.3;
                } else {
                    bgCtx.lineWidth = 1 * currentGlobalScale;
                    bgCtx.strokeStyle = limitColor;
                    bgCtx.globalAlpha = 0.8; 
                }
                
                bgCtx.stroke();
            }
      }

      bgCtx.setLineDash([]); 
      for (const line of currentActiveLines) {
            const x1 = line.x1 * spacing + centerOffset;
            const y1 = line.y1 * spacing + centerOffset;
            const x2 = line.x2 * spacing + centerOffset;
            const y2 = line.y2 * spacing + centerOffset;
            if (Math.max(x1, x2) < leftBound || Math.min(x1, x2) > rightBound || Math.max(y1, y2) < topBound || Math.min(y1, y2) > bottomBound) continue;
            const limitColor = colorCache[line.limit] || '#666';
            bgCtx.beginPath();
            bgCtx.moveTo(x1, y1);
            bgCtx.lineTo(x2, y2);
            
            if (isTechnical) {
                bgCtx.lineWidth = 2 * currentGlobalScale;
                bgCtx.strokeStyle = '#fff';
                bgCtx.setLineDash([4, 4]);
            } else if (isMinimal) {
                bgCtx.lineWidth = 3 * currentGlobalScale;
                bgCtx.strokeStyle = limitColor;
            } else if (isOrganic) {
                bgCtx.lineWidth = 8 * currentGlobalScale;
                bgCtx.strokeStyle = limitColor;
                bgCtx.globalAlpha = 0.5;
            } else {
                bgCtx.lineWidth = 4 * currentGlobalScale;
                bgCtx.strokeStyle = limitColor;
            }
            bgCtx.stroke();
            bgCtx.setLineDash([]);
            bgCtx.globalAlpha = 1.0;

            if (currentSettings.isVoiceLeadingAnimationEnabled && !isMinimal) {
                const grad = bgCtx.createLinearGradient(x1, y1, x2, y2);
                const p = flowPhase;
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                const pulseWidth = 0.2;
                const start = Math.max(0, p - pulseWidth);
                const end = Math.min(1, p + pulseWidth);
                if (start > 0) grad.addColorStop(start, 'rgba(255,255,255,0)');
                grad.addColorStop(p, isTechnical ? 'rgba(0,255,0,1)' : 'rgba(255,255,255,0.7)'); 
                if (end < 1) grad.addColorStop(end, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                bgCtx.strokeStyle = grad;
                bgCtx.lineWidth = (isTechnical ? 4 : 10 * (0.5 + currentSettings.voiceLeadingGlowAmount)) * currentGlobalScale;
                bgCtx.globalAlpha = isTechnical ? 1.0 : 0.3; 
                bgCtx.stroke();
                
                // restore
                bgCtx.lineWidth = 4 * currentGlobalScale;
                bgCtx.globalAlpha = 1.0;
            }
      }

      // Active Nodes Rendering (Active Canvas)
      for (const id of currentVisualLatched.keys()) {
             const node = nodeMapRef.current.get(id);
             if (!node) continue;
             const x = node.x * spacing + centerOffset;
             const y = node.y * spacing + centerOffset;
             if (x < leftBound || x > rightBound || y < topBound || y > bottomBound) continue;
             const cTop = colorCache[node.limitTop] || '#666';
             const vis = currentSettings.limitVisuals?.[node.limitTop] || { size: 1 };
             const limitScale = vis.size;
             const zoomScale = currentSettings.latchedZoomScale;
             
             const radius = baseRadius * limitScale * zoomScale * layoutSizeMult;
             
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
             
             if (isTechnical) {
                 activeCtx.fillStyle = '#000';
                 activeCtx.fill();
                 activeCtx.strokeStyle = '#0f0'; // Retro Terminal Green
                 activeCtx.lineWidth = 2 * currentGlobalScale;
                 activeCtx.stroke();
                 
                 // Crosshair
                 activeCtx.beginPath();
                 activeCtx.moveTo(x - radius*1.5, y); activeCtx.lineTo(x + radius*1.5, y);
                 activeCtx.moveTo(x, y - radius*1.5); activeCtx.lineTo(x, y + radius*1.5);
                 activeCtx.strokeStyle = cTop;
                 activeCtx.lineWidth = 1 * currentGlobalScale;
                 activeCtx.stroke();

             } else if (isMinimal) {
                 activeCtx.fillStyle = cTop;
                 activeCtx.fill();
                 activeCtx.strokeStyle = 'white';
                 activeCtx.lineWidth = 4 * currentGlobalScale;
                 activeCtx.stroke();
             } else if (isOrganic) {
                 const grad = activeCtx.createRadialGradient(x, y, 0, x, y, radius);
                 grad.addColorStop(0, '#fff'); // Hot center
                 grad.addColorStop(0.3, cTop);
                 grad.addColorStop(1, 'rgba(0,0,0,0)');
                 activeCtx.fillStyle = grad;
                 activeCtx.fill();
             } else {
                 // Default
                 const grad = activeCtx.createLinearGradient(x, y - radius, x, y + radius);
                 grad.addColorStop(0.45, cTop);
                 grad.addColorStop(0.55, colorCache[node.limitBottom] || '#666');
                 activeCtx.fillStyle = grad;
                 activeCtx.fill();

                 if (currentSettings.isColoredIlluminationEnabled) {
                     const rp = getRainbowPeriod(currentSettings.buttonSpacingScale * currentGlobalScale);
                     const phase = (y % rp) / rp;
                     const hue = (currentSettings.rainbowOffset + phase * 360) % 360;
                     const sat = currentSettings.isRainbowModeEnabled ? currentSettings.rainbowSaturation : 100;
                     activeCtx.strokeStyle = `hsl(${hue}, ${sat}%, 60%)`;
                     activeCtx.lineWidth = 4 * currentGlobalScale;
                 } else {
                     activeCtx.strokeStyle = 'white';
                     activeCtx.lineWidth = 3 * currentGlobalScale;
                 }
                 activeCtx.stroke();
             }

             const combinedScale = currentSettings.buttonSizeScale * limitScale * zoomScale * layoutSizeMult;
             if (combinedScale > 0.4) {
                if (isTechnical) {
                    activeCtx.fillStyle = '#0f0';
                    activeCtx.font = `bold ${Math.max(12, 16 * combinedScale * currentGlobalScale)}px monospace`;
                } else {
                    activeCtx.fillStyle = 'white';
                    activeCtx.font = `bold ${Math.max(12, Math.min(22, 16 * combinedScale)) * currentSettings.nodeTextSizeScale * currentGlobalScale}px sans-serif`; 
                }
                
                activeCtx.textAlign = 'center';
                activeCtx.textBaseline = 'middle';
                const spacingY = currentSettings.showFractionBar ? 0.55 : 0.50;
                
                if (!isOrganic || combinedScale > 0.6) {
                    activeCtx.fillText(node.n.toString(), x, y - (radius * spacingY));
                    if (currentSettings.showFractionBar) {
                        activeCtx.beginPath();
                        activeCtx.moveTo(x - (radius * 0.4), y);
                        activeCtx.lineTo(x + (radius * 0.4), y);
                        activeCtx.lineWidth = 1 * currentGlobalScale;
                        activeCtx.strokeStyle = isTechnical ? '#0f0' : 'white';
                        activeCtx.stroke();
                    }
                    activeCtx.fillText(node.d.toString(), x, y + (radius * spacingY));
                }
             }
      }
      
      // Pitch Bend Visual
      if (currentSettings.isPitchBendEnabled) {
            cursors.forEach(c => {
                if (c.originNodeId) { 
                    const node = nodeMapRef.current.get(c.originNodeId);
                    if(node) {
                         const nx = node.x * spacing + centerOffset;
                         const ny = node.y * spacing + centerOffset;
                         const pos = cursorPositionsRef.current.get(c.pointerId);
                         if (!pos) return;
                         let cx = 0, cy = 0;
                         if (scrollContainerRef.current) {
                             const r = scrollContainerRef.current.getBoundingClientRect();
                             cx = (pos.x - r.left) + scrollContainerRef.current.scrollLeft;
                             cy = (pos.y - r.top) + scrollContainerRef.current.scrollTop;
                         }
                         activeCtx.beginPath();
                         activeCtx.moveTo(nx, ny);
                         activeCtx.lineTo(cx, cy);
                         activeCtx.strokeStyle = isTechnical ? '#0f0' : 'white';
                         activeCtx.lineWidth = (isTechnical ? 1 : 2) * currentGlobalScale;
                         if(isTechnical) activeCtx.setLineDash([5, 5]);
                         activeCtx.globalAlpha = 0.5;
                         activeCtx.stroke();
                         activeCtx.globalAlpha = 1.0;
                         activeCtx.setLineDash([]);
                    }
                }
            });
      }

      animationFrameRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []); 

  const getBackgroundStyle = () => {
      const mode = settings.backgroundMode;
      const offset = settings.backgroundYOffset || 0;
      
      const baseStyle: React.CSSProperties = {
          minWidth: '100%', minHeight: '100%', width: dynamicSize, height: dynamicSize,
          pointerEvents: uiUnlocked ? 'none' : 'auto',
          backgroundPosition: `center calc(50% + ${offset}px)`,
          backgroundRepeat: 'no-repeat', backgroundSize: 'cover'
      };

      switch(mode) {
          case 'rainbow':
              const period = getRainbowPeriod(settings.buttonSpacingScale * globalScale);
              const stops = [];
              for(let i=0; i<=6; i++) {
                  const pct = (i/6)*100;
                  const hue = (settings.rainbowOffset + i*60);
                  stops.push(`hsl(${hue}, ${settings.rainbowSaturation}%, ${settings.rainbowBrightness}%) ${pct}%`);
              }
              return { ...baseStyle, backgroundImage: `linear-gradient(to bottom, ${stops.join(', ')})`, backgroundSize: `100% ${period}px`, backgroundRepeat: 'repeat', backgroundPosition: `0px calc(50% + ${offset}px)` };
          case 'charcoal': return { ...baseStyle, backgroundColor: '#18181b' }; 
          case 'midnight_blue': return { ...baseStyle, backgroundColor: '#0a0a23' }; 
          case 'deep_maroon': return { ...baseStyle, backgroundColor: '#3e0000' };
          case 'forest_green': return { ...baseStyle, backgroundColor: '#002200' };
          case 'slate_grey': return { ...baseStyle, backgroundColor: '#334155' };
          case 'image':
              if (settings.backgroundImageData) {
                  return { ...baseStyle, backgroundImage: `url(${settings.backgroundImageData})`, backgroundRepeat: settings.backgroundTiling ? 'repeat' : 'no-repeat', backgroundSize: settings.backgroundTiling ? 'auto' : 'contain', backgroundPosition: `center calc(50% + ${offset}px)` };
              }
              return { ...baseStyle, backgroundColor: 'black' };
          default: return { ...baseStyle, backgroundColor: 'black' };
      }
  };

  return (
    <div ref={scrollContainerRef} className="w-full h-full overflow-auto bg-slate-950 relative" style={{ touchAction: 'none' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onPointerCancel={handlePointerUp}>
        <div className="relative" style={getBackgroundStyle()}>
           <canvas ref={bgLineCanvasRef} className="absolute top-0 left-0 z-[5] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           <canvas ref={staticCanvasRef} className="absolute top-0 left-0 z-[10] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           <canvas ref={dynamicCanvasRef} className="absolute top-0 left-0 z-[20] pointer-events-none" style={{ width: '100%', height: '100%' }} />
           {isGenerating && (<div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/80 p-2 rounded-full backdrop-blur-sm border border-white/10 shadow-xl"><svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="text-xs font-bold text-slate-300 pr-2">Calculating...</span></div>)}
        </div>
    </div>
  );
});

export default React.memo(TonalityDiamond);
