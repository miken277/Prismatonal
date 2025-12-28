
import React, { useState, useRef, useEffect } from 'react';

interface Props {
  value: number; // 0.0 to 1.0
  onChange: (val: number) => void;
  color: string; // CSS color string (hex or rgba)
  width: number;
  height: number;
  uiScale?: number;
}

const VolumeWheel: React.FC<Props> = ({ value, onChange, color, width, height, uiScale = 1.0 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
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

  // Visuals
  // Generate some "grip lines" based on the value to simulate a wheel rotating
  const renderGripLines = () => {
      const lines = [];
      const numLines = 5;
      const spacing = height / numLines;
      // Offset lines based on value to create rolling effect
      const offset = (value * height) % spacing;
      
      for (let i = -1; i <= numLines; i++) {
          const y = (i * spacing) + offset;
          if (y >= 0 && y <= height) {
              lines.push(
                  <div 
                    key={i} 
                    className="absolute w-full h-[1px] bg-black/30 pointer-events-none"
                    style={{ top: height - y }} // Invert so Up moves lines down (wheel logic) or Up moves lines Up? 
                                                // Actually, if it's a fader, lines usually stick to the handle. 
                                                // If it's a wheel, pushing UP rotates top away.
                  />
              );
          }
      }
      return lines;
  };

  return (
    <div
      ref={ref}
      className={`relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-inner ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ width, height, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Background Track */}
      <div className="absolute inset-0 bg-slate-800/50" />

      {/* Filled Level */}
      <div 
        className="absolute bottom-0 left-0 w-full transition-all duration-75 ease-linear"
        style={{ 
            height: `${value * 100}%`, 
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}80` // Glow
        }} 
      />

      {/* Wheel Texture / Gloss */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/20 pointer-events-none" />
      
      {/* Value Indicator (Only show when interacting or hovering) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
          {/* Optional: Add iconic lines or texture here */}
          <div className="flex flex-col gap-1 w-[60%] opacity-30">
             <div className="h-[2px] bg-white rounded-full w-full" />
             <div className="h-[2px] bg-white rounded-full w-full" />
             <div className="h-[2px] bg-white rounded-full w-full" />
          </div>
      </div>
    </div>
  );
};

export default React.memo(VolumeWheel);
