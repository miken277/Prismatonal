
import { WaveformType } from './types';
import { p, defaultDisabledOsc } from './patchHelpers';

export const preservedAnalogStrings = p("Analog Strings", "Strings",
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, fineDetune: -1, gain: 0.3, attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.2, filterCutoff: 2000, filterResonance: 0.2, lfoRate: 0.1, lfoDepth: 30, lfoTarget: 'filter' },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, fineDetune: 1, gain: 0.3, attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.2, filterCutoff: 2000, filterResonance: 0.2, lfoRate: 3.5, lfoDepth: 10, lfoTarget: 'tremolo' },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 1200, fineDetune: 0, gain: 0.12, attack: 1.0, decay: 0.5, sustain: 0.7, release: 2.0, filterCutoff: 1500, filterResonance: 0.5, lfoRate: 0.2, lfoDepth: 20, lfoTarget: 'filter' },
    { category: 'Strings', gain: 0.6, spread: 0.8, stereoPanSpeed: 0.05, stereoPanDepth: 0.3, reverbType: 'hall', reverbMix: 0.7, delayMix: 0.3, delayTime: 0.4, delayFeedback: 0.3, compressorThreshold: -20, compressorRatio: 6, compressorRelease: 0.3, modMatrix: [{ id: 'm1', enabled: true, source: 'lfo1', target: 'osc1_cutoff', amount: 20 }, { id: 'm2', enabled: true, source: 'lfo2', target: 'osc1_pitch', amount: 2 }] }
);

export const STRINGS_PATCHES = [
    // Solo Violin - Expressive, bowed texture with bite
    p("Solo Violin", "Strings",
        // Osc 1: Body (Sawtooth, Lowpass) with Vibrato
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.7, attack: 0.3, decay: 0.5, sustain: 0.9, release: 0.5, filterCutoff: 2000, lfoWaveform: 'sine', lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 8, lfoDelay: 0.4 },
        // Osc 2: Resonance (Bandpass)
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.4, coarseDetune: 0, fineDetune: 3, filterType: 'bandpass', filterCutoff: 1200, filterResonance: 3.0 },
        // Osc 3: Bow Noise (Subtle Friction)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.04, filterType: 'bandpass', filterCutoff: 4000, filterResonance: 1, attack: 0.1, decay: 0.2, sustain: 0.1 },
        { 
            spread: 0.2, 
            reverbType: 'hall', 
            reverbMix: 0.3, 
            portamento: 0.1
        }
    ),
    // Tremolo Strings - Rapid, rhythmic bowing for tension
    p("Tremolo Strings", "Strings",
        // Osc 1: Left Tremolo (Sine LFO)
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, filterCutoff: 3000, lfoWaveform: 'sine', lfoRate: 7, lfoDepth: 70, lfoTarget: 'tremolo' },
        // Osc 2: Right Tremolo (Triangle LFO - slightly different rate)
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 5, gain: 0.5, filterCutoff: 3000, lfoWaveform: 'triangle', lfoRate: 7.5, lfoDepth: 70, lfoTarget: 'tremolo' },
        // Osc 3: Sub Anchor
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.3, filterCutoff: 600 },
        { spread: 0.9, reverbType: 'hall', reverbMix: 0.5 }
    ),
    // Cinematic Swell - Slow evolving texture
    p("Cinematic Swell", "Strings",
        // Osc 1: Slow Attack Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.6, attack: 2.0, sustain: 1.0, release: 2.5, filterCutoff: 800, lfoWaveform: 'sine', lfoRate: 0.1, lfoDepth: 30, lfoTarget: 'filter' },
        // Osc 2: Detuned Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 10, gain: 0.5, attack: 2.5, sustain: 1.0, release: 3.0, filterCutoff: 1000 },
        // Osc 3: High Shimmer
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1205, gain: 0.3, attack: 3.0, sustain: 0.8, release: 4.0, lfoWaveform: 'triangle', lfoRate: 4, lfoDepth: 10, lfoTarget: 'tremolo' },
        { 
            spread: 0.7, 
            reverbType: 'cathedral', 
            reverbMix: 0.7,
            modMatrix: [
                { id: 'swell-filter', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 80 }
            ]
        }
    ),
    // Chamber Quartet - Realistic small ensemble
    p("Chamber Quartet", "Strings",
        // Osc 1: Cello
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1200, gain: 0.5, filterCutoff: 1500, lfoWaveform: 'sine', lfoRate: 5, lfoDepth: 5, lfoTarget: 'pitch', lfoDelay: 0.5 },
        // Osc 2: Viola
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, gain: 0.4, filterCutoff: 2000, lfoWaveform: 'sine', lfoRate: 5.2, lfoDepth: 6, lfoTarget: 'pitch', lfoDelay: 0.6 },
        // Osc 3: Violin
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 1205, gain: 0.3, filterCutoff: 3000, lfoWaveform: 'sine', lfoRate: 5.8, lfoDepth: 7, lfoTarget: 'pitch', lfoDelay: 0.4 },
        { 
            spread: 0.6, 
            reverbType: 'room', 
            reverbMix: 0.4
        }
    ),
    p("Cello Section", "Strings", { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1200, gain: 0.5, attack: 0.4, release: 0.8, filterCutoff: 1000 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1205, gain: 0.4, attack: 0.5, release: 0.9, filterCutoff: 800 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1195, gain: 0.4, attack: 0.4, release: 0.8 }, { spread: 0.6, reverbType: 'hall', reverbMix: 0.6 })
];

export const PLUCKED_PATCHES = [
    // Harp - Clean, resonant, plucked
    p("Celestial Harp", "Plucked",
        // Osc 1: Pluck Attack & Fundamental
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.01, decay: 2.5, sustain: 0.05, release: 2.0 },
        // Osc 2: Body/String Resonance (Tri for warmth)
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 0, gain: 0.4, attack: 0.02, decay: 1.8, sustain: 0.0 },
        // Osc 3: Upper Harmonic Sparkle
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1205, gain: 0.2, attack: 0.01, decay: 1.0, sustain: 0 },
        { 
            spread: 0.6, 
            reverbType: 'hall', 
            reverbMix: 0.5, 
            delayMix: 0.3,
            resonatorMix: 0.2, // Subtle body
            resonatorSweep: 0.3
        }
    ),
    // Koto/Zither - Sharp attack, eastern tuning feel
    p("Eastern Zither", "Plucked",
        // Osc 1: Sharp Saw (Plucked String)
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.7, attack: 0.005, decay: 0.4, sustain: 0, filterType: 'lowpass', filterCutoff: 4000, filterResonance: 1.0 },
        // Osc 2: Metallic Ring (Square with high resonance)
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, gain: 0.3, attack: 0.005, decay: 0.3, sustain: 0, filterType: 'bandpass', filterCutoff: 2500, filterResonance: 8.0 },
        // Osc 3: Wood Body
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.4, attack: 0.01, decay: 0.6, filterType: 'lowpass', filterCutoff: 1000 },
        { 
            spread: 0.4, 
            reverbType: 'plate', 
            reverbMix: 0.3, 
            delayMix: 0.2,
            modMatrix: [
                { id: 'twang', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 30 }
            ]
        }
    ),
    // Guitar-ish
    p("Nylon Guitar", "Plucked",
        // Osc 1: String
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.7, attack: 0.01, decay: 1.0, sustain: 0, filterType: 'lowpass', filterCutoff: 3000 },
        // Osc 2: Body Tone
        { enabled: true, waveform: WaveformType.SINE, gain: 0.4, attack: 0.02, decay: 0.8, sustain: 0 },
        // Osc 3: Finger Noise (Subtle)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.02, attack: 0.005, decay: 0.05, filterType: 'highpass', filterCutoff: 5000 }, 
        { 
            spread: 0.3, 
            reverbType: 'room', 
            reverbMix: 0.3,
            resonatorMix: 0.4, // Wooden body simulation
            resonatorSweep: 0.2
        }
    ),
    // Pizzicato
    p("Pizzicato Section", "Plucked",
        // Osc 1: Main Pluck
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.7, attack: 0.005, decay: 0.3, sustain: 0, filterType: 'lowpass', filterCutoff: 1500, filterResonance: 0.5 },
        // Osc 2: Thump/Body
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.5, attack: 0.005, decay: 0.2, sustain: 0, filterType: 'lowpass', filterCutoff: 800 },
        // Osc 3: String Release/Squeak
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.2, attack: 0.01, decay: 0.1, sustain: 0 },
        { 
            spread: 0.6, 
            reverbType: 'hall', 
            reverbMix: 0.3,
            modMatrix: [
                { id: 'pluck-snap', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 40 }
            ]
        }
    )
];
