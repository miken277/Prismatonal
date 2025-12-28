
import React, { useState } from 'react';
import { PIXELS_PER_MM } from '../../constants';

const BASE_NODE_SIZE_PX = 60;
const BASE_NODE_SPACING_PX = 200;
const VISUAL_CORRECTION_FACTOR = 2.0;

export const scaleToMmSize = (s: number) => (s * BASE_NODE_SIZE_PX) / (PIXELS_PER_MM * VISUAL_CORRECTION_FACTOR);
export const mmToScaleSize = (mm: number) => (mm * PIXELS_PER_MM * VISUAL_CORRECTION_FACTOR) / BASE_NODE_SIZE_PX;

export const scaleToMmSpacing = (s: number) => (s * BASE_NODE_SPACING_PX) / (PIXELS_PER_MM * VISUAL_CORRECTION_FACTOR);
export const mmToScaleSpacing = (mm: number) => (mm * PIXELS_PER_MM * VISUAL_CORRECTION_FACTOR) / BASE_NODE_SPACING_PX;

interface MmSliderProps { 
    valueScale: number; 
    onChangeScale: (v: number) => void; 
    toMm: (v: number) => number; 
    fromMm: (v: number) => number; 
    minMm: number; 
    maxMm: number;
    stepMm?: number;
}

export const MmSlider: React.FC<MmSliderProps> = ({ 
    valueScale, 
    onChangeScale, 
    toMm, 
    fromMm, 
    minMm, 
    maxMm, 
    stepMm = 1 
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

interface NumberInputProps { 
    value: number; 
    min: number; 
    max: number; 
    onChange: (val: number) => void; 
    suffix?: string; 
    className?: string; 
    disabled?: boolean; 
}

export const NumberInput: React.FC<NumberInputProps> = ({ value, min, max, onChange, suffix = "", className = "", disabled = false }) => {
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
