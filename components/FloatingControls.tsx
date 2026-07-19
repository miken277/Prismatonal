
import React, { useState, useEffect } from 'react';
import { ChordDefinition, XYPos, AppSettings, ArpeggioDefinition, ArpConfig, ArpDivision, ArpeggioStep, PresetState, PlayMode, SynthPreset, UISize } from '../types';
import ArpeggiatorBar from './controls/ArpeggiatorBar';
import InstrumentCluster from './controls/InstrumentCluster';
import MasterControls from './controls/MasterControls';
import PerformanceControls from './controls/PerformanceControls';
import ViewControls from './controls/ViewControls';
import ChordBar from './controls/ChordBar';
import LimitLayerControls from './LimitLayerControls';
import { useDragManager } from '../hooks/useDragManager';

interface Props {
  settings: AppSettings;
  updateSettings: (s: any) => void;
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
  onSust?: () => void; 
  onPluck?: () => void; 
  onVoice?: () => void; 
  onKeys?: () => void;
  onPercussion?: () => void; 
  latchMode: 0 | 1 | 2 | 3 | 4 | 5 | 6; 
  onBend: () => void;
  isBendEnabled: boolean;
  onSustainToggle?: () => void;
  isSustainEnabled?: boolean;
  onModulationToggle?: () => void;
  isModulationModeActive?: boolean;
  modulationPathLength?: number;
  onModulationUndo?: () => void;
  onModulationReset?: () => void;
  onShiftToggle?: () => void;
  isShiftModeActive?: boolean;
  onCenter: () => void;
  onIncreaseDepth: () => void;
  onDecreaseDepth: () => void;
  onResetDepth?: () => void;
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
  uiSizes?: AppSettings['uiSizes'];
  updateSize?: (key: keyof AppSettings['uiSizes'], size: UISize) => void;
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
  
  isSequencerOpen: boolean;
  onToggleSequencer: () => void;

  presets?: PresetState;
  onPresetChange?: (mode: PlayMode, preset: SynthPreset) => void;
}

const FloatingControls: React.FC<Props> = ({ 
  settings, updateSettings,
  volume, setVolume, spatialScale, setSpatialScale, brightness, setBrightness, viewZoom, setViewZoom,
  onPanic, onOff, onLatch, onSust, onPluck, onVoice, onKeys, onPercussion, latchMode, onBend, isBendEnabled, onSustainToggle, isSustainEnabled, 
  onModulationToggle, isModulationModeActive, modulationPathLength, onModulationUndo, onModulationReset, onShiftToggle, isShiftModeActive,
  onCenter, onIncreaseDepth, onDecreaseDepth, onResetDepth, onAddChord, toggleChord, onRemoveChord,
  activeChordIds, savedChords, chordShortcutSizeScale,
  showIncreaseDepthButton, uiUnlocked, uiPositions, updatePosition,
  uiSizes, updateSize,
  draggingId, setDraggingId, uiScale = 1.0,
  arpeggios = [], arpBpm = 120, onArpToggle, onArpBpmChange, onArpRowConfigChange, onArpPatternUpdate, recordingArpId, currentArpStep, recordingFlash = 0,
  onPlayAll, onStopAll,
  maxArpWidth,
  activeSustainedModes = [],
  onClearSustain,
  isSequencerOpen,
  onToggleSequencer,
  presets,
  onPresetChange
}) => {
  
  const [isFlashingRed, setIsFlashingRed] = useState(false);
  
  useEffect(() => {
      if (recordingFlash > 0) {
          setIsFlashingRed(true);
          const t = setTimeout(() => setIsFlashingRed(false), 200);
          return () => clearTimeout(t);
      }
  }, [recordingFlash]);

  const handleDrag = useDragManager(
      uiUnlocked,
      draggingId,
      setDraggingId,
      (id, pos) => updatePosition(id as any, pos),
      uiPositions as any
  );

  const handleResize = (e: React.PointerEvent, key: 'volume' | 'arpeggioBar', axis: 'x' | 'y' | 'xy') => {
      e.stopPropagation();
      e.preventDefault();
      if (!updateSize || !uiSizes) return;

      const el = e.currentTarget as HTMLElement;
      try {
          el.setPointerCapture(e.pointerId);
      } catch (err) {
          // Safe fallback for simulated pointers
      }
      
      const startX = e.clientX;
      const startY = e.clientY;
      
      const initialWidth = uiSizes[key]?.width || (key === 'volume' ? 600 : 760);
      const initialHeight = uiSizes[key]?.height || (key === 'volume' ? 75 : 0); 

      const onMove = (evt: PointerEvent) => {
          const deltaX = (evt.clientX - startX) / uiScale;
          const deltaY = (evt.clientY - startY) / uiScale;
          
          let newWidth = initialWidth;
          let newHeight = initialHeight;

          if (axis === 'x' || axis === 'xy') {
              const minW = key === 'volume' ? 320 : 300; 
              newWidth = Math.max(minW, initialWidth + deltaX);
          }
          if ((axis === 'y' || axis === 'xy') && key === 'volume') {
              const minH = 60; 
              newHeight = Math.max(minH, initialHeight + deltaY);
          }

          updateSize(key, { width: newWidth, height: newHeight });
      };

      const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
  };

  const [isPhone, setIsPhone] = useState(false);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  useEffect(() => {
    const checkPhone = () => {
      setIsPhone(window.innerWidth < 768);
    };
    checkPhone();
    window.addEventListener('resize', checkPhone);
    return () => window.removeEventListener('resize', checkPhone);
  }, []);

  const arpBaseWidth = uiSizes?.arpeggioBar?.width || 760;
  const userArpWidth = arpBaseWidth * uiScale;
  const effectiveArpWidth = maxArpWidth ? Math.min(userArpWidth, maxArpWidth) : userArpWidth;
  const isConstrained = effectiveArpWidth < (760 * uiScale) * 0.95;
  
  const resizeHandleStyle = "absolute z-50 bg-yellow-500/50 hover:bg-yellow-400 rounded-sm border border-white/50 shadow-sm transition-colors";

  if (isPhone) {
    const LOCAL_MODE_COLORS: Record<number, string> = {
      1: '#10b981', // Drone (green/emerald)
      2: '#3b82f6', // Strings (blue)
      3: '#f97316', // Plucked (orange)
      4: '#eab308', // Brass (yellow)
      5: '#a855f7', // Keys (purple)
      6: '#ec4899', // Perc (pink)
    };

    const updateInstrumentGain = (presetKey: PlayMode, val: number) => {
      if (presets && onPresetChange) {
        const preset = presets[presetKey];
        onPresetChange(presetKey, { ...preset, gain: val });
      }
    };

    const renderMiniInstrument = (modeId: number, label: string, presetKey: PlayMode, onSelect: (() => void) | undefined, color: string) => {
      const isSelected = latchMode === modeId;
      const isActive = activeSustainedModes.includes(modeId);
      const gain = presets?.[presetKey].gain ?? 0.5;

      return (
        <div 
          key={modeId}
          className={`flex flex-col justify-between p-1 rounded-lg border backdrop-blur transition-all duration-150 ${isSelected ? 'bg-slate-900 border-slate-600' : 'bg-slate-950/60 border-slate-900'}`}
          style={isSelected ? { borderColor: color, boxShadow: `0 0 10px ${color}30` } : {}}
        >
          {/* Top: Name & Indicator */}
          <div 
            className="flex items-center justify-between w-full cursor-pointer select-none"
            onPointerDown={(e) => { e.stopPropagation(); if (onSelect) onSelect(); }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
              )}
              <span className={`text-[9px] font-black uppercase tracking-wider truncate ${isSelected ? 'text-white' : 'text-slate-400'}`} style={isSelected ? { textShadow: `0 0 4px ${color}` } : {}}>
                {label}
              </span>
            </div>
            
            {isActive && (
              <button 
                onPointerDown={(e) => { e.stopPropagation(); if(onClearSustain) onClearSustain(modeId); }}
                className="text-slate-500 hover:text-white text-[8px] px-1 font-bold flex-shrink-0"
              >
                ✕
              </button>
            )}
          </div>
          {/* Bottom: Mini Volume range */}
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={gain} 
            onChange={(e) => updateInstrumentGain(presetKey, parseFloat(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer mt-1"
            style={{ 
              background: `linear-gradient(to right, ${color} 0%, ${color} ${gain * 100}%, #1e293b ${gain * 100}%, #1e293b 100%)`,
              WebkitAppearance: 'none'
            }}
          />
        </div>
      );
    };

    return (
      <>
        {/* LEFT TAB & DRAWER (ARPEGGIATOR) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsLeftDrawerOpen(!isLeftDrawerOpen);
            setIsRightDrawerOpen(false); // Close other to prevent overlap
          }}
          className="fixed left-0 top-[35%] -translate-y-1/2 z-[160] bg-blue-700/90 active:bg-blue-600 border border-l-0 border-blue-500/30 rounded-r-xl px-2 py-4 flex flex-col items-center gap-1.5 shadow-[0_0_12px_rgba(59,130,246,0.4)] pointer-events-auto transition-transform outline-none"
          aria-expanded={isLeftDrawerOpen}
          aria-label="Toggle Arpeggiator Panel"
        >
          <div className="flex flex-col gap-0.5 my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          </div>
          <span className="writing-mode-vertical uppercase tracking-wider text-[8px] font-black text-blue-100 [writing-mode:vertical-lr]">ARP</span>
        </button>

        {isLeftDrawerOpen && (
          <div className="fixed left-0 top-[12dvh] bottom-[41dvh] w-[88dvw] max-w-[340px] z-[160] bg-slate-950/95 border-r border-y border-slate-850 rounded-r-2xl shadow-3xl backdrop-blur-md p-3.5 pointer-events-auto flex flex-col gap-3 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1 flex-shrink-0">
              <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase">ARPEGGIATOR</span>
              <button 
                onClick={() => setIsLeftDrawerOpen(false)}
                className="text-slate-500 hover:text-white font-bold text-xs p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-0.5">
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
                uiScale={0.82}
                position={{ x: 0, y: 0 }}
                isConstrained={true}
                width={240}
                onDragStart={() => {}}
                isFlashingRed={isFlashingRed}
                uiUnlocked={false}
                isPhone={true}
              />
            </div>
          </div>
        )}

        {/* RIGHT TAB & DRAWER (LIMIT LAYERS & EFFECTS) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsRightDrawerOpen(!isRightDrawerOpen);
            setIsLeftDrawerOpen(false); // Close other to prevent overlap
          }}
          className="fixed right-0 top-[35%] -translate-y-1/2 z-[160] bg-purple-700/90 active:bg-purple-600 border border-r-0 border-purple-500/30 rounded-l-xl px-2 py-4 flex flex-col items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.4)] pointer-events-auto transition-transform outline-none"
          aria-expanded={isRightDrawerOpen}
          aria-label="Toggle Limits and FX Panel"
        >
          <div className="flex flex-col gap-0.5 my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 ml-0.5" />
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
          <span className="writing-mode-vertical uppercase tracking-wider text-[8px] font-black text-purple-100 [writing-mode:vertical-lr]">FX & LIMS</span>
        </button>

        {isRightDrawerOpen && (
          <div className="fixed right-0 top-[12dvh] bottom-[41dvh] w-[280px] z-[160] bg-slate-950/95 border-l border-y border-slate-850 rounded-l-2xl shadow-3xl backdrop-blur-md p-3.5 pointer-events-auto flex flex-col gap-3.5 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1 flex-shrink-0">
              <span className="text-[10px] font-black tracking-widest text-purple-400 uppercase">LIMITS & FX</span>
              <button 
                onClick={() => setIsRightDrawerOpen(false)}
                className="text-slate-500 hover:text-white font-bold text-xs p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            
            {/* TONE & REVERB sliders inside right drawer */}
            <div className="flex flex-col gap-3 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900/50">
              <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase">EFFECTS</span>
              
              {/* TONE / BRIGHTNESS */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-400 uppercase">Tone (Bright)</span>
                  <span className="font-mono text-yellow-400 font-bold">{(brightness * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.01" value={brightness} 
                  onChange={(e) => setBrightness(parseFloat(e.target.value))} 
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  style={{ background: `linear-gradient(to right, #eab308 0%, #eab308 ${brightness * 100}%, #1e293b ${brightness * 100}%, #1e293b 100%)` }}
                />
              </div>

              {/* REVERB / SPATIAL SCALE */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-400 uppercase">Spatial (Reverb)</span>
                  <span className="font-mono text-blue-400 font-bold">{(spatialScale * 50).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" min="0" max="2" step="0.01" value={spatialScale} 
                  onChange={(e) => setSpatialScale(parseFloat(e.target.value))} 
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  style={{ background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(spatialScale/2) * 100}%, #1e293b ${(spatialScale/2) * 100}%, #1e293b 100%)` }}
                />
              </div>
            </div>

            {/* VIEW DEPTH CONTROL buttons inside right drawer */}
            <div className="flex flex-col gap-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900/50">
              <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase block mb-1">VIEWPORT</span>
              <div className="grid grid-cols-3 gap-1.5">
                <button 
                  onClick={() => onCenter()} 
                  className="bg-yellow-600/20 border border-yellow-500/40 text-yellow-400 font-black py-2 rounded text-[9px] active:bg-yellow-600 active:text-white transition-colors"
                >
                  CTR
                </button>
                <button 
                  onClick={() => onIncreaseDepth()} 
                  className="bg-blue-600/20 border border-blue-500/40 text-blue-400 font-black py-2 rounded text-[9px] active:bg-blue-600 active:text-white transition-colors"
                >
                  DP+
                </button>
                <button 
                  onClick={() => onDecreaseDepth()} 
                  className="bg-green-600/20 border border-green-500/40 text-green-400 font-black py-2 rounded text-[9px] active:bg-green-600 active:text-white transition-colors"
                >
                  DP-
                </button>
              </div>
            </div>

            {/* LIMIT OVERDRAWS inside right drawer */}
            <div className="border-t border-slate-850 pt-3">
              <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase block mb-2">LIMIT OVERDRAWS</span>
              <div className="overflow-y-auto max-h-[190px] pr-0.5">
                <LimitLayerControls 
                  settings={settings} 
                  updateSettings={updateSettings} 
                  draggingId={draggingId} 
                  setDraggingId={setDraggingId} 
                  uiScale={1.0}
                  isShortScreen={false}
                  isPhone={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* COMPRESSED BOTTOM DASHBOARD HUD */}
        <div 
          className="fixed bottom-0 left-0 right-0 z-[150] bg-slate-950/95 border-t border-slate-850 backdrop-blur-md px-3.5 py-3 pb-[calc(env(safe-area-inset-bottom,12px)+6px)] flex flex-col gap-3.5 max-h-[40dvh] overflow-y-auto pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Row 1: Volume & Zoom (High contrast mini indicators) */}
          <div className="grid grid-cols-2 gap-4 text-[10px] px-0.5">
            {/* VOL Slider */}
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-500 text-[8.5px] tracking-widest uppercase">VOL</span>
              <input 
                type="range" min="0" max="1" step="0.01" value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))} 
                className="flex-1 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-green-500"
                style={{ background: `linear-gradient(to right, #10b981 0%, #10b981 ${volume * 100}%, #111827 ${volume * 100}%, #111827 100%)` }}
              />
              <span className="font-mono text-[9px] text-emerald-400 w-8 text-right">{(volume * 100).toFixed(0)}%</span>
            </div>

            {/* ZOOM Slider */}
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-500 text-[8.5px] tracking-widest uppercase">ZOOM</span>
              <input 
                type="range" min="0.5" max="3.0" step="0.05" value={viewZoom} 
                onChange={(e) => setViewZoom(parseFloat(e.target.value))} 
                className="flex-1 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                style={{ background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${((viewZoom-0.5)/2.5) * 100}%, #111827 ${((viewZoom-0.5)/2.5) * 100}%, #111827 100%)` }}
              />
              <span className="font-mono text-[9px] text-cyan-400 w-8 text-right">{viewZoom.toFixed(1)}x</span>
            </div>
          </div>

          {/* Row 2: Chord shortcuts strip */}
          <div className="flex items-center gap-2 bg-slate-900/30 p-1 rounded-xl border border-slate-900/50">
            <span className="font-black text-slate-500 text-[8px] tracking-widest uppercase flex-shrink-0 ml-1">CHORDS</span>
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full scrollbar-none">
              <button 
                onClick={() => { onAddChord(); }} 
                className="bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/60 text-indigo-400 rounded w-6 h-6 flex items-center justify-center text-[10px] font-black flex-shrink-0 active:scale-95 transition-transform"
                title="Store Chord"
              >
                +
              </button>
              {savedChords.filter(c => c.visible).map((chord) => {
                const isActive = activeChordIds.includes(chord.id);
                return (
                  <button 
                    key={chord.id} 
                    onClick={() => toggleChord(chord.id)} 
                    onContextMenu={(e) => { e.preventDefault(); onRemoveChord?.(chord.id); }}
                    className={`rounded text-[10px] font-black px-2.5 h-6 flex-shrink-0 flex items-center justify-center border transition-all ${isActive ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                  >
                    {chord.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Double-half HUD grid (Instruments 3x2, Performance/Mod/Shift side panel) */}
          <div className="grid grid-cols-12 gap-3 pb-1">
             {/* Left Column: Instruments 3x2 Grid */}
             <div className="col-span-7 grid grid-cols-3 gap-1.5 self-center">
                {renderMiniInstrument(2, "Strings", 'normal', onSust, LOCAL_MODE_COLORS[2])}
                {renderMiniInstrument(4, "Brass", 'brass', onVoice, LOCAL_MODE_COLORS[4])}
                {renderMiniInstrument(5, "Keys", 'keys', onKeys, LOCAL_MODE_COLORS[5])}
                {renderMiniInstrument(6, "Perc", 'percussion', onPercussion, LOCAL_MODE_COLORS[6])}
                {renderMiniInstrument(3, "Plucked", 'strum', onPluck, LOCAL_MODE_COLORS[3])}
                {renderMiniInstrument(1, "Drone", 'latch', onLatch, LOCAL_MODE_COLORS[1])}
             </div>

             {/* Right Column: Performance and Mod/Shift Buttons */}
             <div className="col-span-5 border-l border-slate-900 pl-3">
                <div className="grid grid-cols-2 gap-1.5 h-[94px]">
                  {/* Tall Primary Modifiers */}
                  <div className="flex flex-col gap-1.5 justify-between">
                    <button 
                      onClick={() => onModulationToggle?.()}
                      className={`flex-1 rounded-xl flex flex-col items-center justify-center font-black text-[10.5px] border transition-all duration-150 relative overflow-hidden active:scale-95
                          ${isModulationModeActive 
                            ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.5)]' 
                            : 'bg-cyan-950/40 text-cyan-400 border-cyan-900/60'
                          }`}
                    >
                      {isModulationModeActive && (
                        <span className="absolute inset-x-0 bottom-0 top-0 bg-cyan-400/20 animate-pulse pointer-events-none" />
                      )}
                      <span className="z-10">MOD</span>
                    </button>
                    <button 
                      onClick={() => onShiftToggle?.()}
                      className={`flex-1 rounded-xl flex flex-col items-center justify-center font-black text-[10.5px] border transition-all duration-150 relative overflow-hidden active:scale-95
                          ${isShiftModeActive 
                            ? 'bg-orange-600 text-white border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.5)]' 
                            : 'bg-orange-950/40 text-orange-400 border-orange-900/60'
                          }`}
                    >
                      {isShiftModeActive && (
                        <span className="absolute inset-x-0 bottom-0 top-0 bg-orange-400/20 animate-pulse pointer-events-none" />
                      )}
                      <span className="z-10">SHIFT</span>
                    </button>
                  </div>
                  {/* Performance Companions */}
                  <div className="grid grid-cols-1 gap-1">
                    <button 
                      onClick={() => onSustainToggle?.()}
                      className={`rounded-lg flex items-center justify-center font-extrabold text-[9px] border transition-all active:scale-95 ${isSustainEnabled ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                    >
                      SUST
                    </button>
                    <button 
                      onClick={() => onBend()}
                      className={`rounded-lg flex items-center justify-center font-extrabold text-[9px] border transition-all active:scale-95 ${isBendEnabled ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                    >
                      BEND
                    </button>
                    <button 
                      onClick={() => onOff()}
                      className="rounded-lg bg-yellow-950/45 border border-yellow-750/30 text-yellow-500 font-extrabold text-[9.5px] active:bg-yellow-600 active:text-white transition-all active:scale-95"
                    >
                      OFF
                    </button>
                    <button 
                      onClick={() => onPanic()}
                      className="rounded-lg bg-red-950/45 border border-red-750/30 text-red-500 font-extrabold text-[9.5px] active:bg-red-600 active:text-white transition-all active:scale-95"
                    >
                      PANIC
                    </button>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <MasterControls 
          volume={volume} setVolume={setVolume}
          spatialScale={spatialScale} setSpatialScale={setSpatialScale}
          brightness={brightness} setBrightness={setBrightness}
          viewZoom={viewZoom} setViewZoom={setViewZoom}
          uiScale={uiScale}
          uiUnlocked={uiUnlocked}
          position={uiPositions.volume}
          size={uiSizes?.volume || { width: 600, height: 75 }}
          onDragStart={(e) => handleDrag(e, 'volume')}
          onResize={(e, axis) => handleResize(e, 'volume', axis)}
      />

      <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
          {uiUnlocked && (
              <div 
                  className={`${resizeHandleStyle} cursor-ew-resize`}
                  style={{ 
                      left: uiPositions.arpeggioBar.x + effectiveArpWidth - 6, 
                      top: uiPositions.arpeggioBar.y, 
                      height: 52 * uiScale, 
                      width: 12,
                      zIndex: 160 
                  }}
                  onPointerDown={(e) => handleResize(e, 'arpeggioBar', 'x')}
              />
          )}
      </div>

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
          uiScale={uiScale}
          position={uiPositions.arpeggioBar}
          isConstrained={isConstrained}
          width={effectiveArpWidth}
          onDragStart={(e) => handleDrag(e, 'arpeggioBar')}
          isFlashingRed={isFlashingRed}
          uiUnlocked={uiUnlocked}
      />

      <InstrumentCluster 
          latchMode={latchMode}
          onLatch={onLatch}
          onSust={onSust}
          onPluck={onPluck}
          onVoice={onVoice}
          onKeys={onKeys}
          onPercussion={onPercussion}
          activeSustainedModes={activeSustainedModes}
          onClearSustain={onClearSustain}
          presets={presets}
          onPresetChange={onPresetChange}
          uiScale={uiScale}
          position={uiPositions.instruments}
          onDragStart={(e) => handleDrag(e, 'instruments')}
          uiUnlocked={uiUnlocked}
      />

      <PerformanceControls 
          isBendEnabled={isBendEnabled}
          latchMode={latchMode as any}
          isSustainEnabled={isSustainEnabled}
          isModulationModeActive={isModulationModeActive}
          isShiftModeActive={isShiftModeActive}
          uiUnlocked={uiUnlocked}
          uiScale={uiScale}
          positions={uiPositions}
          onBend={onBend}
          onSustainToggle={onSustainToggle}
          onOff={onOff}
          onPanic={onPanic}
          onModulationToggle={onModulationToggle}
          onShiftToggle={onShiftToggle}
          onDragStart={handleDrag}
      />

      <ViewControls 
          showIncreaseDepthButton={showIncreaseDepthButton}
          uiUnlocked={uiUnlocked}
          uiScale={uiScale}
          positions={uiPositions}
          onCenter={onCenter}
          onIncreaseDepth={onIncreaseDepth}
          onDecreaseDepth={onDecreaseDepth}
          onResetDepth={onResetDepth}
          onDragStart={handleDrag}
      />

      <ChordBar 
          savedChords={savedChords}
          activeChordIds={activeChordIds}
          chordShortcutSizeScale={chordShortcutSizeScale}
          uiUnlocked={uiUnlocked}
          uiScale={uiScale}
          position={uiPositions.chords}
          onAddChord={onAddChord}
          toggleChord={toggleChord}
          onRemoveChord={onRemoveChord}
          onDragStart={handleDrag}
      />
    </>
  );
};

export default FloatingControls;
