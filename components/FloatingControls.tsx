
import React, { useState } from 'react';

interface Props {
  volume: number;
  setVolume: (v: number) => void;
  onPanic: () => void;
  onCenter: () => void;
  pitchOffLocked: boolean;
  volumeLocked: boolean;
}

const FloatingControls: React.FC<Props> = ({ volume, setVolume, onPanic, onCenter, pitchOffLocked, volumeLocked }) => {
  const [panicPos, setPanicPos] = useState({ x: window.innerWidth - 120, y: window.innerHeight - 100 });
  const [volPos, setVolPos] = useState({ x: window.innerWidth / 2 - 100, y: window.innerHeight - 80 });
  const [centerPos, setCenterPos] = useState({ x: window.innerWidth / 2 - 25, y: 100 }); // Top center default
  
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

      {/* Center View Button */}
      <button
        className={`absolute w-12 h-12 rounded bg-yellow-600/20 border-2 border-yellow-500 flex items-center justify-center text-yellow-500 font-bold backdrop-blur hover:bg-yellow-600/40 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)] cursor-move`}
        style={{ left: centerPos.x, top: centerPos.y, zIndex: 150 }}
        onClick={onCenter}
        onPointerDown={(e) => handleDrag(e, setCenterPos, false)}
        title="Center Display"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
      </button>
    </>
  );
};

export default FloatingControls;
