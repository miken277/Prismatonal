
import React from 'react';
import { AppSettings, TuningSystem, LayoutApproach } from '../../types';
import { NumberInput } from './SettingsWidgets';

interface Props {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const PRIMES = [3, 5, 7, 9, 11, 13, 15];

const TonalityTab: React.FC<Props> = ({ settings, updateSettings }) => {
    
    const handleChange = (key: keyof AppSettings, value: any) => updateSettings({ [key]: value });

    const handleLimitDepthChange = (limit: number, val: number) => {
        // @ts-ignore
        updateSettings({ limitDepths: { ...settings.limitDepths, [limit]: val } });
    };

    const handleLimitComplexityChange = (limit: number, val: number) => {
        // @ts-ignore
        updateSettings({ limitComplexities: { ...settings.limitComplexities, [limit]: val } });
    };

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
          // Defer update to avoid render loop during render
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
                          
                          if (newLayout === 'diamond') newSpacing = 0.756; 
                          else if (newLayout === 'lattice') newSpacing = 1.89; 
                          
                          updateSettings({ 
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

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900/40 p-2 rounded-lg border border-slate-700/50 mb-2">
               {(['ji', 'et', 'indian', 'pythagorean'] as TuningSystem[]).map(sys => {
                   const isDisabled = sys !== 'ji';
                   return (
                       <button 
                          key={sys} 
                          onClick={() => !isDisabled && handleChange('tuningSystem', sys)}
                          disabled={isDisabled}
                          title={isDisabled ? "Coming Soon" : ""}
                          className={`flex-1 px-3 py-2 text-[10px] font-bold rounded border transition-all uppercase tracking-widest 
                            ${settings.tuningSystem === sys 
                                ? 'bg-blue-600 border-blue-400 text-white shadow-lg' 
                                : isDisabled
                                    ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed opacity-50'
                                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                            }`}
                       >
                           {sys === 'ji' ? 'Just Intonation' : sys === 'et' ? 'Equal Temperament' : sys === 'indian' ? 'Indian Classical' : 'Pythagorean'}
                       </button>
                   );
               })}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-2 duration-300 opacity-50 pointer-events-none grayscale">
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
                <div className="grid grid-cols-1 md:flex md:flex-col gap-6 animate-in slide-in-from-right-2 duration-300 opacity-50 pointer-events-none grayscale">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-2 duration-300 opacity-50 pointer-events-none grayscale">
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
    );
};

export default TonalityTab;
