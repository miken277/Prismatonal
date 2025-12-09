
import { SynthPreset, WaveformType } from '../types';
import { BASE_FREQUENCY } from '../constants';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  
  private voices: Map<number, { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode; startRatio: number }> = new Map();
  private maxPolyphony: number = 6;
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

  public startVoice(pointerId: number, ratio: number) {
    this.init();
    if (!this.ctx || !this.dryGain || !this.reverbGain) return;

    // Voice stealing
    if (this.voices.size >= this.maxPolyphony) {
      const firstKey = this.voices.keys().next().value;
      if (firstKey !== undefined) this.stopVoice(firstKey);
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = this.activePreset.waveform;
    osc.frequency.value = BASE_FREQUENCY * ratio;

    // Filter
    filter.type = 'lowpass';
    filter.frequency.value = this.activePreset.filterCutoff;
    filter.Q.value = 1;

    // Envelope Attack
    const now = this.ctx.currentTime;
    
    // Gain Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.activePreset.gain, now + this.activePreset.attack);
    gain.gain.exponentialRampToValueAtTime(this.activePreset.gain * this.activePreset.sustain, now + this.activePreset.attack + this.activePreset.decay);

    // Connect Graph
    osc.connect(filter);
    filter.connect(gain);
    
    // Fan out to Dry and Wet busses
    gain.connect(this.dryGain);
    gain.connect(this.reverbGain);

    osc.start();

    this.voices.set(pointerId, { osc, gain, filter, startRatio: ratio });
  }

  public stopVoice(pointerId: number) {
    if (!this.ctx) return;
    const voice = this.voices.get(pointerId);
    if (voice) {
      const now = this.ctx.currentTime;
      
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + this.activePreset.release);
      
      voice.osc.stop(now + this.activePreset.release + 0.1);
      setTimeout(() => {
        voice.osc.disconnect();
        voice.gain.disconnect();
        voice.filter.disconnect();
      }, (this.activePreset.release + 0.2) * 1000);

      this.voices.delete(pointerId);
    }
  }

  public bendVoice(pointerId: number, detuneCents: number) {
    const voice = this.voices.get(pointerId);
    if (voice && this.ctx) {
      const multiplier = Math.pow(2, detuneCents / 1200);
      const baseFreq = BASE_FREQUENCY * voice.startRatio;
      voice.osc.frequency.setTargetAtTime(baseFreq * multiplier, this.ctx.currentTime, 0.05);
    }
  }

  public stopAll() {
    this.voices.forEach((v, key) => {
      this.stopVoice(key);
    });
    this.voices.clear();
  }
}

export default AudioEngine;
