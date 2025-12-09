
import React, { useState } from 'react';

interface Props {
  volume: number;
  setVolume: (v: number) => void;
  onPanic: () => void;
  pitchOffLocked: boolean;
  volumeLocked: boolean;
}

const FloatingControls: React.FC<Props> = ({ volume, setVolume, onPanic, pitchOffLocked, volumeLocked }) => {
  const [panicPos, setPanicPos] = useState({ x: window.innerWidth - 120, y: window.innerHeight - 100 });
  const [volPos, setVolPos] = useState({ x: window.innerWidth / 2 - 100, y: window.innerHeight - 80 });
  
  const handleDrag = (e: React.PointerEvent, setPos: any, locked: boolean) => {
    if (locked) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    
    const onMove = (evt: PointerEvent) => {
       setPos({ x: evt.clientX - el.clientWidth/2, y: evt.clientY - el.clientHeight/2 });
    };
    
    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
    };
    
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      {/* Volume Slider */}
      <div 
        className={`absolute bg-slate-800/80 p-3 rounded-full flex items-center gap-2 backdrop-blur border border-white/10 ${volumeLocked ? '' : 'cursor-move'}`}
        style={{ left: volPos.x, top: volPos.y, width: 200, zIndex: 150 }}
        onPointerDown={(e) => handleDrag(e, setVolPos, volumeLocked)}
      >
        <span className="text-xs font-bold text-slate-400">VOL</span>
        <input 
          type="range" min="0" max="1" step="0.01" 
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
          onPointerDown={(e) => e.stopPropagation()} // Allow slider interaction without drag
        />
      </div>

      {/* Panic Button */}
      <button
        className={`absolute w-20 h-20 rounded-full bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-red-600/40 active:bg-red-600 active:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] ${pitchOffLocked ? '' : 'cursor-move'}`}
        style={{ left: panicPos.x, top: panicPos.y, zIndex: 150 }}
        onClick={onPanic}
        onPointerDown={(e) => handleDrag(e, setPanicPos, pitchOffLocked)}
      >
        Off
      </button>
    </>
  );
};

export default FloatingControls;
