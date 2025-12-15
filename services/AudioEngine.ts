
import { SynthPreset, WaveformType, OscillatorConfig, AppSettings } from '../types';
import { store } from './Store';
import { DEFAULT_PRESET } from '../constants';
import { AUDIO_PROCESSOR_CODE } from './AudioProcessorCode';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private initPromise: Promise<void> | null = null;
  
  // FX Chain
  private limiter: DynamicsCompressorNode | null = null;
  private dryGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayOutputGain: GainNode | null = null;

  private currentMasterVol: number = 0.8;
  private activePreset: SynthPreset;

  constructor() {
    // Initialize Preset safely to prevent NaN in Worklet
    const rawPreset = store.getSnapshot().preset;
    this.activePreset = this.ensurePresetSafety(rawPreset);

    store.subscribe(() => {
        const newPreset = store.getSnapshot().preset;
        const safePreset = this.ensurePresetSafety(newPreset);
        this.setPreset(safePreset);
    });
  }

  private ensurePresetSafety(p: any): SynthPreset {
     if (!p) return DEFAULT_PRESET;
     const safe = { ...DEFAULT_PRESET, ...p };
     safe.osc1 = { ...DEFAULT_PRESET.osc1, ...(p.osc1 || {}) };
     safe.osc2 = { ...DEFAULT_PRESET.osc2, ...(p.osc2 || {}) };
     safe.osc3 = { ...DEFAULT_PRESET.osc3, ...(p.osc3 || {}) };
     safe.modMatrix = p.modMatrix || [];
     return safe;
  }

  public async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
                latencyHint: 'interactive',
            });

            try {
                // Load AudioWorklet from Blob to guarantee no 404s in any environment
                const blob = new Blob([AUDIO_PROCESSOR_CODE], { type: 'application/javascript' });
                const workletUrl = URL.createObjectURL(blob);
                
                await this.ctx.audioWorklet.addModule(workletUrl);
                
                // Clean up the object URL after loading
                URL.revokeObjectURL(workletUrl);
                
                this.workletNode = new AudioWorkletNode(this.ctx, 'synth-processor', {
                    numberOfInputs: 0,
                    numberOfOutputs: 1,
                    outputChannelCount: [2]
                });
                
                // Initial preset send
                this.workletNode.port.postMessage({ type: 'preset', data: this.activePreset });
                this.workletNode.port.postMessage({ type: 'config', polyphony: store.getSnapshot().settings.polyphony });

                // Connect logic
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

        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    })();

    return this.initPromise;
  }

  private setupFX() {
    if (!this.ctx) return;

    // Disconnect old nodes if they exist to clear state
    try {
        this.dryGain?.disconnect();
        this.reverbNode?.disconnect();
        this.reverbGain?.disconnect();
        this.delayNode?.disconnect();
        this.delayFeedbackGain?.disconnect();
        this.delayOutputGain?.disconnect();
        this.limiter?.disconnect();
    } catch(e) { /* ignore */ }

    // Rebuild Graph
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -12.0; // Reduced threshold to catch peaks earlier
    this.limiter.ratio.value = 12.0;
    this.limiter.connect(this.ctx.destination);

    this.dryGain = this.ctx.createGain();
    this.dryGain.connect(this.limiter);

    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(2.5, 2.0);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.connect(this.reverbNode);
    this.reverbNode.connect(this.limiter);

    this.delayNode = this.ctx.createDelay(5.0);
    this.delayFeedbackGain = this.ctx.createGain();
    this.delayOutputGain = this.ctx.createGain();
    
    this.delayOutputGain.connect(this.delayNode);
    this.delayNode.connect(this.limiter); 
    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    
    // Reconnect Worklet to new graph
    if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode.connect(this.dryGain);
        this.workletNode.connect(this.reverbGain);
        this.workletNode.connect(this.delayOutputGain);
    }

    this.updateFX();
    this.setMasterVolume(this.currentMasterVol);
  }

  private updateFX() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const ramp = 0.1;

      if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(this.activePreset.reverbMix, now, ramp);
      if (this.delayOutputGain) this.delayOutputGain.gain.setTargetAtTime(this.activePreset.delayMix, now, ramp);
      if (this.delayNode) this.delayNode.delayTime.setTargetAtTime(this.activePreset.delayTime, now, ramp);
      if (this.delayFeedbackGain) this.delayFeedbackGain.gain.setTargetAtTime(this.activePreset.delayFeedback, now, ramp);
      
      if (this.limiter) {
          const thresh = this.activePreset.compressorThreshold ?? -20.0;
          const ratio = this.activePreset.compressorRatio ?? 12;
          const release = this.activePreset.compressorRelease ?? 0.25;

          this.limiter.threshold.setTargetAtTime(thresh, now, ramp);
          this.limiter.ratio.setTargetAtTime(ratio, now, ramp);
          this.limiter.release.setTargetAtTime(release, now, ramp);
      }

      if (this.dryGain) {
          const dryLevel = Math.max(0.5, 1.0 - (this.activePreset.reverbMix * 0.4));
          this.dryGain.gain.setTargetAtTime(dryLevel * this.currentMasterVol, now, ramp);
      }
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    if (!this.ctx) throw new Error("No Context");
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    // FIX: Normalize the Impulse Response to prevent massive gain accumulation
    let maxVal = 0;
    for (let i = 0; i < length; i++) {
        const n = i / length;
        const amp = Math.pow(1 - n, decay);
        left[i] = (Math.random() * 2 - 1) * amp;
        right[i] = (Math.random() * 2 - 1) * amp;
        if (Math.abs(left[i]) > maxVal) maxVal = Math.abs(left[i]);
        if (Math.abs(right[i]) > maxVal) maxVal = Math.abs(right[i]);
    }

    // Normalize
    const scale = 0.1 / Math.max(0.001, maxVal); // Scale down significantly to keep Reverb Gain sensible
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

  public setMasterVolume(val: number) {
    this.currentMasterVol = val;
    this.updateFX();
  }

  public setPreset(preset: SynthPreset) {
    this.activePreset = preset;
    this.updateFX();
    if (this.workletNode) {
        this.workletNode.port.postMessage({ type: 'preset', data: preset });
    }
  }

  public async startVoice(id: string, ratio: number, baseFrequency: number) {
    await this.init();
    if (!this.workletNode) return;

    const freq = baseFrequency * ratio;
    this.workletNode.port.postMessage({ 
        type: 'note_on', 
        id: id, 
        freq: freq 
    });
  }

  public stopVoice(id: string, immediate: boolean = false) {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ 
        type: 'note_off', 
        id: id 
    });
  }

  public glideVoice(id: string, newRatio: number, baseFrequency: number, glideTime: number = 0.1) {
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
    
    // CRITICAL: Rebuild FX chain on Panic to clear any corrupted delay buffers (NaNs)
    // that might be causing infinite feedback loops.
    this.setupFX();
  }
}

export const audioEngine = new AudioEngine();
export default AudioEngine;
