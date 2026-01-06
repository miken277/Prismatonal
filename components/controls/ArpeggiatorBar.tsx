
import React, { useState } from 'react';
import { ArpeggioDefinition, ArpeggioStep, ArpConfig, ArpDivision } from '../../types';
import { DEFAULT_COLORS } from '../../constants';
import { getMaxPrime } from '../../services/LatticeService';

interface Props {
    arpeggios: ArpeggioDefinition[];
    arpBpm: number;
    onArpToggle?: (id: string) => void;
    onArpBpmChange?: (bpm: number) => void;
    onArpRowConfigChange?: (arpId: string, config: Partial<ArpConfig>) => void;
    onArpPatternUpdate?: (arpId: string, steps: ArpeggioStep[]) => void;
    recordingArpId?: string | null;
    currentArpStep?: number;
    recordingFlash?: number;
    onPlayAll?: () => void;
    onStopAll?: () => void;
    isSequencerOpen: boolean;
    onToggleSequencer: () => void;
    
    // UI Props
    uiScale: number;
    position: { x: number, y: number };
    isConstrained: boolean;
    width: number;
    onDragStart: (e: React.PointerEvent) => void;
    isFlashingRed: boolean;
    uiUnlocked: boolean;
}

const ArpeggiatorBar: React.FC<Props> = ({
    arpeggios, arpBpm, onArpToggle, onArpBpmChange, onArpRowConfigChange, onArpPatternUpdate,
    recordingArpId, currentArpStep, onPlayAll, onStopAll,
    isSequencerOpen, onToggleSequencer,
    uiScale, position, isConstrained, width, onDragStart, isFlashingRed, uiUnlocked
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const isAnyArpPlaying = arpeggios.some(a => a.isPlaying);

    const getBpmLightClass = () => {
        if (isFlashingRed) return 'bg-red-500 shadow-[0_0_10px_red]';
        if (isAnyArpPlaying) {
            const tick = Math.floor(Date.now() / (30000 / (arpBpm || 120)));
            return tick % 2 === 0 ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-slate-800';
        }
        return 'bg-slate-800';
    };

    const handleStepClick = (e: React.MouseEvent | React.TouchEvent, arpId: string, stepIndex: number) => {
        const arp = arpeggios.find(a => a.id === arpId);
        if (!arp || !onArpPatternUpdate) return;
        
        if (stepIndex < arp.steps.length) {
            const step = arp.steps[stepIndex];
            const newSteps = [...arp.steps];
            newSteps[stepIndex] = { ...step, muted: !step.muted };
            onArpPatternUpdate(arpId, newSteps);
        }
    };

    const handleStepRightClick = (e: React.MouseEvent, arpId: string, stepIndex: number) => {
        e.preventDefault();
        const arp = arpeggios.find(a => a.id === arpId);
        if (!arp || !onArpPatternUpdate) return;
        
        if (stepIndex < arp.steps.length) {
            const newSteps = [...arp.steps];
            newSteps.splice(stepIndex, 1);
            onArpPatternUpdate(arpId, newSteps);
        }
    };

    const handleClearPattern = (arpId: string) => {
        if (onArpPatternUpdate) {
            onArpPatternUpdate(arpId, []);
        }
    };

    return (
        <div 
            className={`absolute bg-slate-900/50 rounded-xl flex flex-col items-center backdrop-blur-sm border border-slate-700/50 transition-colors z-[150] shadow-2xl ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50' : ''}`}
            style={{ 
                left: position.x,
                top: position.y,
                width: width,
                padding: `3px ${8 * uiScale}px`, // Reduced padding to 3px
                height: 'auto',
                touchAction: 'none'
            }}
            onPointerDown={onDragStart}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
        >
            <div className="w-full flex flex-col gap-2">
                 {/* Top Row: Label + Controls (Wraps if narrow) */}
                 <div className="flex flex-wrap items-center justify-between gap-y-2 px-1">
                     <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mr-2 flex-shrink-0">ARPEGGIATOR</span>
    
                     <div className="flex items-center gap-2 flex-shrink-0">
                         <div className="flex items-center bg-slate-800/50 rounded border border-slate-700/50 overflow-hidden h-5">
                            <button 
                                className="px-1.5 hover:bg-slate-700 active:bg-slate-600 text-slate-400 hover:text-white transition-colors border-r border-slate-700/30 flex items-center justify-center h-full"
                                onPointerDown={(e) => { e.stopPropagation(); onArpBpmChange && onArpBpmChange(Math.max(1, (arpBpm || 120) - 1)); }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <input 
                                type="number" 
                                value={arpBpm} 
                                onChange={(e) => onArpBpmChange && onArpBpmChange(parseInt(e.target.value))}
                                className="w-8 bg-transparent text-center text-[10px] font-mono font-bold text-slate-300 focus:outline-none focus:text-white no-spinner h-full"
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                            <button 
                                className="px-1.5 hover:bg-slate-700 active:bg-slate-600 text-slate-400 hover:text-white transition-colors border-l border-slate-700/30 flex items-center justify-center h-full"
                                onPointerDown={(e) => { e.stopPropagation(); onArpBpmChange && onArpBpmChange(Math.min(300, (arpBpm || 120) + 1)); }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                         </div>
                         
                         <div className={`w-2 h-2 rounded-full transition-colors duration-100 ${getBpmLightClass()}`}></div>
                         <span className="text-[9px] text-slate-500 font-bold">BPM</span>
                     </div>
                 </div>
    
                 {/* Button Grid - Start Aligned to handle wrapping cleanly */}
                 <div className="flex gap-1.5 flex-wrap w-full justify-start">
                     {arpeggios.map(arp => {
                         const isRecordingArp = recordingArpId === arp.id;
                         const isPlaying = arp.isPlaying;
                         const hasData = arp.steps.length > 0;
                         
                         let btnClass = "bg-slate-800/80 border-slate-600 text-slate-400";
                         if (isRecordingArp) btnClass = "bg-red-900/80 border-red-500 text-white animate-pulse shadow-[0_0_10px_red]";
                         else if (isPlaying) btnClass = "bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_blue]";
                         else if (hasData) btnClass = "bg-slate-700 border-blue-500/30 text-blue-200";
    
                         const showGreenDot = isPlaying && !isHovered && !isRecordingArp;
    
                         return (
                             <button 
                                key={arp.id}
                                className={`rounded flex items-center justify-center font-bold border-2 transition-all hover:scale-105 active:scale-95 ${btnClass}`}
                                style={{ width: 34 * uiScale, height: 34 * uiScale, fontSize: 12 * uiScale, flexShrink: 0 }}
                                onPointerDown={(e) => { e.stopPropagation(); if(onArpToggle) onArpToggle(arp.id); }}
                             >
                                 {showGreenDot ? (
                                     <div className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]"></div>
                                 ) : (
                                     arp.id
                                 )}
                             </button>
                         );
                     })}
                 </div>
            </div>
            
            <button 
                className="w-full h-4 mt-1 bg-slate-800/50 hover:bg-slate-700/50 rounded flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
                onPointerDown={(e) => { e.stopPropagation(); onToggleSequencer(); }}
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 text-slate-400 transition-transform ${isSequencerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                 </svg>
            </button>
            
            {isSequencerOpen && (
                <div 
                    className="absolute left-0 top-full mt-2 bg-slate-950/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 z-[160] flex flex-col gap-3"
                    style={{ 
                        width: '350px', 
                        height: '350px', 
                        minWidth: '350px',
                        minHeight: '230px',
                        maxWidth: 'calc(100vw - 40px)',
                        maxHeight: '90vh',
                        resize: 'both',
                        overflow: 'hidden' 
                    }}
                    onPointerDown={(e) => e.stopPropagation()} 
                >
                    <div className="flex justify-between items-center pb-1 border-b border-white/10 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pattern Matrix</span>
                        <div className="flex gap-2">
                            {onPlayAll && (
                                <button 
                                    className="text-[10px] font-bold bg-green-900/50 hover:bg-green-700 text-green-400 hover:text-white px-2 py-0.5 rounded border border-green-700 transition-colors"
                                    onPointerDown={(e) => { e.stopPropagation(); onPlayAll(); }}
                                >
                                    PLAY ALL
                                </button>
                            )}
                            {onStopAll && (
                                <button 
                                    className="text-[10px] font-bold bg-red-900/50 hover:bg-red-700 text-red-400 hover:text-white px-2 py-0.5 rounded border border-red-700 transition-colors"
                                    onPointerDown={(e) => { 
                                        e.stopPropagation(); 
                                        onStopAll(); 
                                    }}
                                >
                                    STOP ALL
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-900/30 rounded-lg border border-slate-800 seq-scroll p-1 min-h-0">
                        {arpeggios.map((arp) => {
                            const isPlaying = arp.isPlaying;
                            const config = arp.config || { direction: 'order', division: '1/8', octaves: 1, gate: 0.8, swing: 0, length: 8 };
                            const patternLength = config.length;
                            
                            const steps = Array.from({ length: patternLength }, (_, i) => {
                                if (arp.steps.length > i) return arp.steps[i]; 
                                return null;
                            });
    
                            return (
                                <div key={arp.id} className="flex flex-col mb-2 bg-slate-800/20 rounded border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-2 p-1 border-b border-white/5 bg-slate-800/40 rounded-t">
                                        <button 
                                            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${isPlaying ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'}`}
                                            onPointerDown={(e) => { e.stopPropagation(); if(onArpToggle) onArpToggle(arp.id); }}
                                        >
                                            {arp.id}
                                        </button>
                                        
                                        <div className="flex items-center gap-1 bg-slate-900/50 rounded px-1 border border-slate-700/50">
                                            <span className="text-[8px] font-bold text-slate-500 uppercase">Len</span>
                                            <button className="text-[10px] text-slate-400 hover:text-white" onPointerDown={(e) => {e.stopPropagation(); onArpRowConfigChange && onArpRowConfigChange(arp.id, {length: Math.max(1, config.length - 1)})}}>-</button>
                                            <span className="text-[9px] font-mono w-3 text-center text-slate-300">{config.length}</span>
                                            <button className="text-[10px] text-slate-400 hover:text-white" onPointerDown={(e) => {e.stopPropagation(); onArpRowConfigChange && onArpRowConfigChange(arp.id, {length: Math.min(32, config.length + 1)})}}>+</button>
                                        </div>
    
                                        <div className="flex items-center gap-1 bg-slate-900/50 rounded px-1 border border-slate-700/50">
                                            <span className="text-[8px] font-bold text-slate-500 uppercase">Div</span>
                                            <select 
                                                value={config.division}
                                                onChange={(e) => onArpRowConfigChange && onArpRowConfigChange(arp.id, { division: e.target.value as ArpDivision })}
                                                className="h-4 text-[9px] bg-transparent text-slate-300 font-mono focus:outline-none cursor-pointer"
                                            >
                                                {(['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'] as ArpDivision[]).map(div => (
                                                    <option key={div} value={div}>{div}</option>
                                                ))}
                                            </select>
                                        </div>
    
                                        <div className="flex items-center gap-1 bg-slate-900/50 rounded px-1 border border-slate-700/50">
                                            <span className="text-[8px] font-bold text-slate-500 uppercase">Gate</span>
                                            <button className="text-[10px] text-slate-400 hover:text-white" onPointerDown={(e) => {e.stopPropagation(); onArpRowConfigChange && onArpRowConfigChange(arp.id, {gate: Math.max(0.1, config.gate - 0.1)})}}>-</button>
                                            <span className="text-[9px] font-mono w-5 text-center text-slate-300">{(config.gate*100).toFixed(0)}</span>
                                            <button className="text-[10px] text-slate-400 hover:text-white" onPointerDown={(e) => {e.stopPropagation(); onArpRowConfigChange && onArpRowConfigChange(arp.id, {gate: Math.min(1.0, config.gate + 0.1)})}}>+</button>
                                        </div>
    
                                        <div className="flex-1"></div>
                                        
                                        <button
                                            className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                                            title="Clear Pattern"
                                            onPointerDown={(e) => { e.stopPropagation(); handleClearPattern(arp.id); }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
    
                                    <div className="flex gap-1 overflow-x-auto seq-scroll p-1 items-center h-10 w-full">
                                        {steps.map((step, idx) => {
                                            const isCurrent = isPlaying && idx === (currentArpStep || 0) % patternLength;
                                            const hasData = step !== null;
                                            const isMuted = step?.muted;
                                            
                                            const borderColor = hasData ? 'border-blue-500' : 'border-slate-700';
                                            const bgColor = isCurrent ? 'bg-slate-600' : (hasData && isMuted ? 'bg-slate-900' : 'bg-slate-800/80');
                                            const textColor = hasData ? (isMuted ? 'text-slate-600' : 'text-blue-200') : 'text-slate-600';
                                            
                                            const limitN = hasData ? getMaxPrime(step.n || 1) : 1;
                                            const limitD = hasData ? getMaxPrime(step.d || 1) : 1;
                                            
                                            const colorN = DEFAULT_COLORS[limitN as keyof typeof DEFAULT_COLORS] || '#fff';
                                            const colorD = DEFAULT_COLORS[limitD as keyof typeof DEFAULT_COLORS] || '#fff';
    
                                            const squareStyle = hasData ? {
                                                background: `linear-gradient(135deg, ${colorN} 50%, ${colorD} 50%)`
                                            } : {};
    
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={`flex-shrink-0 w-8 h-8 rounded border flex items-center justify-center transition-all m-0.5 cursor-pointer relative overflow-hidden
                                                        ${!hasData ? bgColor : ''} ${borderColor} ${isCurrent ? 'shadow-lg scale-110 z-10 border-white' : ''} 
                                                        ${hasData ? 'hover:border-white' : ''}
                                                    `}
                                                    style={squareStyle}
                                                    title={hasData ? `Ratio: ${step?.n}/${step?.d} (Left: Toggle Mute, Right: Delete)` : `Step ${idx+1}`}
                                                    onPointerDown={(e) => e.stopPropagation()} 
                                                    onClick={(e) => hasData && handleStepClick(e, arp.id, idx)}
                                                    onContextMenu={(e) => hasData && handleStepRightClick(e, arp.id, idx)}
                                                >
                                                    {hasData ? (
                                                        <div className={`w-full h-full relative ${isMuted ? 'opacity-30 grayscale' : ''}`}>
                                                            <span className="absolute top-0.5 left-1 text-[9px] font-bold text-white leading-none drop-shadow-md shadow-black">
                                                                {step?.n}
                                                            </span>
                                                            <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-white leading-none drop-shadow-md shadow-black">
                                                                {step?.d}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className={`text-[10px] font-mono ${textColor} select-none`}>{idx+1}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
    
                    <div className="flex justify-between items-center relative mt-1 flex-shrink-0">
                         <div className="flex items-center gap-2">
                             {recordingArpId && (
                                 <span className="text-[10px] text-red-400 animate-pulse">Rec: {recordingArpId}</span>
                             )}
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArpeggiatorBar;
