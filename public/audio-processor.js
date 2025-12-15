
// --- DSP UTILS ---
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
    // NaN Guard for Cutoff
    let safeCutoff = cutoff;
    if (!Number.isFinite(safeCutoff)) safeCutoff = 1000;
    // Clamp cutoff to slightly below Nyquist to ensure stability
    safeCutoff = Math.max(20, Math.min(safeCutoff, sampleRate * 0.45));

    // NaN Guard for Resonance
    let safeRes = res;
    if (!Number.isFinite(safeRes)) safeRes = 0;
    
    // NaN Guard for Input
    if (!Number.isFinite(input)) input = 0;

    // State NaN Guard (Self-healing)
    if (!Number.isFinite(this.low) || !Number.isFinite(this.band)) {
        this.reset();
    }

    let f = 2.0 * Math.sin(Math.PI * safeCutoff / sampleRate);
    
    // STABILITY FIX: 
    // Increased offset from 0.5 to 0.9 to prevent instability at Res=0 and High Cutoff.
    // This reduces the maximum damping factor q, keeping the filter stable.
    const q = 1.0 / (safeRes + 0.9);

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
    // Note: We do NOT reset this.value to 0.0 here. 
    // This allows smooth re-triggering if the envelope was in release.
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
    this.phase = Math.random(); // Random start phase for organic feel
    this.blep = new PolyBLEP(sampleRate);
    this.sampleRate = sampleRate;
  }

  reset() {
      // Intentionally empty. 
      // Do NOT reset phase on note on. Free-running oscillators prevent click transients.
  }

  process(freq, type, dt) {
    if (!Number.isFinite(freq) || freq <= 0) return 0.0;

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
    
    // We do NOT reset oscillator phase here.
    
    // We trigger envelopes. If they are already running (stealing), they will ramp from current value.
    this.envs.forEach(env => {
        env.trigger();
    });
    
    // Filter state is reset to prevent blown filters from previous bad states
    this.filters.forEach(f => f.reset());
    
    // LFOs reset to 0 phase for consistency on attack
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

        // Sanitize Modulations
        if (!Number.isFinite(modPitch)) modPitch = 0;
        if (!Number.isFinite(modCutoff)) modCutoff = 0;
        if (!Number.isFinite(modGain)) modGain = 0;
        if (!Number.isFinite(modRes)) modRes = 0;

        const cents = config.coarseDetune + config.fineDetune + hardPitch + (modPitch * 1200);
        const detuneMult = Math.pow(2, cents / 1200.0);
        let oscFreq = this.baseFreq * detuneMult;

        // CRITICAL FIX: Nyquist Clamping to prevent aliasing/static on high notes
        if (oscFreq > this.sampleRate * 0.48) {
            oscFreq = this.sampleRate * 0.48;
        }

        let signal = this.oscs[i].process(oscFreq, config.waveform, dt);

        let cutoff = config.filterCutoff + hardFilter + (modCutoff * 5000);
        let res = config.filterResonance + (modRes * 10);
        if (res < 0) res = 0;
        
        signal = this.filters[i].process(signal, cutoff, res, this.sampleRate);
        
        const gainMod = Math.max(0, 1.0 + modGain); 
        const finalGain = config.gain * envVal * hardAmp * gainMod;
        
        voiceMix += signal * finalGain;
    }
    
    return Number.isFinite(voiceMix) ? voiceMix : 0.0;
  }
}

class PrismaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    for(let i=0; i<32; i++) {
        this.voices.push(new Voice(sampleRate));
    }
    
    this.preset = null;
    this.maxPolyphony = 10; 
    this.oscConfigs = [DUMMY_OSC_CONFIG, DUMMY_OSC_CONFIG, DUMMY_OSC_CONFIG];
    this.modMatrix = [];
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
    if (!Number.isFinite(freq) || freq <= 0) return; 

    for (let i = 0; i < this.voices.length; i++) {
        if (this.voices[i].active && this.voices[i].id === id) {
            this.voices[i].trigger(id, freq);
            return;
        }
    }
    let heldCount = 0;
    let physicallyFree = null;
    let quietestHeld = null;
    let minHeldLevel = 1000.0;
    let quietestVoice = null;
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
        if (v.releaseTime === 0) {
            heldCount++;
            if (level < minHeldLevel) {
                minHeldLevel = level;
                quietestHeld = v;
            }
        }
    }

    if (heldCount >= this.maxPolyphony && quietestHeld) {
        quietestHeld.release();
    }

    if (physicallyFree) {
        physicallyFree.trigger(id, freq);
    } else if (quietestVoice) {
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
        
        // Safety Clamping for Summing Bus
        if (!Number.isFinite(sampleMix)) sampleMix = 0;
        if (sampleMix > 10.0) sampleMix = 10.0;
        if (sampleMix < -10.0) sampleMix = -10.0;

        sampleMix *= 0.1; 
        sampleMix = Math.tanh(sampleMix * 0.7);
        const x = sampleMix;
        // Improved DC Blocker with tighter coeff for low end preservation
        const y = x - this.xm1 + 0.998 * this.ym1;
        this.xm1 = x;
        this.ym1 = y;
        
        // Final Safety
        channelL[s] = Number.isFinite(y) ? y : 0;
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
