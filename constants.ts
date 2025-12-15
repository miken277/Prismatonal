
import { AppSettings, ButtonShape, ChordDefinition, LimitColorMap, OscillatorConfig, SynthPreset, WaveformType, LimitVisualsMap, KeyMap, SynthBank } from './types';

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

export const DEFAULT_KEY_MAP: KeyMap = {
    panic: 'Space',
    center: 'KeyC',
    increaseDepth: 'BracketRight', // ]
    decreaseDepth: 'BracketLeft',  // [
    addChord: 'KeyA',
    toggleSynth: 'KeyS',
    toggleSettings: 'Comma',
    volumeUp: 'F12',
    volumeDown: 'F11',
    limit3: 'Digit1',
    limit5: 'Digit2',
    limit7: 'Digit3',
    limit11: 'Digit4',
    limit13: 'Digit5',
    closeModals: 'Escape',
    toggleUI: 'KeyF' // Focus Mode
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
// 3mm physical approx 12px
export const MARGIN_3MM = 12; 
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
    const BOTTOM_BAR_HEIGHT = 48;
    const PANIC_SIZE = 64; // w-16 = 4rem = 64px
    
    // Bottom Safe Area: Margin + Scrollbar
    const BOTTOM_SAFE_Y = h - MARGIN_3MM - SCROLLBAR_WIDTH;

    // Panic Position (Bottom Right)
    const panicX = w - PANIC_SIZE - MARGIN_3MM - SCROLLBAR_WIDTH;
    const panicY = BOTTOM_SAFE_Y - PANIC_SIZE;

    // Off Position (Above Panic)
    const offY = panicY - PANIC_SIZE - GAP_5MM;

    // Latch Position (Above Off)
    const latchY = offY - PANIC_SIZE - GAP_5MM;

    return {
        volume: { 
            x: (w / 2) - 90, // Centered (Width 180)
            y: MARGIN_3MM 
        },
        panic: { 
            x: panicX, 
            y: panicY 
        },
        off: {
            x: panicX,
            y: offY 
        },
        latch: {
            x: panicX,
            y: latchY
        },
        center: { 
            // Navigation Bar (Left)
            x: MARGIN_3MM, 
            y: BOTTOM_SAFE_Y - BOTTOM_BAR_HEIGHT 
        },
        // Legacy keys kept for type compatibility but unused in new grouped layout
        depth: { x: 0, y: 0 },
        decreaseDepth: { x: 0, y: 0 },
        chords: { 
            // Placed to the right of Center Nav (160px width + gap)
            x: MARGIN_3MM + 160 + GAP_5MM, 
            y: BOTTOM_SAFE_Y - BOTTOM_BAR_HEIGHT 
        },
        layers: { 
            // Vertically Centered on Right Side
            // Right edge = Width - LayerWidth - Margin - Scrollbar
            x: w - LAYERS_WIDTH - MARGIN_3MM - SCROLLBAR_WIDTH, 
            y: (h / 2) - (LAYERS_HEIGHT / 2) 
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
  
  autoLatchOnDrag: true, // Enabled by default
  strumDurationMs: 300, // Default Strum Length
  
  isMomentumEnabled: false, // Disabled by default
  
  buttonSizeScale: 0.8, // Reduced from 1.0 per request
  buttonSpacingScale: 1.5, 
  latticeAspectRatio: 0.7, // "Wide" default per request
  canvasSize: 2000, 
  buttonShape: ButtonShape.CIRCLE,
  colors: { ...DEFAULT_COLORS },
  limitVisuals: { ...DEFAULT_LIMIT_VISUALS },
  
  nodeTextSizeScale: 1.0,
  showFractionBar: false,

  isPitchBendEnabled: true,
  isPitchSnapEnabled: true,
  polyphony: 10,
  pitchOffLocked: false,
  volumeLocked: false,

  // Visuals - Rainbow
  isRainbowModeEnabled: true, // Enabled by default
  rainbowSaturation: 50, // 50% default
  rainbowBrightness: 50, // 50% default
  rainbowOffset: 0,
  isColoredIlluminationEnabled: true, // Enabled by default per request
  
  // MIDI Defaults
  midiEnabled: false,
  midiOutputId: null,
  midiPitchBendRange: 24, // High default for smooth microtonality

  // UI Relocation
  uiUnlocked: false,
  uiPositions: DEFAULT_UI_POSITIONS,
  
  keyMap: DEFAULT_KEY_MAP
};

// Helper for default disabled oscillator
const defaultDisabledOsc: OscillatorConfig = {
    enabled: false,
    waveform: WaveformType.SINE,
    coarseDetune: 0,
    fineDetune: 0, // Reset default fine detune to 0
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
    gain: 0.5,
    modMatrix: [],
    osc1: { ...defaultDisabledOsc, enabled: true, gain: 0.5 },
    osc2: { ...defaultDisabledOsc },
    osc3: { ...defaultDisabledOsc },
    spread: 0.5,
    reverbMix: 0.1,
    delayMix: 0,
    delayTime: 0.25,
    delayFeedback: 0.2,
    compressorThreshold: -10,
    compressorRatio: 4,
    compressorRelease: 0.2
});

export const DEFAULT_PRESET: SynthPreset = generateInitPatch("Init Patch", "init");

// --- BANKS DEFINITION ---
const PADS_BANK: SynthPreset[] = [DEFAULT_PRESET];
const LEADS_BANK: SynthPreset[] = [DEFAULT_PRESET];
const BASS_BANK: SynthPreset[] = [DEFAULT_PRESET];
const KEYS_BANK: SynthPreset[] = [DEFAULT_PRESET];
const MALLETS_BANK: SynthPreset[] = [DEFAULT_PRESET];

export const PRESET_BANKS: SynthBank[] = [
    { id: 'pads', name: 'Pads', presets: PADS_BANK },
    { id: 'leads', name: 'Leads', presets: LEADS_BANK },
    { id: 'bass', name: 'Bass', presets: BASS_BANK },
    { id: 'keys', name: 'Keys', presets: KEYS_BANK },
    { id: 'mallets', name: 'Mallets', presets: MALLETS_BANK },
];
