
import { AppSettings, ButtonShape, LimitColorMap, SynthPreset, WaveformType } from './types';

export const DEFAULT_COLORS: LimitColorMap = {
  1: '#EF4444', // Red (Unity)
  3: '#EAB308', // Yellow (3-Limit)
  5: '#3B82F6', // Blue (5-Limit)
  7: '#22C55E', // Green (7-Limit)
  11: '#A855F7', // Purple (11-Limit)
};

const INITIAL_GRID = `1/1, 9/8, 5/4, 11/8, 3/2, 7/4
4/3, 1/1, 10/9, 11/9, 4/3, 14/9
8/5, 9/5, 1/1, 11/10, 6/5, 7/5
16/11, 18/11, 20/11, 1/1, 12/11, 14/11
4/3, 3/2, 5/3, 11/6, 1/1, 7/6
8/7, 9/7, 10/7, 11/7, 12/7, 1/1`;

export const DEFAULT_SETTINGS: AppSettings = {
  gridSize: 6,
  gridData: INITIAL_GRID,
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

export const BASE_FREQUENCY = 196.00; // G3
