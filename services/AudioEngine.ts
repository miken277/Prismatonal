
import { SynthPreset, WaveformType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  
  // FX Nodes
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayOutputGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  
  private currentMasterVol: number = 0.8;

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
      
      // Limiter (DynamicsCompressor)
      // Placed at the very end to catch peaks
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -1.0; // Start compressing just below clipping
      this.limiter.knee.value = 10;
      this.limiter.ratio.value = 20; // High ratio = Limiting
      this.limiter.attack.value = 0.001; // Fast attack to catch transients
      this.limiter.release.value = 0.2;
      this.limiter.connect(this.ctx.destination);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.currentMasterVol; 
      this.masterGain.connect(this.limiter); // Connect to limiter instead of destination

      // --- FX Bus Setup ---

      // Dry Bus
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 1.0; 
      this.dryGain.connect(this.masterGain);

      // Reverb Bus
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.createImpulseResponse(2.5, 2.0); // 2.5s duration, 2.0 decay
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.connect(this.reverbNode);
      this.reverbNode.connect(this.masterGain);

      // Delay Bus
      this.delayNode = this.ctx.createDelay(5.0);
      this.delayFeedbackGain = this.ctx.createGain();
      this.delayOutputGain = this.ctx.createGain();
      
      // Send logic: Voice -> DelayOutputGain -> DelayNode -> Master
      // Feedback: DelayNode -> DelayFeedbackGain -> DelayNode
      
      this.delayOutputGain.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);
      
      this.delayNode.connect(this.delayFeedbackGain);
      this.delayFeedbackGain.connect(this.delayNode);

      // Apply initial preset settings to FX
      this.updateFX();
    }
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private updateFX() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const ramp = 0.1;

      // Update Gains
      if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(this.activePreset.reverbMix, now, ramp);
      
      if (this.delayOutputGain) this.delayOutputGain.gain.setTargetAtTime(this.activePreset.delayMix, now, ramp);
      if (this.delayNode) this.delayNode.delayTime.setTargetAtTime(this.activePreset.delayTime, now, ramp);
      if (this.delayFeedbackGain) this.delayFeedbackGain.gain.setTargetAtTime(this.activePreset.delayFeedback, now, ramp);
      
      // Dry attenuation
      if (this.dryGain) this.dryGain.gain.setTargetAtTime(Math.max(0.5, 1.0 - (this.activePreset.reverbMix * 0.3)), now, ramp);
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx!.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    }
    return impulse;
  }

  public setPolyphony(count: number) {
    this.maxPolyphony = count;
  }

  public setMasterVolume(val: number) {
    this.currentMasterVol = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  public setPreset(preset: SynthPreset) {
    this.activePreset = preset;
    this.updateFX();
  }

  public startVoice(id: string, ratio: number, baseFrequency: number) {
    this.init();
    if (!this.ctx || !this.dryGain || !this.reverbGain || !this.delayOutputGain) return;

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
    const baseFreq = baseFrequency * ratio;
    
    // --- Audio Graph Construction ---
    
    const masterVoiceGain = this.ctx.createGain(); 
    const filter = this.ctx.createBiquadFilter();
    
    // Oscillator 1
    const osc1 = this.ctx.createOscillator();
    osc1.type = this.activePreset.waveform;
    osc1.frequency.value = baseFreq;

    // Oscillator 2
    const osc2 = this.ctx.createOscillator();
    osc2.type = this.activePreset.osc2Waveform;
    const detuneMultiplier = Math.pow(2, this.activePreset.osc2Detune / 1200);
    osc2.frequency.value = baseFreq * detuneMultiplier;
    
    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = this.activePreset.osc2Mix;

    // LFO Setup
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = this.activePreset.lfoRate;
    const lfoGain = this.ctx.createGain();

    // LFO Depth Scaling
    const rawDepth = this.activePreset.lfoDepth;
    let effectiveGain = 0;

    if (this.activePreset.lfoTarget === 'pitch') {
        effectiveGain = rawDepth; 
    } else if (this.activePreset.lfoTarget === 'filter') {
        effectiveGain = rawDepth * 20; 
    } else if (this.activePreset.lfoTarget === 'tremolo') {
        effectiveGain = (rawDepth / 100) * 0.5;
    }

    lfoGain.gain.value = effectiveGain;

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

    // Output Routing to Busses
    masterVoiceGain.connect(this.dryGain);
    masterVoiceGain.connect(this.reverbGain);
    masterVoiceGain.connect(this.delayOutputGain);

    // --- Envelope Control ---
    const voiceNormalization = 0.6; 
    const targetGain = this.activePreset.gain * voiceNormalization;

    masterVoiceGain.gain.setValueAtTime(0, now);
    masterVoiceGain.gain.linearRampToValueAtTime(targetGain, now + this.activePreset.attack);
    masterVoiceGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetGain * this.activePreset.sustain), now + this.activePreset.attack + this.activePreset.decay);

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
      
      const stopTime = now + releaseTime + 0.1;
      voice.osc1.stop(stopTime);
      voice.osc2.stop(stopTime);
      voice.lfo.stop(stopTime);

      setTimeout(() => {
        try {
            voice.osc1.disconnect();
            voice.osc2.disconnect();
            voice.lfo.disconnect();
            voice.gain.disconnect();
            voice.filter.disconnect();
        } catch(e) {}
      }, (releaseTime + 0.2) * 1000);

      this.voices.delete(id);
    }
  }

  public glideVoice(id: string, newRatio: number, baseFrequency: number, glideTime: number = 0.1) {
    const voice = this.voices.get(id);
    if (voice && this.ctx) {
       const newFreq = baseFrequency * newRatio;
       voice.osc1.frequency.setTargetAtTime(newFreq, this.ctx.currentTime, glideTime);
       
       const detuneMultiplier = Math.pow(2, this.activePreset.osc2Detune / 1200);
       voice.osc2.frequency.setTargetAtTime(newFreq * detuneMultiplier, this.ctx.currentTime, glideTime);
       
       voice.startRatio = newRatio; 
    }
  }

  public stopAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // 1. Hard kill all active voices
    this.voices.forEach((voice) => {
        try {
            // Immediate stop, no release phase
            voice.osc1.stop();
            voice.osc2.stop();
            voice.lfo.stop();
            voice.gain.disconnect();
        } catch (e) {
            console.error("Error hard-stopping voice", e);
        }
    });
    this.voices.clear();

    // 2. Kill FX Feedback loops immediately
    // This stops delay trails from regenerating
    if (this.delayFeedbackGain) {
        this.delayFeedbackGain.gain.cancelScheduledValues(now);
        this.delayFeedbackGain.gain.setValueAtTime(0, now);
    }

    // 3. Momentary Master Mute to clear buffer tails from speakers
    if (this.masterGain) {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(0, now);
    }

    // 4. Recover: Restore settings after short delay
    setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const recoveryTime = this.ctx.currentTime;
        
        // Ramp back up to current volume setting
        this.masterGain.gain.setTargetAtTime(this.currentMasterVol, recoveryTime, 0.2);
        
        // Restore FX feedback settings from preset
        this.updateFX();
    }, 200);
  }
}

export default AudioEngine;
