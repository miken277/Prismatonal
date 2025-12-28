
import React, { useRef, useState, useEffect } from 'react';
import { AppSettings, ButtonShape, BackgroundMode } from '../types';
import { DEFAULT_COLORS } from '../constants';
import { midiService, MidiDevice } from '../services/MidiService';
import { useStore } from '../services/Store'; 
import TonalityTab from './settings/TonalityTab';
import BehaviorTab from './settings/BehaviorTab';
import { NumberInput, MmSlider, scaleToMmSize, mmToScaleSize, scaleToMmSpacing, mmToScaleSpacing } from './settings/SettingsWidgets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
}

const PRIMES = [3, 5, 7, 9, 11, 13, 15];

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, updateSettings }) => {
  const [activeTab, setActiveTab] = useState<'tonality' | 'behavior' | 'visuals' | 'midi' | 'data'>('tonality');
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const { exportXML, importXML } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'midi') {
        midiService.init().then(success => { if (success) { midiService.getOutputs().then(devices => { setMidiDevices(devices); }); } });
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => updateSettings({ ...settings, [key]: value });
  
  const handleUpdate = (partial: Partial<AppSettings>) => updateSettings({ ...settings, ...partial });

  const handleColorChange = (limit: number, color: string) => updateSettings({ ...settings, colors: { ...settings.colors, [limit]: color } });
  
  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const confirmed = window.confirm(
            "WARNING: Importing will overwrite ALL system settings, keyboard mappings, user bank patches, and currently selected synth sounds.\n\n" +
            "This action cannot be undone.\n\n" +
            "Do you wish to proceed?"
          );
          
          if (confirmed) {
              importXML(file).then(success => { 
                  if (success) onClose(); 
              });
          }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
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
                <TonalityTab settings={settings} updateSettings={handleUpdate} />
            )}

            {activeTab === 'behavior' && (
                <BehaviorTab settings={settings} updateSettings={handleUpdate} />
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
                    <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Connections & Voice Leading</h3>
                    <div className="space-y-4">
                        <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1 text-slate-300">Base Line Width</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="range" 
                                        min="0.5" 
                                        max="3.0" 
                                        step="0.1" 
                                        value={settings.baseLineWidth || 1.0} 
                                        onChange={(e) => handleChange('baseLineWidth', parseFloat(e.target.value))} 
                                        className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                    />
                                    <span className="text-xs font-mono w-10 text-right text-blue-300">{(settings.baseLineWidth || 1.0).toFixed(1)}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 italic mt-1">Controls thickness of the static lattice grid.</p>
                            </div>
                            <hr className="border-slate-700/50" />
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-semibold text-slate-300">Enable Line Brightening</span>
                                <input type="checkbox" checked={settings.lineBrighteningEnabled} onChange={(e) => handleChange('lineBrighteningEnabled', e.target.checked)} className="w-5 h-5 rounded border-slate-600 text-pink-500" />
                            </label>
                            
                            <div className={`${!settings.lineBrighteningEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                                <label className="block text-sm font-semibold mb-1 text-slate-300">Brightening Width</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="range" 
                                        min="1.0" 
                                        max="4.0" 
                                        step="0.1" 
                                        value={settings.lineBrighteningWidth || 1.0} 
                                        onChange={(e) => handleChange('lineBrighteningWidth', parseFloat(e.target.value))} 
                                        className="flex-grow h-2 bg-pink-900 rounded-lg appearance-none cursor-pointer accent-pink-500" 
                                    />
                                    <span className="text-xs font-mono w-10 text-right text-pink-300">{(settings.lineBrighteningWidth || 1.0).toFixed(1)}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 italic mt-1">Controls thickness of highlighted connections between active nodes.</p>
                            </div>
                        </div>
                    </div>

                    <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1 mt-2">Lattice Background</h3>
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
                            <label className="flex justify-between text-xs font-bold text-slate-400 uppercase"><span>Brightness</span> <span>{settings.rainbowBrightness}%</span></label>
                            <input type="range" min="0" max="100" value={settings.rainbowBrightness} onChange={(e) => handleChange('rainbowBrightness', parseInt(e.target.value))} className="w-full h-1.5 bg-pink-900/30 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                          </div>
                          <div className="space-y-2">
                            <label className="flex justify-between text-xs font-bold text-slate-400 uppercase"><span>Offset</span> <span>{settings.rainbowOffset}°</span></label>
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
