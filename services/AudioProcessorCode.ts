
// --- 1. DSP UTILS & CONSTANTS ---
const DSP_UTILS = `
const TWO_PI = 2 * Math.PI;

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

const DUMMY_PRESET_DATA = {
    osc1: DUMMY_OSC_CONFIG,
    osc2: DUMMY_OSC_CONFIG,
    osc3: DUMMY_OSC_CONFIG,
    modMatrix: [],
    gain: 1.0,
    spread: 0,
    stereoPanSpeed: 0,
    stereoPanDepth: 0
};
`;

// --- 2. BASIC DSP CLASSES (Oscillator, Filter, Envelope) ---
const DSP_CLASSES = `
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
      // Free-running oscillators
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
`;

// --- 3. VOICE LOGIC (Signal Path) ---
const VOICE_LOGIC = `
class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.active = false;
    this.id = '';
    this.type = 'normal'; // Preset selection
    this.mode = 'gate';   // Playback behavior: 'gate', 'trigger', 'latch'
    this.panPos = 0; 
    
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

  trigger(id, freq, type, mode) {
    this.id = id;
    this.type = type || 'normal';
    this.mode = mode || 'gate';
    this.baseFreq = freq;
    this.targetFreq = freq;
    this.active = true;
    this.startTime = currentTime; 
    this.releaseTime = 0; 
    
    this.envs.forEach(env => {
        // Soft reset to avoid clicks on retrigger
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

  process(presetData, dt) {
    if (!this.active || !presetData) return 0.0;
    
    const diff = this.targetFreq - this.baseFreq;
    if (Math.abs(diff) > 0.001) {
      this.baseFreq += diff * 0.005; 
    } else {
      this.baseFreq = this.targetFreq;
    }

    const oscConfigs = [
        presetData.osc1 || DUMMY_OSC_CONFIG,
        presetData.osc2 || DUMMY_OSC_CONFIG,
        presetData.osc3 || DUMMY_OSC_CONFIG
    ];
    const matrix = presetData.modMatrix || [];

    let anyEnvActive = false;

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
`;

// --- 4. PROCESSOR LOGIC (Worklet Core) ---
const PROCESSOR_LOGIC = `
class PrismaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 2x Oversampling setup
    const OVERSAMPLE = 2;
    this.oversample = OVERSAMPLE;
    const workingRate = sampleRate * OVERSAMPLE;

    this.voices = [];
    // Increase physical voice limit to 64
    for(let i=0; i<64; i++) {
        const v = new Voice(workingRate);
        v.panPos = Math.sin(i * 123.456); 
        this.voices.push(v);
    }
    
    this.presets = {
        normal: DUMMY_PRESET_DATA,
        latch: DUMMY_PRESET_DATA,
        strum: DUMMY_PRESET_DATA
    };
    
    this.maxPolyphony = 32; 
    this.strumDuration = 0.5;
    
    this.xm1L = 0; this.ym1L = 0;
    this.xm1R = 0; this.ym1R = 0;
    this.panPhase = 0;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'update_preset') {
        const { mode, data } = msg;
        if (mode && this.presets[mode]) {
            this.presets[mode] = this.normalizePreset(data);
        }
      } else if (msg.type === 'config') {
         if (msg.polyphony) this.maxPolyphony = msg.polyphony;
         if (msg.strumDuration) this.strumDuration = msg.strumDuration;
      } else if (msg.type === 'note_on') {
        // Trigger with optional playbackMode (gate vs trigger)
        this.triggerVoice(msg.id, msg.freq, msg.voiceType, msg.mode);
      } else if (msg.type === 'note_off') {
        this.releaseVoice(msg.id);
      } else if (msg.type === 'glide') {
        this.glideVoice(msg.id, msg.freq);
      } else if (msg.type === 'stop_all') {
         this.voices.forEach(v => v.hardStop());
      }
    };
  }

  normalizePreset(data) {
      return {
          osc1: { ...DUMMY_OSC_CONFIG, ...(data.osc1 || {}) },
          osc2: { ...DUMMY_OSC_CONFIG, ...(data.osc2 || {}) },
          osc3: { ...DUMMY_OSC_CONFIG, ...(data.osc3 || {}) },
          modMatrix: (data.modMatrix || []).map(row => ({
              ...row,
              amount: (Number.isFinite(row.amount) ? row.amount : 0) / 100.0
          })),
          gain: data.gain || 0.5,
          spread: data.spread || 0,
          stereoPanSpeed: data.stereoPanSpeed || 0,
          stereoPanDepth: data.stereoPanDepth || 0
      };
  }

  triggerVoice(id, freq, type, mode) {
    // 1. If voice ID already active (re-trigger), use it
    for (let i = 0; i < this.voices.length; i++) {
        if (this.voices[i].active && this.voices[i].id === id) {
            this.voices[i].trigger(id, freq, type, mode);
            return;
        }
    }

    let activeCount = 0;
    let oldestReleased = null;
    let oldestReleaseTime = Infinity;
    let oldestHeld = null;
    let oldestStartTime = Infinity;
    let freeVoice = null;

    for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        if (v.active) {
            activeCount++;
            if (v.releaseTime > 0) {
                // Releasing voice
                if (v.releaseTime < oldestReleaseTime) {
                    oldestReleaseTime = v.releaseTime;
                    oldestReleased = v;
                }
            } else {
                // Held voice - FIFO
                if (v.startTime < oldestStartTime) {
                    oldestStartTime = v.startTime;
                    oldestHeld = v;
                }
            }
        } else {
            if (!freeVoice) freeVoice = v;
        }
    }

    // 2. Use free voice if under polyphony limit
    if (activeCount < this.maxPolyphony && freeVoice) {
        freeVoice.trigger(id, freq, type, mode);
        return;
    }

    // 3. Steal Priority: Oldest Released -> Oldest Held (FIFO)
    
    const victim = oldestReleased || oldestHeld || freeVoice || this.voices[0];
    if (victim) {
        if (victim.active && victim.id !== id) {
             this.port.postMessage({ type: 'voice_stolen', id: victim.id });
        }
        victim.trigger(id, freq, type, mode);
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
             // Glide only applies if note is sustaining (not already released/decaying triggers)
             // But for 'trigger' mode voices, we allow bending while they decay
             this.voices[i].targetFreq = freq;
        }
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channelL = output[0];
    const channelR = output[1];
    if (!channelL) return true;
    const len = channelL.length;
    
    // Oversampling Constants
    const OVERSAMPLE = this.oversample;
    const workingRate = sampleRate * OVERSAMPLE;
    const dt = 1.0 / workingRate;
    
    const masterPreset = this.presets.normal;
    const panSpeed = (masterPreset.stereoPanSpeed !== undefined) ? masterPreset.stereoPanSpeed : 0.0;
    const panDepth = (masterPreset.stereoPanDepth !== undefined) ? masterPreset.stereoPanDepth : 0.0;

    for (let s = 0; s < len; s++) {
        let accL = 0.0;
        let accR = 0.0;

        // --- OVERSAMPLED LOOP ---
        for (let os = 0; os < OVERSAMPLE; os++) {
            let mixL = 0.0;
            let mixR = 0.0;

            this.panPhase += dt * panSpeed;
            if(this.panPhase > 1.0) this.panPhase -= 1.0;
            const autoPanVal = Math.sin(this.panPhase * TWO_PI) * panDepth;

            for (let i = 0; i < this.voices.length; i++) {
                const v = this.voices[i];
                if (v.active) {
                    // AUTO-RELEASE logic for Trigger Mode (e.g. Strumming)
                    // If mode is 'trigger' (or legacy 'strum' type fallback), enforce auto-release
                    const isTriggerMode = v.mode === 'trigger' || v.type === 'strum'; 
                    
                    if (isTriggerMode && v.releaseTime === 0) {
                        if (currentTime - v.startTime >= this.strumDuration) {
                            v.release();
                        }
                    }

                    const presetToUse = this.presets[v.type] || this.presets.normal;
                    const val = v.process(presetToUse, dt);
                    
                    if (Number.isFinite(val)) {
                        const spreadAmount = presetToUse.spread || 0;
                        let p = v.panPos * spreadAmount;
                        p += autoPanVal;
                        p = Math.max(-1.0, Math.min(1.0, p));
                        
                        const gainL = 0.5 * (1.0 - p);
                        const gainR = 0.5 * (1.0 + p);
                        const voiceGain = presetToUse.gain || 0.5;

                        mixL += val * gainL * voiceGain;
                        mixR += val * gainR * voiceGain;
                    } else {
                        v.hardStop();
                    }
                }
            }
            
            // --- NON-LINEARITIES (Apply at 2x rate to reduce aliasing) ---
            mixL *= 0.05; // Headroom
            mixR *= 0.05;
            
            // Soft Clipper
            mixL = Math.tanh(mixL * 0.8);
            mixR = Math.tanh(mixR * 0.8);

            accL += mixL;
            accR += mixR;
        }

        // --- DOWNSAMPLE (Decimation) ---
        const outL = accL / OVERSAMPLE;
        const outR = accR / OVERSAMPLE;

        // --- DC BLOCKER (Linear, safe at 1x) ---
        const yL = outL - this.xm1L + 0.995 * this.ym1L;
        this.xm1L = outL;
        this.ym1L = yL;
        
        const yR = outR - this.xm1R + 0.995 * this.ym1R;
        this.xm1R = outR;
        this.ym1R = yR;

        channelL[s] = yL;
        if (channelR) channelR[s] = yR;
    }
    
    return true;
  }
}

registerProcessor('synth-processor', PrismaProcessor);
`;

export const AUDIO_PROCESSOR_CODE = `${DSP_UTILS}\n${DSP_CLASSES}\n${VOICE_LOGIC}\n${PROCESSOR_LOGIC}`;