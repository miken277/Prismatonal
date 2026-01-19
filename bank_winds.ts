
import { WaveformType } from './types';
import { p } from './patchHelpers';

/**
 * ATMOSPHERE & DRONE PATCHES
 * Long evolving textures, suitable for the 'Drone' (Latch) or 'Atmosphere' modes.
 */

// Preserved Legacy Patch (Do not modify behavior)
export const preservedDeepOcean = p("Deep Ocean", "Atmosphere",
    { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 0, fineDetune: 0, gain: 0.4, attack: 1.5, decay: 0.5, sustain: 0.8, release: 2.0, filterCutoff: 800, filterResonance: 0.5, lfoRate: 0.2, lfoDepth: 25, lfoTarget: 'filter' },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: 0, fineDetune: -4, gain: 0.3, attack: 2.0, decay: 1.0, sustain: 0.7, release: 2.5, filterCutoff: 600, filterResonance: 0.5, lfoRate: 0.15, lfoDepth: 15, lfoTarget: 'tremolo' },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, fineDetune: 0, gain: 0.4, attack: 1.0, decay: 2.0, sustain: 0.8, release: 3.0, filterCutoff: 500, filterResonance: 0, lfoTarget: 'tremolo', lfoRate: 4, lfoDepth: 10 },
    { category: 'Atmosphere', gain: 0.6, spread: 0.7, stereoPanSpeed: 0.1, stereoPanDepth: 0.5, reverbType: 'cathedral', reverbMix: 0.85, delayMix: 0.5, delayTime: 0.6, delayFeedback: 0.5, compressorThreshold: -30, compressorRatio: 8, compressorRelease: 0.5, modMatrix: [{ id: 'm1', enabled: true, source: 'env2', target: 'osc1_cutoff', amount: 30 }, { id: 'm2', enabled: true, source: 'lfo3', target: 'osc2_gain', amount: 20 }] }
);

// Preserved Legacy Patch (Do not modify behavior)
export const preservedNoiseWash = p("Noise Wash", "Atmosphere",
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2400, fineDetune: 0, gain: 0.15, attack: 2.0, decay: 3.0, sustain: 0.8, release: 4.0, filterCutoff: 300, filterResonance: 15, lfoRate: 0.1, lfoDepth: 80, lfoTarget: 'filter' },
    { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, fineDetune: 0, gain: 0.1, attack: 2.0, decay: 3.0, sustain: 0.8, release: 4.0, filterCutoff: 400, filterResonance: 10, lfoRate: 0.15, lfoDepth: 60, lfoTarget: 'filter' },
    {},
    { category: 'Atmosphere', gain: 0.5, spread: 0, stereoPanSpeed: 0, stereoPanDepth: 0, reverbType: 'hall', reverbMix: 0.9, reverbSize: 3.5, reverbDamping: 0.4, reverbDiffusion: 0.7, delayMix: 0.7, delayTime: 0.8, delayFeedback: 0.7, compressorThreshold: -30, compressorRatio: 2, compressorRelease: 1.0 }
);

export const ATMOSPHERE_PATCHES = [
    // Bagpipe (Relocated and Tuned for Drone)
    p("Bagpipe", "Drone",
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.05, decay: 0.1, sustain: 1.0, release: 0.2, fineDetune: -10, filterCutoff: 3000, filterResonance: 2.0 }, // Bright Chanter 1
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.05, decay: 0.1, sustain: 1.0, release: 0.2, fineDetune: 10, filterCutoff: 3000, filterResonance: 1.5 }, // Bright Chanter 2
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.6, attack: 0.1, sustain: 1.0, release: 0.5, filterCutoff: 800 }, // Drone
        { spread: 0.4, reverbType: 'plate', reverbMix: 0.3, compressorThreshold: -10 }
    ),
    // Solar Wind - Evolving resonant sweep
    p("Solar Wind", "Atmosphere",
        // Osc 1: Deep Saw with Sweep
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1200, gain: 0.6, filterType: 'lowpass', filterCutoff: 400, filterResonance: 4.0, lfoTarget: 'filter', lfoRate: 0.08, lfoDepth: 60 },
        // Osc 2: Upper Harmonic Texture
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 0, gain: 0.4, filterType: 'highpass', filterCutoff: 800, lfoTarget: 'tremolo', lfoRate: 0.5, lfoDepth: 30 },
        // Osc 3: Very faint noise
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.005, filterType: 'bandpass', filterCutoff: 3000 },
        { spread: 0.8, reverbType: 'cathedral', reverbMix: 0.8, delayMix: 0.6 }
    ),
    // Wind Chimes - Generative Texture using Polyrhythmic LFOs on Gain
    p("Wind Chimes", "Atmosphere",
        // Osc 1: Root + 2 oct
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.5, lfoTarget: 'tremolo', lfoRate: 0.2, lfoDepth: 100 }, 
        // Osc 2: + 2 oct + 5th (approx)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3102, gain: 0.4, lfoTarget: 'tremolo', lfoRate: 0.3, lfoDepth: 100 }, 
        // Osc 3: + 3 oct + 2nd (approx)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3800, gain: 0.3, lfoTarget: 'tremolo', lfoRate: 0.5, lfoDepth: 100 }, 
        { spread: 0.9, reverbType: 'shimmer', reverbMix: 0.8, delayMix: 0.5 }
    ),
    p("Dark Drone", "Atmosphere", 
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2400, gain: 0.5, filterCutoff: 150, filterResonance: 10, lfoTarget: 'filter', lfoRate: 0.05, lfoDepth: 40 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.4, filterCutoff: 200, filterResonance: 8, lfoTarget: 'filter', lfoRate: 0.07, lfoDepth: 30 }, 
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2405, gain: 0.3, filterCutoff: 100 }, 
        { spread: 0.7, reverbType: 'cathedral', reverbMix: 0.9, compressorThreshold: -25 }
    ),
    p("Swamp", "Atmosphere", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, lfoTarget: 'pitch', lfoRate: 6, lfoDepth: 20, filterCutoff: 600 }, 
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 700, gain: 0.4, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 15 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.3, filterCutoff: 400 }, 
        { spread: 0.6, reverbType: 'plate', reverbMix: 0.6 }
    ),
    // Industrial - Rhythmic, metallic, gritty (Cleaned up noise)
    p("Industrial", "Atmosphere",
        // Osc 1: Deep Drone
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2400, gain: 0.7, filterCutoff: 150, filterResonance: 2 },
        // Osc 2: Rhythmic Clank (Square LFO on Filter)
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.5, filterType: 'bandpass', filterCutoff: 800, filterResonance: 5, lfoWaveform: 'square', lfoRate: 6, lfoDepth: 60, lfoTarget: 'filter' },
        // Osc 3: Steam/Noise (Saw LFO on Amp) - Reduced gain to 0.02
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.02, filterType: 'highpass', filterCutoff: 3000, lfoWaveform: 'sawtooth', lfoRate: 0.5, lfoDepth: 100, lfoTarget: 'tremolo' },
        { spread: 0.4, reverbType: 'plate', reverbMix: 0.6, compressorThreshold: -15, compressorRatio: 8 }
    ),
    // Glass Texture - High pitch, crystalline, fragile
    p("Glass Texture", "Atmosphere",
        // Osc 1: Pure Tone
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, attack: 0.5, release: 3.0 },
        // Osc 2: Shimmering Inharmonic (Noise LFO on Pitch for "shatter" texture)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1902, gain: 0.3, attack: 1.0, release: 4.0, lfoWaveform: 'noise', lfoRate: 15, lfoDepth: 5, lfoTarget: 'pitch' },
        // Osc 3: High Whistle
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 3600, gain: 0.1, filterCutoff: 6000, lfoWaveform: 'sine', lfoRate: 0.2, lfoDepth: 30, lfoTarget: 'tremolo' },
        { spread: 0.8, reverbType: 'shimmer', reverbMix: 0.8 }
    ),
    // Abyss - Deep, underwater, rumbling
    p("Abyss", "Atmosphere",
        // Osc 1: Sub Bass Sine
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: -2400, gain: 0.8, attack: 4.0, release: 8.0 },
        // Osc 2: Drifting Triangle
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.4, lfoTarget: 'pitch', lfoRate: 0.2, lfoDepth: 10 }, 
        // Osc 3: Rumbling Filtered Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2405, gain: 0.15, filterCutoff: 100, lfoTarget: 'filter', lfoRate: 0.1, lfoDepth: 50 }, 
        { spread: 0.8, reverbType: 'cathedral', reverbMix: 0.9, reverbSize: 8.0, compressorThreshold: -15 }
    )
];

// --- BRASS PATCHES ---
// Uses the ResonatorBank (Formants) to simulate brass body impulses
export const BRASS_PATCHES = [
    // 1. Synth Brass
    // Bright, punchy, slight swell
    p("Synth Brass", "Brass", 
        // Osc 1: Source (Glottal/Pulse) - Spectral Tilt added via dynamic cutoff in DSP
        { enabled: true, waveform: WaveformType.GLOTTAL, gain: 0.55, attack: 0.08, decay: 0.2, sustain: 0.8, release: 0.4, filterType: 'lowpass', filterCutoff: 600, filterResonance: 0.2 }, 
        // Osc 2: F2 (Peak) - Body Resonance
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, filterType: 'peak', filterCutoff: 1200, filterResonance: 1.5 },
        // Osc 3: F3 (Peak) - Shine
        { enabled: true, waveform: WaveformType.SINE, gain: 0.25, filterType: 'peak', filterCutoff: 2500, filterResonance: 2.0 }, 
        { spread: 0.3, reverbType: 'hall', reverbMix: 0.35, portamento: 0.1, resonatorMix: 0.5, resonatorSweep: 0.2, noiseGain: 0.006, noiseCutoff: 2000 }
    ),
    
    // 2. Muted Trumpet
    // More closed filter, higher resonance sweep
    p("Muted Trumpet", "Brass", 
        { enabled: true, waveform: WaveformType.GLOTTAL, gain: 0.5, attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.2, filterType: 'lowpass', filterCutoff: 500, filterResonance: 0.8 }, 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.4, filterType: 'peak', filterCutoff: 1500, filterResonance: 3.0 },
        { enabled: true, waveform: WaveformType.SINE, gain: 0.15, filterType: 'peak', filterCutoff: 3000, filterResonance: 1.5 }, 
        { spread: 0.2, reverbType: 'room', reverbMix: 0.2, portamento: 0.05, resonatorMix: 0.7, resonatorSweep: 0.9, noiseGain: 0.01, noiseCutoff: 5000 }
    ),
    
    // 3. Low Brass Swell
    // Slow attack, deep body
    p("Low Brass Swell", "Brass",
        { enabled: true, waveform: WaveformType.GLOTTAL, coarseDetune: -1200, gain: 0.6, attack: 0.8, decay: 0.5, sustain: 1.0, release: 1.0, filterType: 'lowpass', filterCutoff: 350, filterResonance: 0.3 }, 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, filterType: 'peak', filterCutoff: 600, filterResonance: 2.5 }, 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.3, filterType: 'peak', filterCutoff: 1800, filterResonance: 1.5 }, 
        { spread: 0.5, reverbType: 'cathedral', reverbMix: 0.6, portamento: 0.2, resonatorMix: 0.4, resonatorSweep: 0.1 }
    ),
    
    // 4. Polysynth Brass (Classic 80s)
    // Less resonator, more detuned saws
    p("Polysynth Brass", "Brass",
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.15, decay: 0.2, sustain: 0.7, release: 0.6, filterType: 'lowpass', filterCutoff: 1200, filterResonance: 0.3 },
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 5, gain: 0.5, filterType: 'lowpass', filterCutoff: 1200 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.25, filterType: 'lowpass', filterCutoff: 800 },
        { spread: 0.7, reverbType: 'plate', reverbMix: 0.4, portamento: 0.15 }
    ),
    
    // 5. French Horn (Refined)
    // Warm, distant, less attack bite
    p("French Horn", "Brass",
        { enabled: true, waveform: WaveformType.GLOTTAL, gain: 0.55, attack: 0.4, sustain: 0.9, release: 0.8, filterType: 'lowpass', filterCutoff: 450 },
        { enabled: true, waveform: WaveformType.SINE, gain: 0.4, filterType: 'peak', filterCutoff: 400, filterResonance: 2.5 }, 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.3, filterType: 'peak', filterCutoff: 900, filterResonance: 1.5 }, 
        { spread: 0.4, reverbType: 'hall', reverbMix: 0.5, resonatorMix: 0.6, resonatorSweep: 0.3 }
    ),

    // 6. Orchestral Horns - Full Section (NEW)
    p("Orchestral Horns", "Brass",
        // Osc 1: Mellow Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.6, attack: 0.3, decay: 0.2, sustain: 0.9, release: 1.2, filterType: 'lowpass', filterCutoff: 600 },
        // Osc 2: Detuned Saw
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 5, gain: 0.5, attack: 0.35, sustain: 0.9, release: 1.2, filterType: 'lowpass', filterCutoff: 600 },
        // Osc 3: Sub support
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.3, filterType: 'lowpass', filterCutoff: 400 },
        { spread: 0.8, reverbType: 'hall', reverbMix: 0.6 }
    )
];
