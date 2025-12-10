
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
  
  isVoiceLeadingEnabled: true, 
  voiceLeadingStrength: 0.3, 
  
  isVoiceLeadingAnimationEnabled: true,
  voiceLeadingReverseDir: false,
  voiceLeadingAnimationSpeed: 2.0,
  
  isMomentumEnabled: false, // Disabled by default
  
  isLatchModeEnabled: false,
  latchShellLimit: 5, // Default allows reasonable complexity to be latched
  latchedZoomScale: 1.3,

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

  // Rainbow Defaults
  isRainbowModeEnabled: false,
  rainbowSaturation: 60,
  rainbowBrightness: 10,
  rainbowOffset: 0,
  isColoredIlluminationEnabled: false,
};

export const PRESETS: SynthPreset[] = [
  {
    id: 1,
    name: "Deep Pad",
    waveform: WaveformType.TRIANGLE,
    osc2Waveform: WaveformType.SINE,
    osc2Detune: -12,
    osc2Mix: 0.5,
    attack: 0.6,
    decay: 0.5,
    sustain: 0.8,
    release: 1.5,
    gain: 0.35,
    filterCutoff: 800,
    filterResonance: 1,
    lfoRate: 0.5,
    lfoDepth: 50,
    lfoTarget: 'filter',
    reverbMix: 0.5
  },
  {
    id: 2,
    name: "Glassy",
    waveform: WaveformType.SINE,
    osc2Waveform: WaveformType.SINE,
    osc2Detune: 700, // A 5th up
    osc2Mix: 0.3,
    attack: 0.1,
    decay: 2.0,
    sustain: 0.4,
    release: 3.0,
    gain: 0.3,
    filterCutoff: 3000,
    filterResonance: 0,
    lfoRate: 4,
    lfoDepth: 10,
    lfoTarget: 'pitch',
    reverbMix: 0.6
  },
  {
    id: 3,
    name: "Warm Strings",
    waveform: WaveformType.SAWTOOTH,
    osc2Waveform: WaveformType.SAWTOOTH,
    osc2Detune: 12,
    osc2Mix: 0.5,
    attack: 0.8,
    decay: 1.0,
    sustain: 0.6,
    release: 1.2,
    gain: 0.25,
    filterCutoff: 1500,
    filterResonance: 2,
    lfoRate: 3,
    lfoDepth: 10,
    lfoTarget: 'tremolo',
    reverbMix: 0.4
  },
  {
    id: 4,
    name: "Ethereal Swell",
    waveform: WaveformType.TRIANGLE,
    osc2Waveform: WaveformType.TRIANGLE,
    osc2Detune: 5,
    osc2Mix: 0.6,
    attack: 1.5,
    decay: 1.0,
    sustain: 1.0,
    release: 2.0,
    gain: 0.3,
    filterCutoff: 600,
    filterResonance: 5,
    lfoRate: 0.2,
    lfoDepth: 400,
    lfoTarget: 'filter',
    reverbMix: 0.7
  },
  {
    id: 5,
    name: "Retro Lead",
    waveform: WaveformType.SQUARE,
    osc2Waveform: WaveformType.SAWTOOTH,
    osc2Detune: -5,
    osc2Mix: 0.4,
    attack: 0.05,
    decay: 0.2,
    sustain: 0.6,
    release: 0.4,
    gain: 0.25,
    filterCutoff: 2500,
    filterResonance: 4,
    lfoRate: 6,
    lfoDepth: 15,
    lfoTarget: 'pitch',
    reverbMix: 0.3
  }
];

export const DEFAULT_PRESET = PRESETS[0];

export const BASE_FREQUENCY = 196.00; // G3
