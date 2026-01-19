
import React, { useMemo } from 'react';
import { AppSettings, TuningSystem, LayoutApproach } from '../../types';
import { NumberInput } from './SettingsWidgets';
import { GRID_IDENTITIES, DEFAULT_COLORS } from '../../constants';
import { Fraction, getOddLimit } from '../../services/LatticeService';

interface Props {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const TonalityTab: React.FC<Props> = ({ settings, updateSettings }) => {
    
    const handleChange = (key: keyof AppSettings, value: any) => updateSettings({ [key]: value });

    const toggleGridCell = (index: number) => {
        const newMask = [...settings.enabledGridMask];
        newMask[index] = !newMask[index];
        updateSettings({ enabledGridMask: newMask });
    };

    const setMatrixPreset = (type: 'all' | 'none' | 'diagonal' | 'square' | 'cross') => {
        const newMask = new Array(64).fill(false);
        for(let i=0; i<64; i++) {
            const row = Math.floor(i / 8);
            const col = i % 8;
            
            if (type === 'all') newMask[i] = true;
            if (type === 'diagonal') {
                if (row === col) newMask[i] = true; // 1/1 diagonal
            }
            if (type === 'square') {
                // First 3 identities (1, 5, 3) 3x3 grid
                if (row < 3 && col < 3) newMask[i] = true;
            }
            if (type === 'cross') {
                // 1/1 Row and 1/1 Col (Identity 0)
                if (row === 0 || col === 0) newMask[i] = true;
            }
        }
        updateSettings({ enabledGridMask: newMask });
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

    // Memoize cell data to avoid re-calculating fractions on every render
    const matrixCells = useMemo(() => {
        const cells = [];
        for(let i=0; i<64; i++) {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const otonal = GRID_IDENTITIES[row]; // Numerator source
            const utonal = GRID_IDENTITIES[col]; // Denominator source
            
            // Calc Ratio: (Otonal / Utonal)
            // Identity is {n, d}
            const frac = new Fraction(otonal.n, otonal.d).div(new Fraction(utonal.n, utonal.d)).normalize();
            const limit = Math.max(getOddLimit(frac.n), getOddLimit(frac.d));
            const color = DEFAULT_COLORS[limit] || '#ffffff';
            
            cells.push({ index: i, label: `${frac.n}/${frac.d}`, color, limit });
        }
        return cells;
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl mx-auto">
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
                <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                    {renderLayoutSelector('ji')}
                    {renderBaseFrequency()}
                    
                    <h3 className="font-semibold text-blue-300 border-b border-slate-700 pb-1 flex justify-between items-center">
                        <span>Tonality Matrix</span>
                        <div className="flex gap-1">
                            <button onClick={() => setMatrixPreset('all')} className="text-[9px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 hover:bg-slate-700">ALL</button>
                            <button onClick={() => setMatrixPreset('square')} className="text-[9px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 hover:bg-slate-700">3x3</button>
                            <button onClick={() => setMatrixPreset('cross')} className="text-[9px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 hover:bg-slate-700">CROSS</button>
                            <button onClick={() => setMatrixPreset('none')} className="text-[9px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 hover:bg-slate-700">CLR</button>
                        </div>
                    </h3>
                    
                    <div className="bg-slate-900/40 p-4 rounded border border-slate-700/50 space-y-4 overflow-x-auto">
                        <div className="min-w-[300px]">
                            {/* Grid Headers */}
                            <div className="grid grid-cols-[30px_repeat(8,1fr)] gap-1 mb-1">
                                <div className="text-[8px] font-bold text-slate-600 flex items-end justify-center">O\U</div>
                                {GRID_IDENTITIES.map((id, i) => (
                                    <div key={i} className="text-[9px] font-bold text-slate-400 text-center bg-slate-800/50 rounded py-1 border border-slate-700">
                                        {id.n}/{id.d}
                                    </div>
                                ))}
                            </div>
                            
                            {/* Grid Rows */}
                            {GRID_IDENTITIES.map((oId, row) => (
                                <div key={row} className="grid grid-cols-[30px_repeat(8,1fr)] gap-1 mb-1">
                                    {/* Row Header */}
                                    <div className="text-[9px] font-bold text-slate-400 flex items-center justify-center bg-slate-800/50 rounded border border-slate-700">
                                        {oId.n}/{oId.d}
                                    </div>
                                    
                                    {/* Cells */}
                                    {Array.from({length: 8}).map((_, col) => {
                                        const index = row * 8 + col;
                                        const cell = matrixCells[index];
                                        const isActive = settings.enabledGridMask[index];
                                        
                                        return (
                                            <button
                                                key={index}
                                                onClick={() => toggleGridCell(index)}
                                                className={`
                                                    relative h-8 rounded border transition-all duration-150 flex items-center justify-center
                                                    ${isActive 
                                                        ? 'bg-slate-800 border-transparent shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' 
                                                        : 'bg-slate-900/30 border-slate-800 opacity-40 hover:opacity-70'
                                                    }
                                                `}
                                                title={`Ratio: ${cell.label}, Limit: ${cell.limit}`}
                                            >
                                                <div 
                                                    className={`w-2 h-2 rounded-full transition-transform ${isActive ? 'scale-125' : 'scale-75 grayscale'}`} 
                                                    style={{ 
                                                        backgroundColor: cell.color,
                                                        boxShadow: isActive ? `0 0 8px ${cell.color}` : 'none'
                                                    }}
                                                />
                                                {isActive && (
                                                    <span className="absolute bottom-0.5 right-1 text-[7px] font-mono text-slate-400 leading-none">
                                                        {cell.label}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        <p className="text-[9px] text-slate-500 italic mt-2 text-center">
                            Enable intersecting Otonal (Rows) and Utonal (Cols) identities to generate the lattice.
                        </p>
                    </div>
                </div>
            )}

            {settings.tuningSystem === 'et' && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300 opacity-50 pointer-events-none grayscale">
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
            )}

            {settings.tuningSystem === 'indian' && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300 opacity-50 pointer-events-none grayscale">
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
            )}

            {settings.tuningSystem === 'pythagorean' && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300 opacity-50 pointer-events-none grayscale">
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
            )}
        </div>
    );
};

export default TonalityTab;
