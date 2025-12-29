
import React, { useState, useRef } from 'react';

interface Props {
  value: number; // 0.0 to 1.0
  onChange: (val: number) => void;
  color: string; // CSS color string (hex)
  width: number;
  height: number;
  uiScale?: number;
}

const VolumeWheel: React.FC<Props> = ({ value, onChange, color, width, height, uiScale = 1.0 }) => {
  const [isDragging, setIsDragging] = useState(false);
  
  // Cache the start value to prevent drift during drag
  const dragStartValue = useRef<number>(value);
  const dragStartY = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartValue.current = value;
    dragStartY.current = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();

    // Sensitivity: Full range over 150px of movement
    const sensitivity = 150 * uiScale; 
    const deltaY = dragStartY.current - e.clientY; // Up is positive
    const deltaVal = deltaY / sensitivity;
    
    const newValue = Math.min(1.0, Math.max(0.0, dragStartValue.current + deltaVal));
    
    // Only fire if changed significantly to save renders
    if (Math.abs(newValue - value) > 0.005) {
        onChange(newValue);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(false);
  };

  // Convert hex color to rgba for gradients
  const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
  };
  const rgb = hexToRgb(color);

  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shadow-inner group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ width, height, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Background Track with segmented dashes */}
      <div className="absolute inset-0 bg-slate-900 flex flex-col justify-between py-1 opacity-30 pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-full h-[1px] bg-slate-500/20" />
          ))}
      </div>

      {/* Active Fill (LED Strip style) */}
      <div 
        className="absolute bottom-0 left-0 w-full transition-all duration-75 ease-linear flex flex-col-reverse gap-[1px] overflow-hidden"
        style={{ 
            height: `${value * 100}%`,
            boxShadow: `0 -2px 10px rgba(${rgb}, 0.5)`
        }} 
      >
          <div className="absolute inset-0 w-full h-full opacity-80" style={{ backgroundColor: color }} />
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-black/10" />
      </div>

      {/* Glassy Overlay & Border Highlight */}
      <div className={`absolute inset-0 rounded-lg ring-1 ring-inset ring-white/5 transition-opacity duration-300 ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
      
      {/* Value Tooltip (Appears on drag) */}
      <div className={`absolute top-1 left-1/2 -translate-x-1/2 bg-black/80 px-1 rounded text-[8px] font-mono text-white pointer-events-none transition-opacity duration-200 ${isDragging ? 'opacity-100' : 'opacity-0'}`}>
          {(value * 100).toFixed(0)}
      </div>
    </div>
  );
};

export default React.memo(VolumeWheel);
