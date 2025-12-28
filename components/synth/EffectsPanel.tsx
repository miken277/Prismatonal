
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
            
            {/* Master Gain */}
            <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                <label className="flex justify-between text-xs mb-1 font-bold text-slate-300"><span>Master Gain</span> <span>{(preset.gain * 100).toFixed(0)}%</span></label>
                <input type="range" min="0.0" max="1.0" step="0.01" value={preset.gain} onChange={(e) => onUpdate('gain', parseFloat(e.target.value))} className="w-full h-1 bg-green-500 rounded appearance-none cursor-pointer" />
            </div>

            {/* Stereo */}
            <div className="p-3 bg-slate-900/50 rounded border border-slate-700 space-y-4">
                 <h3 className="text-xs font-bold text-cyan-300 uppercase">Stereo & Pan</h3>
                 <div>
                     <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Stereo Width</span> <span>{((preset.spread || 0) * 100).toFixed(0)}%</span></label>
                     <input type="range" min="0" max="1" step="0.01" value={preset.spread || 0} onChange={(e) => onUpdate('spread', parseFloat(e.target.value))} className="w-full h-1 bg-cyan-600 rounded appearance-none cursor-pointer" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="flex justify-between text-xs mb-1 text-slate-400"><span>Auto-Pan Rate</span></label>
                         <input type="range" min="0" max="10" step="0.1" value={preset.stereoPanSpeed || 0} onChange={(e) => onUpdate('stereoPanSpeed', parseFloat(e.target.value))} className="w-full h-1 bg-cyan-600 rounded appearance-none cursor-pointer" />
                         <div className="text-[9px] text-right text-slate-500 font-mono mt-1">{(preset.stereoPanSpeed || 0).toFixed(2)} Hz</div>
                     </div>
                     <div>
                         <label className="flex justify-between text-xs mb-1 text-slate-400"><span>Auto-Pan Depth</span></label>
                         <input type="range" min="0" max="1" step="0.01" value={preset.stereoPanDepth || 0} onChange={(e) => onUpdate('stereoPanDepth', parseFloat(e.target.value))} className="w-full h-1 bg-cyan-600 rounded appearance-none cursor-pointer" />
                         <div className="text-[9px] text-right text-slate-500 font-mono mt-1">{((preset.stereoPanDepth || 0) * 100).toFixed(0)}%</div>
                     </div>
                 </div>
            </div>

            {/* Delay */}
            <div className="p-3 bg-slate-900/50 rounded border border-slate-700 space-y-4">
                 <h3 className="text-xs font-bold text-teal-300 uppercase">Delay</h3>
                 <div>
                     <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Delay Mix</span> <span>{(preset.delayMix * 100).toFixed(0)}%</span></label>
                     <input type="range" min="0" max="1" step="0.01" value={preset.delayMix} onChange={(e) => onUpdate('delayMix', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none cursor-pointer" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="flex justify-between text-xs mb-1 text-slate-400"><span>Time</span></label>
                         <input type="range" min="0" max="2" step="0.05" value={preset.delayTime} onChange={(e) => onUpdate('delayTime', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none cursor-pointer" />
                         <div className="text-[9px] text-right text-slate-500 font-mono mt-1">{preset.delayTime.toFixed(2)}s</div>
                     </div>
                     <div>
                         <label className="flex justify-between text-xs mb-1 text-slate-400"><span>Feedback</span></label>
                         <input type="range" min="0" max="0.9" step="0.01" value={preset.delayFeedback} onChange={(e) => onUpdate('delayFeedback', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none cursor-pointer" />
                         <div className="text-[9px] text-right text-slate-500 font-mono mt-1">{(preset.delayFeedback * 100).toFixed(0)}%</div>
                     </div>
                 </div>
            </div>

            {/* Reverb */}
            <div className={`p-3 bg-slate-900/50 rounded border border-slate-700 space-y-4 ${!isReverbEditable ? 'opacity-75' : ''}`}>
                 <div className="flex justify-between items-center">
                     <h3 className="text-xs font-bold text-blue-300 uppercase">Reverb</h3>
                     {!isReverbEditable && <span className="text-[9px] text-orange-400 uppercase font-bold">Locked to Global</span>}
                 </div>
                 
                 <select 
                    value={preset.reverbType || 'room'} 
                    onChange={(e) => onReverbTypeChange(e.target.value as ReverbType)} 
                    className="w-full bg-slate-700 text-xs rounded p-1 border border-slate-600 capitalize cursor-pointer focus:outline-none focus:border-blue-500"
                    disabled={!isReverbEditable}
                 >
                    {(['room', 'hall', 'cathedral', 'plate', 'shimmer'] as ReverbType[]).map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                 </select>

                 <div>
                     <label className="flex justify-between text-xs mb-1 text-slate-300"><span>Mix</span> <span>{(preset.reverbMix * 100).toFixed(0)}%</span></label>
                     <input type="range" min="0" max="1" step="0.01" value={preset.reverbMix} onChange={(e) => onUpdate('reverbMix', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none cursor-pointer" />
                 </div>

                 <div className={`space-y-3 ${!isReverbEditable ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
                     <div>
                         <label className="flex justify-between text-xs mb-1 text-slate-400"><span>Size</span> <span>{(preset.reverbSize || 2.5).toFixed(1)}s</span></label>
                         <input type="range" min="0.1" max="10.0" step="0.1" value={preset.reverbSize || 2.5} onChange={(e) => onUpdate('reverbSize', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none cursor-pointer" />
                     </div>
                     <div>
                         <label className="flex justify-between text-xs mb-1 text-slate-400"><span>Damping</span> <span>{((preset.reverbDamping || 0.5) * 100).toFixed(0)}%</span></label>
                         <input type="range" min="0" max="1" step="0.01" value={preset.reverbDamping || 0.5} onChange={(e) => onUpdate('reverbDamping', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none cursor-pointer" />
                     </div>
                     <div>
                         <label className="flex justify-between text-xs mb-1 text-slate-400"><span>Diffusion</span> <span>{((preset.reverbDiffusion || 0.8) * 100).toFixed(0)}%</span></label>
                         <input type="range" min="0" max="1" step="0.01" value={preset.reverbDiffusion || 0.8} onChange={(e) => onUpdate('reverbDiffusion', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none cursor-pointer" />
                     </div>
                 </div>
            </div>
        </div>
    );
};

export default EffectsPanel;
