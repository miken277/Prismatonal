
import { WaveformType } from './types';
import { p } from './patchHelpers';

export const ETHEREAL_KEYS = [
    p("Dream Rhodes", "Keys", 
        // Osc 1: Tine
        { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 2.0, sustain: 0.2, lfoTarget: 'tremolo', lfoRate: 4, lfoDepth: 20, pedalDecay: 5.0 }, 
        // Osc 2: Body
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.3, decay: 1.5, sustain: 0.1, pedalDecay: 5.0 }, 
        // Osc 3: Mechanical noise
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.015, decay: 0.1, sustain: 0, filterType: 'highpass', filterCutoff: 3000 }, 
        { spread: 0.6, reverbType: 'hall', reverbMix: 0.5, delayMix: 0.3, stereoPanSpeed: 0.5, stereoPanDepth: 0.4, acousticSustain: true }
    ),
    p("Space Organ", "Keys", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, lfoTarget: 'filter', lfoRate: 2.0, lfoDepth: 15 }, 
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.4, lfoTarget: 'tremolo', lfoRate: 6.0, lfoDepth: 30 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1902, gain: 0.2 }, 
        { spread: 0.8, reverbType: 'cathedral', reverbMix: 0.6 }
    ),
    p("Underwater", "Keys", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, filterType: 'lowpass', filterCutoff: 600, lfoTarget: 'filter', lfoRate: 0.5, lfoDepth: 30 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.3 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.4, filterType: 'lowpass', filterCutoff: 300 }, 
        { spread: 0.5, reverbType: 'plate', delayMix: 0.5 }
    ),
    p("Frozen Time", "Keys", 
        // Osc 1: Sustained Square
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.4, filterType: 'lowpass', filterCutoff: 1200, attack: 0.5, release: 2.0 }, 
        // Osc 2: Shimmer
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, gain: 0.2, lfoTarget: 'tremolo', lfoRate: 8, lfoDepth: 40 }, 
        { enabled: false }, 
        { spread: 0.8, reverbType: 'shimmer', reverbMix: 0.8, delayMix: 0.4 }
    ),
    p("Glitch Keys", "Keys", 
        // Osc 1: Pure Tone
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, decay: 0.5, sustain: 0.2 }, 
        // Osc 2: Glitch Artifacts (Noise LFO on Pitch)
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.3, decay: 0.3, sustain: 0, lfoWaveform: 'noise', lfoTarget: 'pitch', lfoRate: 15, lfoDepth: 50 }, 
        // Osc 3: High Click
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.08, decay: 0.05, sustain: 0 }, 
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
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, attack: 0.5, release: 2.0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, attack: 0.5 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, gain: 0.1, attack: 0.5 }, 
        { spread: 0.7, reverbType: 'shimmer', reverbMix: 0.7 }
    ),
    p("Echoes", "Keys", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.5, decay: 0.5, sustain: 0.2 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.4 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1900, gain: 0.1, filterType: 'lowpass', filterCutoff: 1000 }, 
        { spread: 0.6, reverbType: 'hall', delayMix: 0.6, delayTime: 0.6, delayFeedback: 0.5 }
    )
];

export const ETHEREAL_MALLETS = [
    p("Crystal Rain", "Mallets", 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.5, decay: 0.5, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.4, decay: 0.4 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, decay: 0.3 }, 
        { spread: 0.9, reverbType: 'hall', delayMix: 0.5, reverbMix: 0.4, modMatrix: [{ id: 'rain-p', enabled: true, source: 'lfo1', target: 'osc1_pitch', amount: 5 }] }
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
