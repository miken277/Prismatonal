
import React from 'react';
import VolumeWheel from '../VolumeWheel';
import { PresetState, PlayMode, SynthPreset } from '../../types';
import { MODE_COLORS } from '../../constants';

interface Props {
    latchMode: 0 | 1 | 2 | 3 | 4;
    onLatch: () => void;
    onSust?: () => void;
    onPluck?: () => void;
    onVoice?: () => void;
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
    latchMode, onLatch, onSust, onPluck, onVoice, activeSustainedModes, onClearSustain,
    presets, onPresetChange, uiScale, position, onDragStart, uiUnlocked
}) => {
    
    // Resize to ~75% of original (104 -> 78)
    const instrButtonSize = 78 * uiScale; 
    const wheelWidth = instrButtonSize * 0.45;
    
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

    const renderInstrument = (
        modeId: number,
        label: string,
        presetKey: PlayMode,
        onSelect: (() => void) | undefined,
        color: string
    ) => {
        const isSelected = latchMode === modeId;
        const isActive = activeSustainedModes.includes(modeId);
        // Show aura if active but not selected (so you know it's playing in background)
        // OR if selected and active (reinforcement)
        const showAura = isActive && !isSelected; 
        
        // Define styles based on color
        const baseStyle = {
            width: instrButtonSize,
            height: instrButtonSize,
            fontSize: 12 * uiScale, // Scaled down font size
            borderColor: isSelected ? color : 'rgba(148, 163, 184, 0.2)', // slate-400/20
            backgroundColor: isSelected ? `${color}20` : 'rgba(30, 41, 59, 0.6)', // slate-800/60
            color: isSelected ? 'white' : 'rgba(148, 163, 184, 0.8)',
            textShadow: isSelected ? `0 0 10px ${color}` : 'none',
            boxShadow: isSelected ? `0 0 15px ${color}40` : 'none'
        };

        return (
            <div className="flex items-center gap-2 relative group">
                <VolumeWheel 
                    value={presets?.[presetKey].gain || 0.5} 
                    onChange={(v) => updatePatchGain(presetKey, v)} 
                    color={color} 
                    width={wheelWidth} 
                    height={instrButtonSize} 
                    uiScale={uiScale}
                />
                
                <div className="relative">
                    <button 
                        className={`rounded-xl border-2 transition-all duration-200 transform active:scale-95 flex flex-col items-center justify-center font-bold uppercase tracking-wider backdrop-blur-md overflow-hidden relative ${showAura ? 'animate-pulse' : ''}`}
                        style={baseStyle}
                        onPointerDown={(e) => !uiUnlocked && handleButtonPress(e, onSelect)}
                        onContextMenu={(e) => { e.preventDefault(); if(!uiUnlocked && onClearSustain) onClearSustain(modeId); }}
                    >
                        {/* Internal Glow for Active state */}
                        {isActive && (
                            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundColor: color, filter: 'blur(10px)' }} />
                        )}
                        <span className="z-10">{label}</span>
                        {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full mt-1 z-10" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
                        )}
                    </button>

                    {/* Quick Clear Button (Visible if Active) */}
                    {isActive && !uiUnlocked && (
                        <button
                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-900 border border-slate-600 text-slate-400 hover:text-white hover:bg-red-900 hover:border-red-500 flex items-center justify-center shadow-lg transition-colors z-20"
                            onPointerDown={(e) => { e.stopPropagation(); if(onClearSustain) onClearSustain(modeId); }}
                            title="Clear Sustained Notes"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div 
            className={`absolute flex flex-col gap-3 z-[140] bg-slate-950/80 p-2.5 rounded-2xl backdrop-blur-md border border-slate-700/50 shadow-2xl cursor-move transition-shadow ${uiUnlocked ? 'ring-2 ring-yellow-500/50' : 'hover:shadow-[0_0_20px_rgba(0,0,0,0.5)]'}`}
            style={{ 
                left: position.x, 
                top: position.y,
                touchAction: 'none'
            }}
            onPointerDown={onDragStart}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
            
            {/* Header / Handle */}
            <div className="flex justify-center pb-1 border-b border-white/5 mb-1 opacity-50">
                <div className="w-8 h-1 bg-slate-600 rounded-full" />
            </div>

            {/* Voice (Yellow) - Top */}
            {renderInstrument(4, "Voice", 'brass', onVoice, MODE_COLORS[4])}

            {/* Strings (Blue) */}
            {renderInstrument(2, "Strings", 'normal', onSust, MODE_COLORS[2])}

            {/* Plucked (Orange) */}
            {renderInstrument(3, "Plucked", 'strum', onPluck, MODE_COLORS[3])}

            {/* Drone (Green) - Bottom */}
            {renderInstrument(1, "Drone", 'latch', onLatch, MODE_COLORS[1])}
        </div>
    );
};

export default InstrumentCluster;
