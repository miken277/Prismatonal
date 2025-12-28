
import React from 'react';
import VolumeWheel from '../VolumeWheel';
import { PresetState, PlayMode, SynthPreset } from '../../types';

interface Props {
    latchMode: 0 | 1 | 2 | 3;
    onLatch: () => void;
    onSust?: () => void;
    onPluck?: () => void;
    activeSustainedModes: number[];
    onClearSustain?: (mode: number) => void;
    
    // Patch / Gain handling
    presets?: PresetState;
    onPresetChange?: (mode: PlayMode, preset: SynthPreset) => void;
    
    // UI
    uiScale: number;
    position: { x: number, y: number };
    onDragStart: (e: React.PointerEvent) => void;
    uiUnlocked: boolean;
}

const InstrumentCluster: React.FC<Props> = ({
    latchMode, onLatch, onSust, onPluck, activeSustainedModes, onClearSustain,
    presets, onPresetChange, uiScale, position, onDragStart, uiUnlocked
}) => {
    
    const instrButtonSize = 104 * uiScale; 
    const wheelWidth = instrButtonSize * 0.5;
    
    // Aura Logic
    const hasDroneAura = activeSustainedModes.includes(1) && latchMode !== 1;
    const hasStringsAura = activeSustainedModes.includes(2) && latchMode !== 2;
    const droneAuraClass = "ring-4 ring-offset-2 ring-offset-slate-900 ring-green-500/60 animate-pulse";
    const stringsAuraClass = "ring-4 ring-offset-2 ring-offset-slate-900 ring-blue-500/60 animate-pulse";

    const updatePatchGain = (mode: PlayMode, val: number) => {
        if (presets && onPresetChange) {
            const preset = presets[mode];
            onPresetChange(mode, { ...preset, gain: val });
        }
    };

    const handleButtonPress = (e: React.PointerEvent, action?: () => void) => {
        e.stopPropagation();
        if (uiUnlocked) {
            onDragStart(e);
        } else {
            if (e.button === 0 && action) action();
        }
    };

    return (
        <div 
            className={`absolute flex flex-col gap-4 z-[140] bg-slate-900/50 p-3 rounded-xl backdrop-blur-sm border border-slate-700/50 cursor-move ${uiUnlocked ? 'ring-2 ring-yellow-500/50' : ''}`}
            style={{ 
                left: position.x, 
                top: position.y,
                touchAction: 'none'
            }}
            onPointerDown={onDragStart}
        >
            {/* Drone Button + Volume */}
            <div className="flex items-center gap-3">
                <VolumeWheel 
                    value={presets?.latch.gain || 0.5} 
                    onChange={(v) => updatePatchGain('latch', v)} 
                    color="#22c55e" 
                    width={wheelWidth} 
                    height={instrButtonSize} 
                    uiScale={uiScale}
                />
                <button 
                    className={`rounded-lg shadow-md border-2 transition-all transform active:scale-95 flex items-center justify-center font-bold text-[10px] uppercase tracking-wider ${latchMode === 1 ? 'bg-green-600 border-green-400 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'} ${hasDroneAura ? droneAuraClass : ''}`}
                    style={{ width: instrButtonSize, height: instrButtonSize, fontSize: 15 * uiScale }}
                    onPointerDown={(e) => !uiUnlocked && handleButtonPress(e, onLatch)}
                    onContextMenu={(e) => { e.preventDefault(); if(!uiUnlocked && onClearSustain) onClearSustain(1); }}
                >
                    Drone
                </button>
            </div>

            {/* Strings Button + Volume */}
            <div className="flex items-center gap-3">
                <VolumeWheel 
                    value={presets?.normal.gain || 0.5} 
                    onChange={(v) => updatePatchGain('normal', v)} 
                    color="#3b82f6" 
                    width={wheelWidth} 
                    height={instrButtonSize} 
                    uiScale={uiScale}
                />
                <button 
                    className={`rounded-lg shadow-md border-2 transition-all transform active:scale-95 flex items-center justify-center font-bold text-[10px] uppercase tracking-wider ${latchMode === 2 ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'} ${hasStringsAura ? stringsAuraClass : ''}`}
                    style={{ width: instrButtonSize, height: instrButtonSize, fontSize: 15 * uiScale }}
                    onPointerDown={(e) => onSust && !uiUnlocked && handleButtonPress(e, onSust)}
                    onContextMenu={(e) => { e.preventDefault(); if(!uiUnlocked && onClearSustain) onClearSustain(2); }}
                >
                    Strings
                </button>
            </div>

            {/* Plucked Button + Volume */}
            <div className="flex items-center gap-3">
                <VolumeWheel 
                    value={presets?.strum.gain || 0.5} 
                    onChange={(v) => updatePatchGain('strum', v)} 
                    color="#f97316" 
                    width={wheelWidth} 
                    height={instrButtonSize} 
                    uiScale={uiScale}
                />
                <button 
                    className={`rounded-lg shadow-md border-2 transition-all transform active:scale-95 flex items-center justify-center font-bold text-[10px] uppercase tracking-wider ${latchMode === 3 ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    style={{ width: instrButtonSize, height: instrButtonSize, fontSize: 15 * uiScale }}
                    onPointerDown={(e) => onPluck && !uiUnlocked && handleButtonPress(e, onPluck)}
                    onContextMenu={(e) => { e.preventDefault(); if(!uiUnlocked && onClearSustain) onClearSustain(3); }}
                >
                    Plucked
                </button>
            </div>
        </div>
    );
};

export default InstrumentCluster;
