import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types';
import { midiService, MidiDevice } from '../../services/MidiService';
import { NumberInput } from './SettingsWidgets';

interface Props {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const MidiTab: React.FC<Props> = ({ settings, updateSettings }) => {
    const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);

    useEffect(() => {
        midiService.init().then(success => { 
            if (success) { 
                midiService.getOutputs().then(devices => { setMidiDevices(devices); }); 
            } 
        });
    }, []);

    const handleChange = (key: keyof AppSettings, value: any) => updateSettings({ [key]: value });

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="max-w-xl mx-auto space-y-6">
                <h3 className="font-semibold text-green-400 border-b border-slate-700 pb-1">External MIDI Output</h3>
                <div className="bg-slate-900/40 p-6 rounded-lg border border-slate-700 space-y-6">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div className="space-y-1">
                            <span className="text-sm font-bold text-white">Enable MIDI Engine</span>
                            <p className="text-[10px] text-slate-500 uppercase">Requires Chrome, Edge, or Opera</p>
                        </div>
                        <input type="checkbox" checked={settings.midiEnabled} onChange={(e) => handleChange('midiEnabled', e.target.checked)} className="w-6 h-6 rounded border-slate-600 text-green-500" />
                    </label>

                    <div className={`space-y-4 transition-opacity ${settings.midiEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Output Device</label>
                            <select value={settings.midiOutputId || ''} onChange={(e) => { const id = e.target.value || null; handleChange('midiOutputId', id); midiService.setOutput(id); }} className="w-full bg-slate-700 rounded p-2 text-sm text-white border border-slate-600">
                                <option value="">No MIDI Output Selected</option>
                                {midiDevices.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Pitch Bend Range</label>
                            <div className="flex gap-4 items-center">
                                <NumberInput value={settings.midiPitchBendRange} min={1} max={48} suffix="Semis" onChange={(val) => handleChange('midiPitchBendRange', val)} />
                                <div className="flex-1 flex gap-2">
                                    {[2, 12, 24, 48].map(range => (
                                        <button key={range} onClick={() => handleChange('midiPitchBendRange', range)} className={`flex-1 py-1.5 text-[10px] font-bold rounded border ${settings.midiPitchBendRange === range ? 'bg-green-600 border-green-500' : 'bg-slate-700 border-slate-600'}`}>{range}</button>
                                    ))}
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 italic">Ensure your external hardware or plugin's bend range matches this value for accurate tuning.</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-slate-900/20 p-4 rounded-lg border border-slate-800 text-center">
                    <p className="text-xs text-slate-400">PrismaTonal uses an MPE-style channel rotation (Ch 1-16) to provide independent microtonal pitch-bend for every note played.</p>
                </div>
            </div>
        </div>
    );
};

export default MidiTab;
