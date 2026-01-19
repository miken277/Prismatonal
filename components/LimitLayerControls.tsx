
import React from 'react';
import { AppSettings, XYPos } from '../types';
import { useDragManager } from '../hooks/useDragManager';

interface Props {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  uiScale?: number;
  isShortScreen?: boolean;
}

const LIMITS = [1, 3, 5, 7, 9, 11, 13, 15];

// Map visual limits to their index in the GRID_IDENTITIES array
// GRID_IDENTITIES = [1, 5, 3, 7, 9, 11, 13, 15]
const LIMIT_TO_INDEX: Record<number, number> = {
    1: 0,
    5: 1,
    3: 2,
    7: 3,
    9: 4,
    11: 5,
    13: 6,
    15: 7
};

const LimitLayerControls: React.FC<Props> = ({ settings, updateSettings, draggingId, setDraggingId, uiScale = 1.0, isShortScreen = false }) => {
  const { uiUnlocked, uiPositions } = settings;
  
  const buttonSize = 75 * uiScale; 
  const iconSize = 37 * uiScale; 

  // Check if the primary nodes for this limit are enabled in the matrix mask
  const isVisible = (limit: number) => {
    if (limit === 1) return true; // 1/1 is always considered visible/anchor
    const idx = LIMIT_TO_INDEX[limit];
    if (idx === undefined) return false;

    // Check Otonal Axis (Row idx, Col 0) OR Utonal Axis (Row 0, Col idx)
    // Grid Index = Row * 8 + Col
    const otonalIndex = idx * 8 + 0;
    const utonalIndex = 0 * 8 + idx;

    return settings.enabledGridMask[otonalIndex] || settings.enabledGridMask[utonalIndex];
  };

  const toggleVisibility = (limit: number) => {
    if (limit === 1) return; // Lock 1/1

    const idx = LIMIT_TO_INDEX[limit];
    if (idx === undefined) return;

    const otonalIndex = idx * 8 + 0; // The Limit/1 Node (e.g., 5/4)
    const utonalIndex = 0 * 8 + idx; // The 1/Limit Node (e.g., 8/5)

    const currentlyVisible = isVisible(limit);
    const nextState = !currentlyVisible;

    // 1. Update Matrix Mask
    const newMask = [...settings.enabledGridMask];
    newMask[otonalIndex] = nextState;
    newMask[utonalIndex] = nextState;

    // 2. Ensure we unhide from legacy filters if enabling
    let newHidden = [...settings.hiddenLimits];
    if (nextState) {
        newHidden = newHidden.filter(l => l !== limit);
    }
    // Note: We do NOT add to hiddenLimits when disabling. 
    // This allows advanced users to keep complex ratios (e.g. 5/3) enabled in the matrix 
    // while hiding the axis fundamentals (5/1) if they really want to, 
    // fulfilling the request to "show or hide the first utonal and otonal node".

    updateSettings({ 
        enabledGridMask: newMask, 
        hiddenLimits: newHidden 
    });
  };

  const bringToFront = (limit: number) => {
    const newOrder = settings.layerOrder.filter(l => l !== limit);
    newOrder.push(limit);
    updateSettings({ layerOrder: newOrder });
  };

  const handlePositionUpdate = (id: string, pos: XYPos) => {
      updateSettings({ 
          uiPositions: { 
              ...settings.uiPositions, 
              layers: pos 
          } 
      });
  };

  const handleDrag = useDragManager(
      uiUnlocked,
      draggingId,
      setDraggingId,
      handlePositionUpdate,
      uiPositions as unknown as Record<string, XYPos>
  );

  return (
    <div 
        className={`absolute flex flex-col gap-1 z-[140] bg-slate-900/50 p-2 rounded-xl backdrop-blur-sm border border-slate-700/50 ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ left: uiPositions.layers.x, top: uiPositions.layers.y, touchAction: 'none' }}
        onPointerDown={(e) => handleDrag(e, 'layers')}
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
              title={visible ? `Hide ${limit}-Limit Fundamentals` : `Show ${limit}-Limit Fundamentals`}
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
