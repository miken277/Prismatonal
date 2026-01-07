
import React from 'react';
import { AppSettings, XYPos } from '../../types';

interface Props {
    showIncreaseDepthButton: boolean;
    uiUnlocked: boolean;
    uiScale: number;
    positions: AppSettings['uiPositions'];
    
    onCenter: () => void;
    onIncreaseDepth: () => void;
    onDecreaseDepth: () => void;
    onDragStart: (e: React.PointerEvent, key: keyof AppSettings['uiPositions']) => void;
}

const ViewControls: React.FC<Props> = ({
    showIncreaseDepthButton, uiUnlocked, uiScale, positions,
    onCenter, onIncreaseDepth, onDecreaseDepth, onDragStart
}) => {
    
    const baseSize = 80 * uiScale;

    const draggableStyle = (key: keyof AppSettings['uiPositions']) => ({
        left: positions[key].x,
        top: positions[key].y,
        width: baseSize,
        height: baseSize,
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

    return (
        <>
            <button 
                className={`absolute rounded bg-yellow-600/20 border-2 border-yellow-500 flex items-center justify-center text-yellow-500 font-bold backdrop-blur hover:bg-yellow-600/40 active:bg-yellow-600 active:text-white transition-all shadow-[0_0_15px_rgba(234,179,8,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                style={draggableStyle('center')} 
                onPointerDown={(e) => handlePress(e, 'center', onCenter)} 
                title="Center Display" 
                aria-label="Center View"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
            </button>

            {showIncreaseDepthButton && (
                <button 
                    className={`absolute rounded bg-blue-600/20 border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold backdrop-blur hover:bg-blue-600/40 active:bg-blue-600 active:text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                    style={draggableStyle('depth')} 
                    onPointerDown={(e) => handlePress(e, 'depth', onIncreaseDepth)} 
                    title="Increase Depth from Selection" 
                    aria-label="Increase Depth"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
            )}

            {showIncreaseDepthButton && (
                <button 
                    className={`absolute rounded bg-green-600/20 border-2 border-green-500 flex items-center justify-center text-green-500 font-bold backdrop-blur hover:bg-green-600/40 active:bg-green-600 active:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] z-[150] select-none ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`} 
                    style={draggableStyle('decreaseDepth')} 
                    onPointerDown={(e) => handlePress(e, 'decreaseDepth', onDecreaseDepth)} 
                    title="Decrease Depth" 
                    aria-label="Decrease Depth"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                </button>
            )}
        </>
    );
};

export default ViewControls;
