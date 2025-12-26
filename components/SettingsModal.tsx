import React, { useRef, useState, useEffect } from 'react';
import { AppSettings, ButtonShape, ChordDefinition, BackgroundMode, LimitColorMap, KeyMappings, TuningSystem, LayoutApproach } from '../types';
import { DEFAULT_COLORS, PIXELS_PER_MM } from '../constants';
import { midiService, MidiDevice } from '../services/MidiService';
import { useStore } from '../services/Store'; 

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
}

const BASE_NODE_SIZE_PX = 60;
const BASE_NODE_SPACING_PX = 200;

// Adjustment factor based on user feedback that screen dimensions appear half the calculated size
const VISUAL_CORRECTION_FACTOR = 2.0;

const MmSlider = ({ 
    valueScale, 
    onChangeScale, 
    toMm, 
    fromMm, 
    minMm, 
    maxMm, 
    stepMm = 1 
}: { 
    valueScale: number; 
    onChangeScale: (v: number) => void; 
    toMm: (v: number) => number; 
    fromMm: (v: number) => number; 
    minMm: number; 
    maxMm: number;
    stepMm?: number;
}) => {
    const currentMm = toMm(valueScale);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMm = parseFloat(e.target.value);
        onChangeScale(fromMm(newMm));
    };

    return (
        <div className="relative pt-6 pb-2 mt-1">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-bold text-blue-300 bg-slate-800 px-2 py-0.5 rounded border border-blue-500/30 z-10 pointer-events-none">
                {Math.round(currentMm)} mm
            </span>
            <input 
                type="range" 
                min={minMm} 
                max={maxMm} 
                step={stepMm} 
                value={currentMm} 
                onChange={handleChange} 
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" 
            />
        </div>
    );
};

const NumberInput = ({ value, min, max, onChange, suffix = "", className = "", disabled = false }: { value: number; min: number; max: number; onChange: (val: number) => void; suffix?: string; className?: string; disabled?: boolean; }) => {
    const safeValue = (typeof value === 'number' && !isNaN(value)) ? value : min;
    const [text, setText] = useState(safeValue.toString());
    const [prevValue, setPrevValue] = useState(safeValue);
    const [error, setError] = useState<string | null>(null);
    if (value !== prevValue && value !== undefined && !isNaN(value)) {
        const currentNum = parseFloat(text);
        if (Math.abs(currentNum - value) > 0.0001) { setText(value.toString()); setError(null); }
        setPrevValue(value);
    }
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val !== '' && !/^[\d.]+$/.test(val)) return;
        setText(val);
        if (val === '') return; 
        const num = parseFloat(val);
        if (isNaN(num)) return;
        if (num < min || num > max) { setError(`Range: ${min}-${max}`); } else { setError(null); onChange(num); }
    };
    const handleBlur = () => {
        const num = parseFloat(text);
        if (text === '' || isNaN(num) || error) { setText(prevValue.toString()); setError(null); }
    };
    return (
        <div className={`flex flex-col flex-grow ${disabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            <div className="relative">
                <input type="text" inputMode="decimal" value={text} onChange={handleChange} onBlur={handleBlur} disabled={disabled} className={`w-full bg-slate-700 rounded p-2 text-sm text-white border border-slate-600 focus:outline-none focus:border-blue-500 transition-colors ${className} ${error ? 'border-red-500 focus:border-red-500' : ''}`} />
                {suffix && <span className="absolute right-3 top-2 text-sm text-slate-400 pointer-events-none">{suffix}</span>}
            </div>
            {error && <span className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">{error}</span>}
        </div>
    );
};

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, updateSettings }) => {
  const [activeTab, setActiveTab] = useState<'tonality' | 'behavior' | 'visuals' | 'midi' | 'data'>('tonality');
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const { exportXML, importXML } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const [listeningFor, setListeningFor] = useState<keyof KeyMappings | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'midi') {
        midiService.init().then(success => { if (success) { midiService.getOutputs().then(devices => { setMidiDevices(devices); }); } });
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
      const handleBinderKeyDown = (e: KeyboardEvent) => {
          if (!listeningFor) return;
          e.preventDefault(); e.stopPropagation();
          let key = e.key.toLowerCase(); if (key === ' ') key = 'Space';
          updateSettings({ ...settings, keyMappings: { ...settings.keyMappings, [listeningFor]: key } });
          setListeningFor(null);
      };
      if (listeningFor) window.addEventListener('keydown', handleBinderKeyDown);
      return () => window.removeEventListener('keydown', handleBinderKeyDown);
  }, [listeningFor, settings, updateSettings]);

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => updateSettings({ ...settings, [key]: value });
  const handleLimitDepthChange = (limit: number, val: number) => {
      // @ts-ignore
      updateSettings({ ...settings, limitDepths: { ...settings.limitDepths, [limit]: val } });
  };
  const handleLimitComplexityChange = (limit: number, val: number) => {
      // @ts-ignore
      updateSettings({ ...settings, limitComplexities: { ...settings.limitComplexities, [limit]: val } });
  };
  const handleColorChange = (limit: number, color: string) => updateSettings({ ...settings, colors: { ...settings.colors, [limit]: color } });
  
  const handleImportClick = () => {
      const confirmed = window.confirm(
        "WARNING: Importing will overwrite ALL system settings, keyboard mappings, user bank patches, and currently selected synth sounds. " +
        "This action cannot be undone. \n\nDo you wish to proceed?"
      );
      if (confirmed) {
          fileInputRef.current?.click();
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) importXML(file).then(success => { if (success) onClose(); });
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const base64 = readerEvent.target?.result as string;
        handleChange('backgroundImageData', base64);
        handleChange('backgroundMode', 'image');
      };
      reader.readAsDataURL(file);
    }
  };

  const renderBaseFrequency = () => (
      <div className="bg-slate-900/60 p-4 rounded-lg border border-blue-500/20 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-blue-400 text-xs uppercase tracking-widest">Global Tuning Center</h3>
            <span className="text-[9px] text-slate-500 font-mono">1/1 REFERENCE</span>
          </div>
          <NumberInput value={settings.baseFrequency} min={20} max={15000} suffix="Hz" onChange={(val) => handleChange('baseFrequency', val)} />
          <p className="text-[10px] text-slate-500 mt-2 italic">Sets the fundamental frequency for the origin node across all tuning modes.</p>
      </div>
  );

  const renderLayoutSelector = (system: TuningSystem) => {
    let options: { value: LayoutApproach; label: string }[] = [];
    
    switch (system) {
      case 'ji':
        options = [
          { value: 'lattice', label: 'Tonality Lattice' },
          { value: 'diamond', label: 'Tonality Diamond' },
        ];
        break;
      case 'et':
        options = [
          { value: 'et_wheel', label: 'Chromatic Wheel' },
          { value: 'et_grid', label: 'Keyboard Grid' },
          { value: 'et_row', label: 'Linear Strip' },
        ];
        break;
      case 'indian':
        options = [
          { value: 'indian_circle', label: 'Shruti Circle' },
          { value: 'indian_thaat', label: 'Thaat Map' },
        ];
        break;
      case 'pythagorean':
        options = [
          { value: 'pyth_spiral', label: 'Spiral of Fifths' },
          { value: 'pyth_row', label: 'Linear Stack' },
        ];
        break;
    }

    const isValid = options.some(o => o.value === settings.layoutApproach);
    if (!isValid && options.length > 0) {
      setTimeout(() => handleChange('layoutApproach', options[0].value), 0);
    }

    return (
      <div className="bg-slate-900/60 p-4 rounded-lg border border-indigo-500/20 mb-6">
          <label className="block text-[10px] text-indigo-400 font-bold uppercase mb-2 tracking-widest">Layout & Orientation</label>
          <div className="flex gap-2">
              <select 
                  value={settings.layoutApproach} 
                  onChange={(e) => {
                      const newLayout = e.target.value as LayoutApproach;
                      let newSpacing = settings.buttonSpacingScale;
                      
                      // Auto-adjust spacing defaults for specific layouts
                      // 0.756 = 20mm, 1.89 = 50mm
                      if (newLayout === 'diamond') newSpacing = 0.756; 
                      else if (newLayout === 'lattice') newSpacing = 1.89; 
                      
                      updateSettings({ 
                          ...settings, 
                          layoutApproach: newLayout,
                          buttonSpacingScale: newSpacing
                      });
                  }}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded p-1.5 text-[10px] text-white focus:outline-none focus:border-indigo-500"
              >
                  {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
              </select>
          </div>
          <p className="text-[9px] text-slate-500 mt-2 italic">Governs the geometric arrangement and orientation of pitch nodes.</p>
      </div>
    );
  };

  const scaleToMmSize = (s: number) => (s * BASE_NODE_SIZE_PX) / (PIXELS_PER_MM * VISUAL_CORRECTION_FACTOR);
  const mmToScaleSize = (mm: number) => (mm * PIXELS_PER_MM * VISUAL_CORRECTION_FACTOR) / BASE_NODE_SIZE_PX;
  
  const scaleToMmSpacing = (s: number) => (s * BASE_NODE_SPACING_PX) / (PIXELS_PER_MM * VISUAL_CORRECTION_FACTOR);
  const mmToScaleSpacing = (mm: number) => (mm * PIXELS_PER_MM * VISUAL_CORRECTION_FACTOR) / BASE_NODE_SPACING_PX;

  const PRIMES = [3, 5, 7, 9, 11, 13, 15];

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl w-[95%] max-w-4xl max-h-[90vh] overflow-hidden text-slate-200 shadow-2xl border border-slate-700 flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800 flex-shrink-0 relative z-10">
          <h2 className="text-2xl font-bold text-white">System Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition group">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex border-b border-slate-700 bg-slate-900/50 overflow-x-auto flex-shrink-0 relative z-10">
           <button onClick={() => setActiveTab('tonality')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'tonality' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Tonality</button>
           <button onClick={() => setActiveTab('behavior')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'behavior' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Behavior</button>
           <button onClick={() => setActiveTab('visuals')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'visuals' ? 'text-pink-400 border-b-2 border-pink-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Visuals</button>
           <button onClick={() => setActiveTab('midi')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'midi' ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>MIDI</button>
           <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'data' ? 'text-orange-400 border-b-2 border-orange-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Data</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-0 bg-slate-800">
            {activeTab === 'tonality' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900/40 p-2 rounded-lg border border-slate-700/50 mb-2">
                     {(['ji', 'et', 'indian', 'pythagorean'] as TuningSystem[]).map(sys => (
                         <button 
                            key={sys} 
                            onClick={() => handleChange('tuningSystem', sys)}
                            className={`flex-1 px-3 py-2 text-[10px] font-bold rounded border transition-all uppercase tracking-widest ${settings.tuningSystem === sys ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
                         >
                             {sys === 'ji' ? 'Just Intonation' : sys === 'et' ? 'Equal Temperament' : sys === 'indian' ? 'Indian Classical' : 'Pythagorean'}
                         </button>
                     ))}
                  </div>

                  {settings.tuningSystem === 'ji' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-left-2 duration-300">
                          <div className="space-y-6">
                              {renderLayoutSelector('ji')}
                              {renderBaseFrequency()}
                              <h3 className="font-semibold text-blue-300 border-b border-slate-700 pb-1 flex justify-between items-center">
                                  <span>Lattice Axis Depth</span>
                                  <span className="text-[10px] text-blue-500 uppercase font-black">ACTIVE</span>
                              </h3>
                              <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Steps from center per prime limit</p>
                                  {PRIMES.map(limit => (
                                      <div key={limit} className="flex items-center gap-3">
                                          <span className="w-16 text-xs font-bold text-slate-400">{limit}-Limit</span>
                                          {/* @ts-ignore */}
                                          <input type="range" min="0" max="6" step="1" value={settings.limitDepths?.[limit] ?? 0} onChange={(e) => handleLimitDepthChange(limit, parseInt(e.target.value))} className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                          {/* @ts-ignore */}
                                          <span className="text-xs font-mono w-4 text-right text-blue-400">{settings.limitDepths?.[limit] ?? 0}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div className="space-y-6">
                              <h3 className="font-semibold text-blue-300 border-b border-slate-700 pb-1">Complexity Thresholds</h3>
                              <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-4">
                                  <p className="text-[10px] text-slate-500 uppercase font-bold">Limit max complexity per axis</p>
                                  {PRIMES.map(limit => (
                                      <div key={limit} className="flex flex-col gap-1">
                                          <span className="text-[10px] font-bold text-slate-400 uppercase">{limit}-Limit MAX RATIO</span>
                                          <NumberInput 
                                            // @ts-ignore
                                            value={settings.limitComplexities?.[limit] ?? 1000} 
                                            min={1} max={10000} 
                                            onChange={(val) => handleLimitComplexityChange(limit, val)} 
                                          />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}

                  {settings.tuningSystem === 'et' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-2 duration-300">
                          <div className="space-y-6">
                              {renderLayoutSelector('et')}
                              {renderBaseFrequency()}
                              <h3 className="text-xs font-bold text-blue-300 uppercase border-b border-slate-700 pb-1">ET Divisions</h3>
                              <div className="bg-slate-900/40 p-4 rounded border border-slate-700 space-y-4">
                                  <div>
                                      <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">Equal Divisions (EDO)</label>
                                      <NumberInput value={12} min={1} max={1200} onChange={() => {}} suffix="Notes" />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">Root MIDI Note</label>
                                      <NumberInput value={60} min={0} max={127} onChange={() => {}} suffix="Note #" />
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {settings.tuningSystem === 'indian' && (
                      <div className="grid grid-cols-1 md:flex md:flex-col gap-6 animate-in slide-in-from-right-2 duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-6">
                                {renderLayoutSelector('indian')}
                                {renderBaseFrequency()}
                                <h3 className="text-xs font-bold text-orange-300 uppercase border-b border-slate-700 pb-1">System Selection</h3>
                                <div className="bg-slate-900/40 p-4 rounded border border-slate-700 space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] text-slate-400 font-bold uppercase">Shruti Base</label>
                                        <select disabled className="w-full bg-slate-700 rounded p-2 text-xs text-white border border-slate-600">
                                            <option>22 Shruti (Standard)</option>
                                            <option>53 Shruti (Expanded)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] text-slate-400 font-bold uppercase">Melakarta / Thaat</label>
                                        <select disabled className="w-full bg-slate-700 rounded p-2 text-xs text-white border border-slate-600">
                                            <option>Bilaval (Ionian)</option>
                                            <option>Kalyan (Lydian)</option>
                                            <option>Bhairav</option>
                                        </select>
                                    </div>
                                </div>
                             </div>
                          </div>
                      </div>
                  )}

                  {settings.tuningSystem === 'pythagorean' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-2 duration-300">
                          <div className="space-y-6">
                              {renderLayoutSelector('pythagorean')}
                              {renderBaseFrequency()}
                              <h3 className="text-xs font-bold text-purple-300 uppercase border-b border-slate-700 pb-1">Cycle of Fifths</h3>
                              <div className="bg-slate-900/40 p-4 rounded border border-slate-700 space-y-4">
                                  <div>
                                      <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">Stack Depth</label>
                                      <NumberInput value={12} min={1} max={53} onChange={() => {}} suffix="Steps" />
                                  </div>
                                  <div className="space-y-2">
                                      <label className="block text-[10px] text-slate-400 font-bold uppercase">Stack Direction</label>
                                      <div className="flex gap-2">
                                          <button className="flex-1 py-1 text-[10px] bg-purple-900/40 border border-purple-500/50 rounded uppercase font-bold text-purple-200">Sharp (3/2)</button>
                                          <button className="flex-1 py-1 text-[10px] bg-slate-700 border border-slate-600 rounded uppercase font-bold text-slate-400">Flat (2/3)</button>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
            )}

            {activeTab === 'behavior' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1">Audio Performance</h3>
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
                    
                    {/* Polyphony Limit Control */}
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
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm font-semibold">Chords Always Relatch</span>
                        <input type="checkbox" checked={settings.chordsAlwaysRelatch} onChange={(e) => handleChange('chordsAlwaysRelatch', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-indigo-500" />
                      </label>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">Strum Duration</label>
                        <div className="flex items-center gap-3">
                          <input type="range" min="0.1" max="2.0" step="0.1" value={settings.strumDuration} onChange={(e) => handleChange('strumDuration', parseFloat(e.target.value))} className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                          <span className="text-xs font-mono w-10">{settings.strumDuration.toFixed(1)}s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1">Key Bindings</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                      {renderKeyBinding('Latch All', 'latch')}
                      {renderKeyBinding('Panic', 'panic')}
                      {renderKeyBinding('All Notes Off', 'off')}
                      {renderKeyBinding('Center View', 'center')}
                      {renderKeyBinding('Toggle Pitch Bend', 'bend')}
                      {renderKeyBinding('Open Settings', 'settings')}
                      {renderKeyBinding('Open Synth', 'synth')}
                      {renderKeyBinding('Store Chord', 'addChord')}
                      {renderKeyBinding('Volume Up', 'volumeUp')}
                      {renderKeyBinding('Volume Down', 'volumeDown')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'visuals' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">UI & Layout</h3>
                    <div className="space-y-4">
                       <label className="flex items-center space-x-3 cursor-pointer p-3 bg-slate-700/50 rounded-lg border border-yellow-500/30">
                            <input type="checkbox" checked={settings.uiUnlocked} onChange={(e) => handleChange('uiUnlocked', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-yellow-500 focus:ring-yellow-500" />
                            <div><span className={`font-bold block ${settings.uiUnlocked ? 'text-yellow-400' : 'text-slate-300'}`}>Unlock UI Layout</span></div>
                        </label>
                        <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-2">
                            <label className="block text-sm font-semibold text-slate-300">Global UI Scale</label>
                            <div className="flex gap-2">
                                {[0.5, 0.75, 1.0, 1.25, 1.5].map(scale => (
                                    <button key={scale} onClick={() => handleChange('uiScale', scale)} className={`flex-1 py-2 text-[10px] font-bold rounded border ${settings.uiScale === scale ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                                        {scale === 1.0 ? '100%' : `${scale * 100}%`}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1 mt-6">Node Graphics</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Node Shape</label>
                        <div className="flex gap-2">
                          <button onClick={() => handleChange('buttonShape', ButtonShape.CIRCLE)} className={`flex-1 py-2 text-xs font-bold rounded border ${settings.buttonShape === ButtonShape.CIRCLE ? 'bg-pink-600 border-pink-500' : 'bg-slate-700 border-slate-600'}`}>Circle</button>
                          <button onClick={() => handleChange('buttonShape', ButtonShape.DIAMOND)} className={`flex-1 py-2 text-xs font-bold rounded border ${settings.buttonShape === ButtonShape.DIAMOND ? 'bg-pink-600 border-pink-500' : 'bg-slate-700 border-slate-600'}`}>Diamond</button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">Node Size in mm</label>
                        <MmSlider 
                            valueScale={settings.buttonSizeScale} 
                            onChangeScale={(v) => handleChange('buttonSizeScale', v)}
                            toMm={scaleToMmSize}
                            fromMm={mmToScaleSize}
                            minMm={4}
                            maxMm={16}
                            stepMm={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">Node Spacing in mm</label>
                        <MmSlider 
                            valueScale={settings.buttonSpacingScale} 
                            onChangeScale={(v) => handleChange('buttonSpacingScale', v)}
                            toMm={scaleToMmSpacing}
                            fromMm={mmToScaleSpacing}
                            minMm={10}
                            maxMm={90}
                            stepMm={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold">Latched Node Zoom</label>
                        <div className="flex items-center gap-3">
                          <input type="range" min="1.0" max="2.0" step="0.05" value={settings.latchedZoomScale} onChange={(e) => handleChange('latchedZoomScale', parseFloat(e.target.value))} className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                          <span className="text-xs font-mono w-10">{settings.latchedZoomScale.toFixed(2)}x</span>
                        </div>
                      </div>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm font-semibold">Show Fraction Bar</span>
                        <input type="checkbox" checked={settings.showFractionBar} onChange={(e) => handleChange('showFractionBar', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-pink-500" />
                      </label>
                    </div>

                    <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1 mt-6">Limit Identity Colors</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {PRIMES.map(limit => (
                        <div key={limit} className="flex flex-col items-center p-2 bg-slate-900/50 rounded border border-slate-700">
                          <span className="text-[10px] font-bold text-slate-400 mb-1">{limit}-Limit</span>
                          <input type="color" value={settings.colors[limit]} onChange={(e) => handleColorChange(limit, e.target.value)} className="w-full h-8 bg-transparent border-none cursor-pointer" />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Lattice Background</h3>
                    <div className="space-y-4">
                      <select value={settings.backgroundMode} onChange={(e) => handleChange('backgroundMode', e.target.value as BackgroundMode)} className="w-full bg-slate-700 rounded p-2 text-sm text-white border border-slate-600">
                        <option value="charcoal">Charcoal</option>
                        <option value="midnight_blue">Midnight Blue</option>
                        <option value="deep_maroon">Deep Maroon</option>
                        <option value="forest_green">Forest Green</option>
                        <option value="slate_grey">Slate Grey</option>
                        <option value="rainbow">Rainbow Gradient</option>
                        <option value="image">Custom Image</option>
                        <option value="none">Solid Black</option>
                      </select>
                      
                      {settings.backgroundMode === 'rainbow' && (
                        <div className="bg-slate-900/50 p-4 rounded border border-slate-700 space-y-4">
                          <h4 className="text-xs font-bold text-slate-300 uppercase">Rainbow Parameters</h4>
                          <div className="space-y-2">
                            <label className="flex justify-between text-[10px] text-slate-400 uppercase font-bold"><span>Saturation</span> <span>{settings.rainbowSaturation}%</span></label>
                            <input type="range" min="0" max="100" value={settings.rainbowSaturation} onChange={(e) => handleChange('rainbowSaturation', parseInt(e.target.value))} className="w-full h-1.5 bg-pink-900/30 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                          </div>
                          <div className="space-y-2">
                            <label className="flex justify-between text-[10px] text-slate-400 uppercase font-bold"><span>Brightness</span> <span>{settings.rainbowBrightness}%</span></label>
                            <input type="range" min="0" max="100" value={settings.rainbowBrightness} onChange={(e) => handleChange('rainbowBrightness', parseInt(e.target.value))} className="w-full h-1.5 bg-pink-900/30 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                          </div>
                          <div className="space-y-2">
                            <label className="flex justify-between text-[10px] text-slate-400 uppercase font-bold"><span>Offset</span> <span>{settings.rainbowOffset}°</span></label>
                            <input type="range" min="0" max="360" value={settings.rainbowOffset} onChange={(e) => handleChange('rainbowOffset', parseInt(e.target.value))} className="w-full h-1.5 bg-pink-900/30 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                          </div>
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Colored Node Illumination</span>
                            <input type="checkbox" checked={settings.isColoredIlluminationEnabled} onChange={(e) => handleChange('isColoredIlluminationEnabled', e.target.checked)} className="w-4 h-4 rounded border-slate-600 text-pink-500" />
                          </label>
                        </div>
                      )}

                      {settings.backgroundMode === 'image' && (
                        <div className="bg-slate-900/50 p-4 rounded border border-slate-700 space-y-4">
                          <h4 className="text-xs font-bold text-slate-300 uppercase">Custom Image</h4>
                          <input type="file" ref={bgImageInputRef} className="hidden" accept="image/*" onChange={handleBackgroundImageUpload} />
                          <button onClick={() => bgImageInputRef.current?.click()} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-xs font-bold rounded border border-slate-600 transition">Upload Image</button>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Tiling</span>
                            <input type="checkbox" checked={settings.backgroundTiling} onChange={(e) => handleChange('backgroundTiling', e.target.checked)} className="w-4 h-4 rounded border-slate-600 text-pink-500" />
                          </div>
                          <div className="space-y-2">
                            <label className="flex justify-between text-[10px] text-slate-400 uppercase font-bold"><span>Y Offset</span> <span>{settings.backgroundYOffset}px</span></label>
                            <input type="range" min="-1000" max="1000" step="10" value={settings.backgroundYOffset} onChange={(e) => handleChange('backgroundYOffset', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'midi' && (
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
            )}

            {activeTab === 'data' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="space-y-6">
                        <h3 className="font-semibold text-orange-400 border-b border-slate-700 pb-1">Backup & Restore</h3>
                        <p className="text-sm text-slate-400">Manage your entire PrismaTonal configuration in a single XML file.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 flex flex-col items-center text-center">
                                <h4 className="font-bold text-white mb-2">Export Full Data</h4>
                                <button onClick={exportXML} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition">Export to XML</button>
                            </div>
                            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 flex flex-col items-center text-center">
                                <h4 className="font-bold text-white mb-2">Import Full Data</h4>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".xml" onChange={handleFileChange} />
                                <button onClick={handleImportClick} className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded transition">Import from XML</button>
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