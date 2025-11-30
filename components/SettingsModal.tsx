
import React, { useRef } from 'react';
import { AppSettings, ButtonShape, LimitType } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

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

  const handleColorChange = (limit: number, color: string) => {
    updateSettings({
      ...settings,
      colors: { ...settings.colors, [limit]: color }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-slate-800 p-6 rounded-xl w-[90%] max-w-2xl max-h-[90vh] overflow-y-auto text-slate-200 shadow-2xl border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Section: Geometry */}
          <div className="space-y-4">
            <h3 className="font-semibold text-blue-400 border-b border-slate-700 pb-1">Geometry</h3>
            
            <div>
              <label className="block text-sm mb-1">Tonality Limit</label>
              <div className="flex gap-2">
                {[3, 5, 7, 11].map((l) => (
                  <button
                    key={l}
                    onClick={() => handleChange('tonalityLimit', l)}
                    className={`px-3 py-1 rounded ${settings.tonalityLimit === l ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                  >
                    {l}-Limit
                  </button>
                ))}
              </div>
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
              <label className="block text-sm mb-1">Spacing ({settings.buttonSpacingScale.toFixed(1)}x)</label>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={settings.buttonSpacingScale}
                onChange={(e) => handleChange('buttonSpacingScale', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

             <div>
              <label className="block text-sm mb-1">Diamond Rotation ({settings.diamondRotation}°)</label>
              <input 
                type="range" min="0" max="360" step="15" 
                value={settings.diamondRotation}
                onChange={(e) => handleChange('diamondRotation', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
               <label className="block text-sm mb-1">Aspect Ratio (Square to Wide)</label>
               <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={settings.aspectRatio}
                onChange={(e) => handleChange('aspectRatio', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Section: Appearance & Behavior */}
          <div className="space-y-4">
            <h3 className="font-semibold text-purple-400 border-b border-slate-700 pb-1">Appearance & Logic</h3>

            <div>
               <label className="block text-sm mb-1">Button Shape</label>
               <div className="flex gap-2">
                 <button 
                   onClick={() => handleChange('buttonShape', ButtonShape.CIRCLE)}
                   className={`px-3 py-1 rounded ${settings.buttonShape === ButtonShape.CIRCLE ? 'bg-purple-600' : 'bg-slate-700'}`}
                 >Circle</button>
                 <button 
                   onClick={() => handleChange('buttonShape', ButtonShape.DIAMOND)}
                   className={`px-3 py-1 rounded ${settings.buttonShape === ButtonShape.DIAMOND ? 'bg-purple-600' : 'bg-slate-700'}`}
                 >Diamond</button>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
               <label className="flex items-center space-x-2">
                 <input type="checkbox" checked={settings.isPitchBendEnabled} onChange={(e) => handleChange('isPitchBendEnabled', e.target.checked)} />
                 <span>Pitch Bend</span>
               </label>
               <label className="flex items-center space-x-2">
                 <input type="checkbox" checked={settings.isPitchSnapEnabled} onChange={(e) => handleChange('isPitchSnapEnabled', e.target.checked)} />
                 <span>Snap to Grid</span>
               </label>
               <label className="flex items-center space-x-2">
                 <input type="checkbox" checked={settings.pitchOffLocked} onChange={(e) => handleChange('pitchOffLocked', e.target.checked)} />
                 <span>Lock 'Panic'</span>
               </label>
               <label className="flex items-center space-x-2">
                 <input type="checkbox" checked={settings.volumeLocked} onChange={(e) => handleChange('volumeLocked', e.target.checked)} />
                 <span>Lock Volume</span>
               </label>
            </div>
            
            <div>
               <label className="block text-sm mb-1">Polyphony ({settings.polyphony})</label>
               <input 
                type="range" min="1" max="10" step="1" 
                value={settings.polyphony}
                onChange={(e) => handleChange('polyphony', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-sm">Limit Colors</span>
              <div className="flex gap-2 flex-wrap">
                {[1, 3, 5, 7, 11].map(limit => (
                  <div key={limit} className="flex flex-col items-center">
                    <input 
                      type="color" 
                      value={settings.colors[limit] || '#ffffff'} 
                      onChange={(e) => handleColorChange(limit, e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-none"
                    />
                    <span className="text-xs mt-1">{limit}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Persistence Actions */}
        <div className="mt-8 flex gap-4 border-t border-slate-700 pt-4">
          <button onClick={onSave} className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded font-semibold transition">
            Export XML
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-600 hover:bg-slate-700 py-2 rounded font-semibold transition">
            Import XML
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
