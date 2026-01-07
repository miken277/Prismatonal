
import React from 'react';
import { AppSettings, XYPos } from '../../types';

interface Props {
    isBendEnabled: boolean;
    latchMode: number;
    isSustainEnabled?: boolean;
    uiUnlocked: boolean;
    uiScale: number;
    positions: AppSettings['uiPositions'];
    
    onBend: () => void;
    onSustainToggle?: () => void;
    onOff: () => void;
    onPanic: () => void;
    onDragStart: (e: React.PointerEvent, key: keyof AppSettings['uiPositions']) => void;
}

const PerformanceControls: React.FC<Props> = ({
    isBendEnabled, latchMode, isSustainEnabled, uiUnlocked, uiScale, positions,
    onBend, onSustainToggle, onOff, onPanic, onDragStart
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

    return (
        <>
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
