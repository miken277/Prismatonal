
import { AppSettings, ButtonShape, LimitType, LimitColorMap, SynthPreset, WaveformType } from './types';

export const DEFAULT_COLORS: LimitColorMap = {
  1: '#EF4444', // Red (Unity)
  3: '#EAB308', // Yellow (3-Limit)
  5: '#3B82F6', // Blue (5-Limit)
  7: '#22C55E', // Green (7-Limit)
  11: '#A855F7', // Purple (11-Limit)
};

export const DEFAULT_SETTINGS: AppSettings = {
  tonalityLimit: LimitType.LIMIT_5,
  buttonSizeScale: 1.0,
  buttonSpacingScale: 1.0,
  diamondRotation: 0,
  aspectRatio: 1.0,
  buttonShape: ButtonShape.CIRCLE,
  colors: { ...DEFAULT_COLORS },
  isPitchBendEnabled: true,
  isPitchSnapEnabled: true,
  polyphony: 6,
  pitchOffLocked: false,
  volumeLocked: false,
};

export const DEFAULT_PRESET: SynthPreset = {
  id: 1,
  name: "Pure Sine",
  waveform: WaveformType.SINE,
  attack: 0.05,
  decay: 0.1,
  sustain: 0.8,
  release: 0.5,
  gain: 0.5,
};

export const BASE_FREQUENCY = 196.00; // G3 (Typical Partch root is G)
