
export const AUDIO_PROCESSOR_CODE = `
// --- 1. DSP UTILS & CONSTANTS ---

const TWO_PI = 2 * Math.PI;

// Global synthesis state
let wavetableSize = 8192;
let wavetableMask = 8191;
let wavetable = new Float32Array(wavetableSize + 4); // Padding for safety
let interpolationType = 'linear'; // 'linear' | 'cubic'

function generateWavetable(size) {
    wavetableSize = size;
    wavetableMask = size - 1;
    wavetable = new Float32Array(wavetableSize + 4); 
    
    // Generate Sine
    for (let i = 0; i < wavetableSize; i++) {
        wavetable[i] = Math.sin((i / wavetableSize) * TWO_PI);
    }
    
    // Pad for Linear/Cubic without expensive modulo in loop
    // Copy first few samples to the end
    wavetable[wavetableSize] = wavetable[0];
    wavetable[wavetableSize + 1] = wavetable[1];
    wavetable[wavetableSize + 2] = wavetable[2];
    wavetable[wavetableSize + 3] = wavetable[3];
}

// Initial Generation
generateWavetable(8192);

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

// --- 2. BASIC DSP CLASSES ---

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
        {
            // Use the global wavetable
            const ptr = this.phase * wavetableSize;
            const i = Math.floor(ptr);
            const f = ptr - i;
            
            if (interpolationType === 'cubic') {
                // 4-point Cubic Hermite Interpolation
                // Indices. Note: i is 0..size-1.
                // We need indices: i-1, i, i+1, i+2
                
                // For i-1, we need to wrap if i=0.
                // Because we pad the end, we can assume i, i+1, i+2 are valid in linear buffer.
                // But i-1 is tricky at index 0.
                
                let y0, y1, y2, y3;
                
                if (i === 0) {
                    y0 = wavetable[wavetableSize - 1]; // Wrap around for -1
                    y1 = wavetable[0];
                    y2 = wavetable[1];
                    y3 = wavetable[2];
                } else {
                    y0 = wavetable[i - 1];
                    y1 = wavetable[i];
                    y2 = wavetable[i + 1]; // Safe due to padding
                    y3 = wavetable[i + 2]; // Safe due to padding
                }

                const c0 = y1;
                const c1 = 0.5 * (y2 - y0);
                const c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
                const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
                
                sample = ((c3 * f + c2) * f + c1) * f + c0;
            } else {
                // Linear Interpolation
                // Safe access due to padding at end
                sample = wavetable[i] + f * (wavetable[i + 1] - wavetable[i]);
            }
        }
        break;
      case 'triangle':
        {
            let t = -1.0 + (2.0 * this.phase);
            sample = 2.0 * (Math.abs(t) - 0.5);
        }
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

// --- 3. VOICE LOGIC ---

class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.active = false;
    this.id = '';
    this.type = 'normal';
    this.mode = 'gate';
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

  updateSampleRate(newRate) {
      if (this.sampleRate === newRate) return;
      this.sampleRate = newRate;
      this.oscs.forEach(osc => { osc.sampleRate = newRate; osc.blep.sampleRate = newRate; });
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

  renderBlock(preset, dt, bufL, bufR, len, panSpeed, panDepth, startPanPhase, globalBend) {
    if (!this.active) return;

    const diff = this.targetFreq - this.baseFreq;
    if (Math.abs(diff) > 0.001) {
      this.baseFreq += diff * 0.005; 
    } else {
      this.baseFreq = this.targetFreq;
    }

    const osc1 = preset.osc1 || DUMMY_OSC_CONFIG;
    const osc2 = preset.osc2 || DUMMY_OSC_CONFIG;
    const osc3 = preset.osc3 || DUMMY_OSC_CONFIG;
    const matrix = preset.modMatrix || [];
    const spreadAmount = preset.spread || 0;
    const voiceGain = preset.gain || 0.5;
    const hasMatrix = matrix.length > 0;

    let anyEnvActive = false;
    let panPhase = startPanPhase;

    const lfoRate1 = osc1.lfoRate || 0;
    const lfoRate2 = osc2.lfoRate || 0;
    const lfoRate3 = osc3.lfoRate || 0;

    let osc1StaticFreq = 0, osc2StaticFreq = 0, osc3StaticFreq = 0;
    let osc1ModPitch = false, osc2ModPitch = false, osc3ModPitch = false;

    if (osc1.enabled) {
        if (osc1.lfoTarget === 'pitch') osc1ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc1_pitch')) osc1ModPitch = true;
        if (!osc1ModPitch) {
            const cents = osc1.coarseDetune + osc1.fineDetune;
            osc1StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
        }
    }
    
    if (osc2.enabled) {
        if (osc2.lfoTarget === 'pitch') osc2ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc2_pitch')) osc2ModPitch = true;
        if (!osc2ModPitch) {
            const cents = osc2.coarseDetune + osc2.fineDetune;
            osc2StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
        }
    }

    if (osc3.enabled) {
        if (osc3.lfoTarget === 'pitch') osc3ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc3_pitch')) osc3ModPitch = true;
        if (!osc3ModPitch) {
            const cents = osc3.coarseDetune + osc3.fineDetune;
            osc3StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
        }
    }

    for (let s = 0; s < len; s++) {
        anyEnvActive = false;
        
        const env1 = this.envs[0].process(osc1, dt);
        this.envVals[0] = env1;
        if (this.envs[0].stage !== 'idle') anyEnvActive = true;
        this.lfoPhases[0] += lfoRate1 * dt;
        if (this.lfoPhases[0] >= 1.0) this.lfoPhases[0] -= 1.0;
        this.lfoVals[0] = Math.sin(TWO_PI * this.lfoPhases[0]);

        const env2 = this.envs[1].process(osc2, dt);
        this.envVals[1] = env2;
        if (this.envs[1].stage !== 'idle') anyEnvActive = true;
        this.lfoPhases[1] += lfoRate2 * dt;
        if (this.lfoPhases[1] >= 1.0) this.lfoPhases[1] -= 1.0;
        this.lfoVals[1] = Math.sin(TWO_PI * this.lfoPhases[1]);

        const env3 = this.envs[2].process(osc3, dt);
        this.envVals[2] = env3;
        if (this.envs[2].stage !== 'idle') anyEnvActive = true;
        this.lfoPhases[2] += lfoRate3 * dt;
        if (this.lfoPhases[2] >= 1.0) this.lfoPhases[2] -= 1.0;
        this.lfoVals[2] = Math.sin(TWO_PI * this.lfoPhases[2]);

        if (!anyEnvActive && s === len - 1) {
            this.active = false;
        }

        let modP1=0, modC1=0, modG1=0, modR1=0;
        let modP2=0, modC2=0, modG2=0, modR2=0;
        let modP3=0, modC3=0, modG3=0, modR3=0;

        if (hasMatrix) {
            for(let m = 0; m < matrix.length; m++) {
                const row = matrix[m];
                if (!row.enabled) continue;
                
                let srcVal = 0;
                if (row.source === 'env1') srcVal = this.envVals[0];
                else if (row.source === 'env2') srcVal = this.envVals[1];
                else if (row.source === 'env3') srcVal = this.envVals[2];
                else if (row.source === 'lfo1') srcVal = this.lfoVals[0];
                else if (row.source === 'lfo2') srcVal = this.lfoVals[1];
                else if (row.source === 'lfo3') srcVal = this.lfoVals[2];

                const amt = srcVal * row.amount;

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
        }

        let voiceMix = 0.0;

        if (osc1.enabled && this.envVals[0] > 0.0001) {
            let hardPitch = 0, hardFilter = 0, hardAmp = 1.0;
            const d = osc1.lfoDepth || 0;
            const v = this.lfoVals[0];
            if (osc1.lfoTarget === 'pitch') hardPitch = v * d;
            else if (osc1.lfoTarget === 'filter') hardFilter = v * d * 20;
            else if (osc1.lfoTarget === 'tremolo') hardAmp = 1.0 - (v * d * 0.005);

            let freq;
            if (osc1ModPitch) {
                const cents = osc1.coarseDetune + osc1.fineDetune + hardPitch + (modP1 * 1200);
                freq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
            } else {
                freq = osc1StaticFreq;
            }

            let sig = this.oscs[0].process(freq, osc1.waveform, dt);
            
            const cut = osc1.filterCutoff + hardFilter + (modC1 * 5000);
            const res = Math.max(0, osc1.filterResonance + (modR1 * 10));
            sig = this.filters[0].process(sig, cut, res, this.sampleRate);
            
            voiceMix += sig * osc1.gain * this.envVals[0] * hardAmp * Math.max(0, 1.0 + modG1);
        }

        if (osc2.enabled && this.envVals[1] > 0.0001) {
            let hardPitch = 0, hardFilter = 0, hardAmp = 1.0;
            const d = osc2.lfoDepth || 0;
            const v = this.lfoVals[1];
            if (osc2.lfoTarget === 'pitch') hardPitch = v * d;
            else if (osc2.lfoTarget === 'filter') hardFilter = v * d * 20;
            else if (osc2.lfoTarget === 'tremolo') hardAmp = 1.0 - (v * d * 0.005);

            let freq;
            if (osc2ModPitch) {
                const cents = osc2.coarseDetune + osc2.fineDetune + hardPitch + (modP2 * 1200);
                freq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
            } else {
                freq = osc2StaticFreq;
            }

            let sig = this.oscs[1].process(freq, osc2.waveform, dt);
            
            const cut = osc2.filterCutoff + hardFilter + (modC2 * 5000);
            const res = Math.max(0, osc2.filterResonance + (modR2 * 10));
            sig = this.filters[1].process(sig, cut, res, this.sampleRate);
            
            voiceMix += sig * osc2.gain * this.envVals[1] * hardAmp * Math.max(0, 1.0 + modG2);
        }

        if (osc3.enabled && this.envVals[2] > 0.0001) {
            let hardPitch = 0, hardFilter = 0, hardAmp = 1.0;
            const d = osc3.lfoDepth || 0;
            const v = this.lfoVals[2];
            if (osc3.lfoTarget === 'pitch') hardPitch = v * d;
            else if (osc3.lfoTarget === 'filter') hardFilter = v * d * 20;
            else if (osc3.lfoTarget === 'tremolo') hardAmp = 1.0 - (v * d * 0.005);

            let freq;
            if (osc3ModPitch) {
                const cents = osc3.coarseDetune + osc3.fineDetune + hardPitch + (modP3 * 1200);
                freq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
            } else {
                freq = osc3StaticFreq;
            }

            let sig = this.oscs[2].process(freq, osc3.waveform, dt);
            
            const cut = osc3.filterCutoff + hardFilter + (modC3 * 5000);
            const res = Math.max(0, osc3.filterResonance + (modR3 * 10));
            sig = this.filters[2].process(sig, cut, res, this.sampleRate);
            
            voiceMix += sig * osc3.gain * this.envVals[2] * hardAmp * Math.max(0, 1.0 + modG3);
        }

        panPhase += dt * panSpeed;
        if (panPhase > 1.0) panPhase -= 1.0;
        
        const autoPan = Math.sin(panPhase * TWO_PI) * panDepth;
        let p = this.panPos * spreadAmount;
        p += autoPan;
        p = Math.max(-1.0, Math.min(1.0, p));
        
        const gainL = 0.5 * (1.0 - p);
        const gainR = 0.5 * (1.0 + p);

        bufL[s] += voiceMix * gainL * voiceGain;
        bufR[s] += voiceMix * gainR * voiceGain;
    }
  }
}

// --- 4. PROCESSOR LOGIC ---

class PrismaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isOversamplingEnabled = true;
    this.globalBendMultiplier = 1.0; 
    
    const OVERSAMPLE = 2;
    const workingRate = sampleRate * OVERSAMPLE;

    this.voices = [];
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
    this.mixBufferL = null;
    this.mixBufferR = null;

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
         if (msg.enableOversampling !== undefined) this.isOversamplingEnabled = msg.enableOversampling;
         if (msg.globalBend !== undefined) this.globalBendMultiplier = msg.globalBend;
         if (msg.wavetableSize !== undefined) {
             generateWavetable(msg.wavetableSize);
         }
         if (msg.interpolationType !== undefined) {
             interpolationType = msg.interpolationType;
         }
      } else if (msg.type === 'note_on') {
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
                if (v.releaseTime < oldestReleaseTime) {
                    oldestReleaseTime = v.releaseTime;
                    oldestReleased = v;
                }
            } else {
                if (v.startTime < oldestStartTime) {
                    oldestStartTime = v.startTime;
                    oldestHeld = v;
                }
            }
        } else {
            if (!freeVoice) freeVoice = v;
        }
    }

    if (activeCount < this.maxPolyphony && freeVoice) {
        freeVoice.trigger(id, freq, type, mode);
        return;
    }

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
    
    const OVERSAMPLE = this.isOversamplingEnabled ? 2 : 1;
    const workingRate = sampleRate * OVERSAMPLE;
    const workingLen = len * OVERSAMPLE;
    const dt = 1.0 / workingRate;

    const startTime = globalThis.performance ? globalThis.performance.now() : 0;
    const MAX_BUDGET_MS = 1.5; 
    
    if (!this.mixBufferL || this.mixBufferL.length !== workingLen) {
        this.mixBufferL = new Float32Array(workingLen);
        this.mixBufferR = new Float32Array(workingLen);
        this.voices.forEach(v => v.updateSampleRate(workingRate));
    }
    
    this.mixBufferL.fill(0);
    this.mixBufferR.fill(0);
    
    const masterPreset = this.presets.normal;
    const panSpeed = (masterPreset.stereoPanSpeed !== undefined) ? masterPreset.stereoPanSpeed : 0.0;
    const panDepth = (masterPreset.stereoPanDepth !== undefined) ? masterPreset.stereoPanDepth : 0.0;
    const initialPanPhase = this.panPhase;

    let voicesProcessed = 0;
    
    for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        if (v.active) {
            if ((v.mode === 'trigger' || v.type === 'strum') && v.releaseTime === 0) {
                if (currentTime - v.startTime >= this.strumDuration) v.release();
            }

            const presetToUse = this.presets[v.type] || this.presets.normal;
            v.renderBlock(presetToUse, dt, this.mixBufferL, this.mixBufferR, workingLen, panSpeed, panDepth, initialPanPhase, this.globalBendMultiplier);
            voicesProcessed++;

            if (startTime > 0 && voicesProcessed % 2 === 0) {
                if (globalThis.performance.now() - startTime > MAX_BUDGET_MS) {
                    break;
                }
            }
        }
    }
    
    this.panPhase += (workingLen * dt * panSpeed);
    while (this.panPhase > 1.0) this.panPhase -= 1.0;

    if (OVERSAMPLE === 2) {
        for (let s = 0; s < len; s++) {
            const osIdx = s * 2;
            let sl1 = Math.tanh(this.mixBufferL[osIdx] * 0.8);
            let sr1 = Math.tanh(this.mixBufferR[osIdx] * 0.8);
            let sl2 = Math.tanh(this.mixBufferL[osIdx+1] * 0.8);
            let sr2 = Math.tanh(this.mixBufferR[osIdx+1] * 0.8);
            
            const outL = (sl1 + sl2) * 0.5;
            const outR = (sr1 + sr2) * 0.5;

            const yL = outL - this.xm1L + 0.995 * this.ym1L;
            this.xm1L = outL;
            this.ym1L = yL;
            
            const yR = outR - this.xm1R + 0.995 * this.ym1R;
            this.xm1R = outR;
            this.ym1R = yR;

            channelL[s] = yL;
            if (channelR) channelR[s] = yR;
        }
    } else {
        for (let s = 0; s < len; s++) {
            const sl = Math.tanh(this.mixBufferL[s] * 0.8);
            const sr = Math.tanh(this.mixBufferR[s] * 0.8);

            const yL = sl - this.xm1L + 0.995 * this.ym1L;
            this.xm1L = sl;
            this.ym1L = yL;
            
            const yR = sr - this.xm1R + 0.995 * this.ym1R;
            this.xm1R = sr;
            this.ym1R = yR;

            channelL[s] = yL;
            if (channelR) channelR[s] = yR;
        }
    }
    
    return true;
  }
}

registerProcessor('synth-processor', PrismaProcessor);
`;
