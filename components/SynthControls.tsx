
import React, { useState, useMemo } from 'react';
import { SynthPreset, WaveformType, OscillatorConfig, ModSource, ModTarget, ReverbType, PresetState, PlayMode, ArpDirection, ArpDivision } from '../types';
import { PRESETS, REVERB_DEFAULTS } from '../constants';
import { useStore } from '../services/Store';

interface Props {
  presets: PresetState;
  onChange: (mode: PlayMode, p: SynthPreset) => void;
  isOpen: boolean;
  onClose: () => void;
}

// Envelope Graph Component (Same as before)
const EnvelopeGraph = ({ attack, decay, sustain, release }: { attack: number, decay: number, sustain: number, release: number }) => {
    const width = 200;
    const height = 60;
    const pad = 2;
    const scaleTime = (t: number) => Math.min(width / 3, Math.pow(t, 0.5) * 30);
    const xA = pad + scaleTime(attack);
    const xD = xA + scaleTime(decay);
    const xS = xD + 30; 
    const xR = xS + scaleTime(release);
    const yBase = height - pad;
    const yPeak = pad;
    const ySus = yBase - (sustain * (height - 2 * pad));
    const path = `M ${pad} ${yBase} L ${xA} ${yPeak} L ${xD} ${ySus} L ${xS} ${ySus} L ${xR} ${yBase}`;

    return (
        <div className="w-full bg-slate-900 rounded border border-slate-700 h-[60px] overflow-hidden relative">
            <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(width, xR + 10)} ${height}`} className="absolute top-0 left-0">
                <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" />
                <path d={`${path} L ${xR} ${height} L ${pad} ${height} Z`} fill="rgba(99, 102, 241, 0.2)" stroke="none" />
            </svg>
            <div className="absolute bottom-1 right-2 text-[8px] text-slate-500 pointer-events-none">ADSR VISUALIZER</div>
        </div>
    );
};

const MATRIX_SOURCES: { id: ModSource, label: string }[] = [
    { id: 'lfo1', label: 'LFO 1' },
    { id: 'lfo2', label: 'LFO 2' },
    { id: 'lfo3', label: 'LFO 3' },
    { id: 'env1', label: 'ENV 1' },
    { id: 'env2', label: 'ENV 2' },
    { id: 'env3', label: 'ENV 3' },
];

const MATRIX_TARGETS: { id: ModTarget, label: string }[] = [
    { id: 'osc1_pitch', label: 'Pitch 1' },
    { id: 'osc1_cutoff', label: 'Cut 1' },
    { id: 'osc1_gain', label: 'Gain 1' },
    { id: 'osc1_res', label: 'Res 1' },
    { id: 'osc2_pitch', label: 'Pitch 2' },
    { id: 'osc2_cutoff', label: 'Cut 2' },
    { id: 'osc2_gain', label: 'Gain 2' },
    { id: 'osc2_res', label: 'Res 2' },
    { id: 'osc3_pitch', label: 'Pitch 3' },
    { id: 'osc3_cutoff', label: 'Cut 3' },
    { id: 'osc3_gain', label: 'Gain 3' },
    { id: 'osc3_res', label: 'Res 3' },
];

const SynthControls: React.FC<Props> = ({ presets, onChange, isOpen, onClose }) => {
  const [activeVoiceMode, setActiveVoiceMode] = useState<PlayMode>('normal');
  const [activeTab, setActiveTab] = useState<'osc1' | 'osc2' | 'osc3' | 'matrix' | 'fx' | 'arp'>('osc1');
  const { userBank, saveUserPatch } = useStore();

  const [isSaveMode, setIsSaveMode] = useState(false);
  const [saveSlotIndex, setSaveSlotIndex] = useState(0);
  const [saveName, setSaveName] = useState("");
  const [draggingCell, setDraggingCell] = useState<{ source: ModSource, target: ModTarget, startY: number, startVal: number } | null>(null);

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

  const updateGlobal = (key: keyof SynthPreset, val: any) => {
    onChange(activeVoiceMode, { ...currentPreset, [key]: val });
  };
  
  const updateArp = (key: keyof import('../types').ArpConfig, val: any) => {
      const currentArp = currentPreset.arpConfig || { direction: 'order', division: '1/8', octaves: 1, gate: 0.8, swing: 0, length: 8, probability: 1.0, humanize: 0 };
      const newArp = { ...currentArp, [key]: val };
      onChange(activeVoiceMode, { ...currentPreset, arpConfig: newArp });
  };

  const updateOsc = (oscKey: 'osc1' | 'osc2' | 'osc3', key: keyof OscillatorConfig, val: any) => {
      const newOsc = { ...currentPreset[oscKey], [key]: val };
      onChange(activeVoiceMode, { ...currentPreset, [oscKey]: newOsc });
  };
  
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

  const getMatrixValue = (source: ModSource, target: ModTarget) => {
      const row = currentPreset.modMatrix?.find(r => r.source === source && r.target === target);
      return row ? row.amount : 0;
  };

  const setMatrixValue = (source: ModSource, target: ModTarget, amount: number) => {
      let newMatrix = [...(currentPreset.modMatrix || [])];
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
      onChange(activeVoiceMode, { ...currentPreset, modMatrix: newMatrix });
  };

  const handleMatrixDragStart = (e: React.PointerEvent, source: ModSource, target: ModTarget) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingCell({ source, target, startY: e.clientY, startVal: getMatrixValue(source, target) });
  };

  const handleMatrixDragMove = (e: React.PointerEvent) => {
      if (!draggingCell) return;
      const deltaY = draggingCell.startY - e.clientY; 
      let newVal = draggingCell.startVal + (deltaY * 1);
      newVal = Math.max(-100, Math.min(100, Math.round(newVal)));
      if (newVal !== getMatrixValue(draggingCell.source, draggingCell.target)) {
          setMatrixValue(draggingCell.source, draggingCell.target, newVal);
      }
  };

  const renderOscillatorTab = (oscKey: 'osc1' | 'osc2' | 'osc3', label: string) => {
      const config = currentPreset[oscKey];
      const canToggle = oscKey !== 'osc1'; 
      return (
          <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-300 uppercase">{label} Settings</h3>
                  {canToggle && (
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 px-3 py-1 rounded border border-slate-600">
                          <input type="checkbox" checked={config.enabled} onChange={(e) => updateOsc(oscKey, 'enabled', e.target.checked)} className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                          <span className={`text-xs font-bold ${config.enabled ? 'text-white' : 'text-slate-500'}`}>{config.enabled ? 'ENABLED' : 'DISABLED'}</span>
                      </label>
                  )}
              </div>
              <div className={`space-y-6 ${!config.enabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                    <div className="grid grid-cols-4 gap-1 mb-4">
                        {Object.values(WaveformType).map(w => (
                            <button key={w} onClick={() => updateOsc(oscKey, 'waveform', w)} className={`px-1 py-1 text-[10px] rounded border ${config.waveform === w ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-slate-600'}`}>{w}</button>
                        ))}
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Mix</span> <span>{(config.gain * 100).toFixed(0)}%</span></label>
                            <input type="range" min="0" max="1" step="0.01" value={config.gain} onChange={(e) => updateOsc(oscKey, 'gain', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Coarse</span> <span>{config.coarseDetune} cents</span></label>
                            <input type="range" min="-1200" max="1200" step="10" value={config.coarseDetune} onChange={(e) => updateOsc(oscKey, 'coarseDetune', parseInt(e.target.value))} className="w-full h-1 bg-indigo-500 rounded appearance-none" />
                        </div>
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Fine</span> <span>{config.fineDetune} cents</span></label>
                            <input type="range" min="-50" max="50" step="1" value={config.fineDetune} onChange={(e) => updateOsc(oscKey, 'fineDetune', parseInt(e.target.value))} className="w-full h-1 bg-indigo-400 rounded appearance-none" />
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400">Filter</h4>
                    <div>
                        <label className="flex justify-between text-xs mb-1"><span>Cutoff</span> <span>{config.filterCutoff}Hz</span></label>
                        <input type="range" min="20" max="10000" step="10" value={config.filterCutoff} onChange={(e) => updateOsc(oscKey, 'filterCutoff', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none" />
                    </div>
                    <div>
                        <label className="flex justify-between text-xs mb-1"><span>Resonance</span> <span>{config.filterResonance.toFixed(1)}</span></label>
                        <input type="range" min="0" max="20" step="0.1" value={config.filterResonance} onChange={(e) => updateOsc(oscKey, 'filterResonance', parseFloat(e.target.value))} className="w-full h-1 bg-yellow-600 rounded appearance-none" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400">Envelope</h4>
                    <EnvelopeGraph attack={config.attack} decay={config.decay} sustain={config.sustain} release={config.release} />
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div><label className="flex justify-between text-xs mb-1"><span>A: {config.attack.toFixed(2)}s</span></label><input type="range" min="0.01" max="5.0" step="0.01" value={config.attack} onChange={(e) => updateOsc(oscKey, 'attack', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" /></div>
                        <div><label className="flex justify-between text-xs mb-1"><span>D: {config.decay.toFixed(2)}s</span></label><input type="range" min="0.01" max="5.0" step="0.01" value={config.decay} onChange={(e) => updateOsc(oscKey, 'decay', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" /></div>
                        <div><label className="flex justify-between text-xs mb-1"><span>S: {config.sustain.toFixed(2)}</span></label><input type="range" min="0.0" max="1.0" step="0.01" value={config.sustain} onChange={(e) => updateOsc(oscKey, 'sustain', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" /></div>
                        <div><label className="flex justify-between text-xs mb-1"><span>R: {config.release.toFixed(2)}s</span></label><input type="range" min="0.01" max="8.0" step="0.01" value={config.release} onChange={(e) => updateOsc(oscKey, 'release', parseFloat(e.target.value))} className="w-full h-1 bg-indigo-900 rounded appearance-none" /></div>
                    </div>
                </div>
                <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                    <h3 className="text-xs font-bold text-slate-300 uppercase mb-3">LFO</h3>
                    <div className="flex gap-2 mb-4 text-[10px]">
                        {(['none', 'pitch', 'filter', 'tremolo'] as const).map(target => (
                             <button key={target} onClick={() => updateOsc(oscKey, 'lfoTarget', target)} className={`flex-1 py-1 rounded border capitalize ${config.lfoTarget === target ? 'bg-pink-600 border-pink-500' : 'bg-slate-700 border-slate-600'}`}>{target}</button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div><label className="flex justify-between text-xs mb-1"><span>Rate</span> <span>{config.lfoRate} Hz</span></label><input type="range" min="0.1" max="20" step="0.1" value={config.lfoRate} onChange={(e) => updateOsc(oscKey, 'lfoRate', parseFloat(e.target.value))} className="w-full h-1 bg-pink-500 rounded appearance-none" /></div>
                        <div><label className="flex justify-between text-xs mb-1"><span>Depth</span> <span>{config.lfoDepth}</span></label><input type="range" min="0" max="100" step="1" value={config.lfoDepth} onChange={(e) => updateOsc(oscKey, 'lfoDepth', parseFloat(e.target.value))} className="w-full h-1 bg-pink-500 rounded appearance-none" /></div>
                    </div>
                </div>
            </div>
          </div>
      );
  };

  const arpConfig = currentPreset.arpConfig || { direction: 'order', division: '1/8', octaves: 1, gate: 0.8, swing: 0, length: 8, probability: 1.0, humanize: 0 };

  return (
    <div className="fixed top-0 right-0 h-full w-[450px] bg-slate-800/95 backdrop-blur shadow-2xl z-[200] transform transition-transform p-0 overflow-hidden border-l border-slate-700 flex flex-col">
        <div className="flex justify-between items-center p-6 pb-2">
            <h2 className="text-xl font-bold">Synth Engine</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>
        
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

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700" onPointerUp={() => setDraggingCell(null)} onPointerLeave={() => setDraggingCell(null)} onPointerMove={handleMatrixDragMove}>
            {activeTab === 'osc1' && renderOscillatorTab('osc1', 'Oscillator 1')}
            {activeTab === 'osc2' && renderOscillatorTab('osc2', 'Oscillator 2')}
            {activeTab === 'osc3' && renderOscillatorTab('osc3', 'Oscillator 3')}
            
            {activeTab === 'matrix' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-bold text-purple-300 uppercase">Modulation Grid</h3><div className="text-[10px] text-slate-500 italic">Drag vertical on cells to adjust amount</div></div>
                    <div className="overflow-x-auto pb-4"><div className="min-w-[600px]"><div className="grid grid-cols-[60px_repeat(12,1fr)] gap-1">
                        <div className="text-[10px] font-bold text-slate-500">SRC / DST</div>{MATRIX_TARGETS.map(t => (<div key={t.id} className="text-[9px] font-bold text-slate-400 text-center uppercase rotate-0 whitespace-nowrap overflow-hidden text-ellipsis" title={t.label}>{t.label.replace('Osc', 'O').replace('Pitch', 'P').replace('Cut', 'C').replace('Gain', 'G').replace('Res', 'Q')}</div>))}
                        {MATRIX_SOURCES.map(source => (<React.Fragment key={source.id}><div className="text-[10px] font-bold text-purple-400 flex items-center h-8 bg-slate-900/50 px-1 rounded-l">{source.label}</div>{MATRIX_TARGETS.map(target => { const amount = getMatrixValue(source.id, target.id); const isActive = amount !== 0; return (<div key={`${source.id}-${target.id}`} className={`h-8 border border-slate-700 rounded flex flex-col justify-end items-center relative overflow-hidden cursor-ns-resize group ${isActive ? 'bg-purple-900/30 border-purple-500/50' : 'bg-slate-800 hover:bg-slate-700'}`} onPointerDown={(e) => handleMatrixDragStart(e, source.id, target.id)}>{isActive && (<div className={`absolute bottom-0 left-0 w-full transition-all ${amount > 0 ? 'bg-purple-500' : 'bg-orange-500'}`} style={{ height: `${Math.abs(amount)}%`, opacity: 0.4 }} />)}<span className={`text-[9px] z-10 font-mono ${isActive ? 'text-white font-bold' : 'text-transparent group-hover:text-slate-500'}`}>{amount !== 0 ? amount : '-'}</span></div>); })}</React.Fragment>))}
                    </div></div></div>
                </div>
            )}

            {activeTab === 'fx' && (
                 <div className="space-y-6 animate-in fade-in duration-300">
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-2">Global Effects ({activeVoiceMode})</h3>
                    <div><label className="flex justify-between text-xs mb-1 font-bold"><span>Master Gain</span> <span>{(currentPreset.gain * 100).toFixed(0)}%</span></label><input type="range" min="0.0" max="1.0" step="0.01" value={currentPreset.gain} onChange={(e) => updateGlobal('gain', parseFloat(e.target.value))} className="w-full h-1 bg-green-500 rounded appearance-none" /></div>
                    <div className="p-3 bg-slate-900/50 rounded border border-slate-700 space-y-4">
                         <h3 className="text-xs font-bold text-cyan-300 uppercase">Stereo & Pan</h3>
                         <div><label className="flex justify-between text-xs mb-1"><span>Stereo Width</span> <span>{((currentPreset.spread || 0) * 100).toFixed(0)}%</span></label><input type="range" min="0" max="1" step="0.01" value={currentPreset.spread || 0} onChange={(e) => updateGlobal('spread', parseFloat(e.target.value))} className="w-full h-1 bg-cyan-600 rounded appearance-none" /></div>
                         <div><label className="flex justify-between text-xs mb-1"><span>Auto-Pan Rate</span> <span>{(currentPreset.stereoPanSpeed || 0).toFixed(2)} Hz</span></label><input type="range" min="0" max="10" step="0.1" value={currentPreset.stereoPanSpeed || 0} onChange={(e) => updateGlobal('stereoPanSpeed', parseFloat(e.target.value))} className="w-full h-1 bg-cyan-600 rounded appearance-none" /></div>
                         <div><label className="flex justify-between text-xs mb-1"><span>Auto-Pan Depth</span> <span>{((currentPreset.stereoPanDepth || 0) * 100).toFixed(0)}%</span></label><input type="range" min="0" max="1" step="0.01" value={currentPreset.stereoPanDepth || 0} onChange={(e) => updateGlobal('stereoPanDepth', parseFloat(e.target.value))} className="w-full h-1 bg-cyan-600 rounded appearance-none" /></div>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded border border-slate-700 space-y-4">
                         <h3 className="text-xs font-bold text-teal-300 uppercase">Delay</h3>
                         <div><label className="flex justify-between text-xs mb-1"><span>Delay Mix</span> <span>{(currentPreset.delayMix * 100).toFixed(0)}%</span></label><input type="range" min="0" max="1" step="0.01" value={currentPreset.delayMix} onChange={(e) => updateGlobal('delayMix', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none" /></div>
                         <div><label className="flex justify-between text-xs mb-1"><span>Time</span> <span>{currentPreset.delayTime.toFixed(2)}s</span></label><input type="range" min="0" max="2" step="0.05" value={currentPreset.delayTime} onChange={(e) => updateGlobal('delayTime', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none" /></div>
                         <div><label className="flex justify-between text-xs mb-1"><span>Feedback</span> <span>{(currentPreset.delayFeedback * 100).toFixed(0)}%</span></label><input type="range" min="0" max="0.9" step="0.01" value={currentPreset.delayFeedback} onChange={(e) => updateGlobal('delayFeedback', parseFloat(e.target.value))} className="w-full h-1 bg-teal-600 rounded appearance-none" /></div>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded border border-slate-700 space-y-4">
                         <h3 className="text-xs font-bold text-blue-300 uppercase">Reverb</h3>
                         <select value={currentPreset.reverbType || 'room'} onChange={(e) => handleReverbTypeChange(e.target.value as ReverbType)} className="w-full bg-slate-700 text-xs rounded p-1 border border-slate-600 capitalize" disabled={activeVoiceMode !== 'normal'}>{(['room', 'hall', 'cathedral', 'plate', 'shimmer'] as ReverbType[]).map(type => (<option key={type} value={type}>{type}</option>))}</select>
                         <div><label className="flex justify-between text-xs mb-1"><span>Mix</span> <span>{(currentPreset.reverbMix * 100).toFixed(0)}%</span></label><input type="range" min="0" max="1" step="0.01" value={currentPreset.reverbMix} onChange={(e) => updateGlobal('reverbMix', parseFloat(e.target.value))} className="w-full h-1 bg-blue-600 rounded appearance-none" /></div>
                         <div><label className="flex justify-between text-xs mb-1"><span>Size</span> <span>{(currentPreset.reverbSize || 2.5).toFixed(1)}s</span></label><input type="range" min="0.1" max="10.0" step="0.1" value={currentPreset.reverbSize || 2.5} onChange={(e) => updateGlobal('reverbSize', parseFloat(e.target.value))} disabled={activeVoiceMode !== 'normal'} className={`w-full h-1 rounded appearance-none ${activeVoiceMode !== 'normal' ? 'bg-slate-600' : 'bg-blue-600'}`} /></div>
                         <div><label className="flex justify-between text-xs mb-1"><span>Damping</span> <span>{((currentPreset.reverbDamping || 0.5) * 100).toFixed(0)}%</span></label><input type="range" min="0" max="1" step="0.01" value={currentPreset.reverbDamping || 0.5} onChange={(e) => updateGlobal('reverbDamping', parseFloat(e.target.value))} disabled={activeVoiceMode !== 'normal'} className={`w-full h-1 rounded appearance-none ${activeVoiceMode !== 'normal' ? 'bg-slate-600' : 'bg-blue-600'}`} /></div>
                         <div><label className="flex justify-between text-xs mb-1"><span>Diffusion</span> <span>{((currentPreset.reverbDiffusion || 0.8) * 100).toFixed(0)}%</span></label><input type="range" min="0" max="1" step="0.01" value={currentPreset.reverbDiffusion || 0.8} onChange={(e) => updateGlobal('reverbDiffusion', parseFloat(e.target.value))} disabled={activeVoiceMode !== 'normal'} className={`w-full h-1 rounded appearance-none ${activeVoiceMode !== 'normal' ? 'bg-slate-600' : 'bg-blue-600'}`} /></div>
                    </div>
                </div>
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
                                        onClick={() => updateArp('direction', dir)}
                                        className={`flex-1 py-1 text-[10px] uppercase font-bold ${arpConfig.direction === dir ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        {dir}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Granular Settings replacing redundant ones */}
                        
                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Probability</span> <span className="font-bold text-white">{(arpConfig.probability !== undefined ? arpConfig.probability * 100 : 100).toFixed(0)}%</span></label>
                            <input type="range" min="0" max="1" step="0.05" value={arpConfig.probability !== undefined ? arpConfig.probability : 1.0} onChange={(e) => updateArp('probability', parseFloat(e.target.value))} className="w-full h-1 bg-red-500 rounded appearance-none" />
                            <p className="text-[9px] text-slate-500 mt-1">Chance of each step playing.</p>
                        </div>

                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Humanize</span> <span className="font-bold text-white">{arpConfig.humanize || 0} ms</span></label>
                            <input type="range" min="0" max="100" step="5" value={arpConfig.humanize || 0} onChange={(e) => updateArp('humanize', parseInt(e.target.value))} className="w-full h-1 bg-red-500 rounded appearance-none" />
                            <p className="text-[9px] text-slate-500 mt-1">Random timing offset per step.</p>
                        </div>

                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Octave Range</span> <span className="font-bold text-white">{arpConfig.octaves}</span></label>
                            <input type="range" min="1" max="4" step="1" value={arpConfig.octaves} onChange={(e) => updateArp('octaves', parseInt(e.target.value))} className="w-full h-1 bg-red-600 rounded appearance-none" />
                        </div>

                        <div>
                            <label className="flex justify-between text-xs mb-1"><span>Swing</span> <span className="font-bold text-white">{arpConfig.swing}%</span></label>
                            <input type="range" min="0" max="100" step="1" value={arpConfig.swing} onChange={(e) => updateArp('swing', parseInt(e.target.value))} className="w-full h-1 bg-red-600 rounded appearance-none" />
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
