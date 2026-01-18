
import { AppSettings, ButtonShape, ChordDefinition, LimitColorMap, ArpeggioDefinition, KeyMappings, BackgroundPreset, SynthPreset } from '../types';
import { generateInitPatch } from '../patchHelpers';
import { preservedAnalogStrings, STRINGS_PATCHES, PLUCKED_PATCHES } from '../bank_strings';
import { ETHEREAL_KEYS, ETHEREAL_MALLETS } from '../bank_keys';
import { ATMOSPHERE_PATCHES, BRASS_PATCHES, preservedNoiseWash, preservedDeepOcean } from '../bank_winds';
import { ETHEREAL_PADS, ETHEREAL_LEADS, ETHEREAL_BASS, DIAGNOSTIC_PATCHES } from '../bank_synth';
import { PERCUSSION_PATCHES } from '../bank_percussion';

// Re-export Reverb Defaults from helpers for other consumers
export { REVERB_DEFAULTS } from '../patchHelpers';

// Lattice Constants
export const GRID_CELL_SIZE = 100; 
export const VIRTUAL_SIZE = 40000; 

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
    5: '#a855f7', // Keys (Purple)
    6: '#ec4899', // Percussion (Pink)
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
    
    // Patch & Mode Controls
    latch: 'l', 
    sustain: ' ', 
    bend: 'b',
    shift: 'shift', // Added to match types
    modulate: 'm', // Key for Mod mode
    modeDrone: '1',
    modeStrings: '2',
    modePlucked: '3',
    modeBrass: '4', 
    modeKeys: '5', 
    modePercussion: '6', 
    synth: 'p', // Changed from m

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
        shift: { x: w - 80 - margin, y: h - 430 }, // Added shift
        mod: { x: w - 80 - margin, y: h - 480 }, // Moved mod up to accommodate shift
        center: { x: margin, y: h - 48 - margin },
        depth: { x: margin + 60, y: h - 48 - margin },
        decreaseDepth: { x: margin + 120, y: h - 48 - margin },
        chords: { x: margin + 180, y: h - 48 - margin },
        layers: { x: w - 90 - margin, y: margin + 60 },
        arpeggioBar: { x: margin, y: margin },
        instruments: { x: margin, y: margin + 60 },
        complexity: { x: margin, y: margin + 60 } 
    };
};

const DEFAULT_UI_POSITIONS = getDefaults();

export const DEFAULT_UI_SIZES = {
    volume: { width: 600, height: 160 }, 
    arpeggioBar: { width: 760 }
};

// Optimized SVG Patterns (Base64 Encoded)
// 1. Cosmic Geometry: Concentric circles with radial lines
const COSMIC_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMDAnIGhlaWdodD0nMjAwJyB2aWV3Qm94PScwIDAgMjAwIDIwMCc+PHJlY3Qgd2lkdGg9JzIwMCcgaGVpZ2h0PScyMDAnIGZpbGw9JyMwZjE3MmEnLz48ZyBvcGFjaXR5PScwLjQnPjxjaXJjbGUgY3g9JzEwMCcgY3k9JzEwMCcgcj0nOTAnIGZpbGw9Im5vbmUiIHN0cm9rZT0nIzM4YmRmOCcgc3Ryb2tlLXdpZHRoPScxJy8+PGNpcmNsZSBjeD0nMTAwJyBjeT0nMTAwJyByPSc3MCcgZmlsbD0ibm9uZSIgc3Ryb2tlPScjODE4Y2Y4JyBzdHJva2Utd2lkdGg9JzEnLz48Y2lyY2xlIGN4PScxMDAnIGN5PScxMDAnIHI9JzUwJyBmaWxsPSJub25lIiBzdHJva2U9JyNjMDg0ZmMnIHN0cm9rZS13aWR0aD0nMScvPjxjaXJjbGUgY3g9JzEwMCcgY3k9JzEwMCcgcj0nMzAnIGZpbGw9Im5vbmUiIHN0cm9rZT0nI2Y0NzJiNicgc3Ryb2tlLXdpZHRoPScxJy8+PC9nPjxwYXRoIGQ9J00wIDAgTDIwMCAyMDAgTTIwMCAwIEwwIDIwMCBNMTAwIDAgTTEwMCAyMDAgMTAwIDEwMCBMMjAwIDEwMCcgc3Ryb2tlPScjZmZmZmZmJyBzdHJva2Utd2lkdGg9JzAuNScgb3BhY2l0eT0nMC4yJy8+PC9zdmc+";

// 2. Neural Grid: Connected nodes on a dark background
const NEURAL_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJyB2aWV3Qm94PScwIDAgMTAwIDEwMCc+PHJlY3Qgd2lkdGg9JzEwMCcgaGVpZ2h0PScxMDAnIGZpbGw9JyMwZjE3MmEnLz48cGF0aCBkPSdNMCA1MCBMMTAwIDUwIE01MCAwIEw1MCAxMDAnIHN0cm9rZT0nIzM4YmRmOCcgc3Ryb2tlLXdpZHRoPScxJyBvcGFjaXR5PScwLjInLz48Y2lyY2xlIGN4PScxMDAnIGN5PScxMDAnIHI9JzUwJyBmaWxsPScjMzhiZGY4JyBvcGFjaXR5PScwLjUnLz48L3N2Zz4=";

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
  enabledIdentities: [1, 3, 5, 7, 9, 11, 13, 15], 
  latticeMaxDistance: 1, 
  isModulationModeActive: false,
  modulationPath: [{ coords: [0,0,0,0,0,0,0], octave: 0 }], // Start at absolute 1/1
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
  enableOversampling: false, 
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
  lineBrighteningWidth: 1.0, 
  isMomentumEnabled: false, 
  latchedZoomScale: 1.3,
  buttonSizeScale: 1.26, 
  buttonSpacingScale: 1.89, 
  latticeAspectRatio: 0.7, 
  canvasSize: 2000, 
  buttonShape: ButtonShape.CIRCLE,
  colors: { ...DEFAULT_COLORS },
  nodeTextSizeScale: 1.0,
  showFractionBar: false,
  isPitchBendEnabled: false, 
  isShiftModeActive: false, // Ensure this property exists
  shiftAutoExpandsDepth: true, // Ensure this property exists
  isSustainEnabled: false, 
  isStrumEnabled: false, 
  chordsAlwaysRelatch: false, 
  isPitchSnapEnabled: true,
  polyphony: 8, 
  pitchOffLocked: false,
  volumeLocked: false,
  
  backgroundMode: 'image', 
  backgroundPresets: DEFAULT_BACKGROUNDS,
  solidColor: '#0f172a', 
  gradientColorStart: '#0f172a',
  gradientColorEnd: '#1e1b4b', 
  gradientType: 'radial',
  gradientAngle: 180,
  backgroundImageData: DEFAULT_BACKGROUNDS[0].data, 
  backgroundYOffset: 0,
  backgroundTiling: true, 
  bgImageGamma: 1.0,
  bgImageTint: '#000000',
  bgImageTintStrength: 0.3, 
  
  isOverlayEnabled: false,
  overlayBlendMode: 'normal',
  overlayOpacity: 0.5,
  overlayType: 'solid',
  overlayColorStart: '#000000',
  overlayColorEnd: '#000000',
  overlayGradientType: 'linear',
  overlayGradientAngle: 180,
  
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
  enableAudioRecording: false, 

  uiUnlocked: false,
  uiScale: 1.0, 
  uiEdgeMargin: 4, 
  uiPositions: DEFAULT_UI_POSITIONS,
  uiSizes: DEFAULT_UI_SIZES,
};

// Create User Bank with 100 Empty Slots
export const DEFAULT_USER_BANK: SynthPreset[] = Array.from({ length: 100 }).map((_, i) => ({
    ...generateInitPatch(`User Slot ${i + 1}`, `user-${i}`),
    category: 'User'
}));

// Create a Dummy Header Preset for visual grouping
const MALLETS_HEADER: SynthPreset = {
    ...generateInitPatch("— Mallets —", "header-mallets"),
    category: 'Percussion',
    isHeader: true
};

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
    ...BRASS_PATCHES,
    ...PERCUSSION_PATCHES, // Drums first
    MALLETS_HEADER,
    ...ETHEREAL_MALLETS.map(p => ({ ...p, category: 'Percussion' })) // Merge Mallets into Percussion category
];

export const DEFAULT_NORMAL_PRESET = preservedAnalogStrings; 
export const DEFAULT_STRUM_PRESET = PLUCKED_PATCHES[0]; 
export const DEFAULT_LATCH_PRESET = preservedNoiseWash;
export const DEFAULT_BRASS_PRESET = BRASS_PATCHES[0]; 
export const DEFAULT_KEYS_PRESET = ETHEREAL_KEYS[0]; 
export const DEFAULT_PERCUSSION_PRESET = ETHEREAL_MALLETS[0]; 
export const DEFAULT_PRESET = preservedAnalogStrings;
