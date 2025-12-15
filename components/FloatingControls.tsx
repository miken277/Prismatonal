
import React from 'react';
import { ChordDefinition, XYPos, AppSettings } from '../types';
import { MARGIN_3MM, SCROLLBAR_WIDTH } from '../constants';

interface Props {
  volume: number;
  setVolume: (v: number) => void;
  onPanic: () => void;
  onOff: () => void;
  latchStatus: 0 | 1 | 2; // 0=Off, 1=Active, 2=Frozen
  onLatchToggle: () => void;
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
}

const FloatingControls: React.FC<Props> = ({ 
  volume, setVolume, onPanic, onOff, latchStatus, onLatchToggle, 
  onCenter, onIncreaseDepth, onDecreaseDepth, onAddChord, toggleChord,
  activeChordIds, savedChords, chordShortcutSizeScale,
  showIncreaseDepthButton, uiUnlocked, uiPositions, updatePosition,
  draggingId, setDraggingId
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
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Base size reference for buttons
  const baseSize = 48; // 12 * 4px (w-12)
  const chordSize = baseSize * chordShortcutSizeScale;

  // Styles
  const draggableStyle = (key: string) => ({
      left: uiPositions[key as keyof typeof uiPositions].x,
      top: uiPositions[key as keyof typeof uiPositions].y,
      touchAction: 'none' as React.CSSProperties['touchAction'],
  });

  const glassPanelClass = `bg-slate-800/80 border border-slate-600/50 shadow-xl rounded-2xl transition-all ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50 hover:bg-slate-700/80' : ''}`;
  
  // Helper to handle button press logic (Drag if unlocked, Action if locked)
  const handleButtonPress = (e: React.PointerEvent, key: keyof AppSettings['uiPositions'], action: () => void) => {
      e.stopPropagation(); // Stop propagation to canvas
      if (uiUnlocked) {
          handleDrag(e, key);
      } else {
          action();
      }
  };

  return (
    <>
      {/* Volume Slider - Top Center */}
      <div 
        className={`absolute flex items-center gap-3 p-3 px-4 z-[150] ${glassPanelClass}`}
        style={{ ...draggableStyle('volume'), width: 180 }}
        onPointerDown={(e) => handleDrag(e, 'volume')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
        <input 
          type="range" min="0" max="1" step="0.01" 
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          disabled={uiUnlocked}
          className={`w-full h-1.5 bg-slate-600 rounded-lg appearance-none ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer accent-blue-500'}`}
          onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
        />
      </div>

      {/* Navigation Bar (Center + Depths) - Bottom Left */}
      <div
         className={`absolute flex items-center p-2 gap-2 z-[150] ${glassPanelClass}`}
         style={draggableStyle('center')}
         onPointerDown={(e) => handleDrag(e, 'center')}
      >
          {showIncreaseDepthButton && (
             <button
               className={`w-10 h-10 rounded-xl flex items-center justify-center text-green-400 hover:bg-white/10 active:bg-green-500 active:text-white transition-colors ${uiUnlocked ? 'pointer-events-none' : ''}`}
               onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
               onClick={onDecreaseDepth}
               title="Decrease Depth"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
                </svg>
             </button>
          )}

          <div className="w-px h-6 bg-slate-600/50"></div>

          <button
             className={`w-12 h-10 rounded-xl flex items-center justify-center text-yellow-500 font-bold hover:bg-white/10 active:bg-yellow-600 active:text-white transition-colors ${uiUnlocked ? 'pointer-events-none' : ''}`}
             onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
             onClick={onCenter}
             title="Center View"
          >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
               <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
             </svg>
          </button>
          
          <div className="w-px h-6 bg-slate-600/50"></div>

          {showIncreaseDepthButton && (
             <button
               className={`w-10 h-10 rounded-xl flex items-center justify-center text-blue-400 hover:bg-white/10 active:bg-blue-500 active:text-white transition-colors ${uiUnlocked ? 'pointer-events-none' : ''}`}
               onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
               onClick={onIncreaseDepth}
               title="Increase Depth"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
             </button>
          )}
      </div>

      {/* Latch Button */}
      {/* Container wrapper used for the animated border effect in Frozen state */}
      <div
        className={`absolute w-16 h-16 z-[150] rounded-2xl ${uiUnlocked ? 'cursor-move' : ''}`}
        style={draggableStyle('latch')}
        onPointerDown={(e) => handleButtonPress(e, 'latch', onLatchToggle)}
      >
          {latchStatus === 2 && (
              // Spinning Gradient Background for Frozen State
              <div className="absolute inset-[-4px] rounded-2xl overflow-hidden animate-spin-slow opacity-80 pointer-events-none">
                  <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_90deg,#22c55e_180deg,transparent_270deg,transparent_360deg)]"></div>
              </div>
          )}
          
          <button
            className={`relative w-full h-full flex items-center justify-center font-bold uppercase tracking-wider rounded-2xl select-none transition-all border
                ${latchStatus === 1 
                    ? 'bg-green-500 text-white border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.6)]' // Active
                    : latchStatus === 2 
                        ? 'bg-slate-900 text-green-500 border-transparent' // Frozen (Background handled by wrapper)
                        : 'bg-slate-800/80 text-green-700 border-slate-600/50 hover:text-green-500' // Off
                }
                ${uiUnlocked ? 'pointer-events-none' : 'active:scale-95'}
            `}
          >
            LATCH
          </button>
      </div>

      {/* Off Button */}
      <button
        className={`absolute w-16 h-16 flex items-center justify-center text-yellow-500 font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(234,179,8,0.2)] z-[150] select-none ${glassPanelClass} hover:bg-yellow-600/20 active:bg-yellow-600 active:text-white`}
        style={draggableStyle('off')}
        onPointerDown={(e) => handleButtonPress(e, 'off', onOff)}
      >
        OFF
      </button>

      {/* Panic Button */}
      <button
        className={`absolute w-16 h-16 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.2)] z-[150] select-none ${glassPanelClass} hover:bg-red-600/20 active:bg-red-600 active:text-white`}
        style={draggableStyle('panic')}
        onPointerDown={(e) => handleButtonPress(e, 'panic', onPanic)}
      >
        PANIC
      </button>

      {/* Chords Group */}
      <div
         className={`absolute flex gap-2 flex-wrap items-start z-[150] p-2 ${glassPanelClass}`}
         style={{ ...draggableStyle('chords'), maxWidth: '80vw' }}
         onPointerDown={(e) => handleDrag(e, 'chords')}
      >
          {/* Add Chord Button */}
          <button
            className={`rounded-lg border-2 border-slate-500 border-dashed flex items-center justify-center text-slate-500 font-bold hover:bg-slate-700/40 hover:text-white hover:border-white transition-all select-none ${uiUnlocked ? 'pointer-events-none' : ''}`}
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
                    className={`rounded-lg flex items-center justify-center font-bold transition-all shadow-lg select-none ${uiUnlocked ? 'pointer-events-none' : ''}`}
                    style={{
                        width: chordSize,
                        height: chordSize,
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
