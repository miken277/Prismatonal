
import { OscillatorConfig, ReverbType, SynthPreset, WaveformType } from './types';

// Reverb Defaults Helper
export const REVERB_DEFAULTS: Record<ReverbType, { size: number, damping: number, diffusion: number }> = {
    'room': { size: 1.5, damping: 0.3, diffusion: 0.8 },
    'hall': { size: 3.0, damping: 0.6, diffusion: 0.7 },
    'cathedral': { size: 6.0, damping: 0.85, diffusion: 0.85 },
    'plate': { size: 2.0, damping: 0.1, diffusion: 1.0 },
    'shimmer': { size: 8.0, damping: 0.2, diffusion: 0.5 }
};

// Helper for default disabled oscillator
export const defaultDisabledOsc: OscillatorConfig = {
    enabled: false,
    waveform: WaveformType.SINE,
    coarseDetune: 0,
    fineDetune: 5,
    gain: 0.5,
    attack: 0.1,
    decay: 0.5,
    sustain: 0.7,
    release: 1.0,
    holdDecay: 0, // Infinite hold by default
    pedalDecay: 0, // Infinite pedal hold by default
    filterCutoff: 2000,
    filterResonance: 0.5,
    filterType: 'lowpass',
    lfoRate: 1,
    lfoDepth: 0,
    lfoWaveform: 'sine',
    lfoTarget: 'none',
    lfoDelay: 0
};

export const generateInitPatch = (name: string, id: string): SynthPreset => ({
    id: id,
    name: name,
    category: 'User',
    gain: 0.5,
    modMatrix: [],
    osc1: { ...defaultDisabledOsc, enabled: true, gain: 0.5 },
    osc2: { ...defaultDisabledOsc },
    osc3: { ...defaultDisabledOsc },
    spread: 0.0,
    stereoPanSpeed: 0,
    stereoPanDepth: 0,
    reverbType: 'room',
    reverbMix: 0.1,
    reverbSize: REVERB_DEFAULTS['room'].size,
    reverbDamping: REVERB_DEFAULTS['room'].damping,
    reverbDiffusion: REVERB_DEFAULTS['room'].diffusion,
    delayMix: 0,
    delayTime: 0.25,
    delayFeedback: 0.2,
    compressorThreshold: -10,
    compressorRatio: 4,
    compressorRelease: 0.2,
    portamento: 0
});

export const p = (name: string, cat: string, osc1: Partial<OscillatorConfig>, osc2: Partial<OscillatorConfig>, osc3: Partial<OscillatorConfig>, extra: Partial<SynthPreset> = {}): SynthPreset => {
    const base = generateInitPatch(name, `${cat}-${name.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2,5)}`);
    base.category = cat;
    if (osc1) base.osc1 = { ...base.osc1, ...osc1 };
    if (osc2) base.osc2 = { ...base.osc2, ...osc2 };
    if (osc3) base.osc3 = { ...base.osc3, ...osc3 };
    if (extra.reverbType && (extra.reverbSize === undefined || extra.reverbDamping === undefined || extra.reverbDiffusion === undefined)) {
        const defaults = REVERB_DEFAULTS[extra.reverbType];
        if (extra.reverbSize === undefined) extra.reverbSize = defaults.size;
        if (extra.reverbDamping === undefined) extra.reverbDamping = defaults.damping;
        if (extra.reverbDiffusion === undefined) extra.reverbDiffusion = defaults.diffusion;
    }
    return { ...base, ...extra };
};
