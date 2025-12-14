
import React, { useRef, useState } from 'react';
import { AppSettings, ButtonShape, ChordDefinition } from '../types';
import { DEFAULT_COLORS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, updateSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'behavior' | 'color'>('general');

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

  const canvasSizes = Array.from({length: 15}, (_, i) => 1000 + i * 500);

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
             Color
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
                          <div className="flex items-center gap-4">
                              <input 
                                  type="range" min="20" max="15000" step="1" 
                                  value={settings.baseFrequency}
                                  onChange={(e) => handleChange('baseFrequency', parseFloat(e.target.value))}
                                  className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-sm font-mono min-w-[5ch]">{settings.baseFrequency}Hz</span>
                          </div>
                      </div>

                      <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                          <label className="block text-sm font-semibold text-slate-300">Lattice Depths (Coordinate Bounds)</label>
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
                                  <input 
                                      type="range" min="10" max="10000" step="10" 
                                      value={settings.limitComplexities[limit as 3|5|7|11|13]}
                                      onChange={(e) => handleLimitComplexityChange(limit as any, parseInt(e.target.value))}
                                      className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                  <span className="text-[10px] font-mono w-8 text-right">{settings.limitComplexities[limit as 3|5|7|11|13]}</span>
                              </div>
                          ))}
                      </div>

                      <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-3">
                          <label className="block text-sm font-semibold text-slate-300">Increase Depth</label>
                          <div className="space-y-2">
                             <label className="flex items-center space-x-2">
                                <input type="checkbox" checked={settings.showIncreaseDepthButton} onChange={(e) => handleChange('showIncreaseDepthButton', e.target.checked)} className="rounded border-slate-600 bg-slate-700" />
                                <span className="text-xs text-slate-300">Show Increase Depth Button</span>
                             </label>
                             <label className="flex items-center space-x-2">
                                <input type="checkbox" checked={settings.centerResetsDepth} onChange={(e) => handleChange('centerResetsDepth', e.target.checked)} className="rounded border-slate-600 bg-slate-700" />
                                <span className="text-xs text-slate-300">Center Display resets depth</span>
                             </label>
                          </div>
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
                          <label className="block text-sm font-semibold mb-2">
                            Lattice X-Stretch: {(settings.latticeAspectRatio < 1.0 ? 'Wide' : (settings.latticeAspectRatio > 1.0 ? 'Narrow' : 'Normal'))} ({settings.latticeAspectRatio})
                          </label>
                          <input 
                              type="range" min="0.5" max="2.0" step="0.1" 
                              value={settings.latticeAspectRatio}
                              onChange={(e) => handleChange('latticeAspectRatio', parseFloat(e.target.value))}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500 px-1 mt-1">
                            <span>Wide (0.5)</span>
                            <span>Normal (1.0)</span>
                            <span>Narrow (2.0)</span>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-semibold mb-2">Button Spacing ({settings.buttonSpacingScale.toFixed(1)}x)</label>
                          <input 
                              type="range" min="0.5" max="5.0" step="0.1" 
                              value={settings.buttonSpacingScale}
                              onChange={(e) => handleChange('buttonSpacingScale', parseFloat(e.target.value))}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      <div>
                          <label className="block text-sm mb-1">Button Size ({settings.buttonSizeScale.toFixed(1)}x)</label>
                          <input 
                              type="range" min="0.5" max="2.0" step="0.1" 
                              value={settings.buttonSizeScale}
                              onChange={(e) => handleChange('buttonSizeScale', parseFloat(e.target.value))}
                              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
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
                      <div>
                        <label className="block text-sm font-semibold mb-2">Canvas Size</label>
                        <select 
                            value={settings.canvasSize}
                            onChange={(e) => handleChange('canvasSize', parseInt(e.target.value))}
                            className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white"
                        >
                            {canvasSizes.map(size => (
                                <option key={size} value={size}>{size}px</option>
                            ))}
                        </select>
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
                                <label className="block text-xs mb-1 text-slate-400">Falloff Strength</label>
                                <input 
                                    type="range" min="0.1" max="1.0" step="0.05" 
                                    value={settings.voiceLeadingStrength}
                                    onChange={(e) => handleChange('voiceLeadingStrength', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            
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
                      <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Limit Colors</h3>
                      <div className="space-y-3">
                        {[1, 3, 5, 7, 11, 13].map(limit => (
                           <div key={limit} className="flex items-center justify-between bg-slate-900/40 p-2 rounded">
                             <span className="text-sm font-bold w-20">{limit}-Limit</span>
                             <div className="flex items-center gap-3">
                               <input 
                                 type="color" 
                                 value={settings.colors[limit]} 
                                 onChange={(e) => handleColorChange(limit, e.target.value)}
                                 className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                               />
                               <span className="text-xs font-mono text-slate-500">{settings.colors[limit]}</span>
                             </div>
                           </div>
                        ))}
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
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
