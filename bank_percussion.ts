
import { WaveformType } from './types';
import { p, defaultDisabledOsc } from './patchHelpers';

// 8 Basic Percussion Templates + New Additions
export const PERCUSSION_PATCHES = [
    p("Basic Kick", "Percussion", 
        // Osc 1: Sub Sine with Pitch Drop
        { enabled: true, waveform: WaveformType.SINE, gain: 1.0, attack: 0.001, decay: 0.3, sustain: 0, release: 0.1, coarseDetune: -2400 }, 
        // Osc 2: Click (High passed pulse)
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.1, attack: 0.001, decay: 0.02, sustain: 0, filterType: 'highpass', filterCutoff: 2000 }, 
        { ...defaultDisabledOsc },
        { 
            gain: 0.9, 
            compressorThreshold: -10,
            compressorRatio: 4,
            modMatrix: [{ id: 'kick-drop', enabled: true, source: 'env1', target: 'osc1_pitch', amount: 80 }] 
        }
    ),
    p("Basic Snare", "Percussion", 
        // Osc 1: Tonal Body (Triangle)
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, attack: 0.001, decay: 0.15, sustain: 0, release: 0.1, coarseDetune: -500 }, 
        // Osc 2: Snares (Noise) - Reduced gain for cleaner mix
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.15, attack: 0.001, decay: 0.25, sustain: 0, release: 0.1, filterType: 'highpass', filterCutoff: 2000 }, 
        { ...defaultDisabledOsc },
        { gain: 0.8, reverbMix: 0.15 }
    ),
    p("Basic HiHat", "Percussion", 
        // Osc 1: Metallic Noise
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.25, attack: 0.001, decay: 0.05, sustain: 0, release: 0.05, filterType: 'highpass', filterCutoff: 7000 }, 
        { ...defaultDisabledOsc }, 
        { ...defaultDisabledOsc },
        { gain: 0.7 }
    ),
    p("Tom Low", "Percussion", 
        // Osc 1: Resonant Thud
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.001, decay: 0.4, sustain: 0, release: 0.2, coarseDetune: -1900 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        { modMatrix: [{ id: 'tom-drop', enabled: true, source: 'env1', target: 'osc1_pitch', amount: 30 }] }
    ),
    p("Tom High", "Percussion", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.001, decay: 0.3, sustain: 0, release: 0.2, coarseDetune: -1200 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        { modMatrix: [{ id: 'tom-drop-h', enabled: true, source: 'env1', target: 'osc1_pitch', amount: 30 }] }
    ),
    p("Clap", "Percussion", 
        // Osc 1: Filtered Noise Burst
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.4, attack: 0.01, decay: 0.15, sustain: 0, release: 0.1, filterType: 'bandpass', filterCutoff: 1200, filterResonance: 2 }, 
        // Osc 2: Secondary Burst (Simulate multiple hands via delay/decay offset)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.3, attack: 0.02, decay: 0.1, sustain: 0, filterType: 'bandpass', filterCutoff: 1500, filterResonance: 2 },
        { ...defaultDisabledOsc },
        { reverbMix: 0.25, stereoPanSpeed: 0, spread: 0.5 }
    ),
    p("Rim", "Percussion", 
        // Osc 1: Wood Pop
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.8, attack: 0.001, decay: 0.05, sustain: 0, release: 0.05, filterType: 'highpass', filterCutoff: 600 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        { gain: 0.7, reverbMix: 0.1 }
    ),
    p("Shaker", "Percussion", 
        // Osc 1: High filtered noise with Tremolo for movement
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.15, attack: 0.02, decay: 0.1, sustain: 0, release: 0.1, filterType: 'bandpass', filterCutoff: 6000, lfoTarget: 'tremolo', lfoRate: 15, lfoDepth: 50 }, 
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        { gain: 0.8 }
    ),
    p("Analog Cowbell", "Percussion",
        // Osc 1: Square 1 (Approx 540Hz relative to root)
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 500, gain: 0.6, attack: 0.001, decay: 0.3, sustain: 0, filterType: 'bandpass', filterCutoff: 600, filterResonance: 2.0 },
        // Osc 2: Square 2 (Approx 800Hz)
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, gain: 0.6, attack: 0.001, decay: 0.3, sustain: 0, filterType: 'bandpass', filterCutoff: 850, filterResonance: 2.0 },
        { ...defaultDisabledOsc },
        { gain: 0.7, reverbMix: 0.1 }
    ),
    p("Woodblock", "Percussion",
        // Osc 1: Hollow Sine
        { enabled: true, waveform: WaveformType.SINE, gain: 0.9, attack: 0.001, decay: 0.1, sustain: 0, coarseDetune: 1200 },
        // Osc 2: Pitch Envelope for "Tock"
        { enabled: true, waveform: WaveformType.SINE, gain: 0.0, lfoTarget: 'none' }, // Dummy for matrix? No, just use Env1 on Osc1 pitch
        { ...defaultDisabledOsc },
        { 
            gain: 0.8, 
            modMatrix: [{ id: 'wb-p', enabled: true, source: 'env1', target: 'osc1_pitch', amount: 20 }] 
        }
    ),
    p("Digital Zap", "Percussion",
        // Osc 1: Saw sweep
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.7, attack: 0.001, decay: 0.15, sustain: 0, filterType: 'lowpass', filterCutoff: 2000 },
        { ...defaultDisabledOsc },
        { ...defaultDisabledOsc },
        { 
            gain: 0.6,
            modMatrix: [
                { id: 'zap-p', enabled: true, source: 'env1', target: 'osc1_pitch', amount: 80 },
                { id: 'zap-f', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 50 }
            ] 
        }
    )
];
