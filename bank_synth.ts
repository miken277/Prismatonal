
import { WaveformType } from './types';
import { p, defaultDisabledOsc } from './patchHelpers';

// --- DIAGNOSTIC PATCHES ---
export const DIAGNOSTIC_PATCHES = [
    p("FM Stress Test", "Diagnostics", 
        // Osc 1: Carrier (Sine)
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.1, decay: 0.5, sustain: 1.0, release: 0.5 }, 
        // Osc 2: Disabled
        { enabled: false }, 
        // Osc 3: Disabled
        { enabled: false }, 
        { 
            gain: 0.8, 
            spread: 0, 
            reverbMix: 0, 
            delayMix: 0,
            // Modulate Osc 1 Pitch with LFO 1 at Audio Rate (150Hz) for Deep FM
            // This creates sidebands that will alias/hiss if interpolation is poor
            modMatrix: [
                { id: 'diag-fm', enabled: true, source: 'lfo1', target: 'osc1_pitch', amount: 80 }
            ],
            // Pre-configure LFO 1 to run fast
            osc1: { ...defaultDisabledOsc, enabled: true, waveform: WaveformType.SINE, lfoRate: 150, lfoDepth: 0, lfoTarget: 'none' }
        }
    )
];

/**
 * SYNTH PADS
 * Sustained, evolving textures meant for harmony.
 */
export const ETHEREAL_PADS = [
    // Cloud Nine - The standard "heavenly" pad
    p("Cloud Nine", "Pads", 
        // Osc 1: Warm foundation
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, attack: 1.5, decay: 3.0, sustain: 0.8, release: 4.0 }, 
        // Osc 2: Detuned texture
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 0, fineDetune: 10, gain: 0.4, attack: 2.0, decay: 3.0, sustain: 0.7, release: 4.0 }, 
        // Osc 3: Airy shimmer (+2 octaves)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, attack: 3.0, release: 5.0, lfoTarget: 'tremolo', lfoRate: 6, lfoDepth: 40 }, 
        { spread: 0.8, reverbType: 'shimmer', reverbMix: 0.7, reverbSize: 6.0, delayMix: 0.3 }
    ),
    // Warm Blanket - Low pass filtered warmth
    p("Warm Blanket", "Pads", 
        // Osc 1: Filtered Triangle
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.7, attack: 0.8, sustain: 1.0, release: 2.0, filterType: 'lowpass', filterCutoff: 600, lfoTarget: 'filter', lfoRate: 0.2, lfoDepth: 20 }, 
        // Osc 2: Sub Sine
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.5, attack: 1.0, sustain: 1.0, release: 2.0 }, 
        // Osc 3: Wide detuned saw (quiet)
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 10, gain: 0.15, filterType: 'lowpass', filterCutoff: 1000 }, 
        { spread: 0.6, reverbType: 'hall', reverbMix: 0.5, reverbDamping: 0.8 } // Dark reverb
    ),
    // Angel Choir - Formant simulation via Bandpass filters
    p("Angel Choir", "Pads", 
        // Osc 1: Formant-ish Saw (Bandpass)
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.6, attack: 1.0, sustain: 0.9, release: 2.0, filterType: 'bandpass', filterCutoff: 800, filterResonance: 4.0 }, 
        // Osc 2: Higher Formant
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.4, attack: 1.0, sustain: 0.9, release: 2.0, filterType: 'bandpass', filterCutoff: 1500, filterResonance: 3.0, coarseDetune: 5 }, 
        // Osc 3: Air - Drastically reduced gain for cleanliness
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.005, filterType: 'highpass', filterCutoff: 4000 }, 
        { spread: 0.7, reverbType: 'cathedral', reverbMix: 0.8, resonatorMix: 0.3, resonatorSweep: 0.5 }
    ),
    // Crystal Pad - High pass filtered, glassy texture (NEW)
    p("Crystal Pad", "Pads",
        // Osc 1: Thin Pulse
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.5, filterType: 'highpass', filterCutoff: 800, attack: 2.0, release: 3.0 },
        // Osc 2: Upper Octave Sine
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.4, attack: 1.5, release: 3.0 },
        // Osc 3: Sparkle (Fast LFO)
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, gain: 0.2, lfoTarget: 'tremolo', lfoRate: 8, lfoDepth: 60 },
        { spread: 0.9, reverbType: 'plate', reverbMix: 0.7, delayMix: 0.4 }
    ),
    // Ice Fields - Cold, static texture
    p("Ice Fields", "Pads", 
        // Osc 1: High Sine
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.5, attack: 0.5, release: 3.0 }, 
        // Osc 2: Cold Square
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 2400, gain: 0.2, filterType: 'highpass', filterCutoff: 2000, lfoTarget: 'tremolo', lfoRate: 8, lfoDepth: 30 }, 
        // Osc 3: Glitter (Noise LFO on Pitch)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, gain: 0.3, attack: 0.1, lfoWaveform: 'noise', lfoTarget: 'pitch', lfoRate: 12, lfoDepth: 10 }, 
        { spread: 0.8, reverbType: 'plate', reverbMix: 0.6, reverbSize: 4.0 }
    )
];

/**
 * SYNTH LEADS
 * Monophonic-style sounds (though engine is poly) for melody.
 */
export const ETHEREAL_LEADS = [
    // Square Lead 101 - Classic analog lead
    p("Square Lead 101", "Leads",
        // Osc 1: Main Square
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.6, attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.2, filterType: 'lowpass', filterCutoff: 2000, filterResonance: 2.0 },
        // Osc 2: Detuned Square (PWM effect via interference)
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 0, fineDetune: 8, gain: 0.6, filterType: 'lowpass', filterCutoff: 2000 },
        // Osc 3: Sub Oscillator
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.4, filterType: 'lowpass', filterCutoff: 800 },
        { spread: 0.2, portamento: 0.15, delayMix: 0.4, delayTime: 0.3, reverbMix: 0.2 }
    ),
    p("Liquid Light", "Leads", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.05, release: 0.5 }, 
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 7, gain: 0.6, attack: 0.05 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, gain: 0.2, filterType: 'lowpass', filterCutoff: 2000, lfoTarget: 'filter', lfoRate: 6, lfoDepth: 20 }, 
        { spread: 0.4, stereoPanSpeed: 2.0, stereoPanDepth: 0.5, reverbType: 'hall', delayMix: 0.4, portamento: 0.1 }
    ),
    p("Laser Harp", "Leads", 
        // Osc 1: Bright Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.7, attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5, filterType: 'lowpass', filterCutoff: 4000, filterResonance: 2.0 }, 
        // Osc 2: Sync-ish Square
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, gain: 0.4, attack: 0.01, decay: 0.2, sustain: 0.2 }, 
        // Osc 3: High Click (Filtered Noise - Cleaned up)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.01, decay: 0.05, sustain: 0, filterType: 'highpass', filterCutoff: 6000 }, 
        { spread: 0.3, reverbType: 'plate', delayMix: 0.4, delayTime: 0.3, delayFeedback: 0.4 }
    ),
    p("Ghost Flute", "Leads", 
        // Osc 1: Triangle Body
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.8, attack: 0.1, release: 0.5, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 10, lfoDelay: 0.5 }, 
        // Osc 2: Breath (Noise Bandpass - Drastically Reduced gain)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.008, filterType: 'bandpass', filterCutoff: 2000, filterResonance: 3.0, attack: 0.2 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.1 }, 
        { spread: 0.4, reverbType: 'hall', reverbMix: 0.6 }
    ),
    p("Warp Drive", "Leads", 
        // Osc 1: Rising Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.6, attack: 0.1, sustain: 1.0, lfoWaveform: 'sawtooth', lfoTarget: 'pitch', lfoRate: 2, lfoDepth: 20 }, 
        // Osc 2: Stable anchor
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.5, filterType: 'lowpass', filterCutoff: 800 }, 
        // Osc 3: Filter Sweep
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.4, filterType: 'bandpass', filterCutoff: 1000, filterResonance: 5, lfoWaveform: 'triangle', lfoTarget: 'filter', lfoRate: 0.5, lfoDepth: 80 }, 
        { spread: 0.6, reverbType: 'room', delayMix: 0.3 }
    ),
    p("Crystal Solo", "Leads", 
        // Osc 1: Bell fundamental
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.01, decay: 1.5, sustain: 0.2, release: 2.0 }, 
        // Osc 2: Overtone
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.4, attack: 0.01, decay: 1.0, sustain: 0.1 }, 
        // Osc 3: High tine
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2786, gain: 0.2, decay: 0.5, sustain: 0 }, 
        { spread: 0.4, reverbType: 'plate', reverbMix: 0.5, delayMix: 0.2 }
    ),
    p("Acid Trip", "Leads", 
        // Osc 1: Resonant Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.8, filterType: 'lowpass', filterCutoff: 600, filterResonance: 12.0, lfoTarget: 'filter', lfoRate: 0.5, lfoDepth: 70 }, 
        // Osc 2: Square Sub
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.4, filterType: 'lowpass', filterCutoff: 400 }, 
        { enabled: false }, 
        { spread: 0.2, delayMix: 0.3, reverbType: 'plate', compressorThreshold: -15, compressorRatio: 8, modMatrix: [{ id: 'env-cut', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 50 }] }
    ),
    p("Phase Shift", "Leads", 
        // Osc 1: Square
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.5 }, 
        // Osc 2: Detuned Square (LFO Detune)
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.5, lfoTarget: 'pitch', lfoRate: 0.2, lfoDepth: 15 }, 
        { enabled: false }, 
        { spread: 0.8, stereoPanSpeed: 0.2, stereoPanDepth: 0.5, reverbType: 'plate' }
    ),
    p("Soft Glow", "Leads", 
        // Osc 1: Soft Triangle
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.8, filterType: 'lowpass', filterCutoff: 1200, attack: 0.1, release: 0.5 }, 
        // Osc 2: Sine support
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 7, gain: 0.4 }, 
        // Osc 3: 5th
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.3 }, 
        { spread: 0.5, reverbType: 'hall', reverbMix: 0.6, delayMix: 0.3 }
    )
];

/**
 * SYNTH BASS
 * Heavy low-end patches.
 */
export const ETHEREAL_BASS = [
    // Void Bass - Clean Sub with Texture
    p("Void Bass", "Bass", 
        // Osc 1: Sub Sine
        { enabled: true, waveform: WaveformType.SINE, gain: 0.9, attack: 0.1, release: 0.5 }, 
        // Osc 2: Noise Texture (Reduced gain significantly)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.005, filterType: 'highpass', filterCutoff: 4000, lfoTarget: 'tremolo', lfoRate: 8, lfoDepth: 30 }, 
        // Osc 3: Slow Filtered Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1200, gain: 0.4, filterType: 'lowpass', filterCutoff: 300, lfoTarget: 'filter', lfoRate: 0.1, lfoDepth: 20 }, 
        { spread: 0.3, stereoPanSpeed: 0.1, stereoPanDepth: 0.2, reverbType: 'room', reverbMix: 0.3 }
    ),
    p("Pulsar", "Bass", 
        // Osc 1: Sawtooth rhythmic pulse
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.8, filterType: 'lowpass', filterCutoff: 600, filterResonance: 3.0, lfoWaveform: 'sawtooth', lfoTarget: 'filter', lfoRate: 4, lfoDepth: 50 }, 
        // Osc 2: Sub Square
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.5, filterType: 'lowpass', filterCutoff: 200 }, 
        { enabled: false }, 
        { spread: 0.4, delayMix: 0.3, reverbType: 'room', compressorThreshold: -15 }
    ),
    p("Deep Space", "Bass", 
        // Osc 1: Rumble (Noise LFO on Pitch)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: -2400, gain: 0.8, lfoWaveform: 'noise', lfoTarget: 'pitch', lfoRate: 15, lfoDepth: 5 }, 
        // Osc 2: Low Drone
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.4, lfoTarget: 'pitch', lfoRate: 0.2, lfoDepth: 10 }, 
        // Osc 3: Rumbling Filtered Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2405, gain: 0.15, filterCutoff: 100, lfoTarget: 'filter', lfoRate: 0.1, lfoDepth: 50 }, 
        { spread: 0.8, reverbType: 'cathedral', reverbMix: 0.9, reverbSize: 8.0, compressorThreshold: -15 }
    ),
    p("Wobble Void", "Bass", 
        // Osc 1: Wub Wub
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.8, filterType: 'lowpass', filterCutoff: 300, filterResonance: 2.0, lfoWaveform: 'sine', lfoTarget: 'filter', lfoRate: 3, lfoDepth: 60 }, 
        // Osc 2: Sub Sine
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.6 }, 
        { enabled: false }, 
        { spread: 0.5, stereoPanSpeed: 2.0, stereoPanDepth: 0.4, reverbType: 'room' }
    ),
    p("Sub Drone", "Bass", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.9 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 5, gain: 0.5 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.2, filterType: 'lowpass', filterCutoff: 100 }, 
        { spread: 0.6, reverbType: 'cathedral', reverbMix: 0.5 }
    ),
    p("Reso Bass", "Bass", 
        // Osc 1: Acid-ish
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.7, filterType: 'lowpass', filterCutoff: 400, filterResonance: 8.0, lfoTarget: 'filter', lfoRate: 0.2, lfoDepth: 20 }, 
        // Osc 2: Sub
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.5 }, 
        { enabled: false }, 
        { spread: 0.2, delayMix: 0.3, reverbType: 'plate', modMatrix: [{ id: 'env-cut', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 50 }] }
    ),
    p("Pluck Abyss", "Bass", 
        // Osc 1: Short Square
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.7, decay: 0.4, sustain: 0, filterType: 'lowpass', filterCutoff: 800 }, 
        // Osc 2: Sub Triangle
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.6, decay: 0.6, sustain: 0 }, 
        { enabled: false }, 
        { spread: 0.3, reverbType: 'room', reverbMix: 0.3 }
    ),
    p("Growling Star", "Bass", 
        // Osc 1: Detuned Saw Stack
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.7, filterType: 'lowpass', filterCutoff: 400 }, 
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 10, gain: 0.6, filterType: 'lowpass', filterCutoff: 400 }, 
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -10, gain: 0.6, filterType: 'lowpass', filterCutoff: 400 }, 
        { spread: 0.8, stereoPanSpeed: 0.2, stereoPanDepth: 0.5, compressorThreshold: -15, reverbType: 'plate' }
    )
];
