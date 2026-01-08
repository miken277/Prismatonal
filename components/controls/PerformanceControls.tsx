
import React from 'react';
import { AppSettings, XYPos } from '../../types';

interface Props {
    isBendEnabled: boolean;
    latchMode: number;
    isSustainEnabled?: boolean;
    isModulationModeActive?: boolean;
    modulationPathLength?: number;
    uiUnlocked: boolean;
    uiScale: number;
    positions: AppSettings['uiPositions'];
    
    onBend: () => void;
    onSustainToggle?: () => void;
    onOff: () => void;
    onPanic: () => void;
    onModulationToggle?: () => void;
    onModulationUndo?: () => void;
    onModulationReset?: () => void;
    onDragStart: (e: React.PointerEvent, key: keyof AppSettings['uiPositions']) => void;
}

const PerformanceControls: React.FC<Props> = ({
    isBendEnabled, latchMode, isSustainEnabled, isModulationModeActive, modulationPathLength = 0, uiUnlocked, uiScale, positions,
    onBend, onSustainToggle, onOff, onPanic, onModulationToggle, onModulationUndo, onModulationReset, onDragStart
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

    // --- Satellite Logic ---
    const showSatellites = modulationPathLength > 1;
    const satelliteSize = perfBtnSize * 0.4;
    const modX = positions.mod.x;
    const modY = positions.mod.y;
    
    // Offsets for satellites (relative to main button center)
    // Left Satellite (Undo): Top Left (-X, -Y)
    // Right Satellite (Reset): Top Right (+X, -Y)
    const offsetDistance = perfBtnSize * 0.6;
    const undoX = modX + (perfBtnSize/2) - (satelliteSize/2) - offsetDistance;
    const undoY = modY + (perfBtnSize/2) - (satelliteSize/2) - offsetDistance * 0.8;
    
    const resetX = modX + (perfBtnSize/2) - (satelliteSize/2) + offsetDistance;
    const resetY = modY + (perfBtnSize/2) - (satelliteSize/2) - offsetDistance * 0.8;

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

            {/* Modulation Satellites (Rendered under main button visually if needed, but z-index handles it) */}
            {showSatellites && !uiUnlocked && (
                <>
                    {/* Undo / Back Button */}
                    <button
                        className="absolute rounded-full flex items-center justify-center bg-cyan-900/80 border border-cyan-400 text-cyan-200 hover:bg-cyan-700 hover:text-white hover:scale-110 hover:shadow-[0_0_10px_cyan] transition-all z-[160] animate-in fade-in zoom-in duration-300"
                        style={{
                            left: undoX,
                            top: undoY,
                            width: satelliteSize,
                            height: satelliteSize,
                        }}
                        onPointerDown={(e) => { e.stopPropagation(); if (onModulationUndo) onModulationUndo(); }}
                        title="Undo Last Pivot"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '60%', height: '60%' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                    </button>

                    {/* Reset / Close Button */}
                    <button
                        className="absolute rounded-full flex items-center justify-center bg-red-900/80 border border-red-400 text-red-200 hover:bg-red-700 hover:text-white hover:scale-110 hover:shadow-[0_0_10px_red] transition-all z-[160] animate-in fade-in zoom-in duration-300"
                        style={{
                            left: resetX,
                            top: resetY,
                            width: satelliteSize,
                            height: satelliteSize,
                        }}
                        onPointerDown={(e) => { e.stopPropagation(); if (onModulationReset) onModulationReset(); }}
                        title="Clear Modulation (Reset to Root)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '60%', height: '60%' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </>
            )}

            {/* Modulation Main Button */}
            <button 
                className={`absolute rounded-full flex flex-col items-center justify-center font-bold uppercase tracking-wider backdrop-blur transition-all z-[150] select-none border-2 shadow-lg 
                    ${isModulationModeActive 
                        ? 'bg-cyan-600 text-white border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.5)]' 
                        : (showSatellites ? 'bg-cyan-900/60 text-cyan-200 border-cyan-500/80 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-cyan-900/40 text-cyan-400 border-cyan-500/50 hover:bg-cyan-800/60')
                    } ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                style={draggableStyle('mod')} 
                onPointerDown={(e) => handlePress(e, 'mod', onModulationToggle)}
                title="Modulation Mode (Click Node to Pivot)"
                aria-label="Toggle Modulation Mode"
            >
                <span className="leading-none">MOD</span>
                {showSatellites && (
                    <span className="text-[9px] opacity-80 leading-none mt-0.5 font-mono">{modulationPathLength}</span>
                )}
            </button>
        </>
    );
};

export default PerformanceControls;
