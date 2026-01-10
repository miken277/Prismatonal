


const DSP_CONSTANTS = `
// --- 1. DSP UTILS & CONSTANTS ---
const TWO_PI = 2 * Math.PI;
const WAVETABLE_SIZE = 65536; 
const SINE_TABLE = new Float32Array(WAVETABLE_SIZE + 1);
const GLOTTAL_TABLE = new Float32Array(WAVETABLE_SIZE + 1); 

// Precompute Sine Table
for (let i = 0; i <= WAVETABLE_SIZE; i++) {
    const phase = i / WAVETABLE_SIZE;
    SINE_TABLE[i] = Math.sin(phase * TWO_PI);
}

// Precompute Glottal Table
{
    const numHarmonics = 64;
    for (let i = 0; i <= WAVETABLE_SIZE; i++) {
        let sample = 0;
        const phase = i / WAVETABLE_SIZE;
        for (let k = 1; k <= numHarmonics; k++) {
            const amp = 1.0 / Math.pow(k, 1.6);
            sample += amp * Math.cos(k * phase * TWO_PI);
        }
        GLOTTAL_TABLE[i] = sample;
    }
    let maxVal = 0;
    for (let i = 0; i <= WAVETABLE_SIZE; i++) maxVal = Math.max(maxVal, Math.abs(GLOTTAL_TABLE[i]));
    for (let i = 0; i <= WAVETABLE_SIZE; i++) GLOTTAL_TABLE[i] /= maxVal;
}

const RESONANCES = [
    { f1: 730, f2: 1090, f3: 2440, g1: 1.0, g2: 0.5, g3: 0.2 }, 
    { f1: 530, f2: 1840, f3: 2480, g1: 1.0, g2: 0.4, g3: 0.2 },
    { f1: 270, f2: 2290, f3: 3010, g1: 1.0, g2: 0.3, g3: 0.1 },
    { f1: 570, f2: 840,  f3: 2410, g1: 1.0, g2: 0.5, g3: 0.2 },
    { f1: 300, f2: 870,  f3: 2240, g1: 1.0, g2: 0.4, g3: 0.2 }
];

const DUMMY_OSC_CONFIG = {
    enabled: false, waveform: 'sine', coarseDetune: 0, fineDetune: 0, gain: 0,
    attack: 0.1, decay: 0.1, sustain: 0, release: 0.1, holdDecay: 0, pedalDecay: 0,
    filterCutoff: 20000, filterResonance: 0, filterType: 'lowpass',
    lfoRate: 1, lfoDepth: 0, lfoWaveform: 'sine', lfoTarget: 'none', lfoDelay: 0
};

const DUMMY_PRESET_DATA = {
    osc1: DUMMY_OSC_CONFIG, osc2: DUMMY_OSC_CONFIG, osc3: DUMMY_OSC_CONFIG,
    modMatrix: [], gain: 1.0, spread: 0, stereoPanSpeed: 0, stereoPanDepth: 0,
    resonatorMix: 0, resonatorSweep: 0, portamento: 0, noiseGain: 0, noiseCutoff: 4000,
    acousticSustain: false
};
`;

const DSP_CLASSES = `
// --- 2. BASIC DSP CLASSES ---
class PolyBLEP {
  constructor(sampleRate) { this.sampleRate = sampleRate; }
  get(t, dt) {
    if (dt < 1e-9) return 0.0;
    if (t < dt) { t /= dt; return t + t - t - t * t - 1.0; }
    else if (t > 1.0 - dt) { t = (t - 1.0) / dt; return t * t + t + t + 1.0; }
    return 0.0;
  }
}

class SVF {
  constructor() { this.low = 0.0; this.band = 0.0; this.high = 0.0; this.notch = 0.0; }
  reset() { this.low = 0.0; this.band = 0.0; this.high = 0.0; this.notch = 0.0; }
  process(input, cutoff, res, sampleRate, type, peakGain = 1.0) {
    const safeCutoff = Math.max(20, Math.min(cutoff, sampleRate * 0.45));
    let f = 2.0 * Math.sin(Math.PI * safeCutoff / sampleRate);
    const q = 1.0 / (res + 0.5);
    this.low += f * this.band;
    this.high = input - this.low - q * this.band;
    this.band += f * this.high;
    this.notch = this.high + this.low;
    switch((type|0)) {
        case 0: return this.low;
        case 1: return this.high;
        case 2: return this.band;
        case 3: return this.notch;
        case 4: return this.low + this.high + (this.band * peakGain);
        case 5: return (this.low * peakGain) + this.high + this.band;
        case 6: return this.low + (this.high * peakGain) + this.band;
        default: return this.low;
    }
  }
}

class ResonatorBank {
    constructor() { this.f1 = new SVF(); this.f2 = new SVF(); this.f3 = new SVF(); }
    reset() { this.f1.reset(); this.f2.reset(); this.f3.reset(); }
    process(input, sweep, pitchHz, sampleRate) {
        const pos = Math.max(0, Math.min(1, sweep)) * 4.0;
        const idx = Math.floor(pos);
        const frac = pos - idx;
        const nextIdx = Math.min(idx + 1, 4);
        const p1 = RESONANCES[idx];
        const p2 = RESONANCES[nextIdx];
        const pitchScale = 1.0 + 0.15 * Math.log2(Math.max(50, pitchHz) / 200);
        const f1_freq = (p1.f1 + (p2.f1 - p1.f1) * frac) * pitchScale;
        const f2_freq = (p1.f2 + (p2.f2 - p1.f2) * frac) * pitchScale;
        const f3_freq = (p1.f3 + (p2.f3 - p1.f3) * frac) * pitchScale;
        const g1 = p1.g1 + (p2.g1 - p1.g1) * frac;
        const g2 = p1.g2 + (p2.g2 - p1.g2) * frac;
        const g3 = p1.g3 + (p2.g3 - p1.g3) * frac;
        const res = 4.0; 
        const out1 = this.f1.process(input, f1_freq, res, sampleRate, 2); 
        const out2 = this.f2.process(input, f2_freq, res, sampleRate, 2);
        const out3 = this.f3.process(input, f3_freq, res, sampleRate, 2);
        return (out1 * g1) + (out2 * g2) + (out3 * g3);
    }
}

class Envelope {
  constructor() { this.stage = 'idle'; this.value = 0.0; this.velocity = 0.0; }
  trigger(velocity = 1.0) { this.stage = 'attack'; this.velocity = velocity; }
  release() { if (this.stage !== 'idle') this.stage = 'release'; }
  reset() { this.stage = 'idle'; this.value = 0.0; }
  
  process(config, dt, mode) {
    // Mode: 'gate' (Key Held), 'latch' (Sustain Pedal Active), 'trigger' (Pluck/One-Shot)
    const att = (config.attack !== undefined) ? config.attack : 0.01;
    const dec = (config.decay !== undefined) ? config.decay : 0.1;
    const sus = (config.sustain !== undefined) ? config.sustain : 1.0;
    const rel = (config.release !== undefined) ? config.release : 0.1;
    
    // New Finite Sustain Parameters
    // If <= 0, treat as Infinite (standard sustain)
    const holdDecay = (config.holdDecay !== undefined) ? config.holdDecay : 0;
    const pedalDecay = (config.pedalDecay !== undefined) ? config.pedalDecay : 0;

    switch (this.stage) {
      case 'idle': this.value = 0.0; return 0.0;
      
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
        // If decaying to near sustain, switch to sustain phase
        if (Math.abs(this.value - sus) < 0.001) { 
            this.value = sus; 
            this.stage = 'sustain'; 
        }
        return this.value * this.velocity;
        
      case 'sustain':
        // Finite Sustain Logic
        // If Latch Mode (Pedal), check pedalDecay
        if (mode === 'latch') {
            if (pedalDecay > 0) {
                // Finite Pedal Hold: Decay slowly from current level
                const pDecRate = 1.0 / pedalDecay; 
                // We decay towards 0
                this.value -= this.value * (pDecRate * dt * 5.0);
                if (this.value < 0.001) { this.value = 0.0; this.stage = 'idle'; }
            } else {
                // Infinite Pedal Hold: Maintain Sustain Level (or current level if entered late?)
                // Standard ADSR maintains Sustain level
                this.value = sus; 
            }
        } 
        // If Gate Mode (Key Held), check holdDecay
        else if (mode === 'gate') {
            if (holdDecay > 0) {
                // Finite Key Hold: Decay slowly
                const hDecRate = 1.0 / holdDecay;
                this.value -= this.value * (hDecRate * dt * 5.0);
                if (this.value < 0.001) { this.value = 0.0; this.stage = 'idle'; }
            } else {
                // Infinite Key Hold
                this.value = sus;
            }
        }
        
        return this.value * this.velocity;
        
      case 'release':
        const relRate = 1.0 / (Math.max(0.001, rel));
        this.value -= this.value * (relRate * dt * 5.0);
        if (this.value < 0.001) { this.value = 0.0; this.stage = 'idle'; }
        return this.value * this.velocity;
        
      default: return 0.0;
    }
  }
}

class Oscillator {
  constructor(sampleRate) { this.phase = 0.0; this.blep = new PolyBLEP(sampleRate); this.sampleRate = sampleRate; }
  reset() {}
  process(freq, type, dt) {
    if (!Number.isFinite(freq) || freq <= 0 || freq > 24000) return 0.0;
    this.phase += dt * freq;
    while (this.phase >= 1.0) this.phase -= 1.0;
    let sample = 0.0;
    switch (type) {
      case 'sine':
        { const index = this.phase * WAVETABLE_SIZE; const i = Math.floor(index); const f = index - i; sample = SINE_TABLE[i] + f * (SINE_TABLE[i + 1] - SINE_TABLE[i]); } break;
      case 'glottal':
        { const index = this.phase * WAVETABLE_SIZE; const i = Math.floor(index); const f = index - i; sample = GLOTTAL_TABLE[i] + f * (GLOTTAL_TABLE[i + 1] - GLOTTAL_TABLE[i]); } break;
      case 'triangle':
        { let t = -1.0 + (2.0 * this.phase); sample = 2.0 * (Math.abs(t) - 0.5); } break;
      case 'sawtooth':
        sample = (2.0 * this.phase) - 1.0; sample -= this.blep.get(this.phase, dt * freq); break;
      case 'square':
        sample = this.phase < 0.5 ? 1.0 : -1.0; sample += this.blep.get(this.phase, dt * freq);
        let phase2 = (this.phase + 0.5) % 1.0; sample -= this.blep.get(phase2, dt * freq); break;
      case 'noise': sample = (Math.random() * 2.0) - 1.0; break;
    }
    return sample;
  }
}
`;

const VOICE_LOGIC = `
// --- 3. VOICE LOGIC ---
class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.active = false; this.id = ''; this.type = 'normal'; this.mode = 'gate'; this.panPos = 0; 
    this.baseFreq = 440; this.targetFreq = 440; this.startTime = 0; this.releaseTime = 0; this.activeTime = 0.0;
    this.oscs = [new Oscillator(sampleRate), new Oscillator(sampleRate), new Oscillator(sampleRate)];
    this.filters = [ new SVF(), new SVF(), new SVF() ];
    this.resonator = new ResonatorBank();
    this.noiseFilter = new SVF();
    this.envs = [ new Envelope(), new Envelope(), new Envelope() ];
    this.lfoPhases = [0.0, 0.0, 0.0];
    this.lfoRandoms = [0.0, 0.0, 0.0];
    this.envVals = new Float32Array(3);
    this.lfoVals = new Float32Array(3);
  }

  updateSampleRate(newRate) {
      if (this.sampleRate === newRate) return;
      this.sampleRate = newRate;
      this.oscs.forEach(osc => { osc.sampleRate = newRate; osc.blep.sampleRate = newRate; });
  }

  trigger(id, freq, type, mode) {
    this.id = id; this.type = type || 'normal'; this.mode = mode || 'gate';
    this.baseFreq = freq; this.targetFreq = freq;
    this.active = true; this.startTime = currentTime; this.releaseTime = 0; this.activeTime = 0.0;
    this.envs.forEach(env => env.trigger());
    this.filters.forEach(f => f.reset());
    this.resonator.reset(); this.noiseFilter.reset();
    this.lfoPhases.fill(0.0);
    this.lfoRandoms[0] = (Math.random() * 2.0) - 1.0;
    this.lfoRandoms[1] = (Math.random() * 2.0) - 1.0;
    this.lfoRandoms[2] = (Math.random() * 2.0) - 1.0;
  }

  release() { this.releaseTime = currentTime; this.envs.forEach(env => env.release()); }
  hardStop() { this.active = false; this.envs.forEach(env => env.reset()); this.filters.forEach(f => f.reset()); this.resonator.reset(); this.noiseFilter.reset(); }
  getLevel() { return Math.max(this.envs[0].value, this.envs[1].value, this.envs[2].value); }
  getFilterTypeId(type) { if (type === 'highpass') return 1; if (type === 'bandpass') return 2; if (type === 'notch') return 3; if (type === 'peak') return 4; if (type === 'lowshelf') return 5; if (type === 'highshelf') return 6; return 0; }

  renderBlock(preset, dt, bufL, bufR, len, panSpeed, panDepth, startPanPhase, globalBend) {
    if (!this.active) return;
    const diff = this.targetFreq - this.baseFreq;
    if (Math.abs(diff) > 0.001) {
        const glideParam = preset.portamento !== undefined ? preset.portamento : 0;
        let coef = 0.005;
        if (glideParam <= 0.01) { coef = 1.0; } else { const timeConst = glideParam * 0.5; coef = 1.0 - Math.exp(- (len * dt) / timeConst); }
        this.baseFreq += diff * coef;
    } else { this.baseFreq = this.targetFreq; }

    const osc1 = preset.osc1 || DUMMY_OSC_CONFIG;
    const osc2 = preset.osc2 || DUMMY_OSC_CONFIG;
    const osc3 = preset.osc3 || DUMMY_OSC_CONFIG;
    const matrix = preset.modMatrix || [];
    const spreadAmount = preset.spread || 0;
    const voiceGain = preset.gain || 0.5;
    const resonatorMix = preset.resonatorMix || 0;
    const resonatorSweep = preset.resonatorSweep || 0;
    const noiseGain = preset.noiseGain || 0;
    const noiseCutoff = preset.noiseCutoff || 4000;
    const hasMatrix = matrix.length > 0;
    const fType1 = this.getFilterTypeId(osc1.filterType);
    const fType2 = this.getFilterTypeId(osc2.filterType);
    const fType3 = this.getFilterTypeId(osc3.filterType);
    const isSerialMode = osc1.waveform === 'glottal';

    let anyEnvActive = false;
    let panPhase = startPanPhase;
    const lfoRate1 = osc1.lfoRate || 0; const lfoRate2 = osc2.lfoRate || 0; const lfoRate3 = osc3.lfoRate || 0;
    const lfoType1 = osc1.lfoWaveform || 'sine'; const lfoType2 = osc2.lfoWaveform || 'sine'; const lfoType3 = osc3.lfoWaveform || 'sine';

    let osc1StaticFreq = 0, osc2StaticFreq = 0, osc3StaticFreq = 0;
    let osc1ModPitch = false, osc2ModPitch = false, osc3ModPitch = false;

    if (osc1.enabled) {
        if (osc1.lfoTarget === 'pitch') osc1ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc1_pitch')) osc1ModPitch = true;
        if (!osc1ModPitch) { const cents = osc1.coarseDetune + osc1.fineDetune; osc1StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0); }
    }
    if (osc2.enabled && !isSerialMode) {
        if (osc2.lfoTarget === 'pitch') osc2ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc2_pitch')) osc2ModPitch = true;
        if (!osc2ModPitch) { const cents = osc2.coarseDetune + osc2.fineDetune; osc2StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0); }
    }
    if (osc3.enabled && !isSerialMode) {
        if (osc3.lfoTarget === 'pitch') osc3ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc3_pitch')) osc3ModPitch = true;
        if (!osc3ModPitch) { const cents = osc3.coarseDetune + osc3.fineDetune; osc3StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0); }
    }
    
    this.activeTime += (len * dt);
    const lfoFade1 = osc1.lfoDelay ? Math.min(1.0, this.activeTime / Math.max(0.01, osc1.lfoDelay)) : 1.0;
    const lfoFade2 = osc2.lfoDelay ? Math.min(1.0, this.activeTime / Math.max(0.01, osc2.lfoDelay)) : 1.0;
    const lfoFade3 = osc3.lfoDelay ? Math.min(1.0, this.activeTime / Math.max(0.01, osc3.lfoDelay)) : 1.0;

    for (let s = 0; s < len; s++) {
        anyEnvActive = false;
        // OSC 1
        const env1 = this.envs[0].process(osc1, dt, this.mode); this.envVals[0] = env1; if (this.envs[0].stage !== 'idle') anyEnvActive = true;
        this.lfoPhases[0] += lfoRate1 * dt;
        if (this.lfoPhases[0] >= 1.0) { this.lfoPhases[0] -= 1.0; this.lfoRandoms[0] = (Math.random() * 2.0) - 1.0; }
        let lfoVal1 = 0;
        switch(lfoType1) {
            case 'sine': lfoVal1 = Math.sin(TWO_PI * this.lfoPhases[0]); break;
            case 'triangle': { const p = this.lfoPhases[0]; if(p < 0.25) lfoVal1 = 4 * p; else if(p < 0.75) lfoVal1 = 2 - 4 * p; else lfoVal1 = 4 * p - 4; break; }
            case 'square': lfoVal1 = this.lfoPhases[0] < 0.5 ? 1.0 : -1.0; break;
            case 'sawtooth': lfoVal1 = (2.0 * this.lfoPhases[0]) - 1.0; break;
            case 'noise': lfoVal1 = this.lfoRandoms[0]; break;
            default: lfoVal1 = Math.sin(TWO_PI * this.lfoPhases[0]);
        }
        this.lfoVals[0] = lfoVal1 * lfoFade1;

        // OSC 2
        const env2 = this.envs[1].process(osc2, dt, this.mode); this.envVals[1] = env2; if (this.envs[1].stage !== 'idle') anyEnvActive = true;
        this.lfoPhases[1] += lfoRate2 * dt;
        if (this.lfoPhases[1] >= 1.0) { this.lfoPhases[1] -= 1.0; this.lfoRandoms[1] = (Math.random() * 2.0) - 1.0; }
        let lfoVal2 = 0;
        switch(lfoType2) {
            case 'sine': lfoVal2 = Math.sin(TWO_PI * this.lfoPhases[1]); break;
            case 'triangle': { const p = this.lfoPhases[1]; if(p < 0.25) lfoVal2 = 4 * p; else if(p < 0.75) lfoVal2 = 2 - 4 * p; else lfoVal2 = 4 * p - 4; break; }
            case 'square': lfoVal2 = this.lfoPhases[1] < 0.5 ? 1.0 : -1.0; break;
            case 'sawtooth': lfoVal2 = (2.0 * this.lfoPhases[1]) - 1.0; break;
            case 'noise': lfoVal2 = this.lfoRandoms[1]; break;
            default: lfoVal2 = Math.sin(TWO_PI * this.lfoPhases[1]);
        }
        this.lfoVals[1] = lfoVal2 * lfoFade2;

        // OSC 3
        const env3 = this.envs[2].process(osc3, dt, this.mode); this.envVals[2] = env3; if (this.envs[2].stage !== 'idle') anyEnvActive = true;
        this.lfoPhases[2] += lfoRate3 * dt;
        if (this.lfoPhases[2] >= 1.0) { this.lfoPhases[2] -= 1.0; this.lfoRandoms[2] = (Math.random() * 2.0) - 1.0; }
        let lfoVal3 = 0;
        switch(lfoType3) {
            case 'sine': lfoVal3 = Math.sin(TWO_PI * this.lfoPhases[2]); break;
            case 'triangle': { const p = this.lfoPhases[2]; if(p < 0.25) lfoVal3 = 4 * p; else if(p < 0.75) lfoVal3 = 2 - 4 * p; else lfoVal3 = 4 * p - 4; break; }
            case 'square': lfoVal3 = this.lfoPhases[2] < 0.5 ? 1.0 : -1.0; break;
            case 'sawtooth': lfoVal3 = (2.0 * this.lfoPhases[2]) - 1.0; break;
            case 'noise': lfoVal3 = this.lfoRandoms[2]; break;
            default: lfoVal3 = Math.sin(TWO_PI * this.lfoPhases[2]);
        }
        this.lfoVals[2] = lfoVal3 * lfoFade3;

        if (!anyEnvActive && s === len - 1) { this.active = false; }

        let modP1=0, modC1=0, modG1=0, modR1=0;
        let modP2=0, modC2=0, modG2=0, modR2=0;
        let modP3=0, modC3=0, modG3=0, modR3=0;

        if (hasMatrix) {
            for(let m = 0; m < matrix.length; m++) {
                const row = matrix[m]; if (!row.enabled) continue;
                let srcVal = 0;
                if (row.source === 'env1') srcVal = this.envVals[0]; else if (row.source === 'env2') srcVal = this.envVals[1]; else if (row.source === 'env3') srcVal = this.envVals[2];
                else if (row.source === 'lfo1') srcVal = this.lfoVals[0]; else if (row.source === 'lfo2') srcVal = this.lfoVals[1]; else if (row.source === 'lfo3') srcVal = this.lfoVals[2];
                const amt = srcVal * row.amount;
                switch(row.target) {
                    case 'osc1_pitch': modP1 += amt; break; case 'osc1_cutoff': modC1 += amt; break; case 'osc1_gain': modG1 += amt; break; case 'osc1_res': modR1 += amt; break;
                    case 'osc2_pitch': modP2 += amt; break; case 'osc2_cutoff': modC2 += amt; break; case 'osc2_gain': modG2 += amt; break; case 'osc2_res': modR2 += amt; break;
                    case 'osc3_pitch': modP3 += amt; break; case 'osc3_cutoff': modC3 += amt; break; case 'osc3_gain': modG3 += amt; break; case 'osc3_res': modR3 += amt; break;
                }
            }
        }

        let voiceMix = 0.0;

        // OSC 1
        if (osc1.enabled && this.envVals[0] > 0.0001) {
            let hardPitch = 0, hardFilter = 0, hardAmp = 1.0;
            const d = osc1.lfoDepth || 0; const v = this.lfoVals[0];
            if (osc1.lfoTarget === 'pitch') hardPitch = v * d; else if (osc1.lfoTarget === 'filter') hardFilter = v * d * 20; else if (osc1.lfoTarget === 'tremolo') hardAmp = 1.0 - (v * d * 0.005);
            let freq;
            if (osc1ModPitch) {
                const cents = osc1.coarseDetune + osc1.fineDetune + hardPitch + (modP1 * 1200);
                freq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
            } else { freq = osc1StaticFreq; }
            let sig = this.oscs[0].process(freq, osc1.waveform, dt);
            const tiltMod = isSerialMode ? (this.envVals[0] * 2000) : 0;
            const cut1 = osc1.filterCutoff + hardFilter + (modC1 * 5000) + tiltMod;
            const res1 = Math.max(0, osc1.filterResonance + (modR1 * 10));
            sig = this.filters[0].process(sig, cut1, res1, this.sampleRate, fType1);
            if (isSerialMode) {
                const gain2 = osc2.gain * 8.0; const cut2 = osc2.filterCutoff + (modC2 * 5000); const res2 = Math.max(0, osc2.filterResonance + (modR2 * 10));
                sig = this.filters[1].process(sig, cut2, res2, this.sampleRate, fType2, gain2); 
                const gain3 = osc3.gain * 8.0; const cut3 = osc3.filterCutoff + (modC3 * 5000); const res3 = Math.max(0, osc3.filterResonance + (modR3 * 10));
                sig = this.filters[2].process(sig, cut3, res3, this.sampleRate, fType3, gain3); 
                voiceMix += sig * osc1.gain * this.envVals[0] * hardAmp * Math.max(0, 1.0 + modG1);
                if (noiseGain > 0.001) {
                    let noise = (Math.random() * 2.0) - 1.0;
                    noise = this.noiseFilter.process(noise, noiseCutoff, 0.5, this.sampleRate, 1);
                    const tightEnv = this.envVals[0] * this.envVals[0];
                    voiceMix += noise * noiseGain * tightEnv * hardAmp * 0.5;
                }
            } else {
                voiceMix += sig * osc1.gain * this.envVals[0] * hardAmp * Math.max(0, 1.0 + modG1);
            }
        }

        if (!isSerialMode) {
            // OSC 2
            if (osc2.enabled && this.envVals[1] > 0.0001) {
                let hardPitch = 0, hardFilter = 0, hardAmp = 1.0; const d = osc2.lfoDepth || 0; const v = this.lfoVals[1];
                if (osc2.lfoTarget === 'pitch') hardPitch = v * d; else if (osc2.lfoTarget === 'filter') hardFilter = v * d * 20; else if (osc2.lfoTarget === 'tremolo') hardAmp = 1.0 - (v * d * 0.005);
                let freq;
                if (osc2ModPitch) { const cents = osc2.coarseDetune + osc2.fineDetune + hardPitch + (modP2 * 1200); freq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0); } else { freq = osc2StaticFreq; }
                let sig = this.oscs[1].process(freq, osc2.waveform, dt);
                const cut = osc2.filterCutoff + hardFilter + (modC2 * 5000); const res = Math.max(0, osc2.filterResonance + (modR2 * 10));
                sig = this.filters[1].process(sig, cut, res, this.sampleRate, fType2);
                voiceMix += sig * osc2.gain * this.envVals[1] * hardAmp * Math.max(0, 1.0 + modG2);
            }
            // OSC 3
            if (osc3.enabled && this.envVals[2] > 0.0001) {
                let hardPitch = 0, hardFilter = 0, hardAmp = 1.0; const d = osc3.lfoDepth || 0; const v = this.lfoVals[2];
                if (osc3.lfoTarget === 'pitch') hardPitch = v * d; else if (osc3.lfoTarget === 'filter') hardFilter = v * d * 20; else if (osc3.lfoTarget === 'tremolo') hardAmp = 1.0 - (v * d * 0.005);
                let freq;
                if (osc3ModPitch) { const cents = osc3.coarseDetune + osc3.fineDetune + hardPitch + (modP3 * 1200); freq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0); } else { freq = osc3StaticFreq; }
                let sig = this.oscs[2].process(freq, osc3.waveform, dt);
                const cut = osc3.filterCutoff + hardFilter + (modC3 * 5000); const res = Math.max(0, osc3.filterResonance + (modR3 * 10));
                sig = this.filters[2].process(sig, cut, res, this.sampleRate, fType3);
                voiceMix += sig * osc3.gain * this.envVals[2] * hardAmp * Math.max(0, 1.0 + modG3);
            }
        }

        if (resonatorMix > 0.01) {
            let trackingFreq = osc1StaticFreq; if (osc1ModPitch) trackingFreq = this.baseFreq; 
            const resSig = this.resonator.process(voiceMix, resonatorSweep, trackingFreq, this.sampleRate);
            voiceMix = (voiceMix * (1.0 - resonatorMix)) + (resSig * resonatorMix * 1.5);
        }

        panPhase += dt * panSpeed;
        if (panPhase > 1.0) panPhase -= 1.0;
        const autoPan = Math.sin(panPhase * TWO_PI) * panDepth;
        let p = this.panPos * spreadAmount;
        p += autoPan; p = Math.max(-1.0, Math.min(1.0, p));
        const gainL = 0.5 * (1.0 - p); const gainR = 0.5 * (1.0 + p);
        bufL[s] += voiceMix * gainL * voiceGain;
        bufR[s] += voiceMix * gainR * voiceGain;
    }
  }
}
`;

const PROCESSOR_LOGIC = `
// --- 4. PROCESSOR LOGIC ---
class PrismaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isOversamplingEnabled = true; this.globalBendMultiplier = 1.0;
    const OVERSAMPLE = 2; const workingRate = sampleRate * OVERSAMPLE;
    this.voices = [];
    for(let i=0; i<64; i++) { const v = new Voice(workingRate); v.panPos = Math.sin(i * 123.456); this.voices.push(v); }
    this.presets = { normal: DUMMY_PRESET_DATA, latch: DUMMY_PRESET_DATA, strum: DUMMY_PRESET_DATA, brass: DUMMY_PRESET_DATA, keys: DUMMY_PRESET_DATA };
    this.maxPolyphony = 32; this.strumDuration = 0.5;
    this.xm1L = 0; this.ym1L = 0; this.xm1R = 0; this.ym1R = 0;
    this.panPhase = 0; this.mixBufferL = null; this.mixBufferR = null; this.eventQueue = [];
    this.port.onmessage = (e) => {
      const msg = e.data;
      if (typeof msg.time === 'number' && msg.time > currentTime) { this.eventQueue.push(msg); this.eventQueue.sort((a, b) => a.time - b.time); return; }
      this.handleMessage(msg);
    };
  }
  
  handleMessage(msg) {
      if (msg.type === 'update_preset') { const { mode, data } = msg; if (mode) { this.presets[mode] = this.normalizePreset(data); } }
      else if (msg.type === 'config') { if (msg.polyphony) this.maxPolyphony = msg.polyphony; if (msg.strumDuration) this.strumDuration = msg.strumDuration; if (msg.enableOversampling !== undefined) this.isOversamplingEnabled = msg.enableOversampling; if (msg.globalBend !== undefined) this.globalBendMultiplier = msg.globalBend; }
      else if (msg.type === 'note_on') { this.triggerVoice(msg.id, msg.freq, msg.voiceType, msg.mode); }
      else if (msg.type === 'note_off') { this.releaseVoice(msg.id); }
      else if (msg.type === 'glide') { this.glideVoice(msg.id, msg.freq); }
      else if (msg.type === 'transfer') { this.transferVoice(msg.id, msg.newId, msg.freq); }
      else if (msg.type === 'stop_all') { this.voices.forEach(v => v.hardStop()); this.eventQueue = []; }
      else if (msg.type === 'stop_group') { const prefix = msg.prefix; if (prefix) { this.eventQueue = this.eventQueue.filter(e => { if ((e.type === 'note_on' || e.type === 'note_off' || e.type === 'glide') && e.id && typeof e.id === 'string' && e.id.startsWith(prefix)) { return false; } return true; }); this.voices.forEach(v => { if (v.active && v.id.startsWith(prefix)) { v.release(); } }); } }
  }

  normalizePreset(data) {
      return {
          osc1: { ...DUMMY_OSC_CONFIG, ...(data.osc1 || {}) }, osc2: { ...DUMMY_OSC_CONFIG, ...(data.osc2 || {}) }, osc3: { ...DUMMY_OSC_CONFIG, ...(data.osc3 || {}) },
          modMatrix: (data.modMatrix || []).map(row => ({ ...row, amount: (Number.isFinite(row.amount) ? row.amount : 0) / 100.0 })),
          gain: data.gain || 0.5, spread: data.spread || 0, stereoPanSpeed: data.stereoPanSpeed || 0, stereoPanDepth: data.stereoPanDepth || 0,
          resonatorMix: (data.resonatorMix !== undefined) ? data.resonatorMix : 0, resonatorSweep: (data.resonatorSweep !== undefined) ? data.resonatorSweep : 0,
          noiseGain: (data.noiseGain !== undefined) ? data.noiseGain : 0, noiseCutoff: (data.noiseCutoff !== undefined) ? data.noiseCutoff : 4000,
          portamento: (data.portamento !== undefined) ? data.portamento : 0,
          acousticSustain: (data.acousticSustain !== undefined) ? data.acousticSustain : false
      };
  }

  triggerVoice(id, freq, type, mode) {
    for (let i = 0; i < this.voices.length; i++) { if (this.voices[i].active && this.voices[i].id === id) { this.voices[i].trigger(id, freq, type, mode); return; } }
    let activeCount = 0, oldestReleased = null, oldestReleaseTime = Infinity, oldestHeld = null, oldestStartTime = Infinity, freeVoice = null;
    for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        if (v.active) {
            activeCount++;
            if (v.releaseTime > 0) { if (v.releaseTime < oldestReleaseTime) { oldestReleaseTime = v.releaseTime; oldestReleased = v; } }
            else { if (v.startTime < oldestStartTime) { oldestStartTime = v.startTime; oldestHeld = v; } }
        } else { if (!freeVoice) freeVoice = v; }
    }
    if (activeCount < this.maxPolyphony && freeVoice) { freeVoice.trigger(id, freq, type, mode); return; }
    const victim = oldestReleased || oldestHeld || freeVoice || this.voices[0];
    if (victim) { if (victim.active && victim.id !== id) { this.port.postMessage({ type: 'voice_stolen', id: victim.id }); } victim.trigger(id, freq, type, mode); }
  }

  releaseVoice(id) { for (let i = 0; i < this.voices.length; i++) { if (this.voices[i].active && this.voices[i].id === id) { this.voices[i].release(); } } }
  glideVoice(id, freq) { for (let i = 0; i < this.voices.length; i++) { if (this.voices[i].active && this.voices[i].id === id) { this.voices[i].targetFreq = freq; } } }
  transferVoice(oldId, newId, freq) { for (let i = 0; i < this.voices.length; i++) { if (this.voices[i].active && this.voices[i].id === oldId) { this.voices[i].id = newId; this.voices[i].targetFreq = freq; return; } } }

  process(inputs, outputs, parameters) {
    while (this.eventQueue.length > 0 && this.eventQueue[0].time <= currentTime) { this.handleMessage(this.eventQueue.shift()); }
    const output = outputs[0]; const channelL = output[0]; const channelR = output[1]; if (!channelL) return true;
    const len = channelL.length;
    const OVERSAMPLE = this.isOversamplingEnabled ? 2 : 1; const workingRate = sampleRate * OVERSAMPLE; const workingLen = len * OVERSAMPLE; const dt = 1.0 / workingRate;
    const startTime = globalThis.performance ? globalThis.performance.now() : 0; const MAX_BUDGET_MS = 1.5; 
    
    if (!this.mixBufferL || this.mixBufferL.length !== workingLen) { this.mixBufferL = new Float32Array(workingLen); this.mixBufferR = new Float32Array(workingLen); this.voices.forEach(v => v.updateSampleRate(workingRate)); }
    this.mixBufferL.fill(0); this.mixBufferR.fill(0);
    
    const masterPreset = this.presets.normal; const panSpeed = (masterPreset.stereoPanSpeed !== undefined) ? masterPreset.stereoPanSpeed : 0.0; const panDepth = (masterPreset.stereoPanDepth !== undefined) ? masterPreset.stereoPanDepth : 0.0; const initialPanPhase = this.panPhase;
    let voicesProcessed = 0;
    for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        if (v.active) {
            if (v.mode === 'trigger' && v.releaseTime === 0) { if (currentTime - v.startTime >= this.strumDuration) v.release(); }
            const presetToUse = this.presets[v.type] || this.presets.normal;
            v.renderBlock(presetToUse, dt, this.mixBufferL, this.mixBufferR, workingLen, panSpeed, panDepth, initialPanPhase, this.globalBendMultiplier);
            voicesProcessed++;
            if (startTime > 0 && voicesProcessed % 2 === 0) { if (globalThis.performance.now() - startTime > MAX_BUDGET_MS) { break; } }
        }
    }
    this.panPhase += (workingLen * dt * panSpeed); while (this.panPhase > 1.0) this.panPhase -= 1.0;

    if (OVERSAMPLE === 2) {
        for (let s = 0; s < len; s++) {
            const osIdx = s * 2;
            let sl1 = Math.tanh(this.mixBufferL[osIdx] * 0.8); let sr1 = Math.tanh(this.mixBufferR[osIdx] * 0.8);
            let sl2 = Math.tanh(this.mixBufferL[osIdx+1] * 0.8); let sr2 = Math.tanh(this.mixBufferR[osIdx+1] * 0.8);
            const outL = (sl1 + sl2) * 0.5; const outR = (sr1 + sr2) * 0.5;
            const yL = outL - this.xm1L + 0.995 * this.ym1L; this.xm1L = outL; this.ym1L = yL;
            const yR = outR - this.xm1R + 0.995 * this.ym1R; this.xm1R = outR; this.ym1R = yR;
            channelL[s] = yL; if (channelR) channelR[s] = yR;
        }
    } else {
        for (let s = 0; s < len; s++) {
            const sl = Math.tanh(this.mixBufferL[s] * 0.8); const sr = Math.tanh(this.mixBufferR[s] * 0.8);
            const yL = sl - this.xm1L + 0.995 * this.ym1L; this.xm1L = sl; this.ym1L = yL;
            const yR = sr - this.xm1R + 0.995 * this.ym1R; this.xm1R = sr; this.ym1R = yR;
            channelL[s] = yL; if (channelR) channelR[s] = yR;
        }
    }
    return true;
  }
}
registerProcessor('synth-processor', PrismaProcessor);
`;

export const AUDIO_PROCESSOR_CODE = DSP_CONSTANTS + DSP_CLASSES + VOICE_LOGIC + PROCESSOR_LOGIC;
