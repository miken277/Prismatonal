
export enum LimitType {
  LIMIT_3 = 3,
  LIMIT_5 = 5,
  LIMIT_7 = 7,
  LIMIT_11 = 11,
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
  tonalityLimit: LimitType;
  buttonSizeScale: number; // 0.5 to 2.0
  buttonSpacingScale: number; // 0.5 to 2.0
  diamondRotation: number; // Degrees
  aspectRatio: number; // 1.0 is square
  buttonShape: ButtonShape;
  colors: LimitColorMap;
  isPitchBendEnabled: boolean;
  isPitchSnapEnabled: boolean;
  polyphony: number;
  pitchOffLocked: boolean;
  volumeLocked: boolean;
}

export interface SynthPreset {
  id: number;
  name: string;
  waveform: WaveformType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  gain: number;
}

export interface LatticeNode {
  id: string;
  ratio: number; // The frequency multiplier relative to root
  label: string; // The fraction string (e.g. "3/2")
  x: number; // Grid X
  y: number; // Grid Y
  limitIdentity: number; // 1, 3, 5, 7, 11...
}

export interface ActiveVoice {
  id: number; // Pointer ID
  nodeId: string;
  stop: () => void;
  setDetune: (cents: number) => void;
}
