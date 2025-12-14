
import { AppSettings, ButtonShape, ChordDefinition, LimitColorMap, OscillatorConfig, SynthPreset, WaveformType } from './types';

export const DEFAULT_COLORS: LimitColorMap = {
  1: '#EF4444', // Red (Unity)
  3: '#EAB308', // Yellow (3-Limit)
  5: '#3B82F6', // Blue (5-Limit)
  7: '#22C55E', // Green (7-Limit)
  11: '#A855F7', // Purple (11-Limit)
  13: '#F97316', // Orange (13-Limit)
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
      position: { x: 0, y: 0 } // Positions will be managed dynamically if 0,0
    });
  }
  return slots;
};

// UI Dimensions Constants
export const MARGIN_3MM = 10; 
export const GAP_5MM = 20;
export const SCROLLBAR_WIDTH = 12; 

// Helper to get defaults
const getDefaults = () => {
    // Check for window existence for SSR safety
    const w = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;

    // Component Dimensions Estimates
    const LAYERS_HEIGHT = 310; 
    const LAYERS_WIDTH = 90; 
    
    // Top Bar Bottom
    const TOP_BAR_BOTTOM = MARGIN_3MM + 40; 
    // Bottom Bar Top: Height - (80px Panic + 10px Margin + 12px Scroll)
    const BOTTOM_BAR_TOP = h - (80 + MARGIN_3MM + SCROLLBAR_WIDTH);

    // Calculate vertical center for Layers
    const verticalCenterY = TOP_BAR_BOTTOM + ((BOTTOM_BAR_TOP - TOP_BAR_BOTTOM) / 2) - (LAYERS_HEIGHT / 2);

    // Panic Position (Bottom Right)
    const panicX = w - 80 - MARGIN_3MM - SCROLLBAR_WIDTH;
    const panicY = h - 80 - MARGIN_3MM - SCROLLBAR_WIDTH;

    return {
        volume: { 
            x: (w / 2) - 80, // Centered (Width 160)
            y: MARGIN_3MM 
        },
        panic: { 
            x: panicX, 
            y: panicY 
        },
        off: {
            x: panicX,
            y: panicY - 80 - GAP_5MM // Placed above Panic with 5mm gap
        },
        center: { 
            // 48px width
            x: MARGIN_3MM, 
            y: h - 48 - MARGIN_3MM - SCROLLBAR_WIDTH 
        },
        depth: { 
            // 48px width + 12px gap from Center
            x: MARGIN_3MM + 60, 
            y: h - 48 - MARGIN_3MM - SCROLLBAR_WIDTH 
        },
        chords: { 
            // 60px offset from Depth
            x: MARGIN_3MM + 120, 
            y: h - 48 - MARGIN_3MM - SCROLLBAR_WIDTH 
        },
        layers: { 
            // Positioned to avoid scrollbar overlap (Right Edge)
            x: w - LAYERS_WIDTH - MARGIN_3MM - SCROLLBAR_WIDTH, 
            // Equidistant between Settings (Top) and Off (Bottom)
            y: Math.max(TOP_BAR_BOTTOM, verticalCenterY) 
        }
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

  hiddenLimits: [7, 11, 13],
  // Order from back to front.
  layerOrder: [13, 11, 7, 5, 3, 1], 
  
  baseFrequency: 196.00, // G3

  isVoiceLeadingEnabled: true, 
  voiceLeadingStrength: 0.3, 
  
  isVoiceLeadingAnimationEnabled: true,
  voiceLeadingReverseDir: false,
  voiceLeadingAnimationSpeed: 2.0,
  voiceLeadingGlowAmount: 0.5,
  
  isMomentumEnabled: false, // Disabled by default
  
  isLatchModeEnabled: true, // Enabled by default per request
  latchShellLimit: 5, // Default allows reasonable complexity to be latched
  latchedZoomScale: 1.3,

  buttonSizeScale: 0.8, // Reduced from 1.0 per request
  buttonSpacingScale: 1.5, 
  latticeAspectRatio: 0.7, // "Wide" default per request
  canvasSize: 2000, 
  buttonShape: ButtonShape.CIRCLE,
  colors: { ...DEFAULT_COLORS },
  isPitchBendEnabled: true,
  isPitchSnapEnabled: true,
  polyphony: 10,
  pitchOffLocked: false,
  volumeLocked: false,

  // Rainbow Defaults
  isRainbowModeEnabled: true, // Enabled by default
  rainbowSaturation: 50, // 50% default
  rainbowBrightness: 50, // 50% default
  rainbowOffset: 0,
  isColoredIlluminationEnabled: true, // Enabled by default per request
  
  // UI
  uiUnlocked: false,
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
    filterResonance: 0,
    lfoRate: 1,
    lfoDepth: 0,
    lfoTarget: 'none'
};

export const PRESETS: SynthPreset[] = [
  {
    id: 1,
    name: "Deep Pad",
    gain: 0.5,
    osc1: {
        enabled: true,
        waveform: WaveformType.TRIANGLE,
        coarseDetune: 0, fineDetune: 0, gain: 1.0,
        attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.5,
        filterCutoff: 1200, filterResonance: 1,
        lfoRate: 0.5, lfoDepth: 10, lfoTarget: 'filter'
    },
    osc2: {
        enabled: true,
        waveform: WaveformType.SINE,
        coarseDetune: 0, fineDetune: -6, gain: 0.6,
        attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.5,
        filterCutoff: 1200, filterResonance: 1,
        lfoRate: 0.5, lfoDepth: 10, lfoTarget: 'filter'
    },
    osc3: { ...defaultDisabledOsc },
    reverbMix: 0.5,
    delayMix: 0.3,
    delayTime: 0.4,
    delayFeedback: 0.3,
    compressorThreshold: -40,
    compressorRatio: 12,
    compressorRelease: 0.25
  },
  {
    id: 2,
    name: "Glassy",
    gain: 0.45,
    osc1: {
        enabled: true,
        waveform: WaveformType.SINE,
        coarseDetune: 0, fineDetune: 0, gain: 1.0,
        attack: 0.1, decay: 2.0, sustain: 0.4, release: 3.0,
        filterCutoff: 3000, filterResonance: 0,
        lfoRate: 4, lfoDepth: 3, lfoTarget: 'pitch'
    },
    osc2: {
        enabled: true,
        waveform: WaveformType.SINE,
        coarseDetune: 700, fineDetune: -4, gain: 0.4,
        attack: 0.1, decay: 2.0, sustain: 0.4, release: 3.0,
        filterCutoff: 3000, filterResonance: 0,
        lfoRate: 4, lfoDepth: 3, lfoTarget: 'pitch'
    },
    osc3: { ...defaultDisabledOsc },
    reverbMix: 0.6,
    delayMix: 0.4,
    delayTime: 0.35,
    delayFeedback: 0.4,
    compressorThreshold: -20,
    compressorRatio: 8,
    compressorRelease: 0.3
  },
  {
    id: 3,
    name: "Warm Strings",
    gain: 0.35,
    osc1: {
        enabled: true,
        waveform: WaveformType.SAWTOOTH,
        coarseDetune: 0, fineDetune: 0, gain: 1.0,
        attack: 0.8, decay: 1.0, sustain: 0.7, release: 1.2,
        filterCutoff: 1800, filterResonance: 0.5,
        lfoRate: 3, lfoDepth: 20, lfoTarget: 'tremolo'
    },
    osc2: {
        enabled: true,
        waveform: WaveformType.SAWTOOTH,
        coarseDetune: 0, fineDetune: -8, gain: 0.4,
        attack: 0.8, decay: 1.0, sustain: 0.7, release: 1.2,
        filterCutoff: 1800, filterResonance: 0.5,
        lfoRate: 3, lfoDepth: 20, lfoTarget: 'tremolo'
    },
    osc3: { ...defaultDisabledOsc },
    reverbMix: 0.4,
    delayMix: 0.1,
    delayTime: 0.2,
    delayFeedback: 0.1,
    compressorThreshold: -15,
    compressorRatio: 4,
    compressorRelease: 0.2
  },
  {
    id: 4,
    name: "Ethereal Swell",
    gain: 0.45,
    osc1: {
        enabled: true,
        waveform: WaveformType.TRIANGLE,
        coarseDetune: 0, fineDetune: 0, gain: 1.0,
        attack: 2.0, decay: 1.0, sustain: 1.0, release: 2.5,
        filterCutoff: 800, filterResonance: 2,
        lfoRate: 0.2, lfoDepth: 40, lfoTarget: 'filter'
    },
    osc2: {
        enabled: true,
        waveform: WaveformType.TRIANGLE,
        coarseDetune: 0, fineDetune: -5, gain: 0.6,
        attack: 2.0, decay: 1.0, sustain: 1.0, release: 2.5,
        filterCutoff: 800, filterResonance: 2,
        lfoRate: 0.2, lfoDepth: 40, lfoTarget: 'filter'
    },
    osc3: { ...defaultDisabledOsc },
    reverbMix: 0.7,
    delayMix: 0.5,
    delayTime: 0.5,
    delayFeedback: 0.5,
    compressorThreshold: -30,
    compressorRatio: 10,
    compressorRelease: 0.5
  },
  {
    id: 5,
    name: "Retro Lead",
    gain: 0.3,
    osc1: {
        enabled: true,
        waveform: WaveformType.SQUARE,
        coarseDetune: 0, fineDetune: 0, gain: 1.0,
        attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4,
        filterCutoff: 3500, filterResonance: 2,
        lfoRate: 6, lfoDepth: 4, lfoTarget: 'pitch'
    },
    osc2: {
        enabled: true,
        waveform: WaveformType.SAWTOOTH,
        coarseDetune: 0, fineDetune: -3, gain: 0.4,
        attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4,
        filterCutoff: 3500, filterResonance: 2,
        lfoRate: 6, lfoDepth: 4, lfoTarget: 'pitch'
    },
    osc3: { ...defaultDisabledOsc },
    reverbMix: 0.3,
    delayMix: 0.2,
    delayTime: 0.25,
    delayFeedback: 0.2,
    compressorThreshold: -12,
    compressorRatio: 12,
    compressorRelease: 0.1
  },
  {
    id: 6,
    name: "Crystal Keys",
    gain: 0.5,
    osc1: {
        enabled: true,
        waveform: WaveformType.TRIANGLE,
        coarseDetune: 0, fineDetune: 0, gain: 1.0,
        attack: 0.01, decay: 1.5, sustain: 0.1, release: 2.0,
        filterCutoff: 2500, filterResonance: 0,
        lfoRate: 2, lfoDepth: 15, lfoTarget: 'tremolo'
    },
    osc2: {
        enabled: true,
        waveform: WaveformType.SINE,
        coarseDetune: 1200, fineDetune: -4, gain: 0.3,
        attack: 0.01, decay: 1.5, sustain: 0.1, release: 2.0,
        filterCutoff: 2500, filterResonance: 0,
        lfoRate: 2, lfoDepth: 15, lfoTarget: 'tremolo'
    },
    osc3: { ...defaultDisabledOsc },
    reverbMix: 0.5,
    delayMix: 0.4,
    delayTime: 0.3,
    delayFeedback: 0.4,
    compressorThreshold: -18,
    compressorRatio: 6,
    compressorRelease: 0.3
  },
  {
    id: 7,
    name: "Massive Bass",
    gain: 0.35,
    osc1: {
        enabled: true,
        waveform: WaveformType.SAWTOOTH,
        coarseDetune: 0, fineDetune: 0, gain: 1.0,
        attack: 0.1, decay: 0.4, sustain: 0.9, release: 0.3,
        filterCutoff: 400, filterResonance: 3,
        lfoRate: 1, lfoDepth: 5, lfoTarget: 'filter'
    },
    osc2: {
        enabled: true,
        waveform: WaveformType.SQUARE,
        coarseDetune: 0, fineDetune: -5, gain: 0.8,
        attack: 0.1, decay: 0.4, sustain: 0.9, release: 0.3,
        filterCutoff: 400, filterResonance: 3,
        lfoRate: 1, lfoDepth: 5, lfoTarget: 'filter'
    },
    osc3: { ...defaultDisabledOsc },
    reverbMix: 0.1,
    delayMix: 0.0,
    delayTime: 0.1,
    delayFeedback: 0,
    compressorThreshold: -10,
    compressorRatio: 20,
    compressorRelease: 0.1
  },
  {
    id: 8,
    name: "Sci-Fi Ambience",
    gain: 0.4,
    osc1: {
        enabled: true,
        waveform: WaveformType.SINE,
        coarseDetune: 0, fineDetune: 0, gain: 1.0,
        attack: 1.0, decay: 2.0, sustain: 0.7, release: 4.0,
        filterCutoff: 1500, filterResonance: 5,
        lfoRate: 0.1, lfoDepth: 60, lfoTarget: 'filter'
    },
    osc2: {
        enabled: true,
        waveform: WaveformType.SQUARE,
        coarseDetune: 0, fineDetune: -9, gain: 0.2,
        attack: 1.0, decay: 2.0, sustain: 0.7, release: 4.0,
        filterCutoff: 1500, filterResonance: 5,
        lfoRate: 0.1, lfoDepth: 60, lfoTarget: 'filter'
    },
    osc3: { ...defaultDisabledOsc },
    reverbMix: 0.8,
    delayMix: 0.6,
    delayTime: 0.7,
    delayFeedback: 0.6,
    compressorThreshold: -25,
    compressorRatio: 5,
    compressorRelease: 0.8
  }
];

export const DEFAULT_PRESET = PRESETS[0];
