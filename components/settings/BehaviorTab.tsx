
import React, { useState, useEffect } from 'react';
import { AppSettings, KeyMappings } from '../../types';

interface Props {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const BehaviorTab: React.FC<Props> = ({ settings, updateSettings }) => {
    const [listeningFor, setListeningFor] = useState<keyof KeyMappings | null>(null);

    const handleChange = (key: keyof AppSettings, value: any) => updateSettings({ [key]: value });

    // Hook for handling the enabling of audio capture
    // This is where you would inject explicit permission requests (e.g. getUserMedia) if expanding to microphone input in the future.
    const handleToggleAudioRecording = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const isEnabled = e.target.checked;
        
        if (isEnabled) {
            // Optional: Add logic here to request permissions dynamically if needed
            // e.g., await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // For internal synthesis recording, we just enable the setting
            handleChange('enableAudioRecording', true);
        } else {
            handleChange('enableAudioRecording', false);
        }
    };

    useEffect(() => {
        const handleBinderKeyDown = (e: KeyboardEvent) => {
            if (!listeningFor) return;
            e.preventDefault(); 
            e.stopPropagation();
            let key = e.key.toLowerCase(); 
            if (key === ' ') key = 'Space';
            updateSettings({ keyMappings: { ...settings.keyMappings, [listeningFor]: key } });
            setListeningFor(null);
        };
        if (listeningFor) window.addEventListener('keydown', handleBinderKeyDown);
        return () => window.removeEventListener('keydown', handleBinderKeyDown);
    }, [listeningFor, settings, updateSettings]);

    const renderKeyBinding = (label: string, actionKey: keyof KeyMappings) => {
        const isListening = listeningFor === actionKey;
        const currentKey = settings.keyMappings[actionKey].toUpperCase();
        return (
            <div className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700 hover:border-slate-600 transition-colors">
                <span className="text-sm font-bold text-slate-300">{label}</span>
                <button onClick={() => setListeningFor(actionKey)} className={`px-3 py-1 text-xs font-mono font-bold rounded min-w-[80px] border transition-all ${isListening ? 'bg-red-900 border-red-500 text-white animate-pulse' : 'bg-slate-700 border-slate-600 text-blue-300 hover:bg-slate-600'}`}>
                    {isListening ? 'Press Key...' : currentKey}
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1">Audio Performance</h3>
                
                <label className="flex items-center justify-between cursor-pointer bg-slate-900/40 p-3 rounded border border-slate-700/50">
                    <div className="space-y-1">
                        <span className="text-sm font-semibold text-white">High Quality Oversampling</span>
                        <p className="text-[10px] text-slate-500">Enable 2x Oversampling. Disable to reduce CPU usage.</p>
                    </div>
                    <input type="checkbox" checked={settings.enableOversampling} onChange={(e) => handleChange('enableOversampling', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-indigo-500" />
                </label>

                <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Wavetable Fidelity</label>
                        <div className="flex gap-2">
                            {[2048, 8192, 65536].map(size => (
                                <button key={size} onClick={() => handleChange('wavetableSize', size)} className={`flex-1 py-2 text-xs font-bold rounded border ${settings.wavetableSize === size ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                                    {size === 2048 ? 'Low (2K)' : size === 8192 ? 'Med (8K)' : 'HiFi (64K)'}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Interpolation</label>
                        <div className="flex gap-2">
                            <button onClick={() => handleChange('interpolationType', 'linear')} className={`flex-1 py-2 text-xs font-bold rounded border ${settings.interpolationType === 'linear' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                                Linear
                            </button>
                            <button onClick={() => handleChange('interpolationType', 'cubic')} className={`flex-1 py-2 text-xs font-bold rounded border ${settings.interpolationType === 'cubic' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                                Cubic (Smooth)
                            </button>
                        </div>
                        <p className="text-[9px] text-slate-500 italic mt-2">Cubic removes grit for deep FM synthesis but uses slightly more CPU.</p>
                    </div>
                </div>

                <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                    <label className="block text-sm font-semibold text-slate-300">Audio Latency Mode</label>
                    <div className="flex gap-2">
                        {['interactive', 'balanced', 'playback'].map(mode => (
                            <button key={mode} onClick={() => handleChange('audioLatencyHint', mode)} className={`flex-1 py-2 text-xs font-bold rounded border capitalize ${settings.audioLatencyHint === mode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                                {mode === 'interactive' ? 'Low (Fast)' : mode === 'playback' ? 'High (Stable)' : mode}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Lower latency is better for performance but may cause clicks on weaker devices.</p>
                </div>
                
                <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                    <label className="block text-sm font-semibold text-slate-300">Max Polyphony</label>
                    <div className="flex items-center gap-3">
                        <input 
                            type="range" 
                            min="1" 
                            max="64" 
                            step="1" 
                            value={settings.polyphony} 
                            onChange={(e) => handleChange('polyphony', parseInt(e.target.value))} 
                            className="flex-grow h-2 bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                        />
                        <span className="text-xs font-mono font-bold w-8 text-right text-indigo-300">{settings.polyphony}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Limits simultaneous voices. Lower this if audio crackles.</p>
                </div>

                <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1 mt-6">Interaction</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-semibold">Enable Keyboard Shortcuts</span>
                    <input type="checkbox" checked={settings.enableKeyboardShortcuts} onChange={(e) => handleChange('enableKeyboardShortcuts', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-indigo-500" />
                  </label>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold">Strum Duration</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0.1" max="2.0" step="0.1" value={settings.strumDuration} onChange={(e) => handleChange('strumDuration', parseFloat(e.target.value))} className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                      <span className="text-xs font-mono w-10">{settings.strumDuration.toFixed(1)}s</span>
                    </div>
                  </div>
                </div>

                <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1 mt-6">Recording</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer bg-slate-900/40 p-3 rounded border border-slate-700/50">
                    <div className="space-y-1">
                        <span className="text-sm font-semibold text-white">Enable Audio Capture</span>
                        <p className="text-[10px] text-slate-500">Enable internal high-quality audio recording.</p>
                    </div>
                    <input type="checkbox" checked={settings.enableAudioRecording} onChange={handleToggleAudioRecording} className="w-5 h-5 rounded border-slate-600 text-indigo-500" />
                  </label>
                </div>
              </div>
              
              <div className="space-y-6">
                <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1">Key Bindings</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Modes & Patch</div>
                  {renderKeyBinding('Drone Mode', 'modeDrone')}
                  {renderKeyBinding('Strings Mode', 'modeStrings')}
                  {renderKeyBinding('Plucked Mode', 'modePlucked')}
                  {renderKeyBinding('Toggle Synth', 'synth')}
                  
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Expression</div>
                  {renderKeyBinding('Sustain', 'sustain')}
                  {renderKeyBinding('Pitch Bend', 'bend')}
                  
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Global</div>
                  {renderKeyBinding('BPM Up', 'bpmUp')}
                  {renderKeyBinding('BPM Down', 'bpmDown')}
                  {renderKeyBinding('Add Chord', 'addChord')}
                  {renderKeyBinding('Center View', 'center')}
                  
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">Arpeggiator</div>
                  {renderKeyBinding('Toggle Seq', 'toggleSequencer')}
                  {renderKeyBinding('Play All', 'playAllArps')}
                  {renderKeyBinding('Stop All', 'stopAllArps')}
                  
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">System</div>
                  {renderKeyBinding('All Notes Off', 'off')}
                  {renderKeyBinding('Panic', 'panic')}
                  {renderKeyBinding('Open Settings', 'settings')}
                  {renderKeyBinding('Volume Up', 'volumeUp')}
                  {renderKeyBinding('Volume Down', 'volumeDown')}
                </div>
              </div>
            </div>
        </div>
    );
};

export default BehaviorTab;
