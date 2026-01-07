
import React from 'react';
import { AppSettings, ChordDefinition } from '../../types';

interface Props {
    savedChords: ChordDefinition[];
    activeChordIds: string[];
    chordShortcutSizeScale: number;
    uiUnlocked: boolean;
    uiScale: number;
    position: { x: number, y: number };
    
    onAddChord: () => void;
    toggleChord: (id: string) => void;
    onRemoveChord?: (id: string) => void;
    onDragStart: (e: React.PointerEvent, key: keyof AppSettings['uiPositions']) => void;
}

const ChordBar: React.FC<Props> = ({
    savedChords, activeChordIds, chordShortcutSizeScale, uiUnlocked, uiScale, position,
    onAddChord, toggleChord, onRemoveChord, onDragStart
}) => {
    
    const baseSize = 80 * uiScale;
    const chordSize = baseSize * chordShortcutSizeScale;

    const handlePress = (e: React.PointerEvent, action?: () => void) => {
        e.stopPropagation();
        if (uiUnlocked) {
            onDragStart(e, 'chords');
        } else {
            if (e.button === 0 && action) action();
        }
    };

    return (
        <div 
            className={`absolute flex items-center gap-2 z-[150] transition-all ${uiUnlocked ? 'cursor-move ring-2 ring-yellow-500/50 rounded-xl p-1 bg-slate-900/20 border border-white/10' : ''}`} 
            style={{ 
                left: position.x, 
                top: position.y,
                touchAction: 'none'
            }} 
            onPointerDown={(e) => handlePress(e, onAddChord)}
        >
            <button 
                className="rounded bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center text-indigo-500 font-bold backdrop-blur hover:bg-indigo-600/40 active:bg-indigo-600 active:text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] select-none" 
                style={{ width: baseSize, height: baseSize }} 
                title="Store Current Chord" 
                aria-label="Add Chord"
                // Click is handled by parent container's onPointerDown logic for unified drag/click behavior
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: baseSize * 0.5, height: baseSize * 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>
            
            {!uiUnlocked && savedChords.filter(c => c.visible).map((chord) => {
                const isActive = activeChordIds.includes(chord.id);
                return (
                    <div key={chord.id} className="flex flex-col items-center gap-1 group">
                        <button 
                            className={`rounded border-2 flex items-center justify-center font-bold backdrop-blur transition-all shadow-lg select-none ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.8)] scale-110' : 'bg-slate-800/60 border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400'}`} 
                            style={{ width: chordSize, height: chordSize, fontSize: 14 * uiScale }} 
                            onPointerDown={(e) => { e.stopPropagation(); toggleChord(chord.id); }} 
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if(onRemoveChord) onRemoveChord(chord.id); }}
                        >
                            {chord.label}
                        </button>
                        <button
                            className="text-slate-600 hover:text-red-400 transition-colors p-1 opacity-60 hover:opacity-100"
                            onPointerDown={(e) => { e.stopPropagation(); if(onRemoveChord) onRemoveChord(chord.id); }}
                            title="Delete Chord"
                            aria-label="Delete Chord"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default ChordBar;
