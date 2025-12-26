import React, { useState, useEffect } from 'react';
import { ChordDefinition, XYPos, AppSettings, ArpeggioDefinition, ArpConfig, ArpDivision, ArpeggioStep } from '../types';
import { MARGIN_3MM, SCROLLBAR_WIDTH, DEFAULT_COLORS } from '../constants';
import { getMaxPrime } from '../services/LatticeService';

interface Props {
  volume: number;
  setVolume: (v: number) => void;
  spatialScale: number;
  setSpatialScale: (v: number) => void;
  brightness: number;
  setBrightness: (v: number) => void;
  viewZoom: number;
  setViewZoom: (v: number) => void;
  
  onPanic: () => void;
  onOff: () => void;
  onLatch: () => void;
  latchMode: 0 | 1 | 2;
  onBend: () => void;
  isBendEnabled: boolean;
  onCenter: () => void;
  onIncreaseDepth: () => void;
  onDecreaseDepth: () => void;
  onAddChord: () => void;
  toggleChord: (id: string) => void;
  activeChordIds: string[];
  savedChords: ChordDefinition[];
  chordShortcutSizeScale: number;
  showIncreaseDepthButton: boolean;
  uiUnlocked: boolean;
  uiPositions: AppSettings['uiPositions'];
  updatePosition: (key: keyof AppSettings['uiPositions'], pos: XYPos) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  uiScale?: number;
  
  arpeggios?: ArpeggioDefinition[];
  arpBpm?: number;
  onArpToggle?: (id: string) => void;
  onArpBpmChange?: (bpm: number) => void;
  onArpRowConfigChange?: (arpId: string, config: Partial<ArpConfig>) => void;
  onArpPatternUpdate?: (arpId: string, steps: ArpeggioStep[]) => void;
  recordingArpId?: string | null; 
  currentArpStep?: number;
  recordingFlash?: number;
  onPlayAll?: () => void;
  onStopAll?: () => void;
  
  maxArpWidth?: number; // New prop for responsive width constraint
}

const FloatingControls: React.FC<Props> = ({ 
  volume, setVolume, spatialScale, setSpatialScale, brightness, setBrightness, viewZoom, setViewZoom,
  onPanic, onOff, onLatch, latchMode, onBend, isBendEnabled, onCenter, onIncreaseDepth, onDecreaseDepth, onAddChord, toggleChord,
  activeChordIds, savedChords, chordShortcutSizeScale,
  showIncreaseDepthButton, uiUnlocked, uiPositions, updatePosition,
  draggingId, setDraggingId, uiScale = 1.0,
  arpeggios = [], arpBpm = 120, onArpToggle, onArpBpmChange, onArpRowConfigChange, onArpPatternUpdate, recordingArpId, currentArpStep, recordingFlash = 0,
  onPlayAll, onStopAll,
  maxArpWidth
}) => {
  
  const [showSequencer, setShowSequencer] = useState(false);
  const [isArpBarHovered, setIsArpBarHovered] = useState(false);
  const [isFlashingRed, setIsFlashingRed] = useState(false);

  useEffect(() => {
      if (recordingFlash > 0) {
          setIsFlashingRed(true);
          const t = setTimeout(() => setIsFlashingRed(false), 200);
          return () => clearTimeout(t);
      }
  }, [recordingFlash]);

  const handleDrag = (e: React.PointerEvent, key: keyof AppSettings['uiPositions']) => {
    if (!uiUnlocked) return;
    if (draggingId !== null && draggingId !== key) return;

    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = uiPositions[key as keyof typeof uiPositions].x;
    const initialTop = uiPositions[key as keyof typeof uiPositions].y;

    el.setPointerCapture(e.pointerId);
    setDraggingId(key);

    const onMove = (evt: PointerEvent) => {
        const deltaX = evt.clientX - startX;
        const deltaY = evt.clientY - startY;
        let newX = initialLeft + deltaX;
        let newY = initialTop + deltaY;
        const maxX = window.innerWidth - el.offsetWidth - MARGIN_3MM - SCROLLBAR_WIDTH;
        const maxY = window.innerHeight - el.offsetHeight - MARGIN_3MM - SCROLLBAR_WIDTH;
        const minX = MARGIN_3MM;
        const minY = MARGIN_3MM;
        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));
        updatePosition(key as keyof AppSettings['uiPositions'], { x: newX, y: newY });
    };

    const onUp = () => {
        setDraggingId(null);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleButtonPress = (e: React.PointerEvent, key: keyof AppSettings['uiPositions'], action: () => void) => {
      e.stopPropagation();
      if (uiUnlocked) {
          handleDrag(e, key);
      } else {
          action();
      }
  };

  const largeBtnSize = 80 * uiScale;
  const perfBtnSize = 92 * uiScale;
  const baseSize = largeBtnSize; 
  const chordSize = baseSize * chordShortcutSizeScale;
  
  // Dimensions
  const volumeBarWidth = 600 * uiScale; 
  const defaultArpBarWidth = 760 * uiScale;
  
  // Responsive width calculation for Arp Bar
  // If maxArpWidth is provided, we constrain. Otherwise use default.
  // We also ensure it doesn't shrink below a usable minimum (e.g., 300px)
  const effectiveArpWidth = maxArpWidth ? Math.max(300 * uiScale, Math.min(defaultArpBarWidth, maxArpWidth)) : defaultArpBarWidth;
  const isConstrained = effectiveArpWidth < defaultArpBarWidth * 0.95;
  
  const draggableStyle = (key: string) => ({
      left: uiPositions[key as keyof typeof uiPositions].x,
      top: uiPositions[key as keyof typeof uiPositions].y,
      touchAction: 'none' as React.CSSProperties['touchAction'],
  });

  const getLatchStyle = () => {
      const base = "absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none shadow-lg";
      const unlocked = uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : '';
      if (latchMode === 1) return `${base} ${unlocked} bg-green-500 text-white border-2 border-green-300 shadow-[0_0_20px_rgba(34,197,94,0.8)]`;
      else if (latchMode === 2) return `${base} ${unlocked} bg-green-900/60 text-green-400 border-2 border-green-400 ring-4 ring-green-500/30 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.4)]`;
      else return `${base} ${unlocked} bg-green-900/40 border-2 border-green-500/50 text-green-500 hover:bg-green-800/60 active:bg-green-600 active:text-white shadow-[0_0_15px_rgba(34,197,94,0.2)]`;
  };

  const isAnyArpPlaying = arpeggios.some(a => a.isPlaying);
  
  const getBpmLightClass = () => {
      if (isFlashingRed) return 'bg-red-500 shadow-[0_0_10px_red]';
      if (isAnyArpPlaying) {
          const tick = Math.floor(Date.now() / (30000 / (arpBpm || 120)));
          return tick % 2 === 0 ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-slate-800';
      }
      return 'bg-slate-800';
  };

  const handleStepClick = (e: React.MouseEvent | React.TouchEvent, arpId: string, stepIndex: number) => {
      const arp = arpeggios.find(a => a.id === arpId);
      if (!arp || !onArpPatternUpdate) return;
      
      if (stepIndex < arp.steps.length) {
          const step = arp.steps[stepIndex];
          const newSteps = [...arp.steps];
          
          newSteps[stepIndex] = { ...step, muted: !step.muted };
          onArpPatternUpdate(arpId, newSteps);
      }
  };

  const handleStepRightClick = (e: React.MouseEvent, arpId: string, stepIndex: number) => {
      e.preventDefault();
      const arp = arpeggios.find(a => a.id === arpId);
      if (!arp || !onArpPatternUpdate) return;
      
      if (stepIndex < arp.steps.length) {
          const newSteps = [...arp.steps];
          newSteps.splice(stepIndex, 1);
          onArpPatternUpdate(arpId, newSteps);
      }
  };

  const handleClearPattern = (arpId: string) => {
      if (onArpPatternUpdate) {
          onArpPatternUpdate(arpId, []);
      }
  };

  const isBendLocked = latchMode === 1;

  const labelStyle = { 
      fontSize: 20 * uiScale, 
      width: 120 * uiScale,
  };

  const sliderTrackHeight = 3 * uiScale;

  return (
    <>
      <style>{`
        .prismatonal-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 10px; height: 10px; border-radius: 50%; background: currentColor; cursor: pointer; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
        .prismatonal-slider::-moz-range-thumb { width: 10px; height: 10px; border-radius: 50%; background: currentColor; cursor: pointer; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spinner { -moz-appearance: textfield; }
        
        .seq-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .seq-scroll::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.3); border-radius: 3px; }
        .seq-scroll::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.6); border-radius: 3px; border: 1px solid rgba(15, 23, 42, 0.3); }
        .seq-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.8); }
      `}</style>

      {/* Unified Audio & View Control */}
      <div 
        className={`absolute bg-slate-900/50 rounded-xl flex flex-col px-3 py-1 gap-0.5 backdrop-blur-sm border border-slate-700/50 transition-colors z-[150] shadow-lg ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('volume'), width: volumeBarWidth }}
        onPointerDown={(e) => handleDrag(e, 'volume')}
      >
        <div className="flex items-center gap-2 w-full h-6">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Volume</span>
             <div className="flex-1 min-w-0 flex items-center pl-1">
                <input 
                    type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-green-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #22c55e 0%, #22c55e ${volume * 100}%, #1e293b ${volume * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                />
             </div>
        </div>
        <div className="flex items-center gap-2 w-full h-6">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Reverb</span>
             <div className="flex-1 min-w-0 flex items-center pl-1">
                <input 
                    type="range" min="0" max="2" step="0.01" value={spatialScale} onChange={(e) => setSpatialScale(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-blue-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(spatialScale/2) * 100}%, #1e293b ${(spatialScale/2) * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                />
             </div>
        </div>
        <div className="flex items-center gap-2 w-full h-6">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Tone</span>
             <div className="flex-1 min-w-0 flex items-center pl-1">
                <input 
                    type="range" min="0" max="1" step="0.01" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-yellow-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #eab308 0%, #eab308 ${brightness * 100}%, #1e293b ${brightness * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                />
             </div>
        </div>
        <div className="flex items-center gap-2 w-full h-6">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Zoom</span>
             <div className="flex-1 min-w-0 flex items-center pl-1">
                <input 
                    type="range" min="0.5" max="3.0" step="0.05" value={viewZoom} onChange={(e) => setViewZoom(parseFloat(e.target.value))} disabled={uiUnlocked}
                    onDoubleClick={(e) => { e.stopPropagation(); setViewZoom(1.0); }}
                    title="Double-click to Reset Zoom"
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-cyan-400 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${((viewZoom-0.5)/2.5) * 100}%, #1e293b ${((viewZoom-0.5)/2.5) * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                />
             </div>
        </div>
      </div>

      {/* ARPEGGIATOR BAR - Responsive Width & Wrapping */}
      <div 
        className={`absolute bg-slate-900/50 rounded-xl flex flex-col items-center backdrop-blur-sm border border-slate-700/50 transition-colors z-[150] shadow-2xl overflow-visible ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ 
            ...draggableStyle('arpeggioBar'), 
            width: effectiveArpWidth,
            padding: `8px ${8 * uiScale}px`,
            height: 'auto'
        }}
        onPointerDown={(e) => handleDrag(e, 'arpeggioBar')}
        onPointerEnter={() => setIsArpBarHovered(true)}
        onPointerLeave={() => setIsArpBarHovered(false)}
      >
        <div className="w-full flex flex-col gap-2">
             <div className={`flex items-center justify-between px-1 h-6 ${isConstrained ? 'flex-wrap h-auto gap-y-2' : ''}`}>
                 <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mr-2">ARPEGGIATOR</span>
                 
                 <div className="flex items-center gap-2">
                     <div className="flex items-center bg-slate-800/50 rounded border border-slate-700/50 overflow-hidden h-5">
                        <button 
                            className="px-1.5 hover:bg-slate-700 active:bg-slate-600 text-slate-400 hover:text-white transition-colors border-r border-slate-700/30 flex items-center justify-center h-full"
                            onPointerDown={(e) => { e.stopPropagation(); onArpBpmChange && onArpBpmChange(Math.max(1, (arpBpm || 120) - 1)); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <input 
                            type="number" 
                            value={arpBpm} 
                            onChange={(e) => onArpBpmChange && onArpBpmChange(parseInt(e.target.value))}
                            className="w-8 bg-transparent text-center text-[10px] font-mono font-bold text-slate-300 focus:outline-none focus:text-white no-spinner h-full"
                            onPointerDown={(e) => e.stopPropagation()}
                        />
                        <button 
                            className="px-1.5 hover:bg-slate-700 active:bg-slate-600 text-slate-400 hover:text-white transition-colors border-l border-slate-700/30 flex items-center justify-center h-full"
                            onPointerDown={(e) => { e.stopPropagation(); onArpBpmChange && onArpBpmChange(Math.min(300, (arpBpm || 120) + 1)); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                     </div>
                     
                     <div className={`w-2 h-2 rounded-full transition-colors duration-100 ${getBpmLightClass()}`}></div>
                     <span className="text-[9px] text-slate-500 font-bold">BPM</span>
                 </div>
             </div>

             <div className="flex gap-1.5 justify-center flex-wrap w-full">
                 {arpeggios.map(arp => {
                     const isRecording = recordingArpId === arp.id;
                     const isPlaying = arp.isPlaying;
                     const hasData = arp.steps.length > 0;
                     
                     let btnClass = "bg-slate-800/80 border-slate-600 text-slate-400";
                     if (isRecording) btnClass = "bg-red-900/80 border-red-500 text-white animate-pulse shadow-[0_0_10px_red]";
                     else if (isPlaying) btnClass = "bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_blue]";
                     else if (hasData) btnClass = "bg-slate-700 border-blue-500/30 text-blue-200";

                     const showGreenDot = isPlaying && !isArpBarHovered && !isRecording;

                     return (
                         <button 
                            key={arp.id}
                            className={`rounded flex items-center justify-center font-bold border-2 transition-all hover:scale-105 active:scale-95 ${btnClass}`}
                            style={{ width: 34 * uiScale, height: 34 * uiScale, fontSize: 12 * uiScale, flexShrink: 0 }}
                            onPointerDown={(e) => { e.stopPropagation(); if(onArpToggle) onArpToggle(arp.id); }}
                         >
                             {showGreenDot ? (
                                 <div className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]"></div>
                             ) : (
                                 arp.id
                             )}
                         </button>
                     );
                 })}
             </div>
        </div>
        
        <button 
            className="w-full h-4 mt-1 bg-slate-800/50 hover:bg-slate-700/50 rounded flex items-center justify-center cursor-pointer transition-colors"
            onPointerDown={(e) => { e.stopPropagation(); setShowSequencer(!showSequencer); }}
        >
             <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 text-slate-400 transition-transform ${showSequencer ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
             </svg>
        </button>
        
        {showSequencer && (
            <div 
                className="absolute left-0 top-full mt-2 bg-slate-950/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 z-[160] flex flex-col gap-3"
                style={{ 
                    width: '350px', 
                    height: '320px', 
                    minWidth: '350px',
                    minHeight: '200px',
                    maxWidth: 'calc(100vw - 40px)',
                    maxHeight: '90vh',
                    resize: 'both',
                    overflow: 'hidden' 
                }}
                onPointerDown={(e) => e.stopPropagation()} 
            >
                <div className="flex justify-between items-center pb-1 border-b border-white/10 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pattern Matrix</span>
                    <div className="flex gap-2">
                        {onPlayAll && (
                            <button 
                                className="text-[10px] font-bold bg-green-900/50 hover:bg-green-700 text-green-400 hover:text-white px-2 py-0.5 rounded border border-green-700 transition-colors"
                                onPointerDown={(e) => { e.stopPropagation(); onPlayAll(); }}
                            >
                                PLAY ALL
                            </button>
                        )}
                        {onStopAll && (
                            <button 
                                className="text-[10px] font-bold bg-red-900/50 hover:bg-red-700 text-red-400 hover:text-white px-2 py-0.5 rounded border border-red-700 transition-colors"
                                onPointerDown={(e) => { e.stopPropagation(); onStopAll(); }}
                            >
                                STOP ALL
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-900/30 rounded-lg border border-slate-800 seq-scroll p-1 min-h-0">
                    {arpeggios.map((arp) => {
                        const isPlaying = arp.isPlaying;
                        const config = arp.config || { direction: 'order', division: '1/8', octaves: 1, gate: 0.8, swing: 0, length: 8 };
                        const patternLength = config.length;
                        
                        const steps = Array.from({ length: patternLength }, (_, i) => {
                            if (arp.steps.length > i) return arp.steps[i]; 
                            return null;
                        });

                        return (
                            <div key={arp.id} className="flex flex-col mb-2 bg-slate-800/20 rounded border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-2 p-1 border-b border-white/5 bg-slate-800/40 rounded-t">
                                    <button 
                                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${isPlaying ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'}`}
                                        onPointerDown={(e) => { e.stopPropagation(); if(onArpToggle) onArpToggle(arp.id); }}
                                    >
                                        {arp.id}
                                    </button>
                                    
                                    <div className="flex items-center gap-1 bg-slate-900/50 rounded px-1 border border-slate-700/50">
                                        <span className="text-[8px] font-bold text-slate-500 uppercase">Len</span>
                                        <button className="text-[10px] text-slate-400 hover:text-white" onPointerDown={(e) => {e.stopPropagation(); onArpRowConfigChange && onArpRowConfigChange(arp.id, {length: Math.max(1, config.length - 1)})}}>-</button>
                                        <span className="text-[9px] font-mono w-3 text-center text-slate-300">{config.length}</span>
                                        <button className="text-[10px] text-slate-400 hover:text-white" onPointerDown={(e) => {e.stopPropagation(); onArpRowConfigChange && onArpRowConfigChange(arp.id, {length: Math.min(32, config.length + 1)})}}>+</button>
                                    </div>

                                    <div className="flex items-center gap-1 bg-slate-900/50 rounded px-1 border border-slate-700/50">
                                        <span className="text-[8px] font-bold text-slate-500 uppercase">Div</span>
                                        <select 
                                            value={config.division}
                                            onChange={(e) => onArpRowConfigChange && onArpRowConfigChange(arp.id, { division: e.target.value as ArpDivision })}
                                            className="h-4 text-[9px] bg-transparent text-slate-300 font-mono focus:outline-none cursor-pointer"
                                        >
                                            {(['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'] as ArpDivision[]).map(div => (
                                                <option key={div} value={div}>{div}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1 bg-slate-900/50 rounded px-1 border border-slate-700/50">
                                        <span className="text-[8px] font-bold text-slate-500 uppercase">Gate</span>
                                        <button className="text-[10px] text-slate-400 hover:text-white" onPointerDown={(e) => {e.stopPropagation(); onArpRowConfigChange && onArpRowConfigChange(arp.id, {gate: Math.max(0.1, config.gate - 0.1)})}}>-</button>
                                        <span className="text-[9px] font-mono w-5 text-center text-slate-300">{(config.gate*100).toFixed(0)}</span>
                                        <button className="text-[10px] text-slate-400 hover:text-white" onPointerDown={(e) => {e.stopPropagation(); onArpRowConfigChange && onArpRowConfigChange(arp.id, {gate: Math.min(1.0, config.gate + 0.1)})}}>+</button>
                                    </div>

                                    <div className="flex-1"></div>
                                    
                                    <button
                                        className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                                        title="Clear Pattern"
                                        onPointerDown={(e) => { e.stopPropagation(); handleClearPattern && handleClearPattern(arp.id); }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="flex gap-1 overflow-x-auto seq-scroll p-1 items-center h-10 w-full">
                                    {steps.map((step, idx) => {
                                        const isCurrent = isPlaying && idx === (currentArpStep || 0) % patternLength;
                                        const hasData = step !== null;
                                        const isMuted = step?.muted;
                                        
                                        const borderColor = hasData ? 'border-blue-500' : 'border-slate-700';
                                        const bgColor = isCurrent ? 'bg-slate-600' : (hasData && isMuted ? 'bg-slate-900' : 'bg-slate-800/80');
                                        const textColor = hasData ? (isMuted ? 'text-slate-600' : 'text-blue-200') : 'text-slate-600';
                                        
                                        const limitN = hasData ? getMaxPrime(step.n || 1) : 1;
                                        const limitD = hasData ? getMaxPrime(step.d || 1) : 1;
                                        
                                        const colorN = DEFAULT_COLORS[limitN as keyof typeof DEFAULT_COLORS] || '#fff';
                                        const colorD = DEFAULT_COLORS[limitD as keyof typeof DEFAULT_COLORS] || '#fff';

                                        const squareStyle = hasData ? {
                                            background: `linear-gradient(135deg, ${colorN} 50%, ${colorD} 50%)`
                                        } : {};

                                        return (
                                            <div 
                                                key={idx} 
                                                className={`flex-shrink-0 w-8 h-8 rounded border flex items-center justify-center transition-all m-0.5 cursor-pointer relative overflow-hidden
                                                    ${!hasData ? bgColor : ''} ${borderColor} ${isCurrent ? 'shadow-lg scale-110 z-10 border-white' : ''} 
                                                    ${hasData ? 'hover:border-white' : ''}
                                                `}
                                                style={squareStyle}
                                                title={hasData ? `Ratio: ${step?.n}/${step?.d} (Left: Toggle Mute, Right: Delete)` : `Step ${idx+1}`}
                                                onPointerDown={(e) => e.stopPropagation()} 
                                                onClick={(e) => hasData && handleStepClick(e, arp.id, idx)}
                                                onContextMenu={(e) => hasData && handleStepRightClick(e, arp.id, idx)}
                                            >
                                                {hasData ? (
                                                    <div className={`w-full h-full relative ${isMuted ? 'opacity-30 grayscale' : ''}`}>
                                                        <span className="absolute top-0.5 left-1 text-[9px] font-bold text-white leading-none drop-shadow-md shadow-black">
                                                            {step?.n}
                                                        </span>
                                                        <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-white leading-none drop-shadow-md shadow-black">
                                                            {step?.d}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className={`text-[10px] font-mono ${textColor} select-none`}>{idx+1}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-between items-end relative mt-1 flex-shrink-0">
                     {recordingArpId && (
                         <span className="text-[10px] text-red-400 animate-pulse">Recording to {recordingArpId}...</span>
                     )}
                     <div className="absolute bottom-0 right-0 pointer-events-none text-slate-600 opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M22 22H12l10-10v10z"/></svg>
                     </div>
                </div>
            </div>
        )}
      </div>

      <button 
        className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${isBendEnabled ? 'bg-purple-600 text-white border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.6)]' : 'bg-purple-900/40 text-purple-400 border-purple-500/50 hover:bg-purple-800/60'} ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''} ${isBendLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}`} 
        style={{ ...draggableStyle('bend'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} 
        onPointerDown={(e) => !isBendLocked && handleButtonPress(e, 'bend', onBend)}
      >
        BEND
      </button>
      <button className={getLatchStyle()} style={{ ...draggableStyle('latch'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => handleButtonPress(e, 'latch', onLatch)}>LATCH</button>
      <button className={`absolute rounded-full bg-yellow-900/40 border-2 border-yellow-500/50 flex items-center justify-center text-yellow-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-yellow-800/60 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('off'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => handleButtonPress(e, 'off', onOff)}>OFF</button>
      <button className={`absolute rounded-full bg-red-900/40 border-2 border-red-500/50 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-red-800/60 active:bg-red-600 active:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('panic'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => handleButtonPress(e, 'panic', onPanic)}>PANIC</button>

      <button className={`absolute rounded bg-yellow-600/20 border-2 border-yellow-500 flex items-center justify-center text-yellow-500 font-bold backdrop-blur hover:bg-yellow-600/40 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('center'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'center', onCenter)} title="Center Display"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg></button>

      {showIncreaseDepthButton && (<button className={`absolute rounded bg-blue-600/20 border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold backdrop-blur hover:bg-blue-600/40 active:bg-blue-600 active:text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('depth'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'depth', onIncreaseDepth)} title="Increase Depth from Selection"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" /></svg></button>)}

      {showIncreaseDepthButton && (<button className={`absolute rounded bg-green-600/20 border-2 border-green-500 flex items-center justify-center text-green-500 font-bold backdrop-blur hover:bg-green-600/40 active:bg-green-600 active:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('decreaseDepth'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'decreaseDepth', onDecreaseDepth)} title="Undo Last Depth Increase"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4 L10 10 M10 10 L10 6 M10 10 L6 10" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 4 L14 10 M14 10 L14 6 M14 10 L18 10" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 20 L10 14 M10 14 L10 18 M10 14 L6 14" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 20 L14 14 M14 14 L14 18 M14 14 L18 14" /></svg></button>)}

      <div className={`absolute flex gap-2 flex-wrap items-start z-[150] ${uiUnlocked ? 'cursor-move bg-white/5 rounded p-2 border border-yellow-500/30' : ''}`} style={{ ...draggableStyle('chords'), maxWidth: '80vw' }} onPointerDown={(e) => handleDrag(e, 'chords')}>
          <button className={`rounded border-2 border-slate-500 border-dashed flex items-center justify-center text-slate-500 font-bold backdrop-blur hover:bg-slate-700/40 hover:text-white hover:border-white transition-all select-none ${uiUnlocked ? 'pointer-events-none' : ''}`} style={{ width: baseSize, height: baseSize }} onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} onClick={!uiUnlocked ? onAddChord : undefined} title="Store currently latched notes as a Chord"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-1/2 h-1/2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
          {savedChords.filter(c => c.visible).map((chord) => {
              const isActive = activeChordIds.includes(chord.id);
              return (<button key={chord.id} className={`rounded flex items-center justify-center font-bold backdrop-blur transition-all shadow-lg select-none ${uiUnlocked ? 'pointer-events-none' : ''}`} style={{ width: chordSize, height: chordSize, fontSize: 12 * uiScale, backgroundColor: isActive ? chord.color : `${chord.color}33`, borderColor: chord.color, borderWidth: 2, color: isActive ? '#fff' : chord.color, boxShadow: isActive ? `0 0 10px ${chord.color}` : 'none' }} onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} onClick={() => !uiUnlocked && toggleChord(chord.id)} title={`Chord ${chord.id}: ${chord.label}`}>{chord.id}</button>);
          })}
      </div>
    </>
  );
};

export default FloatingControls;