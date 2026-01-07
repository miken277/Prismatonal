
import React from 'react';
import { XYPos, UISize } from '../../types';

interface Props {
    volume: number;
    setVolume: (v: number) => void;
    spatialScale: number;
    setSpatialScale: (v: number) => void;
    brightness: number;
    setBrightness: (v: number) => void;
    viewZoom: number;
    setViewZoom: (v: number) => void;
    
    uiScale: number;
    uiUnlocked: boolean;
    position: XYPos;
    size: UISize;
    
    onDragStart: (e: React.PointerEvent) => void;
    onResize: (e: React.PointerEvent, axis: 'x' | 'y' | 'xy') => void;
}

const MasterControls: React.FC<Props> = ({
    volume, setVolume, spatialScale, setSpatialScale, brightness, setBrightness, viewZoom, setViewZoom,
    uiScale, uiUnlocked, position, size, onDragStart, onResize
}) => {
    
    const volumeBaseWidth = size?.width || 600;
    const volumeBaseHeight = size?.height || 75;
    const volumeBarWidth = volumeBaseWidth * uiScale;
    const volumeBarHeight = volumeBaseHeight * uiScale;

    const minRowHeight = 12 * uiScale;
    const totalMinHeight = (minRowHeight * 4) + (6 * uiScale) + (16 * uiScale);
    
    const labelStyle = { 
        fontSize: 20 * uiScale, 
        width: 85 * uiScale,
    };

    const sliderTrackHeight = 3 * uiScale;
    const resizeHandleStyle = "absolute z-50 bg-yellow-500/50 hover:bg-yellow-400 rounded-sm border border-white/50 shadow-sm transition-colors";

    return (
      <div 
        className={`absolute bg-slate-900/50 rounded-xl flex flex-col px-3 py-1 gap-0.5 backdrop-blur-sm border border-slate-700/50 transition-colors z-[150] shadow-lg ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
        style={{ 
            left: position.x,
            top: position.y,
            width: volumeBarWidth,
            height: Math.max(volumeBarHeight, totalMinHeight), 
            justifyContent: 'space-between', 
            padding: '8px 12px',
            touchAction: 'none'
        }}
        onPointerDown={onDragStart}
      >
        {/* Volume */}
        <div className="flex items-center gap-2 w-full flex-1 min-h-[12px] max-h-7">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Volume</span>
             <div className="flex-1 min-w-[50px] flex items-center pl-1">
                <input 
                    type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-green-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #22c55e 0%, #22c55e ${volume * 100}%, #1e293b ${volume * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                    aria-label="Master Volume"
                />
             </div>
        </div>

        {/* Reverb */}
        <div className="flex items-center gap-2 w-full flex-1 min-h-[12px] max-h-7">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Reverb</span>
             <div className="flex-1 min-w-[50px] flex items-center pl-1">
                <input 
                    type="range" min="0" max="2" step="0.01" value={spatialScale} onChange={(e) => setSpatialScale(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-blue-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(spatialScale/2) * 100}%, #1e293b ${(spatialScale/2) * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                    aria-label="Reverb Amount"
                />
             </div>
        </div>

        {/* Tone */}
        <div className="flex items-center gap-2 w-full flex-1 min-h-[12px] max-h-7">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Tone</span>
             <div className="flex-1 min-w-[50px] flex items-center pl-1">
                <input 
                    type="range" min="0" max="1" step="0.01" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} disabled={uiUnlocked}
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-yellow-500 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #eab308 0%, #eab308 ${brightness * 100}%, #1e293b ${brightness * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                    aria-label="Tone Brightness"
                />
             </div>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2 w-full flex-1 min-h-[12px] max-h-7">
             <span className="font-bold text-slate-400 select-none uppercase tracking-widest text-right flex-shrink-0" style={labelStyle}>Zoom</span>
             <div className="flex-1 min-w-[50px] flex items-center pl-1">
                <input 
                    type="range" min="0.5" max="3.0" step="0.05" value={viewZoom} onChange={(e) => setViewZoom(parseFloat(e.target.value))} disabled={uiUnlocked}
                    onDoubleClick={(e) => { e.stopPropagation(); setViewZoom(1.0); }}
                    title="Double-click to Reset Zoom"
                    className={`prismatonal-slider w-full rounded-lg appearance-none text-cyan-400 ${uiUnlocked ? 'cursor-move opacity-50' : 'cursor-pointer'}`}
                    style={{ height: sliderTrackHeight, background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${((viewZoom-0.5)/2.5) * 100}%, #1e293b ${((viewZoom-0.5)/2.5) * 100}%, #1e293b 100%)` }}
                    onPointerDown={(e) => !uiUnlocked && e.stopPropagation()} 
                    aria-label="View Zoom"
                />
             </div>
        </div>

        {/* Resize Handles */}
        {uiUnlocked && (
            <>
                <div className={`${resizeHandleStyle} cursor-ew-resize`} style={{ top: '10%', bottom: '10%', right: -6, width: 12 }} onPointerDown={(e) => onResize(e, 'x')} />
                <div className={`${resizeHandleStyle} cursor-ns-resize`} style={{ left: '10%', right: '10%', bottom: -6, height: 12 }} onPointerDown={(e) => onResize(e, 'y')} />
                <div className={`${resizeHandleStyle} cursor-nwse-resize bg-yellow-400`} style={{ right: -6, bottom: -6, width: 16, height: 16, borderRadius: '50%' }} onPointerDown={(e) => onResize(e, 'xy')} />
            </>
        )}
      </div>
    );
};

export default MasterControls;
