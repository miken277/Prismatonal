
import { SynthPreset, WaveformType, OscillatorConfig, AppSettings } from '../types';
import { store } from './Store';
import { DEFAULT_PRESET } from '../constants';

// --- DSP WORKLET CODE ---
const WORKLET_CODE = `
// --- DSP UTILS ---
const TWO_PI = 2 * Math.PI;

// Safe Default Config
const DUMMY_OSC_CONFIG = {
    enabled: false,
    waveform: 'sine',
    coarseDetune: 0,
    fineDetune: 0,
    gain: 0,
    attack: 0.1,
    decay: 0.1,
    sustain: 0,
    release: 0.1,
    filterCutoff: 20000,
    filterResonance: 0,
    lfoRate: 1,
    lfoDepth: 0,
    lfoTarget: 'none'
};

class PolyBLEP {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
  }

  get(t, dt) {
    if (dt < 1e-9) return 0.0;
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

  reset() {
    this.low = 0.0;
    this.band = 0.0;
    this.high = 0.0;
    this.notch = 0.0;
  }

  process(input, cutoff, res, sampleRate) {
    const safeCutoff = Math.max(20, Math.min(cutoff, sampleRate * 0.42));
    let f = 2.0 * Math.sin(Math.PI * safeCutoff / sampleRate);
    
    // Stability Fix: Map resonance input (0..N) to Q factor safely.
    const q = 1.0 / (res + 0.5);

    this.low += f * this.band;
    this.high = input - this.low - q * this.band;
    this.band += f * this.high;
    this.notch = this.high + this.low;

    return this.low; 
  }
}

class Envelope {
  constructor() {
    this.stage = 'idle'; 
    this.value = 0.0;
    this.velocity = 0.0;
  }

  trigger(velocity = 1.0) {
    this.stage = 'attack';
    this.velocity = velocity;
  }

  release() {
    if (this.stage !== 'idle') {
        this.stage = 'release';
    }
  }

  reset() {
      this.stage = 'idle';
      this.value = 0.0;
  }

  process(config, dt) {
    const att = (config.attack !== undefined) ? config.attack : 0.01;
    const dec = (config.decay !== undefined) ? config.decay : 0.1;
    const sus = (config.sustain !== undefined) ? config.sustain : 1.0;
    const rel = (config.release !== undefined) ? config.release : 0.1;

    switch (this.stage) {
      case 'idle':
        this.value = 0.0;
        return 0.0;

      case 'attack':
        const attRate = 1.0 / (Math.max(0.001, att));
        this.value += attRate * dt;
        if (this.value >= 1.0) {
          this.value = 1.0;
          this.stage = 'decay';
        }
        return this.value * this.velocity;

      case 'decay':
        const decRate = 1.0 / (Math.max(0.001, dec));
        this.value += (sus - this.value) * (decRate * dt * 5.0); 
        return this.value * this.velocity;

      case 'sustain':
        this.value = sus;
        return this.value * this.velocity;

      case 'release':
        const relRate = 1.0 / (Math.max(0.001, rel));
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
    this.phase = 0.0; 
    this.blep = new PolyBLEP(sampleRate);
    this.sampleRate = sampleRate;
  }

  reset() {
      this.phase = 0.0;
  }

  process(freq, type, dt) {
    if (!Number.isFinite(freq) || freq <= 0 || freq > 24000) return 0.0;

    this.phase += dt * freq;
    while (this.phase >= 1.0) this.phase -= 1.0;

    let sample = 0.0;
    
    switch (type) {
      case 'sine':
        sample = Math.sin(TWO_PI * this.phase);
        break;
      case 'triangle':
        let t = -1.0 + (2.0 * this.phase);
        sample = 2.0 * (Math.abs(t) - 0.5);
        break;
      case 'sawtooth':
        sample = (2.0 * this.phase) - 1.0;
        sample -= this.blep.get(this.phase, dt * freq);
        break;
      case 'square':
        sample = this.phase < 0.5 ? 1.0 : -1.0;
        sample += this.blep.get(this.phase, dt * freq);
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
    this.startTime = 0; 
    this.releaseTime = 0; 
    
    this.oscs = [
        new Oscillator(sampleRate),
        new Oscillator(sampleRate),
        new Oscillator(sampleRate)
    ];

    this.filters = [ new SVF(), new SVF(), new SVF() ];
    this.envs = [ new Envelope(), new Envelope(), new Envelope() ];
    this.lfoPhases = [0.0, 0.0, 0.0];
    this.envVals = new Float32Array(3);
    this.lfoVals = new Float32Array(3);
  }

  trigger(id, freq) {
    this.id = id;
    this.baseFreq = freq;
    this.targetFreq = freq;
    this.active = true;
    this.startTime = currentTime; 
    this.releaseTime = 0; 
    
    // CRITICAL: Reset phase on trigger to prevent transient clicks
    this.oscs.forEach(osc => osc.reset());
    
    // CRITICAL: Reset envelopes to 0 before triggering to prevent clicks if stealing a loud voice
    this.envs.forEach(env => {
        env.reset();
        env.trigger();
    });
    
    this.filters.forEach(f => f.reset());
    this.lfoPhases.fill(0.0);
  }

  release() {
    this.releaseTime = currentTime;
    this.envs.forEach(env => env.release());
  }
  
  hardStop() {
      this.active = false;
      this.envs.forEach(env => env.reset());
      this.filters.forEach(f => f.reset());
  }

  getLevel() {
    return Math.max(this.envs[0].value, this.envs[1].value, this.envs[2].value);
  }

  process(oscConfigs, matrix, dt) {
    if (!this.active) return 0.0;
    
    const diff = this.targetFreq - this.baseFreq;
    if (Math.abs(diff) > 0.001) {
      this.baseFreq += diff * 0.005; 
    } else {
      this.baseFreq = this.targetFreq;
    }

    let anyEnvActive = false;

    // 1. Compute Sources
    for (let i = 0; i < 3; i++) {
        const config = oscConfigs[i];
        const envVal = this.envs[i].process(config, dt);
        this.envVals[i] = envVal;
        if (this.envs[i].stage !== 'idle') anyEnvActive = true;

        const rate = (config.lfoRate !== undefined) ? config.lfoRate : 0.0;
        this.lfoPhases[i] += rate * dt;
        if (this.lfoPhases[i] >= 1.0) this.lfoPhases[i] -= 1.0;
        this.lfoVals[i] = Math.sin(TWO_PI * this.lfoPhases[i]);
    }

    if (!anyEnvActive) {
      this.active = false;
      return 0.0;
    }

    let modP1=0, modP2=0, modP3=0;
    let modC1=0, modC2=0, modC3=0;
    let modG1=0, modG2=0, modG3=0;
    let modR1=0, modR2=0, modR3=0;

    const mLen = matrix.length;
    for(let i=0; i<mLen; i++) {
        const row = matrix[i];
        if (!row.enabled) continue;

        let srcVal = 0;
        switch(row.source) {
            case 'lfo1': srcVal = this.lfoVals[0]; break;
            case 'lfo2': srcVal = this.lfoVals[1]; break;
            case 'lfo3': srcVal = this.lfoVals[2]; break;
            case 'env1': srcVal = this.envVals[0]; break;
            case 'env2': srcVal = this.envVals[1]; break;
            case 'env3': srcVal = this.envVals[2]; break;
        }
        
        const amt = srcVal * (Number.isFinite(row.amount) ? row.amount : 0);

        switch(row.target) {
            case 'osc1_pitch': modP1 += amt; break;
            case 'osc1_cutoff': modC1 += amt; break;
            case 'osc1_gain': modG1 += amt; break;
            case 'osc1_res': modR1 += amt; break;
            case 'osc2_pitch': modP2 += amt; break;
            case 'osc2_cutoff': modC2 += amt; break;
            case 'osc2_gain': modG2 += amt; break;
            case 'osc2_res': modR2 += amt; break;
            case 'osc3_pitch': modP3 += amt; break;
            case 'osc3_cutoff': modC3 += amt; break;
            case 'osc3_gain': modG3 += amt; break;
            case 'osc3_res': modR3 += amt; break;
        }
    }

    let voiceMix = 0.0;

    for (let i = 0; i < 3; i++) {
        const config = oscConfigs[i];
        if (!config.enabled) continue;

        const envVal = this.envVals[i];
        if (envVal < 0.0001) continue;

        let lfoVal = this.lfoVals[i];
        const lfoDepth = config.lfoDepth || 0;
        let hardPitch = 0, hardFilter = 0, hardAmp = 1.0;
        
        if (config.lfoTarget === 'pitch') hardPitch = lfoVal * lfoDepth;
        else if (config.lfoTarget === 'filter') hardFilter = lfoVal * lfoDepth * 20;
        else if (config.lfoTarget === 'tremolo') hardAmp = 1.0 - (lfoVal * (lfoDepth * 0.005));

        let modPitch=0, modCutoff=0, modGain=0, modRes=0;
        if (i===0) { modPitch=modP1; modCutoff=modC1; modGain=modG1; modRes=modR1; }
        else if (i===1) { modPitch=modP2; modCutoff=modC2; modGain=modG2; modRes=modR2; }
        else { modPitch=modP3; modCutoff=modC3; modGain=modG3; modRes=modR3; }

        const cents = config.coarseDetune + config.fineDetune + hardPitch + (modPitch * 1200);
        const detuneMult = Math.pow(2, cents / 1200.0);
        const oscFreq = this.baseFreq * detuneMult;

        let signal = this.oscs[i].process(oscFreq, config.waveform, dt);

        let cutoff = config.filterCutoff + hardFilter + (modCutoff * 5000);
        let res = config.filterResonance + (modRes * 10);
        if (res < 0) res = 0;
        
        signal = this.filters[i].process(signal, cutoff, res, this.sampleRate);
        
        const gainMod = Math.max(0, 1.0 + modGain); 
        const finalGain = config.gain * envVal * hardAmp * gainMod;
        
        voiceMix += signal * finalGain;
    }
    
    return voiceMix;
  }
}

class PrismaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    // Initialize ample voice pool to allow for release tails overlap
    for(let i=0; i<32; i++) {
        this.voices.push(new Voice(sampleRate));
    }
    
    this.preset = null;
    this.maxPolyphony = 10; 
    this.oscConfigs = [DUMMY_OSC_CONFIG, DUMMY_OSC_CONFIG, DUMMY_OSC_CONFIG];
    this.modMatrix = [];
    
    // DC Blocker State
    this.xm1 = 0;
    this.ym1 = 0;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'preset') {
        this.updatePreset(msg.data);
      } else if (msg.type === 'config') {
         if (msg.polyphony) this.maxPolyphony = msg.polyphony;
      } else if (msg.type === 'note_on') {
        this.triggerVoice(msg.id, msg.freq);
      } else if (msg.type === 'note_off') {
        this.releaseVoice(msg.id);
      } else if (msg.type === 'glide') {
        this.glideVoice(msg.id, msg.freq);
      } else if (msg.type === 'stop_all') {
         this.voices.forEach(v => v.hardStop());
      }
    };
  }

  updatePreset(data) {
      this.preset = data;
      this.oscConfigs = [
          { ...DUMMY_OSC_CONFIG, ...(data.osc1 || {}) },
          { ...DUMMY_OSC_CONFIG, ...(data.osc2 || {}) },
          { ...DUMMY_OSC_CONFIG, ...(data.osc3 || {}) }
      ];
      this.modMatrix = (data.modMatrix || []).map(row => ({
          ...row,
          amount: (Number.isFinite(row.amount) ? row.amount : 0) / 100.0
      }));
  }

  triggerVoice(id, freq) {
    // 1. Retrigger existing if active
    for (let i = 0; i < this.voices.length; i++) {
        if (this.voices[i].active && this.voices[i].id === id) {
            this.voices[i].trigger(id, freq);
            return;
        }
    }

    // 2. Count "Musically Held" voices (Active AND Not Released)
    let heldCount = 0;
    let physicallyFree = null;
    let quietestHeld = null;
    let minHeldLevel = 1000.0;
    let quietestVoice = null; // For hard steal fallback
    let minLevel = 1000.0;

    for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        
        if (!v.active) {
            if (!physicallyFree) physicallyFree = v;
            continue;
        }

        const level = v.getLevel();
        if (level < minLevel) {
            minLevel = level;
            quietestVoice = v;
        }

        // Check if held (releaseTime === 0 implies note is held)
        if (v.releaseTime === 0) {
            heldCount++;
            if (level < minHeldLevel) {
                minHeldLevel = level;
                quietestHeld = v;
            }
        }
    }

    // 3. Soft Steal Strategy
    // If we reached the musical polyphony limit, force the oldest/quietest HELD note into release phase.
    // This allows it to fade out naturally using one of the extra physical voices, rather than being cut off.
    if (heldCount >= this.maxPolyphony && quietestHeld) {
        quietestHeld.release();
    }

    // 4. Voice Allocation
    if (physicallyFree) {
        physicallyFree.trigger(id, freq);
    } else if (quietestVoice) {
        // Fallback: Hard Steal if all 32 physical voices are busy (very rare)
        quietestVoice.trigger(id, freq);
    }
  }

  releaseVoice(id) {
    for (let i = 0; i < this.voices.length; i++) {
        if (this.voices[i].active && this.voices[i].id === id) {
            this.voices[i].release();
        }
    }
  }

  glideVoice(id, freq) {
    for (let i = 0; i < this.voices.length; i++) {
        if (this.voices[i].active && this.voices[i].id === id) {
             this.voices[i].targetFreq = freq;
        }
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.preset) return true;

    const output = outputs[0];
    const channelL = output[0];
    const channelR = output[1];
    
    if (!channelL) return true;
    
    const len = channelL.length;
    const dt = 1.0 / sampleRate;

    for (let s = 0; s < len; s++) {
        let sampleMix = 0.0;
        
        for (let i = 0; i < this.voices.length; i++) {
            const v = this.voices[i];
            if (v.active) {
                const val = v.process(this.oscConfigs, this.modMatrix, dt);
                if (Number.isFinite(val)) {
                    sampleMix += val;
                } else {
                    v.hardStop();
                }
            }
        }
        
        // 1. Aggressive Gain Staging (Headroom)
        // With up to 3 oscillators per voice and polyphony, we must attenuate before clipper
        sampleMix *= 0.1; 

        // 2. Soft Clipper (Tanh)
        sampleMix = Math.tanh(sampleMix * 0.7);

        // 3. DC Blocker
        const x = sampleMix;
        const y = x - this.xm1 + 0.995 * this.ym1;
        this.xm1 = x;
        this.ym1 = y;
        
        channelL[s] = y;
    }

    const masterGain = this.preset.gain;
    if (channelR) {
        for (let s = 0; s < len; s++) {
            channelL[s] *= masterGain;
            channelR[s] = channelL[s];
        }
    } else {
        for (let s = 0; s < len; s++) {
            channelL[s] *= masterGain;
        }
    }

    return true;
  }
}

registerProcessor('synth-processor', PrismaProcessor);
`;

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
    const rawPreset = store.preset;
    this.activePreset = this.ensurePresetSafety(rawPreset);

    store.subscribe(() => {
        const newPreset = store.preset;
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
                this.workletNode.port.postMessage({ type: 'config', polyphony: store.settings.polyphony });

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
