
import React, { useState } from 'react';
import { ModulationRow, ModSource, ModTarget } from '../../types';

interface Props {
    modMatrix: ModulationRow[];
    onChange: (newMatrix: ModulationRow[]) => void;
}

const MATRIX_SOURCES: { id: ModSource, label: string }[] = [
    { id: 'lfo1', label: 'LFO 1' },
    { id: 'lfo2', label: 'LFO 2' },
    { id: 'lfo3', label: 'LFO 3' },
    { id: 'env1', label: 'ENV 1' },
    { id: 'env2', label: 'ENV 2' },
    { id: 'env3', label: 'ENV 3' },
];

const MATRIX_TARGETS: { id: ModTarget, label: string, short: string }[] = [
    { id: 'osc1_pitch', label: 'Pitch 1', short: 'P1' },
    { id: 'osc1_cutoff', label: 'Cutoff 1', short: 'C1' },
    { id: 'osc1_gain', label: 'Gain 1', short: 'G1' },
    { id: 'osc1_res', label: 'Res 1', short: 'Q1' },
    { id: 'osc2_pitch', label: 'Pitch 2', short: 'P2' },
    { id: 'osc2_cutoff', label: 'Cutoff 2', short: 'C2' },
    { id: 'osc2_gain', label: 'Gain 2', short: 'G2' },
    { id: 'osc2_res', label: 'Res 2', short: 'Q2' },
    { id: 'osc3_pitch', label: 'Pitch 3', short: 'P3' },
    { id: 'osc3_cutoff', label: 'Cutoff 3', short: 'C3' },
    { id: 'osc3_gain', label: 'Gain 3', short: 'G3' },
    { id: 'osc3_res', label: 'Res 3', short: 'Q3' },
];

const ModMatrixPanel: React.FC<Props> = ({ modMatrix, onChange }) => {
    const [draggingCell, setDraggingCell] = useState<{ source: ModSource, target: ModTarget, startY: number, startVal: number } | null>(null);

    const getMatrixValue = (source: ModSource, target: ModTarget) => {
        const row = modMatrix.find(r => r.source === source && r.target === target);
        return row ? row.amount : 0;
    };

    const updateMatrixValue = (source: ModSource, target: ModTarget, amount: number) => {
        let newMatrix = [...modMatrix];
        const existingIdx = newMatrix.findIndex(r => r.source === source && r.target === target);
        
        if (amount === 0) {
            if (existingIdx !== -1) newMatrix.splice(existingIdx, 1);
        } else {
            if (existingIdx !== -1) {
                newMatrix[existingIdx] = { ...newMatrix[existingIdx], amount, enabled: true };
            } else {
                newMatrix.push({ id: `${source}-${target}-${Date.now()}`, enabled: true, source, target, amount });
            }
        }
        onChange(newMatrix);
    };

    const handleDragStart = (e: React.PointerEvent, source: ModSource, target: ModTarget) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraggingCell({ source, target, startY: e.clientY, startVal: getMatrixValue(source, target) });
    };

    const handleDragMove = (e: React.PointerEvent) => {
        if (!draggingCell) return;
        
        const deltaY = draggingCell.startY - e.clientY; 
        let newVal = draggingCell.startVal + (deltaY * 1); // Sensitivity
        newVal = Math.max(-100, Math.min(100, Math.round(newVal)));
        
        if (newVal !== getMatrixValue(draggingCell.source, draggingCell.target)) {
            updateMatrixValue(draggingCell.source, draggingCell.target, newVal);
        }
    };

    const handlePointerUp = () => {
        setDraggingCell(null);
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300" onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onPointerMove={handleDragMove}>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-purple-300 uppercase">Modulation Grid</h3>
                <div className="text-[10px] text-slate-500 italic flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" /></svg>
                    <span>Drag vertically on cells to adjust</span>
                </div>
            </div>
            
            <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700">
                <div className="min-w-[600px]">
                    <div className="grid grid-cols-[60px_repeat(12,1fr)] gap-1">
                        <div className="text-[10px] font-bold text-slate-500 flex items-end justify-center pb-1">SRC \ DST</div>
                        
                        {MATRIX_TARGETS.map(t => (
                            <div key={t.id} className="text-[9px] font-bold text-slate-400 text-center uppercase whitespace-nowrap overflow-hidden text-ellipsis flex flex-col justify-end pb-1" title={t.label}>
                                {t.short}
                            </div>
                        ))}

                        {MATRIX_SOURCES.map(source => (
                            <React.Fragment key={source.id}>
                                <div className="text-[10px] font-bold text-purple-400 flex items-center h-8 bg-slate-900/50 px-1 rounded-l border-l border-y border-slate-800">
                                    {source.label}
                                </div>
                                {MATRIX_TARGETS.map(target => {
                                    const amount = getMatrixValue(source.id, target.id);
                                    const isActive = amount !== 0;
                                    const isDraggingThis = draggingCell && draggingCell.source === source.id && draggingCell.target === target.id;
                                    
                                    let cellClass = "bg-slate-800 hover:bg-slate-700 border-slate-700";
                                    if (isActive) cellClass = "bg-purple-900/30 border-purple-500/50";
                                    if (isDraggingThis) cellClass = "bg-purple-800/50 border-white";

                                    return (
                                        <div 
                                            key={`${source.id}-${target.id}`} 
                                            className={`h-8 border rounded flex flex-col justify-end items-center relative overflow-hidden cursor-ns-resize group select-none transition-colors ${cellClass}`}
                                            onPointerDown={(e) => handleDragStart(e, source.id, target.id)}
                                        >
                                            {isActive && (
                                                <div 
                                                    className={`absolute bottom-0 left-0 w-full transition-all duration-75 ${amount > 0 ? 'bg-purple-500' : 'bg-orange-500'}`} 
                                                    style={{ height: `${Math.abs(amount)}%`, opacity: 0.4 }} 
                                                />
                                            )}
                                            <span className={`text-[9px] z-10 font-mono relative ${isActive ? 'text-white font-bold' : 'text-transparent group-hover:text-slate-500'}`}>
                                                {amount !== 0 ? amount : '-'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModMatrixPanel;
