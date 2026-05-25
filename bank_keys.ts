
import { WaveformType } from './types';
import { p } from './patchHelpers';

/**
 * KEYBOARD INSTRUMENTS
 * Ranging from electro-mechanical simulations to ethereal digital pads.
 */
export const ETHEREAL_KEYS = [
    p("Underwater", "Keys", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, filterType: 'lowpass', filterCutoff: 600, lfoTarget: 'filter', lfoRate: 0.5, lfoDepth: 30 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.3 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.4, filterType: 'lowpass', filterCutoff: 300 }, 
        { spread: 0.5, reverbType: 'plate', delayMix: 0.5 }
    ),
    p("Frozen Time", "Keys", 
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.4, filterType: 'lowpass', filterCutoff: 1200, attack: 0.5, release: 2.0 }, 
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, gain: 0.2, lfoTarget: 'tremolo', lfoRate: 8, lfoDepth: 40 }, 
        { enabled: false }, 
        { spread: 0.8, reverbType: 'shimmer', reverbMix: 0.8, delayMix: 0.4 }
    ),
    p("Echoes", "Keys", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.5, decay: 0.5, sustain: 0.2 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.4 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1900, gain: 0.1, filterType: 'lowpass', filterCutoff: 1000 }, 
        { spread: 0.6, reverbType: 'hall', delayMix: 0.6, delayTime: 0.6, delayFeedback: 0.5 }
    ),
    p("Crystal Keys", "Keys", 
        { enabled: true, waveform: WaveformType.EPIANO, gain: 0.8, decay: 1.5, sustain: 0.3 }, 
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.3, decay: 1.0, sustain: 0.1 }, 
        { enabled: true, waveform: WaveformType.BELL, coarseDetune: 2400, gain: 0.15, decay: 2.5, lfoTarget: 'tremolo', lfoRate: 5, lfoDepth: 30 }, 
        { spread: 0.7, reverbType: 'shimmer', reverbMix: 0.6 }
    ),
    p("Warm Pad Keys", "Keys", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.5, attack: 0.1, decay: 2.0, sustain: 0.6, release: 1.2 }, 
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1200, gain: 0.2, attack: 0.2, sustain: 0.6, release: 1.5, filterType: 'lowpass', filterCutoff: 600 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 700, gain: 0.3, attack: 0.1, sustain: 0.4 }, 
        { spread: 0.8, reverbType: 'hall', reverbMix: 0.5 }
    ),
    p("Retro Synth", "Keys", 
        { enabled: true, waveform: WaveformType.SQUARE, gain: 0.4, decay: 0.5, sustain: 0.5, release: 0.5 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -12, gain: 0.3, decay: 0.5, sustain: 0.5, release: 0.5 }, 
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 12, gain: 0.2, filterType: 'lowpass', filterCutoff: 1500 }, 
        { spread: 0.6, reverbType: 'room', reverbMix: 0.4, delayMix: 0.3 }
    ),
    p("Soft Bell", "Keys", 
        { enabled: true, waveform: WaveformType.BELL, gain: 0.8, decay: 2.0, sustain: 0.1 }, 
        { enabled: true, waveform: WaveformType.EPIANO, coarseDetune: 1902, gain: 0.3, decay: 1.5, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2786, gain: 0.15, decay: 1.0, sustain: 0 }, 
        { spread: 0.6, reverbType: 'plate', reverbMix: 0.5, delayMix: 0.4 }
    ),
    p("Plucked Tone", "Keys", 
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, decay: 0.3, sustain: 0.1 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.2, decay: 0.4, filterType: 'lowpass', filterCutoff: 800 }, 
        { enabled: false }, 
        { spread: 0.4, reverbType: 'room', reverbMix: 0.3 }
    )
];

/**
 * MALLET INSTRUMENTS
 * Percussive, resonant, often metallic or woody.
 */
export const ETHEREAL_MALLETS = [
    p("Crystal Rain", "Mallets", 
        { enabled: true, waveform: WaveformType.BELL, gain: 0.6, decay: 0.5, sustain: 0 }, 
        { enabled: true, waveform: WaveformType.EPIANO, coarseDetune: 1200, gain: 0.5, decay: 0.4 }, 
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, gain: 0.3, decay: 0.3 }, 
        { spread: 0.9, reverbType: 'hall', delayMix: 0.5, reverbMix: 0.4, modMatrix: [{ id: 'rain-p', enabled: true, source: 'lfo1', target: 'osc1_pitch', amount: 3 }] }
    ),
    p("Steel Drum", "Mallets",
        { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 0.4, sustain: 0 },
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.5, decay: 0.3, sustain: 0 },
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
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, decay: 0.6, sustain: 0, lfoWaveform: 'sine', lfoTarget: 'tremolo', lfoRate: 6, lfoDepth: 40 }, 
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.5, decay: 0.4 }, 
        { enabled: true, waveform: WaveformType.BELL, coarseDetune: 700, gain: 0.3, decay: 0.3 }, 
        { spread: 0.5, reverbType: 'plate', delayMix: 0.3 }
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
    )
];
