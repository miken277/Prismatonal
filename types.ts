
export enum LimitType {
  LIMIT_2 = 2,
  LIMIT_3 = 3,
  LIMIT_5 = 5,
  LIMIT_7 = 7,
  LIMIT_9 = 9,
  LIMIT_11 = 11,
  LIMIT_13 = 13,
  LIMIT_15 = 15,
}

export enum WaveformType {
  SINE = 'sine',
  SQUARE = 'square',
  SAWTOOTH = 'sawtooth',
  TRIANGLE = 'triangle',
  NOISE = 'noise',
  GLOTTAL = 'glottal',
}

export enum ButtonShape {
  CIRCLE = '50%',
  DIAMOND = '0%',
}

export type TuningSystem = 'ji' | 'et' | 'indian' | 'pythagorean';

export type LayoutApproach = 
  | 'lattice' | 'diamond' | 'row' | 'honeycomb' // JI specific
  | 'et_wheel' | 'et_grid' | 'et_row'           // ET specific
  | 'indian_circle' | 'indian_thaat'           // Indian specific
  | 'pyth_spiral' | 'pyth_row';                // Pythagorean specific

export type BackgroundMode = 'solid' | 'gradient' | 'image';

export interface LimitColorMap {
  [key: number]: string;
}

export interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number; // 0.0 to 1.0
    color: string;
    size: number;
}

export interface ChordNode {
  id: string; // Coordinate key
  n: number;
  d: number;
  voiceMode?: PlayMode; // The mode/patch used when this note was saved
}

export interface ChordDefinition {
  id: string; // "A", "B", etc.
  label: string;
  color: string;
  nodes: ChordNode[];
  visible: boolean; // Is shortcut on screen?
  position: { x: number; y: number }; // Relative position or legacy absolute
  soundConfig?: SynthPreset; // Legacy single patch
  soundConfigs?: Partial<Record<PlayMode, SynthPreset>>; // New multi-patch storage
}

export interface ArpeggioStep {
    nodeId: string;
    ratio: number;
    n?: number;
    d?: number;
    muted?: boolean;
    limit?: number; // For quality indication (maxPrime)
    mode?: number; // The instrument mode active during recording
}

export type ArpDirection = 'order' | 'up' | 'down' | 'updown' | 'random';
export type ArpDivision = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/4T' | '1/8T' | '1/16T';

export interface ArpConfig {
    direction: ArpDirection;
    division: ArpDivision;
    octaves: number; // 1 to 4
    gate: number; // 0.1 to 1.0
    swing: number; // 0 to 100
    length: number; // 1 to 32 (Pattern Length)
    probability: number; // 0.0 to 1.0 (Chance to play)
    humanize: number; // 0 to 100 (ms of jitter)
}

export interface ArpeggioDefinition {
    id: string; // "A" - "G"
    steps: ArpeggioStep[];
    isPlaying: boolean;
    config: ArpConfig;
}

export interface XYPos {
  x: number;
  y: number;
}

export interface UISize {
  width: number;
  height?: number;
}

export interface KeyMappings {
    // Navigation & View
    center: string;
    increaseDepth: string;
    decreaseDepth: string;
    settings: string;
    
    // Global & Panic
    volumeUp: string;
    volumeDown: string;
    panic: string;
    off: string;
    
    // Patch & Mode Controls
    latch: string; 
    sustain: string; 
    bend: string; 
    modulate: string; // NEW: Toggle Modulation mode
    modeDrone: string; 
    modeStrings: string; 
    modePlucked: string; 
    modeBrass: string; 
    modeKeys: string; 
    modePercussion: string; 
    synth: string; 

    // Chords & Performance
    addChord: string;
    
    // Tempo
    bpmUp: string;
    bpmDown: string;

    // Arpeggiator
    toggleSequencer: string;
    playAllArps: string;
    stopAllArps: string;
    
    // Legacy / View scaling
    spatialScaleUp: string;
    spatialScaleDown: string;
}

export interface BackgroundPreset {
  id: string;
  name: string;
  data: string | null; // Base64 or null if empty
}

export interface AppSettings {
  // Global Tuning
  tuningSystem: TuningSystem;
  layoutApproach: LayoutApproach;
  activeSkin: string; 

  // Individual depths (Steps from center, 0-31)
  limitDepths: {
    3: number;
    5: number;
    7: number;
    9: number;
    11: number;
    13: number;
    15: number;
  };

  enabledIdentities: number[]; 
  latticeMaxDistance: number; 

  // MODULATION STATE
  isModulationModeActive: boolean;
  modulationPath: GenerationOrigin[]; // List of absolute centers visited

  // Increase Depth Settings
  showIncreaseDepthButton: boolean;
  centerResetsDepth: boolean;

  // Chords
  savedChords: ChordDefinition[];
  chordShortcutSizeScale: number; 
  
  // Arpeggios
  arpeggios: ArpeggioDefinition[];
  arpBpm: number;

  // Visible toggle for lower limits
  hiddenLimits: number[]; 
  
  layerOrder: number[]; 
  
  // Audio Settings
  baseFrequency: number; 
  audioLatencyHint: 'interactive' | 'balanced' | 'playback'; 
  enableOversampling: boolean; 
  wavetableSize: 2048 | 8192 | 65536; 
  interpolationType: 'linear' | 'cubic'; 

  // Voice Leading / Focus Mode
  isVoiceLeadingEnabled: boolean;
  voiceLeadingStrength: number; 
  
  // Voice Leading Visuals
  isVoiceLeadingAnimationEnabled: boolean;
  voiceLeadingAnimationSpeed: number; 
  voiceLeadingReverseDir: boolean; 
  voiceLeadingGlowAmount: number; 
  voiceLeadingSteps: number; 
  
  // Line Appearance
  baseLineWidth: number; 
  lineBrighteningEnabled: boolean;
  lineBrighteningSteps: number; 
  lineBrighteningWidth: number; 

  isMomentumEnabled: boolean; 

  // Latch Settings
  latchedZoomScale: number; 

  // Appearance
  buttonSizeScale: number; 
  buttonSpacingScale: number; 
  latticeAspectRatio: number; 
  canvasSize: number; 
  buttonShape: ButtonShape;
  colors: LimitColorMap;
  limitVisuals?: { [key: number]: { size: number; opacity: number } };
  
  // Text Appearance
  nodeTextSizeScale: number; 
  showFractionBar: boolean;

  isPitchBendEnabled: boolean;
  isSustainEnabled: boolean; 
  isStrumEnabled: boolean; 
  chordsAlwaysRelatch: boolean; 
  isPitchSnapEnabled: boolean;
  polyphony: number;
  pitchOffLocked: boolean;
  volumeLocked: boolean;

  // Visuals - Background
  backgroundMode: BackgroundMode;
  backgroundPresets: BackgroundPreset[];
  
  solidColor: string; 
  gradientColorStart: string;
  gradientColorEnd: string;
  gradientType: 'linear' | 'radial';
  gradientAngle: number; 

  // Image
  backgroundImageData: string | null; 
  backgroundYOffset: number; 
  backgroundTiling: boolean; 
  bgImageGamma: number; 
  bgImageTint: string; 
  bgImageTintStrength: number; 

  // Overlay
  isOverlayEnabled: boolean;
  overlayBlendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  overlayOpacity: number;
  overlayType: 'solid' | 'gradient';
  overlayColorStart: string;
  overlayColorEnd: string;
  overlayGradientType: 'linear' | 'radial';
  overlayGradientAngle: number;

  // Rainbow Settings
  rainbowSaturation: number;
  rainbowBrightness: number;
  rainbowOffset: number;
  isColoredIlluminationEnabled: boolean;
  isRainbowModeEnabled: boolean;

  // MIDI Settings
  midiEnabled: boolean;
  midiOutputId: string | null;
  midiPitchBendRange: number; 

  // Behavior
  enableKeyboardShortcuts: boolean;
  keyMappings: KeyMappings;
  strumDuration: number; 
  enableAudioRecording: boolean; 

  // UI Relocation & Scaling
  uiUnlocked: boolean;
  uiScale: number; 
  uiEdgeMargin: number; 
  uiPositions: {
    volume: XYPos;
    space: XYPos;
    panic: XYPos;
    off: XYPos;
    latch: XYPos; 
    sust: XYPos;
    bend: XYPos;
    center: XYPos;
    depth: XYPos;
    decreaseDepth: XYPos;
    chords: XYPos;
    layers: XYPos;
    arpeggioBar: XYPos;
    instruments: XYPos; 
    complexity: XYPos; 
    mod: XYPos; // NEW: Modulation button position
  };
  uiSizes: {
    volume: UISize;
    arpeggioBar: UISize;
  };
}

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peak' | 'lowshelf' | 'highshelf';

export interface OscillatorConfig {
  enabled: boolean;
  waveform: WaveformType;
  coarseDetune: number; 
  fineDetune: number; 
  gain: number; 
  
  // Envelope
  attack: number;
  decay: number;
  sustain: number; 
  release: number;
  
  // Extended Envelope
  holdDecay?: number; 
  pedalDecay?: number; 

  // Filter
  filterCutoff: number; 
  filterResonance: number; 
  filterType: FilterType;

  // LFO
  lfoRate: number; 
  lfoDepth: number; 
  lfoWaveform: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise'; 
  lfoTarget: 'none' | 'pitch' | 'filter' | 'tremolo';
  lfoDelay: number; 
}

export type ModSource = 'lfo1' | 'lfo2' | 'lfo3' | 'env1' | 'env2' | 'env3';
export type ModTarget = 
    'osc1_pitch' | 'osc1_gain' | 'osc1_cutoff' | 'osc1_res' |
    'osc2_pitch' | 'osc2_gain' | 'osc2_cutoff' | 'osc2_res' |
    'osc3_pitch' | 'osc3_gain' | 'osc3_cutoff' | 'osc3_res';

export interface ModulationRow {
    id: string;
    enabled: boolean;
    source: ModSource;
    target: ModTarget;
    amount: number; 
}

export type ReverbType = 'room' | 'hall' | 'cathedral' | 'plate' | 'shimmer';

export interface SynthPreset {
  id: number | string;
  name: string;
  category?: string; 
  isHeader?: boolean; 
  
  osc1: OscillatorConfig;
  osc2: OscillatorConfig;
  osc3: OscillatorConfig;
  
  modMatrix: ModulationRow[];
  gain: number; 
  resonatorMix?: number; 
  resonatorSweep?: number; 
  noiseGain?: number; 
  noiseCutoff?: number; 
  portamento?: number; 
  acousticSustain?: boolean; 
  spread?: number; 
  stereoPanSpeed?: number; 
  stereoPanDepth?: number; 
  reverbType?: ReverbType; 
  reverbMix: number; 
  reverbSize: number; 
  reverbDamping: number; 
  reverbDiffusion?: number; 
  delayMix: number; 
  delayTime: number; 
  delayFeedback: number; 
  compressorThreshold: number; 
  compressorRatio: number; 
  compressorRelease: number; 
  arpConfig?: ArpConfig;
  formantStrength?: number;
  vowel?: number;
  aspirationGain?: number;
  aspirationCutoff?: number;
}

export type PresetSlot = 'normal' | 'latch' | 'strum' | 'brass' | 'keys' | 'percussion';
export type PlayMode = PresetSlot; 
export type PlaybackMode = 'gate' | 'trigger' | 'latch'; 

export interface PresetState {
    normal: SynthPreset;
    latch: SynthPreset;
    strum: SynthPreset;
    brass: SynthPreset; 
    keys: SynthPreset; 
    percussion: SynthPreset; 
}

export interface StoreState {
    settings: AppSettings;
    presets: PresetState;
    userBank: SynthPreset[]; 
}

export interface LatticeNode {
  id: string; 
  ratio: number; 
  n: number; 
  d: number; 
  label: string; 
  x: number; 
  y: number; 
  limitTop: number; 
  limitBottom: number;
  maxPrime: number; 
  coords: number[]; 
  octave: number; 
  isGhost?: boolean; // NEW: Indicates node belongs to a previous lattice origin
  originIndex?: number; // NEW: Index in modulationPath
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
  isGhost?: boolean; // NEW: Indicates line belongs to a previous lattice origin
}

export interface ActiveVoice {
  id: string; 
  nodeId?: string;
  stop: () => void;
  setDetune: (cents: number) => void;
}

export interface GenerationOrigin {
  coords: number[];
  octave: number;
}
