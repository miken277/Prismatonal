import React from 'react';
import { AppSettings } from '../types';
import { MARGIN_3MM, SCROLLBAR_WIDTH } from '../constants';

interface Props {
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  uiScale?: number;
}

const LIMITS = [1, 3, 5, 7, 11, 13];

const LimitLayerControls: React.FC<Props> = ({ settings, updateSettings, draggingId, setDraggingId, uiScale = 1.0 }) => {
  const { uiUnlocked, uiPositions } = settings;
  
  // Size increased by 1/3: 56 * 1.33 = 75, 28 * 1.33 = 37
  const buttonSize = 75 * uiScale; 
  const iconSize = 37 * uiScale; 

  const isVisible = (limit: number) => {
    // 1-Limit is always visible
    if (limit === 1) return true;
    return !settings.hiddenLimits.includes(limit);
  };

  const toggleVisibility = (limit: number) => {
    // Prevent hiding 1-Limit
    if (limit === 1) return;

    const isHidden = settings.hiddenLimits.includes(limit);
    let newHidden = [...settings.hiddenLimits];
    if (isHidden) {
      newHidden = newHidden.filter(l => l !== limit);
    } else {
      newHidden.push(limit);
    }
    updateSettings({ ...settings, hiddenLimits: newHidden });
  };

  const bringToFront = (limit: number) => {
    const newOrder = settings.layerOrder.filter(l => l !== limit);
    newOrder.push(limit);
    updateSettings({ ...settings, layerOrder: newOrder });
  };

  // Drag Handler
  const handleDrag = (e: React.PointerEvent) => {
    if (!uiUnlocked) return;
    
    // Lock check
    if (draggingId !== null && draggingId !== 'layers') return;

    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    
    // Initial position
    const initialLeft = uiPositions.layers.x;
    const initialTop = uiPositions.layers.y;

    el.setPointerCapture(e.pointerId);
    setDraggingId('layers');

    const onMove = (evt: PointerEvent) => {
        const deltaX = evt.clientX - startX;
        const deltaY = evt.clientY - startY;
        
        let newX = initialLeft + deltaX;
        let newY = initialTop + deltaY;
        
        // Clamp to window bounds with Margin + Scrollbar safety
        const maxX = window.innerWidth - el.offsetWidth - MARGIN_3MM - SCROLLBAR_WIDTH;
        const maxY = window.innerHeight - el.offsetHeight - MARGIN_3MM - SCROLLBAR_WIDTH;
        const minX = MARGIN_3MM;
        const minY = MARGIN_3MM;
        
        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));
        
        updateSettings({ 
            ...settings, 
            uiPositions: { 
                ...settings.uiPositions, 
                layers: { x: newX, y: newY } 
            } 
        });
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

  return (
    <div 
        className={`absolute flex flex-col gap-1 z-[140] bg-slate-900/50 p-1.5 rounded-xl backdrop-blur-sm border border-slate-700/50 ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ left: uiPositions.layers.x, top: uiPositions.layers.y, touchAction: 'none' }}
        onPointerDown={handleDrag}
        aria-label="Layer Controls"
    >
      {LIMITS.map(limit => {
        const visible = isVisible(limit);
        const color = settings.colors[limit];
        const isTop = settings.layerOrder[settings.layerOrder.length - 1] === limit;
        const isLocked = limit === 1;

        return (
          <div key={limit} className="flex items-center gap-2 group">
            {/* Visibility Toggle */}
            <button 
              onClick={(e) => { e.stopPropagation(); !uiUnlocked && toggleVisibility(limit); }}
              disabled={isLocked}
              className={`flex items-center justify-center rounded transition-colors ${visible ? (isLocked ? 'text-slate-500 cursor-default opacity-50' : 'text-white') : 'text-slate-600'} hover:bg-white/10 ${uiUnlocked ? 'pointer-events-none' : ''}`}
              style={{ width: iconSize, height: iconSize }}
              onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
              aria-label={`Toggle visibility for ${limit}-limit`}
              title={`Toggle Visibility (${limit}-Limit)`}
            >
               {visible ? (
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-full h-full p-0.5">
                   <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                   <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 8.201 2.372 9.336 6.41.147.527.147 1.074 0 1.601C18.201 14.628 14.257 17 10 17c-4.257 0-8.201-2.372-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                 </svg>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-full h-full p-0.5">
                   <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745A10.029 10.029 0 0018 10c-1.135-4.038-5.079-6.41-9.336-6.41a9.982 9.982 0 00-4.636 1.135L3.28 2.22zm12.98 12.98l-3.212-3.212a3.003 3.003 0 00-4.244-4.244L5.68 4.62A11.967 11.967 0 00.664 9.41a1.651 1.651 0 010 1.18c1.135 4.038 5.079 6.41 9.336 6.41 2.053 0 4.008-.584 5.688-1.613l.572.572z" clipRule="evenodd" />
                   <path d="M10.983 7.796a1.5 1.5 0 012.122 2.122l-2.122-2.122z" />
                 </svg>
               )}
            </button>
            
            {/* Color/Select Layer Button */}
            <button 
              onClick={(e) => { e.stopPropagation(); !uiUnlocked && bringToFront(limit); }}
              className={`rounded-lg shadow-md border-2 transition-all transform active:scale-95 flex items-center justify-center font-bold text-shadow ${uiUnlocked ? 'pointer-events-none' : ''}`}
              style={{ 
                width: buttonSize, 
                height: buttonSize,
                fontSize: 16 * uiScale,
                backgroundColor: color, 
                borderColor: isTop ? 'white' : 'transparent',
                boxShadow: isTop ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
                opacity: visible ? 1 : 0.2
              }}
              onPointerDown={(e) => !uiUnlocked && e.stopPropagation()}
              aria-label={`Select Layer ${limit}`}
              title={`Bring ${limit}-Limit to Front`}
            >
              {limit}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default LimitLayerControls;