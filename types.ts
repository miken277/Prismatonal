
export enum LimitType {
  LIMIT_3 = 3,
  LIMIT_5 = 5,
  LIMIT_7 = 7,
  LIMIT_11 = 11,
  LIMIT_13 = 13,
}

export enum WaveformType {
  SINE = 'sine',
  SQUARE = 'square',
  SAWTOOTH = 'sawtooth',
  TRIANGLE = 'triangle',
}

export enum ButtonShape {
  CIRCLE = '50%',
  DIAMOND = '0%',
}

export interface LimitColorMap {
  [key: number]: string;
}

export interface ChordNode {
  id: string; // Coordinate key
  n: number;
  d: number;
}

export interface ChordDefinition {
  id: string; // "A", "B", etc.
  label: string;
  color: string;
  nodes: ChordNode[];
  visible: boolean; // Is shortcut on screen?
  position: { x: number; y: number }; // Relative position or legacy absolute
}

export interface XYPos {
  x: number;
  y: number;
}

export interface AppSettings {
  // Individual depths (Steps from center)
  limitDepths: {
    3: number;
    5: number;
    7: number;
    11: number;
    13: number;
  };

  // Individual complexity limits (Max Numerator/Denominator per axis)
  limitComplexities: {
    3: number;
    5: number;
    7: number;
    11: number;
    13: number;
  };
  
  // Increase Depth Settings
  showIncreaseDepthButton: boolean;
  centerResetsDepth: boolean;

  // Chords
  savedChords: ChordDefinition[];
  chordShortcutSizeScale: number; // 0.33 to 1.0 relative to main buttons
  chordsAlwaysRelatch: boolean; // If true, activating a chord re-triggers notes even if playing
  
  // Visible toggle for lower limits (View only)
  hiddenLimits: number[]; 
  
  layerOrder: number[]; // Array of limit numbers, index 0 = back, last index = front
  
  // Audio Settings
  baseFrequency: number; // Hz for 1/1

  // Voice Leading / Focus Mode
  isVoiceLeadingEnabled: boolean;
  voiceLeadingStrength: number; // 0 to 1, higher means stricter falloff
  
  // Voice Leading Visuals
  isVoiceLeadingAnimationEnabled: boolean;
  voiceLeadingAnimationSpeed: number; // seconds
  voiceLeadingReverseDir: boolean; // Reverse the direction of the flow animation
  voiceLeadingGlowAmount: number; // 0.0 to 1.0 (Controls width/intensity of the lobe)
  
  // Momentum is deprecated/greyed out in favor of Latch Mode
  isMomentumEnabled: boolean; 

  // Latch Settings
  isLatchModeEnabled: boolean;
  latchShellLimit: number; // 1 = Octaves, 2 = Fifths, etc.
  latchedZoomScale: number; // Scale factor for active nodes (1.0 to 2.0)

  buttonSizeScale: number; // 0.5 to 2.0
  buttonSpacingScale: number; // 0.5 to 5.0
  latticeAspectRatio: number; // 0.5 (Stretched X) to 2.0 (Squished X)
  canvasSize: number; // Width/Height of the scrollable area in pixels (e.g. 3000, 5000)
  buttonShape: ButtonShape;
  colors: LimitColorMap;
  isPitchBendEnabled: boolean;
  isPitchSnapEnabled: boolean;
  polyphony: number;
  pitchOffLocked: boolean;
  volumeLocked: boolean;

  // Visuals - Rainbow
  isRainbowModeEnabled: boolean;
  rainbowSaturation: number; // 0-100
  rainbowBrightness: number; // 0-100
  rainbowOffset: number; // 0-360 (Hue shift)
  isColoredIlluminationEnabled: boolean;

  // UI Relocation
  uiUnlocked: boolean;
  uiPositions: {
    volume: XYPos;
    panic: XYPos;
    off: XYPos;
    center: XYPos;
    depth: XYPos;
    chords: XYPos;
    layers: XYPos;
  };
}

export interface OscillatorConfig {
  enabled: boolean;
  waveform: WaveformType;
  coarseDetune: number; // Cents -1200 to 1200
  fineDetune: number; // Cents -50 to 50
  gain: number; // 0 to 1 (Mix)
  
  // Envelope
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  
  // Filter
  filterCutoff: number; // Hz
  filterResonance: number; // Q factor

  // LFO
  lfoRate: number; // Hz
  lfoDepth: number; // Amount 0-100
  lfoTarget: 'none' | 'pitch' | 'filter' | 'tremolo';
}

export interface SynthPreset {
  id: number;
  name: string;
  
  osc1: OscillatorConfig;
  osc2: OscillatorConfig;
  osc3: OscillatorConfig;
  
  // Master Gain for the preset
  gain: number; 

  // Effects (Global)
  reverbMix: number; // 0 to 1
  delayMix: number; // 0 to 1
  delayTime: number; // Seconds
  delayFeedback: number; // 0 to 0.95

  // Dynamics (Compressor/Limiter) (Global)
  compressorThreshold: number; // dB (-60 to 0)
  compressorRatio: number; // 1 to 20
  compressorRelease: number; // seconds
}

export interface LatticeNode {
  id: string; // Coordinate key "0,0,0,0,0:oct"
  ratio: number; // Absolute Frequency multiplier (including octave)
  n: number; // Numerator (adjusted for octave)
  d: number; // Denominator (adjusted for octave)
  label: string; 
  x: number; // Screen X
  y: number; // Screen Y
  limitTop: number; 
  limitBottom: number;
  maxPrime: number; // For Z-sorting
  coords: number[]; // [p3, p5, p7, p11, p13]
  octave: number; // -2, -1, 0, 1, 2
}

export interface LatticeLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  limit: number;
  sourceId: string;
  targetId: string;
}

export interface ActiveVoice {
  id: string; // Pointer ID or Node ID
  nodeId?: string;
  stop: () => void;
  setDetune: (cents: number) => void;
}

export interface GenerationOrigin {
  coords: number[];
  octave: number;
}
