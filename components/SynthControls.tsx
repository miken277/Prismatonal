
import React, { useState } from 'react';
import { SynthPreset, WaveformType, OscillatorConfig, ModulationRow, ModSource, ModTarget } from '../types';
import { PRESET_BANKS } from '../constants';

interface Props {
  preset: SynthPreset;
  onChange: (p: SynthPreset) => void;
  isOpen: boolean;
  onClose: () => void;
}

// Just Intonation Ratios (Cents offset from 1/1)
// Indices 0-12 corresponding to chromatic steps but tuned justly
const JI_CENTS_MAP = [
    0,      // 0: Unison (1/1)
    112,    // 1: Minor 2nd (16/15)
    204,    // 2: Major 2nd (9/8)
    316,    // 3: Minor 3rd (6/5)
    386,    // 4: Major 3rd (5/4)
    498,    // 5: Perfect 4th (4/3)
    590,    // 6: Tritone (45/32)
    702,    // 7: Perfect 5th (3/2)
    814,    // 8: Minor 6th (8/5)
    884,    // 9: Major 6th (5/3)
    1018,   // 10: Minor 7th (9/5)
    1088,   // 11: Major 7th (15/8)
    1200    // 12: Octave (2/1)
];

const getJICents = (step: number): number => {
    const sign = Math.sign(step);
    const absStep = Math.abs(step);
    const octaveShift = Math.floor(absStep / 12);
    const index = absStep % 12;
    
    // Base cents for the interval class
    let cents = JI_CENTS_MAP[index];
    
    // Add full octaves (1200 cents each) if step > 12 (though our slider is -12 to 12)
    if (index === 0 && absStep > 0) cents = 1200; // Handle 12, 24 etc as pure octaves
    
    return sign * (cents + (octaveShift * 1200)); 
};

// Helper to find closest step from current cents (for UI feedback)
const getStepFromCents = (cents: number): number => {
    const sign = Math.sign(cents);
    const absCents = Math.abs(cents);
    
    // Simple closest match
    let bestStep = 0;
    let minDiff = Infinity;
    
    for (let i = 0; i <= 12; i++) {
        const target = JI_CENTS_MAP[i];
        const diff = Math.abs(target - absCents);
        if (diff < minDiff) {
            minDiff = diff;
            bestStep = i;
        }
    }
    
    return sign * bestStep;
};

const SynthControls: React.FC<Props> = ({ preset, onChange, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'osc1' | 'osc2' | 'osc3' | 'matrix' | 'fx'>('osc1');
  const [activeBankId, setActiveBankId] = useState<string>(PRESET_BANKS[0].id);

  if (!isOpen) return null;

  const activeBank = PRESET_BANKS.find(b => b.id === activeBankId) || PRESET_BANKS[0];

  const updateGlobal = (key: keyof SynthPreset, val: any) => {
    onChange({ ...preset, [key]: val });
  };
  
  const updateOsc = (oscKey: 'osc1' | 'osc2' | 'osc3', key: keyof OscillatorConfig, val: any) => {
      const newOsc = { ...preset[oscKey], [key]: val };
      onChange({ ...preset, [oscKey]: newOsc });
  };

  const updateOscInterval = (oscKey: 'osc1' | 'osc2' | 'osc3', step: number) => {
      const cents = getJICents(step);
      // We set coarse detune to the JI interval. 
      // We reset fine detune to 0 to ensure purity, or keep it? 
      // Resetting fine detune is safer for "locking" to the interval.
      const newOsc = { 
          ...preset[oscKey], 
          coarseDetune: cents,
          fineDetune: 0 
      };
      onChange({ ...preset, [oscKey]: newOsc });
  };
  
  const loadPreset = (p: SynthPreset) => {
      onChange({ ...p });
  };

  const addModRow = () => {
      const newRow: ModulationRow = {
          id: Math.random().toString(36).substr(2, 9),
          enabled: true,
          source: 'lfo1',
          target: 'osc1_pitch',
          amount: 50
      };
      onChange({ ...preset, modMatrix: [...(preset.modMatrix || []), newRow] });
  };

  const removeModRow = (id: string) => {
      onChange({ ...preset, modMatrix: (preset.modMatrix || []).filter(r => r.id !== id) });
  };

  const updateModRow = (id: string, field: keyof ModulationRow, value: any) => {
      const newMatrix = (preset.modMatrix || []).map(r => {
          if (r.id === id) return { ...r, [field]: value };
          return r;
      });
      onChange({ ...preset, modMatrix: newMatrix });
  };

  const renderOscillatorTab = (oscKey: 'osc1' | 'osc2' | 'osc3', label: string) => {
      const config = preset[oscKey];
      const canToggle = oscKey !== 'osc1'; 
      
      const currentIntervalStep = getStepFromCents(config.coarseDetune);

      return (
          <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-300 uppercase">{label} Settings</h3>
                  {canToggle && (
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 px-3 py-1 rounded border border-slate-600">
                          <input 
                              type="checkbox" 
                              checked={config.enabled} 
                              onChange={(e) => updateOsc(oscKey, 'enabled', e.target.checked)}
                              className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-500"
                          />
                          <span className={`text-xs font-bold ${config.enabled ? 'text-white' : 'text-slate-500'}`}>
                              {config.enabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                      </label>
                  )}
              </div>
              
              <div className={`space-y-6 ${!config.enabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                {/* Waveform & Mix */}
                <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                    <div className="grid grid-cols-4 gap-1 mb-4">
                        {Object.values(WaveformType).map(w => (
                            <button 
                                key={w}
                                onClick={() => updateOsc(oscKey, 'waveform', w)}
                                className={`px-1 py-1 text-[10px] rounded border ${config.waveform === w ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-slate-600'}`}
                            >
                                {w}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Mix (Gain)</span> <span>{(config.gain * 100).toFixed(0)}%</span></label>
                            <input type="range" min="0" max="1" step="0.01" value={config.gain} onChange={(e) => updateOsc(oscKey, 'gain', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none" />
                        </div>

                        {/* Harmonic Interval Slider */}
                        <div className="bg-slate-800/50 p-2 rounded border border-indigo-500/20">
                            <label className="flex justify-between text-xs mb-1 font-bold text-indigo-300">
                                <span>Harmonic Interval (JI)</span> 
                                <span>{currentIntervalStep > 0 ? '+' : ''}{currentIntervalStep} Step</span>
                            </label>
                            <input 
                                type="range" 
                                min="-12" 
                                max="12" 
                                step="1" 
                                value={currentIntervalStep} 
                                onChange={(e) => updateOscInterval(oscKey, parseInt(e.target.value))} 
                                className="w-full h-1 bg-indigo-500 rounded appearance-none cursor-pointer" 
                            />
                            <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                                <span>-Oct</span>
                                <span>Unison</span>
                                <span>+Oct</span>
                            </div>
                        </div>

                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Coarse Detune</span> <span>{config.coarseDetune} cents</span></label>
                            <input type="range" min="-1200" max="1200" step="1" value={config.coarseDetune} onChange={(e) => updateOsc(oscKey, 'coarseDetune', parseInt(e.target.value))} className="w-full h-1 bg-slate-600 rounded appearance-none" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Fine Detune</span> <span>{config.fineDetune} cents</span></label>
                            <input type="range" min="-50" max="50" step="1" value={config.fineDetune} onChange={(e) => updateOsc(oscKey, 'fineDetune', parseInt(e.target.value))} className="w-full h-1 bg-slate-600 rounded appearance-none" />
                        </div>
                    </div>
                </div>

                {/* Filter */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400">Filter</h4>
                    <div>
                        <label className="flex justify-between text-xs mb-1"><span>Cutoff</span> <span>{config.filterCutoff}Hz</span></label>
                        <input type="range" min="20" max="10000" step="10" value={config.filterCutoff} onChange={(e) => updateOsc(oscKey, 'filterCutoff', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1"><span>Resonance (Q)</span> <span>{config.filterResonance.toFixed(1)}</span></label>
                        <input type="range" min="0" max="20" step="0.1" value={config.filterResonance} onChange={(e) => updateOsc(oscKey, 'filterResonance', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none" />
                    </div>
                </div>

                {/* Envelope */}
                 <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400">Envelope</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Att: {config.attack.toFixed(2)}s</span></label>
                            <input type="range" min="0.01" max="5.0" step="0.01" value={config.attack} onChange={(e) => updateOsc(oscKey, 'attack', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Dec: {config.decay.toFixed(2)}s</span></label>
                            <input type="range" min="0.01" max="5.0" step="0.01" value={config.decay} onChange={(e) => updateOsc(oscKey, 'decay', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Sus: {config.sustain.toFixed(2)}</span></label>
                            <input type="range" min="0.0" max="1.0" step="0.01" value={config.sustain} onChange={(e) => updateOsc(oscKey, 'sustain', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Rel: {config.release.toFixed(2)}s</span></label>
                            <input type="range" min="0.01" max="8.0" step="0.01" value={config.release} onChange={(e) => updateOsc(oscKey, 'release', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" />
                        </div>
                    </div>
                </div>

                {/* LFO */}
                <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                    <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">LFO</h3>
                    <div className="flex gap-2 mb-4 text-[10px]">
                        {(['none', 'pitch', 'filter', 'tremolo'] as const).map(target => (
                             <button 
                                key={target}
                                onClick={() => updateOsc(oscKey, 'lfoTarget', target)} 
                                className={`flex-1 py-1 rounded border capitalize ${config.lfoTarget === target ? 'bg-pink-600 border-pink-500' : 'bg-slate-700 border-slate-600'}`}
                             >
                                 {target}
                             </button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Rate</span> <span>{config.lfoRate} Hz</span></label>
                            <input type="range" min="0.1" max="20" step="0.1" value={config.lfoRate} onChange={(e) => updateOsc(oscKey, 'lfoRate', parseFloat(e.target.value))} className="w-full h-1 bg-pink-500 rounded appearance-none" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Depth</span> <span>{config.lfoDepth}</span></label>
                            <input type="range" min="0" max="100" step="1" value={config.lfoDepth} onChange={(e) => updateOsc(oscKey, 'lfoDepth', parseFloat(e.target.value))} className="w-full h-1 bg-pink-500 rounded appearance-none" />
                        </div>
                    </div>
                </div>
            </div>
          </div>
      );
  };

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-slate-800/95 backdrop-blur shadow-2xl z-[200] transform transition-transform p-0 overflow-hidden border-l border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-2">
            <h2 className="text-xl font-bold">Synth Engine</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>
        
        {/* Bank Tabs */}
        <div className="px-6 mb-2">
            <div className="flex space-x-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
                {PRESET_BANKS.map(bank => (
                    <button
                        key={bank.id}
                        onClick={() => setActiveBankId(bank.id)}
                        className={`px-3 py-1 text-xs font-bold uppercase whitespace-nowrap rounded-t-lg transition-colors border-b-2 ${activeBankId === bank.id ? 'text-white border-blue-500 bg-slate-700/50' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                    >
                        {bank.name}
                    </button>
                ))}
            </div>
        </div>

        {/* Preset Selector (Grid of 10) */}
        <div className="px-6 mb-4">
            <div className="grid grid-cols-5 gap-2 bg-slate-900/30 p-2 rounded-lg border border-slate-700/50">
                {activeBank.presets.map((p, idx) => (
                    <button 
                      key={`${p.id}-${idx}`}
                      onClick={() => loadPreset(p)}
                      title={p.name}
                      className={`min-h-[3rem] px-1 py-1 text-[9px] leading-tight rounded border flex items-center justify-center text-center whitespace-normal break-words overflow-hidden transition-all ${preset.name === p.name ? 'bg-green-600 border-green-500 text-white shadow-[0_0_8px_rgba(22,163,74,0.5)]' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'}`}
                    >
                        <span className="line-clamp-2 w-full">
                            {p.name === "Init Patch" ? (idx + 1) : p.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700 bg-slate-900/50">
            <button 
                onClick={() => setActiveTab('osc1')} 
                className={`flex-1 py-3 text-[10px] font-bold uppercase transition ${activeTab === 'osc1' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Osc 1
            </button>
            <button 
                onClick={() => setActiveTab('osc2')} 
                className={`flex-1 py-3 text-[10px] font-bold uppercase transition ${activeTab === 'osc2' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Osc 2
            </button>
            <button 
                onClick={() => setActiveTab('osc3')} 
                className={`flex-1 py-3 text-[10px] font-bold uppercase transition ${activeTab === 'osc3' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Osc 3
            </button>
             <button 
                onClick={() => setActiveTab('matrix')} 
                className={`flex-1 py-3 text-[10px] font-bold uppercase transition ${activeTab === 'matrix' ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            >
                Mods
            </button>
             <button 
                onClick={() => setActiveTab('fx')} 
                className={`flex-1 py-3 text-[10px] font-bold uppercase transition ${activeTab === 'fx' ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            >
                FX
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700">
            {activeTab === 'osc1' && renderOscillatorTab('osc1', 'Oscillator 1')}
            {activeTab === 'osc2' && renderOscillatorTab('osc2', 'Oscillator 2')}
            {activeTab === 'osc3' && renderOscillatorTab('osc3', 'Oscillator 3')}
            
            {activeTab === 'matrix' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-purple-300 uppercase">Modulation Matrix</h3>
                        <button onClick={addModRow} className="text-xs bg-purple-600 px-2 py-1 rounded text-white hover:bg-purple-500">
                            + Add Route
                        </button>
                    </div>
                    
                    {(!preset.modMatrix || preset.modMatrix.length === 0) && (
                        <div className="text-center py-8 text-slate-500 text-xs italic border-2 border-dashed border-slate-700 rounded-lg">
                            No active modulations
                        </div>
                    )}

                    {preset.modMatrix && preset.modMatrix.map((row) => (
                        <div key={row.id} className="bg-slate-900/50 p-2 rounded border border-purple-500/30 flex flex-col gap-2">
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="checkbox" 
                                    checked={row.enabled} 
                                    onChange={(e) => updateModRow(row.id, 'enabled', e.target.checked)}
                                    className="rounded border-slate-600 text-purple-500"
                                />
                                <div className="flex-1 text-[10px] font-mono text-slate-400">
                                    {row.source.toUpperCase()} &rarr;
                                </div>
                                <button onClick={() => removeModRow(row.id)} className="text-slate-600 hover:text-red-400">
                                    &times;
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <select 
                                    value={row.source} 
                                    onChange={(e) => updateModRow(row.id, 'source', e.target.value)}
                                    className="flex-1 bg-slate-700 text-[10px] rounded p-1 border border-slate-600"
                                >
                                    <option value="lfo1">LFO 1</option>
                                    <option value="lfo2">LFO 2</option>
                                    <option value="lfo3">LFO 3</option>
                                    <option value="env1">Env 1</option>
                                    <option value="env2">Env 2</option>
                                    <option value="env3">Env 3</option>
                                </select>

                                <select 
                                    value={row.target} 
                                    onChange={(e) => updateModRow(row.id, 'target', e.target.value)}
                                    className="flex-1 bg-slate-700 text-[10px] rounded p-1 border border-slate-600"
                                >
                                    <option value="osc1_pitch">Osc 1 Pitch</option>
                                    <option value="osc1_cutoff">Osc 1 Cutoff</option>
                                    <option value="osc1_gain">Osc 1 Gain</option>
                                    <option value="osc2_pitch">Osc 2 Pitch</option>
                                    <option value="osc2_cutoff">Osc 2 Cutoff</option>
                                    <option value="osc2_gain">Osc 2 Gain</option>
                                    <option value="osc3_pitch">Osc 3 Pitch</option>
                                    <option value="osc3_cutoff">Osc 3 Cutoff</option>
                                    <option value="osc3_gain">Osc 3 Gain</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex justify-between text-[10px] mb-1 text-slate-400">
                                    <span>Amount</span>
                                    <span>{row.amount > 0 ? '+' : ''}{row.amount}%</span>
                                </div>
                                <input 
                                    type="range" min="-100" max="100" step="1" 
                                    value={row.amount}
                                    onChange={(e) => updateModRow(row.id, 'amount', parseInt(e.target.value))}
                                    className="w-full h-1 bg-purple-500 rounded appearance-none" 
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'fx' && (
                 <div className="space-y-6 animate-in fade-in duration-300">
                    <div>
                        <label className="flex justify-between text-xs mb-1 font-bold"><span>Master Preset Gain</span> <span>{(preset.gain * 100).toFixed(0)}%</span></label>
                        <input type="range" min="0.0" max="1.0" step="0.01" value={preset.gain} onChange={(e) => updateGlobal('gain', parseFloat(e.target.value))} className="w-full h-1 bg-green-500 rounded appearance-none" />
                    </div>

                    <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                         <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">Stereo Field</h3>
                         <div>
                             <label className="flex justify-between text-xs mb-1 font-semibold text-blue-300">
                                 <span>Voice Spread</span> 
                                 <span>{((preset.spread || 0) * 100).toFixed(0)}%</span>
                             </label>
                             <input 
                                 type="range" min="0" max="1" step="0.01" 
                                 value={preset.spread || 0} 
                                 onChange={(e) => updateGlobal('spread', parseFloat(e.target.value))} 
                                 className="w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded appearance-none" 
                             />
                             <p className="text-[9px] text-slate-500 mt-1">Pans individual voices left/right to create width.</p>
                         </div>
                    </div>

                    <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                         <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">Spatial Effects</h3>
                         <div className="space-y-4">
                            <div>
                                 <label className="flex justify-between text-xs mb-1"><span>Reverb</span> <span>{(preset.reverbMix * 100).toFixed(0)}%</span></label>
                                 <input type="range" min="0" max="1" step="0.01" value={preset.reverbMix} onChange={(e) => updateGlobal('reverbMix', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none" />
                            </div>
                            <div>
                                 <label className="flex justify-between text-xs mb-1"><span>Delay Mix</span> <span>{(preset.delayMix * 100).toFixed(0)}%</span></label>
                                 <input type="range" min="0" max="1" step="0.01" value={preset.delayMix} onChange={(e) => updateGlobal('delayMix', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none" />
                            </div>
                            <div>
                                 <label className="flex justify-between text-xs mb-1"><span>Delay Time</span> <span>{preset.delayTime.toFixed(2)}s</span></label>
                                 <input type="range" min="0" max="2" step="0.05" value={preset.delayTime} onChange={(e) => updateGlobal('delayTime', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none" />
                            </div>
                            <div>
                                 <label className="flex justify-between text-xs mb-1"><span>Feedback</span> <span>{(preset.delayFeedback * 100).toFixed(0)}%</span></label>
                                 <input type="range" min="0" max="0.9" step="0.01" value={preset.delayFeedback} onChange={(e) => updateGlobal('delayFeedback', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none" />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                         <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">Dynamics (Global)</h3>
                         <div className="space-y-4">
                             <div>
                                 <label className="flex justify-between text-xs mb-1"><span>Threshold</span> <span>{preset.compressorThreshold}dB</span></label>
                                 <input type="range" min="-60" max="0" step="1" value={preset.compressorThreshold} onChange={(e) => updateGlobal('compressorThreshold', parseFloat(e.target.value))} className="w-full h-1 bg-red-600 rounded appearance-none" />
                             </div>
                             <div>
                                 <label className="flex justify-between text-xs mb-1"><span>Ratio</span> <span>1:{preset.compressorRatio}</span></label>
                                 <input type="range" min="1" max="20" step="0.5" value={preset.compressorRatio} onChange={(e) => updateGlobal('compressorRatio', parseFloat(e.target.value))} className="w-full h-1 bg-red-600 rounded appearance-none" />
                             </div>
                             <div>
                                 <label className="flex justify-between text-xs mb-1"><span>Release</span> <span>{preset.compressorRelease}s</span></label>
                                 <input type="range" min="0.01" max="1.0" step="0.01" value={preset.compressorRelease} onChange={(e) => updateGlobal('compressorRelease', parseFloat(e.target.value))} className="w-full h-1 bg-red-600 rounded appearance-none" />
                             </div>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="pt-4 border-t border-slate-700 mt-4">
                <p className="text-[10px] text-slate-500 text-center">Changes applied immediately</p>
            </div>
        </div>
    </div>
  );
};

export default SynthControls;
