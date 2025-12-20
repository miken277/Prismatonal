
import { SynthPreset, AppSettings, ReverbType, PresetState, PlayMode } from '../types';
import { store } from './Store';
import { DEFAULT_PRESET, REVERB_DEFAULTS } from '../constants';
import { AUDIO_PROCESSOR_CODE } from './AudioProcessorCode';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private initPromise: Promise<void> | null = null;
  
  // FX Chain
  private limiter: DynamicsCompressorNode | null = null;
  private masterFilter: BiquadFilterNode | null = null; // New Tone Control
  private dryGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayOutputGain: GainNode | null = null;

  private currentMasterVol: number = 0.8;
  private globalSpatialScale: number = 1.0;
  private globalBrightness: number = 1.0; // 0.0 to 1.0
  
  // Cache active presets for FX updates
  private activePresets: PresetState;

  // Sample Registry (ID -> Name)
  private loadedSamples: Map<string, string> = new Map();

  constructor() {
    // Initialize Presets safely
    const rawPresets = store.getSnapshot().presets;
    this.activePresets = {
        normal: this.ensurePresetSafety(rawPresets.normal),
        latch: this.ensurePresetSafety(rawPresets.latch),
        strum: this.ensurePresetSafety(rawPresets.strum),
        arpeggio: this.ensurePresetSafety(rawPresets.arpeggio)
    };

    store.subscribe(() => {
        const newPresets = store.getSnapshot().presets;
        this.updatePresets(newPresets);
    });
  }

  private isMobile() {
      return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  private ensurePresetSafety(p: any): SynthPreset {
     if (!p) return DEFAULT_PRESET;
     
     const validReverbTypes: ReverbType[] = ['room', 'hall', 'cathedral', 'plate', 'shimmer'];
     let rType: ReverbType = 'hall';
     
     if (p.reverbType && validReverbTypes.includes(p.reverbType)) {
         rType = p.reverbType as ReverbType;
     }

     const safe: SynthPreset = {
         ...DEFAULT_PRESET,
         ...p,
         osc1: { ...DEFAULT_PRESET.osc1, ...(p.osc1 || {}) },
         osc2: { ...DEFAULT_PRESET.osc2, ...(p.osc2 || {}) },
         osc3: { ...DEFAULT_PRESET.osc3, ...(p.osc3 || {}) },
         modMatrix: p.modMatrix || [],
         reverbType: rType
     };

     const defaults = REVERB_DEFAULTS[rType];
     if (safe.reverbSize === undefined) safe.reverbSize = defaults.size;
     if (safe.reverbDamping === undefined) safe.reverbDamping = defaults.damping;
     if (safe.reverbDiffusion === undefined) safe.reverbDiffusion = defaults.diffusion;
     
     return safe;
  }

  private updatePresets(newPresets: PresetState) {
      const modes: PlayMode[] = ['normal', 'latch', 'strum', 'arpeggio'];
      let recomputeReverb = false;

      const oldMaster = this.activePresets.normal;
      const newMaster = newPresets.normal;

      if (
          oldMaster.reverbType !== newMaster.reverbType ||
          oldMaster.reverbSize !== newMaster.reverbSize ||
          oldMaster.reverbDamping !== newMaster.reverbDamping ||
          oldMaster.reverbDiffusion !== newMaster.reverbDiffusion
      ) {
          recomputeReverb = true;
      }

      this.activePresets = {
          normal: this.ensurePresetSafety(newPresets.normal),
          latch: this.ensurePresetSafety(newPresets.latch),
          strum: this.ensurePresetSafety(newPresets.strum),
          arpeggio: this.ensurePresetSafety(newPresets.arpeggio)
      };

      if (recomputeReverb && this.ctx) {
          this.updateReverbBuffer();
      }
      this.updateFX();

      if (this.workletNode) {
          modes.forEach(mode => {
              this.workletNode!.port.postMessage({ 
                  type: 'update_preset', 
                  mode: mode, 
                  data: this.activePresets[mode] 
              });
          });
      }
  }

  public async resume() {
      if (!this.ctx) {
          await this.init(); 
      }
      if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted')) {
          await this.ctx.resume();
      }
  }

  public async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const settings = store.getSnapshot().settings;
            const latencyHint = settings.audioLatencyHint || 'playback';
            
            this.ctx = new AudioContextClass({
                latencyHint: latencyHint,
            });

            this.ctx.onstatechange = () => {
                if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted')) {
                    this.ctx.resume().catch(e => console.warn("Audio auto-resume failed:", e));
                }
            };

            try {
                const blob = new Blob([AUDIO_PROCESSOR_CODE], { type: 'application/javascript' });
                const workletUrl = URL.createObjectURL(blob);
                
                if (this.ctx.audioWorklet && this.ctx.audioWorklet.addModule) {
                    await this.ctx.audioWorklet.addModule(workletUrl);
                } else {
                    console.error("AudioWorklet not supported");
                    return;
                }
                
                URL.revokeObjectURL(workletUrl);
                
                this.workletNode = new AudioWorkletNode(this.ctx, 'synth-processor', {
                    numberOfInputs: 0,
                    numberOfOutputs: 1,
                    outputChannelCount: [2]
                });
                
                (['normal', 'latch', 'strum', 'arpeggio'] as PlayMode[]).forEach(mode => {
                    this.workletNode!.port.postMessage({ 
                        type: 'update_preset', 
                        mode: mode, 
                        data: this.activePresets[mode] 
                    });
                });
                this.workletNode.port.postMessage({ 
                    type: 'config', 
                    polyphony: store.getSnapshot().settings.polyphony,
                    strumDuration: store.getSnapshot().settings.strumDuration
                });

                this.setupFX();

                if (this.workletNode && this.dryGain && this.reverbGain && this.delayOutputGain) {
                     this.workletNode.connect(this.dryGain);
                     this.workletNode.connect(this.reverbGain);
                     this.workletNode.connect(this.delayOutputGain);
                }

            } catch (e) {
                console.error("Failed to load AudioWorklet", e);
                this.initPromise = null; 
                return;
            }
        }

        if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted')) {
            await this.ctx.resume();
        }
    })();

    return this.initPromise;
  }

  // --- SAMPLE MANAGEMENT ---

  public async loadUserSample(file: File): Promise<string> {
      await this.init();
      if (!this.ctx) throw new Error("Audio Context not ready");

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      
      // Convert to mono Float32Array for the engine
      const channelData = audioBuffer.getChannelData(0); 
      
      const id = `sample-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      if (this.workletNode) {
          this.workletNode.port.postMessage({
              type: 'load_sample',
              id: id,
              data: channelData
          });
      }
      
      this.loadedSamples.set(id, file.name.substring(0, 20)); // Store name for UI
      return id;
  }

  public getAvailableSamples(): { id: string, name: string }[] {
      return Array.from(this.loadedSamples.entries()).map(([id, name]) => ({ id, name }));
  }

  // --- EXISTING METHODS ---

  private setupFX() {
    if (!this.ctx) return;

    try {
        this.dryGain?.disconnect();
        this.reverbNode?.disconnect();
        this.reverbGain?.disconnect();
        this.delayNode?.disconnect();
        this.delayFeedbackGain?.disconnect();
        this.delayOutputGain?.disconnect();
        this.limiter?.disconnect();
        this.masterFilter?.disconnect();
    } catch(e) { /* ignore */ }

    // Master Filter (Tone Control)
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000;
    this.masterFilter.Q.value = 0.5;

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8.0; 
    this.limiter.ratio.value = 10.0;
    this.limiter.attack.value = 0.005;
    this.limiter.connect(this.ctx.destination);

    // Filter -> Limiter -> Out
    this.masterFilter.connect(this.limiter);

    this.dryGain = this.ctx.createGain();
    this.dryGain.connect(this.masterFilter);

    this.reverbNode = this.ctx.createConvolver();
    this.updateReverbBuffer();
    
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.connect(this.reverbNode);
    this.reverbNode.connect(this.masterFilter);

    this.delayNode = this.ctx.createDelay(5.0);
    this.delayFeedbackGain = this.ctx.createGain();
    this.delayOutputGain = this.ctx.createGain();
    
    this.delayOutputGain.connect(this.delayNode);
    this.delayNode.connect(this.masterFilter); 
    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    
    if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode.connect(this.dryGain);
        this.workletNode.connect(this.reverbGain);
        this.workletNode.connect(this.delayOutputGain);
    }

    this.updateFX();
    this.setMasterVolume(this.currentMasterVol);
  }

  private updateReverbBuffer() {
      if (!this.reverbNode || !this.ctx) return;
      
      const master = this.activePresets.normal;
      const type = master.reverbType || 'hall';
      
      const duration = master.reverbSize ?? REVERB_DEFAULTS[type].size;
      const damping = master.reverbDamping ?? REVERB_DEFAULTS[type].damping;
      const diffusion = master.reverbDiffusion ?? REVERB_DEFAULTS[type].diffusion;
      
      let brightness = 1.0 - damping; 
      
      let preDelay = 0.0;
      let decay = 2.0;
      let density = 0.5;

      switch(type) {
          case 'room': decay = 3.0; density = 0.8; break;
          case 'hall': decay = 2.0; density = 0.6; preDelay = 0.02; break;
          case 'cathedral': decay = 1.5; density = 0.4; preDelay = 0.04; break;
          case 'plate': decay = 4.0; density = 1.0; break;
          case 'shimmer': decay = 0.8; density = 0.2; break;
          default: decay = 2.0; density = 0.5;
      }
      
      this.reverbNode.buffer = this.createImpulseResponse(duration, decay, brightness, density, preDelay, diffusion);
  }

  private updateFX() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const ramp = 0.1;
      
      const master = this.activePresets.normal;

      const scaledReverbMix = Math.min(1.0, master.reverbMix * this.globalSpatialScale);
      const scaledDelayMix = Math.min(1.0, master.delayMix * this.globalSpatialScale);

      if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(scaledReverbMix, now, ramp);
      if (this.delayOutputGain) this.delayOutputGain.gain.setTargetAtTime(scaledDelayMix, now, ramp);
      
      const scaledFeedback = Math.min(0.95, master.delayFeedback * Math.sqrt(this.globalSpatialScale));
      if (this.delayFeedbackGain) this.delayFeedbackGain.gain.setTargetAtTime(scaledFeedback, now, ramp);

      if (this.delayNode) this.delayNode.delayTime.setTargetAtTime(master.delayTime, now, ramp);
      
      if (this.limiter) {
          const thresh = master.compressorThreshold ?? -20.0;
          const ratio = master.compressorRatio ?? 12;
          const release = master.compressorRelease ?? 0.25;

          this.limiter.threshold.setTargetAtTime(thresh, now, ramp);
          this.limiter.ratio.setTargetAtTime(ratio, now, ramp);
          this.limiter.release.setTargetAtTime(release, now, ramp);
      }
      
      if (this.masterFilter) {
          // Logarithmic mapping for brightness: 0..1 -> 100Hz .. 20000Hz
          const minFreq = 100;
          const maxFreq = 20000;
          const freq = minFreq * Math.pow(maxFreq/minFreq, this.globalBrightness);
          this.masterFilter.frequency.setTargetAtTime(freq, now, ramp);
      }

      if (this.dryGain) {
          const dryLevel = Math.max(0.5, 1.0 - (scaledReverbMix * 0.4));
          this.dryGain.gain.setTargetAtTime(dryLevel * this.currentMasterVol, now, ramp);
      }
  }

  private createImpulseResponse(duration: number, baseDecayCurve: number, brightness: number, density: number, preDelay: number, diffusion: number): AudioBuffer {
    if (!this.ctx) throw new Error("No Context");
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    const startSample = Math.floor(preDelay * sampleRate);
    let lpL = 0, lpR = 0;
    const baseSmoothing = 0.01 + (1.0 - brightness) * 0.985; 
    const decayCurve = baseDecayCurve + (1.0 - brightness) * 4.0;

    for (let i = startSample; i < length; i++) {
        let nL = (Math.random() * 2 - 1);
        let nR = (Math.random() * 2 - 1);
        const progress = (i - startSample) / (length - startSample);
        const currentSmoothing = baseSmoothing * (0.8 + 0.2 * progress);
        
        lpL += (nL - lpL) * (1.0 - currentSmoothing);
        lpR += (nR - lpR) * (1.0 - currentSmoothing);
        
        const env = Math.pow(1 - progress, decayCurve);
        const diffMask = (Math.random() < (0.05 + 0.95 * diffusion)) ? 1 : 0;
        const diffGain = diffMask > 0 ? 1.0 / Math.sqrt(0.05 + 0.95 * diffusion) : 0;

        left[i] = lpL * env * diffMask * diffGain;
        right[i] = lpR * env * diffMask * diffGain;
    }

    const erDuration = Math.floor(0.08 * sampleRate);
    const erCount = Math.floor(8 + density * 12); 
    
    for (let k = 0; k < erCount; k++) {
        const delay = startSample + Math.floor(Math.random() * erDuration);
        if (delay < length) {
            const erAmp = (1.0 - (k / erCount)) * 0.8; 
            const pan = Math.random() * 2 - 1; 
            const gainL = erAmp * (0.5 - 0.5 * pan);
            const gainR = erAmp * (0.5 + 0.5 * pan);
            left[delay] += (Math.random() * 2 - 1) * gainL;
            right[delay] += (Math.random() * 2 - 1) * gainR;
        }
    }

    let maxVal = 0;
    for (let i = 0; i < length; i++) {
        if (Math.abs(left[i]) > maxVal) maxVal = Math.abs(left[i]);
        if (Math.abs(right[i]) > maxVal) maxVal = Math.abs(right[i]);
    }
    const scale = 0.5 / Math.max(0.001, maxVal); 
    for (let i = 0; i < length; i++) {
        left[i] *= scale;
        right[i] *= scale;
    }

    return impulse;
  }

  public setPolyphony(count: number) {
      if (this.workletNode) {
          this.workletNode.port.postMessage({ type: 'config', polyphony: count });
      }
  }

  public setStrumDuration(duration: number) {
      if (this.workletNode) {
          this.workletNode.port.postMessage({ type: 'config', strumDuration: duration });
      }
  }

  public setMasterVolume(val: number) {
    this.currentMasterVol = val;
    this.updateFX();
  }

  public setGlobalSpatialScale(val: number) {
      this.globalSpatialScale = val;
      this.updateFX();
  }

  public setGlobalBrightness(val: number) {
      this.globalBrightness = val;
      this.updateFX();
  }

  public async startVoice(id: string, ratio: number, baseFrequency: number, type: PlayMode = 'normal') {
    if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted')) {
        this.ctx.resume();
    }
    await this.init();
    if (!this.workletNode) return;

    const freq = baseFrequency * ratio;
    this.workletNode.port.postMessage({ 
        type: 'note_on', 
        id: id, 
        freq: freq,
        voiceType: type
    });
  }

  public stopVoice(id: string) {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ 
        type: 'note_off', 
        id: id 
    });
  }

  public glideVoice(id: string, newRatio: number, baseFrequency: number) {
    if (!this.workletNode) return;
    const freq = baseFrequency * newRatio;
    this.workletNode.port.postMessage({ 
        type: 'glide', 
        id: id, 
        freq: freq 
    });
  }

  public stopAll() {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ type: 'stop_all' });
    this.setupFX();
  }
}

export const audioEngine = new AudioEngine();
export default AudioEngine;
