
import React from 'react';
import { SynthPreset, WaveformType } from '../types';

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

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-slate-800/95 backdrop-blur shadow-2xl z-[200] transform transition-transform p-6 overflow-y-auto border-l border-slate-700">
        <div className="flex justify-between mb-6">
            <h2 className="text-xl font-bold">Synth Engine</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>

        <div className="space-y-6">
            <div>
                <label className="block text-sm mb-2 text-slate-400">Waveform</label>
                <div className="grid grid-cols-2 gap-2">
                    {Object.values(WaveformType).map(w => (
                        <button 
                            key={w}
                            onClick={() => update('waveform', w)}
                            className={`px-2 py-2 text-sm rounded border ${preset.waveform === w ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-slate-600'}`}
                        >
                            {w}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-400">Filter & FX</h3>
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Cutoff Freq</span> <span>{preset.filterCutoff}Hz</span></label>
                    <input type="range" min="20" max="10000" step="10" value={preset.filterCutoff} onChange={(e) => update('filterCutoff', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none" />
                </div>
                <div>
                    <label className="flex justify-between text-xs mb-1"><span>Reverb Mix</span> <span>{(preset.reverbMix * 100).toFixed(0)}%</span></label>
                    <input type="range" min="0" max="1" step="0.01" value={preset.reverbMix} onChange={(e) => update('reverbMix', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none" />
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
