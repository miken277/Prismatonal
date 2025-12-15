
import React, { useRef, useState, useEffect } from 'react';
import { AppSettings, ButtonShape, ChordDefinition } from '../types';
import { DEFAULT_COLORS } from '../constants';
import { midiService, MidiDevice } from '../services/MidiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
}

// Helper component for Validated Numeric Input
const NumberInput = ({
    value,
    min,
    max,
    onChange,
    suffix = "",
    className = ""
}: {
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
    suffix?: string;
    className?: string;
}) => {
    const [text, setText] = useState(value.toString());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Sync with external updates if they differ from current valid text
        if (parseInt(text) !== value) {
             setText(value.toString());
             setError(null);
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        
        // Strict Reject: Only allow digits. 
        if (val !== '' && !/^\d+$/.test(val)) return;

        setText(val);

        if (val === '') return; 

        const num = parseInt(val, 10);
        if (num < min || num > max) {
            setError(`Range: ${min}-${max}`);
            // Reject input: Do not call onChange
        } else {
            setError(null);
            onChange(num);
        }
    };

    const handleBlur = () => {
        // Revert to last valid value on blur if empty or invalid
        if (text === '' || error) {
            setText(value.toString());
            setError(null);
        }
    };

    return (
        <div className="flex flex-col flex-grow">
            <div className="relative">
                <input 
                    type="text" 
                    inputMode="numeric"
                    value={text}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full bg-slate-700 rounded p-2 text-sm text-white border border-slate-600 focus:outline-none focus:border-blue-500 transition-colors ${className} ${error ? 'border-red-500 focus:border-red-500' : ''}`}
                />
                {suffix && <span className="absolute right-3 top-2 text-sm text-slate-400 pointer-events-none">{suffix}</span>}
            </div>
            {error && <span className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">{error}</span>}
        </div>
    );
};

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, updateSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'behavior' | 'color' | 'midi'>('general');
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);

  // Init MIDI list when opening MIDI tab
  useEffect(() => {
    if (isOpen && activeTab === 'midi') {
        midiService.init().then(success => {
            if (success) {
                // Now await the asynchronous device list
                midiService.getOutputs().then(devices => {
                    setMidiDevices(devices);
                });
            }
        });
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => {
    updateSettings({ ...settings, [key]: value });
  };

  const handleLimitDepthChange = (limit: 3 | 5 | 7 | 11 | 13, val: number) => {
    updateSettings({
      ...settings,
      limitDepths: {
        ...settings.limitDepths,
        [limit]: val
      }
    });
  };

  const handleLimitComplexityChange = (limit: 3 | 5 | 7 | 11 | 13, val: number) => {
    updateSettings({
      ...settings,
      limitComplexities: {
        ...settings.limitComplexities,
        [limit]: val
      }
    });
  };

  const handleColorChange = (limit: number, color: string) => {
    updateSettings({
      ...settings,
      colors: { ...settings.colors, [limit]: color }
    });
  };
  
  const handleLimitVisualChange = (limit: number, key: 'size' | 'opacity', val: number) => {
      const current = settings.limitVisuals?.[limit] || { size: 1, opacity: 1 };
      updateSettings({
          ...settings,
          limitVisuals: {
              ...settings.limitVisuals,
              [limit]: { ...current, [key]: val }
          }
      });
  };
  
  const updateChord = (index: number, field: keyof ChordDefinition, value: any) => {
      const newChords = [...settings.savedChords];
      newChords[index] = { ...newChords[index], [field]: value };
      updateSettings({ ...settings, savedChords: newChords });
  };

  const resetColors = () => {
    updateSettings({ ...settings, colors: { ...DEFAULT_COLORS } });
  };

  const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const pairLimitColors = () => {
     const ratios: {[key: number]: number} = {
         1: 1,
         3: 1.5,
         5: 1.25,
         7: 7/8,
         11: 11/8,
         13: 13/8
     };

     const newColors = { ...settings.colors };
     const offset = settings.rainbowOffset;
     
     Object.keys(ratios).forEach(k => {
         const key = parseInt(k);
         const ratio = ratios[key];
         const shift = -Math.log2(ratio) * 360;
         let hue = (offset + shift) % 360;
         if (hue < 0) hue += 360;
         
         newColors[key] = hslToHex(hue, 70, 60); 
     });

     updateSettings({ ...settings, colors: newColors });
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl w-[95%] max-w-4xl max-h-[90vh] overflow-hidden text-slate-200 shadow-2xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800">
          <h2 className="text-2xl font-bold text-white">Lattice Configuration</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-3 py-1 bg-slate-700 rounded transition">Close</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50">
           <button 
             onClick={() => setActiveTab('general')}
             className={`flex-1 py-3 font-semibold transition ${activeTab === 'general' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Dimensions
           </button>
           <button 
             onClick={() => setActiveTab('behavior')}
             className={`flex-1 py-3 font-semibold transition ${activeTab === 'behavior' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Behavior & Chords
           </button>
           <button 
             onClick={() => setActiveTab('color')}
             className={`flex-1 py-3 font-semibold transition ${activeTab === 'color' ? 'text-pink-400 border-b-2 border-pink-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Visuals & Color
           </button>
           <button 
             onClick={() => setActiveTab('midi')}
             className={`flex-1 py-3 font-semibold transition ${activeTab === 'midi' ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             MIDI
           </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-800">
            
            {/* --- General Tab --- */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="space-y-6">
                      <h3 className="font-semibold text-blue-400 border-b border-slate-700 pb-1">Grid Structure</h3>
                      
                      <div>
                          <label className="block text-sm font-semibold mb-2">Base Frequency (1/1)</label>
                          <NumberInput 
                              value={settings.baseFrequency}
                              min={20}
                              max={15000}
                              suffix="Hz"
                              onChange={(val) => handleChange('baseFrequency', val)}
                          />
                      </div>
                      
                      <div>
                          <label className="block text-sm font-semibold mb-2">Canvas Size (Scrollable Area)</label>
                          <div className="flex items-center gap-4">
                              <input 
                                  type="range" min="1000" max="10000" step="500" 
                                  value={settings.canvasSize}
                                  onChange={(e) => handleChange('canvasSize', parseInt(e.target.value))}
                                  className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-sm font-mono min-w-[5ch]">{settings.canvasSize}px</span>
                          </div>
                      </div>

                      <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                          <label className="block text-sm font-semibold text-slate-300">Lattice Depth</label>
                          <p className="text-[10px] text-slate-500 mb-2">Controls how many steps outward from the center are generated for each axis.</p>
                          
                          {[3, 5, 7, 11, 13].map(limit => (
                              <div key={limit} className="flex items-center gap-3">
                                  <span className="w-16 text-xs font-bold text-slate-400">{limit}-Limit</span>
                                  <input 
                                      type="range" min="0" max="6" step="1" 
                                      value={settings.limitDepths[limit as 3|5|7|11|13]}
                                      onChange={(e) => handleLimitDepthChange(limit as any, parseInt(e.target.value))}
                                      className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                  <span className="text-xs font-mono w-4 text-right">{settings.limitDepths[limit as 3|5|7|11|13]}</span>
                              </div>
                          ))}
                      </div>

                       <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                          <label className="block text-sm font-semibold text-slate-300">Lattice Complexity (Max N/D)</label>
                          <p className="text-[10px] text-slate-500 mb-2">Controls the maximum Numerator or Denominator allowed for a node generated by extending this axis.</p>
                          
                          {[3, 5, 7, 11, 13].map(limit => (
                              <div key={`comp-${limit}`} className="flex items-center gap-3">
                                  <span className="w-16 text-xs font-bold text-slate-400">{limit}-Limit</span>
                                  <NumberInput 
                                      value={settings.limitComplexities[limit as 3|5|7|11|13]}
                                      min={10}
                                      max={10000}
                                      onChange={(val) => handleLimitComplexityChange(limit as any, val)}
                                  />
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="space-y-6">
                      <h3 className="font-semibold text-blue-400 border-b border-slate-700 pb-1">Display</h3>
                      
                       <div className="mb-4">
                        <label className="flex items-center space-x-3 cursor-pointer p-3 bg-slate-700/50 rounded-lg border border-yellow-500/30 hover:bg-slate-700/80 transition">
                            <input 
                                type="checkbox" 
                                checked={settings.uiUnlocked} 
                                onChange={(e) => handleChange('uiUnlocked', e.target.checked)} 
                                className="w-5 h-5 rounded border-slate-600 text-yellow-500 focus:ring-yellow-500" 
                            />
                            <div>
                                <span className={`font-bold block ${settings.uiUnlocked ? 'text-yellow-400' : 'text-slate-300'}`}>
                                    Unlock UI elements
                                </span>
                                <span className="text-[10px] text-slate-400">Enable dragging of buttons and controls</span>
                            </div>
                        </label>
                       </div>

                      <div>
                          <label className="block text-sm font-semibold mb-2">Global Button Spacing ({settings.buttonSpacingScale.toFixed(1)}x)</label>
                          <input 
                              type="range" min="0.5" max="5.0" step="0.1" 
                              value={settings.buttonSpacingScale}
                              onChange={(e) => handleChange('buttonSpacingScale', parseFloat(e.target.value))}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      <div>
                          <label className="block text-sm mb-1">Global Button Size ({settings.buttonSizeScale.toFixed(1)}x)</label>
                          <input 
                              type="range" min="0.5" max="2.0" step="0.1" 
                              value={settings.buttonSizeScale}
                              onChange={(e) => handleChange('buttonSizeScale', parseFloat(e.target.value))}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      
                      <div className="bg-slate-900/30 p-3 rounded border border-slate-700/50">
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Node Text</label>
                          <div className="space-y-3">
                              <div>
                                  <label className="flex justify-between text-xs mb-1">
                                      <span>Text Size</span>
                                      <span>{settings.nodeTextSizeScale.toFixed(2)}x</span>
                                  </label>
                                  <input 
                                      type="range" min="0.5" max="2.0" step="0.05" 
                                      value={settings.nodeTextSizeScale}
                                      onChange={(e) => handleChange('nodeTextSizeScale', parseFloat(e.target.value))}
                                      className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                  />
                              </div>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={settings.showFractionBar} 
                                    onChange={(e) => handleChange('showFractionBar', e.target.checked)}
                                    className="rounded border-slate-600 bg-slate-700"
                                  />
                                  <span className="text-xs text-slate-300">Show Fraction Bar</span>
                              </label>
                          </div>
                      </div>

                       <div>
                           <label className="block text-sm mb-1">Button Shape</label>
                           <div className="flex gap-2">
                             <button 
                               onClick={() => handleChange('buttonShape', ButtonShape.CIRCLE)}
                               className={`px-3 py-1 rounded ${settings.buttonShape === ButtonShape.CIRCLE ? 'bg-blue-600' : 'bg-slate-700'}`}
                             >Circle</button>
                             <button 
                               onClick={() => handleChange('buttonShape', ButtonShape.DIAMOND)}
                               className={`px-3 py-1 rounded ${settings.buttonShape === ButtonShape.DIAMOND ? 'bg-blue-600' : 'bg-slate-700'}`}
                             >Diamond</button>
                           </div>
                      </div>
                  </div>
              </div>
            )}

            {/* --- Behavior Tab --- */}
            {activeTab === 'behavior' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                <div className="space-y-6">
                   <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1">Interactions</h3>
                   
                   <div>
                       <label className="flex items-center space-x-2 mb-2 p-2 bg-slate-900/50 rounded border border-teal-500/30">
                          <input type="checkbox" checked={settings.isLatchModeEnabled} onChange={(e) => handleChange('isLatchModeEnabled', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-teal-500 focus:ring-teal-500" />
                          <span className="font-semibold text-teal-300">Latch Mode</span>
                      </label>
                      <div className={`transition-opacity pl-4 border-l-2 border-slate-700 ${settings.isLatchModeEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                          <label className="block text-xs mb-1 text-slate-400">Harmonic Reach (Latch & Visuals)</label>
                          <div className="flex gap-2 items-center">
                              <input 
                                  type="range" min="1" max="6" step="1" 
                                  value={settings.latchShellLimit}
                                  onChange={(e) => handleChange('latchShellLimit', parseInt(e.target.value))}
                                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xs font-mono">{settings.latchShellLimit}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">1=Octaves, 2=5th (3), 3=3rd (5), 4=7th...</p>
                      </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Polyphony (Voices)</label>
                    <div className="flex items-center gap-4">
                        <input 
                            type="range" min="1" max="20" step="1" 
                            value={settings.polyphony}
                            onChange={(e) => handleChange('polyphony', parseInt(e.target.value))}
                            className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xl font-bold min-w-[2ch]">{settings.polyphony}</span>
                    </div>
                  </div>

                  <div className="text-sm">
                     <label className="flex items-center space-x-2 cursor-pointer">
                       <input type="checkbox" checked={settings.isPitchBendEnabled} onChange={(e) => handleChange('isPitchBendEnabled', e.target.checked)} className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                       <span>Enable Pitch Bend (Drag)</span>
                     </label>
                  </div>
                </div>

                <div className="space-y-6">
                    <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1">Visual Feedback</h3>
                    
                    <div>
                        <label className="block text-sm font-semibold mb-2">Latched Zoom ({settings.latchedZoomScale.toFixed(1)}x)</label>
                        <input 
                            type="range" min="1.0" max="2.0" step="0.1" 
                            value={settings.latchedZoomScale}
                            onChange={(e) => handleChange('latchedZoomScale', parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <div>
                        <label className="flex items-center space-x-2 mb-2 p-2 bg-slate-900/50 rounded border border-indigo-500/30">
                            <input type="checkbox" checked={settings.isVoiceLeadingEnabled} onChange={(e) => handleChange('isVoiceLeadingEnabled', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                            <span className="font-semibold text-indigo-300">Voice Leading Lines</span>
                        </label>
                        <div className={`space-y-4 pl-4 border-l-2 border-slate-700 transition-opacity ${settings.isVoiceLeadingEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div>
                                <label className="flex items-center space-x-2 mb-2">
                                   <input type="checkbox" checked={settings.isVoiceLeadingAnimationEnabled} onChange={(e) => handleChange('isVoiceLeadingAnimationEnabled', e.target.checked)} className="w-4 h-4 rounded border-slate-600" />
                                   <span className="text-xs text-indigo-300">Animate Connections</span>
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="col-span-2">
                                    <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                                       <input type="checkbox" checked={settings.voiceLeadingReverseDir} onChange={(e) => handleChange('voiceLeadingReverseDir', e.target.checked)} className="w-4 h-4 rounded border-slate-600" />
                                       <span className="text-xs text-slate-300">Reverse Direction</span>
                                    </label>
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-xs mb-1 text-slate-400">Glow Width</label>
                                    <input 
                                        type="range" min="0.0" max="1.0" step="0.01" 
                                        value={settings.voiceLeadingGlowAmount}
                                        onChange={(e) => handleChange('voiceLeadingGlowAmount', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-xs mb-1 text-slate-400">Speed</label>
                                    <input 
                                        type="range" min="0.5" max="5.0" step="0.5" 
                                        value={settings.voiceLeadingAnimationSpeed}
                                        onChange={(e) => handleChange('voiceLeadingAnimationSpeed', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- CHORD EDITOR SECTION --- */}
                <div className="col-span-1 md:col-span-2 space-y-4 pt-6 mt-6 border-t border-slate-700">
                    <h3 className="font-semibold text-green-400 border-b border-slate-700 pb-1">Chords Configuration</h3>
                    
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-semibold mb-2">Chord Shortcut Size ({settings.chordShortcutSizeScale.toFixed(2)}x)</label>
                            <input 
                                type="range" min="0.33" max="1.0" step="0.01" 
                                value={settings.chordShortcutSizeScale}
                                onChange={(e) => handleChange('chordShortcutSizeScale', parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex-1 flex flex-col justify-end space-y-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                               <input type="checkbox" checked={settings.chordsAlwaysRelatch} onChange={(e) => handleChange('chordsAlwaysRelatch', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-green-500 focus:ring-green-500" />
                               <span className="text-sm font-semibold text-slate-300">Chords always relatch all notes</span>
                            </label>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                        <div className="grid grid-cols-[40px_40px_60px_100px_1fr] gap-2 p-2 bg-slate-800 text-xs font-bold text-slate-400 border-b border-slate-700">
                            <div className="text-center">Slot</div>
                            <div className="text-center">Show</div>
                            <div className="text-center">Color</div>
                            <div>Label</div>
                            <div>Nodes (Ratios)</div>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {settings.savedChords.map((chord, index) => (
                                <div key={chord.id} className="grid grid-cols-[40px_40px_60px_100px_1fr] gap-2 p-2 border-b border-slate-700/50 items-center hover:bg-slate-800/50 transition-colors">
                                    <div className="text-center font-mono font-bold text-slate-500">{chord.id}</div>
                                    <div className="text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={chord.visible} 
                                            onChange={(e) => updateChord(index, 'visible', e.target.checked)}
                                            className="rounded border-slate-600 bg-slate-700 text-blue-500"
                                        />
                                    </div>
                                    <div className="flex justify-center">
                                        <input 
                                            type="color" 
                                            value={chord.color} 
                                            onChange={(e) => updateChord(index, 'color', e.target.value)}
                                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-none"
                                        />
                                    </div>
                                    <div>
                                        <input 
                                            type="text" 
                                            value={chord.label} 
                                            onChange={(e) => updateChord(index, 'label', e.target.value)}
                                            className="w-full bg-transparent border-b border-slate-600 focus:border-blue-500 outline-none text-xs"
                                        />
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono truncate">
                                        {chord.nodes.length > 0 
                                            ? chord.nodes.map(n => `${n.n}/${n.d}`).join(', ') 
                                            : <span className="text-slate-600 italic">Empty</span>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

              </div>
            )}

            {/* --- Colors Tab --- */}
            {activeTab === 'color' && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="space-y-6">
                      <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Limit Appearance</h3>
                      <p className="text-[10px] text-slate-400">Customize the visual style of each prime limit layer.</p>
                      
                      <div className="space-y-4">
                        {[1, 3, 5, 7, 11, 13].map(limit => {
                           const currentVis = settings.limitVisuals?.[limit] || { size: 1, opacity: 1 };
                           return (
                               <div key={limit} className="bg-slate-900/40 p-3 rounded flex flex-col gap-2">
                                 <div className="flex justify-between items-center">
                                     <div className="flex items-center gap-3">
                                         <input 
                                           type="color" 
                                           value={settings.colors[limit]} 
                                           onChange={(e) => handleColorChange(limit, e.target.value)}
                                           className="w-6 h-6 rounded cursor-pointer bg-transparent border-none"
                                         />
                                         <span className="text-sm font-bold">{limit}-Limit</span>
                                     </div>
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-4">
                                     <div>
                                         <label className="flex justify-between text-xs text-slate-400 mb-1">
                                             <span>Size</span> <span>{currentVis.size.toFixed(2)}x</span>
                                         </label>
                                         <input 
                                             type="range" min="0.1" max="1.5" step="0.05"
                                             value={currentVis.size}
                                             onChange={(e) => handleLimitVisualChange(limit, 'size', parseFloat(e.target.value))}
                                             className="w-full h-1 bg-slate-600 rounded appearance-none"
                                         />
                                     </div>
                                     <div>
                                         <label className="flex justify-between text-xs text-slate-400 mb-1">
                                             <span>Opacity</span> <span>{(currentVis.opacity * 100).toFixed(0)}%</span>
                                         </label>
                                         <input 
                                             type="range" min="0.0" max="1.0" step="0.05"
                                             value={currentVis.opacity}
                                             onChange={(e) => handleLimitVisualChange(limit, 'opacity', parseFloat(e.target.value))}
                                             className="w-full h-1 bg-slate-600 rounded appearance-none"
                                         />
                                     </div>
                                 </div>
                               </div>
                           );
                        })}
                      </div>
                  </div>

                  <div className="space-y-6">
                      <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Rainbow Mode</h3>
                      
                      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <label className="flex items-center space-x-3 mb-4 cursor-pointer">
                            <input type="checkbox" checked={settings.isRainbowModeEnabled} onChange={(e) => handleChange('isRainbowModeEnabled', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-pink-500 focus:ring-pink-500" />
                            <span className="font-bold text-white">Enable Rainbow Background</span>
                        </label>
                        
                        <div className={`space-y-4 ${settings.isRainbowModeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'} transition-opacity`}>
                            <div>
                                <label className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>Background Brightness</span>
                                    <span>{settings.rainbowBrightness}%</span>
                                </label>
                                <input 
                                    type="range" min="0" max="100" 
                                    value={settings.rainbowBrightness}
                                    onChange={(e) => handleChange('rainbowBrightness', parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <label className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>Background Saturation</span>
                                    <span>{settings.rainbowSaturation}%</span>
                                </label>
                                <input 
                                    type="range" min="0" max="100" 
                                    value={settings.rainbowSaturation}
                                    onChange={(e) => handleChange('rainbowSaturation', parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <label className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>Vertical Offset (Hue Shift)</span>
                                    <span>{settings.rainbowOffset}°</span>
                                </label>
                                <input 
                                    type="range" min="0" max="360" 
                                    value={settings.rainbowOffset}
                                    onChange={(e) => handleChange('rainbowOffset', parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        backgroundImage: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
                                    }}
                                />
                            </div>
                        </div>
                      </div>

                       <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-3">
                         <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" checked={settings.isColoredIlluminationEnabled} onChange={(e) => handleChange('isColoredIlluminationEnabled', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-pink-500 focus:ring-pink-500" />
                            <div>
                                <span className="font-bold text-white block">Colored Illumination</span>
                                <span className="text-xs text-slate-400">Node outline uses pitch-rainbow color when latched</span>
                            </div>
                        </label>
                        
                        <button 
                            onClick={resetColors}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white transition-colors border border-slate-500/50 mb-2"
                        >
                            Default Colors
                        </button>

                        <button 
                            onClick={pairLimitColors}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white transition-colors border border-slate-500/50"
                        >
                            Pair Limit Colors with Background
                        </button>
                        <p className="text-[10px] text-slate-400 mt-1">Updates Limit Colors to match the background hue at 1/1, 3/2, 5/4, etc.</p>
                       </div>

                  </div>
               </div>
            )}

            {/* --- MIDI Tab --- */}
            {activeTab === 'midi' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="space-y-6">
                        <h3 className="font-semibold text-green-400 border-b border-slate-700 pb-1">MIDI Configuration</h3>
                        
                        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-4">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={settings.midiEnabled} 
                                    onChange={(e) => handleChange('midiEnabled', e.target.checked)} 
                                    className="w-6 h-6 rounded border-slate-600 text-green-500 focus:ring-green-500" 
                                />
                                <div>
                                    <span className={`font-bold block ${settings.midiEnabled ? 'text-green-400' : 'text-slate-300'}`}>
                                        Enable MIDI Output
                                    </span>
                                    <span className="text-xs text-slate-400">Send notes to external synths/DAW</span>
                                </div>
                            </label>

                            <div className={`${settings.midiEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'} transition-opacity space-y-4`}>
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Output Device</label>
                                    <select 
                                        value={settings.midiOutputId || ''}
                                        onChange={(e) => {
                                            const id = e.target.value || null;
                                            handleChange('midiOutputId', id);
                                            midiService.setOutput(id);
                                        }}
                                        className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                                    >
                                        <option value="">Select MIDI Output...</option>
                                        {midiDevices.map(device => (
                                            <option key={device.id} value={device.id}>{device.name}</option>
                                        ))}
                                    </select>
                                    {midiDevices.length === 0 && (
                                        <p className="text-[10px] text-orange-400 mt-1">No MIDI devices found. Check connection or browser permissions.</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2">Pitch Bend Range (+/- Semitones)</label>
                                    <p className="text-[10px] text-slate-400 mb-2">
                                        Must match the setting on your external synth for accurate microtonality.
                                        MPE Synths usually default to 48 or 24.
                                    </p>
                                    <div className="flex gap-2">
                                        {[2, 12, 24, 48].map(range => (
                                            <button 
                                                key={range}
                                                onClick={() => handleChange('midiPitchBendRange', range)}
                                                className={`px-3 py-1 rounded text-xs font-bold border ${settings.midiPitchBendRange === range ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                            >
                                                {range}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/30">
                             <h4 className="text-sm font-bold text-blue-300 mb-2">How it works (MPE Style)</h4>
                             <p className="text-xs text-slate-300 leading-relaxed">
                                PrismaTonal rotates through MIDI Channels 1-16 for every new note trigger. 
                                This allows each touch to have its own independent Pitch Bend message, enabling true polyphonic microtonality.
                                <br/><br/>
                                Ensure your external synth is in <strong>MPE Mode</strong> or set to <strong>Multi-Channel</strong> mode with the same patch loaded on all channels.
                             </p>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
