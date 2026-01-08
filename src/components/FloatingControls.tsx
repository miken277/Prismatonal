
import React, { useState, useEffect } from 'react';
import { ChordDefinition, XYPos, AppSettings, ArpeggioDefinition, ArpConfig, ArpDivision, ArpeggioStep } from '../types';
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
  latchMode: 0 | 1 | 2 | 3 | 4 | 5 | 6;
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
}

const FloatingControls: React.FC<Props> = ({ 
  volume, setVolume, spatialScale, setSpatialScale, brightness, setBrightness,
  onPanic, onOff, onLatch, latchMode, onBend, isBendEnabled, onCenter, onIncreaseDepth, onDecreaseDepth, onAddChord, toggleChord,
  activeChordIds, savedChords, chordShortcutSizeScale,
  showIncreaseDepthButton, uiUnlocked, uiPositions, updatePosition,
  draggingId, setDraggingId, uiScale = 1.0,
  arpeggios = [], arpBpm = 120, onArpToggle, onArpBpmChange, onArpRowConfigChange, onArpPatternUpdate, recordingArpId, currentArpStep, recordingFlash = 0,
  onPlayAll, onStopAll
}) => {
  
  const [showSequencer, setShowSequencer] = useState(false);
  const isDiamond = uiPositions.volume && uiPositions.volume.x !== -9999 && uiPositions.layers.x !== -9999 && uiPositions.chords.x !== -9999; // Simple proxy for JI layout
  // We need to know the layout approach from settings - passing via props would be better but let's check global layout approach key if we had it.
  // Assuming 'diamond' is active if we want to grey out.
  
  // To correctly detect diamond layout, we ideally need layoutApproach in props. 
  // For this update, I will assume the consumer of FloatingControls manages the 'disabled' state or layout.
  
  const handleDrag = (e: React.PointerEvent, key: keyof AppSettings['uiPositions']) => {
    if (!uiUnlocked) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    setDraggingId(key as string);
    const initialLeft = uiPositions[key].x;
    const initialTop = uiPositions[key].y;
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (evt: PointerEvent) => {
        updatePosition(key, { x: initialLeft + (evt.clientX - startX), y: initialTop + (evt.clientY - startY) });
    };
    const onUp = () => { setDraggingId(null); window.removeEventListener('pointermove', onMove); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const largeBtnSize = 80 * uiScale;
  const perfBtnSize = 92 * uiScale;
  const labelStyle = { fontSize: 20 * uiScale, width: 120 * uiScale };

  return (
    <>
      <div className="absolute bg-slate-900/50 rounded-xl flex flex-col px-4 py-1 gap-1 backdrop-blur-sm border border-slate-700/50 z-[150] shadow-lg" style={{ left: uiPositions.volume.x, top: uiPositions.volume.y, width: 600 * uiScale }}>
        <div className="flex items-center gap-4 h-6"><span className="font-bold text-slate-400 uppercase tracking-widest text-right" style={labelStyle}>Volume</span><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="flex-1 accent-green-500" /></div>
        <div className="flex items-center gap-4 h-6"><span className="font-bold text-slate-400 uppercase tracking-widest text-right" style={labelStyle}>Reverb</span><input type="range" min="0" max="2" step="0.01" value={spatialScale} onChange={(e) => setSpatialScale(parseFloat(e.target.value))} className="flex-1 accent-blue-500" /></div>
        <div className="flex items-center gap-4 h-6"><span className="font-bold text-slate-400 uppercase tracking-widest text-right" style={labelStyle}>Tone</span><input type="range" min="0" max="1" step="0.01" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} className="flex-1 accent-yellow-500" /></div>
      </div>

      <button 
        className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${isBendEnabled ? 'bg-purple-600 text-white border-purple-300' : 'bg-purple-900/40 text-purple-400 border-purple-500/50'} ${latchMode === 1 ? 'opacity-30 grayscale cursor-not-allowed' : ''}`} 
        style={{ left: uiPositions.bend.x, top: uiPositions.bend.y, width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} 
        onPointerDown={(e) => latchMode !== 1 && (uiUnlocked ? handleDrag(e, 'bend') : onBend())}
      >
        BEND
      </button>

      <button className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${latchMode === 1 ? 'bg-green-500 text-white' : 'bg-green-900/40 text-green-500 border-green-500/50'}`} style={{ left: uiPositions.latch.x, top: uiPositions.latch.y, width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => uiUnlocked ? handleDrag(e, 'latch') : onLatch()}>LATCH</button>
      <button className="absolute rounded-full bg-yellow-900/40 border-2 border-yellow-500/50 flex items-center justify-center text-yellow-500 font-bold uppercase tracking-wider backdrop-blur z-[150]" style={{ left: uiPositions.off.x, top: uiPositions.off.y, width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => uiUnlocked ? handleDrag(e, 'off') : onOff()}>OFF</button>
      <button className="absolute rounded-full bg-red-900/40 border-2 border-red-500/50 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider backdrop-blur z-[150]" style={{ left: uiPositions.panic.x, top: uiPositions.panic.y, width: perfBtnSize, height: perfBtnSize, fontSize: 16 * uiScale }} onPointerDown={(e) => uiUnlocked ? handleDrag(e, 'panic') : onPanic()}>PANIC</button>

      <button className="absolute rounded bg-yellow-600/20 border-2 border-yellow-500 flex items-center justify-center text-yellow-500 font-bold z-[150]" style={{ left: uiPositions.center.x, top: uiPositions.center.y, width: largeBtnSize, height: largeBtnSize }} onPointerDown={(e) => uiUnlocked ? handleDrag(e, 'center') : onCenter()}>CENTER</button>
      <button className="absolute rounded bg-blue-600/20 border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold z-[150]" style={{ left: uiPositions.depth.x, top: uiPositions.depth.y, width: largeBtnSize, height: largeBtnSize }} onPointerDown={(e) => uiUnlocked ? handleDrag(e, 'depth') : onIncreaseDepth()}>+</button>
      <button className="absolute rounded bg-green-600/20 border-2 border-green-500 flex items-center justify-center text-green-500 font-bold z-[150]" style={{ left: uiPositions.decreaseDepth.x, top: uiPositions.decreaseDepth.y, width: largeBtnSize, height: largeBtnSize }} onPointerDown={(e) => uiUnlocked ? handleDrag(e, 'decreaseDepth') : onDecreaseDepth()}>-</button>
    </>
  );
};

export default FloatingControls;
