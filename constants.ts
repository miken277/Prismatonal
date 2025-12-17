
import { AppSettings, ButtonShape, ChordDefinition, LimitColorMap, OscillatorConfig, SynthPreset, WaveformType, LimitVisualsMap, ReverbType, ArpeggioDefinition, KeyMappings } from './types';

export const DEFAULT_COLORS: LimitColorMap = {
  1: '#EF4444', // Red (Unity)
  3: '#EAB308', // Yellow (3-Limit)
  5: '#3B82F6', // Blue (5-Limit)
  7: '#22C55E', // Green (7-Limit)
  11: '#A855F7', // Purple (11-Limit)
  13: '#F97316', // Orange (13-Limit)
};

export const DEFAULT_LIMIT_VISUALS: LimitVisualsMap = {
    1: { size: 1.0, opacity: 1.0 },
    3: { size: 1.0, opacity: 1.0 },
    5: { size: 0.9, opacity: 0.9 },
    7: { size: 0.8, opacity: 0.8 },
    11: { size: 0.7, opacity: 0.7 },
    13: { size: 0.6, opacity: 0.6 }
};

export const DEFAULT_KEY_MAPPINGS: KeyMappings = {
    volumeUp: 'arrowup',
    volumeDown: 'arrowdown',
    spatialScaleUp: 'arrowright',
    spatialScaleDown: 'arrowleft',
    latch: ' ',
    panic: 'escape',
    center: 'c',
    settings: 's',
    synth: 'm',
    off: 'o',
    bend: 'b',
    addChord: 'enter',
    increaseDepth: '.',
    decreaseDepth: ','
};

// Reverb Defaults Helper
export const REVERB_DEFAULTS: Record<ReverbType, { size: number, damping: number, diffusion: number }> = {
    'room': { size: 1.5, damping: 0.3, diffusion: 0.8 },
    'hall': { size: 3.0, damping: 0.6, diffusion: 0.7 }, 
    'cathedral': { size: 6.0, damping: 0.85, diffusion: 0.85 }, 
    'plate': { size: 2.0, damping: 0.1, diffusion: 1.0 },
    'shimmer': { size: 8.0, damping: 0.2, diffusion: 0.5 }
};

const generateChordSlots = (): ChordDefinition[] => {
  const slots: ChordDefinition[] = [];
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
  for (let i = 0; i < 32; i++) {
    slots.push({
      id: alphabet[i],
      label: alphabet[i],
      color: '#3B82F6', // Default blue
      nodes: [],
      visible: false,
      position: { x: 0, y: 0 } 
    });
  }
  return slots;
};

const generateArpeggioSlots = (): ArpeggioDefinition[] => {
    const slots: ArpeggioDefinition[] = [];
    const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
    labels.forEach(l => {
        slots.push({
            id: l,
            steps: [],
            isPlaying: false,
            config: {
                direction: 'order',
                division: '1/8',
                octaves: 1,
                gate: 0.8,
                swing: 0,
                length: 8,
                probability: 1.0,
                humanize: 0
            }
        });
    });
    return slots;
};

// UI Dimensions Constants
export const PIXELS_PER_MM = 3.78; 
export const MARGIN_3MM = 10; 
export const GAP_5MM = 20;
export const SCROLLBAR_WIDTH = 12; 

// Helper to get defaults
const getDefaults = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const margin = 4 * PIXELS_PER_MM; 

    return {
        volume: { x: (w / 2) - 80, y: margin },
        space: { x: margin, y: h / 2 },
        panic: { x: w - 80 - margin, y: h - 80 - margin },
        off: { x: w - 80 - margin, y: h - 180 },
        latch: { x: w - 80 - margin, y: h - 280 },
        bend: { x: w - 80 - margin, y: h - 380 },
        center: { x: margin, y: h - 48 - margin },
        depth: { x: margin + 60, y: h - 48 - margin },
        decreaseDepth: { x: margin + 120, y: h - 48 - margin },
        chords: { x: margin + 180, y: h - 48 - margin },
        layers: { x: w - 90 - margin, y: margin + 60 },
        arpeggioBar: { x: margin, y: margin } // Default top left
    };
};

const DEFAULT_UI_POSITIONS = getDefaults();

export const DEFAULT_SETTINGS: AppSettings = {
  limitDepths: {
    3: 3,
    5: 2,
    7: 1,
    11: 1,
    13: 1,
  },
  limitComplexities: {
    3: 1000,
    5: 1000,
    7: 100,
    11: 100,
    13: 100,
  },
  
  showIncreaseDepthButton: true,
  centerResetsDepth: false,

  savedChords: generateChordSlots(),
  chordShortcutSizeScale: 0.6,
  chordsAlwaysRelatch: false,

  arpeggios: generateArpeggioSlots(),
  arpBpm: 120,

  hiddenLimits: [7, 11, 13],
  // Order from back to front.
  layerOrder: [13, 11, 7, 5, 3, 1], 
  
  baseFrequency: 196.00, // G3
  audioLatencyHint: 'playback',

  isVoiceLeadingEnabled: true, 
  voiceLeadingStrength: 0.3, 
  
  isVoiceLeadingAnimationEnabled: true,
  voiceLeadingAnimationSpeed: 2.0,
  voiceLeadingReverseDir: false,
  voiceLeadingGlowAmount: 0.5,
  voiceLeadingSteps: 1,
  
  lineBrighteningEnabled: true,
  lineBrighteningSteps: 1,

  isMomentumEnabled: false,
  
  latchedZoomScale: 1.3,

  buttonSizeScale: 0.8,
  buttonSpacingScale: 1.5, 
  latticeAspectRatio: 0.7, 
  canvasSize: 2000, 
  buttonShape: ButtonShape.CIRCLE,
  colors: { ...DEFAULT_COLORS },
  limitVisuals: { ...DEFAULT_LIMIT_VISUALS },
  
  nodeTextSizeScale: 1.0,
  showFractionBar: false,

  isPitchBendEnabled: false,
  isPitchSnapEnabled: true,
  polyphony: 4, 
  pitchOffLocked: false,
  volumeLocked: false,

  // Visuals - Background
  backgroundMode: 'rainbow',
  backgroundImageData: null,
  backgroundTiling: false,
  backgroundYOffset: 0,

  isRainbowModeEnabled: true,
  rainbowSaturation: 50, 
  rainbowBrightness: 50, 
  rainbowOffset: 300,
  isColoredIlluminationEnabled: true, 
  
  // MIDI Defaults
  midiEnabled: false,
  midiOutputId: null,
  midiPitchBendRange: 24,

  // Behavior
  enableKeyboardShortcuts: false,
  keyMappings: DEFAULT_KEY_MAPPINGS,
  strumDuration: 0.5,

  // UI Relocation & Scaling
  uiUnlocked: false,
  uiScale: 1.0, 
  uiEdgeMargin: 4, 
  uiPositions: DEFAULT_UI_POSITIONS
};

// --- PRESET GENERATION ---

const defaultDisabledOsc: OscillatorConfig = {
    enabled: false,
    waveform: WaveformType.SINE,
    coarseDetune: 0,
    fineDetune: 5,
    gain: 0.5,
    attack: 0.1,
    decay: 0.5,
    sustain: 0.7,
    release: 1.0,
    filterCutoff: 2000,
    filterResonance: 0.5,
    lfoRate: 1,
    lfoDepth: 0,
    lfoTarget: 'none'
};

const generateInitPatch = (name: string, id: string): SynthPreset => ({
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
    arpConfig: {
        direction: 'order',
        division: '1/8',
        octaves: 1,
        gate: 0.8,
        swing: 0,
        length: 8,
        probability: 1.0,
        humanize: 0
    }
});

const p = (name: string, cat: string, osc1: Partial<OscillatorConfig>, osc2: Partial<OscillatorConfig>, osc3: Partial<OscillatorConfig>, extra: Partial<SynthPreset> = {}): SynthPreset => {
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

// --- FACTORY PRESETS ---

// 1. Classic Preserved
const preservedDeepOcean = p("Deep Ocean", "Atmosphere", 
    { enabled: true, waveform: WaveformType.TRIANGLE, attack: 1.0, decay: 2.0, sustain: 0.8, release: 3.0, gain: 0.6 }, 
    { enabled: true, waveform: WaveformType.SINE, attack: 1.5, decay: 2.0, sustain: 0.6, release: 3.0, gain: 0.4, coarseDetune: 5 }, 
    { enabled: true, waveform: WaveformType.SINE, attack: 2.0, decay: 3.0, sustain: 0.5, release: 4.0, gain: 0.3, coarseDetune: -7 }, 
    { reverbType: 'hall', reverbMix: 0.5, reverbSize: 4.0 }
);

const preservedAnalogStrings = p("Analog Strings", "Strings", 
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.5, decay: 0.5, sustain: 0.7, release: 1.2, gain: 0.5, filterCutoff: 3000 }, 
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.5, decay: 0.5, sustain: 0.7, release: 1.2, gain: 0.4, coarseDetune: 10 }, 
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.6, decay: 0.6, sustain: 0.6, release: 1.5, gain: 0.3, coarseDetune: -10 }, 
    { spread: 0.3, reverbType: 'hall', reverbMix: 0.3 }
);

const preservedNoiseWash = p("Noise Wash", "Atmosphere", 
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 2.0, decay: 3.0, sustain: 1.0, release: 4.0, lfoTarget: 'filter', lfoRate: 0.2, lfoDepth: 30 }, 
    { enabled: true, waveform: WaveformType.SQUARE, attack: 2.5, decay: 3.0, sustain: 0.8, release: 4.0, coarseDetune: 1200, gain: 0.2 }, 
    {}, 
    { reverbType: 'shimmer', reverbMix: 0.6, reverbSize: 8.0 }
);

const defaultArpPatch = p("Classic Arp", "Plucked", 
    { enabled: true, waveform: WaveformType.SQUARE, attack: 0.01, decay: 0.1, sustain: 0, gain: 0.8 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.01, decay: 0.2, sustain: 0, gain: 0.4, coarseDetune: 700 },
    { enabled: true, waveform: WaveformType.SINE, attack: 0.01, decay: 0.3, sustain: 0, gain: 0.5, coarseDetune: 1200 },
    { spread: 0.3, reverbType: 'room', reverbMix: 0.2, delayMix: 0.4, delayTime: 0.125, arpConfig: { direction: 'up', division: '1/16', octaves: 2, gate: 0.6, swing: 0, length: 8, probability: 1.0, humanize: 0 } }
);

// 2. Basics
const pureSine = p("Pure Sine", "Basic",
    { enabled: true, waveform: WaveformType.SINE, attack: 0.05, release: 0.1, gain: 0.8 },
    {}, {}, { reverbMix: 0.05, delayMix: 0 }
);

const sawtoothLead = p("Saw Lead", "Lead",
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2, filterCutoff: 4000, filterResonance: 2 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2, coarseDetune: 15, gain: 0.5 },
    {}, { delayMix: 0.3, delayTime: 0.2, spread: 0.2 }
);

const squareBass = p("Square Bass", "Bass",
    { enabled: true, waveform: WaveformType.SQUARE, attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.2, filterCutoff: 800, gain: 0.9 },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.6 },
    {}, { compressorRatio: 8, compressorThreshold: -15 }
);

// 3. Atmospheres
const crystalis = p("Crystalis", "Bells", 
    { enabled: true, waveform: WaveformType.SINE, gain: 0.6, attack: 0.01, decay: 1.5, sustain: 0.1, release: 2.0 },
    { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.3, coarseDetune: 1200, attack: 0.01, decay: 1.0 },
    { enabled: true, waveform: WaveformType.SINE, gain: 0.2, coarseDetune: 2400, attack: 0.01, decay: 0.5 },
    { reverbType: 'shimmer', reverbMix: 0.4, delayMix: 0.2 }
);

const fifthAtmosphere = p("Fifth Atmosphere", "Pad",
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 1.0, sustain: 0.8, release: 2.0, filterCutoff: 1200, gain: 0.5 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 702, attack: 1.0, sustain: 0.8, release: 2.0, gain: 0.4 },
    { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.3 },
    { reverbType: 'cathedral', reverbMix: 0.5, spread: 0.4 }
);

const ghostChoir = p("Ghost Choir", "Atmosphere",
    { enabled: true, waveform: WaveformType.TRIANGLE, attack: 0.8, release: 1.5, lfoTarget: 'pitch', lfoDepth: 10, lfoRate: 4, gain: 0.6 },
    { enabled: true, waveform: WaveformType.SINE, attack: 1.0, release: 2.0, coarseDetune: 1200, gain: 0.3 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.5, filterCutoff: 800, filterResonance: 5, gain: 0.2 },
    { reverbType: 'plate', reverbMix: 0.4 }
);

// 4. Keys & Plucks
const tremoloRhodes = p("Tremolo Keys", "Keys",
    { enabled: true, waveform: WaveformType.SINE, attack: 0.02, decay: 1.0, sustain: 0.2, release: 0.5, lfoTarget: 'tremolo', lfoRate: 6, lfoDepth: 60, gain: 0.8 },
    { enabled: true, waveform: WaveformType.TRIANGLE, attack: 0.02, decay: 0.5, sustain: 0.1, gain: 0.4 },
    {}, { reverbType: 'room', reverbMix: 0.2 }
);

const interference = p("Interference", "FX",
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.1, sustain: 1.0, release: 0.1, gain: 0.5 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, fineDetune: 15, gain: 0.5 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, fineDetune: -15, gain: 0.5 },
    { delayMix: 0.0, spread: 0.0 } // Mono for maximum beating
);

const massiveSaw = p("Massive SuperSaw", "Lead",
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -10, gain: 0.33, filterCutoff: 8000 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 10, gain: 0.33, filterCutoff: 8000 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, gain: 0.33, filterCutoff: 8000 },
    { spread: 0.8, reverbType: 'hall', reverbMix: 0.3 }
);

const pluckString = p("Plucked String", "Plucked",
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.005, decay: 0.3, sustain: 0.0, release: 0.2, filterCutoff: 1500, filterResonance: 3, gain: 0.8 },
    { enabled: true, waveform: WaveformType.SINE, attack: 0.005, decay: 0.4, sustain: 0.0, gain: 0.4 },
    {}, { delayMix: 0.3, delayTime: 0.3, reverbMix: 0.1 }
);

const glitchSciFi = p("Sci-Fi Glitch", "FX",
    { enabled: true, waveform: WaveformType.SQUARE, lfoTarget: 'pitch', lfoRate: 12, lfoDepth: 100, attack: 0.1, release: 0.5, gain: 0.6 },
    { enabled: true, waveform: WaveformType.TRIANGLE, lfoTarget: 'filter', lfoRate: 3, lfoDepth: 80, filterResonance: 10, gain: 0.5 },
    {}, { delayMix: 0.5, delayFeedback: 0.8, delayTime: 0.1 }
);

// --- 5. CREATIVE ARP PRESETS ---

const cyberRain = p("Cyber Rain", "Arp",
    { enabled: true, waveform: WaveformType.SINE, attack: 0.01, decay: 0.1, sustain: 0, release: 0.1, gain: 0.7 },
    { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.4, attack: 0.01, decay: 0.2 },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.3, attack: 0.05, decay: 0.3 },
    { 
        reverbType: 'shimmer', reverbMix: 0.7, delayMix: 0.4, delayTime: 0.25,
        arpConfig: { direction: 'random', division: '1/16', octaves: 3, gate: 0.4, swing: 0, length: 16, probability: 0.6, humanize: 20 }
    }
);

const pulsarData = p("Pulsar Data", "Arp",
    { enabled: true, waveform: WaveformType.SQUARE, attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.1, gain: 0.6, lfoTarget: 'filter', lfoRate: 8, lfoDepth: 30, filterCutoff: 800 },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1200, gain: 0.5, filterCutoff: 600, filterResonance: 5 },
    {},
    { 
        delayMix: 0.6, delayTime: 0.125, delayFeedback: 0.6, reverbMix: 0.2,
        arpConfig: { direction: 'up', division: '1/16', octaves: 1, gate: 0.3, swing: 20, length: 8, probability: 0.9, humanize: 10 }
    }
);

const glassSpiral = p("Glass Spiral", "Arp",
    { enabled: true, waveform: WaveformType.TRIANGLE, attack: 0.01, decay: 0.3, sustain: 0, gain: 0.8, lfoTarget: 'pitch', lfoRate: 50, lfoDepth: 2 },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: 700, gain: 0.4, attack: 0.02, decay: 0.5 },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1900, gain: 0.2, attack: 0.05, decay: 0.8 },
    { 
        reverbType: 'plate', reverbMix: 0.6,
        arpConfig: { direction: 'updown', division: '1/8', octaves: 2, gate: 0.8, swing: 0, length: 12, probability: 1.0, humanize: 5 }
    }
);

const entropyBass = p("Entropy Bass", "Arp",
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.1, gain: 0.9, filterCutoff: 400, filterResonance: 12, lfoTarget: 'filter', lfoRate: 0.2, lfoDepth: 40 },
    { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.5, filterCutoff: 300 },
    {},
    { 
        compressorThreshold: -15, reverbMix: 0.1,
        arpConfig: { direction: 'random', division: '1/16', octaves: 1, gate: 0.5, swing: 10, length: 8, probability: 0.85, humanize: 15 }
    }
);

const retroFuture = p("Retro Future", "Arp",
    { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.02, decay: 0.2, sustain: 0.1, gain: 0.6, filterCutoff: 2000 },
    { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, attack: 0.02, decay: 0.15, sustain: 0, gain: 0.4, filterCutoff: 1000 },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.3 },
    { 
        reverbType: 'hall', reverbMix: 0.4, delayMix: 0.5, delayTime: 0.375,
        arpConfig: { direction: 'order', division: '1/8', octaves: 2, gate: 0.7, swing: 15, length: 8, probability: 1.0, humanize: 0 }
    }
);

export const PRESETS: SynthPreset[] = [
    // Essentials
    preservedAnalogStrings,
    preservedDeepOcean,
    preservedNoiseWash,
    defaultArpPatch,
    // Creative Arps
    cyberRain,
    pulsarData,
    glassSpiral,
    entropyBass,
    retroFuture,
    // Restored & New
    pureSine,
    squareBass,
    sawtoothLead,
    tremoloRhodes,
    crystalis,
    fifthAtmosphere,
    ghostChoir,
    massiveSaw,
    pluckString,
    interference,
    glitchSciFi
];

export const DEFAULT_NORMAL_PRESET = preservedAnalogStrings; 
export const DEFAULT_STRUM_PRESET = crystalis; 
export const DEFAULT_LATCH_PRESET = preservedNoiseWash; 
export const DEFAULT_ARP_PRESET = defaultArpPatch;

export const DEFAULT_PRESET = preservedAnalogStrings;
export const DEFAULT_USER_BANK: SynthPreset[] = Array.from({ length: 100 }).map((_, i) => ({
    ...generateInitPatch(`User Slot ${i + 1}`, `user-${i}`),
    category: 'User'
}));
