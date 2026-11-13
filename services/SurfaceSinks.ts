import { PlaybackMode, SynthPreset } from '../types';

// Host sinks for playing surfaces (SURFACE-CONTRACT.md §2, extraction §3 Step 1).
//
// A surface talks to its host only through these two interfaces. Today the
// host side is the web app: AudioEngine satisfies VoiceSink and the
// MidiService singleton satisfies MidiSink, both declared with `implements`
// so the compiler keeps them honest. A different host (Electron/JUCE
// bridge, a test double) can supply its own implementations without any
// surface changing.
//
// The signatures are exactly the call surface the existing surface
// (TonalityDiamond) already used on AudioEngine/MidiService — this file
// names that contract; it does not change it.

export interface VoiceSink {
  startVoice(id: string, ratio: number, baseFrequency: number, presetSlot?: string, playbackMode?: PlaybackMode, time?: number): void;
  stopVoice(id: string, time?: number): void;
  glideVoice(id: string, newRatio: number, baseFrequency: number): void;
  setPolyphony(count: number): void;
  resume(): Promise<void>;
  registerPreset(id: string, preset: SynthPreset): void;
  onVoiceSteal(callback: (id: string) => void): () => void;
}

export interface MidiSink {
  noteOn(id: string, ratio: number, baseFreq: number, bendRange: number): void;
  noteOff(id: string): void;
  pitchBend(id: string, ratio: number, baseFreq: number, bendRange: number): void;
  onGlobalBend(cb: (semitones: number) => void): () => void;
}
