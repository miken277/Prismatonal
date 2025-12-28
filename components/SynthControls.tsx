
import React, { useState, useMemo } from 'react';
import { SynthPreset, OscillatorConfig, ModulationRow, ReverbType, PresetState, PlayMode, ArpDirection } from '../types';
import { PRESETS, REVERB_DEFAULTS } from '../constants';
import { useStore } from '../services/Store';
import OscillatorPanel from './synth/OscillatorPanel';
import ModMatrixPanel from './synth/ModMatrixPanel';
import EffectsPanel from './synth/EffectsPanel';

interface Props {
  presets: PresetState;
  onChange: (mode: PlayMode, p: SynthPreset) => void;
  isOpen: boolean;
  onClose: () => void;
}

const SynthControls: React.FC<Props> = ({ presets, onChange, isOpen, onClose }) => {
  const [activeVoiceMode, setActiveVoiceMode] = useState<PlayMode>('normal');
  const [activeTab, setActiveTab] = useState<'osc1' | 'osc2' | 'osc3' | 'matrix' | 'fx' | 'arp'>('osc1');
  const { userBank, saveUserPatch } = useStore();

  const [isSaveMode, setIsSaveMode] = useState(false);
  const [saveSlotIndex, setSaveSlotIndex] = useState(0);
  const [saveName, setSaveName] = useState("");

  const categorizedPresets = useMemo(() => {
      const groups: Record<string, SynthPreset[]> = {};
      PRESETS.forEach(p => {
          const cat = p.category || 'Uncategorized';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(p);
      });
      return groups;
  }, []);

  if (!isOpen) return null;

  const currentPreset = presets[activeVoiceMode];

  // --- Handlers for Child Components ---

  const handleGlobalUpdate = (key: keyof SynthPreset, val: any) => {
    onChange(activeVoiceMode, { ...currentPreset, [key]: val });
  };
  
  const handleArpUpdate = (key: keyof import('../types').ArpConfig, val: any) => {
      const currentArp = currentPreset.arpConfig || { direction: 'order', division: '1/8', octaves: 1, gate: 0.8, swing: 0, length: 8, probability: 1.0, humanize: 0 };
      const newArp = { ...currentArp, [key]: val };
      onChange(activeVoiceMode, { ...currentPreset, arpConfig: newArp });
  };

  const handleOscUpdate = (oscKey: 'osc1' | 'osc2' | 'osc3', key: keyof OscillatorConfig, val: any) => {
      const newOsc = { ...currentPreset[oscKey], [key]: val };
      onChange(activeVoiceMode, { ...currentPreset, [oscKey]: newOsc });
  };

  const handleMatrixUpdate = (newMatrix: ModulationRow[]) => {
      onChange(activeVoiceMode, { ...currentPreset, modMatrix: newMatrix });
  };

  const handleReverbTypeChange = (type: ReverbType) => {
      const defaults = REVERB_DEFAULTS[type];
      onChange(activeVoiceMode, {
          ...currentPreset,
          reverbType: type,
          reverbSize: defaults.size,
          reverbDamping: defaults.damping,
          reverbDiffusion: defaults.diffusion
      });
  };
  
  // --- Preset Management ---

  const loadPreset = (p: SynthPreset) => {
      const cloned = JSON.parse(JSON.stringify(p));
      onChange(activeVoiceMode, cloned);
  };

  const handleResetToDefault = () => {
      const factory = PRESETS.find(p => p.name === currentPreset.name);
      if (factory) {
          loadPreset(factory);
      } else {
          const userP = userBank.find(p => p.name === currentPreset.name);
          if (userP) loadPreset(userP);
      }
  };

  const handleSaveToSlot = () => {
      if (saveName.trim() === "") return;
      const presetToSave = { ...currentPreset, name: saveName, id: `user-${Date.now()}` };
      saveUserPatch(saveSlotIndex, presetToSave);
      setIsSaveMode(false);
  };

  const arpConfig = currentPreset.arpConfig || { direction: 'order', division: '1/8', octaves: 1, gate: 0.8, swing: 0, length: 8, probability: 1.0, humanize: 0 };

  return (
    <div className="fixed top-0 right-0 h-full w-[450px] bg-slate-800/95 backdrop-blur shadow-2xl z-[200] transform transition-transform p-0 overflow-hidden border-l border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-2">
            <h2 className="text-xl font-bold">Synth Engine</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>
        
        {/* Mode Selector */}
        <div className="flex border-b border-slate-700 bg-slate-900/80 mx-4 mt-2 rounded-t-lg overflow-hidden">
            {(['normal', 'latch', 'strum', 'arpeggio'] as PlayMode[]).map(mode => (
                <button
                    key={mode}
                    onClick={() => setActiveVoiceMode(mode)}
                    className={`flex-1 py-3 text-xs font-bold uppercase transition border-b-2 ${activeVoiceMode === mode ? 'border-indigo-500 text-indigo-400 bg-slate-800' : 'border-transparent text-slate-500 hover:bg-slate-800/50'}`}
                >
                    {mode}
                </button>
            ))}
        </div>

        {/* Preset Bar */}
        {!isSaveMode ? (
            <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 space-y-3">
                <div>
                    <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold tracking-wider">Active Patch</label>
                    <div className="relative">
                        <select 
                            value={currentPreset.name}
                            onChange={(e) => {
                                let p = PRESETS.find(pr => pr.name === e.target.value);
                                if (!p) p = userBank.find(pr => pr.name === e.target.value);
                                if (p) loadPreset(p);
                            }}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white appearance-none focus:border-indigo-500 focus:outline-none"
                        >
                            {Object.keys(categorizedPresets).map(cat => (
                                <optgroup key={cat} label={cat}>{categorizedPresets[cat].map(p => (<option key={p.id} value={p.name}>{p.name}</option>))}</optgroup>
                            ))}
                            <optgroup label="User Bank">{userBank.map((p, idx) => (<option key={`user-${idx}`} value={p.name}>{p.name}</option>))}</optgroup>
                        </select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setSaveName(currentPreset.name); setIsSaveMode(true); }} className="flex-1 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-indigo-100 text-xs font-bold rounded transition border border-indigo-500">Save to Slot</button>
                    <button onClick={handleResetToDefault} className="flex-1 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-yellow-100 text-xs font-bold rounded transition border border-yellow-500">Reset to Default</button>
                </div>
            </div>
        ) : (
            <div className="px-6 py-4 bg-indigo-900/20 border-b border-indigo-500/30">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] text-indigo-300 font-bold uppercase">Save Current Patch</label>
                    <button onClick={() => setIsSaveMode(false)} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                </div>
                <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Patch Name" className="w-full bg-slate-900 border border-indigo-500 rounded p-2 text-sm mb-2 text-white" />
                <select value={saveSlotIndex} onChange={(e) => setSaveSlotIndex(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white mb-3">
                    {userBank.map((p, idx) => (<option key={idx} value={idx}>Slot {idx+1}: {p.name}</option>))}
                </select>
                <button onClick={handleSaveToSlot} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs transition">Confirm Save</button>
            </div>
        )}
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50">
            {(['osc1', 'osc2', 'osc3'] as const).map(osc => (
                 <button key={osc} onClick={() => setActiveTab(osc)} className={`flex-1 py-3 text-[10px] font-bold uppercase transition flex flex-col items-center justify-center gap-1 ${activeTab === osc ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
                    <span>{osc.replace('osc', 'Osc ')}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${currentPreset[osc].enabled ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'bg-slate-700'}`}></span>
                </button>
            ))}
             <button onClick={() => setActiveTab('matrix')} className={`flex-1 py-3 text-[10px] font-bold uppercase transition flex flex-col items-center justify-center gap-1 ${activeTab === 'matrix' ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
                <span>Mods</span>
                <span className={`w-1.5 h-1.5 rounded-full ${(currentPreset.modMatrix?.length || 0) > 0 ? 'bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.8)]' : 'bg-slate-700'}`}></span>
            </button>
             <button onClick={() => setActiveTab('fx')} className={`flex-1 py-3 text-[10px] font-bold uppercase transition flex flex-col items-center justify-center gap-1 ${activeTab === 'fx' ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
                <span>FX</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></span>
            </button>
             <button onClick={() => setActiveTab('arp')} className={`flex-1 py-3 text-[10px] font-bold uppercase transition flex flex-col items-center justify-center gap-1 ${activeTab === 'arp' ? 'text-red-400 border-b-2 border-red-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
                <span>Arp</span>
                <span className={`w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]`}></span>
            </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700">
            {activeTab === 'osc1' && (
                <OscillatorPanel 
                    label="Oscillator 1" 
                    config={currentPreset.osc1} 
                    isPrimary={true} 
                    onUpdate={(k, v) => handleOscUpdate('osc1', k, v)} 
                />
            )}
            
            {activeTab === 'osc2' && (
                <OscillatorPanel 
                    label="Oscillator 2" 
                    config={currentPreset.osc2} 
                    onUpdate={(k, v) => handleOscUpdate('osc2', k, v)} 
                />
            )}
            
            {activeTab === 'osc3' && (
                <OscillatorPanel 
                    label="Oscillator 3" 
                    config={currentPreset.osc3} 
                    onUpdate={(k, v) => handleOscUpdate('osc3', k, v)} 
                />
            )}
            
            {activeTab === 'matrix' && (
                <ModMatrixPanel 
                    modMatrix={currentPreset.modMatrix || []} 
                    onChange={handleMatrixUpdate} 
                />
            )}

            {activeTab === 'fx' && (
                <EffectsPanel 
                    preset={currentPreset} 
                    isReverbEditable={activeVoiceMode === 'normal'} 
                    onUpdate={handleGlobalUpdate} 
                    onReverbTypeChange={handleReverbTypeChange} 
                />
            )}

            {activeTab === 'arp' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-2">Granular Arp Settings ({activeVoiceMode})</h3>
                    <div className="p-4 bg-slate-900/50 rounded border border-slate-700 space-y-4">
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Direction</label>
                            <div className="flex bg-slate-800 rounded border border-slate-600 overflow-hidden">
                                {(['order', 'up', 'down', 'updown', 'random'] as ArpDirection[]).map(dir => (
                                    <button 
                                        key={dir} 
                                        onClick={() => handleArpUpdate('direction', dir)}
                                        className={`flex-1 py-1 text-[10px] uppercase font-bold ${arpConfig.direction === dir ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        {dir}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Probability</span> <span className="font-bold text-white">{(arpConfig.probability !== undefined ? arpConfig.probability * 100 : 100).toFixed(0)}%</span></label>
                            <input type="range" min="0" max="1" step="0.05" value={arpConfig.probability !== undefined ? arpConfig.probability : 1.0} onChange={(e) => handleArpUpdate('probability', parseFloat(e.target.value))} className="w-full h-1 bg-red-500 rounded appearance-none cursor-pointer" />
                            <p className="text-[9px] text-slate-500 mt-1">Chance of each step playing.</p>
                        </div>

                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Humanize</span> <span className="font-bold text-white">{arpConfig.humanize || 0} ms</span></label>
                            <input type="range" min="0" max="100" step="5" value={arpConfig.humanize || 0} onChange={(e) => handleArpUpdate('humanize', parseInt(e.target.value))} className="w-full h-1 bg-red-500 rounded appearance-none cursor-pointer" />
                            <p className="text-[9px] text-slate-500 mt-1">Random timing offset per step.</p>
                        </div>

                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Octave Range</span> <span className="font-bold text-white">{arpConfig.octaves}</span></label>
                            <input type="range" min="1" max="4" step="1" value={arpConfig.octaves} onChange={(e) => handleArpUpdate('octaves', parseInt(e.target.value))} className="w-full h-1 bg-red-600 rounded appearance-none cursor-pointer" />
                        </div>

                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Swing</span> <span className="font-bold text-white">{arpConfig.swing}%</span></label>
                            <input type="range" min="0" max="100" step="1" value={arpConfig.swing} onChange={(e) => handleArpUpdate('swing', parseInt(e.target.value))} className="w-full h-1 bg-red-600 rounded appearance-none cursor-pointer" />
                        </div>

                    </div>
                    <p className="text-[10px] text-slate-500 text-center italic">Sequence Length and Division are now controlled per-pattern in the matrix view.</p>
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
