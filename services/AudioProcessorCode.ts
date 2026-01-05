
export const AUDIO_PROCESSOR_CODE = `
// --- 1. DSP UTILS & CONSTANTS ---

const TWO_PI = 2 * Math.PI;

// Increased from 4096 to 65536 to eliminate linear interpolation artifacts
const WAVETABLE_SIZE = 65536; 
const SINE_TABLE = new Float32Array(WAVETABLE_SIZE + 1); // +1 for simple interpolation guard
const GLOTTAL_TABLE = new Float32Array(WAVETABLE_SIZE + 1); 

// Precompute Sine Table
for (let i = 0; i <= WAVETABLE_SIZE; i++) {
    const phase = i / WAVETABLE_SIZE;
    SINE_TABLE[i] = Math.sin(phase * TWO_PI);
}

// Precompute Glottal Table (Rosenberg-C approximation via additive synthesis)
// This creates a band-limited pulse with approx -12dB/oct spectral slope
// Rich in even and odd harmonics, perfect for subtractive vocal/brass synthesis.
{
    const numHarmonics = 64;
    for (let i = 0; i <= WAVETABLE_SIZE; i++) {
        let sample = 0;
        const phase = i / WAVETABLE_SIZE;
        for (let k = 1; k <= numHarmonics; k++) {
            // Amplitude falls off as 1/k^1.6 (approx -10dB/oct)
            const amp = 1.0 / Math.pow(k, 1.6);
            // Cosine phase alignment ensures a peak at 0 (Pulse-like)
            sample += amp * Math.cos(k * phase * TWO_PI);
        }
        GLOTTAL_TABLE[i] = sample;
    }
    // Normalize Glottal Table
    let maxVal = 0;
    for (let i = 0; i <= WAVETABLE_SIZE; i++) maxVal = Math.max(maxVal, Math.abs(GLOTTAL_TABLE[i]));
    for (let i = 0; i <= WAVETABLE_SIZE; i++) GLOTTAL_TABLE[i] /= maxVal;
}

// Resonator Presets (Replaces Fixed Formants)
// Can simulate different instrument body sizes or vocal tracts
// Interpolated by 'resonatorSweep'
const RESONANCES = [
    { f1: 730, f2: 1090, f3: 2440, g1: 1.0, g2: 0.5, g3: 0.2 }, // Open
    { f1: 530, f2: 1840, f3: 2480, g1: 1.0, g2: 0.4, g3: 0.2 }, // Mid 1
    { f1: 270, f2: 2290, f3: 3010, g1: 1.0, g2: 0.3, g3: 0.1 }, // Mid 2
    { f1: 570, f2: 840,  f3: 2410, g1: 1.0, g2: 0.5, g3: 0.2 }, // Mid 3
    { f1: 300, f2: 870,  f3: 2240, g1: 1.0, g2: 0.4, g3: 0.2 }  // Closed/Muted
];

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
    filterType: 'lowpass',
    lfoRate: 1,
    lfoDepth: 0,
    lfoWaveform: 'sine',
    lfoTarget: 'none',
    lfoDelay: 0
};

const DUMMY_PRESET_DATA = {
    osc1: DUMMY_OSC_CONFIG,
    osc2: DUMMY_OSC_CONFIG,
    osc3: DUMMY_OSC_CONFIG,
    modMatrix: [],
    gain: 1.0,
    spread: 0,
    stereoPanSpeed: 0,
    stereoPanDepth: 0,
    resonatorMix: 0,
    resonatorSweep: 0,
    portamento: 0,
    noiseGain: 0,
    noiseCutoff: 4000
};

// --- 2. BASIC DSP CLASSES (Oscillator, Filter, Envelope) ---

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

  process(input, cutoff, res, sampleRate, type, peakGain = 1.0) {
    // Safe Cutoff range: 20Hz to Nyquist (approx)
    const safeCutoff = Math.max(20, Math.min(cutoff, sampleRate * 0.45));
    
    // Chamberlin SVF tuning
    let f = 2.0 * Math.sin(Math.PI * safeCutoff / sampleRate);
    const q = 1.0 / (res + 0.5);

    this.low += f * this.band;
    this.high = input - this.low - q * this.band;
    this.band += f * this.high;
    this.notch = this.high + this.low;

    // 0=Low, 1=High, 2=Band, 3=Notch, 4=Peak, 5=LowShelf, 6=HighShelf
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
    constructor() {
        this.f1 = new SVF();
        this.f2 = new SVF();
        this.f3 = new SVF();
        this.currentSweep = -1; // Force update on first run
    }

    reset() {
        this.f1.reset();
        this.f2.reset();
        this.f3.reset();
        this.currentSweep = -1;
    }

    // Interpolate resonator params with pitch scaling (Key Tracking)
    process(input, sweep, pitchHz, sampleRate) {
        // Sweep 0-1 maps through 5 resonator states
        
        const pos = Math.max(0, Math.min(1, sweep)) * 4.0;
        const idx = Math.floor(pos);
        const frac = pos - idx;
        
        const nextIdx = Math.min(idx + 1, 4);
        
        const p1 = RESONANCES[idx];
        const p2 = RESONANCES[nextIdx];

        // Key Tracking / Scaling Logic
        // Reference frequency for formants/body is usually around 200Hz (Male/Alto range)
        // We scale centers up slightly as pitch rises to preserve brightness
        // Scale Factor: 10-15% of pitch ratio
        const pitchScale = 1.0 + 0.15 * Math.log2(Math.max(50, pitchHz) / 200);

        // Linear interpolation of freq * Scale
        const f1_freq = (p1.f1 + (p2.f1 - p1.f1) * frac) * pitchScale;
        const f2_freq = (p1.f2 + (p2.f2 - p1.f2) * frac) * pitchScale;
        const f3_freq = (p1.f3 + (p2.f3 - p1.f3) * frac) * pitchScale;
        
        // Gains
        const g1 = p1.g1 + (p2.g1 - p1.g1) * frac;
        const g2 = p1.g2 + (p2.g2 - p1.g2) * frac;
        const g3 = p1.g3 + (p2.g3 - p1.g3) * frac;

        // Bandpass processing with moderate Q (Resonance ~ 4-8)
        const res = 4.0; 

        // SVF Type 2 = Bandpass
        const out1 = this.f1.process(input, f1_freq, res, sampleRate, 2); 
        const out2 = this.f2.process(input, f2_freq, res, sampleRate, 2);
        const out3 = this.f3.process(input, f3_freq, res, sampleRate, 2);

        return (out1 * g1) + (out2 * g2) + (out3 * g3);
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
        // High-performance LUT lookup
        {
            const index = this.phase * WAVETABLE_SIZE;
            const i = Math.floor(index);
            const f = index - i;
            // Linear Interpolation from pre-computed table
            sample = SINE_TABLE[i] + f * (SINE_TABLE[i + 1] - SINE_TABLE[i]);
        }
        break;
      case 'glottal':
        {
            const index = this.phase * WAVETABLE_SIZE;
            const i = Math.floor(index);
            const f = index - i;
            // Lookup from new Glottal table
            sample = GLOTTAL_TABLE[i] + f * (GLOTTAL_TABLE[i + 1] - GLOTTAL_TABLE[i]);
        }
        break;
      case 'triangle':
        {
            let t = -1.0 + (2.0 * this.phase);
            sample = 2.0 * (Math.abs(t) - 0.5);
        }
        break;
      case 'sawtooth':
        // PolyBLEP Saw is efficient and sounds good
        sample = (2.0 * this.phase) - 1.0;
        sample -= this.blep.get(this.phase, dt * freq);
        break;
      case 'square':
        // PolyBLEP Square
        sample = this.phase < 0.5 ? 1.0 : -1.0;
        sample += this.blep.get(this.phase, dt * freq);
        let phase2 = (this.phase + 0.5) % 1.0;
        sample -= this.blep.get(phase2, dt * freq);
        break;
      case 'noise':
        // White Noise
        sample = (Math.random() * 2.0) - 1.0;
        break;
    }
    
    return sample;
  }
}

// --- 3. VOICE LOGIC (Signal Path) ---

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
    this.activeTime = 0.0; // Seconds active, for LFO delay
    
    this.oscs = [
        new Oscillator(sampleRate),
        new Oscillator(sampleRate),
        new Oscillator(sampleRate)
    ];

    this.filters = [ new SVF(), new SVF(), new SVF() ];
    this.resonator = new ResonatorBank();
    this.noiseFilter = new SVF(); // Dedicated Noise Filter
    
    this.envs = [ new Envelope(), new Envelope(), new Envelope() ];
    this.lfoPhases = [0.0, 0.0, 0.0];
    this.lfoRandoms = [0.0, 0.0, 0.0]; // Hold values for S&H (Noise LFO)
    this.envVals = new Float32Array(3);
    this.lfoVals = new Float32Array(3);
  }

  // Allow dynamic updates to sample rate when oversampling changes
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
    this.activeTime = 0.0;
    
    this.envs.forEach(env => {
        // Soft reset to avoid clicks on retrigger
        env.trigger();
    });
    
    this.filters.forEach(f => f.reset());
    this.resonator.reset();
    this.noiseFilter.reset();
    this.lfoPhases.fill(0.0);
    // Initialize randoms
    this.lfoRandoms[0] = (Math.random() * 2.0) - 1.0;
    this.lfoRandoms[1] = (Math.random() * 2.0) - 1.0;
    this.lfoRandoms[2] = (Math.random() * 2.0) - 1.0;
  }

  release() {
    this.releaseTime = currentTime;
    this.envs.forEach(env => env.release());
  }
  
  hardStop() {
      this.active = false;
      this.envs.forEach(env => env.reset());
      this.filters.forEach(f => f.reset());
      this.resonator.reset();
      this.noiseFilter.reset();
  }

  getLevel() {
    return Math.max(this.envs[0].value, this.envs[1].value, this.envs[2].value);
  }

  // Helper to map string types to integer for optimized loop
  getFilterTypeId(type) {
      if (type === 'highpass') return 1;
      if (type === 'bandpass') return 2;
      if (type === 'notch') return 3;
      if (type === 'peak') return 4;
      if (type === 'lowshelf') return 5;
      if (type === 'highshelf') return 6;
      return 0; // lowpass
  }

  // Optimized block processing
  renderBlock(preset, dt, bufL, bufR, len, panSpeed, panDepth, startPanPhase, globalBend) {
    if (!this.active) return;

    // --- FREQ GLIDE ---
    const diff = this.targetFreq - this.baseFreq;
    if (Math.abs(diff) > 0.001) {
        const glideParam = preset.portamento !== undefined ? preset.portamento : 0;
        let coef = 0.005; // Fallback
        
        if (glideParam <= 0.01) {
            coef = 1.0; // Instant
        } else {
            const timeConst = glideParam * 0.5; // Up to 0.5s glide
            coef = 1.0 - Math.exp(- (len * dt) / timeConst);
        }
        
        this.baseFreq += diff * coef;
    } else {
      this.baseFreq = this.targetFreq;
    }

    // --- CACHED CONFIGS ---
    const osc1 = preset.osc1 || DUMMY_OSC_CONFIG;
    const osc2 = preset.osc2 || DUMMY_OSC_CONFIG;
    const osc3 = preset.osc3 || DUMMY_OSC_CONFIG;
    const matrix = preset.modMatrix || [];
    const spreadAmount = preset.spread || 0;
    const voiceGain = preset.gain || 0.5;
    
    // New Params (Renamed)
    const resonatorMix = preset.resonatorMix || 0;
    const resonatorSweep = preset.resonatorSweep || 0;
    const noiseGain = preset.noiseGain || 0;
    const noiseCutoff = preset.noiseCutoff || 4000;
    
    const hasMatrix = matrix.length > 0;

    // Filter Type Integers
    const fType1 = this.getFilterTypeId(osc1.filterType);
    const fType2 = this.getFilterTypeId(osc2.filterType);
    const fType3 = this.getFilterTypeId(osc3.filterType);

    // --- CHECK FOR SERIAL FILTER MODE (e.g. BRASS) ---
    // If Osc 1 is GLOTTAL, we switch to Serial Filtering topology
    // This allows constructing complex timbres like brass body resonances
    const isSerialMode = osc1.waveform === 'glottal';

    let anyEnvActive = false;
    let panPhase = startPanPhase;

    // Pre-calculate LFO rates to avoid dictionary lookup in tight loop
    const lfoRate1 = osc1.lfoRate || 0;
    const lfoRate2 = osc2.lfoRate || 0;
    const lfoRate3 = osc3.lfoRate || 0;
    
    // Pre-calculate LFO types
    const lfoType1 = osc1.lfoWaveform || 'sine';
    const lfoType2 = osc2.lfoWaveform || 'sine';
    const lfoType3 = osc3.lfoWaveform || 'sine';

    // OPTIMIZATION: Pre-calculate static frequencies if no modulation
    // Apply globalBend to the base frequency here
    let osc1StaticFreq = 0, osc2StaticFreq = 0, osc3StaticFreq = 0;
    let osc1ModPitch = false, osc2ModPitch = false, osc3ModPitch = false;

    // Check for pitch mod in Matrix or LFO
    if (osc1.enabled) {
        if (osc1.lfoTarget === 'pitch') osc1ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc1_pitch')) osc1ModPitch = true;
        
        if (!osc1ModPitch) {
            const cents = osc1.coarseDetune + osc1.fineDetune;
            osc1StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
        }
    }
    
    if (osc2.enabled && !isSerialMode) {
        if (osc2.lfoTarget === 'pitch') osc2ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc2_pitch')) osc2ModPitch = true;
        
        if (!osc2ModPitch) {
            const cents = osc2.coarseDetune + osc2.fineDetune;
            osc2StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
        }
    }

    if (osc3.enabled && !isSerialMode) {
        if (osc3.lfoTarget === 'pitch') osc3ModPitch = true;
        if (hasMatrix && matrix.some(r => r.enabled && r.target === 'osc3_pitch')) osc3ModPitch = true;
        
        if (!osc3ModPitch) {
            const cents = osc3.coarseDetune + osc3.fineDetune;
            osc3StaticFreq = this.baseFreq * globalBend * Math.pow(2, cents / 1200.0);
        }
    }
    
    // --- LFO DELAY CALCULATION ---
    // Linear fade-in of LFO depth based on activeTime
    this.activeTime += (len * dt);
    
    // 0.001 to prevent divide by zero
    const lfoFade1 = osc1.lfoDelay ? Math.min(1.0, this.activeTime / Math.max(0.01, osc1.lfoDelay)) : 1.0;
    const lfoFade2 = osc2.lfoDelay ? Math.min(1.0, this.activeTime / Math.max(0.01, osc2.lfoDelay)) : 1.0;
    const lfoFade3 = osc3.lfoDelay ? Math.min(1.0, this.activeTime / Math.max(0.01, osc3.lfoDelay)) : 1.0;

    for (let s = 0; s < len; s++) {
        // --- 1. MODULATORS ---
        anyEnvActive = false;
        
        // Unrolled Envelope & LFO processing
        // OSC 1
        const env1 = this.envs[0].process(osc1, dt);
        this.envVals[0] = env1;
        if (this.envs[0].stage !== 'idle') anyEnvActive = true;
        
        this.lfoPhases[0] += lfoRate1 * dt;
        if (this.lfoPhases[0] >= 1.0) {
            this.lfoPhases[0] -= 1.0;
            this.lfoRandoms[0] = (Math.random() * 2.0) - 1.0; // New random value on cycle reset
        }
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
        const env2 = this.envs[1].process(osc2, dt);
        this.envVals[1] = env2;
        if (this.envs[1].stage !== 'idle') anyEnvActive = true;
        
        this.lfoPhases[1] += lfoRate2 * dt;
        if (this.lfoPhases[1] >= 1.0) {
            this.lfoPhases[1] -= 1.0;
            this.lfoRandoms[1] = (Math.random() * 2.0) - 1.0;
        }
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
        const env3 = this.envs[2].process(osc3, dt);
        this.envVals[2] = env3;
        if (this.envs[2].stage !== 'idle') anyEnvActive = true;
        
        this.lfoPhases[2] += lfoRate3 * dt;
        if (this.lfoPhases[2] >= 1.0) {
            this.lfoPhases[2] -= 1.0;
            this.lfoRandoms[2] = (Math.random() * 2.0) - 1.0;
        }
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

        if (!anyEnvActive && s === len - 1) {
            this.active = false;
        }

        // --- 2. MOD MATRIX ---
        let modP1=0, modC1=0, modG1=0, modR1=0;
        let modP2=0, modC2=0, modG2=0, modR2=0;
        let modP3=0, modC3=0, modG3=0, modR3=0;

        if (hasMatrix) {
            for(let m = 0; m < matrix.length; m++) {
                const row = matrix[m];
                if (!row.enabled) continue;
                
                let srcVal = 0;
                // Hardcoded source lookup for speed
                if (row.source === 'env1') srcVal = this.envVals[0];
                else if (row.source === 'env2') srcVal = this.envVals[1];
                else if (row.source === 'env3') srcVal = this.envVals[2];
                else if (row.source === 'lfo1') srcVal = this.lfoVals[0];
                else if (row.source === 'lfo2') srcVal = this.lfoVals[1];
                else if (row.source === 'lfo3') srcVal = this.lfoVals[2];

                const amt = srcVal * row.amount;

                // Hardcoded target lookup
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

        // --- 3. VOICE GENERATION ---
        let voiceMix = 0.0;

        // --- OSC 1 (MASTER CARRIER FOR SERIAL/BRASS) ---
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
            
            // SPECTRAL TILT (Acoustic Physics)
            // Open up the lowpass filter as the envelope gets louder (simulates sharper glottal closure/brightness)
            // Dynamic Range: ~2000Hz brightness added at peak velocity
            const tiltMod = isSerialMode ? (this.envVals[0] * 2000) : 0;
            
            const cut1 = osc1.filterCutoff + hardFilter + (modC1 * 5000) + tiltMod;
            const res1 = Math.max(0, osc1.filterResonance + (modR1 * 10));
            
            // F1: Standard Filter (Lowpass usually for Source)
            sig = this.filters[0].process(sig, cut1, res1, this.sampleRate, fType1);
            
            if (isSerialMode) {
                // Serial Chain: F1 -> F2 -> F3 -> Mix
                // Osc 2 is F2. Use osc2.gain as Peak Gain.
                // Map 0-1 gain to 0-8 boost for powerful resonance
                const gain2 = osc2.gain * 8.0;
                const cut2 = osc2.filterCutoff + (modC2 * 5000);
                const res2 = Math.max(0, osc2.filterResonance + (modR2 * 10));
                sig = this.filters[1].process(sig, cut2, res2, this.sampleRate, fType2, gain2); 

                // Osc 3 is F3. Use osc3.gain as Peak Gain.
                const gain3 = osc3.gain * 8.0;
                const cut3 = osc3.filterCutoff + (modC3 * 5000);
                const res3 = Math.max(0, osc3.filterResonance + (modR3 * 10));
                sig = this.filters[2].process(sig, cut3, res3, this.sampleRate, fType3, gain3); 
                
                // For serial mode, we rely on Osc 1 Gain & Env for the master output
                voiceMix += sig * osc1.gain * this.envVals[0] * hardAmp * Math.max(0, 1.0 + modG1);
                
                // --- NOISE LAYER (AIR/BREATH) ---
                // Additive noise layer processed by Highpass Filter
                // REVISED: Scale by env^2 to tighten noise envelope (focus on onset/transient)
                if (noiseGain > 0.001) {
                    let noise = (Math.random() * 2.0) - 1.0;
                    // Filter: Highpass (Type 1), Resonance 0.5 (Neutral)
                    noise = this.noiseFilter.process(noise, noiseCutoff, 0.5, this.sampleRate, 1);
                    
                    // Tightened Envelope: Square the envelope value to make noise decay faster than tone
                    const tightEnv = this.envVals[0] * this.envVals[0];
                    voiceMix += noise * noiseGain * tightEnv * hardAmp * 0.5;
                }

            } else {
                // Standard Parallel Mode
                voiceMix += sig * osc1.gain * this.envVals[0] * hardAmp * Math.max(0, 1.0 + modG1);
            }
        }

        if (!isSerialMode) {
            // --- OSC 2 (Standard Mode) ---
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
                sig = this.filters[1].process(sig, cut, res, this.sampleRate, fType2);
                
                voiceMix += sig * osc2.gain * this.envVals[1] * hardAmp * Math.max(0, 1.0 + modG2);
            }

            // --- OSC 3 (Standard Mode) ---
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
                sig = this.filters[2].process(sig, cut, res, this.sampleRate, fType3);
                
                voiceMix += sig * osc3.gain * this.envVals[2] * hardAmp * Math.max(0, 1.0 + modG3);
            }
        }

        // --- 4. RESONATOR BANK (Parallel Bandpass Bank - Legacy or Extra Color) ---
        if (resonatorMix > 0.01) {
            // Updated to pass current pitch Frequency for Key Tracking
            // Using baseFreq adjusted by global bend (Osc1 Logic) as reference
            let trackingFreq = osc1StaticFreq; 
            if (osc1ModPitch) trackingFreq = this.baseFreq; // Simple fallback if heavily modulated

            const resSig = this.resonator.process(voiceMix, resonatorSweep, trackingFreq, this.sampleRate);
            // Mix Dry/Wet based on resonatorMix
            voiceMix = (voiceMix * (1.0 - resonatorMix)) + (resSig * resonatorMix * 1.5);
        }

        // --- 5. PANNING & OUTPUT ---
        panPhase += dt * panSpeed;
        if (panPhase > 1.0) panPhase -= 1.0;
        
        const autoPan = Math.sin(panPhase * TWO_PI) * panDepth;
        let p = this.panPos * spreadAmount;
        p += autoPan;
        p = Math.max(-1.0, Math.min(1.0, p));
        
        // Equal power pan approx
        const gainL = 0.5 * (1.0 - p);
        const gainR = 0.5 * (1.0 + p);

        bufL[s] += voiceMix * gainL * voiceGain;
        bufR[s] += voiceMix * gainR * voiceGain;
    }
  }
}

// --- 4. PROCESSOR LOGIC (Worklet Core) ---

class PrismaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Default to enabled (Store controls this)
    this.isOversamplingEnabled = true;
    this.globalBendMultiplier = 1.0; // Master pitch bend ratio
    
    // Initial setup
    const OVERSAMPLE = 2;
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
        strum: DUMMY_PRESET_DATA,
        brass: DUMMY_PRESET_DATA,
        arpeggio: DUMMY_PRESET_DATA
    };
    
    this.maxPolyphony = 32; 
    this.strumDuration = 0.5;
    
    this.xm1L = 0; this.ym1L = 0;
    this.xm1R = 0; this.ym1R = 0;
    
    // Global Pan Phase tracker
    this.panPhase = 0;
    
    // Mix Buffers
    this.mixBufferL = null;
    this.mixBufferR = null;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'update_preset') {
        const { mode, data } = msg;
        if (mode) {
            this.presets[mode] = this.normalizePreset(data);
        }
      } else if (msg.type === 'config') {
         if (msg.polyphony) this.maxPolyphony = msg.polyphony;
         if (msg.strumDuration) this.strumDuration = msg.strumDuration;
         if (msg.enableOversampling !== undefined) this.isOversamplingEnabled = msg.enableOversampling;
         if (msg.globalBend !== undefined) this.globalBendMultiplier = msg.globalBend;
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
          stereoPanDepth: data.stereoPanDepth || 0,
          
          resonatorMix: (data.resonatorMix !== undefined) ? data.resonatorMix : 0,
          resonatorSweep: (data.resonatorSweep !== undefined) ? data.resonatorSweep : 0,
          noiseGain: (data.noiseGain !== undefined) ? data.noiseGain : 0,
          noiseCutoff: (data.noiseCutoff !== undefined) ? data.noiseCutoff : 4000,
          
          portamento: (data.portamento !== undefined) ? data.portamento : 0
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
    
    // Config based on Oversampling setting
    const OVERSAMPLE = this.isOversamplingEnabled ? 2 : 1;
    const workingRate = sampleRate * OVERSAMPLE;
    const workingLen = len * OVERSAMPLE;
    const dt = 1.0 / workingRate;

    // Performance Budget
    const startTime = globalThis.performance ? globalThis.performance.now() : 0;
    const MAX_BUDGET_MS = 1.5; 
    
    // Resize buffer if needed
    if (!this.mixBufferL || this.mixBufferL.length !== workingLen) {
        this.mixBufferL = new Float32Array(workingLen);
        this.mixBufferR = new Float32Array(workingLen);
        // Inform voices of new sample rate for filter/osc calculations
        this.voices.forEach(v => v.updateSampleRate(workingRate));
    }
    
    this.mixBufferL.fill(0);
    this.mixBufferR.fill(0);
    
    const masterPreset = this.presets.normal;
    const panSpeed = (masterPreset.stereoPanSpeed !== undefined) ? masterPreset.stereoPanSpeed : 0.0;
    const panDepth = (masterPreset.stereoPanDepth !== undefined) ? masterPreset.stereoPanDepth : 0.0;
    const initialPanPhase = this.panPhase;

    // --- RENDER VOICES ---
    let voicesProcessed = 0;
    
    for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        if (v.active) {
            // Auto-Release Check for Trigger mode
            // MODIFIED: Only release if mode is 'trigger'. Do NOT release if preset type is 'strum' but mode is 'gate'.
            if (v.mode === 'trigger' && v.releaseTime === 0) {
                if (currentTime - v.startTime >= this.strumDuration) v.release();
            }

            const presetToUse = this.presets[v.type] || this.presets.normal;
            
            // Pass the global pan parameters to synchronization
            v.renderBlock(presetToUse, dt, this.mixBufferL, this.mixBufferR, workingLen, panSpeed, panDepth, initialPanPhase, this.globalBendMultiplier);
            voicesProcessed++;

            // CPU GOVERNOR
            if (startTime > 0 && voicesProcessed % 2 === 0) {
                if (globalThis.performance.now() - startTime > MAX_BUDGET_MS) {
                    break;
                }
            }
        }
    }
    
    // Update global pan phase for next block
    this.panPhase += (workingLen * dt * panSpeed);
    while (this.panPhase > 1.0) this.panPhase -= 1.0;

    // --- OUTPUT ---
    if (OVERSAMPLE === 2) {
        // Simple Decimation + Linear DC Blocker
        for (let s = 0; s < len; s++) {
            let accL = 0;
            let accR = 0;
            const osIdx = s * 2;

            // Soft Clip before downsample
            let sl1 = Math.tanh(this.mixBufferL[osIdx] * 0.8);
            let sr1 = Math.tanh(this.mixBufferR[osIdx] * 0.8);
            let sl2 = Math.tanh(this.mixBufferL[osIdx+1] * 0.8);
            let sr2 = Math.tanh(this.mixBufferR[osIdx+1] * 0.8);
            
            const outL = (sl1 + sl2) * 0.5;
            const outR = (sr1 + sr2) * 0.5;

            // DC Blocker
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
        // 1x Passthrough
        for (let s = 0; s < len; s++) {
            // Soft Clip
            const sl = Math.tanh(this.mixBufferL[s] * 0.8);
            const sr = Math.tanh(this.mixBufferR[s] * 0.8);

            // DC Blocker
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