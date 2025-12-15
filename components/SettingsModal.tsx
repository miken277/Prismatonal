
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AppSettings, ButtonShape, ChordDefinition, KeyMap } from '../types';
import { DEFAULT_COLORS } from '../constants';
import { midiService, MidiDevice } from '../services/MidiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
}

// --- HELPER COMPONENTS ---

// 1. Throttled Slider
interface ThrottledSliderProps {
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (val: number) => void;
    className?: string;
    style?: React.CSSProperties;
}

const ThrottledSlider: React.FC<ThrottledSliderProps> = ({
    value,
    min,
    max,
    step,
    onChange,
    className = "",
    style
}) => {
    const [localValue, setLocalValue] = useState(value);
    const lastEmit = useRef(0);
    const timer = useRef<number | null>(null);

    // Sync from parent if changed externally
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = parseFloat(e.target.value);
        setLocalValue(newVal);

        const now = Date.now();
        // Throttle to ~33ms (30fps) for heavy operations
        if (now - lastEmit.current > 33) {
            onChange(newVal);
            lastEmit.current = now;
        } else {
            // Trailing edge call to ensure final value is set
            if (timer.current) clearTimeout(timer.current);
            timer.current = window.setTimeout(() => {
                onChange(newVal);
                lastEmit.current = Date.now();
            }, 33);
        }
    };

    return (
        <input 
            type="range" 
            min={min} 
            max={max} 
            step={step}
            value={localValue}
            onChange={handleChange}
            className={className}
            style={style}
        />
    );
};

// 2. Number Input
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
        if (parseInt(text) !== value) {
             setText(value.toString());
             setError(null);
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val !== '' && !/^\d+$/.test(val)) return;
        setText(val);
        if (val === '') return; 

        const num = parseInt(val, 10);
        if (num < min || num > max) {
            setError(`Range: ${min}-${max}`);
        } else {
            setError(null);
            onChange(num);
        }
    };

    const handleBlur = () => {
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

// 3. Key Bind Button
interface KeyBindButtonProps {
    label: string;
    code: string;
    onBind: () => void;
}

const KeyBindButton: React.FC<KeyBindButtonProps> = ({ 
    label, 
    code, 
    onBind 
}) => {
    const display = code.replace('Key', '').replace('Digit', '').replace('BracketRight', ']').replace('BracketLeft', '[').replace('Comma', ',').replace('Period', '.');
    return (
        <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-xs text-slate-300">{label}</span>
            <button 
                onClick={onBind}
                className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs font-mono font-bold min-w-[3rem] text-center border border-slate-600"
            >
                {display}
            </button>
        </div>
    );
};

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, updateSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'behavior' | 'color' | 'midi'>('general');
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const [bindingKey, setBindingKey] = useState<keyof KeyMap | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'midi') {
        midiService.init().then(success => {
            if (success) {
                midiService.getOutputs().then(devices => {
                    setMidiDevices(devices);
                });
            }
        });
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
      if (!bindingKey) return;
      const handleBind = (e: KeyboardEvent) => {
          e.preventDefault();
          e.stopPropagation();
          updateSettings({
              ...settings,
              keyMap: { ...settings.keyMap, [bindingKey]: e.code }
          });
          setBindingKey(null);
      };
      window.addEventListener('keydown', handleBind, { capture: true });
      return () => window.removeEventListener('keydown', handleBind, { capture: true });
  }, [bindingKey, settings, updateSettings]);

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => {
    updateSettings({ ...settings, [key]: value });
  };

  const handleLimitDepthChange = (limit: 3 | 5 | 7 | 11 | 13, val: number) => {
    updateSettings({
      ...settings,
      limitDepths: { ...settings.limitDepths, [limit]: val }
    });
  };

  const handleLimitComplexityChange = (limit: 3 | 5 | 7 | 11 | 13, val: number) => {
    updateSettings({
      ...settings,
      limitComplexities: { ...settings.limitComplexities, [limit]: val }
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
     const ratios: {[key: number]: number} = { 1: 1, 3: 1.5, 5: 1.25, 7: 7/8, 11: 11/8, 13: 13/8 };
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
    <div className="fixed inset-0 bg-slate-900/90 z-[200] flex items-center justify-center">
      <div className="bg-slate-800 rounded-xl w-[95%] max-w-4xl max-h-[90vh] overflow-hidden text-slate-200 shadow-2xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800">
          <h2 className="text-2xl font-bold text-white">Lattice Configuration</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-3 py-1 bg-slate-700 rounded transition">Close</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50">
           <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 font-semibold transition ${activeTab === 'general' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Dimensions</button>
           <button onClick={() => setActiveTab('behavior')} className={`flex-1 py-3 font-semibold transition ${activeTab === 'behavior' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Behavior & Chords</button>
           <button onClick={() => setActiveTab('color')} className={`flex-1 py-3 font-semibold transition ${activeTab === 'color' ? 'text-pink-400 border-b-2 border-pink-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Visuals & Color</button>
           <button onClick={() => setActiveTab('midi')} className={`flex-1 py-3 font-semibold transition ${activeTab === 'midi' ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>MIDI</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-800 relative">
            
            {bindingKey && (
                <div className="absolute inset-0 z-50 bg-slate-900/90 flex flex-col items-center justify-center animate-in fade-in duration-200">
                    <h3 className="text-2xl font-bold text-white mb-2">Press any key...</h3>
                    <p className="text-slate-400">Binding for: <span className="text-indigo-400 capitalize">{bindingKey.replace(/([A-Z])/g, ' $1').trim()}</span></p>
                    <button onClick={() => setBindingKey(null)} className="mt-8 text-sm text-slate-500 hover:text-white">Cancel</button>
                </div>
            )}

            {/* --- General Tab --- */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="space-y-6">
                      <h3 className="font-semibold text-blue-400 border-b border-slate-700 pb-1">Grid Structure</h3>
                      
                      <div>
                          <label className="block text-sm font-semibold mb-2">Base Frequency (1/1)</label>
                          <NumberInput value={settings.baseFrequency} min={20} max={15000} suffix="Hz" onChange={(val) => handleChange('baseFrequency', val)} />
                      </div>
                      
                      <div>
                          <label className="block text-sm font-semibold mb-2">Canvas Size (Scrollable Area)</label>
                          <div className="flex items-center gap-4">
                              <ThrottledSlider 
                                  min={1000} max={10000} step={500} 
                                  value={settings.canvasSize}
                                  onChange={(val) => handleChange('canvasSize', val)}
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
                                      min={10} max={10000}
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
                            <input type="checkbox" checked={settings.uiUnlocked} onChange={(e) => handleChange('uiUnlocked', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-yellow-500 focus:ring-yellow-500" />
                            <div>
                                <span className={`font-bold block ${settings.uiUnlocked ? 'text-yellow-400' : 'text-slate-300'}`}>Unlock UI elements</span>
                                <span className="text-[10px] text-slate-400">Enable dragging of buttons and controls</span>
                            </div>
                        </label>
                       </div>

                      <div>
                          <label className="block text-sm font-semibold mb-2">Global Button Spacing ({settings.buttonSpacingScale.toFixed(1)}x)</label>
                          <ThrottledSlider 
                              min={0.5} max={5.0} step={0.1} 
                              value={settings.buttonSpacingScale}
                              onChange={(val) => handleChange('buttonSpacingScale', val)}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      <div>
                          <label className="block text-sm mb-1">Global Button Size ({settings.buttonSizeScale.toFixed(1)}x)</label>
                          <ThrottledSlider 
                              min={0.5} max={2.0} step={0.1} 
                              value={settings.buttonSizeScale}
                              onChange={(val) => handleChange('buttonSizeScale', val)}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      
                      <div className="bg-slate-900/30 p-3 rounded border border-slate-700/50">
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Node Text</label>
                          <div className="space-y-3">
                              <div>
                                  <label className="flex justify-between text-xs mb-1"><span>Text Size</span><span>{settings.nodeTextSizeScale.toFixed(2)}x</span></label>
                                  <ThrottledSlider 
                                      min={0.5} max={2.0} step={0.05} 
                                      value={settings.nodeTextSizeScale}
                                      onChange={(val) => handleChange('nodeTextSizeScale', val)}
                                      className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                                  />
                              </div>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                  <input type="checkbox" checked={settings.showFractionBar} onChange={(e) => handleChange('showFractionBar', e.target.checked)} className="rounded border-slate-600 bg-slate-700" />
                                  <span className="text-xs text-slate-300">Show Fraction Bar</span>
                              </label>
                          </div>
                      </div>

                       <div>
                           <label className="block text-sm mb-1">Button Shape</label>
                           <div className="flex gap-2">
                             <button onClick={() => handleChange('buttonShape', ButtonShape.CIRCLE)} className={`px-3 py-1 rounded ${settings.buttonShape === ButtonShape.CIRCLE ? 'bg-blue-600' : 'bg-slate-700'}`}>Circle</button>
                             <button onClick={() => handleChange('buttonShape', ButtonShape.DIAMOND)} className={`px-3 py-1 rounded ${settings.buttonShape === ButtonShape.DIAMOND ? 'bg-blue-600' : 'bg-slate-700'}`}>Diamond</button>
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
                    <label className="block text-sm font-semibold mb-2">Polyphony (Voices)</label>
                    <div className="flex items-center gap-4">
                        <input type="range" min="1" max="20" step="1" value={settings.polyphony} onChange={(e) => handleChange('polyphony', parseInt(e.target.value))} className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        <span className="text-xl font-bold min-w-[2ch]">{settings.polyphony}</span>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                     <label className="flex items-center space-x-2 cursor-pointer p-2 bg-slate-900/50 rounded border border-slate-700">
                       <input type="checkbox" checked={settings.isPitchBendEnabled} onChange={(e) => handleChange('isPitchBendEnabled', e.target.checked)} className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                       <div className="flex flex-col">
                           <span className="font-semibold text-indigo-300">Enable Pitch Bend (Drag)</span>
                           <span className="text-[10px] text-slate-500">Drag away from node center to bend pitch</span>
                       </div>
                     </label>

                     <label className="flex items-center space-x-2 cursor-pointer p-2 bg-slate-900/50 rounded border border-slate-700">
                       <input type="checkbox" checked={settings.autoLatchOnDrag} onChange={(e) => handleChange('autoLatchOnDrag', e.target.checked)} className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500" />
                       <div className="flex flex-col">
                           <span className="font-semibold text-indigo-300">Auto-Latch/Play on Drag</span>
                           <span className="text-[10px] text-slate-500">Sliding over new nodes triggers them (Draw Chords/Strum)</span>
                       </div>
                     </label>
                     
                     <div className="bg-slate-900/50 rounded border border-slate-700 p-2">
                         <div className="flex justify-between items-center mb-1">
                             <span className="text-xs font-semibold text-indigo-300">Strum Note Duration</span>
                             <span className="text-xs font-mono">{settings.strumDurationMs} ms</span>
                         </div>
                         <ThrottledSlider 
                            min={50} max={2000} step={10} 
                            value={settings.strumDurationMs} 
                            onChange={(val) => handleChange('strumDurationMs', val)}
                            className="w-full h-1 bg-indigo-700 rounded appearance-none"
                         />
                         <p className="text-[10px] text-slate-500 mt-1">Duration of notes when dragged over from outside.</p>
                     </div>
                  </div>

                   {/* SHORTCUTS SECTION */}
                   <div className="mt-8 pt-6 border-t border-slate-700">
                      <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1 mb-4">Keyboard Shortcuts</h3>
                      <div className="bg-slate-900/50 rounded border border-slate-700 p-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                          {Object.keys(settings.keyMap).map(k => (
                              <KeyBindButton key={k} label={k} code={settings.keyMap[k as keyof KeyMap]} onBind={() => setBindingKey(k as keyof KeyMap)} />
                          ))}
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                    <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1">Visual Feedback</h3>
                    
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
                                    <ThrottledSlider 
                                        min={0.0} max={1.0} step={0.01} 
                                        value={settings.voiceLeadingGlowAmount}
                                        onChange={(val) => handleChange('voiceLeadingGlowAmount', val)}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-xs mb-1 text-slate-400">Speed</label>
                                    <ThrottledSlider 
                                        min={0.5} max={5.0} step={0.5} 
                                        value={settings.voiceLeadingAnimationSpeed}
                                        onChange={(val) => handleChange('voiceLeadingAnimationSpeed', val)}
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
                            <ThrottledSlider 
                                min={0.33} max={1.0} step={0.01} 
                                value={settings.chordShortcutSizeScale}
                                onChange={(val) => handleChange('chordShortcutSizeScale', val)}
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
                                         <label className="flex justify-between text-xs text-slate-400 mb-1"><span>Size</span> <span>{currentVis.size.toFixed(2)}x</span></label>
                                         <ThrottledSlider 
                                             min={0.1} max={1.5} step={0.05}
                                             value={currentVis.size}
                                             onChange={(val) => handleLimitVisualChange(limit, 'size', val)}
                                             className="w-full h-1 bg-slate-600 rounded appearance-none"
                                         />
                                     </div>
                                     <div>
                                         <label className="flex justify-between text-xs text-slate-400 mb-1"><span>Opacity</span> <span>{(currentVis.opacity * 100).toFixed(0)}%</span></label>
                                         <ThrottledSlider 
                                             min={0.0} max={1.0} step={0.05}
                                             value={currentVis.opacity}
                                             onChange={(val) => handleLimitVisualChange(limit, 'opacity', val)}
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
                                <label className="flex justify-between text-xs text-slate-400 mb-1"><span>Background Brightness</span><span>{settings.rainbowBrightness}%</span></label>
                                <ThrottledSlider min={0} max={100} step={1} value={settings.rainbowBrightness} onChange={(val) => handleChange('rainbowBrightness', val)} className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <label className="flex justify-between text-xs text-slate-400 mb-1"><span>Background Saturation</span><span>{settings.rainbowSaturation}%</span></label>
                                <ThrottledSlider min={0} max={100} step={1} value={settings.rainbowSaturation} onChange={(val) => handleChange('rainbowSaturation', val)} className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <label className="flex justify-between text-xs text-slate-400 mb-1"><span>Vertical Offset (Hue Shift)</span><span>{settings.rainbowOffset}°</span></label>
                                <ThrottledSlider 
                                    min={0} max={360} step={1} 
                                    value={settings.rainbowOffset} 
                                    onChange={(val) => handleChange('rainbowOffset', val)} 
                                    className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" 
                                    style={{ backgroundImage: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }} 
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
                        <button onClick={resetColors} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white transition-colors border border-slate-500/50 mb-2">Default Colors</button>
                        <button onClick={pairLimitColors} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white transition-colors border border-slate-500/50">Pair Limit Colors with Background</button>
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
                                <input type="checkbox" checked={settings.midiEnabled} onChange={(e) => handleChange('midiEnabled', e.target.checked)} className="w-6 h-6 rounded border-slate-600 text-green-500 focus:ring-green-500" />
                                <div><span className={`font-bold block ${settings.midiEnabled ? 'text-green-400' : 'text-slate-300'}`}>Enable MIDI Output</span><span className="text-xs text-slate-400">Send notes to external synths/DAW</span></div>
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
                                    {midiDevices.length === 0 && <p className="text-[10px] text-orange-400 mt-1">No MIDI devices found. Check connection or browser permissions.</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2">Pitch Bend Range (+/- Semitones)</label>
                                    <div className="flex gap-2">
                                        {[2, 12, 24, 48].map(range => (
                                            <button key={range} onClick={() => handleChange('midiPitchBendRange', range)} className={`px-3 py-1 rounded text-xs font-bold border ${settings.midiPitchBendRange === range ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>{range}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
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
