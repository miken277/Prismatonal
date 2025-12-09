
import { AppSettings, ButtonShape, LimitColorMap, SynthPreset, WaveformType } from './types';

export const DEFAULT_COLORS: LimitColorMap = {
  1: '#EF4444', // Red (Unity)
  3: '#EAB308', // Yellow (3-Limit)
  5: '#3B82F6', // Blue (5-Limit)
  7: '#22C55E', // Green (7-Limit)
  11: '#A855F7', // Purple (11-Limit)
  13: '#F97316', // Orange (13-Limit)
};

export const DEFAULT_SETTINGS: AppSettings = {
  latticeShells: 3,
  enabledLimits: {
    7: false,
    11: false,
    13: false,
  },
  hiddenLimits: [],
  // Order from back to front.
  layerOrder: [13, 11, 7, 5, 3, 1], 
  
  maxND: 2048, // Common sense limit for complexity
  
  isVoiceLeadingEnabled: true, // Default to true for new visual behavior
  voiceLeadingStrength: 0.3, 
  isMomentumEnabled: false, // Disabled by default
  
  isLatchModeEnabled: false,
  latchShellLimit: 5, // Default allows reasonable complexity to be latched

  buttonSizeScale: 1.0,
  buttonSpacingScale: 1.5, // Slightly wider default
  canvasSize: 4000, // Large canvas for scrolling
  buttonShape: ButtonShape.CIRCLE,
  colors: { ...DEFAULT_COLORS },
  isPitchBendEnabled: true,
  isPitchSnapEnabled: true,
  polyphony: 10, // Higher polyphony
  pitchOffLocked: false,
  volumeLocked: false,
};

export const DEFAULT_PRESET: SynthPreset = {
  id: 1,
  name: "Deep Pad",
  waveform: WaveformType.TRIANGLE,
  attack: 0.3,
  decay: 0.5,
  sustain: 0.7,
  release: 1.2,
  gain: 0.4,
  filterCutoff: 1200,
  reverbMix: 0.4
};

export const BASE_FREQUENCY = 196.00; // G3
