
import React, { useRef, useState } from 'react';
import { AppSettings, ButtonShape } from '../types';

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

  const handleLimitToggle = (limit: 7 | 11 | 13) => {
    updateSettings({
      ...settings,
      enabledLimits: {
        ...settings.enabledLimits,
        [limit]: !settings.enabledLimits[limit]
      }
    });
  };

  const handleColorChange = (limit: number, color: string) => {
    updateSettings({
      ...settings,
      colors: { ...settings.colors, [limit]: color }
    });
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
             Behavior
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
                          <label className="block text-sm font-semibold mb-2">Lattice Depth (Shells)</label>
                          <div className="flex items-center gap-4">
                              <input 
                                  type="range" min="1" max="20" step="1" 
                                  value={settings.latticeShells}
                                  onChange={(e) => handleChange('latticeShells', parseInt(e.target.value))}
                                  className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xl font-bold min-w-[2ch]">{settings.latticeShells}</span>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-semibold mb-2">Complexity Limit (Max N/D)</label>
                          <div className="flex items-center gap-4">
                              <input 
                                  type="range" min="100" max="10000" step="100" 
                                  value={settings.maxND}
                                  onChange={(e) => handleChange('maxND', parseInt(e.target.value))}
                                  className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-sm font-bold min-w-[4ch]">{settings.maxND}</span>
                          </div>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="block text-sm font-semibold">Enabled Limits</span>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center space-x-3 bg-slate-900/50 p-2 rounded cursor-pointer border border-transparent hover:border-slate-600 transition">
                                <input 
                                    type="checkbox" 
                                    checked={settings.enabledLimits[7]} 
                                    onChange={() => handleLimitToggle(7)}
                                    className="w-5 h-5 rounded border-slate-600 text-green-500 focus:ring-green-500"
                                />
                                <span>7-Limit (Septimal)</span>
                            </label>
                            <label className="flex items-center space-x-3 bg-slate-900/50 p-2 rounded cursor-pointer border border-transparent hover:border-slate-600 transition">
                                <input 
                                    type="checkbox" 
                                    checked={settings.enabledLimits[11]} 
                                    onChange={() => handleLimitToggle(11)}
                                    className="w-5 h-5 rounded border-slate-600 text-purple-500 focus:ring-purple-500"
                                />
                                <span>11-Limit (Undecimal)</span>
                            </label>
                            <label className="flex items-center space-x-3 bg-slate-900/50 p-2 rounded cursor-pointer border border-transparent hover:border-slate-600 transition">
                                <input 
                                    type="checkbox" 
                                    checked={settings.enabledLimits[13]} 
                                    onChange={() => handleLimitToggle(13)}
                                    className="w-5 h-5 rounded border-slate-600 text-orange-500 focus:ring-orange-500"
                                />
                                <span>13-Limit (Tridecimal)</span>
                            </label>
                        </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                      <h3 className="font-semibold text-blue-400 border-b border-slate-700 pb-1">Display</h3>
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
                            <option value={3000}>Small (3000px)</option>
                            <option value={4000}>Medium (4000px)</option>
                            <option value={6000}>Large (6000px)</option>
                            <option value={8000}>Extra Large (8000px)</option>
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
                     <label className="flex items-center space-x-2">
                       <input type="checkbox" checked={settings.isPitchBendEnabled} onChange={(e) => handleChange('isPitchBendEnabled', e.target.checked)} />
                       <span>Pitch Bend Animations</span>
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

                      <div className="mt-8 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                        <p className="text-xs text-slate-400">
                            <strong>Voice Leading Visuals:</strong> <br/>
                            Active lines now glow brightly in their limit color. Dashed pulses move along the line to indicate direction.
                        </p>
                      </div>
                  </div>

                  <div className="space-y-6">
                      <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Rainbow Mode</h3>
                      
                      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <label className="flex items-center space-x-3 mb-4 cursor-pointer">
                            <input type="checkbox" checked={settings.isRainbowModeEnabled} onChange={(e) => handleChange('isRainbowModeEnabled', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-pink-500 focus:ring-pink-500" />
                            <span className="font-bold text-white">Enable Vertical Rainbow</span>
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

                       <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                         <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" checked={settings.isColoredIlluminationEnabled} onChange={(e) => handleChange('isColoredIlluminationEnabled', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-pink-500 focus:ring-pink-500" />
                            <div>
                                <span className="font-bold text-white block">Colored Illumination</span>
                                <span className="text-xs text-slate-400">Node outline uses pitch-rainbow color when latched</span>
                            </div>
                        </label>
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
