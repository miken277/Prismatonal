
import { AppSettings, ButtonShape, ChordDefinition, LimitColorMap, OscillatorConfig, SynthPreset, WaveformType, ReverbType, ArpeggioDefinition, KeyMappings, BackgroundPreset } from './types';

export const DEFAULT_COLORS: LimitColorMap = {
  1: '#EF4444', // Red (Unity)
  2: '#EF4444', // Red (Octave)
  3: '#EAB308', // Yellow (3-Limit)
  5: '#3B82F6', // Blue (5-Limit)
  7: '#22C55E', // Green (7-Limit)
  9: '#EAB308', // Yellow (9-Limit - Same as 3)
  11: '#A855F7', // Purple (11-Limit)
  13: '#F97316', // Orange (13-Limit)
  15: '#3B82F6', // Blue (15-Limit - Same as 5)
};

export const MODE_COLORS = {
    1: '#22c55e', // Drone (Green)
    2: '#3b82f6', // Strings (Blue)
    3: '#f97316', // Plucked (Orange)
    4: '#eab308', // Brass (Yellow)
    'arp': '#ef4444', // Arpeggiator (Red)
    'cursor': '#ffffff' // Generic Touch
};

export const DEFAULT_KEY_MAPPINGS: KeyMappings = {
    // Navigation
    center: 'c',
    increaseDepth: '.',
    decreaseDepth: ',',
    settings: 's',
    
    // Global & Panic
    volumeUp: 'arrowup',
    volumeDown: 'arrowdown',
    panic: 'escape',
    off: 'o',
    
    // Patch & Mode Controls (Bottom Right Priority)
    latch: 'l', // Key binding for mode toggling (Drone/Strings)
    sustain: ' ', // Spacebar for Sustain (previously latch)
    bend: 'b',
    modeDrone: '1',
    modeStrings: '2',
    modePlucked: '3',
    modeBrass: '4', // Updated mapping name
    synth: 'm',

    // Chords
    addChord: 'enter',
    
    // Tempo
    bpmUp: ']',
    bpmDown: '[',

    // Arpeggiator
    toggleSequencer: 'q',
    playAllArps: 'p',
    stopAllArps: 'x',
    
    // Legacy / View (Less prioritized)
    spatialScaleUp: 'arrowright',
    spatialScaleDown: 'arrowleft',
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
        sust: { x: w - 80 - margin, y: h - 330 },
        bend: { x: w - 80 - margin, y: h - 380 },
        center: { x: margin, y: h - 48 - margin },
        depth: { x: margin + 60, y: h - 48 - margin },
        decreaseDepth: { x: margin + 120, y: h - 48 - margin },
        chords: { x: margin + 180, y: h - 48 - margin },
        layers: { x: w - 90 - margin, y: margin + 60 },
        arpeggioBar: { x: margin, y: margin },
        instruments: { x: margin, y: margin + 60 },
        complexity: { x: margin, y: margin + 60 } // Default left position
    };
};

const DEFAULT_UI_POSITIONS = getDefaults();

export const DEFAULT_UI_SIZES = {
    volume: { width: 600, height: 160 }, // Increased from 110 to ensure full coverage by default
    arpeggioBar: { width: 760 }
};

// Optimized SVG Patterns (Base64 Encoded)
// 1. Cosmic Geometry: Concentric circles with radial lines
const COSMIC_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMDAnIGhlaWdodD0nMjAwJyB2aWV3Qm94PScwIDAgMjAwIDIwMCc+PHJlY3Qgd2lkdGg9JzIwMCcgaGVpZ2h0PScyMDAnIGZpbGw9JyMwZjE3MmEnLz48ZyBvcGFjaXR5PScwLjQnPjxjaXJjbGUgY3g9JzEwMCcgY3k9JzEwMCcgcj0nOTAnIGZpbGw9Im5vbmUiIHN0cm9rZT0nIzM4YmRmOCcgc3Ryb2tlLXdpZHRoPScxJy8+PGNpcmNsZSBjeD0nMTAwJyBjeT0nMTAwJyByPSc3MCcgZmlsbD0ibm9uZSIgc3Ryb2tlPScjODE4Y2Y4JyBzdHJva2Utd2lkdGg9JzEnLz48Y2lyY2xlIGN4PScxMDAnIGN5PScxMDAnIHI9JzUwJyBmaWxsPSJub25lIiBzdHJva2U9JyNjMDg0ZmMnIHN0cm9rZS13aWR0aD0nMScvPjxjaXJjbGUgY3g9JzEwMCcgY3k9JzEwMCcgcj0nMzAnIGZpbGw9Im5vbmUiIHN0cm9rZT0nI2Y0NzJiNicgc3Ryb2tlLXdpZHRoPScxJy8+PC9nPjxwYXRoIGQ9J00wIDAgTDIwMCAyMDAgTTIwMCAwIEwwIDIwMCBNMTAwIDAgTTEwMCAyMDAgMTAwIDEwMCBMMjAwIDEwMCcgc3Ryb2tlPScjZmZmZmZmJyBzdHJva2Utd2lkdGg9JzAuNScgb3BhY2l0eT0nMC4yJy8+PC9zdmc+";

// 2. Neural Grid: Connected nodes on a dark background
const NEURAL_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJyB2aWV3Qm94PScwIDAgMTAwIDEwMCc+PHJlY3Qgd2lkdGg9JzEwMCcgaGVpZ2h0PScxMDAnIGZpbGw9JyMwZjE3MmEnLz48cGF0aCBkPSdNMCA1MCBMMTAwIDUwIE01MCAwIEw1MCAxMDAnIHN0cm9rZT0nIzM4YmRmOCcgc3Ryb2tlLXdpZHRoPScxJyBvcGFjaXR5PScwLjInLz48Y2lyY2xlIGN4PScxMDAnIGN5PSc1MCcgY3k9JzUwJyByPScyJyBmaWxsPScjMzhiZGY4JyBvcGFjaXR5PScwLjUnLz48L3N2Zz4=";

export const DEFAULT_BACKGROUNDS: BackgroundPreset[] = [
    {
        id: 'default-1',
        name: 'Cosmic Geometry',
        data: COSMIC_SVG
    },
    {
        id: 'default-2',
        name: 'Neural Grid',
        data: NEURAL_SVG
    },
    // User Slots (Empty by default)
    { id: 'user-1', name: 'User Slot 1', data: null },
    { id: 'user-2', name: 'User Slot 2', data: null },
    { id: 'user-3', name: 'User Slot 3', data: null },
    { id: 'user-4', name: 'User Slot 4', data: null },
    { id: 'user-5', name: 'User Slot 5', data: null },
    { id: 'user-6', name: 'User Slot 6', data: null },
];

export const DEFAULT_SETTINGS: AppSettings = {
  tuningSystem: 'ji',
  layoutApproach: 'lattice',
  activeSkin: 'default',
  limitDepths: { 3: 3, 5: 2, 7: 1, 9: 1, 11: 1, 13: 1, 15: 1 },
  // Default to First Two Octaves (Harmonics 1-7) enabled, higher ones disabled
  enabledIdentities: [1, 3, 5, 7], 
  showIncreaseDepthButton: true,
  centerResetsDepth: false,
  savedChords: generateChordSlots(),
  chordShortcutSizeScale: 0.6,
  arpeggios: generateArpeggioSlots(),
  arpBpm: 120,
  hiddenLimits: [7, 9, 11, 13, 15],
  layerOrder: [15, 13, 11, 9, 7, 5, 3, 1], 
  baseFrequency: 196.00, // G3
  audioLatencyHint: 'playback',
  enableOversampling: false, // Default to OFF for better general performance
  wavetableSize: 8192,
  interpolationType: 'cubic',
  isVoiceLeadingEnabled: true, 
  voiceLeadingStrength: 0.3, 
  isVoiceLeadingAnimationEnabled: true,
  voiceLeadingAnimationSpeed: 2.0,
  voiceLeadingReverseDir: false,
  voiceLeadingGlowAmount: 0.5,
  voiceLeadingSteps: 1,
  baseLineWidth: 1.0, 
  lineBrighteningEnabled: true,
  lineBrighteningSteps: 1,
  lineBrighteningWidth: 1.0, // Default width for brightened lines
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
  isPitchBendEnabled: true, // Default: Enabled
  isSustainEnabled: true, // Default: Enabled (for Strings)
  isStrumEnabled: false, // Default to false so String behaves like a normal Gate instrument
  chordsAlwaysRelatch: false, // New Default
  isPitchSnapEnabled: true,
  polyphony: 8, // Reduced from 16 to 8 for better mobile stability by default
  pitchOffLocked: false,
  volumeLocked: false,
  
  // Background & Overlay
  backgroundMode: 'image', // Updated Default
  backgroundPresets: DEFAULT_BACKGROUNDS,
  solidColor: '#0f172a', // Default dark slate
  gradientColorStart: '#0f172a',
  gradientColorEnd: '#1e1b4b', // Deep indigo
  gradientType: 'radial',
  gradientAngle: 180,
  backgroundImageData: DEFAULT_BACKGROUNDS[0].data, // Use First Default Background
  backgroundYOffset: 0,
  backgroundTiling: true, // Updated Default
  bgImageGamma: 1.0,
  bgImageTint: '#000000',
  bgImageTintStrength: 0.3, // Lowered from 0.7 to 0.3 to ensure images are visible by default
  
  // Overlay Defaults (Deprecated but kept for type safety until refactor complete)
  isOverlayEnabled: false,
  overlayBlendMode: 'normal',
  overlayOpacity: 0.5,
  overlayType: 'solid',
  overlayColorStart: '#000000',
  overlayColorEnd: '#000000',
  overlayGradientType: 'linear',
  overlayGradientAngle: 180,
  
  // Rainbow Defaults
  rainbowSaturation: 90,
  rainbowBrightness: 60,
  rainbowOffset: 0,
  isColoredIlluminationEnabled: false,
  isRainbowModeEnabled: true,

  midiEnabled: false,
  midiOutputId: null,
  midiPitchBendRange: 24,
  enableKeyboardShortcuts: false,
  keyMappings: DEFAULT_KEY_MAPPINGS,
  strumDuration: 0.5,
  enableAudioRecording: false, // Renamed from recordScreenActivity

  // UI Relocation & Scaling
  uiUnlocked: false,
  uiScale: 1.0, 
  uiEdgeMargin: 4, 
  uiPositions: DEFAULT_UI_POSITIONS,
  uiSizes: DEFAULT_UI_SIZES,
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
    filterType: 'lowpass',
    lfoRate: 1,
    lfoDepth: 0,
    lfoWaveform: 'sine',
    lfoTarget: 'none',
    lfoDelay: 0
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
    portamento: 0
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

// --- DIAGNOSTIC PATCHES ---
const DIAGNOSTIC_PATCHES = [
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
    // Sitar - Bright, buzzing bridge (Jawari) simulation
    p("Sitar", "Plucked",
        // Osc 1: Main String with Jawari
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.65, attack: 0.02, decay: 0.4, sustain: 0.6, release: 3.0, filterType: 'bandpass', filterCutoff: 2200, filterResonance: 6.0 },
        // Osc 2: Sympathetic Strings
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: 1205, gain: 0.2, attack: 0.1, decay: 1.0, sustain: 0.5, release: 4.0, filterType: 'highpass', filterCutoff: 1500 },
        // Osc 3: Metallic Pluck
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 0, gain: 0.5, attack: 0.005, decay: 0.08, sustain: 0.0, release: 0.1 },
        {
            spread: 0.4,
            reverbType: 'plate',
            reverbMix: 0.35,
            delayMix: 0.25,
            delayTime: 0.2,
            delayFeedback: 0.3,
            resonatorMix: 0.6,
            resonatorSweep: 0.85,
            modMatrix: [
                { id: 'sitar-jawari', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 45 },
                { id: 'sympathetic-shimmer', enabled: true, source: 'lfo1', target: 'osc2_gain', amount: 15 }
            ],
            osc1: { ...defaultDisabledOsc, enabled: true, waveform: WaveformType.SAWTOOTH, lfoRate: 7, lfoDepth: 0, lfoTarget: 'none', filterType: 'bandpass', filterCutoff: 2200, filterResonance: 6.0, attack: 0.02, decay: 0.4, sustain: 0.6, release: 3.0 } 
        }
    ),
    // Glass Harp - Ethereal, rubbed glass sound
    p("Glass Harp", "Plucked",
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, attack: 0.05, decay: 1.0, sustain: 0.7, release: 2.5 },
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.4, attack: 0.1, decay: 1.5, sustain: 0.6, release: 3.0 },
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1902, gain: 0.2, attack: 0.2, decay: 2.0, sustain: 0.4, release: 3.0 },
        { 
            spread: 0.6, 
            reverbType: 'shimmer', 
            reverbMix: 0.7, 
            delayMix: 0.3,
            delayTime: 0.4
        }
    ),
    p("Classic Harp", "Plucked", 
        // Osc 1: The "String" body
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.005, decay: 0.5, sustain: 0.5, release: 3.0, filterCutoff: 400, filterResonance: 1.0 }, 
        // Osc 2: Fundamental reinforcement
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, attack: 0.005, decay: 0.8, sustain: 0.6, release: 3.5 }, 
        // Osc 3: Transient/Harmonic
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.2, attack: 0.005, decay: 0.15, sustain: 0.0, release: 0.15 }, 
        { 
            spread: 0.5, 
            reverbType: 'room', 
            reverbMix: 0.25, 
            delayMix: 0.15,
            modMatrix: [
                { id: 'pluck-cut', enabled: true, source: 'env3', target: 'osc1_cutoff', amount: 75 }
            ] 
        }
    ),
    p("Koto Synth", "Plucked", { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, decay: 0.4, sustain: 0.4, release: 1.5, filterCutoff: 3000 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 700, gain: 0.4, decay: 0.5, sustain: 0.3, release: 1.5 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.2, decay: 0.3, sustain: 0.2, release: 1.0 }, { spread: 0.3, reverbType: 'room', reverbMix: 0.2 }),
    p("Guitar Pluck", "Plucked", 
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.005, decay: 0.8, sustain: 0.4, release: 2.0, filterCutoff: 600, filterResonance: 0.5 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.3, attack: 0.005, decay: 0.5, sustain: 0.3, release: 1.5, filterCutoff: 800 }, 
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 1200, gain: 0.15, decay: 0.2, sustain: 0 }, 
        { spread: 0.2, reverbType: 'room', reverbMix: 0.3, delayMix: 0.2, modMatrix: [{ id: 'gtr-cut', enabled: true, source: 'env1', target: 'osc1_cutoff', amount: 60 }] }
    ),
    p("Kalimba Dream", "Plucked", { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 0.6, sustain: 0.6, release: 1.5 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 1200, gain: 0.3, decay: 0.4, sustain: 0.3, release: 1.2 }, { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, decay: 0.2, sustain: 0 }, { spread: 0.4, reverbType: 'plate', reverbMix: 0.25 })
];

const STRINGS_PATCHES = [
    // Solo Violin - Expressive, bowed texture with bite
    p("Solo Violin", "Strings",
        // Osc 1: Body (Sawtooth, Lowpass) with Vibrato
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.7, attack: 0.3, decay: 0.5, sustain: 0.9, release: 0.5, filterCutoff: 2000, lfoWaveform: 'sine', lfoTarget: 'pitch', lfoRate: 5.5, lfoDepth: 8, lfoDelay: 0.4 },
        // Osc 2: Resonance (Bandpass)
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.4, coarseDetune: 0, fineDetune: 3, filterType: 'bandpass', filterCutoff: 1200, filterResonance: 3.0 },
        // Osc 3: Bow Noise
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.15, filterType: 'bandpass', filterCutoff: 4000, filterResonance: 1, attack: 0.1, decay: 0.2, sustain: 0.1 },
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

const ATMOSPHERE_PATCHES = [
    // Bagpipe (Relocated and Tuned for Drone)
    p("Bagpipe", "Drone",
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.05, decay: 0.1, sustain: 1.0, release: 0.2, fineDetune: -10, filterCutoff: 3000, filterResonance: 2.0 }, // Bright Chanter 1
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.05, decay: 0.1, sustain: 1.0, release: 0.2, fineDetune: 10, filterCutoff: 3000, filterResonance: 1.5 }, // Bright Chanter 2
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.6, attack: 0.1, sustain: 1.0, release: 0.5, filterCutoff: 800 }, // Drone
        { spread: 0.4, reverbType: 'plate', reverbMix: 0.3, compressorThreshold: -10 }
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
    p("Dark Drone", "Atmosphere", { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2400, gain: 0.5, filterCutoff: 150, filterResonance: 10, lfoTarget: 'filter', lfoRate: 0.05, lfoDepth: 40 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.4, filterCutoff: 200, filterResonance: 8, lfoTarget: 'filter', lfoRate: 0.07, lfoDepth: 30 }, { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2405, gain: 0.3, filterCutoff: 100 }, { spread: 0.7, reverbType: 'cathedral', reverbMix: 0.9, compressorThreshold: -25 }),
    p("Swamp", "Atmosphere", { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.6, lfoTarget: 'pitch', lfoRate: 6, lfoDepth: 20, filterCutoff: 600 }, { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 700, gain: 0.4, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 15 }, { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.3, filterCutoff: 400 }, { spread: 0.6, reverbType: 'plate', reverbMix: 0.6 }),
    // Industrial - Rhythmic, metallic, gritty (Updated)
    p("Industrial", "Atmosphere",
        // Osc 1: Deep Drone
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: -2400, gain: 0.7, filterCutoff: 150, filterResonance: 2 },
        // Osc 2: Rhythmic Clank (Square LFO on Filter)
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.5, filterType: 'bandpass', filterCutoff: 800, filterResonance: 5, lfoWaveform: 'square', lfoRate: 6, lfoDepth: 60, lfoTarget: 'filter' },
        // Osc 3: Steam/Noise (Saw LFO on Amp)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.3, filterType: 'highpass', filterCutoff: 3000, lfoWaveform: 'sawtooth', lfoRate: 0.5, lfoDepth: 100, lfoTarget: 'tremolo' },
        { spread: 0.4, reverbType: 'plate', reverbMix: 0.6, compressorThreshold: -15, compressorRatio: 8 }
    ),
    // Glass Texture - High pitch, crystalline, fragile, shimmering (Updated)
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

const ETHEREAL_PADS = [
    p("Cloud Nine", "Pads", 
        // Osc 1: Warm foundation
        { enabled: true, waveform: WaveformType.SINE, gain: 0.6, attack: 1.5, decay: 3.0, sustain: 0.8, release: 4.0 }, 
        // Osc 2: Detuned texture
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: 0, fineDetune: 10, gain: 0.4, attack: 2.0, decay: 3.0, sustain: 0.7, release: 4.0 }, 
        // Osc 3: Airy shimmer (+2 octaves)
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: 2400, gain: 0.2, attack: 3.0, release: 5.0, lfoTarget: 'tremolo', lfoRate: 6, lfoDepth: 40 }, 
        { spread: 0.8, reverbType: 'shimmer', reverbMix: 0.7, reverbSize: 6.0, delayMix: 0.3 }
    ),
    p("Warm Blanket", "Pads", 
        // Osc 1: Filtered Triangle
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.7, attack: 0.8, sustain: 1.0, release: 2.0, filterType: 'lowpass', filterCutoff: 600, lfoTarget: 'filter', lfoRate: 0.2, lfoDepth: 20 }, 
        // Osc 2: Sub Sine
        { enabled: true, waveform: WaveformType.SINE, coarseDetune: -1200, gain: 0.5, attack: 1.0, sustain: 1.0, release: 2.0 }, 
        // Osc 3: Wide detuned saw (quiet)
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 10, gain: 0.15, filterType: 'lowpass', filterCutoff: 1000 }, 
        { spread: 0.6, reverbType: 'hall', reverbMix: 0.5, reverbDamping: 0.8 } // Dark reverb
    ),
    p("Angel Choir", "Pads", 
        // Osc 1: Formant-ish Saw (Bandpass)
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.6, attack: 1.0, sustain: 0.9, release: 2.0, filterType: 'bandpass', filterCutoff: 800, filterResonance: 4.0 }, 
        // Osc 2: Higher Formant
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.4, attack: 1.0, sustain: 0.9, release: 2.0, filterType: 'bandpass', filterCutoff: 1500, filterResonance: 3.0, coarseDetune: 5 }, 
        // Osc 3: Air
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.1, filterType: 'highpass', filterCutoff: 4000 }, 
        { spread: 0.7, reverbType: 'cathedral', reverbMix: 0.8, resonatorMix: 0.3, resonatorSweep: 0.5 }
    ),
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

const ETHEREAL_LEADS = [
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
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.2, decay: 0.1, sustain: 0, filterType: 'highpass', filterCutoff: 5000 }, 
        { spread: 0.3, reverbType: 'plate', delayMix: 0.4, delayTime: 0.3, delayFeedback: 0.4 }
    ),
    p("Ghost Flute", "Leads", 
        // Osc 1: Triangle Body
        { enabled: true, waveform: WaveformType.TRIANGLE, gain: 0.8, attack: 0.1, release: 0.5, lfoTarget: 'pitch', lfoRate: 5, lfoDepth: 10, lfoDelay: 0.5 }, 
        // Osc 2: Breath (Noise Bandpass)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.3, filterType: 'bandpass', filterCutoff: 2000, filterResonance: 3.0, attack: 0.2 }, 
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
        { spread: 0.2, delayMix: 0.4, reverbType: 'room', compressorThreshold: -15, compressorRatio: 8 }
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

const ETHEREAL_BASS = [
    p("Void Bass", "Bass", 
        // Osc 1: Sub Sine
        { enabled: true, waveform: WaveformType.SINE, gain: 0.9, attack: 0.1, release: 0.5 }, 
        // Osc 2: Noise Texture (Highpass)
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.2, filterType: 'highpass', filterCutoff: 4000, lfoTarget: 'tremolo', lfoRate: 8, lfoDepth: 30 }, 
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

const ETHEREAL_KEYS = [
    p("Dream Rhodes", "Keys", 
        // Osc 1: Tine
        { enabled: true, waveform: WaveformType.SINE, gain: 0.7, decay: 2.0, sustain: 0.2, lfoTarget: 'tremolo', lfoRate: 4, lfoDepth: 20 }, 
        // Osc 2: Body
        { enabled: true, waveform: WaveformType.TRIANGLE, coarseDetune: -1200, gain: 0.3, decay: 1.5, sustain: 0.1 }, 
        // Osc 3: Mechanical noise
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.05, decay: 0.1, sustain: 0, filterType: 'highpass', filterCutoff: 3000 }, 
        { spread: 0.6, reverbType: 'hall', reverbMix: 0.5, delayMix: 0.3, stereoPanSpeed: 0.5, stereoPanDepth: 0.4 }
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
        { enabled: true, waveform: WaveformType.NOISE, gain: 0.2, decay: 0.05, sustain: 0 }, 
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

const ETHEREAL_MALLETS = [
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

// --- BRASS PATCHES (Renamed from Voice, Generalized Parameters) ---
// Uses the ResonatorBank (Formants) to simulate brass body impulses
const BRASS_PATCHES = [
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
    // Less resonator, more detuned saws (simulated via glottal+width in this engine constraints, or standard)
    // Using Standard waveforms for 80s feel, ignoring resonator
    p("Polysynth Brass", "Brass",
        { enabled: true, waveform: WaveformType.SAWTOOTH, gain: 0.5, attack: 0.15, decay: 0.2, sustain: 0.7, release: 0.6, filterType: 'lowpass', filterCutoff: 1200, filterResonance: 0.3 },
        { enabled: true, waveform: WaveformType.SAWTOOTH, coarseDetune: 5, gain: 0.5, filterType: 'lowpass', filterCutoff: 1200 }, 
        { enabled: true, waveform: WaveformType.SQUARE, coarseDetune: -1200, gain: 0.25, filterType: 'lowpass', filterCutoff: 800 },
        { spread: 0.7, reverbType: 'plate', reverbMix: 0.4, portamento: 0.15 }
    ),
    
    // 5. French Horn
    // Warm, distant
    p("French Horn", "Brass",
        { enabled: true, waveform: WaveformType.GLOTTAL, gain: 0.55, attack: 0.4, sustain: 0.9, release: 0.8, filterType: 'lowpass', filterCutoff: 450 },
        { enabled: true, waveform: WaveformType.SINE, gain: 0.4, filterType: 'peak', filterCutoff: 400, filterResonance: 2.5 }, 
        { enabled: true, waveform: WaveformType.SINE, gain: 0.3, filterType: 'peak', filterCutoff: 900, filterResonance: 1.5 }, 
        { spread: 0.4, reverbType: 'hall', reverbMix: 0.5, resonatorMix: 0.6, resonatorSweep: 0.3 }
    )
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
    ...DIAGNOSTIC_PATCHES,
    ...PLUCKED_PATCHES,
    ...STRINGS_PATCHES,
    ...ATMOSPHERE_PATCHES,
    ...ETHEREAL_PADS,
    ...ETHEREAL_LEADS,
    ...ETHEREAL_BASS,
    ...ETHEREAL_KEYS,
    ...ETHEREAL_MALLETS,
    ...BRASS_PATCHES // Replaced VOICE_PATCHES
];

export const DEFAULT_NORMAL_PRESET = preservedAnalogStrings; 
export const DEFAULT_STRUM_PRESET = PLUCKED_PATCHES[0]; 
export const DEFAULT_LATCH_PRESET = preservedNoiseWash;
export const DEFAULT_BRASS_PRESET = BRASS_PATCHES[0]; // New Default for Brass
export const DEFAULT_ARP_PRESET = PLUCKED_PATCHES[0]; // Arp Service fallback
export const DEFAULT_PRESET = preservedAnalogStrings;
