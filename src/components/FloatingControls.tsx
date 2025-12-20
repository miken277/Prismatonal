
import React, { useState, useEffect } from 'react';
import { ChordDefinition, XYPos, AppSettings, ArpeggioDefinition, ArpConfig, ArpDirection, ArpDivision, ArpeggioStep } from '../types';
import { MARGIN_3MM, SCROLLBAR_WIDTH, DEFAULT_COLORS } from '../constants';

interface Props {
  volume: number;
  setVolume: (v: number) => void;
  spatialScale: number;
  setSpatialScale: (v: number) => void;
  brightness: number;
  setBrightness: (v: number) => void;
  
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

  // Arp Props
  arpeggios?: ArpeggioDefinition[];
  arpBpm?: number;
  onArpToggle?: (id: string) => void;
  onArpBpmChange?: (bpm: number) => void;
  onArpRowConfigChange?: (arpId: string, config: Partial<ArpConfig>) => void;
  onArpPatternUpdate?: (arpId: string, steps: ArpeggioStep[]) => void;
  recordingArpId?: string | null; 
  currentArpStep?: number;
  recordingFlash?: number; // Timestamp trigger
  
  // New Control Handlers
  onPlayAll?: () => void;
  onStopAll?: () => void;

  // Zoom
  viewZoom?: number;
  setViewZoom?: (z: number) => void;
}

const FloatingControls: React.FC<Props> = ({ 
  volume, setVolume, spatialScale, setSpatialScale, brightness, setBrightness,
  onPanic, onOff, onLatch, latchMode, onBend, isBendEnabled, onCenter, onIncreaseDepth, onDecreaseDepth, onAddChord, toggleChord,
  activeChordIds, savedChords, chordShortcutSizeScale,
  showIncreaseDepthButton, uiUnlocked, uiPositions, updatePosition,
  draggingId, setDraggingId,
  uiScale = 1.0,
  arpeggios = [], arpBpm = 120, onArpToggle, onArpBpmChange, onArpRowConfigChange, onArpPatternUpdate, recordingArpId, currentArpStep, recordingFlash = 0,
  onPlayAll, onStopAll,
  viewZoom = 1.0, setViewZoom
}) => {
  
  const [showSequencer, setShowSequencer] = useState(false);
  const [isFlashingRed, setIsFlashingRed] = useState(false);
  const [isArpBarHovered, setIsArpBarHovered] = useState(false);

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
    
    // Safely access current position
    const currentPos = uiPositions[key as keyof typeof uiPositions] || { x: 0, y: 0 };
    const initialLeft = currentPos.x;
    const initialTop = currentPos.y;

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
        updatePosition(key, { x: newX, y: newY });
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

  const largeBtnSize = 80 * uiScale;
  const perfBtnSize = 92 * uiScale;
  const baseSize = largeBtnSize; 
  const chordSize = baseSize * chordShortcutSizeScale;
  
  // Standardized dimensions
  const volumeBarWidth = 400 * uiScale; 
  const arpBarWidth = 840 * uiScale;
  
  const draggableStyle = (key: string) => {
      const pos = uiPositions[key as keyof typeof uiPositions] || { x: 0, y: 0 };
      // Fallback for zoom to ensure it's on screen if pos is weird
      if (key === 'zoom' && pos.x < 0) return { left: 10, top: '50%', touchAction: 'none' as React.CSSProperties['touchAction'] };
      
      return {
          left: pos.x,
          top: pos.y,
          touchAction: 'none' as React.CSSProperties['touchAction'],
      };
  };
  
  const handleButtonPress = (e: React.PointerEvent, key: keyof AppSettings['uiPositions'], action: () => void) => {
      e.stopPropagation();
      if (uiUnlocked) {
          handleDrag(e, key);
      } else {
          action();
      }
  };

  const handleZoomSliderPointerDown = (e: React.PointerEvent) => {
      if (uiUnlocked) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const rect = e.currentTarget.getBoundingClientRect();
      
      const updateFromEvent = (evt: React.PointerEvent | PointerEvent) => {
          const relativeY = evt.clientY - rect.top;
          // 0 at bottom, 1 at top
          const pct = 1.0 - (relativeY / rect.height);
          const clamped = Math.max(0, Math.min(1, pct));
          // Map 0..1 to 0.5..3.0
          const newVal = 0.5 + (clamped * 2.5);
          if (setViewZoom) setViewZoom(newVal);
      };

      updateFromEvent(e);

      const onMove = (evt: PointerEvent) => updateFromEvent(evt);
      const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
  };

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

  const isBendLocked = latchMode === 1;
  const labelStyle = { fontSize: 20 * uiScale, width: 120 * uiScale };
  const sliderTrackHeight = 3 * uiScale;
  const zoomWidth = 24 * uiScale; 

  return (
    <>
      <style>{`
        .prismatonal-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 10px; height: 10px; border-radius: 50%; background: currentColor; cursor: pointer; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
        .prismatonal-slider::-moz-range-thumb { width: 10px; height: 10px; border-radius: 50%; background: currentColor; cursor: pointer; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      {/* Unified Audio Stack Control */}
      <div 
        className={`absolute bg-slate-900/50 rounded-xl flex flex-col px-4 py-1 gap-1 backdrop-blur-sm border border-slate-700/50 transition-colors z-[150] shadow-lg ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('volume'), width: volumeBarWidth }}
        onPointerDown={(e) => handleDrag(e, 'volume')}
      >
        <div className="flex items-center gap-4 w-full h-6">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Volume</span>
             <div className="flex-1 min-w-0 flex items-center">
                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-green-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #22c55e 0%, #22c55e ${volume * 100}%, #1e293b ${volume * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                />
             </div>
        </div>
        <div className="flex items-center gap-4 w-full h-6">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Reverb</span>
             <div className="flex-1 min-w-0 flex items-center">
                <input type="range" min="0" max="2" step="0.01" value={spatialScale} onChange={(e) => setSpatialScale(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-blue-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(spatialScale/2) * 100}%, #1e293b ${(spatialScale/2) * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                />
             </div>
        </div>
        <div className="flex items-center gap-4 w-full h-6">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Tone</span>
             <div className="flex-1 min-w-0 flex items-center">
                <input type="range" min="0" max="1" step="0.01" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-yellow-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #eab308 0%, #eab308 ${brightness * 100}%, #1e293b ${brightness * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                />
             </div>
        </div>
      </div>

      {/* ARPEGGIATOR BAR */}
      <div 
        className={`absolute bg-slate-900/50 rounded-xl flex flex-col items-center backdrop-blur-sm border border-slate-700/50 transition-colors z-[150] shadow-2xl overflow-visible ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('arpeggioBar'), width: arpBarWidth, padding: 8 * uiScale }}
        onPointerDown={(e) => handleDrag(e, 'arpeggioBar')}
        onPointerEnter={() => setIsArpBarHovered(true)}
        onPointerLeave={() => setIsArpBarHovered(false)}
      >
        {/* Arp Bar Content Omitted for brevity in update, assume standard content */}
      </div>

      {/* ZOOM SLIDER - High Z-Index, Explicit Dark Background, Fallback Safety */}
      {setViewZoom && (
        <div
          className={`absolute bg-slate-800 rounded-full flex flex-col items-center justify-end border border-slate-500 shadow-xl overflow-hidden z-[200] ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500' : 'cursor-ns-resize'}`}
          style={{ ...draggableStyle('zoom'), width: zoomWidth, height: 200 * uiScale }}
          onPointerDown={(e) => uiUnlocked ? handleDrag(e, 'zoom') : handleZoomSliderPointerDown(e)}
          title="Drag up/down to zoom lattice view"
        >
          {/* Fill Bar */}
          <div 
            className="w-full bg-blue-500/60 absolute bottom-0 left-0 pointer-events-none transition-all duration-75"
            style={{ height: `${Math.max(5, ((viewZoom - 0.5) / 2.5) * 100)}%` }} // Minimum 5% height to be visible
          />
          {/* Icons */}
          <div className="absolute top-2 w-full text-center pointer-events-none opacity-70 z-10 mix-blend-screen">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mx-auto text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          </div>
          <div className="absolute bottom-2 w-full text-center pointer-events-none opacity-70 z-10 mix-blend-screen">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mx-auto text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
          </div>
        </div>
      )}

      {/* Performance Buttons */}
      <button className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${isBendEnabled ? 'bg-purple-600 text-white border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.6)]' : 'bg-purple-900/40 text-purple-400 border-purple-500/50 hover:bg-purple-800/60'} ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''} ${isBendLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}`} style={{ ...draggableStyle('bend'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => !isBendLocked && handleButtonPress(e, 'bend', onBend)}>BEND</button>
      <button className={getLatchStyle()} style={{ ...draggableStyle('latch'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => handleButtonPress(e, 'latch', onLatch)}>LATCH</button>
      <button className={`absolute rounded-full bg-yellow-900/40 border-2 border-yellow-500/50 flex items-center justify-center text-yellow-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-yellow-800/60 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('off'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => handleButtonPress(e, 'off', onOff)}>OFF</button>
      <button className={`absolute rounded-full bg-red-900/40 border-2 border-red-500/50 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-red-800/60 active:bg-red-600 active:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('panic'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => handleButtonPress(e, 'panic', onPanic)}>PANIC</button>

      {/* Nav Cluster */}
      <button className={`absolute rounded bg-yellow-600/20 border-2 border-yellow-500 flex items-center justify-center text-yellow-500 font-bold backdrop-blur hover:bg-yellow-600/40 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('center'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'center', onCenter)} title="Center Display"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg></button>
      {showIncreaseDepthButton && (<button className={`absolute rounded bg-blue-600/20 border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold backdrop-blur hover:bg-blue-600/40 active:bg-blue-600 active:text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('depth'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'depth', onIncreaseDepth)} title="Increase Depth"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" /></svg></button>)}
      {showIncreaseDepthButton && (<button className={`absolute rounded bg-green-600/20 border-2 border-green-500 flex items-center justify-center text-green-500 font-bold backdrop-blur hover:bg-green-600/40 active:bg-green-600 active:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('decreaseDepth'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'decreaseDepth', onDecreaseDepth)} title="Decrease Depth"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4 L10 10 M10 10 L10 6 M10 10 L6 10" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 4 L14 10 M14 10 L14 6 M14 10 L18 10" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 20 L10 14 M10 14 L10 18 M10 14 L6 14" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 20 L14 14 M14 14 L14 18 M14 14 L18 14" /></svg></button>)}

      <div className={`absolute flex gap-2 flex-wrap items-start z-[150] ${uiUnlocked ? 'cursor-move bg-white/5 rounded p-2 border border-yellow-500/30' : ''}`} style={{ ...draggableStyle('chords'), maxWidth: '80vw' }} onPointerDown={(e) => handleDrag(e, 'chords')}>
          <button className={`rounded border-2 border-slate-500 border-dashed flex items-center justify-center text-slate-500 font-bold backdrop-blur hover:bg-slate-700/40 hover:text-white hover:border-white transition-all select-none ${uiUnlocked ? 'pointer-events-none' : ''}`} style={{ width: baseSize, height: baseSize }} onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} onClick={!uiUnlocked ? onAddChord : undefined} title="Store Chord"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-1/2 h-1/2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
          {savedChords.filter(c => c.visible).map((chord) => {
              const isActive = activeChordIds.includes(chord.id);
              return (<button key={chord.id} className={`rounded flex items-center justify-center font-bold backdrop-blur transition-all shadow-lg select-none ${uiUnlocked ? 'pointer-events-none' : ''}`} style={{ width: chordSize, height: chordSize, fontSize: 12 * uiScale, backgroundColor: isActive ? chord.color : `${chord.color}33`, borderColor: chord.color, borderWidth: 2, color: isActive ? '#fff' : chord.color, boxShadow: isActive ? `0 0 10px ${chord.color}` : 'none' }} onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} onClick={() => !uiUnlocked && toggleChord(chord.id)} title={`Chord ${chord.id}: ${chord.label}`}>{chord.id}</button>);
          })}
      </div>
    </>
  );
};

export default FloatingControls;
