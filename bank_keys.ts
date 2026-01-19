
import { WaveformType } from './types';
import { p } from './patchHelpers';

/**
 * KEYBOARD INSTRUMENTS
 * Ranging from electro-mechanical simulations to ethereal digital pads.
 */
export const ETHEREAL_KEYS = [
    // Dream Rhodes - Soft, bell-like electric piano
    // Strategy: Additive synthesis (Sine Tine + Triangle Body) + Mechanical Noise
    p("Dream Rhodes", "Keys", 
        // Osc 1: Tine (The 'bell' attack)
        { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 2.0, sustain: 0.2, lfoTarget: 'tremolo', lfoRate: 4, lfoDepth: 20, pedalDecay: 5.0 }, 
        // Osc 2: Body (Warmth, lower octave)
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.3, decay: 1.5, sustain: 0.1, pedalDecay: 5.0 }, 
        // Osc 3: Mechanical Key Noise (Reduced gain for cleanliness)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.003, decay: 0.05, sustain: 0, filterType: 'highpass', filterCutoff: 3000 }, 
        { 
            spread: 0.6, 
            reverbType: 'hall', 
            reverbMix: 0.5, 
            delayMix: 0.3, 
            stereoPanSpeed: 0.5, 
            stereoPanDepth: 0.4, 
            acousticSustain: true 
        }
    ),
    // Pure FM E-Piano - Classic 80s Digital Ballad Sound
    // Strategy: Bright Sines + Chorus
    p("Pure FM E-Piano", "Keys",
        // Osc 1: Fundamental
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.01, decay: 2.5, sustain: 0.0, release: 0.5 },
        // Osc 2: Overtone (Ratio 14:1 approx via detune) for "Glassy" attack
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3800, gain: 0.15, attack: 0.01, decay: 0.2, sustain: 0 },
        // Osc 3: Detuned Unison for Chorus effect
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 5, gain: 0.5, attack: 0.01, decay: 2.0, sustain: 0.0 },
        {
            spread: 0.8,
            reverbType: 'plate',
            reverbMix: 0.4,
            delayMix: 0.2
        }
    ),
    // Space Organ - Sustained, church-like but sci-fi
    p("Space Organ", "Keys", 
        // Osc 1: Flute/Pipe
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, lfoTarget: 'filter', lfoRate: 2.0, lfoDepth: 15 }, 
        // Osc 2: Rank 2 (Octave up)
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.4, lfoTarget: 'tremolo', lfoRate: 6.0, lfoDepth: 30 }, 
        // Osc 3: High Mixture
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1902, gain: 0.2 }, 
        { spread: 0.8, reverbType: 'cathedral', reverbMix: 0.6 }
    ),
    p("Underwater", "Keys", 
        // Osc 1: Muffled Triangle
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, filterType: 'lowpass', filterCutoff: 600, lfoTarget: 'filter', lfoRate: 0.5, lfoDepth: 30 }, 
        // Osc 2: Bubbles (Detuned 5th)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.3 }, 
        // Osc 3: Sub base
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.4, filterType: 'lowpass', filterCutoff: 300 }, 
        { spread: 0.5, reverbType: 'plate', delayMix: 0.5 }
    ),
    // Frozen Time - Ambient, evolving
    p("Frozen Time", "Keys", 
        // Osc 1: Sustained Square (Filtered)
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.4, filterType: 'lowpass', filterCutoff: 1200, attack: 0.5, release: 2.0 }, 
        // Osc 2: Shimmer (2 Octaves up)
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, gain: 0.2, lfoTarget: 'tremolo', lfoRate: 8, lfoDepth: 40 }, 
        { enabled: false }, 
        { spread: 0.8, reverbType: 'shimmer', reverbMix: 0.8, delayMix: 0.4 }
    ),
    // Glitch Keys - Lo-fi, broken digital artifact
    p("Glitch Keys", "Keys", 
        // Osc 1: Pure Tone
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, decay: 0.5, sustain: 0.2 }, 
        // Osc 2: Glitch Artifacts (Noise LFO on Pitch) - Reduced intensity
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.3, decay: 0.3, sustain: 0, lfoWaveform: 'noise', lfoTarget: 'pitch', lfoRate: 15, lfoDepth: 30 }, 
        // Osc 3: High Click/Pop
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.02, decay: 0.02, sustain: 0 }, 
        { spread: 0.7, reverbType: 'room', delayTime: 0.1, delayFeedback: 0.6 }
    ),
    p("Vaporwave", "Keys", 
        // Osc 1: Detuned Triangle (Tape warble via slow LFO)
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, lfoWaveform: 'sine', lfoTarget: 'pitch', lfoRate: 0.5, lfoDepth: 15 }, 
        // Osc 2: FM-ish bell
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.4 }, 
        { enabled: false }, 
        { spread: 0.4, reverbType: 'plate', delayMix: 0.4, delayFeedback: 0.6 }
    ),
    p("Halo", "Keys", 
        // Osc 1: Mid Range
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, attack: 0.5, release: 2.0 }, 
        // Osc 2: High Range
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, attack: 0.5 }, 
        // Osc 3: Ultra High
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, gain: 0.1, attack: 0.5 }, 
        { spread: 0.7, reverbType: 'shimmer', reverbMix: 0.7 }
    ),
    p("Echoes", "Keys", 
        // Osc 1: Plucky Triangle
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.5, decay: 0.5, sustain: 0.2 }, 
        // Osc 2: Fifth
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.4 }, 
        // Osc 3: High Harmonic
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1900, gain: 0.1, filterType: 'lowpass', filterCutoff: 1000 }, 
        { spread: 0.6, reverbType: 'hall', delayMix: 0.6, delayTime: 0.6, delayFeedback: 0.5 }
    )
];

/**
 * MALLET INSTRUMENTS
 * Percussive, resonant, often metallic or woody.
 */
export const ETHEREAL_MALLETS = [
    // Crystal Rain - Default Percussion Preset (Preserved)
    p("Crystal Rain", "Mallets", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, decay: 0.5, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.4, decay: 0.4 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, decay: 0.3 }, 
        { spread: 0.9, reverbType: 'hall', delayMix: 0.5, reverbMix: 0.4, modMatrix: [{ id: 'rain-p', enabled: true, source: 'lfo1', target: 'osc1_pitch', amount: 5 }] }
    ),
    // Vibraphone - Authentic tremolo mallet
    p("Vibraphone", "Mallets",
        // Osc 1: Fundamental with Tremolo
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.01, decay: 2.0, sustain: 0.1, lfoTarget: 'tremolo', lfoRate: 5, lfoDepth: 40 },
        // Osc 2: 4th Harmonic (Typical of metal bars)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.15, decay: 0.5, sustain: 0, lfoTarget: 'tremolo', lfoRate: 5, lfoDepth: 40 },
        // Osc 3: 10th Harmonic (Metallic Ring)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3986, gain: 0.05, decay: 0.1, sustain: 0 },
        { 
            spread: 0.5, 
            reverbType: 'plate', 
            reverbMix: 0.3,
            acousticSustain: true
        }
    ),
    // Steel Drum - Bright, island sound
    p("Steel Drum", "Mallets",
        // Osc 1: Fundamental (Resonant)
        { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 0.4, sustain: 0 },
        // Osc 2: Octave (Strong)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.5, decay: 0.3, sustain: 0 },
        // Osc 3: Fifth + Octave (The characteristic ring)
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1902, gain: 0.3, decay: 0.2, sustain: 0, filterType: 'highpass', filterCutoff: 1000 },
        { spread: 0.4, reverbType: 'room', reverbMix: 0.2, delayMix: 0.1 }
    ),
    p("Spirit Chime", "Mallets", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.5, decay: 1.5, sustain: 0, filterType: 'lowpass', filterCutoff: 3000 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 500, gain: 0.3, decay: 1.0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.2, decay: 2.0 }, 
        { spread: 0.7, reverbType: 'cathedral', reverbMix: 0.7 }
    ),
    p("Alien Kalimba", "Mallets", 
        // Osc 1: Metallic Ring (AM Synthesis via fast LFO)
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, decay: 0.6, sustain: 0, lfoWaveform: 'square', lfoTarget: 'tremolo', lfoRate: 150, lfoDepth: 40 }, 
        // Osc 2: Body
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.5, decay: 0.4 }, 
        // Osc 3: Overtone
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 700, gain: 0.3, decay: 0.3 }, 
        { spread: 0.5, reverbType: 'plate', delayMix: 0.3 }
    ),
    p("Glass Marimba", "Mallets", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.8, decay: 0.4, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.3, decay: 0.3 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, gain: 0.2, decay: 0.2 }, 
        { spread: 0.6, reverbType: 'room', reverbMix: 0.5 }
    ),
    p("Spectral Bells", "Mallets", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, decay: 3.0, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 700, gain: 0.4, decay: 2.5 }, 
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 1900, gain: 0.15, decay: 0.5, filterType: 'lowpass', filterCutoff: 4000, lfoTarget: 'tremolo', lfoRate: 12, lfoDepth: 50 }, 
        { spread: 0.9, reverbType: 'shimmer', reverbMix: 0.85 }
    ),
    p("Psychedelic Wood", "Mallets", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.5, decay: 0.2, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, gain: 0.2, decay: 0.1 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.3, decay: 0.3, filterType: 'lowpass', filterCutoff: 500 }, 
        { spread: 1.0, stereoPanSpeed: 8.0, stereoPanDepth: 0.6, reverbType: 'hall', delayMix: 0.4 }
    ),
    p("Aurora", "Mallets", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, attack: 0.1, decay: 1.0, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.5, attack: 0.2, decay: 0.8 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1900, gain: 0.3, attack: 0.5, decay: 1.5 }, 
        { spread: 0.7, reverbType: 'shimmer', reverbMix: 0.6, stereoPanSpeed: 0.3, stereoPanDepth: 0.7 }
    ),
    p("Star Drops", "Mallets", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, decay: 0.1, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, gain: 0.3, decay: 0.1 }, 
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, gain: 0.2, decay: 0.2 }, 
        { spread: 0.9, reverbType: 'plate', delayMix: 0.6, delayTime: 0.2, stereoPanSpeed: 4.0, stereoPanDepth: 0.5 }
    )
];
