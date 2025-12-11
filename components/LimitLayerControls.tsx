
import React from 'react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
}

const LIMITS = [1, 3, 5, 7, 11, 13];

const LimitLayerControls: React.FC<Props> = ({ settings, updateSettings }) => {
  
  const isVisible = (limit: number) => {
    // 1-Limit is always visible
    if (limit === 1) return true;
    if (limit === 7) return settings.enabledLimits[7];
    if (limit === 11) return settings.enabledLimits[11];
    if (limit === 13) return settings.enabledLimits[13];
    return !settings.hiddenLimits.includes(limit);
  };

  const toggleVisibility = (limit: number) => {
    // Prevent hiding 1-Limit
    if (limit === 1) return;

    // For 7, 11, 13, we toggle 'enabledLimits' which affects generation (structure)
    if (limit === 7 || limit === 11 || limit === 13) {
      updateSettings({
        ...settings,
        enabledLimits: {
          ...settings.enabledLimits,
          [limit]: !settings.enabledLimits[limit as 7 | 11 | 13]
        }
      });
      return;
    }

    // For 3, 5 we toggle 'hiddenLimits' which affects strict filtering
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

  return (
    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-3 z-40 bg-slate-900/50 p-2 rounded-xl backdrop-blur-sm border border-slate-700/50">
      {LIMITS.map(limit => {
        const visible = isVisible(limit);
        const color = settings.colors[limit];
        const isTop = settings.layerOrder[settings.layerOrder.length - 1] === limit;
        
        // 1-Limit cannot be toggled off
        const isLocked = limit === 1;

        return (
          <div key={limit} className="flex items-center gap-2 group">
            {/* Visibility Toggle */}
            <button 
              onClick={() => toggleVisibility(limit)}
              disabled={isLocked}
              className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors ${visible ? (isLocked ? 'text-slate-500 cursor-default opacity-50' : 'text-white') : 'text-slate-600'} hover:bg-white/10`}
              title={isLocked ? "1-Limit is always enabled" : `Toggle ${limit}-Limit`}
            >
               {visible ? (
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                   <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                   <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 8.201 2.372 9.336 6.41.147.527.147 1.074 0 1.601C18.201 14.628 14.257 17 10 17c-4.257 0-8.201-2.372-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                 </svg>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                   <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745A10.029 10.029 0 0018 10c-1.135-4.038-5.079-6.41-9.336-6.41a9.982 9.982 0 00-4.636 1.135L3.28 2.22zm12.98 12.98l-3.212-3.212a3.003 3.003 0 00-4.244-4.244L5.68 4.62A11.967 11.967 0 00.664 9.41a1.651 1.651 0 010 1.18c1.135 4.038 5.079 6.41 9.336 6.41 2.053 0 4.008-.584 5.688-1.613l.572.572z" clipRule="evenodd" />
                   <path d="M10.983 7.796a1.5 1.5 0 012.122 2.122l-2.122-2.122z" />
                 </svg>
               )}
            </button>
            
            {/* Color/Select Layer Button */}
            <button 
              onClick={() => bringToFront(limit)}
              className={`w-10 h-10 rounded-lg shadow-md border-2 transition-all transform active:scale-95 flex items-center justify-center font-bold text-xs text-shadow`}
              style={{ 
                backgroundColor: color, 
                borderColor: isTop ? 'white' : 'transparent',
                boxShadow: isTop ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
                opacity: visible ? 1 : 0.2
              }}
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
