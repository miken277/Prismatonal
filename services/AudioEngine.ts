
import { SynthPreset, WaveformType, OscillatorConfig } from '../types';

// --- DSP WORKLET CODE ---
// In a production app, this would be a separate file (e.g., public/worklet.js).
// We inline it here to ensure it works immediately without build configuration changes.

const WORKLET_CODE = `
// --- DSP UTILS ---
const TWO_PI = 2 * Math.PI;

class PolyBLEP {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
  }

  get(t, dt) {
    // 0 <= t < 1
    if (t < dt) {
      t /= dt;
      return t + t - t * t - 1.0;
    } else if (t > 1.0 - dt) {
      t = (t - 1.0) / dt;
      return t * t + t + t + 1.0;
    }
    return 0.0;
  }
}

class SVF {
  constructor() {
    this.low = 0.0;
    this.band = 0.0;
    this.high = 0.0;
    this.notch = 0.0;
  }

  // cutoff in Hz, res (Q) 0..inf
  process(input, cutoff, res, sampleRate) {
    // Pre-warp cutoff for stability
    let f = 2.0 * Math.sin(Math.PI * cutoff / sampleRate);
    // Clamp f to prevent instability at high frequencies
    if (f > 0.9) f = 0.9;
    
    // Damping factor
    const q = 1.0 / (res + 0.001); 

    this.low += f * this.band;
    this.high = input - this.low - q * this.band;
    this.band += f * this.high;
    this.notch = this.high + this.low;

    return this.low; // Returning Lowpass by default for this synth
  }
}

class Envelope {
  constructor() {
    this.stage = 'idle'; // idle, attack, decay, sustain, release
    this.value = 0.0;
    this.velocity = 0.0;
    this.releaseLevel = 0.0;
  }

  trigger(velocity = 1.0) {
    this.stage = 'attack';
    this.velocity = velocity;
  }

  release() {
    if (this.stage !== 'idle') {
        this.stage = 'release';
        this.releaseLevel = this.value;
    }
  }

  process(config, dt) {
    switch (this.stage) {
      case 'idle':
        this.value = 0.0;
        return 0.0;

      case 'attack':
        // Linear Attack
        const attRate = 1.0 / (config.attack + 0.001);
        this.value += attRate * dt;
        if (this.value >= 1.0) {
          this.value = 1.0;
          this.stage = 'decay';
        }
        return this.value * this.velocity;

      case 'decay':
        // Exponential approach to Sustain
        const decRate = 1.0 / (config.decay + 0.001);
        // Lerp towards sustain
        this.value += (config.sustain - this.value) * (decRate * dt * 5.0); 
        return this.value * this.velocity;

      case 'sustain':
        this.value = config.sustain;
        return this.value * this.velocity;

      case 'release':
        // Exponential release
        const relRate = 1.0 / (config.release + 0.001);
        this.value -= this.value * (relRate * dt * 5.0);
        if (this.value < 0.001) {
          this.value = 0.0;
          this.stage = 'idle';
        }
        return this.value * this.velocity;
      
      default:
        return 0.0;
    }
  }
}

class Oscillator {
  constructor(sampleRate) {
    this.phase = Math.random(); // Randomize phase to avoid stacking peaks
    this.blep = new PolyBLEP(sampleRate);
    this.sampleRate = sampleRate;
  }

  process(freq, type, dt) {
    this.phase += dt * freq;
    while (this.phase >= 1.0) this.phase -= 1.0;

    let sample = 0.0;
    
    switch (type) {
      case 'sine':
        sample = Math.sin(TWO_PI * this.phase);
        break;
        
      case 'triangle':
        // Naive triangle
        let t = -1.0 + (2.0 * this.phase);
        sample = 2.0 * (Math.abs(t) - 0.5);
        // Apply some smoothing could be good, but naive is usually okay for triangle
        break;

      case 'sawtooth':
        // Naive Saw: 2 * phase - 1
        // PolyBLEP Saw: Naive + Correction
        sample = (2.0 * this.phase) - 1.0;
        sample -= this.blep.get(this.phase, dt * freq);
        break;

      case 'square':
        // Naive Square: phase < 0.5 ? 1 : -1
        // PolyBLEP Square: Integrated PolyBLEP of two saw waves offset by 0.5
        sample = this.phase < 0.5 ? 1.0 : -1.0;
        sample += this.blep.get(this.phase, dt * freq);
        // Offset by 0.5 phase for the second edge
        let phase2 = (this.phase + 0.5) % 1.0;
        sample -= this.blep.get(phase2, dt * freq);
        break;
    }
    
    return sample;
  }
}

class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.active = false;
    this.id = '';
    this.baseFreq = 440;
    this.targetFreq = 440;
    this.glideRate = 0.0;
    
    // 3 Oscillators
    this.oscs = [
        new Oscillator(sampleRate),
        new Oscillator(sampleRate),
        new Oscillator(sampleRate)
    ];

    // Per-Oscillator SVF Filters
    this.filters = [
        new SVF(),
        new SVF(),
        new SVF()
    ];
    
    // Per-Oscillator Envelopes
    this.envs = [
        new Envelope(),
        new Envelope(),
        new Envelope()
    ];
    
    // Single LFO for now (Global per voice to save CPU)
    this.lfoPhase = 0.0;
  }

  trigger(id, freq) {
    this.id = id;
    this.baseFreq = freq;
    this.targetFreq = freq;
    this.active = true;
    
    // Reset envelopes
    this.envs.forEach(env => env.trigger());
  }

  release() {
    this.envs.forEach(env => env.release());
  }

  process(preset) {
    if (!this.active) return 0.0;

    // Glide Logic (Exponential slide)
    // PREVIOUS: 0.1 per sample (approx 0.5ms smoothing) - Too fast, causes granularity with mouse events
    // NEW: 0.002 per sample (approx 20-30ms smoothing) - Bridges the gap between 60Hz events
    if (Math.abs(this.targetFreq - this.baseFreq) > 0.001) {
      this.baseFreq += (this.targetFreq - this.baseFreq) * 0.002; 
    } else {
      this.baseFreq = this.targetFreq;
    }

    // Check if voice is finished
    let allIdle = true;
    this.envs.forEach((env, i) => {
        // Only check enabled oscillators' envelopes
        const config = preset['osc' + (i+1)];
        if (config && config.enabled) {
            if (env.stage !== 'idle') allIdle = false;
        }
    });

    if (allIdle) {
      this.active = false;
      return 0.0;
    }

    let voiceMix = 0.0;
    const dt = 1.0 / this.sampleRate;

    // Process Oscillators
    for (let i = 0; i < 3; i++) {
        const config = preset['osc' + (i+1)];
        if (!config || !config.enabled) continue;

        // Envelope
        const envVal = this.envs[i].process(config, dt);
        
        // Skip if silent
        if (envVal < 0.0001) continue;

        // LFO Calculation
        let lfoVal = 0.0;
        if (config.lfoTarget !== 'none') {
            this.lfoPhase += config.lfoRate * dt;
            if (this.lfoPhase >= 1.0) this.lfoPhase -= 1.0;
            lfoVal = Math.sin(TWO_PI * this.lfoPhase); // Simple Sine LFO
        }

        // Modulations
        let modPitch = 0;
        let modFilter = 0;
        let modAmp = 1.0;

        if (config.lfoTarget === 'pitch') modPitch = lfoVal * config.lfoDepth; // Hz approx
        if (config.lfoTarget === 'filter') modFilter = lfoVal * config.lfoDepth * 20;
        if (config.lfoTarget === 'tremolo') modAmp = 1.0 - (lfoVal * (config.lfoDepth / 100) * 0.5);

        // Frequency with Detune
        const cents = config.coarseDetune + config.fineDetune;
        const detuneMult = Math.pow(2, cents / 1200.0);
        const oscFreq = (this.baseFreq + modPitch) * detuneMult;

        // Generate Raw
        let signal = this.oscs[i].process(oscFreq, config.waveform, dt);

        // Filter
        let cutoff = config.filterCutoff + modFilter;
        if (cutoff < 20) cutoff = 20;
        if (cutoff > 20000) cutoff = 20000;
        
        signal = this.filters[i].process(signal, cutoff, config.filterResonance, this.sampleRate);

        // Mix
        voiceMix += signal * config.gain * envVal * modAmp;
    }
    
    return voiceMix;
  }
}

class PrismaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    for(let i=0; i<16; i++) {
        this.voices.push(new Voice(sampleRate));
    }
    
    this.preset = null;
    this.nextVoiceIndex = 0;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'preset') {
        this.preset = msg.data;
      } else if (msg.type === 'note_on') {
        this.triggerVoice(msg.id, msg.freq);
      } else if (msg.type === 'note_off') {
        this.releaseVoice(msg.id);
      } else if (msg.type === 'glide') {
        this.glideVoice(msg.id, msg.freq);
      } else if (msg.type === 'stop_all') {
         this.voices.forEach(v => { v.active = false; v.envs.forEach(e => e.stage = 'idle'); });
      }
    };
  }

  triggerVoice(id, freq) {
    // 1. Check if voice ID already active (retrigger)
    const existing = this.voices.find(v => v.id === id && v.active);
    if (existing) {
        existing.trigger(id, freq);
        return;
    }

    // 2. Find free voice
    let voice = this.voices.find(v => !v.active);
    
    // 3. Steal voice (Round Robin for now, could be smarter)
    if (!voice) {
        voice = this.voices[this.nextVoiceIndex];
        this.nextVoiceIndex = (this.nextVoiceIndex + 1) % this.voices.length;
    }

    voice.trigger(id, freq);
  }

  releaseVoice(id) {
    const voice = this.voices.find(v => v.id === id && v.active);
    if (voice) {
        voice.release();
    }
  }

  glideVoice(id, freq) {
    const voice = this.voices.find(v => v.id === id && v.active);
    if (voice) {
        voice.targetFreq = freq;
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.preset) return true;

    const output = outputs[0];
    const channelL = output[0];
    const channelR = output[1];
    
    // Safety check for uninitialized buffers
    if (!channelL) return true;

    // Zero out buffers
    for (let i = 0; i < channelL.length; i++) {
        channelL[i] = 0.0;
        if (channelR) channelR[i] = 0.0;
    }

    const masterGain = this.preset.gain || 1.0;
    const len = channelL.length;

    // Mix active voices
    for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        if (v.active) {
            for (let s = 0; s < len; s++) {
                const sample = v.process(this.preset);
                channelL[s] += sample;
            }
        }
    }

    // Apply Master Gain & Copy to Right Channel (Mono Synth -> Stereo Out)
    for (let s = 0; s < len; s++) {
        channelL[s] *= masterGain;
        if (channelR) channelR[s] = channelL[s];
    }

    return true;
  }
}

registerProcessor('synth-processor', PrismaProcessor);
`;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  
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

  constructor(preset: SynthPreset) {
    this.activePreset = preset;
  }

  public async init() {
    if (this.ctx) return; // Already initialized

    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive',
    });

    // 1. Setup Worklet
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    try {
        await this.ctx.audioWorklet.addModule(url);
        this.workletNode = new AudioWorkletNode(this.ctx, 'synth-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2]
        });
        
        // Initial preset send
        this.workletNode.port.postMessage({ type: 'preset', data: this.activePreset });

    } catch (e) {
        console.error("Failed to load AudioWorklet", e);
        return;
    }

    // 2. Setup FX Chain
    this.setupFX();
    
    // 3. Connect Worklet -> Split -> FX
    if (this.workletNode && this.dryGain && this.reverbGain && this.delayOutputGain) {
         this.workletNode.connect(this.dryGain);
         this.workletNode.connect(this.reverbGain);
         this.workletNode.connect(this.delayOutputGain);
    }
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupFX() {
    if (!this.ctx) return;

    // Limiter (Master Output)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.0;
    this.limiter.connect(this.ctx.destination);

    // Dry Bus
    this.dryGain = this.ctx.createGain();
    this.dryGain.connect(this.limiter);

    // Reverb Bus
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(2.5, 2.0);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.connect(this.reverbNode);
    this.reverbNode.connect(this.limiter);

    // Delay Bus
    this.delayNode = this.ctx.createDelay(5.0);
    this.delayFeedbackGain = this.ctx.createGain();
    this.delayOutputGain = this.ctx.createGain();
    
    this.delayOutputGain.connect(this.delayNode);
    this.delayNode.connect(this.limiter); // Delay to Master
    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode); // Feedback loop

    this.updateFX();
    this.setMasterVolume(this.currentMasterVol);
  }

  private updateFX() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const ramp = 0.1;

      // Update Gains
      if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(this.activePreset.reverbMix, now, ramp);
      if (this.delayOutputGain) this.delayOutputGain.gain.setTargetAtTime(this.activePreset.delayMix, now, ramp);
      if (this.delayNode) this.delayNode.delayTime.setTargetAtTime(this.activePreset.delayTime, now, ramp);
      if (this.delayFeedbackGain) this.delayFeedbackGain.gain.setTargetAtTime(this.activePreset.delayFeedback, now, ramp);
      
      // Update Dynamics (Compressor/Limiter)
      if (this.limiter) {
          const thresh = this.activePreset.compressorThreshold ?? -1.0;
          const ratio = this.activePreset.compressorRatio ?? 20;
          const release = this.activePreset.compressorRelease ?? 0.2;

          this.limiter.threshold.setTargetAtTime(thresh, now, ramp);
          this.limiter.ratio.setTargetAtTime(ratio, now, ramp);
          this.limiter.release.setTargetAtTime(release, now, ramp);
      }

      // Dry attenuation based on reverb mix to prevent total volume doubling
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

    for (let i = 0; i < length; i++) {
        const n = i / length;
        // Simple noise burst with exponential decay
        const amp = Math.pow(1 - n, decay);
        left[i] = (Math.random() * 2 - 1) * amp;
        right[i] = (Math.random() * 2 - 1) * amp;
    }
    return impulse;
  }

  public setPolyphony(count: number) {
      // Handled in worklet statically for now (16 voices), 
      // but we could send a config message to limit it dynamically if needed.
  }

  public setMasterVolume(val: number) {
    this.currentMasterVol = val;
    this.updateFX();
  }

  public setPreset(preset: SynthPreset) {
    this.activePreset = preset;
    this.updateFX(); // Update Main Thread FX
    
    // Update Worklet Synth Params
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
    // The Worklet handles the release envelope internally when it receives note_off
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
  }
}

export default AudioEngine;
