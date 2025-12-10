
import { SynthPreset, WaveformType } from '../types';
import { BASE_FREQUENCY } from '../constants';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  
  // Voice map stores the graph for each active note
  private voices: Map<string, { 
    osc1: OscillatorNode; 
    osc2: OscillatorNode; 
    lfo: OscillatorNode;
    gain: GainNode; 
    filter: BiquadFilterNode; 
    startRatio: number 
  }> = new Map();
  
  private maxPolyphony: number = 12;
  private activePreset: SynthPreset;

  constructor(preset: SynthPreset) {
    this.activePreset = preset;
  }

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
      });
      
      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0; 
      this.masterGain.connect(this.ctx.destination);

      // Reverb Setup
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.createImpulseResponse(2.5, 2.0); // 2.5s duration, 2.0 decay
      
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = this.activePreset.reverbMix;
      
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 1.0 - this.activePreset.reverbMix;

      // Routing
      // Voice -> Dry -> Master
      this.dryGain.connect(this.masterGain);
      
      // Voice -> ReverbGain -> Reverb -> Master
      this.reverbGain.connect(this.reverbNode);
      this.reverbNode.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx!.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        // Simple noise decay
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    }
    return impulse;
  }

  public setPolyphony(count: number) {
    this.maxPolyphony = count;
  }

  public setMasterVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  public setPreset(preset: SynthPreset) {
    this.activePreset = preset;
    
    // Update Effects if initialized
    if (this.ctx) {
        if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(preset.reverbMix, this.ctx.currentTime, 0.1);
        if (this.dryGain) this.dryGain.gain.setTargetAtTime(1.0 - preset.reverbMix, this.ctx.currentTime, 0.1);
    }
  }

  public startVoice(id: string, ratio: number) {
    this.init();
    if (!this.ctx || !this.dryGain || !this.reverbGain) return;

    // Restart logic
    if (this.voices.has(id)) {
        this.stopVoice(id, true);
    }

    // Voice stealing
    if (this.voices.size >= this.maxPolyphony) {
      const firstKey = this.voices.keys().next().value;
      if (firstKey !== undefined) this.stopVoice(firstKey, true); 
    }

    const now = this.ctx.currentTime;
    const baseFreq = BASE_FREQUENCY * ratio;
    
    // --- Audio Graph Construction ---
    
    const masterVoiceGain = this.ctx.createGain(); // Envelope applied here
    const filter = this.ctx.createBiquadFilter();
    
    // Oscillator 1
    const osc1 = this.ctx.createOscillator();
    osc1.type = this.activePreset.waveform;
    osc1.frequency.value = baseFreq;

    // Oscillator 2
    const osc2 = this.ctx.createOscillator();
    osc2.type = this.activePreset.osc2Waveform;
    // Calculate Detune frequency
    // cents to ratio: 2^(cents/1200)
    const detuneMultiplier = Math.pow(2, this.activePreset.osc2Detune / 1200);
    osc2.frequency.value = baseFreq * detuneMultiplier;
    
    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = this.activePreset.osc2Mix;

    // LFO
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = this.activePreset.lfoRate;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = this.activePreset.lfoDepth;

    // Connections
    osc1.connect(filter);
    
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);

    // Filter Settings
    filter.type = 'lowpass';
    filter.frequency.value = this.activePreset.filterCutoff;
    filter.Q.value = this.activePreset.filterResonance;

    filter.connect(masterVoiceGain);
    
    // LFO Routing
    if (this.activePreset.lfoTarget === 'pitch') {
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);
    } else if (this.activePreset.lfoTarget === 'filter') {
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
    } else if (this.activePreset.lfoTarget === 'tremolo') {
        lfo.connect(lfoGain);
        lfoGain.connect(masterVoiceGain.gain);
    }

    // Output Routing
    masterVoiceGain.connect(this.dryGain);
    masterVoiceGain.connect(this.reverbGain);

    // --- Envelope Control ---
    masterVoiceGain.gain.setValueAtTime(0, now);
    masterVoiceGain.gain.linearRampToValueAtTime(this.activePreset.gain, now + this.activePreset.attack);
    masterVoiceGain.gain.exponentialRampToValueAtTime(Math.max(0.001, this.activePreset.gain * this.activePreset.sustain), now + this.activePreset.attack + this.activePreset.decay);

    // Start Oscillators
    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    this.voices.set(id, { osc1, osc2, lfo, gain: masterVoiceGain, filter, startRatio: ratio });
  }

  public stopVoice(id: string, immediate: boolean = false) {
    if (!this.ctx) return;
    const voice = this.voices.get(id);
    if (voice) {
      const now = this.ctx.currentTime;
      
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      
      const releaseTime = immediate ? 0.05 : this.activePreset.release;
      
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
      
      // Cleanup schedule
      const stopTime = now + releaseTime + 0.1;
      voice.osc1.stop(stopTime);
      voice.osc2.stop(stopTime);
      voice.lfo.stop(stopTime);

      setTimeout(() => {
        // Disconnect everything to avoid memory leaks
        try {
            voice.osc1.disconnect();
            voice.osc2.disconnect();
            voice.lfo.disconnect();
            voice.gain.disconnect();
            voice.filter.disconnect();
        } catch(e) {
            // ignore disconnect errors if already disconnected
        }
      }, (releaseTime + 0.2) * 1000);

      this.voices.delete(id);
    }
  }

  public glideVoice(id: string, newRatio: number, glideTime: number = 0.1) {
    const voice = this.voices.get(id);
    if (voice && this.ctx) {
       const newFreq = BASE_FREQUENCY * newRatio;
       voice.osc1.frequency.setTargetAtTime(newFreq, this.ctx.currentTime, glideTime);
       
       const detuneMultiplier = Math.pow(2, this.activePreset.osc2Detune / 1200);
       voice.osc2.frequency.setTargetAtTime(newFreq * detuneMultiplier, this.ctx.currentTime, glideTime);
       
       voice.startRatio = newRatio; 
    }
  }

  public stopAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.voices.forEach((voice) => {
        try {
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setValueAtTime(0, now);
            voice.osc1.stop();
            voice.osc2.stop();
            voice.lfo.stop();
            voice.gain.disconnect();
        } catch (e) {
            console.error("Error stopping voice in panic", e);
        }
    });
    this.voices.clear();
  }
}

export default AudioEngine;
