
import React, { useState, useEffect, useRef } from 'react';
import { ChordDefinition, XYPos, AppSettings, ArpeggioDefinition, ArpConfig, ArpeggioStep, PresetState, PlayMode, SynthPreset } from '../types';
import { MARGIN_3MM, SCROLLBAR_WIDTH } from '../constants';
import { recordingService } from '../services/RecordingService';
import ArpeggiatorBar from './controls/ArpeggiatorBar';
import InstrumentCluster from './controls/InstrumentCluster';

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
  onLatch: () => void; // Used for Drone
  onSust?: () => void; // Used for Strings
  onPluck?: () => void; // Used for Plucked
  latchMode: 0 | 1 | 2 | 3;
  onBend: () => void;
  isBendEnabled: boolean;
  onSustainToggle?: () => void;
  isSustainEnabled?: boolean;
  onCenter: () => void;
  onIncreaseDepth: () => void;
  onDecreaseDepth: () => void;
  onAddChord: () => void;
  toggleChord: (id: string) => void;
  onRemoveChord?: (id: string) => void;
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
  
  maxArpWidth?: number; 
  activeSustainedModes?: number[];
  onClearSustain?: (mode: number) => void;
  
  isShortScreen?: boolean; 
  
  isSequencerOpen: boolean;
  onToggleSequencer: () => void;

  presets?: PresetState;
  onPresetChange?: (mode: PlayMode, preset: SynthPreset) => void;
  
  recordScreenActivity?: boolean;
}

const FloatingControls: React.FC<Props> = ({ 
  volume, setVolume, spatialScale, setSpatialScale, brightness, setBrightness, viewZoom, setViewZoom,
  onPanic, onOff, onLatch, onSust, onPluck, latchMode, onBend, isBendEnabled, onSustainToggle, isSustainEnabled, onCenter, onIncreaseDepth, onDecreaseDepth, onAddChord, toggleChord, onRemoveChord,
  activeChordIds, savedChords, chordShortcutSizeScale,
  showIncreaseDepthButton, uiUnlocked, uiPositions, updatePosition,
  draggingId, setDraggingId, uiScale = 1.0,
  arpeggios = [], arpBpm = 120, onArpToggle, onArpBpmChange, onArpRowConfigChange, onArpPatternUpdate, recordingArpId, currentArpStep, recordingFlash = 0,
  onPlayAll, onStopAll,
  maxArpWidth,
  activeSustainedModes = [],
  onClearSustain,
  isShortScreen = false,
  isSequencerOpen,
  onToggleSequencer,
  presets,
  onPresetChange,
  recordScreenActivity = false
}) => {
  
  const [isFlashingRed, setIsFlashingRed] = useState(false);
  
  // Recording State - Sync initial state from service
  const [isRecording, setIsRecording] = useState(recordingService.isRecording);
  const [recDuration, setRecDuration] = useState(0);
  const recTimerRef = useRef<number | null>(null);
  const recSyncTimerRef = useRef<number | null>(null);

  useEffect(() => {
      if (recordingFlash > 0) {
          setIsFlashingRed(true);
          const t = setTimeout(() => setIsFlashingRed(false), 200);
          return () => clearTimeout(t);
      }
  }, [recordingFlash]);

  // Clean up recording timers
  useEffect(() => {
      return () => {
          if (recTimerRef.current) clearInterval(recTimerRef.current);
          if (recSyncTimerRef.current) clearInterval(recSyncTimerRef.current);
      };
  }, []);

  const handleToggleRecord = async () => {
      if (isRecording) {
          handleStopRecord();
      } else {
          try {
              const mode = recordScreenActivity ? 'video-audio' : 'audio-only';
              await recordingService.startRecording(mode);
              setIsRecording(true);
              setRecDuration(0);
              
              recTimerRef.current = window.setInterval(() => {
                  setRecDuration(prev => prev + 1);
              }, 1000);

              // Safety check for external stop (e.g. browser UI)
              recSyncTimerRef.current = window.setInterval(() => {
                  if (!recordingService.isRecording) {
                      handleStopRecord();
                  }
              }, 1000);

          } catch (e) {
              console.error("Failed to start recording", e);
              alert("Failed to start recording.");
          }
      }
  };

  const handleStopRecord = () => {
      recordingService.stopRecording();
      setIsRecording(false);
      if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
      if (recSyncTimerRef.current) { clearInterval(recSyncTimerRef.current); recSyncTimerRef.current = null; }
  };

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

  const handleButtonPress = (e: React.PointerEvent, key: keyof AppSettings['uiPositions'], action?: () => void) => {
      e.stopPropagation();
      if (uiUnlocked) {
          handleDrag(e, key);
      } else {
          if (e.button === 0 && action) action();
      }
  };

  const largeBtnSize = 80 * uiScale;
  const perfBtnSize = 92 * uiScale;
  const baseSize = largeBtnSize; 
  const chordSize = baseSize * chordShortcutSizeScale;
  
  const volumeBarWidth = 600 * uiScale; 
  const defaultArpBarWidth = 760 * uiScale;
  const effectiveArpWidth = maxArpWidth ? Math.max(300 * uiScale, Math.min(defaultArpBarWidth, maxArpWidth)) : defaultArpBarWidth;
  const isConstrained = effectiveArpWidth < defaultArpBarWidth * 0.95;
  
  const draggableStyle = (key: string) => ({
      left: uiPositions[key as keyof typeof uiPositions]?.x || 0,
      top: uiPositions[key as keyof typeof uiPositions]?.y || 0,
      touchAction: 'none' as React.CSSProperties['touchAction'],
  });

  const isPluckedActive = latchMode === 3;
  const isBendLocked = isPluckedActive;
  const isSustainLocked = isPluckedActive;

  const labelStyle = { 
      fontSize: 20 * uiScale, 
      width: 120 * uiScale,
  };

  const sliderTrackHeight = 3 * uiScale;

  const sustColorClass = latchMode === 1 
      ? (isSustainEnabled 
          ? 'bg-green-600 text-white border-green-300 shadow-[0_0_15px_rgba(34,197,94,0.6)]' 
          : 'bg-green-900/40 text-green-400 border-green-500/50 hover:bg-green-800/60')
      : (isSustainEnabled 
          ? 'bg-blue-600 text-white border-blue-300 shadow-[0_0_15px_rgba(37,99,235,0.6)]' 
          : 'bg-blue-900/40 text-blue-400 border-blue-500/50 hover:bg-blue-800/60');

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

      {/* Unified Audio & View Control (Top Right) */}
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

      {/* ARPEGGIATOR BAR */}
      <ArpeggiatorBar 
          arpeggios={arpeggios}
          arpBpm={arpBpm}
          onArpToggle={onArpToggle}
          onArpBpmChange={onArpBpmChange}
          onArpRowConfigChange={onArpRowConfigChange}
          onArpPatternUpdate={onArpPatternUpdate}
          recordingArpId={recordingArpId}
          currentArpStep={currentArpStep}
          onPlayAll={onPlayAll}
          onStopAll={onStopAll}
          isSequencerOpen={isSequencerOpen}
          onToggleSequencer={onToggleSequencer}
          isRecording={isRecording}
          recDuration={recDuration}
          onToggleRecord={handleToggleRecord}
          uiScale={uiScale}
          position={uiPositions.arpeggioBar}
          isConstrained={isConstrained}
          width={effectiveArpWidth}
          onDragStart={(e) => handleDrag(e, 'arpeggioBar')}
          isFlashingRed={isFlashingRed}
      />

      {/* INSTRUMENT CLUSTER (Left) */}
      <InstrumentCluster 
          latchMode={latchMode}
          onLatch={onLatch}
          onSust={onSust}
          onPluck={onPluck}
          activeSustainedModes={activeSustainedModes}
          onClearSustain={onClearSustain}
          presets={presets}
          onPresetChange={onPresetChange}
          uiScale={uiScale}
          position={uiPositions.instruments}
          onDragStart={(e) => handleDrag(e, 'instruments')}
          uiUnlocked={uiUnlocked}
      />

      {/* BOTTOM RIGHT CLUSTER - Performance Buttons */}
      
      {/* Bend */}
      <button 
        disabled={isBendLocked}
        className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${isBendEnabled ? 'bg-purple-600 text-white border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.6)]' : 'bg-purple-900/40 text-purple-400 border-purple-500/50 hover:bg-purple-800/60'} ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''} ${isBendLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}`} 
        style={{ ...draggableStyle('bend'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} 
        onPointerDown={(e) => !isBendLocked && handleButtonPress(e, 'bend', onBend)}
      >
        BEND
      </button>

      {/* Sust */}
      <button 
        disabled={isSustainLocked}
        className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${sustColorClass} ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''} ${isSustainLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}`} 
        style={{ ...draggableStyle('sust'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} 
        onPointerDown={(e) => !isSustainLocked && handleButtonPress(e, 'sust', onSustainToggle)} 
        title="Sustain Notes"
      >
        SUST
      </button>

      <button className={`absolute rounded-full bg-yellow-900/40 border-2 border-yellow-500/50 flex items-center justify-center text-yellow-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-yellow-800/60 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('off'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => handleButtonPress(e, 'off', onOff)}>OFF</button>
      <button className={`absolute rounded-full bg-red-900/40 border-2 border-red-500/50 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-red-800/60 active:bg-red-600 active:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('panic'), width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => handleButtonPress(e, 'panic', onPanic)}>PANIC</button>

      {/* BOTTOM LEFT CLUSTER - Navigation & Chords */}
      <button className={`absolute rounded bg-yellow-600/20 border-2 border-yellow-500 flex items-center justify-center text-yellow-500 font-bold backdrop-blur hover:bg-yellow-600/40 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('center'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'center', onCenter)} title="Center Display"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg></button>

      {showIncreaseDepthButton && (<button className={`absolute rounded bg-blue-600/20 border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold backdrop-blur hover:bg-blue-600/40 active:bg-blue-600 active:text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('depth'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'depth', onIncreaseDepth)} title="Increase Depth from Selection"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>)}

      {showIncreaseDepthButton && (<button className={`absolute rounded bg-green-600/20 border-2 border-green-500 flex items-center justify-center text-green-500 font-bold backdrop-blur hover:bg-green-600/40 active:bg-green-600 active:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} style={{ ...draggableStyle('decreaseDepth'), width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'decreaseDepth', onDecreaseDepth)} title="Decrease Depth"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg></button>)}

      <div className={`absolute flex items-center gap-2 z-[150] transition-all ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50 rounded-lg p-1 border-dashed border-2 border-yellow-500/50' : ''}`} style={{ ...draggableStyle('chords') }} onPointerDown={(e) => handleDrag(e, 'chords')}>
          <button className="rounded bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center text-indigo-500 font-bold backdrop-blur hover:bg-indigo-600/40 active:bg-indigo-600 active:text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] select-none" style={{ width: baseSize, height: baseSize }} onPointerDown={(e) => handleButtonPress(e, 'chords', onAddChord)} title="Store Current Chord"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>
          
          {!uiUnlocked && savedChords.filter(c => c.visible).map((chord, i) => {
              const isActive = activeChordIds.includes(chord.id);
              return (
                  <button key={chord.id} className={`rounded border-2 flex items-center justify-center font-bold backdrop-blur transition-all shadow-lg select-none ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.8)] scale-110' : 'bg-slate-800/60 border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400'}`} style={{ width: chordSize, height: chordSize, fontSize: 14 * uiScale }} onPointerDown={(e) => { e.stopPropagation(); toggleChord(chord.id); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if(onRemoveChord) onRemoveChord(chord.id); }}>
                      {chord.label}
                  </button>
              );
          })}
      </div>
    </>
  );
};

export default FloatingControls;
