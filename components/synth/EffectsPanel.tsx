
import React from 'react';
import { SynthPreset, ReverbType } from '../../types';
import { REVERB_DEFAULTS } from '../../constants';

interface Props {
    preset: SynthPreset;
    isReverbEditable: boolean;
    onUpdate: (key: keyof SynthPreset, value: any) => void;
    onReverbTypeChange: (type: ReverbType) => void;
}

const EffectsPanel: React.FC<Props> = ({ preset, isReverbEditable, onUpdate, onReverbTypeChange }) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <h3 className="text-sm font-bold text-slate-300 uppercase mb-2">Global Effects</h3>
            
            {/* Master Gain & Performance */}
            <div className="bg-slate-900/50 p-3 rounded border border-slate-700 space-y-3">
                <div>
                    <label className="flex justify-between text-xs mb-1 font-bold text-slate-300"><span>Master Gain</span> <span>{(preset.gain * 100).toFixed(0)}%</span></label>
                    <input type="range" min="0.0" max="1.0" step="0.01" value={preset.gain} onChange={(e) => onUpdate('gain', parseFloat(e.target.value))} className="w-full h-1 bg-green-500 rounded appearance-none cursor-pointer" />
                </div>
                <div>
                    <label className="flex justify-between text-xs mb-1 font-bold text-slate-300"><span>Portamento (Glide)</span> <span>{((preset.portamento || 0) * 100).toFixed(0)}%</span></label>
                    <input type="range" min="0.0" max="1.0" step="0.01" value={preset.portamento || 0} onChange={(e) => onUpdate('portamento', parseFloat(e.target.value))} className="w-full h-1 bg-orange-500 rounded appearance-none cursor-pointer" />
                </div>
            </div>

            {/* Formant Filter Section */}
            <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                <h4 className="text-xs font-bold text-yellow-500 uppercase mb-3">Vocal Formant Filter</h4>
                <div className="space-y-3">
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300">
                            <span>Mix</span> 
                            <span>{((preset.formantStrength || 0) * 100).toFixed(0)}%</span>
                        </label>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.01" 
                            value={preset.formantStrength || 0} 
                            onChange={(e) => onUpdate('formantStrength', parseFloat(e.target.value))} 
                            className="w-full h-1 bg-yellow-600 rounded appearance-none cursor-pointer" 
                        />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300">
                            <span>Vowel</span> 
                            <span className="font-mono text-yellow-400 font-bold">
                                {['A', 'E', 'I', 'O', 'U'][Math.min(4, Math.floor((preset.vowel || 0) * 5))]}
                            </span>
                        </label>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.01" 
                            value={preset.vowel || 0} 
                            onChange={(e) => onUpdate('vowel', parseFloat(e.target.value))} 
                            className="w-full h-1 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 rounded appearance-none cursor-pointer" 
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 mt-1 uppercase font-bold px-1">
                            <span>A</span><span>E</span><span>I</span><span>O</span><span>U</span>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-600/50 mt-2">
                        <label className="flex justify-between text-xs mb-1 text-slate-300">
                            <span>Breath / Noise Gain</span> 
                            {/* Display with 1 decimal place for fine tuning */}
                            <span>{((preset.noiseGain !== undefined ? preset.noiseGain : (preset.aspirationGain || 0)) * 100).toFixed(1)}%</span>
                        </label>
                        <input 
                            type="range" 
                            min="0" 
                            max="0.25" // Lower max to allow fine control of subtle noise (0.6% etc)
                            step="0.001" // Fine steps
                            value={preset.noiseGain !== undefined ? preset.noiseGain : (preset.aspirationGain || 0)} 
                            onChange={(e) => onUpdate('noiseGain', parseFloat(e.target.value))} 
                            className="w-full h-1 bg-slate-500 rounded appearance-none cursor-pointer" 
                        />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300">
                            <span>Noise Filter Cutoff</span> 
                            <span>{(preset.noiseCutoff || preset.aspirationCutoff || 2000).toFixed(0)} Hz</span>
                        </label>
                        <input 
                            type="range" 
                            min="500" 
                            max="8000" 
                            step="100" 
                            value={preset.noiseCutoff || preset.aspirationCutoff || 2000} 
                            onChange={(e) => onUpdate('noiseCutoff', parseFloat(e.target.value))} 
                            className="w-full h-1 bg-slate-600 rounded appearance-none cursor-pointer" 
                        />
                    </div>
                </div>
            </div>

            {/* Stereo */}
            <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                <h4 className="text-xs font-bold text-blue-400 uppercase mb-3">Stereo Field</h4>
                <div className="space-y-3">
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Spread</span> <span>{((preset.spread || 0) * 100).toFixed(0)}%</span></label>
                        <input type="range" min="0" max="1" step="0.01" value={preset.spread || 0} onChange={(e) => onUpdate('spread', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Auto Pan Rate</span> <span>{(preset.stereoPanSpeed || 0).toFixed(2)} Hz</span></label>
                        <input type="range" min="0" max="10" step="0.1" value={preset.stereoPanSpeed || 0} onChange={(e) => onUpdate('stereoPanSpeed', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Auto Pan Depth</span> <span>{((preset.stereoPanDepth || 0) * 100).toFixed(0)}%</span></label>
                        <input type="range" min="0" max="1" step="0.01" value={preset.stereoPanDepth || 0} onChange={(e) => onUpdate('stereoPanDepth', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none cursor-pointer" />
                    </div>
                </div>
            </div>

            {/* Reverb */}
            <div className={`bg-slate-900/50 p-3 rounded border border-slate-700 transition-opacity ${!isReverbEditable ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase">Reverb</h4>
                    {!isReverbEditable && <span className="text-[9px] text-slate-500 uppercase bg-slate-800 px-1 rounded">Global Only</span>}
                </div>
                
                <div className="flex bg-slate-800 rounded border border-slate-600 overflow-hidden mb-3">
                    {(['room', 'hall', 'cathedral', 'plate', 'shimmer'] as ReverbType[]).map(type => (
                        <button 
                            key={type} 
                            onClick={() => onReverbTypeChange(type)}
                            className={`flex-1 py-1 text-[8px] uppercase font-bold ${preset.reverbType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Mix</span> <span>{(preset.reverbMix * 100).toFixed(0)}%</span></label>
                        <input type="range" min="0" max="1" step="0.01" value={preset.reverbMix} onChange={(e) => onUpdate('reverbMix', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Size</span> <span>{preset.reverbSize?.toFixed(1)}s</span></label>
                        <input type="range" min="0.1" max="10" step="0.1" value={preset.reverbSize || 2.0} onChange={(e) => onUpdate('reverbSize', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Damping</span> <span>{((preset.reverbDamping || 0) * 100).toFixed(0)}%</span></label>
                        <input type="range" min="0" max="1" step="0.01" value={preset.reverbDamping || 0.5} onChange={(e) => onUpdate('reverbDamping', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none cursor-pointer" />
                    </div>
                </div>
            </div>

            {/* Delay */}
            <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                <h4 className="text-xs font-bold text-teal-400 uppercase mb-3">Delay</h4>
                <div className="space-y-3">
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Mix</span> <span>{(preset.delayMix * 100).toFixed(0)}%</span></label>
                        <input type="range" min="0" max="1" step="0.01" value={preset.delayMix} onChange={(e) => onUpdate('delayMix', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Time</span> <span>{preset.delayTime.toFixed(2)}s</span></label>
                        <input type="range" min="0.01" max="2.0" step="0.01" value={preset.delayTime} onChange={(e) => onUpdate('delayTime', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Feedback</span> <span>{(preset.delayFeedback * 100).toFixed(0)}%</span></label>
                        <input type="range" min="0" max="0.95" step="0.01" value={preset.delayFeedback} onChange={(e) => onUpdate('delayFeedback', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none cursor-pointer" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EffectsPanel;
