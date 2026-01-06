import React, { useRef, useState } from 'react';
import { AppSettings, ButtonShape, BackgroundMode } from '../../types';
import { DEFAULT_BACKGROUNDS } from '../../constants';
import { MmSlider, scaleToMmSize, mmToScaleSize, scaleToMmSpacing, mmToScaleSpacing } from './SettingsWidgets';

interface Props {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const PRIMES = [3, 5, 7, 9, 11, 13, 15];

const VisualsTab: React.FC<Props> = ({ settings, updateSettings }) => {
    const bgPresetInputRef = useRef<HTMLInputElement>(null);
    const [targetSlotId, setTargetSlotId] = useState<string | null>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    const handleChange = (key: keyof AppSettings, value: any) => updateSettings({ [key]: value });
    const handleUpdate = (partial: Partial<AppSettings>) => updateSettings(partial);
    const handleColorChange = (limit: number, color: string) => updateSettings({ colors: { ...settings.colors, [limit]: color } });

    const processImageFile = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                
                // Smart Resize: Limit largest dimension to 1920px to save space
                const MAX_DIM = 1920;
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_DIM || height > MAX_DIM) {
                    const ratio = width / height;
                    if (width > height) {
                        width = MAX_DIM;
                        height = MAX_DIM / ratio;
                    } else {
                        height = MAX_DIM;
                        width = MAX_DIM * ratio;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG 0.7 for optimal storage size
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                } else {
                    reject(new Error("Could not get canvas context"));
                }
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image"));
            };
            
            img.src = url;
        });
    };

    const requestUploadForSlot = (id: string) => {
        setTargetSlotId(id);
        bgPresetInputRef.current?.click();
    };

    const handlePresetImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && targetSlotId) {
            try {
                setIsProcessingImage(true);
                const base64 = await processImageFile(file);
                
                const newPresets = settings.backgroundPresets.map(p => {
                    if (p.id === targetSlotId) {
                        return { ...p, data: base64 };
                    }
                    return p;
                });

                handleUpdate({
                    backgroundPresets: newPresets,
                    backgroundImageData: base64,
                    backgroundMode: 'image'
                });
                
            } catch (err) {
                console.error("Image processing failed:", err);
                alert("Failed to process image.");
            } finally {
                setIsProcessingImage(false);
                setTargetSlotId(null);
                if (bgPresetInputRef.current) bgPresetInputRef.current.value = '';
            }
        }
    };

    const updatePresetName = (id: string, newName: string) => {
        const newPresets = settings.backgroundPresets.map(p => {
            if (p.id === id) return { ...p, name: newName };
            return p;
        });
        handleUpdate({ backgroundPresets: newPresets });
    };

    const clearPresetSlot = (id: string) => {
        if (window.confirm("Clear this background slot?")) {
            const newPresets = settings.backgroundPresets.map(p => {
                if (p.id === id) return { ...p, data: null, name: 'Empty Slot' };
                return p;
            });
            handleUpdate({ backgroundPresets: newPresets });
        }
    };

    const handleDeveloperExport = () => {
        const json = JSON.stringify(settings.backgroundPresets, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            alert("Background Config Copied to Clipboard!\n\nPaste this into 'constants.ts' to persist these images in the source code.");
        }).catch(err => {
            console.error('Failed to copy', err);
            console.log(json);
            alert("Failed to copy to clipboard. Config dumped to console.");
        });
    };

    return (
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
                        
                        <div className="bg-slate-900/40 p-3 rounded border border-slate-700/50 space-y-2">
                            <label className="block text-sm font-semibold text-slate-300">Visual Theme (Skin)</label>
                            <div className="flex bg-slate-800 rounded p-1 border border-slate-600">
                                {(['default', 'paper', 'blueprint', 'cyber'] as const).map(skin => (
                                    <button 
                                        key={skin} 
                                        onClick={() => handleChange('activeSkin', skin)} 
                                        className={`flex-1 py-1.5 text-xs font-bold rounded uppercase transition-colors ${settings.activeSkin === skin ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        {skin}
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
                    <h3 className="font-semibold text-pink-400 border-b border-slate-700 pb-1">Background</h3>
                    
                    <div className="bg-slate-900/40 p-4 rounded border border-slate-700/50 space-y-6">
                        {/* Mode Selector */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Background Mode</label>
                            <div className="flex bg-slate-800 rounded p-1 border border-slate-600">
                                {(['image', 'solid', 'gradient'] as BackgroundMode[]).map(mode => (
                                    <button 
                                        key={mode} 
                                        onClick={() => handleChange('backgroundMode', mode)} 
                                        className={`flex-1 py-1.5 text-xs font-bold rounded uppercase transition-colors ${settings.backgroundMode === mode ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* SOLID Mode Controls */}
                        {settings.backgroundMode === 'solid' && (
                            <div className="animate-in fade-in space-y-4">
                                <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Fill Color</label>
                                    <div className="flex items-center gap-3">
                                        <input type="color" value={settings.solidColor} onChange={(e) => handleChange('solidColor', e.target.value)} className="flex-1 h-10 bg-transparent border-none cursor-pointer rounded" />
                                        <span className="text-xs font-mono text-slate-400">{settings.solidColor}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* GRADIENT Mode Controls */}
                        {settings.backgroundMode === 'gradient' && (
                            <div className="animate-in fade-in space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Start Color</label>
                                        <input type="color" value={settings.gradientColorStart} onChange={(e) => handleChange('gradientColorStart', e.target.value)} className="w-full h-10 bg-transparent border-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">End Color</label>
                                        <input type="color" value={settings.gradientColorEnd} onChange={(e) => handleChange('gradientColorEnd', e.target.value)} className="w-full h-10 bg-transparent border-none cursor-pointer" />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Gradient Type</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleChange('gradientType', 'linear')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${settings.gradientType === 'linear' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>Linear</button>
                                        <button onClick={() => handleChange('gradientType', 'radial')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${settings.gradientType === 'radial' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>Radial</button>
                                    </div>
                                </div>

                                {settings.gradientType === 'linear' && (
                                    <div className="space-y-1">
                                        <label className="flex justify-between text-xs text-slate-300"><span>Angle</span> <span>{settings.gradientAngle}°</span></label>
                                        <input type="range" min="0" max="360" step="5" value={settings.gradientAngle} onChange={(e) => handleChange('gradientAngle', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* IMAGE Mode Controls */}
                        {settings.backgroundMode === 'image' && (
                            <div className="animate-in fade-in space-y-4">
                                
                                {/* Hidden input for preset uploads */}
                                <input type="file" ref={bgPresetInputRef} className="hidden" accept="image/*" onChange={handlePresetImageUpload} />

                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="block text-[10px] text-slate-500 font-bold uppercase">Background Library</label>
                                        <button 
                                            onClick={handleDeveloperExport}
                                            className="text-[9px] font-bold text-indigo-400 hover:text-white bg-indigo-900/30 hover:bg-indigo-600 px-2 py-0.5 rounded border border-indigo-500/30 transition-colors"
                                            title="Export current background presets as JSON for source code persistence"
                                        >
                                            Copy Config
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                        {(settings.backgroundPresets && settings.backgroundPresets.length > 0 ? settings.backgroundPresets : DEFAULT_BACKGROUNDS).map((bg, idx) => {
                                            const isActive = settings.backgroundImageData === bg.data && bg.data !== null;
                                            const isEmpty = !bg.data;
                                            
                                            return (
                                                <div key={bg.id || idx} className={`relative flex flex-col bg-slate-800 rounded border transition-all group ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}>
                                                    
                                                    {/* Image Area */}
                                                    <div 
                                                        className="h-24 w-full relative bg-slate-900 cursor-pointer overflow-hidden rounded-t"
                                                        onClick={() => {
                                                            if (!isEmpty) {
                                                                handleUpdate({ 
                                                                    backgroundImageData: bg.data,
                                                                    backgroundMode: 'image'
                                                                });
                                                            } else {
                                                                requestUploadForSlot(bg.id);
                                                            }
                                                        }}
                                                    >
                                                        {isEmpty ? (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 group-hover:text-slate-400 transition-colors">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                                <span className="text-[9px] font-bold uppercase">Upload</span>
                                                            </div>
                                                        ) : (
                                                            <div 
                                                                className="absolute inset-0 transition-transform group-hover:scale-105 duration-500" 
                                                                style={{ 
                                                                    backgroundImage: `url("${bg.data}")`, 
                                                                    backgroundSize: 'cover',
                                                                    backgroundPosition: 'center'
                                                                }}
                                                            />
                                                        )}
                                                        
                                                        {/* Hover Overlay Controls */}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); requestUploadForSlot(bg.id); }}
                                                                className="p-1.5 bg-slate-700 hover:bg-blue-600 text-white rounded-full transition-colors shadow-lg border border-white/20"
                                                                title="Replace Image"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                            </button>
                                                            {!isEmpty && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); clearPresetSlot(bg.id); }}
                                                                    className="p-1.5 bg-slate-700 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg border border-white/20"
                                                                    title="Clear Slot"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            )}
                                                        </div>

                                                        {isActive && (
                                                            <div className="absolute top-1 right-1 bg-indigo-600 rounded-full p-0.5 shadow border border-white/30 z-10">
                                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Name Input */}
                                                    <div className="p-1.5 bg-slate-800/80 border-t border-slate-700">
                                                        <input 
                                                            type="text" 
                                                            value={bg.name}
                                                            onChange={(e) => updatePresetName(bg.id, e.target.value)}
                                                            className="w-full bg-transparent text-[10px] text-center font-bold text-slate-300 focus:text-white focus:outline-none border-b border-transparent focus:border-slate-500 placeholder-slate-600"
                                                            placeholder="Name..."
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-2 italic text-center">
                                        Images are auto-resized to 1080p max. Library is local to this browser.
                                    </p>
                                </div>

                                <div className="space-y-1 pt-4 border-t border-slate-700">
                                    <label className="flex justify-between text-xs text-slate-300"><span>Gamma / Brightness</span> <span>{settings.bgImageGamma.toFixed(2)}</span></label>
                                    <input type="range" min="0.1" max="2.0" step="0.05" value={settings.bgImageGamma} onChange={(e) => handleChange('bgImageGamma', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                </div>

                                <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Tint Overlay</label>
                                    <div className="flex items-center gap-3 mb-2">
                                        <input type="color" value={settings.bgImageTint} onChange={(e) => handleChange('bgImageTint', e.target.value)} className="w-10 h-8 bg-transparent border-none cursor-pointer" />
                                        <div className="flex-1">
                                            <input type="range" min="0" max="1" step="0.05" value={settings.bgImageTintStrength} onChange={(e) => handleChange('bgImageTintStrength', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-[9px] text-slate-500">
                                        <span>Color</span>
                                        <span>Opacity: {(settings.bgImageTintStrength * 100).toFixed(0)}%</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-300">Tile Image</span>
                                    <input type="checkbox" checked={settings.backgroundTiling} onChange={(e) => handleChange('backgroundTiling', e.target.checked)} className="w-4 h-4 rounded border-slate-600 text-indigo-500" />
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="flex justify-between text-xs text-slate-300"><span>Y Offset</span> <span>{settings.backgroundYOffset}px</span></label>
                                    <input type="range" min="-1000" max="1000" step="10" value={settings.backgroundYOffset} onChange={(e) => handleChange('backgroundYOffset', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisualsTab;
