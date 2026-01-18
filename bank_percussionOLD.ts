
import { WaveformType } from './types';
import { p, defaultDisabledOsc } from './patchHelpers';

// 8 Basic Percussion Templates
export const PERCUSSION_PATCHES = [
    p("Basic Kick", "Percussion", 
        { enabled: true, waveform: WaveformType.SINE, gain: 1.0, attack: 0.001, decay: 0.3, sustain: 0, release: 0.1, coarseDetune: -2400 }, 
        { ...defaultDisabledOsc }, 
        { ...defaultDisabledOsc },
        { gain: 0.8, modMatrix: [{ id: 'kick-drop', enabled: true, source: 'env1', target: 'osc1_pitch', amount: 80 }] }
    ),
    p("Basic Snare", "Percussion", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.5, attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }, 
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.4, attack: 0.001, decay: 0.2, sustain: 0, release: 0.1, filterType: 'highpass', filterCutoff: 1000 }, 
        { ...defaultDisabledOsc },
        { gain: 0.7 }
    ),
    p("Basic HiHat", "Percussion", 
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.6, attack: 0.001, decay: 0.05, sustain: 0, release: 0.05, filterType: 'highpass', filterCutoff: 5000 }, 
        { ...defaultDisabledOsc }, 
        { ...defaultDisabledOsc },
        { gain: 0.6 }
    ),
    p("Tom Low", "Percussion", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.001, decay: 0.4, sustain: 0, release: 0.2, coarseDetune: -1200 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        { modMatrix: [{ id: 'tom-drop', enabled: true, source: 'env1', target: 'osc1_pitch', amount: 40 }] }
    ),
    p("Tom High", "Percussion", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.001, decay: 0.3, sustain: 0, release: 0.2, coarseDetune: -500 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        { modMatrix: [{ id: 'tom-drop-h', enabled: true, source: 'env1', target: 'osc1_pitch', amount: 40 }] }
    ),
    p("Clap", "Percussion", 
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.7, attack: 0.01, decay: 0.15, sustain: 0, release: 0.1, filterType: 'bandpass', filterCutoff: 1200, filterResonance: 2 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        { reverbMix: 0.3 }
    ),
    p("Rim", "Percussion", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.8, attack: 0.001, decay: 0.05, sustain: 0, release: 0.05, filterType: 'highpass', filterCutoff: 800 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        {}
    ),
    p("Shaker", "Percussion", 
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.5, attack: 0.02, decay: 0.1, sustain: 0, release: 0.1, filterType: 'bandpass', filterCutoff: 6000, lfoTarget: 'tremolo', lfoRate: 15, lfoDepth: 50 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        {}
    )
];
