import { SynthPreset, WaveformType } from '../types';
import { BASE_FREQUENCY } from '../constants';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voices: Map<number, { osc: OscillatorNode; gain: GainNode; startRatio: number }> = new Map();
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
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.activePreset.gain;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setPolyphony(count: number) {
    this.maxPolyphony = count;
  }

  public setMasterVolume(val: number) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx?.currentTime || 0, 0.05);
    }
  }

  public setPreset(preset: SynthPreset) {
    this.activePreset = preset;
    // Update master gain if preset changes
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(preset.gain, this.ctx!.currentTime, 0.1);
    }
  }

  public startVoice(pointerId: number, ratio: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    // Voice stealing if max polyphony reached
    if (this.voices.size >= this.maxPolyphony) {
      const firstKey = this.voices.keys().next().value;
      if (firstKey !== undefined) this.stopVoice(firstKey);
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = this.activePreset.waveform;
    osc.frequency.value = BASE_FREQUENCY * ratio;

    // Envelope Attack
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1.0, now + this.activePreset.attack);
    gain.gain.exponentialRampToValueAtTime(this.activePreset.sustain, now + this.activePreset.attack + this.activePreset.decay);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();

    this.voices.set(pointerId, { osc, gain, startRatio: ratio });
  }

  public stopVoice(pointerId: number) {
    if (!this.ctx) return;
    const voice = this.voices.get(pointerId);
    if (voice) {
      const now = this.ctx.currentTime;
      // Envelope Release
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + this.activePreset.release);
      
      voice.osc.stop(now + this.activePreset.release + 0.1);
      setTimeout(() => {
        voice.osc.disconnect();
        voice.gain.disconnect();
      }, (this.activePreset.release + 0.2) * 1000);

      this.voices.delete(pointerId);
    }
  }

  public bendVoice(pointerId: number, detuneCents: number) {
    const voice = this.voices.get(pointerId);
    if (voice && this.ctx) {
      // Calculate new frequency based on cents
      // f = f0 * 2^(cents/1200)
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
