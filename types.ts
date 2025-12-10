
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

export interface AppSettings {
  latticeShells: number; // 1 to 20
  enabledLimits: {
    7: boolean;
    11: boolean;
    13: boolean;
  };
  // Visible toggle for lower limits
  hiddenLimits: number[]; 
  
  layerOrder: number[]; // Array of limit numbers, index 0 = back, last index = front
  
  maxND: number; // Complexity limit: Maximum Numerator or Denominator
  
  // Voice Leading / Focus Mode
  isVoiceLeadingEnabled: boolean;
  voiceLeadingStrength: number; // 0 to 1, higher means stricter falloff
  
  // Voice Leading Visuals
  isVoiceLeadingAnimationEnabled: boolean;
  voiceLeadingReverseDir: boolean; // Reverse the direction of the flow animation
  voiceLeadingAnimationSpeed: number; // seconds
  
  // Momentum is deprecated/greyed out in favor of Latch Mode
  isMomentumEnabled: boolean; 

  // Latch Settings
  isLatchModeEnabled: boolean;
  latchShellLimit: number; // 1 = Octaves, 2 = Fifths, etc.
  latchedZoomScale: number; // Scale factor for active nodes (1.0 to 2.0)

  buttonSizeScale: number; // 0.5 to 2.0
  buttonSpacingScale: number; // 0.5 to 5.0
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
}

export interface SynthPreset {
  id: number;
  name: string;
  // Osc 1
  waveform: WaveformType;
  // Osc 2
  osc2Waveform: WaveformType;
  osc2Detune: number; // Cents
  osc2Mix: number; // 0 (Silent) to 1 (Full)
  
  // Envelopes
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  gain: number;
  
  // Filter
  filterCutoff: number; // Hz
  filterResonance: number; // Q factor

  // LFO
  lfoRate: number; // Hz
  lfoDepth: number; // Amount
  lfoTarget: 'none' | 'pitch' | 'filter' | 'tremolo';
  
  reverbMix: number; // 0 to 1
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
}

export interface ActiveVoice {
  id: string; // Pointer ID or Node ID
  nodeId?: string;
  stop: () => void;
  setDetune: (cents: number) => void;
}
