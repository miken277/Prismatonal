
import React, { useRef, useState, useEffect } from 'react';
import { AppSettings, ButtonShape, ChordDefinition, BackgroundMode, LimitColorMap } from '../types';
import { DEFAULT_COLORS } from '../constants';
import { midiService, MidiDevice } from '../services/MidiService';
import { useStore } from '../services/Store'; // Need store actions directly for import/export

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
}

// Hardcoded palettes for procedural backgrounds
const PRESET_PALETTES: Record<string, LimitColorMap> = {
    'charcoal': {
        1: '#FFFFFF', // White
        3: '#D4D4D8', // Zinc 300
        5: '#A1A1AA', // Zinc 400
        7: '#71717A', // Zinc 500
        11: '#52525B', // Zinc 600
        13: '#3F3F46' // Zinc 700
    },
    'midnight_blue': {
        1: '#FFFFFF', 
        3: '#67E8F9', // Cyan 300
        5: '#3B82F6', // Blue 500
        7: '#60A5FA', // Blue 400
        11: '#818CF8', // Indigo 400
        13: '#A5B4FC' // Indigo 300
    },
    'deep_maroon': {
        1: '#FCD34D', // Amber 300 (Gold)
        3: '#FB923C', // Orange 400
        5: '#EF4444', // Red 500
        7: '#F87171', // Red 400
        11: '#FCA5A5', // Red 300
        13: '#FDA4AF' // Rose 300
    },
    'forest_green': {
        1: '#BEF264', // Lime 300
        3: '#4ADE80', // Green 400
        5: '#10B981', // Emerald 500
        7: '#34D399', // Emerald 400
        11: '#2DD4BF', // Teal 400
        13: '#5EEAD4' // Teal 300
    },
    'slate_grey': {
        1: '#F1F5F9', // Slate 100
        3: '#94A3B8', // Slate 400
        5: '#64748B', // Slate 500
        7: '#F43F5E', // Rose 500 (Contrast)
        11: '#818CF8', // Indigo 400
        13: '#34D399' // Emerald 400
    }
};

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
  const [activeTab, setActiveTab] = useState<'general' | 'behavior' | 'color' | 'midi' | 'data'>('general');
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const { exportXML, importXML } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

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

  const setDefaultColors = () => {
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

  // Image analysis helper
  const extractColorsFromImage = (imageSrc: string): Promise<LimitColorMap> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            const cvs = document.createElement('canvas');
            const ctx = cvs.getContext('2d');
            // Scale down to simplify analysis
            cvs.width = 50;
            cvs.height = 50;
            ctx?.drawImage(img, 0, 0, 50, 50);
            const data = ctx?.getImageData(0, 0, 50, 50).data;
            if(!data) { resolve(DEFAULT_COLORS); return; }
            
            // Simple logic: Sample 6 distinct areas to get a "palette"
            // We sample center, 4 corners, and a mid-point
            const getHex = (x: number, y: number) => {
                const i = (y * 50 + x) * 4;
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                // Convert to hex
                return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            }
            
            const extracted: LimitColorMap = {
                1: getHex(25, 25), // Center
                3: getHex(10, 10), // TL
                5: getHex(40, 40), // BR
                7: getHex(40, 10), // TR
                11: getHex(10, 40), // BL
                13: getHex(25, 10) // Top-Mid
            };
            resolve(extracted);
        };
        img.onerror = () => resolve(DEFAULT_COLORS);
    });
  };

  const pairLimitsToBackground = async () => {
     const mode = settings.backgroundMode;

     if (mode === 'rainbow') {
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
             
             newColors[key] = hslToHex(hue, settings.rainbowSaturation || 70, 60); 
         });
         updateSettings({ ...settings, colors: newColors });
     } 
     else if (mode === 'image' && settings.backgroundImageData) {
         const extracted = await extractColorsFromImage(settings.backgroundImageData);
         updateSettings({ ...settings, colors: extracted });
     } 
     else if (PRESET_PALETTES[mode]) {
         updateSettings({ ...settings, colors: { ...settings.colors, ...PRESET_PALETTES[mode] } });
     } 
     else {
         // Default for 'none' or unknown
         setDefaultColors();
     }
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          importXML(file).then(success => {
              if (success) {
                  // Optionally close modal or show toast
                  onClose();
              }
          });
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBgImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              const result = evt.target?.result as string;
              updateSettings({
                  ...settings,
                  backgroundImageData: result,
                  backgroundMode: 'image'
              });
          };
          reader.readAsDataURL(file);
      }
      if (bgImageInputRef.current) bgImageInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl w-[95%] max-w-4xl max-h-[90vh] overflow-hidden text-slate-200 shadow-2xl border border-slate-700 flex flex-col">
        {/* Header - Added flex-shrink-0 and z-10 to prevent collapsing/hiding */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800 flex-shrink-0 relative z-10">
          <h2 className="text-2xl font-bold text-white">Lattice Configuration</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition group" title="Close">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
        </div>

        {/* Tabs - Added flex-shrink-0 and z-10 */}
        <div className="flex border-b border-slate-700 bg-slate-900/50 overflow-x-auto flex-shrink-0 relative z-10">
           <button 
             onClick={() => setActiveTab('general')}
             className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'general' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Dimensions
           </button>
           <button 
             onClick={() => setActiveTab('behavior')}
             className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'behavior' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Behavior
           </button>
           <button 
             onClick={() => setActiveTab('color')}
             className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'color' ? 'text-pink-400 border-b-2 border-pink-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Visuals
           </button>
           <button 
             onClick={() => setActiveTab('midi')}
             className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'midi' ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             MIDI
           </button>
           <button 
             onClick={() => setActiveTab('data')}
             className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap ${activeTab === 'data' ? 'text-orange-400 border-b-2 border-orange-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Data
           </button>
        </div>

        {/* Content - Added min-h-0 to allow proper flex scrolling */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0 bg-slate-800">
            
            {/* --- General Tab --- */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="space-y-6">
                      <h3 className="font-semibold text-blue-400 border-b border-slate-700 pb-1">Audio Settings</h3>
                      
                      <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                          <label className="block text-sm font-semibold text-slate-300">Audio Latency Mode</label>
                          <p className="text-[10px] text-slate-500">Controls buffer size. Reload required to take effect.</p>
                          <div className="flex gap-2">
                              <button 
                                onClick={() => handleChange('audioLatencyHint', 'interactive')}
                                className={`flex-1 py-2 text-xs font-bold rounded border ${settings.audioLatencyHint === 'interactive' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                              >
                                  Low (Fast)
                              </button>
                              <button 
                                onClick={() => handleChange('audioLatencyHint', 'balanced')}
                                className={`flex-1 py-2 text-xs font-bold rounded border ${settings.audioLatencyHint === 'balanced' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                              >
                                  Balanced
                              </button>
                              <button 
                                onClick={() => handleChange('audioLatencyHint', 'playback')}
                                className={`flex-1 py-2 text-xs font-bold rounded border ${settings.audioLatencyHint === 'playback' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                              >
                                  High (Stable)
                              </button>
                          </div>
                      </div>

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
                      <h3 className="font-semibold text-blue-400 border-b border-slate-700 pb-1">Display & UI</h3>
                      
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
                                    Unlock UI Elements
                                </span>
                                <span className="text-[10px] text-slate-400 block leading-tight mt-1">
                                    Enables dragging of on-screen controls to custom positions.
                                    <br/>
                                    <strong>Note:</strong> Adjust Scale below to resize all controls properly.
                                </span>
                            </div>
                        </label>
                       </div>

                       <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 mb-4 space-y-4">
                           <div>
                               <label className="block text-sm font-semibold mb-2 text-slate-300">UI Scale</label>
                               <div className="flex gap-2">
                                   <button 
                                       onClick={() => handleChange('uiScale', 0.5)}
                                       className={`flex-1 py-2 text-[10px] font-bold rounded border ${settings.uiScale === 0.5 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                   >
                                       Tiny
                                   </button>
                                   <button 
                                       onClick={() => handleChange('uiScale', 0.75)}
                                       className={`flex-1 py-2 text-[10px] font-bold rounded border ${settings.uiScale === 0.75 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                   >
                                       Small
                                   </button>
                                   <button 
                                       onClick={() => handleChange('uiScale', 1.0)}
                                       className={`flex-1 py-2 text-xs font-bold rounded border ${settings.uiScale === 1.0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                   >
                                       Medium
                                   </button>
                                   <button 
                                       onClick={() => handleChange('uiScale', 1.25)}
                                       className={`flex-1 py-2 text-xs font-bold rounded border ${settings.uiScale === 1.25 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                   >
                                       Large
                                   </button>
                                   <button 
                                       onClick={() => handleChange('uiScale', 1.5)}
                                       className={`flex-1 py-2 text-xs font-bold rounded border ${settings.uiScale === 1.5 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                   >
                                       Huge
                                   </button>
                               </div>
                           </div>

                           <div>
                               <label className="flex justify-between text-sm font-semibold mb-2 text-slate-300">
                                   <span>Screen Edge Margin</span>
                                   <span>{settings.uiEdgeMargin || 6} mm</span>
                               </label>
                               <input 
                                   type="range" min="1" max="10" step="1"
                                   value={settings.uiEdgeMargin || 6}
                                   onChange={(e) => handleChange('uiEdgeMargin', parseInt(e.target.value))}
                                   className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                               />
                           </div>
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

            {activeTab === 'behavior' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                <div className="space-y-6">
                   <h3 className="font-semibold text-indigo-400 border-b border-slate-700 pb-1">Interactions</h3>
                   
                  <div>
                    <label className="block text-sm font-semibold mb-2">Polyphony (Voices)</label>
                    <div className="flex items-center gap-4">
                        <input 
                            type="range" min="1" max="64" step="1" 
                            value={settings.polyphony}
                            onChange={(e) => handleChange('polyphony', parseInt(e.target.value))}
                            className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xl font-bold min-w-[2ch]">{settings.polyphony}</span>
                    </div>
                  </div>

                  {/* Strum Settings */}
                  <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                      <label className="block text-sm font-semibold text-slate-300">Strum Settings</label>
                      <div>
                          <label className="flex justify-between text-xs mb-1 text-slate-400">
                              <span>Strum Press Duration</span>
                              <span>{settings.strumDuration?.toFixed(1) || 0.5}s</span>
                          </label>
                          <input 
                              type="range" min="0.1" max="2.0" step="0.1" 
                              value={settings.strumDuration || 0.5}
                              onChange={(e) => handleChange('strumDuration', parseFloat(e.target.value))}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                  </div>

                  {/* Keyboard Shortcuts Section */}
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                        <h4 className="font-bold text-slate-300 mb-2">Keyboard Shortcuts</h4>
                        <label className="flex items-center space-x-3 cursor-pointer mb-3">
                            <input 
                                type="checkbox" 
                                checked={settings.enableKeyboardShortcuts} 
                                onChange={(e) => handleChange('enableKeyboardShortcuts', e.target.checked)} 
                                className="w-5 h-5 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500" 
                            />
                            <span className="text-sm text-slate-200">Enable Desktop Shortcuts</span>
                        </label>
                        <div className={`text-[10px] text-slate-400 grid grid-cols-2 gap-x-4 gap-y-1 transition-opacity ${settings.enableKeyboardShortcuts ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Volume</span> <span className="text-slate-300 font-mono">Up/Down</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Reverb</span> <span className="text-slate-300 font-mono">Left/Right</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Latch</span> <span className="text-slate-300 font-mono">Space</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Panic</span> <span className="text-slate-300 font-mono">Esc</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Center</span> <span className="text-slate-300 font-mono">C</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Off</span> <span className="text-slate-300 font-mono">O</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Bend</span> <span className="text-slate-300 font-mono">B</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Add Chord</span> <span className="text-slate-300 font-mono">Enter</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Settings</span> <span className="text-slate-300 font-mono">S</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Synth</span> <span className="text-slate-300 font-mono">M</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Depth +</span> <span className="text-slate-300 font-mono">.</span></div>
                            <div className="flex justify-between border-b border-slate-700/50 pb-1"><span>Depth -</span> <span className="text-slate-300 font-mono">,</span></div>
                        </div>
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
                                  <div className="col-span-2 pt-2 border-t border-slate-700/50">
                                    <label className="block text-xs mb-1 text-slate-400">Voice Leading Reach</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleChange('voiceLeadingSteps', 1)}
                                            className={`flex-1 py-1 text-[10px] rounded border ${settings.voiceLeadingSteps === 1 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                        >
                                            1 Step (Grid)
                                        </button>
                                        <button 
                                            onClick={() => handleChange('voiceLeadingSteps', 2)}
                                            className={`flex-1 py-1 text-[10px] rounded border ${settings.voiceLeadingSteps === 2 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                        >
                                            2 Steps (Extended)
                                        </button>
                                    </div>
                                  </div>
                                </div>
                            </div>

                            {/* Line Brightening Config */}
                            <div className="pt-2 border-t border-slate-700/50 mt-2">
                                <label className="flex items-center space-x-2 mb-2 bg-slate-800/50 p-2 rounded border border-indigo-500/20">
                                    <input type="checkbox" checked={settings.lineBrighteningEnabled} onChange={(e) => handleChange('lineBrighteningEnabled', e.target.checked)} className="w-4 h-4 rounded border-slate-600 text-indigo-400" />
                                    <span className="font-semibold text-indigo-300 text-xs">Line Brightening (Held)</span>
                                </label>
                                <div className={`pl-2 transition-opacity ${settings.lineBrighteningEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                    <label className="block text-[10px] mb-1 text-slate-400">Neighbor Reach</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleChange('lineBrighteningSteps', 1)}
                                            className={`flex-1 py-1 text-[10px] rounded border ${settings.lineBrighteningSteps === 1 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                        >
                                            1 Step
                                        </button>
                                        <button 
                                            onClick={() => handleChange('lineBrighteningSteps', 2)}
                                            className={`flex-1 py-1 text-[10px] rounded border ${settings.lineBrighteningSteps === 2 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                        >
                                            2 Steps
                                        </button>
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
                                            className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-none"
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

            {activeTab === 'color' && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="space-y-6">
                      <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Limit Appearance</h3>
                      
                      {/* Color Pickers Grid - Updated to be circles */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                          {[1, 3, 5, 7, 11, 13].map(limit => (
                              <div key={limit} className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700">
                                  <input 
                                      type="color" 
                                      value={settings.colors[limit]} 
                                      onChange={(e) => handleColorChange(limit, e.target.value)}
                                      className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-none p-0 overflow-hidden"
                                  />
                                  <span className="text-xs font-bold text-slate-300">{limit}-Limit</span>
                              </div>
                          ))}
                      </div>

                      <div className="flex gap-2">
                          <button onClick={setDefaultColors} className="flex-1 text-xs bg-slate-700 hover:bg-slate-600 p-2 rounded transition">Default Colors</button>
                          <button onClick={pairLimitsToBackground} className="flex-1 text-xs bg-indigo-700 hover:bg-indigo-600 p-2 rounded transition">Pair limits to background hues</button>
                      </div>
                  </div>
                  <div className="space-y-6">
                      <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Background</h3>
                      
                      <div className="bg-slate-900/40 p-4 rounded border border-slate-700/50 space-y-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-300 mb-2">Background Mode</label>
                              <select 
                                  value={settings.backgroundMode || 'rainbow'} 
                                  onChange={(e) => handleChange('backgroundMode', e.target.value as BackgroundMode)}
                                  className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white capitalize"
                              >
                                  <option value="rainbow">Rainbow (Default)</option>
                                  <option value="charcoal">Charcoal</option>
                                  <option value="midnight_blue">Midnight Blue</option>
                                  <option value="deep_maroon">Deep Maroon</option>
                                  <option value="forest_green">Forest Green</option>
                                  <option value="slate_grey">Slate Grey</option>
                                  <option value="image">Custom Image</option>
                                  <option value="none">None (Black)</option>
                              </select>
                          </div>

                          {settings.backgroundMode === 'image' && (
                              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                  <div className="flex gap-2">
                                      <input 
                                          type="file" 
                                          accept="image/*" 
                                          ref={bgImageInputRef} 
                                          className="hidden"
                                          onChange={handleBgImageChange}
                                      />
                                      <button 
                                          onClick={() => bgImageInputRef.current?.click()}
                                          className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded border border-slate-500 text-xs font-bold transition"
                                      >
                                          Upload Image
                                      </button>
                                      {settings.backgroundImageData && (
                                          <div className="w-10 h-10 rounded border border-slate-500 overflow-hidden bg-black">
                                              <img src={settings.backgroundImageData} alt="Preview" className="w-full h-full object-cover" />
                                          </div>
                                      )}
                                  </div>
                                  <label className="flex items-center space-x-2 cursor-pointer bg-slate-800 p-2 rounded border border-slate-600">
                                      <input 
                                          type="checkbox" 
                                          checked={settings.backgroundTiling} 
                                          onChange={(e) => handleChange('backgroundTiling', e.target.checked)}
                                          className="rounded border-slate-600 text-pink-500 focus:ring-pink-500"
                                      />
                                      <div>
                                          <span className="text-xs font-bold block text-white">Tile Image</span>
                                          <span className="text-[10px] text-slate-400 block">Repeat pattern vs Center once</span>
                                      </div>
                                  </label>
                              </div>
                          )}

                          {settings.backgroundMode === 'rainbow' && (
                              <div className="space-y-3">
                                  <div>
                                      <label className="block text-xs mb-1 text-slate-400">Saturation</label>
                                      <input 
                                          type="range" min="0" max="100" 
                                          value={settings.rainbowSaturation}
                                          onChange={(e) => handleChange('rainbowSaturation', parseInt(e.target.value))}
                                          className="w-full h-1 bg-slate-600 rounded appearance-none"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs mb-1 text-slate-400">Brightness</label>
                                      <input 
                                          type="range" min="0" max="100" 
                                          value={settings.rainbowBrightness}
                                          onChange={(e) => handleChange('rainbowBrightness', parseInt(e.target.value))}
                                          className="w-full h-1 bg-slate-600 rounded appearance-none"
                                      />
                                  </div>
                              </div>
                          )}

                          {settings.backgroundMode !== 'none' && (
                              <div className="pt-2 border-t border-slate-700/50">
                                  <label className="flex justify-between text-xs mb-1 font-bold text-slate-300">
                                      <span>Vertical Offset</span>
                                      <span>{settings.backgroundYOffset}px</span>
                                  </label>
                                  <input 
                                      type="range" min="-1000" max="1000" step="10"
                                      value={settings.backgroundYOffset || 0}
                                      onChange={(e) => handleChange('backgroundYOffset', parseInt(e.target.value))}
                                      className="w-full h-2 bg-pink-900/50 rounded-lg appearance-none cursor-pointer"
                                  />
                                  <button 
                                      onClick={() => handleChange('backgroundYOffset', 0)}
                                      className="text-[10px] text-pink-400 hover:text-pink-300 mt-1"
                                  >
                                      Reset Offset
                                  </button>
                              </div>
                          )}
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
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DATA Tab --- */}
            {activeTab === 'data' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="space-y-6">
                        <h3 className="font-semibold text-orange-400 border-b border-slate-700 pb-1">Backup & Restore</h3>
                        <p className="text-sm text-slate-400">
                            Save your entire configuration, including settings, chords, and your User Patch Bank to an XML file.
                            This file is compatible with desktop and VST versions.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 flex flex-col items-center text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-blue-400 mb-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                                <h4 className="font-bold text-white mb-2">Export Configuration</h4>
                                <p className="text-xs text-slate-400 mb-4">Download settings as .xml (Includes 100 User Patches)</p>
                                <button 
                                    onClick={exportXML}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition"
                                >
                                    Export to XML
                                </button>
                            </div>

                            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 flex flex-col items-center text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-green-400 mb-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12l4.5 4.5m0 0l4.5-4.5M12 16.5V3" />
                                </svg>
                                <h4 className="font-bold text-white mb-2">Import Configuration</h4>
                                <p className="text-xs text-slate-400 mb-4">Restore settings from .xml</p>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".xml" 
                                    onChange={handleFileChange}
                                />
                                <button 
                                    onClick={handleImportClick}
                                    className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded transition"
                                >
                                    Import from XML
                                </button>
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
