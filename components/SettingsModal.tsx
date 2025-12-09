
import React, { useRef, useState } from 'react';
import { AppSettings, ButtonShape } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  onSave: () => void;
  onLoad: (file: File) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, updateSettings, onSave, onLoad }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-slate-800 p-6 rounded-xl w-[90%] max-w-2xl max-h-[90vh] overflow-y-auto text-slate-200 shadow-2xl border border-slate-700 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Lattice Configuration</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Dimensions & Limits */}
            <div className="space-y-6">
                <h3 className="font-semibold text-blue-400 border-b border-slate-700 pb-1">Dimensions</h3>
                
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
                    <p className="text-xs text-slate-500 mt-1">Limits the maximum numerator/denominator to prevent clutter.</p>
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
                    <label className="block text-sm font-semibold mb-2">Canvas Size (Pixels)</label>
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

                <div className="space-y-2">
                    <span className="block text-sm font-semibold">Additional Limits</span>
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center space-x-3 bg-slate-900/50 p-2 rounded cursor-pointer border border-transparent hover:border-slate-600 transition">
                            <input 
                                type="checkbox" 
                                checked={settings.enabledLimits[7]} 
                                onChange={() => handleLimitToggle(7)}
                                className="w-5 h-5 rounded border-slate-600 text-green-500 focus:ring-green-500"
                            />
                            <span>Enable 7-Limit Axis</span>
                        </label>
                        <label className="flex items-center space-x-3 bg-slate-900/50 p-2 rounded cursor-pointer border border-transparent hover:border-slate-600 transition">
                            <input 
                                type="checkbox" 
                                checked={settings.enabledLimits[11]} 
                                onChange={() => handleLimitToggle(11)}
                                className="w-5 h-5 rounded border-slate-600 text-purple-500 focus:ring-purple-500"
                            />
                            <span>Enable 11-Limit Axis</span>
                        </label>
                        <label className="flex items-center space-x-3 bg-slate-900/50 p-2 rounded cursor-pointer border border-transparent hover:border-slate-600 transition">
                            <input 
                                type="checkbox" 
                                checked={settings.enabledLimits[13]} 
                                onChange={() => handleLimitToggle(13)}
                                className="w-5 h-5 rounded border-slate-600 text-orange-500 focus:ring-orange-500"
                            />
                            <span>Enable 13-Limit Axis</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Visuals & Colors */}
            <div className="space-y-6">
                <h3 className="font-semibold text-purple-400 border-b border-slate-700 pb-1">Appearance</h3>

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
                         className={`px-3 py-1 rounded ${settings.buttonShape === ButtonShape.CIRCLE ? 'bg-indigo-600' : 'bg-slate-700'}`}
                       >Circle</button>
                       <button 
                         onClick={() => handleChange('buttonShape', ButtonShape.DIAMOND)}
                         className={`px-3 py-1 rounded ${settings.buttonShape === ButtonShape.DIAMOND ? 'bg-indigo-600' : 'bg-slate-700'}`}
                       >Diamond</button>
                     </div>
                </div>

                <div className="space-y-2">
                    <span className="block text-sm font-semibold">Limit Colors</span>
                    <div className="flex gap-3 flex-wrap">
                      {[1, 3, 5, 7, 11, 13].map(limit => (
                        <div key={limit} className="flex flex-col items-center">
                          <input 
                            type="color" 
                            value={settings.colors[limit] || '#ffffff'} 
                            onChange={(e) => handleColorChange(limit, e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-none"
                          />
                          <span className="text-xs mt-1 text-slate-400">{limit}</span>
                        </div>
                      ))}
                    </div>
                </div>
                
                 <div className="grid grid-cols-2 gap-2 text-sm">
                 <label className="flex items-center space-x-2">
                   <input type="checkbox" checked={settings.isPitchBendEnabled} onChange={(e) => handleChange('isPitchBendEnabled', e.target.checked)} />
                   <span>Pitch Bend</span>
                 </label>
                 <label className="flex items-center space-x-2">
                   <input type="checkbox" checked={settings.isPitchSnapEnabled} onChange={(e) => handleChange('isPitchSnapEnabled', e.target.checked)} />
                   <span>Snap</span>
                 </label>
              </div>

            </div>
        </div>

        {/* Persistence Actions */}
        <div className="mt-8 flex gap-4 border-t border-slate-700 pt-4">
          <button onClick={onSave} className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded font-semibold transition shadow-lg">
            Export Config
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-600 hover:bg-slate-700 py-2 rounded font-semibold transition shadow-lg">
            Import Config
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xml" 
            onChange={(e) => {
              if (e.target.files?.[0]) onLoad(e.target.files[0]);
            }} 
          />
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
