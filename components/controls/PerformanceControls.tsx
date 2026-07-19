
import React from 'react';
import { AppSettings, XYPos } from '../../types';

interface Props {
    isBendEnabled: boolean;
    latchMode: number;
    isSustainEnabled?: boolean;
    isModulationModeActive?: boolean;
    isShiftModeActive?: boolean; // NEW
    uiUnlocked: boolean;
    uiScale: number;
    positions: AppSettings['uiPositions'];
    
    onBend: () => void;
    onSustainToggle?: () => void;
    onOff: () => void;
    onPanic: () => void;
    onModulationToggle?: () => void;
    onShiftToggle?: () => void; // NEW
    onDragStart: (e: React.PointerEvent, key: keyof AppSettings['uiPositions']) => void;
    isPhone?: boolean;
}

const PerformanceControls: React.FC<Props> = ({
    isBendEnabled, latchMode, isSustainEnabled, isModulationModeActive, isShiftModeActive,
    uiUnlocked, uiScale, positions,
    onBend, onSustainToggle, onOff, onPanic, onModulationToggle, onShiftToggle,
    onDragStart, isPhone = false
}) => {
    
    const perfBtnSize = 92 * uiScale;
    const fontSize = 16 * uiScale;

    const draggableStyle = (key: keyof AppSettings['uiPositions']) => ({
        left: positions[key].x,
        top: positions[key].y,
        width: perfBtnSize,
        height: perfBtnSize,
        fontSize: fontSize,
        touchAction: 'none' as React.CSSProperties['touchAction'],
    });

    const handlePress = (e: React.PointerEvent, key: keyof AppSettings['uiPositions'], action?: () => void) => {
        e.stopPropagation();
        if (uiUnlocked) {
            onDragStart(e, key);
        } else {
            if (e.button === 0 && action) action();
        }
    };

    const sustColorClass = latchMode === 1 
        ? (isSustainEnabled 
            ? 'bg-green-600 text-white border-green-300 shadow-[0_0_15px_rgba(34,197,94,0.6)]' 
            : 'bg-green-900/40 text-green-400 border-green-500/50 hover:bg-green-800/60')
        : (isSustainEnabled 
            ? 'bg-blue-600 text-white border-blue-300 shadow-[0_0_15px_rgba(37,99,235,0.6)]' 
            : 'bg-blue-900/40 text-blue-400 border-blue-500/50 hover:bg-blue-800/60');

    if (isPhone) {
        return (
            <div className="grid grid-cols-2 gap-2 w-full p-1">
                {/* Modulation Main Button */}
                <button 
                    className={`rounded-xl py-2.5 flex flex-col items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all border-2 text-[10px] select-none
                        ${isModulationModeActive 
                            ? 'bg-cyan-600 text-white border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.4)]' 
                            : 'bg-cyan-900/40 text-cyan-400 border-cyan-500/50'
                        }`} 
                    onPointerDown={(e) => { e.stopPropagation(); onModulationToggle?.(); }}
                    title="Modulation Mode (Click Node to pivot full structure)"
                >
                    MOD
                </button>

                {/* Shift Button */}
                <button 
                    className={`rounded-xl py-2.5 flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all border-2 text-[10px] select-none ${isShiftModeActive ? 'bg-orange-600 text-white border-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-orange-900/40 text-orange-400 border-orange-500/50'}`} 
                    onPointerDown={(e) => { e.stopPropagation(); onShiftToggle?.(); }}
                    title="Shift Mode"
                >
                    SHIFT
                </button>

                {/* Bend Button */}
                <button 
                    className={`rounded-xl py-2.5 flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all border-2 text-[10px] select-none ${isBendEnabled ? 'bg-purple-600 text-white border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-purple-900/40 text-purple-400 border-purple-500/50'}`} 
                    onPointerDown={(e) => { e.stopPropagation(); onBend(); }}
                >
                    BEND
                </button>

                {/* Sustain Button */}
                <button 
                    className={`rounded-xl py-2.5 flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all border-2 text-[10px] select-none ${sustColorClass}`} 
                    onPointerDown={(e) => { e.stopPropagation(); onSustainToggle?.(); }}
                >
                    SUST
                </button>

                {/* Off Button */}
                <button 
                    className="rounded-xl py-2.5 bg-yellow-900/30 border-2 border-yellow-500/40 flex items-center justify-center text-yellow-500 font-bold uppercase tracking-wider backdrop-blur active:bg-yellow-600 active:text-white transition-all text-[10px] select-none" 
                    onPointerDown={(e) => { e.stopPropagation(); onOff(); }}
                >
                    OFF
                </button>

                {/* Panic Button */}
                <button 
                    className="rounded-xl py-2.5 bg-red-900/30 border-2 border-red-500/40 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider backdrop-blur active:bg-red-600 active:text-white transition-all text-[10px] select-none" 
                    onPointerDown={(e) => { e.stopPropagation(); onPanic(); }}
                >
                    PANIC
                </button>
            </div>
        );
    }

    return (
        <>
            {/* Modulation Main Button */}
            <button 
                className={`absolute rounded-full flex flex-col items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg 
                    ${isModulationModeActive 
                        ? 'bg-cyan-600 text-white border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.5)]' 
                        : 'bg-cyan-900/40 text-cyan-400 border-cyan-500/50 hover:bg-cyan-800/60'
                    } ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                style={draggableStyle('mod')} 
                onPointerDown={(e) => handlePress(e, 'mod', onModulationToggle)}
                title="Modulation Mode (Click Node to pivot full structure)"
                aria-label="Toggle Modulation Mode"
            >
                MOD
            </button>

            {/* Shift Button (New) */}
            <button 
                className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${isShiftModeActive ? 'bg-orange-600 text-white border-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.6)]' : 'bg-orange-900/40 text-orange-400 border-orange-500/50 hover:bg-orange-800/60'} ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                style={draggableStyle('shift')} 
                onPointerDown={(e) => handlePress(e, 'shift', onShiftToggle)}
                aria-label="Toggle Chord Shift"
                title="Shift Mode: Drag any latched note to transpose entire chord"
            >
                SHIFT
            </button>

            <button 
                className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${isBendEnabled ? 'bg-purple-600 text-white border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.6)]' : 'bg-purple-900/40 text-purple-400 border-purple-500/50 hover:bg-purple-800/60'} ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                style={draggableStyle('bend')} 
                onPointerDown={(e) => handlePress(e, 'bend', onBend)}
                aria-label="Toggle Pitch Bend"
            >
                BEND
            </button>

            <button 
                className={`absolute rounded-full flex items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg ${sustColorClass} ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                style={draggableStyle('sust')} 
                onPointerDown={(e) => handlePress(e, 'sust', onSustainToggle)} 
                title="Sustain Notes"
                aria-label="Toggle Sustain"
            >
                SUST
            </button>

            <button 
                className={`absolute rounded-full bg-yellow-900/40 border-2 border-yellow-500/50 flex items-center justify-center text-yellow-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-yellow-800/60 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                style={draggableStyle('off')} 
                onPointerDown={(e) => handlePress(e, 'off', onOff)} 
                aria-label="Stop All Notes"
            >
                OFF
            </button>

            <button 
                className={`absolute rounded-full bg-red-900/40 border-2 border-red-500/50 flex items-center justify-center text-red-500 font-bold uppercase tracking-wider backdrop-blur hover:bg-red-800/60 active:bg-red-600 active:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                style={draggableStyle('panic')} 
                onPointerDown={(e) => handlePress(e, 'panic', onPanic)} 
                aria-label="Panic Stop"
            >
                PANIC
            </button>

        </>
    );
};

export default PerformanceControls;
