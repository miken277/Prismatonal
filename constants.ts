
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
    7: 500,
    11: 500,
    13: 500,
  },
  
  showIncreaseDepthButton: true,
  centerResetsDepth: false,

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
};

export const PRESETS: SynthPreset[] = [
  {
    id: 1,
    name: "Deep Pad",
    waveform: WaveformType.TRIANGLE,
    osc2Waveform: WaveformType.SINE,
    osc2Detune: -12,
    osc2Mix: 0.6,
    attack: 0.8,
    decay: 0.5,
    sustain: 0.8,
    release: 1.5,
    gain: 0.5, 
    filterCutoff: 1200,
    filterResonance: 1,
    lfoRate: 0.5,
    lfoDepth: 10, // Subtle filter movement
    lfoTarget: 'filter',
    reverbMix: 0.5,
    delayMix: 0.3,
    delayTime: 0.4,
    delayFeedback: 0.3,
    compressorThreshold: -24,
    compressorRatio: 12,
    compressorRelease: 0.25
  },
  {
    id: 2,
    name: "Glassy",
    waveform: WaveformType.SINE,
    osc2Waveform: WaveformType.SINE,
    osc2Detune: 700, // A 5th up
    osc2Mix: 0.4,
    attack: 0.1,
    decay: 2.0,
    sustain: 0.4,
    release: 3.0,
    gain: 0.45,
    filterCutoff: 3000,
    filterResonance: 0,
    lfoRate: 4,
    lfoDepth: 3, // Subtle Pitch Vibrato (3Hz)
    lfoTarget: 'pitch',
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
    waveform: WaveformType.SAWTOOTH,
    osc2Waveform: WaveformType.SAWTOOTH,
    osc2Detune: 10,
    osc2Mix: 0.4,
    attack: 0.8,
    decay: 1.0,
    sustain: 0.7,
    release: 1.2,
    gain: 0.35, // Sawtooth is loud
    filterCutoff: 1800,
    filterResonance: 0.5,
    lfoRate: 3,
    lfoDepth: 20, // Moderate tremolo
    lfoTarget: 'tremolo',
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
    waveform: WaveformType.TRIANGLE,
    osc2Waveform: WaveformType.TRIANGLE,
    osc2Detune: 5,
    osc2Mix: 0.6,
    attack: 2.0,
    decay: 1.0,
    sustain: 1.0,
    release: 2.5,
    gain: 0.45,
    filterCutoff: 800,
    filterResonance: 2,
    lfoRate: 0.2,
    lfoDepth: 40, // Deeper filter sweep
    lfoTarget: 'filter',
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
    waveform: WaveformType.SQUARE,
    osc2Waveform: WaveformType.SAWTOOTH,
    osc2Detune: -5,
    osc2Mix: 0.4,
    attack: 0.05,
    decay: 0.2,
    sustain: 0.6,
    release: 0.4,
    gain: 0.3, // Square is loud
    filterCutoff: 3500,
    filterResonance: 2,
    lfoRate: 6,
    lfoDepth: 4, // Fast vibrato
    lfoTarget: 'pitch',
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
    waveform: WaveformType.TRIANGLE,
    osc2Waveform: WaveformType.SINE,
    osc2Detune: 1200, // Octave up
    osc2Mix: 0.3,
    attack: 0.01,
    decay: 1.5,
    sustain: 0.1,
    release: 2.0,
    gain: 0.5,
    filterCutoff: 2500,
    filterResonance: 0,
    lfoRate: 2,
    lfoDepth: 15, // Subtle tremolo
    lfoTarget: 'tremolo',
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
    waveform: WaveformType.SAWTOOTH,
    osc2Waveform: WaveformType.SQUARE,
    osc2Detune: -12,
    osc2Mix: 0.8,
    attack: 0.1,
    decay: 0.4,
    sustain: 0.9,
    release: 0.3,
    gain: 0.35,
    filterCutoff: 400,
    filterResonance: 3,
    lfoRate: 1,
    lfoDepth: 5, 
    lfoTarget: 'filter',
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
    waveform: WaveformType.SINE,
    osc2Waveform: WaveformType.SQUARE,
    osc2Detune: 23, // Distinct beating
    osc2Mix: 0.2,
    attack: 1.0,
    decay: 2.0,
    sustain: 0.7,
    release: 4.0,
    gain: 0.4,
    filterCutoff: 1500,
    filterResonance: 5,
    lfoRate: 0.1,
    lfoDepth: 60, // Slow deep filter movement
    lfoTarget: 'filter',
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
