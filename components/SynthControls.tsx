import React from 'react';
import { SynthPreset, WaveformType } from '../types';
import { PRESETS } from '../constants';

interface Props {
  preset: SynthPreset;
  onChange: (p: SynthPreset) => void;
  isOpen: boolean;
  onClose: () => void;
}

const SynthControls: React.FC<Props> = ({ preset, onChange, isOpen, onClose }) => {
  if (!isOpen) return null;

  const update = (key: keyof SynthPreset, val: any) => {
    onChange({ ...preset, [key]: val });
  };
  
  const loadPreset = (p: SynthPreset) => {
      onChange({ ...p });
  };

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-slate-800/95 backdrop-blur shadow-2xl z-[200] transform transition-transform p-6 overflow-y-auto border-l border-slate-700">
        <div className="flex justify-between mb-6">
            <h2 className="text-xl font-bold">Synth Engine</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>
        
        {/* Preset Selector */}
        <div className="mb-6 grid grid-cols-2 gap-2">
            {PRESETS.map(p => (
                <button 
                  key={p.id}
                  onClick={() => loadPreset(p)}
                  className={`px-2 py-1 text-xs rounded border ${preset.name === p.name ? 'bg-green-600 border-green-500' : 'bg-slate-700 border-slate-600'}`}
                >
                    {p.name}
                </button>
            ))}
        </div>

        <div className="space-y-6">
            <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">Oscillator 1</h3>
                <div className="grid grid-cols-4 gap-1 mb-2">
                    {Object.values(WaveformType).map(w => (
                        <button 
                            key={w}
                            onClick={() => update('waveform', w)}
                            className={`px-1 py-1 text-[10px] rounded border ${preset.waveform === w ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-slate-600'}`}
                        >
                            {w}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">Oscillator 2</h3>
                <div className="grid grid-cols-4 gap-1 mb-4">
                    {Object.values(WaveformType).map(w => (
                        <button 
                            key={w}
                            onClick={() => update('osc2Waveform', w)}
                            className={`px-1 py-1 text-[10px] rounded border ${preset.osc2Waveform === w ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-slate-600'}`}
                        >
                            {w}
                        </button>
                    ))}
                </div>
                <div className="space-y-2">
                    <div>
                        <label className="flex justify-between text-xs mb-1"><span>Mix</span> <span>{(preset.osc2Mix * 100).toFixed(0)}%</span></label>
                        <input type="range" min="0" max="1" step="0.01" value={preset.osc2Mix} onChange={(e) => update('osc2Mix', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1"><span>Detune</span> <span>{preset.osc2Detune} cents</span></label>
                        <input type="range" min="-1200" max="1200" step="10" value={preset.osc2Detune} onChange={(e) => update('osc2Detune', parseInt(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none" />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-400">Filter & FX</h3>
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Cutoff</span> <span>{preset.filterCutoff}Hz</span></label>
                    <input type="range" min="20" max="10000" step="10" value={preset.filterCutoff} onChange={(e) => update('filterCutoff', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none" />
                </div>
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Resonance (Q)</span> <span>{preset.filterResonance.toFixed(1)}</span></label>
                    <input type="range" min="0" max="20" step="0.1" value={preset.filterResonance} onChange={(e) => update('filterResonance', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none" />
                </div>
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Reverb Mix</span> <span>{(preset.reverbMix * 100).toFixed(0)}%</span></label>
                    <input type="range" min="0" max="1" step="0.01" value={preset.reverbMix} onChange={(e) => update('reverbMix', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none" />
                </div>
            </div>
            
            <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">LFO</h3>
                <div className="flex gap-2 mb-4 text-[10px]">
                    <button onClick={() => update('lfoTarget', 'none')} className={`flex-1 py-1 rounded border ${preset.lfoTarget === 'none' ? 'bg-pink-600' : 'bg-slate-700'}`}>Off</button>
                    <button onClick={() => update('lfoTarget', 'pitch')} className={`flex-1 py-1 rounded border ${preset.lfoTarget === 'pitch' ? 'bg-pink-600' : 'bg-slate-700'}`}>Pitch</button>
                    <button onClick={() => update('lfoTarget', 'filter')} className={`flex-1 py-1 rounded border ${preset.lfoTarget === 'filter' ? 'bg-pink-600' : 'bg-slate-700'}`}>Filter</button>
                    <button onClick={() => update('lfoTarget', 'tremolo')} className={`flex-1 py-1 rounded border ${preset.lfoTarget === 'tremolo' ? 'bg-pink-600' : 'bg-slate-700'}`}>Trem</button>
                </div>
                <div className="space-y-2">
                    <div>
                        <label className="flex justify-between text-xs mb-1"><span>Rate</span> <span>{preset.lfoRate} Hz</span></label>
                        <input type="range" min="0.1" max="20" step="0.1" value={preset.lfoRate} onChange={(e) => update('lfoRate', parseFloat(e.target.value))} className="w-full h-1 bg-pink-500 rounded appearance-none" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1"><span>Depth</span> <span>{preset.lfoDepth}</span></label>
                        <input type="range" min="0" max="1000" step="10" value={preset.lfoDepth} onChange={(e) => update('lfoDepth', parseFloat(e.target.value))} className="w-full h-1 bg-pink-500 rounded appearance-none" />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-400">Envelope</h3>
                
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Attack</span> <span>{preset.attack.toFixed(2)}s</span></label>
                    <input type="range" min="0.01" max="10.0" step="0.01" value={preset.attack} onChange={(e) => update('attack', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" />
                </div>
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Decay</span> <span>{preset.decay.toFixed(2)}s</span></label>
                    <input type="range" min="0.01" max="10.0" step="0.01" value={preset.decay} onChange={(e) => update('decay', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" />
                </div>
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Sustain Level</span> <span>{preset.sustain}</span></label>
                    <input type="range" min="0.0" max="1.0" step="0.01" value={preset.sustain} onChange={(e) => update('sustain', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" />
                </div>
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Release</span> <span>{preset.release.toFixed(2)}s</span></label>
                    <input type="range" min="0.01" max="10.0" step="0.01" value={preset.release} onChange={(e) => update('release', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" />
                </div>
            </div>

            <div>
                <label className="flex justify-between text-xs mb-1"><span>Preset Gain</span> <span>{(preset.gain * 100).toFixed(0)}%</span></label>
                <input type="range" min="0.0" max="1.0" step="0.01" value={preset.gain} onChange={(e) => update('gain', parseFloat(e.target.value))} className="w-full h-1 bg-green-900 rounded appearance-none" />
            </div>
            
            <div className="pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 text-center">Changes apply to current slot</p>
            </div>
        </div>
    </div>
  );
};

export default SynthControls;