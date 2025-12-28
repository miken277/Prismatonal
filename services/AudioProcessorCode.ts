
export const AUDIO_PROCESSOR_CODE = `
// --- 1. DSP UTILS & CONSTANTS ---

const TWO_PI = 2 * Math.PI;

// Global synthesis state
let wavetableSize = 8192;
let wavetableMask = 8191;
let wavetable = new Float32Array(wavetableSize + 4); 
let interpolationType = 'cubic'; // Default changed to cubic per request

function generateWavetable(size) {
    wavetableSize = size;
    wavetableMask = size - 1;
    wavetable = new Float32Array(wavetableSize + 4); 
    
    // Generate Sine
    for (let i = 0; i < wavetableSize; i++) {
        wavetable[i] = Math.sin((i / wavetableSize) * TWO_PI);
    }
    
    // Pad for Cubic without expensive wrap-around logic in loops
    wavetable[wavetableSize] = wavetable[0];
    wavetable[wavetableSize + 1] = wavetable[1];
    wavetable[wavetableSize + 2] = wavetable[2];
    wavetable[wavetableSize + 3] = wavetable[3];
}

// Initial Generation
generateWavetable(8192);

// Fast Saturation / Soft Clipper (Cubic Approximation)
// Much faster than Math.tanh()
function fastSoftClip(x) {
    if (x > 1.2) return 1.0;
    if (x < -1.2) return -1.0;
    // Cubic approximation of tanh for smooth saturation
    return x * (1.5 - 0.5 * x * x * 0.694); 
}

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

// --- 2. DSP CLASSES ---

class PolyBLEP {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
  }
  get(t, dt) {
    if (dt < 1e-9) return 0.0;
    if (t < dt) { t /= dt; return t + t - t * t - 1.0; }
    else if (t > 1.0 - dt) { t = (t - 1.0) / dt; return t * t + t + t + 1.0; }
    return 0.0;
  }
}

class SVF {
  constructor() {
    this.low = 0.0; this.band = 0.0; this.high = 0.0;
  }
  reset() { this.low = 0.0; this.band = 0.0; this.high = 0.0; }
  process(input, cutoff, res, sampleRate) {
    const safeCutoff = Math.max(20, Math.min(cutoff, sampleRate * 0.42));
    let f = 2.0 * Math.sin(Math.PI * safeCutoff / sampleRate);
    const q = 1.0 / (res + 0.5);
    this.low += f * this.band;
    this.high = input - this.low - q * this.band;
    this.band += f * this.high;
    return this.low; 
  }
}

class Envelope {
  constructor() { this.stage = 'idle'; this.value = 0.0; this.velocity = 0.0; }
  trigger(velocity = 1.0) { this.stage = 'attack'; this.velocity = velocity; }
  release() { if (this.stage !== 'idle') this.stage = 'release'; }
  reset() { this.stage = 'idle'; this.value = 0.0; }
  process(config, dt) {
    const att = config.attack || 0.01;
    const dec = config.decay || 0.1;
    const sus = config.sustain !== undefined ? config.sustain : 1.0;
    const rel = config.release || 0.1;
    switch (this.stage) {
      case 'idle': return 0.0;
      case 'attack':
        this.value += (1.0 / Math.max(0.001, att)) * dt;
        if (this.value >= 1.0) { this.value = 1.0; this.stage = 'decay'; }
        break;
      case 'decay':
        this.value += (sus - this.value) * ((1.0 / Math.max(0.001, dec)) * dt * 5.0);
        break;
      case 'release':
        this.value -= this.value * ((1.0 / Math.max(0.001, rel)) * dt * 5.0);
        if (this.value < 0.001) { this.value = 0.0; this.stage = 'idle'; }
        break;
    }
    return this.value * this.velocity;
  }
}

class Oscillator {
  constructor(sampleRate) { this.phase = 0.0; this.blep = new PolyBLEP(sampleRate); this.sampleRate = sampleRate; }
  process(freq, type, dt) {
    if (!Number.isFinite(freq) || freq <= 0) return 0.0;
    this.phase += dt * freq;
    if (this.phase >= 1.0) this.phase -= 1.0;
    if (type === 'sine') {
        const ptr = this.phase * wavetableSize;
        const i = ptr | 0;
        const f = ptr - i;
        if (interpolationType === 'cubic') {
            const y0 = i === 0 ? wavetable[wavetableSize - 1] : wavetable[i - 1];
            const y1 = wavetable[i];
            const y2 = wavetable[i + 1];
            const y3 = wavetable[i + 2];
            return y1 + 0.5 * f * (y2 - y0 + f * (2.0 * y0 - 5.0 * y1 + 4.0 * y2 - y3 + f * (3.0 * (y1 - y2) + y3 - y0)));
        }
        return wavetable[i] + f * (wavetable[i + 1] - wavetable[i]);
    } else if (type === 'triangle') {
        return 2.0 * (Math.abs(-1.0 + 2.0 * this.phase) - 0.5);
    } else if (type === 'sawtooth') {
        let sig = (2.0 * this.phase) - 1.0;
        return sig - this.blep.get(this.phase, dt * freq);
    } else if (type === 'square') {
        let sig = this.phase < 0.5 ? 1.0 : -1.0;
        sig += this.blep.get(this.phase, dt * freq);
        sig -= this.blep.get((this.phase + 0.5) % 1.0, dt * freq);
        return sig;
    }
    return 0.0;
  }
}

// --- 3. VOICE LOGIC ---

class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate; this.active = false; this.id = ''; this.panPos = 0; 
    this.baseFreq = 440; this.targetFreq = 440;
    this.oscs = [new Oscillator(sampleRate), new Oscillator(sampleRate), new Oscillator(sampleRate)];
    this.filters = [new SVF(), new SVF(), new SVF()];
    this.envs = [new Envelope(), new Envelope(), new Envelope()];
    this.lfoPhases = [0.0, 0.0, 0.0];
    this.activeMods = []; // Cached active matrix rows
    this.startTime = 0;
    this.releaseTime = 0;
  }

  updateSampleRate(newRate) {
    if (this.sampleRate === newRate) return;
    this.sampleRate = newRate;
    this.oscs.forEach(osc => { osc.sampleRate = newRate; osc.blep.sampleRate = newRate; });
  }

  trigger(id, freq, type, mode) {
    this.id = id; this.type = type || 'normal'; this.mode = mode || 'gate';
    this.baseFreq = freq; this.targetFreq = freq; this.active = true;
    this.startTime = currentTime; this.releaseTime = 0; 
    this.envs.forEach(env => env.trigger());
    this.filters.forEach(f => f.reset());
    this.lfoPhases.fill(0.0);
  }

  release() { this.releaseTime = currentTime; this.envs.forEach(env => env.release()); }
  hardStop() { this.active = false; this.envs.forEach(env => env.reset()); }

  renderBlock(preset, dt, bufL, bufR, len, panSpeed, panDepth, startPanPhase, globalBend) {
    if (!this.active) return;
    const diff = this.targetFreq - this.baseFreq;
    if (Math.abs(diff) > 0.001) this.baseFreq += diff * 0.005; else this.baseFreq = this.targetFreq;

    const osc1 = preset.osc1, osc2 = preset.osc2, osc3 = preset.osc3;
    const matrix = preset.modMatrix || [];
    const activeMods = matrix.filter(r => r.enabled && r.amount !== 0);
    
    const voiceGain = preset.gain || 0.5;
    const spread = preset.spread || 0;
    let panPhase = startPanPhase;

    const lfoRates = [osc1.lfoRate || 0, osc2.lfoRate || 0, osc3.lfoRate || 0];

    for (let s = 0; s < len; s++) {
        const e1 = this.envs[0].process(osc1, dt), e2 = this.envs[1].process(osc2, dt), e3 = this.envs[2].process(osc3, dt);
        if (this.envs[0].stage === 'idle' && this.envs[1].stage === 'idle' && this.envs[2].stage === 'idle' && s === len - 1) {
            this.active = false; break;
        }

        const l0 = wavetable[(this.lfoPhases[0] * wavetableSize) | 0];
        const l1 = wavetable[(this.lfoPhases[1] * wavetableSize) | 0];
        const l2 = wavetable[(this.lfoPhases[2] * wavetableSize) | 0];
        this.lfoPhases[0] = (this.lfoPhases[0] + lfoRates[0] * dt) % 1.0;
        this.lfoPhases[1] = (this.lfoPhases[1] + lfoRates[1] * dt) % 1.0;
        this.lfoPhases[2] = (this.lfoPhases[2] + lfoRates[2] * dt) % 1.0;

        let modP1=0, modC1=0, modG1=0, modP2=0, modC2=0, modG2=0, modP3=0, modC3=0, modG3=0;
        
        for (let i = 0; i < activeMods.length; i++) {
            const r = activeMods[i];
            let val = 0;
            if (r.source === 'env1') val = e1; else if (r.source === 'env2') val = e2; else if (r.source === 'env3') val = e3;
            else if (r.source === 'lfo1') val = l0; else if (r.source === 'lfo2') val = l1; else if (r.source === 'lfo3') val = l2;
            const amt = val * r.amount;
            switch(r.target) {
                case 'osc1_pitch': modP1 += amt; break; case 'osc1_cutoff': modC1 += amt; break; case 'osc1_gain': modG1 += amt; break;
                case 'osc2_pitch': modP2 += amt; break; case 'osc2_cutoff': modC2 += amt; break; case 'osc2_gain': modG2 += amt; break;
                case 'osc3_pitch': modP3 += amt; break; case 'osc3_cutoff': modC3 += amt; break; case 'osc3_gain': modG3 += amt; break;
            }
        }

        let mix = 0;
        if (osc1.enabled && e1 > 0.001) {
            let p = modP1 * 1200, c = osc1.filterCutoff + modC1 * 5000;
            if (osc1.lfoTarget === 'pitch') p += l0 * osc1.lfoDepth;
            else if (osc1.lfoTarget === 'filter') c += l0 * osc1.lfoDepth * 20;
            let sig = this.oscs[0].process(this.baseFreq * globalBend * Math.pow(2, (osc1.coarseDetune + osc1.fineDetune + p) / 1200), osc1.waveform, dt);
            sig = this.filters[0].process(sig, c, osc1.filterResonance, this.sampleRate);
            mix += sig * osc1.gain * e1 * (osc1.lfoTarget === 'tremolo' ? 1.0 - l0 * osc1.lfoDepth * 0.005 : 1.0) * (1.0 + modG1);
        }
        if (osc2.enabled && e2 > 0.001) {
            let p = modP2 * 1200, c = osc2.filterCutoff + modC2 * 5000;
            if (osc2.lfoTarget === 'pitch') p += l1 * osc2.lfoDepth;
            else if (osc2.lfoTarget === 'filter') c += l1 * osc2.lfoDepth * 20;
            let sig = this.oscs[1].process(this.baseFreq * globalBend * Math.pow(2, (osc2.coarseDetune + osc2.fineDetune + p) / 1200), osc2.waveform, dt);
            sig = this.filters[1].process(sig, c, osc2.filterResonance, this.sampleRate);
            mix += sig * osc2.gain * e2 * (osc2.lfoTarget === 'tremolo' ? 1.0 - l1 * osc2.lfoDepth * 0.005 : 1.0) * (1.0 + modG2);
        }
        if (osc3.enabled && e3 > 0.001) {
            let p = modP3 * 1200, c = osc3.filterCutoff + modC3 * 5000;
            if (osc3.lfoTarget === 'pitch') p += l2 * osc3.lfoDepth;
            else if (osc3.lfoTarget === 'filter') c += l2 * osc3.lfoDepth * 20;
            let sig = this.oscs[2].process(this.baseFreq * globalBend * Math.pow(2, (osc3.coarseDetune + osc3.fineDetune + p) / 1200), osc3.waveform, dt);
            sig = this.filters[2].process(sig, c, osc3.filterResonance, this.sampleRate);
            mix += sig * osc3.gain * e3 * (osc3.lfoTarget === 'tremolo' ? 1.0 - l2 * osc3.lfoDepth * 0.005 : 1.0) * (1.0 + modG3);
        }

        panPhase = (panPhase + dt * panSpeed) % 1.0;
        const p = Math.max(-1, Math.min(1, this.panPos * spread + Math.sin(panPhase * TWO_PI) * panDepth));
        bufL[s] += mix * 0.5 * (1.0 - p) * voiceGain;
        bufR[s] += mix * 0.5 * (1.0 + p) * voiceGain;
    }
  }
}

// --- 4. PROCESSOR LOGIC ---

class PrismaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isOversamplingEnabled = true; this.globalBendMultiplier = 1.0;
    this.voices = Array.from({length:64}, (_,i) => {
        const v = new Voice(sampleRate * 2); v.panPos = Math.sin(i * 123.456); return v;
    });
    this.presets = { normal: DUMMY_PRESET_DATA, latch: DUMMY_PRESET_DATA, strum: DUMMY_PRESET_DATA };
    this.maxPolyphony = 32; this.strumDuration = 0.5;
    this.xm1L = 0; this.ym1L = 0; this.xm1R = 0; this.ym1R = 0;
    this.panPhase = 0; this.mixBufferL = null; this.mixBufferR = null;

    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'update_preset') { if (m.mode && this.presets[m.mode]) this.presets[m.mode] = this.normalizePreset(m.data); }
      else if (m.type === 'config') {
         if (m.polyphony) {
             this.maxPolyphony = m.polyphony;
             this.enforcePolyphonyLimit();
         }
         if (m.strumDuration) this.strumDuration = m.strumDuration;
         if (m.enableOversampling !== undefined) this.isOversamplingEnabled = m.enableOversampling;
         if (m.globalBend !== undefined) this.globalBendMultiplier = m.globalBend;
         if (m.wavetableSize) generateWavetable(m.wavetableSize);
         if (m.interpolationType) interpolationType = m.interpolationType;
      }
      else if (m.type === 'note_on') this.triggerVoice(m.id, m.freq, m.voiceType, m.mode);
      else if (m.type === 'note_off') this.releaseVoice(m.id);
      else if (m.type === 'glide') this.glideVoice(m.id, m.freq);
      else if (m.type === 'stop_all') this.voices.forEach(v => v.hardStop());
    };
  }

  enforcePolyphonyLimit() {
      const active = this.voices.filter(v => v.active);
      if (active.length > this.maxPolyphony) {
          // Sort: prioritize keeping voices that are NOT released, and have the newest start times
          active.sort((a,b) => (a.releaseTime || a.startTime) - (b.releaseTime || b.startTime));
          const count = active.length - this.maxPolyphony;
          for (let i = 0; i < count; i++) {
              active[i].hardStop();
          }
      }
  }

  normalizePreset(d) {
    const n = (o) => ({...DUMMY_OSC_CONFIG, ...o});
    return {
        osc1: n(d.osc1), osc2: n(d.osc2), osc3: n(d.osc3),
        modMatrix: (d.modMatrix || []).map(r => ({...r, amount: (r.amount || 0) / 100.0})),
        gain: d.gain || 0.5, spread: d.spread || 0,
        stereoPanSpeed: d.stereoPanSpeed || 0, stereoPanDepth: d.stereoPanDepth || 0
    };
  }

  triggerVoice(id, freq, type, mode) {
    let v = this.voices.find(v => v.active && v.id === id);
    if (v) { v.trigger(id, freq, type, mode); return; }
    v = this.voices.find(v => !v.active);
    if (!v) {
        v = this.voices.sort((a,b) => (a.releaseTime||a.startTime) - (b.releaseTime||b.startTime))[0];
        if (v.active) this.port.postMessage({type:'voice_stolen', id:v.id});
    }
    v.trigger(id, freq, type, mode);
  }

  releaseVoice(id) { const v = this.voices.find(v => v.active && v.id === id); if (v) v.release(); }
  glideVoice(id, freq) { const v = this.voices.find(v => v.active && v.id === id); if (v) v.targetFreq = freq; }

  process(inputs, outputs) {
    const out = outputs[0], cL = out[0], cR = out[1]; if (!cL) return true;
    const len = cL.length, os = this.isOversamplingEnabled ? 2 : 1;
    const wLen = len * os, wRate = sampleRate * os, dt = 1.0 / wRate;

    if (!this.mixBufferL || this.mixBufferL.length !== wLen) {
        this.mixBufferL = new Float32Array(wLen); this.mixBufferR = new Float32Array(wLen);
        this.voices.forEach(v => v.updateSampleRate(wRate));
    }
    this.mixBufferL.fill(0); this.mixBufferR.fill(0);
    
    const mP = this.presets.normal, pS = mP.stereoPanSpeed || 0, pD = mP.stereoPanDepth || 0, iPP = this.panPhase;
    this.voices.forEach(v => {
        if (v.active) {
            if ((v.mode === 'trigger' || v.type === 'strum') && v.releaseTime === 0 && (currentTime - v.startTime >= this.strumDuration)) v.release();
            v.renderBlock(this.presets[v.type] || mP, dt, this.mixBufferL, this.mixBufferR, wLen, pS, pD, iPP, this.globalBendMultiplier);
        }
    });
    this.panPhase = (this.panPhase + wLen * dt * pS) % 1.0;

    for (let s = 0; s < len; s++) {
        let iL, iR;
        if (os === 2) {
            const idx = s * 2;
            iL = (fastSoftClip(this.mixBufferL[idx]) + fastSoftClip(this.mixBufferL[idx+1])) * 0.5;
            iR = (fastSoftClip(this.mixBufferR[idx]) + fastSoftClip(this.mixBufferR[idx+1])) * 0.5;
        } else {
            iL = fastSoftClip(this.mixBufferL[s]); iR = fastSoftClip(this.mixBufferR[s]);
        }
        const yL = iL - this.xm1L + 0.995 * this.ym1L; this.xm1L = iL; this.ym1L = yL;
        const yR = iR - this.xm1R + 0.995 * this.ym1R; this.xm1R = iR; this.ym1R = yR;
        cL[s] = yL; if (cR) cR[s] = yR;
    }
    return true;
  }
}
registerProcessor('synth-processor', PrismaProcessor);
`;
