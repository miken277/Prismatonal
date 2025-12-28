
import React from 'react';
import { OscillatorConfig, WaveformType } from '../../types';

// Envelope Graph Component
const EnvelopeGraph = ({ attack, decay, sustain, release }: { attack: number, decay: number, sustain: number, release: number }) => {
    const width = 200;
    const height = 60;
    const pad = 2;
    // Non-linear time scaling for better visual representation of short vs long times
    const scaleTime = (t: number) => Math.min(width / 3, Math.pow(t, 0.5) * 30);
    
    const xA = pad + scaleTime(attack);
    const xD = xA + scaleTime(decay);
    const xS = xD + 30; // Fixed visual width for sustain hold
    const xR = xS + scaleTime(release);
    
    const yBase = height - pad;
    const yPeak = pad;
    const ySus = yBase - (sustain * (height - 2 * pad));
    
    const path = `M ${pad} ${yBase} L ${xA} ${yPeak} L ${xD} ${ySus} L ${xS} ${ySus} L ${xR} ${yBase}`;

    return (
        <div className="w-full bg-slate-900 rounded border border-slate-700 h-[60px] overflow-hidden relative">
            <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(width, xR + 10)} ${height}`} className="absolute top-0 left-0" preserveAspectRatio="none">
                <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <path d={`${path} L ${xR} ${height} L ${pad} ${height} Z`} fill="rgba(99, 102, 241, 0.2)" stroke="none" />
            </svg>
            <div className="absolute bottom-1 right-2 text-[8px] text-slate-500 pointer-events-none font-bold tracking-wider">ADSR</div>
        </div>
    );
};

interface Props {
    label: string;
    config: OscillatorConfig;
    isPrimary?: boolean; // Osc 1 is primary and usually cannot be disabled
    onUpdate: (key: keyof OscillatorConfig, value: any) => void;
}

const OscillatorPanel: React.FC<Props> = ({ label, config, isPrimary = false, onUpdate }) => {
    const canToggle = !isPrimary;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase">{label} Settings</h3>
                {canToggle && (
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 px-3 py-1 rounded border border-slate-600 transition-colors hover:bg-slate-800">
                        <input type="checkbox" checked={config.enabled} onChange={(e) => onUpdate('enabled', e.target.checked)} className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                        <span className={`text-xs font-bold ${config.enabled ? 'text-white' : 'text-slate-500'}`}>{config.enabled ? 'ENABLED' : 'DISABLED'}</span>
                    </label>
                )}
            </div>
            
            <div className={`space-y-6 transition-opacity duration-200 ${!config.enabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                {/* Core Tone */}
                <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                    <div className="grid grid-cols-4 gap-1 mb-4">
                        {Object.values(WaveformType).map(w => (
                            <button 
                                key={w} 
                                onClick={() => onUpdate('waveform', w)} 
                                className={`px-1 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${config.waveform === w ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
                            >
                                {w}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="flex justify-between text-xs mb-1 font-semibold text-slate-300"><span>Mix</span> <span>{(config.gain * 100).toFixed(0)}%</span></label>
                            <input type="range" min="0" max="1" step="0.01" value={config.gain} onChange={(e) => onUpdate('gain', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1 font-semibold text-slate-300"><span>Coarse Tune</span> <span>{config.coarseDetune} cents</span></label>
                            <input type="range" min="-1200" max="1200" step="10" value={config.coarseDetune} onChange={(e) => onUpdate('coarseDetune', parseInt(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1 font-semibold text-slate-300"><span>Fine Tune</span> <span>{config.fineDetune} cents</span></label>
                            <input type="range" min="-50" max="50" step="1" value={config.fineDetune} onChange={(e) => onUpdate('fineDetune', parseInt(e.target.value))} className="w-full h-1 bg-indigo-400 rounded appearance-none cursor-pointer" />
                        </div>
                    </div>
                </div>

                {/* Filter */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-wide">Filter</h4>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Cutoff</span> <span>{config.filterCutoff}Hz</span></label>
                        <input type="range" min="20" max="10000" step="10" value={config.filterCutoff} onChange={(e) => onUpdate('filterCutoff', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Resonance</span> <span>{config.filterResonance.toFixed(1)}</span></label>
                        <input type="range" min="0" max="20" step="0.1" value={config.filterResonance} onChange={(e) => onUpdate('filterResonance', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none cursor-pointer" />
                    </div>
                </div>

                {/* Envelope */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Envelope (ADSR)</h4>
                    <EnvelopeGraph attack={config.attack} decay={config.decay} sustain={config.sustain} release={config.release} />
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div><label className="flex justify-between text-xs mb-1 text-slate-400"><span>A: {config.attack.toFixed(2)}s</span></label><input type="range" min="0.01" max="5.0" step="0.01" value={config.attack} onChange={(e) => onUpdate('attack', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none cursor-pointer" /></div>
                        <div><label className="flex justify-between text-xs mb-1 text-slate-400"><span>D: {config.decay.toFixed(2)}s</span></label><input type="range" min="0.01" max="5.0" step="0.01" value={config.decay} onChange={(e) => onUpdate('decay', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none cursor-pointer" /></div>
                        <div><label className="flex justify-between text-xs mb-1 text-slate-400"><span>S: {config.sustain.toFixed(2)}</span></label><input type="range" min="0.0" max="1.0" step="0.01" value={config.sustain} onChange={(e) => onUpdate('sustain', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none cursor-pointer" /></div>
                        <div><label className="flex justify-between text-xs mb-1 text-slate-400"><span>R: {config.release.toFixed(2)}s</span></label><input type="range" min="0.01" max="8.0" step="0.01" value={config.release} onChange={(e) => onUpdate('release', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none cursor-pointer" /></div>
                    </div>
                </div>

                {/* LFO */}
                <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                    <h3 className="text-xs font-bold text-pink-400 uppercase mb-3">LFO</h3>
                    <div className="flex gap-2 mb-4 text-[10px]">
                        {(['none', 'pitch', 'filter', 'tremolo'] as const).map(target => (
                             <button key={target} onClick={() => onUpdate('lfoTarget', target)} className={`flex-1 py-1 rounded border capitalize font-bold transition-colors ${config.lfoTarget === target ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>{target}</button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div><label className="flex justify-between text-xs mb-1 text-slate-300"><span>Rate</span> <span>{config.lfoRate} Hz</span></label><input type="range" min="0.1" max="20" step="0.1" value={config.lfoRate} onChange={(e) => onUpdate('lfoRate', parseFloat(e.target.value))} className="w-full h-1 bg-pink-500 rounded appearance-none cursor-pointer" /></div>
                        <div><label className="flex justify-between text-xs mb-1 text-slate-300"><span>Depth</span> <span>{config.lfoDepth}</span></label><input type="range" min="0" max="100" step="1" value={config.lfoDepth} onChange={(e) => onUpdate('lfoDepth', parseFloat(e.target.value))} className="w-full h-1 bg-pink-500 rounded appearance-none cursor-pointer" /></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OscillatorPanel;
