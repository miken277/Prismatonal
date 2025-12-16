
import React from 'react';
import { ChordDefinition, XYPos, AppSettings } from '../types';
import { MARGIN_3MM, SCROLLBAR_WIDTH } from '../constants';

interface Props {
  volume: number;
  setVolume: (v: number) => void;
  spatialScale: number;
  setSpatialScale: (v: number) => void;
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
}

const FloatingControls: React.FC<Props> = ({ 
  volume, setVolume, spatialScale, setSpatialScale, 
  onPanic, onOff, onLatch, latchMode, onBend, isBendEnabled, onCenter, onIncreaseDepth, onDecreaseDepth, onAddChord, toggleChord,
  activeChordIds, savedChords, chordShortcutSizeScale,
  showIncreaseDepthButton, uiUnlocked, uiPositions, updatePosition,
  draggingId, setDraggingId,
  uiScale = 1.0 
}) => {
  
  // Generic Drag Handler
  const handleDrag = (e: React.PointerEvent, key: keyof AppSettings['uiPositions']) => {
    if (!uiUnlocked) return;
    
    // Lock mechanism
    if (draggingId !== null && draggingId !== key) return;

    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    
    // Initial position relative to window
    const initialLeft = uiPositions[key as keyof typeof uiPositions].x;
    const initialTop = uiPositions[key as keyof typeof uiPositions].y;

    el.setPointerCapture(e.pointerId);
    setDraggingId(key);

    const onMove = (evt: PointerEvent) => {
        const deltaX = evt.clientX - startX;
        const deltaY = evt.clientY - startY;
        
        // Calculate new position
        let newX = initialLeft + deltaX;
        let newY = initialTop + deltaY;
        
        // Clamp to window bounds with Margin + Scrollbar safety
        // offsetWidth handles the scaled size automatically
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
    window.addEventListener('pointercancel', onUp); // Robustness: Handle Alt-Tab/Window leave
  };

  // Base size reference for buttons
  const baseSize = 48 * uiScale; 
  const chordSize = baseSize * chordShortcutSizeScale;
  const largeBtnSize = 80 * uiScale;
  
  // RESTORED ORIGINAL SIZE: 290 and 40
  const sliderWidth = 290 * uiScale; 
  const sliderHeight = 40 * uiScale;

  // Common styles for draggable elements
  const draggableStyle = (key: string) => ({
      left: uiPositions[key as keyof typeof uiPositions].x,
      top: uiPositions[key as keyof typeof uiPositions].y,
      touchAction: 'none' as React.CSSProperties['touchAction'], // Crucial for smooth drag
  });
  
  // Helper to handle button press logic (Drag if unlocked, Action if locked)
  const handleButtonPress = (e: React.PointerEvent, key: keyof AppSettings['uiPositions'], action: () => void) => {
      e.stopPropagation(); // Stop propagation to canvas
      if (uiUnlocked) {
          handleDrag(e, key);
      } else {
          action();
      }
  };

  // Determine Latch Button Style based on Mode
  const getLatchStyle = () => {
      const base = "absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none shadow-lg";
      const unlocked = uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : '';
      
      if (latchMode === 1) { // LATCH_ALL (Illuminated)
          return `${base} ${unlocked} bg-green-500 text-white border-2 border-green-300 shadow-[0_0_20px_rgba(34,197,94,0.8)]`;
      } else if (latchMode === 2) { // SUSTAIN (Halo)
          return `${base} ${unlocked} bg-green-900/60 text-green-400 border-2 border-green-400 ring-4 ring-green-500/30 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.4)]`;
      } else { // OFF
          return `${base} ${unlocked} bg-green-900/40 border-2 border-green-500/50 text-green-500 hover:bg-green-800/60 active:bg-green-600 active:text-white shadow-[0_0_15px_rgba(34,197,94,0.2)]`;
      }
  };

  return (
    <>
      <style>{`
        /* Reduced Slider Thumb Size (approx 1/3 smaller than default ~16px) */
        .prismatonal-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: currentColor;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 0 5px rgba(0,0,0,0.5);
        }
        .prismatonal-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: currentColor;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 0 5px rgba(0,0,0,0.5);
        }
      `}</style>

      {/* Volume Slider - Green Accent */}
      <div 
        className={`absolute bg-slate-900/60 p-2 rounded-full flex items-center gap-2 backdrop-blur-md border border-white/10 transition-colors z-[150] ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('volume'), width: sliderWidth, height: sliderHeight }}
        onPointerDown={(e) => handleDrag(e, 'volume')}
      >
        <span className="font-bold text-slate-300 select-none text-center" style={{ fontSize: 10 * uiScale, width: 60 * uiScale }}>VOLUME</span>
        <input 
          type="range" min="0" max="1" step="0.01" 
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          disabled={uiUnlocked}
          className={`prismatonal-slider w-full rounded-lg appearance-none text-green-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
          style={{ 
              height: 4 * uiScale, 
              background: `linear-gradient(to right, #22c55e 0%, #22c55e ${volume * 100}%, #334155 ${volume * 100}%, #334155 100%)` 
          }}
          onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
        />
      </div>

      {/* Reverb Slider - Blue Accent */}
      <div 
        className={`absolute bg-slate-900/60 p-2 rounded-full flex items-center gap-2 backdrop-blur-md border border-white/10 transition-colors z-[150] ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('space'), width: sliderWidth, height: sliderHeight }}
        onPointerDown={(e) => handleDrag(e, 'space')}
      >
        <span className="font-bold text-slate-300 select-none text-center" style={{ fontSize: 10 * uiScale, width: 60 * uiScale }}>REVERB</span>
        
        <input 
            type="range" min="0" max="2" step="0.01" 
            value={spatialScale}
            onChange={(e) => setSpatialScale(parseFloat(e.target.value))}
            disabled={uiUnlocked}
            className={`prismatonal-slider w-full rounded-lg appearance-none text-blue-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
            style={{ 
                height: 4 * uiScale,
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(spatialScale/2) * 100}%, #334155 ${(spatialScale/2) * 100}%, #334155 100%)`
            }}
            onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
        />
      </div>

      {/* Bend Button */}
      <button
        className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${
            isBendEnabled 
            ? 'bg-purple-600 text-white border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.6)]' 
            : 'bg-purple-900/40 text-purple-400 border-purple-500/50 hover:bg-purple-800/60'
        } ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('bend'), width: largeBtnSize, height: largeBtnSize, fontSize: 14 * uiScale }}
        onPointerDown={(e) => handleButtonPress(e, 'bend', onBend)}
      >
        BEND
      </button>

      {/* Latch Button */}
      <button
        className={getLatchStyle()}
        style={{ ...draggableStyle('latch'), width: largeBtnSize, height: largeBtnSize, fontSize: 14 * uiScale }}
        onPointerDown={(e) => handleButtonPress(e, 'latch', onLatch)}
      >
        LATCH
      </button>

      {/* Off Button */}
      <button
        className={`absolute rounded-full bg-yellow-900/40 border-2 border-yellow-500/50 flex items-center justify-center text-yellow-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-yellow-800/60 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('off'), width: largeBtnSize, height: largeBtnSize, fontSize: 14 * uiScale }}
        onPointerDown={(e) => handleButtonPress(e, 'off', onOff)}
      >
        OFF
      </button>

      {/* Panic Button */}
      <button
        className={`absolute rounded-full bg-red-900/40 border-2 border-red-500/50 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-red-800/60 active:bg-red-600 active:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('panic'), width: largeBtnSize, height: largeBtnSize, fontSize: 14 * uiScale }}
        onPointerDown={(e) => handleButtonPress(e, 'panic', onPanic)}
      >
        PANIC
      </button>

      {/* Center View Button */}
      <button
        className={`absolute rounded bg-yellow-600/20 border-2 border-yellow-500 flex items-center justify-center text-yellow-500 font-bold backdrop-blur hover:bg-yellow-600/40 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ ...draggableStyle('center'), width: baseSize, height: baseSize }}
        onPointerDown={(e) => handleButtonPress(e, 'center', onCenter)}
        title="Center Display"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
      </button>

      {/* Increase Depth Button */}
      {showIncreaseDepthButton && (
        <button
          className={`absolute rounded bg-blue-600/20 border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold backdrop-blur hover:bg-blue-600/40 active:bg-blue-600 active:text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
          style={{ ...draggableStyle('depth'), width: baseSize, height: baseSize }}
          onPointerDown={(e) => handleButtonPress(e, 'depth', onIncreaseDepth)}
          title="Increase Depth from Selection"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
      )}

      {/* Decrease Depth Button */}
      {showIncreaseDepthButton && (
        <button
          className={`absolute rounded bg-green-600/20 border-2 border-green-500 flex items-center justify-center text-green-500 font-bold backdrop-blur hover:bg-green-600/40 active:bg-green-600 active:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
          style={{ ...draggableStyle('decreaseDepth'), width: baseSize, height: baseSize }}
          onPointerDown={(e) => handleButtonPress(e, 'decreaseDepth', onDecreaseDepth)}
          title="Undo Last Depth Increase"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4 L10 10 M10 10 L10 6 M10 10 L6 10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 4 L14 10 M14 10 L14 6 M14 10 L18 10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20 L10 14 M10 14 L10 18 M10 14 L6 14" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 20 L14 14 M14 14 L14 18 M14 14 L18 14" />
          </svg>
        </button>
      )}

      {/* Chords Group - Wrapped in draggable container */}
      <div
         className={`absolute flex gap-2 flex-wrap items-start z-[150] ${uiUnlocked ? 'cursor-move bg-white/5 rounded p-2 border border-yellow-500/30' : ''}`}
         style={{ ...draggableStyle('chords'), maxWidth: '80vw' }}
         onPointerDown={(e) => handleDrag(e, 'chords')}
      >
          {/* Add Chord Button */}
          <button
            className={`rounded border-2 border-slate-500 border-dashed flex items-center justify-center text-slate-500 font-bold backdrop-blur hover:bg-slate-700/40 hover:text-white hover:border-white transition-all select-none ${uiUnlocked ? 'pointer-events-none' : ''}`}
            style={{ width: chordSize, height: chordSize }}
            onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
            onClick={!uiUnlocked ? onAddChord : undefined}
            title="Store currently latched notes as a Chord"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-1/2 h-1/2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Saved Chords */}
          {savedChords.filter(c => c.visible).map((chord) => {
              const isActive = activeChordIds.includes(chord.id);
              return (
                <button
                    key={chord.id}
                    className={`rounded flex items-center justify-center font-bold backdrop-blur transition-all shadow-lg select-none ${uiUnlocked ? 'pointer-events-none' : ''}`}
                    style={{
                        width: chordSize,
                        height: chordSize,
                        fontSize: 12 * uiScale,
                        backgroundColor: isActive ? chord.color : `${chord.color}33`, 
                        borderColor: chord.color,
                        borderWidth: 2,
                        color: isActive ? '#fff' : chord.color,
                        boxShadow: isActive ? `0 0 10px ${chord.color}` : 'none'
                    }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()}
                    onClick={() => !uiUnlocked && toggleChord(chord.id)}
                    title={`Chord ${chord.id}: ${chord.label}`}
                >
                    {chord.id}
                </button>
              );
          })}
      </div>
    </>
  );
};

export default FloatingControls;
