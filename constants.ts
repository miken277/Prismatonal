import { AppSettings, ButtonShape, ChordDefinition, LimitColorMap, OscillatorConfig, SynthPreset, WaveformType, ReverbType, ArpeggioDefinition, KeyMappings } from './types';

export const DEFAULT_COLORS: LimitColorMap = {
  1: '#EF4444', // Red (Unity)
  3: '#EAB308', // Yellow (3-Limit)
  5: '#3B82F6', // Blue (5-Limit)
  7: '#22C55E', // Green (7-Limit)
  9: '#EAB308', // Yellow (9-Limit - Same as 3)
  11: '#A855F7', // Purple (11-Limit)
  13: '#F97316', // Orange (13-Limit)
  15: '#3B82F6', // Blue (15-Limit - Same as 5)
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

// Generate empty chord slots A-Z + 6 more to make 32
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
export const PIXELS_PER_MM = 3.78; // Standard 96 DPI approximation
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
        arpeggioBar: { x: margin, y: margin }
    };
};

const DEFAULT_UI_POSITIONS = getDefaults();

export const DEFAULT_SETTINGS: AppSettings = {
  tuningSystem: 'ji',
  layoutApproach: 'lattice',
  activeSkin: 'default',
  limitDepths: { 3: 3, 5: 2, 7: 1, 9: 1, 11: 1, 13: 1, 15: 1 },
  limitComplexities: { 3: 1000, 5: 1000, 7: 50, 9: 50, 11: 50, 13: 50, 15: 50 },
  showIncreaseDepthButton: true,
  centerResetsDepth: false,
  savedChords: generateChordSlots(),
  chordShortcutSizeScale: 0.6,
  chordsAlwaysRelatch: false,
  arpeggios: generateArpeggioSlots(),
  arpBpm: 120,
  hiddenLimits: [7, 9, 11, 13, 15],
  layerOrder: [15, 13, 11, 9, 7, 5, 3, 1], 
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
  buttonSizeScale: 1.26, // 10mm default with 2x correction
  buttonSpacingScale: 1.89, // 50mm default with 2x correction (Lattice default)
  latticeAspectRatio: 0.7, 
  canvasSize: 2000, 
  buttonShape: ButtonShape.CIRCLE,
  colors: { ...DEFAULT_COLORS },
  nodeTextSizeScale: 1.0,
  showFractionBar: false,
  isPitchBendEnabled: false, 
  isPitchSnapEnabled: true,
  polyphony: 4, 
  pitchOffLocked: false,
  volumeLocked: false,
  backgroundMode: 'rainbow',
  backgroundImageData: null,
  backgroundTiling: false,
  backgroundYOffset: 0,
  isRainbowModeEnabled: true, 
  rainbowSaturation: 50, 
  rainbowBrightness: 50, 
  rainbowOffset: 300, 
  isColoredIlluminationEnabled: true, 
  midiEnabled: false,
  midiOutputId: null,
  midiPitchBendRange: 24,
  enableKeyboardShortcuts: false,
  keyMappings: DEFAULT_KEY_MAPPINGS,
  strumDuration: 0.5,
  uiUnlocked: false,
  uiScale: 1.0, 
  uiEdgeMargin: 4, 
  uiPositions: DEFAULT_UI_POSITIONS
};

// Helper for default disabled oscillator
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
    compressorRelease: 0.2
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

// --- PRESERVED PATCHES (With Categories) ---
const preservedDeepOcean = p("Deep Ocean", "Atmosphere",
    { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 0, fineDetune: 0, gain: 0.4, attack: 1.5, decay: 0.5, sustain: 0.8, release: 2.0, filterCutoff: 800, filterResonance: 0.5, lfoRate: 0.2, lfoDepth: 25, lfoTarget: 'filter' },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: 0, fineDetune: -4, gain: 0.3, attack: 2.0, decay: 1.0, sustain: 0.7, release: 2.5, filterCutoff: 600, filterResonance: 0.5, lfoRate: 0.15, lfoDepth: 15, lfoTarget: 'tremolo' },
    { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, fineDetune: 0, gain: 0.4, attack: 1.0, decay: 2.0, sustain: 0.8, release: 3.0, filterCutoff: 500, filterResonance: 0, lfoTarget: 'tremolo', lfoRate: 4, lfoDepth: 10 },
    { category: 'Atmosphere', gain: 0.6, spread: 0.7, stereoPanSpeed: 0.1, stereoPanDepth: 0.5, reverbType: 'cathedral', reverbMix: 0.85, delayMix: 0.5, delayTime: 0.6, delayFeedback: 0.5, compressorThreshold: -30, compressorRatio: 8, compressorRelease: 0.5, modMatrix: [{ id: 'm1', enabled: true, source: 'env2', target: 'osc1_cutoff', amount: 30 }, { id: 'm2', enabled: true, source: 'lfo3', target: 'osc2_gain', amount: 20 }] }
);

const preservedAnalogStrings = p("Analog Strings", "Strings",
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, fineDetune: -1, gain: 0.3, attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.2, filterCutoff: 2000, filterResonance: 0.2, lfoRate: 0.1, lfoDepth: 30, lfoTarget: 'filter' },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, fineDetune: 1, gain: 0.3, attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.2, filterCutoff: 2000, filterResonance: 0.2, lfoRate: 3.5, lfoDepth: 10, lfoTarget: 'tremolo' },
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 1200, fineDetune: 0, gain: 0.12, attack: 1.0, decay: 0.5, sustain: 0.7, release: 2.0, filterCutoff: 1500, filterResonance: 0.5, lfoRate: 0.2, lfoDepth: 20, lfoTarget: 'filter' },
    { category: 'Strings', gain: 0.6, spread: 0.8, stereoPanSpeed: 0.05, stereoPanDepth: 0.3, reverbType: 'hall', reverbMix: 0.7, delayMix: 0.3, delayTime: 0.4, delayFeedback: 0.3, compressorThreshold: -20, compressorRatio: 6, compressorRelease: 0.3, modMatrix: [{ id: 'm1', enabled: true, source: 'lfo1', target: 'osc1_cutoff', amount: 20 }, { id: 'm2', enabled: true, source: 'lfo2', target: 'osc1_pitch', amount: 2 }] }
);

const preservedNoiseWash = p("Noise Wash", "Atmosphere",
    { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2400, fineDetune: 0, gain: 0.3, attack: 2.0, decay: 3.0, sustain: 0.8, release: 4.0, filterCutoff: 300, filterResonance: 15, lfoRate: 0.1, lfoDepth: 80, lfoTarget: 'filter' },
    { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, fineDetune: 0, gain: 0.2, attack: 2.0, decay: 3.0, sustain: 0.8, release: 4.0, filterCutoff: 400, filterResonance: 10, lfoRate: 0.15, lfoDepth: 60, lfoTarget: 'filter' },
    {},
    { category: 'Atmosphere', gain: 0.5, spread: 0, stereoPanSpeed: 0, stereoPanDepth: 0, reverbType: 'hall', reverbMix: 0.9, reverbSize: 3.5, reverbDamping: 0.4, reverbDiffusion: 0.7, delayMix: 0.7, delayTime: 0.8, delayFeedback: 0.7, compressorThreshold: -30, compressorRatio: 2, compressorRelease: 1.0 }
);

// --- NEW PATCH BANKS ---
const PLUCKED_PATCHES = [
    p("Classic Harp", "Plucked", { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, attack: 0.05, decay: 1.5, sustain: 0, release: 1.5 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.3, attack: 0.05, decay: 1.2, sustain: 0 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.1, filterCutoff: 1500, decay: 0.8, sustain: 0 }, { spread: 0.4, reverbType: 'hall', reverbMix: 0.3 }),
    p("Koto Synth", "Plucked", { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, decay: 0.4, sustain: 0, filterCutoff: 3000 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 700, gain: 0.4, decay: 0.5, sustain: 0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.2, decay: 0.3, sustain: 0 }, { spread: 0.3, reverbType: 'room', reverbMix: 0.2 }),
    p("Guitar Pluck", "Plucked", { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, decay: 0.8, sustain: 0, filterCutoff: 2000 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.3, decay: 0.6, sustain: 0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.1, decay: 0.2, sustain: 0 }, { spread: 0.2, reverbType: 'room', reverbMix: 0.3, delayMix: 0.2 }),
    p("Kalimba Dream", "Plucked", { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 0.6, sustain: 0 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.3, decay: 0.4, sustain: 0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, decay: 0.2, sustain: 0 }, { spread: 0.4, reverbType: 'plate', reverbMix: 0.25 })
];

const STRINGS_PATCHES = [
    p("Solo Violin", "Strings", { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.6, attack: 0.1, decay: 0.5, sustain: 0.8, release: 0.4, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 5 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 0, fineDetune: 4, gain: 0.4, attack: 0.1, decay: 0.5, sustain: 0.8, release: 0.4 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.2, filterCutoff: 800 }, { spread: 0.3, reverbType: 'hall', reverbMix: 0.4, compressorThreshold: -15 }),
    p("Cello Section", "Strings", { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1200, gain: 0.5, attack: 0.4, release: 0.8, filterCutoff: 1000 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1205, gain: 0.4, attack: 0.5, release: 0.9, filterCutoff: 800 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -1195, gain: 0.4, attack: 0.4, release: 0.8 }, { spread: 0.6, reverbType: 'hall', reverbMix: 0.6 }),
    p("Pizzicato", "Strings", { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.8, attack: 0.01, decay: 0.25, sustain: 0, release: 0.25 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.3, attack: 0.01, decay: 0.2, sustain: 0 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.2, attack: 0.02, decay: 0.15, sustain: 0, filterCutoff: 1200 }, { spread: 0.4, reverbType: 'room', reverbMix: 0.2 }),
    p("Tremolo Strings", "Strings", { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.2, sustain: 0.8, lfoTarget: 'tremolo', lfoRate: 6, lfoDepth: 40 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 5, gain: 0.5, attack: 0.25, sustain: 0.8, lfoTarget: 'tremolo', lfoRate: 6.2, lfoDepth: 40 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.3 }, { spread: 0.7, reverbType: 'hall', reverbMix: 0.5 }),
    p("Synth Strings 80s", "Strings", { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.4, attack: 0.5, release: 1.0, fineDetune: -8 }, { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.4, attack: 0.5, release: 1.0, fineDetune: 8 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, gain: 0.1, attack: 0.5, release: 1.0, filterCutoff: 4000 }, { spread: 0.8, stereoPanSpeed: 0.2, stereoPanDepth: 0.3, reverbType: 'plate', reverbMix: 0.6 }),
    p("Cinematic Swell", "Strings", { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 1.5, decay: 2.0, sustain: 1.0, release: 2.0, filterCutoff: 600, lfoTarget: 'filter', lfoRate: 0.1, lfoDepth: 60 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 7, gain: 0.4, attack: 1.8, release: 2.5 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.4, attack: 1.0, release: 3.0 }, { spread: 0.9, reverbType: 'cathedral', reverbMix: 0.8 }),
    p("Chamber Quartet", "Strings", { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.3, decay: 0.5, sustain: 0.7, filterCutoff: 1500 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 3, gain: 0.4, attack: 0.35, sustain: 0.7 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -5, gain: 0.2, filterCutoff: 1000 }, { spread: 0.5, reverbType: 'room', reverbMix: 0.35 })
];

const ATMOSPHERE_PATCHES = [
    p("Wind Chimes", "Atmosphere", { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.5, attack: 0.01, decay: 0.5, sustain: 1.0, lfoTarget: 'tremolo', lfoRate: 5, lfoDepth: 100 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3102, gain: 0.4, attack: 0.05, decay: 0.5, sustain: 1.0, lfoTarget: 'tremolo', lfoRate: 7, lfoDepth: 100 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, gain: 0.3, attack: 0.02, decay: 0.5, sustain: 1.0, lfoTarget: 'tremolo', lfoRate: 3, lfoDepth: 100 }, { spread: 0.9, reverbType: 'shimmer', reverbMix: 0.85, delayMix: 0.5, delayTime: 0.33, delayFeedback: 0.6 }),
    p("Dark Drone", "Atmosphere", { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2400, gain: 0.5, filterCutoff: 150, filterResonance: 10, lfoTarget: 'filter', lfoRate: 0.05, lfoDepth: 40 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.4, filterCutoff: 200, filterResonance: 8, lfoTarget: 'filter', lfoRate: 0.07, lfoDepth: 30 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2405, gain: 0.3, filterCutoff: 100 }, { spread: 0.7, reverbType: 'cathedral', reverbMix: 0.9, compressorThreshold: -25 }),
    p("Swamp", "Atmosphere", { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, lfoTarget: 'pitch', lfoRate: 6, lfoDepth: 20, filterCutoff: 600 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 700, gain: 0.4, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 15 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.3, filterCutoff: 400 }, { spread: 0.6, reverbType: 'plate', reverbMix: 0.6 }),
    p("Industrial", "Atmosphere", { enabled: true, waveform: WaveformType.SQUARE, gain: 0.6, coarseDetune: -1200, lfoTarget: 'pitch', lfoRate: 50, lfoDepth: 5 }, { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, coarseDetune: -2400, filterCutoff: 800, filterResonance: 15, lfoTarget: 'filter', lfoRate: 8, lfoDepth: 30 }, { enabled: true, waveform: WaveformType.SINE, gain: 0.7, coarseDetune: -1200, lfoTarget: 'tremolo', lfoRate: 15, lfoDepth: 60 }, { spread: 0.5, reverbType: 'plate', reverbMix: 0.5, compressorThreshold: -15, compressorRatio: 12 }),
    p("Glass Texture", "Atmosphere", { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.6, attack: 0.5, release: 2.0, lfoTarget: 'pitch', lfoRate: 6, lfoDepth: 15 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1900, gain: 0.4, attack: 1.0, release: 2.5, lfoTarget: 'tremolo', lfoRate: 8, lfoDepth: 20 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.3, attack: 1.5, release: 3.0, filterCutoff: 4000, filterResonance: 5 }, { spread: 0.8, reverbType: 'plate', reverbMix: 0.7, delayMix: 0.4 }),
    p("Abyss", "Atmosphere", { enabled: true, waveform: WaveformType.SINE, coarseDetune: -2400, gain: 0.9, attack: 2.0, release: 6.0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.5, attack: 3.0, release: 6.0 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -3600, gain: 0.3, filterCutoff: 120, filterResonance: 0, lfoTarget: 'filter', lfoRate: 0.05, lfoDepth: 30 }, { spread: 0.6, reverbType: 'cathedral', reverbMix: 0.95, stereoPanSpeed: 0.1, stereoPanDepth: 0.6 })
];

const ETHEREAL_PADS = [
    p("Cloud Nine", "Pads", { enabled: true, waveform: WaveformType.SINE, attack: 1.0, decay: 3.0, sustain: 0.8, release: 4.0 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.4, attack: 1.5, decay: 3.0, sustain: 0.7, release: 4.0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.3, attack: 2.0, decay: 4.0, sustain: 0.6, release: 5.0 }, { spread: 0.8, reverbType: 'shimmer', reverbMix: 0.6 }),
    p("Warm Blanket", "Pads", { enabled: true, waveform: WaveformType.TRIANGLE, attack: 0.5, sustain: 1.0, filterCutoff: 800 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.5, attack: 0.6, sustain: 1.0 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 700, gain: 0.2, attack: 1.0, sustain: 0.8, filterCutoff: 600 }, { spread: 0.6, reverbType: 'hall', reverbMix: 0.5 }),
    p("Angel Choir", "Pads", { enabled: true, waveform: WaveformType.SAWTOOTH, attack: 0.8, sustain: 0.9, filterCutoff: 1500, filterResonance: 2 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.4, attack: 0.9, sustain: 0.9 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.4, attack: 1.0, sustain: 0.9 }, { spread: 0.7, reverbType: 'cathedral', reverbMix: 0.7 }),
    p("Ice Fields", "Pads", { enabled: true, waveform: WaveformType.SQUARE, attack: 0.2, sustain: 1.0, filterCutoff: 2500, filterResonance: 0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.5, attack: 0.2, sustain: 1.0 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, gain: 0.3, attack: 0.3, sustain: 0.8 }, { spread: 0.5, reverbType: 'plate', reverbMix: 0.4 })
];

const ETHEREAL_LEADS = [
    p("Liquid Light", "Leads", { enabled: true, waveform: WaveformType.SINE, gain: 0.8, attack: 0.05 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 4, gain: 0.6 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, gain: 0.2, filterCutoff: 2000, lfoTarget: 'filter', lfoRate: 6, lfoDepth: 20 }, { spread: 0.4, stereoPanSpeed: 2.0, stereoPanDepth: 0.5, reverbType: 'hall', delayMix: 0.4, reverbMix: 0.4 }),
    p("Laser Harp", "Leads", { enabled: true, waveform: WaveformType.SAWTOOTH, filterCutoff: 4000, decay: 0.3, sustain: 0 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, gain: 0.3, decay: 0.2, sustain: 0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, decay: 0.1 }, { spread: 0.6, stereoPanSpeed: 6.0, stereoPanDepth: 0.3, reverbType: 'plate', delayMix: 0.5, delayTime: 0.3, modMatrix: [{ id: 'm1', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 50 }] }),
    p("Ghost Flute", "Leads", { enabled: true, waveform: WaveformType.TRIANGLE, attack: 0.1, lfoTarget: 'tremolo', lfoRate: 5, lfoDepth: 20 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.2 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1205, gain: 0.2 }, { spread: 0.5, stereoPanSpeed: 0.5, stereoPanDepth: 0.6, reverbType: 'hall', reverbMix: 0.8 }),
    p("Warp Drive", "Leads", { enabled: true, waveform: WaveformType.SAWTOOTH, filterCutoff: 2000, lfoTarget: 'pitch', lfoRate: 8, lfoDepth: 5 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.5 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 700, gain: 0.3, lfoTarget: 'filter', lfoRate: 2, lfoDepth: 40 }, { spread: 0.3, stereoPanSpeed: 8.0, stereoPanDepth: 0.4, reverbType: 'room', delayMix: 0.3 }),
    p("Crystal Solo", "Leads", { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 0.5, sustain: 0.5 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, decay: 0.2, gain: 0.4 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 3600, decay: 0.1, gain: 0.1, filterCutoff: 5000 }, { spread: 0.4, stereoPanSpeed: 1.0, stereoPanDepth: 0.3, reverbType: 'plate', reverbMix: 0.5, modMatrix: [{ id: 'm1', enabled: true, source: 'lfo1', target: 'osc1_gain', amount: 10 }] }),
    p("Acid Trip", "Leads", { enabled: true, waveform: WaveformType.SAWTOOTH, filterCutoff: 800, filterResonance: 15, lfoTarget: 'filter', lfoRate: 3, lfoDepth: 30 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.4, filterCutoff: 600, lfoTarget: 'filter', lfoRate: 2.5, lfoDepth: 40 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -2400, gain: 0.4, filterCutoff: 400, lfoTarget: 'filter', lfoRate: 2.0, lfoDepth: 50 }, { spread: 0.2, stereoPanSpeed: 4.0, stereoPanDepth: 0.7, reverbType: 'room', delayMix: 0.4 }),
    p("Phase Shift", "Leads", { enabled: true, waveform: WaveformType.SQUARE, gain: 0.6 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 5, gain: 0.6 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 10, gain: 0.6 }, { spread: 0.8, stereoPanSpeed: 0.2, stereoPanDepth: 0.8, reverbType: 'plate', delayMix: 0.3 }),
    p("Soft Glow", "Leads", { enabled: true, waveform: WaveformType.TRIANGLE, filterCutoff: 1500, attack: 0.2 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.3 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1404, gain: 0.15 }, { spread: 0.5, stereoPanSpeed: 1.0, stereoPanDepth: 0.4, reverbType: 'hall', reverbMix: 0.6, modMatrix: [{ id: 'm1', enabled: true, source: 'lfo1', target: 'osc1_cutoff', amount: 20 }] })
];

const ETHEREAL_BASS = [
    p("Void Bass", "Bass", { enabled: true, waveform: WaveformType.SINE, gain: 1.0, attack: 0.1 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.5 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -2400, gain: 0.3, filterCutoff: 200 }, { spread: 0.2, stereoPanSpeed: 0.1, stereoPanDepth: 0.2, reverbType: 'room', reverbMix: 0.4, modMatrix: [{ id: 'm1', enabled: true, source: 'env1', target: 'osc1_gain', amount: 10 }] }),
    p("Pulsar", "Bass", { enabled: true, waveform: WaveformType.SAWTOOTH, filterCutoff: 400, lfoTarget: 'filter', lfoRate: 6, lfoDepth: 15 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.6 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 0, gain: 0.4, lfoTarget: 'tremolo', lfoRate: 3, lfoDepth: 30 }, { spread: 0.4, stereoPanSpeed: 6.0, stereoPanDepth: 0.3, reverbType: 'room', delayMix: 0.2 }),
    p("Deep Space", "Bass", { enabled: true, waveform: WaveformType.TRIANGLE, filterCutoff: 200, lfoTarget: 'tremolo', lfoRate: 0.1, lfoDepth: 30 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -2400, gain: 0.7 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -3600, gain: 0.2, filterCutoff: 150 }, { spread: 0.6, stereoPanSpeed: 0.05, stereoPanDepth: 0.5, reverbType: 'cathedral', reverbMix: 0.8 }),
    p("Wobble Void", "Bass", { enabled: true, waveform: WaveformType.SQUARE, filterCutoff: 600, lfoTarget: 'filter', lfoRate: 2, lfoDepth: 30 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.5 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -2400, gain: 0.5 }, { spread: 0.5, stereoPanSpeed: 2.0, stereoPanDepth: 0.6, reverbType: 'room' }),
    p("Sub Drone", "Bass", { enabled: true, waveform: WaveformType.SINE, gain: 0.9 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3, gain: 0.5 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.1, filterCutoff: 100 }, { spread: 0.6, stereoPanSpeed: 0.05, stereoPanDepth: 0.5, reverbType: 'cathedral', reverbMix: 0.5 }),
    p("Reso Bass", "Bass", { enabled: true, waveform: WaveformType.SAWTOOTH, filterCutoff: 500, filterResonance: 8 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 1200, gain: 0.3, filterCutoff: 800, filterResonance: 5 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.5 }, { spread: 0.2, stereoPanSpeed: 0.5, stereoPanDepth: 0.3, reverbType: 'plate', delayMix: 0.3, modMatrix: [{ id: 'm1', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 40 }] }),
    p("Pluck Abyss", "Bass", { enabled: true, waveform: WaveformType.SQUARE, decay: 0.4, sustain: 0, filterCutoff: 800 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.6 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 0, gain: 0.3, decay: 0.1, sustain: 0 }, { spread: 0.3, stereoPanSpeed: 1.0, stereoPanDepth: 0.2, reverbType: 'room', reverbMix: 0.3 }),
    p("Growling Star", "Bass", { enabled: true, waveform: WaveformType.SAWTOOTH, filterCutoff: 300, gain: 0.8 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 8, filterCutoff: 300, gain: 0.6 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -8, filterCutoff: 300, gain: 0.6 }, { spread: 0.8, stereoPanSpeed: 0.2, stereoPanDepth: 0.5, compressorThreshold: -15, reverbType: 'plate' })
];

const ETHEREAL_KEYS = [
    p("Dream Rhodes", "Keys", { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 1.5 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.2, decay: 1.0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.1, decay: 0.5 }, { spread: 0.6, stereoPanSpeed: 0.3, stereoPanDepth: 0.5, reverbType: 'hall', reverbMix: 0.6, delayMix: 0.4, modMatrix: [{ id: 'm1', enabled: true, source: 'lfo1', target: 'osc1_gain', amount: 20 }] }),
    p("Space Organ", "Keys", { enabled: true, waveform: WaveformType.SINE, gain: 0.5, lfoTarget: 'filter', lfoRate: 2.0, lfoDepth: 15 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.4, lfoTarget: 'tremolo', lfoRate: 3.5, lfoDepth: 20 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1902, gain: 0.3 }, { spread: 0.8, stereoPanSpeed: 2.0, stereoPanDepth: 0.4, reverbType: 'cathedral', reverbMix: 0.6 }),
    p("Underwater", "Keys", { enabled: true, waveform: WaveformType.TRIANGLE, filterCutoff: 800, lfoTarget: 'filter', lfoRate: 1, lfoDepth: 15 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.3 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.4, filterCutoff: 300 }, { spread: 0.5, stereoPanSpeed: 0.5, stereoPanDepth: 0.6, reverbType: 'plate', delayMix: 0.5 }),
    p("Frozen Time", "Keys", { enabled: true, waveform: WaveformType.SQUARE, filterCutoff: 1500, decay: 2.0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.3 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, gain: 0.15, lfoTarget: 'tremolo', lfoRate: 4, lfoDepth: 30 }, { spread: 0.8, stereoPanSpeed: 0.1, stereoPanDepth: 0.5, reverbType: 'shimmer', reverbMix: 0.8, modMatrix: [{ id: 'm1', enabled: true, source: 'lfo2', target: 'osc1_cutoff', amount: 10 }] }),
    p("Glitch Keys", "Keys", { enabled: true, waveform: WaveformType.SAWTOOTH, decay: 0.2, sustain: 0, filterCutoff: 2000 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, decay: 0.1, gain: 0.4 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 700, decay: 0.15, gain: 0.3 }, { spread: 0.9, stereoPanSpeed: 8.0, stereoPanDepth: 0.7, reverbType: 'room', delayTime: 0.1, delayFeedback: 0.6 }),
    p("Vaporwave", "Keys", { enabled: true, waveform: WaveformType.TRIANGLE, lfoTarget: 'pitch', lfoRate: 0.5, lfoDepth: 8 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.4 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.3 }, { spread: 0.4, stereoPanSpeed: 0.2, stereoPanDepth: 0.4, reverbType: 'plate', delayMix: 0.4, delayFeedback: 0.7 }),
    p("Halo", "Keys", { enabled: true, waveform: WaveformType.SINE, attack: 0.5, decay: 1.0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, gain: 0.1 }, { spread: 0.7, stereoPanSpeed: 2.0, stereoPanDepth: 0.3, reverbType: 'shimmer', reverbMix: 0.7 }),
    p("Echoes", "Keys", { enabled: true, waveform: WaveformType.TRIANGLE, decay: 0.5 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 702, gain: 0.4 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1900, gain: 0.1, filterCutoff: 1000 }, { spread: 0.6, stereoPanSpeed: 0.6, stereoPanDepth: 0.5, reverbType: 'hall', delayMix: 0.6, delayTime: 0.6 })
];

const ETHEREAL_MALLETS = [
    p("Crystal Rain", "Mallets", { enabled: true, waveform: WaveformType.SINE, decay: 0.5, sustain: 0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, decay: 0.4, gain: 0.4 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, decay: 0.3, gain: 0.2 }, { spread: 0.9, stereoPanSpeed: 2.0, stereoPanDepth: 0.6, reverbType: 'hall', delayMix: 0.5, reverbMix: 0.4, modMatrix: [{ id: 'm1', enabled: true, source: 'lfo1', target: 'osc1_pitch', amount: 5 }] }),
    p("Spirit Chime", "Mallets", { enabled: true, waveform: WaveformType.TRIANGLE, decay: 1.5, sustain: 0, filterCutoff: 3000 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 500, decay: 1.0, gain: 0.3 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, decay: 2.0, gain: 0.2 }, { spread: 0.7, stereoPanSpeed: 0.5, stereoPanDepth: 0.4, reverbType: 'cathedral', reverbMix: 0.7 }),
    p("Alien Kalimba", "Mallets", { enabled: true, waveform: WaveformType.SQUARE, decay: 0.3, sustain: 0, filterCutoff: 1000 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.5 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 700, gain: 0.3, decay: 0.2 }, { spread: 0.5, stereoPanSpeed: 5.0, stereoPanDepth: 0.3, reverbType: 'plate', delayMix: 0.3 }),
    p("Glass Marimba", "Mallets", { enabled: true, waveform: WaveformType.SINE, decay: 0.4, gain: 0.8 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, decay: 0.3, gain: 0.3 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, decay: 0.2, gain: 0.2 }, { spread: 0.6, stereoPanSpeed: 1.0, stereoPanDepth: 0.5, reverbType: 'room', reverbMix: 0.5 }),
    p("Spectral Bells", "Mallets", { enabled: true, waveform: WaveformType.SINE, decay: 3.0, gain: 0.6 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 700, decay: 2.5, gain: 0.4 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 1900, decay: 0.1, gain: 0.15, filterCutoff: 4000, lfoTarget: 'tremolo', lfoRate: 12, lfoDepth: 50 }, { spread: 0.9, stereoPanSpeed: 0.2, stereoPanDepth: 0.6, reverbType: 'shimmer', reverbMix: 0.85 }),
    p("Psychedelic Wood", "Mallets", { enabled: true, waveform: WaveformType.TRIANGLE, decay: 0.2, sustain: 0 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1200, decay: 0.1, gain: 0.2 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, decay: 0.3, gain: 0.3, filterCutoff: 500 }, { spread: 1.0, stereoPanSpeed: 8.0, stereoPanDepth: 0.6, reverbType: 'hall', delayMix: 0.4 }),
    p("Aurora", "Mallets", { enabled: true, waveform: WaveformType.SINE, attack: 0.1, decay: 1.0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, attack: 0.2, decay: 0.8, gain: 0.5 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1900, attack: 0.5, decay: 1.5, gain: 0.3 }, { spread: 0.7, stereoPanSpeed: 0.3, stereoPanDepth: 0.7, reverbType: 'shimmer', reverbMix: 0.6 }),
    p("Star Drops", "Mallets", { enabled: true, waveform: WaveformType.SINE, decay: 0.1, sustain: 0 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 3600, decay: 0.1, gain: 0.3 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 2400, decay: 0.2, gain: 0.2 }, { spread: 0.9, stereoPanSpeed: 4.0, stereoPanDepth: 0.5, reverbType: 'plate', delayMix: 0.6, delayTime: 0.2 })
];

// Create User Bank with 100 Empty Slots
export const DEFAULT_USER_BANK: SynthPreset[] = Array.from({ length: 100 }).map((_, i) => ({
    ...generateInitPatch(`User Slot ${i + 1}`, `user-${i}`),
    category: 'User'
}));

// Combine all presets into one flat list for the UI
export const PRESETS: SynthPreset[] = [
    preservedNoiseWash, // Default
    preservedDeepOcean,
    preservedAnalogStrings,
    ...PLUCKED_PATCHES,
    ...STRINGS_PATCHES,
    ...ATMOSPHERE_PATCHES,
    ...ETHEREAL_PADS,
    ...ETHEREAL_LEADS,
    ...ETHEREAL_BASS,
    ...ETHEREAL_KEYS,
    ...ETHEREAL_MALLETS
];

export const DEFAULT_NORMAL_PRESET = preservedAnalogStrings; 
export const DEFAULT_STRUM_PRESET = PLUCKED_PATCHES[0]; 
export const DEFAULT_LATCH_PRESET = preservedNoiseWash;
export const DEFAULT_ARP_PRESET = PLUCKED_PATCHES[0];
export const DEFAULT_PRESET = preservedAnalogStrings;