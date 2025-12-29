

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

export type BackgroundMode = 'rainbow' | 'charcoal' | 'midnight_blue' | 'deep_maroon' | 'forest_green' | 'slate_grey' | 'image' | 'none';

export interface LimitColorMap {
  [key: number]: string;
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
    
    // Patch & Mode Controls (Bottom Right Priority)
    latch: string; // Toggle Drone/Strings mode
    sustain: string; // Toggles Sustain (SUST)
    bend: string; // Toggles Pitch Bend
    modeDrone: string; // Switch to Drone Mode
    modeStrings: string; // Switch to Strings Mode
    modePlucked: string; // Switch to Plucked Mode
    modeVoice: string; // Switch to Voice Mode (New)
    synth: string; // Toggle Synth Panel

    // Chords & Performance
    addChord: string;
    
    // Tempo
    bpmUp: string;
    bpmDown: string;

    // Arpeggiator
    toggleSequencer: string;
    playAllArps: string;
    stopAllArps: string;
    
    // Legacy / View scaling (kept for compatibility)
    spatialScaleUp: string;
    spatialScaleDown: string;
}

export interface AppSettings {
  // Global Tuning
  tuningSystem: TuningSystem;
  layoutApproach: LayoutApproach;
  activeSkin: string; // Dynamic skin ID for visual presentation

  // Individual depths (Steps from center)
  limitDepths: {
    3: number;
    5: number;
    7: number;
    9: number;
    11: number;
    13: number;
    15: number;
  };

  // Individual complexity limits (Max Numerator/Denominator per axis)
  limitComplexities: {
    3: number;
    5: number;
    7: number;
    9: number;
    11: number;
    13: number;
    15: number;
  };
  
  // Increase Depth Settings
  showIncreaseDepthButton: boolean;
  centerResetsDepth: boolean;

  // Chords
  savedChords: ChordDefinition[];
  chordShortcutSizeScale: number; // 0.33 to 1.0 relative to main buttons
  
  // Arpeggios
  arpeggios: ArpeggioDefinition[];
  arpBpm: number;

  // Visible toggle for lower limits (View only)
  hiddenLimits: number[]; 
  
  layerOrder: number[]; // Array of limit numbers, index 0 = back, last index = front
  
  // Audio Settings
  baseFrequency: number; // Hz for 1/1
  audioLatencyHint: 'interactive' | 'balanced' | 'playback'; // Buffer size control
  enableOversampling: boolean; // New: Performance vs Quality toggle
  wavetableSize: 2048 | 8192 | 65536; // Wavetable resolution
  interpolationType: 'linear' | 'cubic'; // Wavetable interpolation method

  // Voice Leading / Focus Mode
  isVoiceLeadingEnabled: boolean;
  voiceLeadingStrength: number; // 0 to 1, higher means stricter falloff
  
  // Voice Leading Visuals
  isVoiceLeadingAnimationEnabled: boolean;
  voiceLeadingAnimationSpeed: number; // seconds
  voiceLeadingReverseDir: boolean; // Reverse the direction of the flow animation
  voiceLeadingGlowAmount: number; // 0.0 to 1.0 (Controls width/intensity of the lobe)
  voiceLeadingSteps: number; // 1 or 2 (Reach for active voice leading lines)
  
  // Line Appearance
  baseLineWidth: number; // 0.5 to 3.0 (Static lines)
  lineBrighteningEnabled: boolean;
  lineBrighteningSteps: number; // 1 or 2
  lineBrighteningWidth: number; // 1.0 to 4.0

  // Momentum is deprecated/greyed out in favor of Latch Mode
  isMomentumEnabled: boolean; 

  // Latch Settings
  latchedZoomScale: number; // Scale factor for active nodes (1.0 to 2.0)

  // Appearance
  buttonSizeScale: number; // Global Scalar 0.5 to 2.0
  buttonSpacingScale: number; // 0.5 to 5.0
  latticeAspectRatio: number; // 0.5 (Stretched X) to 2.0 (Squished X)
  canvasSize: number; // Width/Height of the scrollable area in pixels (e.g. 3000, 5000)
  buttonShape: ButtonShape;
  colors: LimitColorMap;
  limitVisuals?: { [key: number]: { size: number; opacity: number } };
  
  // Text Appearance
  nodeTextSizeScale: number; // 0.5 to 2.0
  showFractionBar: boolean;

  isPitchBendEnabled: boolean;
  isSustainEnabled: boolean; // Global Sustain Modifier (Gate vs Latch)
  isStrumEnabled: boolean; // Global Strum Modifier (Trigger vs Gate)
  chordsAlwaysRelatch: boolean; // New: Whether selecting a chord always retriggers/relatches its notes
  isPitchSnapEnabled: boolean;
  polyphony: number;
  pitchOffLocked: boolean;
  volumeLocked: boolean;

  // Visuals - Background
  backgroundMode: BackgroundMode;
  backgroundImageData: string | null; // Base64 string for custom image
  backgroundTiling: boolean; // True = Repeat, False = No Repeat (Centered)
  backgroundYOffset: number; // Vertical offset in pixels
  
  // Legacy Rainbow params (still used if mode is 'rainbow')
  isRainbowModeEnabled: boolean; 
  rainbowSaturation: number; // 0-100
  rainbowBrightness: number; // 0-100
  rainbowOffset: number; // 0-360 (Hue shift)
  
  isColoredIlluminationEnabled: boolean;

  // MIDI Settings
  midiEnabled: boolean;
  midiOutputId: string | null;
  midiPitchBendRange: number; // Semitones (typically 2, 12, 24, or 48)

  // Behavior
  enableKeyboardShortcuts: boolean;
  keyMappings: KeyMappings;
  strumDuration: number; // seconds, 0.1 to 2.0
  recordScreenActivity: boolean; // New Setting: Toggle for video capture

  // UI Relocation & Scaling
  uiUnlocked: boolean;
  uiScale: number; // 0.5 (Tiny) to 1.5 (Huge)
  uiEdgeMargin: number; // in Millimeters (1-10)
  uiPositions: {
    volume: XYPos;
    space: XYPos;
    panic: XYPos;
    off: XYPos;
    latch: XYPos; // Legacy key, kept for data compatibility, now usually unused or re-mapped
    sust: XYPos;
    bend: XYPos;
    center: XYPos;
    depth: XYPos;
    decreaseDepth: XYPos;
    chords: XYPos;
    layers: XYPos;
    arpeggioBar: XYPos;
    instruments: XYPos; // New cluster for Drone/String
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
    amount: number; // -100 to 100
}

export type ReverbType = 'room' | 'hall' | 'cathedral' | 'plate' | 'shimmer';

export interface SynthPreset {
  id: number | string;
  name: string;
  category?: string; // New field for categorization
  
  osc1: OscillatorConfig;
  osc2: OscillatorConfig;
  osc3: OscillatorConfig;
  
  // Modulation Matrix
  modMatrix: ModulationRow[];

  // Master Gain for the preset
  gain: number; 

  // Stereo & Pan
  spread?: number; // 0 to 1 (Voice Stereo Width)
  stereoPanSpeed?: number; // Hz
  stereoPanDepth?: number; // 0 to 1 (Auto-Pan amount)
  
  // Reverb Unit
  reverbType?: ReverbType; // Convolution Preset (Logic base)
  reverbMix: number; // 0 to 1
  reverbSize: number; // Duration in seconds (0.1 to 10.0)
  reverbDamping: number; // 0 (Bright) to 1 (Dark)
  reverbDiffusion?: number; // 0 (Grainy) to 1 (Smooth)

  // Delay Unit
  delayMix: number; // 0 to 1
  delayTime: number; // Seconds
  delayFeedback: number; // 0 to 0.95

  // Dynamics (Compressor/Limiter) (Global)
  compressorThreshold: number; // dB (-60 to 0)
  compressorRatio: number; // 1 to 20
  compressorRelease: number; // seconds

  // Arp Settings
  arpConfig?: ArpConfig;
}

// Slot Types
export type PresetSlot = 'normal' | 'latch' | 'strum' | 'voice' | 'arpeggio';
export type PlayMode = PresetSlot; // Alias for backward compatibility
export type PlaybackMode = 'gate' | 'trigger' | 'latch'; // Behavior type

export interface PresetState {
    normal: SynthPreset;
    latch: SynthPreset;
    strum: SynthPreset;
    voice: SynthPreset;
    arpeggio: SynthPreset;
}

export interface StoreState {
    settings: AppSettings;
    presets: PresetState;
    userBank: SynthPreset[]; // 20 Save Slots
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
  coords: number[]; // [p3, p5, p7, p9, p11, p13, p15]
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