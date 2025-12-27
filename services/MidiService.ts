
import { createHostAdapter, IHostAdapter, MidiDevice, TransportCallback } from './HostAdapter';

// Re-export for consumers (SettingsModal, etc.)
export type { MidiDevice };

type SustainListener = (active: boolean) => void;
type GlobalBendListener = (semitones: number) => void;

class MidiService {
    private adapter: IHostAdapter | null = null;
    private initialized = false;
    
    // Channel Management for Polyphonic Pitch Bend (MPE-style)
    private activeNotes: Map<string, { channel: number, note: number }> = new Map(); 
    private nextChannel = 0; // 0-15 (corresponding to Ch 1-16)

    private sustainListeners: Set<SustainListener> = new Set();
    private globalBendListeners: Set<GlobalBendListener> = new Set();

    constructor() {}

    public async init(): Promise<boolean> {
        if (this.initialized) return true;

        this.adapter = await createHostAdapter();
        
        if (this.adapter) {
            console.log(`Initializing MIDI: ${this.adapter.type.toUpperCase()} Backend Detected`);
            this.initialized = true;
            
            // Set up input listening
            this.adapter.setInputCallback((status, d1, d2) => {
                this.handleIncomingMidi(status, d1, d2);
            });

            return true;
        } else {
            console.warn("MIDI not supported in this environment");
            return false;
        }
    }

    private handleIncomingMidi(status: number, d1: number, d2: number) {
        const channel = status & 0x0F; // 0-15
        const type = status & 0xF0;

        // Control Change (0xB0)
        if (type === 0xB0) {
            // CC 64: Sustain Pedal
            if (d1 === 64) {
                const isActive = d2 >= 64;
                this.notifySustainListeners(isActive);
            }
        }
        // Pitch Bend (0xE0)
        // Listen strictly on Channel 1 (index 0) for Global/Master Bend
        else if (type === 0xE0 && channel === 0) {
            const lsb = d1;
            const msb = d2;
            const value = (msb << 7) + lsb; // 0 to 16383, center 8192
            
            // Normalize to -1.0 to 1.0
            const normalized = (value - 8192) / 8192;
            
            // Default Master Bend Range is +/- 2 semitones
            const range = 2; 
            const semitones = normalized * range;
            
            this.notifyGlobalBendListeners(semitones);
        }
    }

    public onSustain(cb: SustainListener) {
        this.sustainListeners.add(cb);
        return () => { this.sustainListeners.delete(cb); };
    }

    public onGlobalBend(cb: GlobalBendListener) {
        this.globalBendListeners.add(cb);
        return () => { this.globalBendListeners.delete(cb); };
    }

    private notifySustainListeners(active: boolean) {
        this.sustainListeners.forEach(cb => cb(active));
    }

    private notifyGlobalBendListeners(semitones: number) {
        this.globalBendListeners.forEach(cb => cb(semitones));
    }

    public async getOutputs(): Promise<MidiDevice[]> {
        if (!this.adapter) return [];
        return this.adapter.getOutputs();
    }

    public setOutput(id: string | null) {
        if (this.adapter) {
            this.adapter.setOutput(id);
        }
    }

    public setTransportCallback(cb: TransportCallback) {
        if (this.adapter) {
            this.adapter.setTransportCallback(cb);
        }
    }

    // --- MIDI MESSAGES ---

    private sendBytes(bytes: number[]) {
        if (this.adapter) {
            this.adapter.sendMidi(bytes);
        }
    }

    public sendControlChange(cc: number, value: number, channel: number = 0) {
        this.sendBytes([0xB0 | channel, cc, value]);
    }

    public sendSustain(active: boolean) {
        const val = active ? 127 : 0;
        // In MPE mode, it's safest to send Sustain to ALL channels to ensure voices on rotated channels hold.
        // Some synths only listen to Ch 1, but MPE specs usually treat CCs on Ch 1 as "Common" 
        // or require per-channel redundancy. We'll do redundancy to be safe.
        for (let ch = 0; ch < 16; ch++) {
            this.sendControlChange(64, val, ch);
        }
    }

    public noteOn(id: string, ratio: number, baseFreq: number, bendRange: number) {
        const freq = baseFreq * ratio;
        const midiFloat = 69 + 12 * Math.log2(freq / 440);
        const noteNumber = Math.round(midiFloat);
        const bendSemitones = midiFloat - noteNumber;
        
        const normalizedBend = bendSemitones / bendRange; 
        const bendValue = Math.min(16383, Math.max(0, Math.round(8192 + (normalizedBend * 8192))));

        // Channel Rotation for MPE
        let channel = this.nextChannel;
        this.nextChannel = (this.nextChannel + 1) % 16; 
        
        this.activeNotes.set(id, { channel, note: noteNumber });

        // Pitch Bend LSB/MSB
        const lsb = bendValue & 0x7F;
        const msb = (bendValue >> 7) & 0x7F;
        
        // Send Pitch Bend (0xE0)
        this.sendBytes([0xE0 | channel, lsb, msb]);

        // Send Note On (0x90)
        this.sendBytes([0x90 | channel, noteNumber, 100]);
    }

    public noteOff(id: string) {
        const data = this.activeNotes.get(id);
        if (!data) return;

        // Note Off (0x80)
        this.sendBytes([0x80 | data.channel, data.note, 0]);
        this.activeNotes.delete(id);
    }

    public pitchBend(id: string, ratio: number, baseFreq: number, bendRange: number) {
        const data = this.activeNotes.get(id);
        if (!data) return;

        // Re-calc logic
        const freq = baseFreq * ratio;
        const exactMidi = 69 + 12 * Math.log2(freq / 440);
        
        const diffSemitones = exactMidi - data.note;
        
        const normalizedBend = diffSemitones / bendRange;
        const bendValue = Math.min(16383, Math.max(0, Math.round(8192 + (normalizedBend * 8192))));

        const lsb = bendValue & 0x7F;
        const msb = (bendValue >> 7) & 0x7F;

        this.sendBytes([0xE0 | data.channel, lsb, msb]);
    }

    // Standard MIDI Panic: Sends All Notes Off (CC 123) and All Sound Off (CC 120) to all channels
    public panic() {
        this.activeNotes.clear();
        if (!this.adapter) return;

        for (let ch = 0; ch < 16; ch++) {
            // CC 123: All Notes Off
            this.sendBytes([0xB0 | ch, 123, 0]);
            // CC 120: All Sound Off (Immediate mute)
            this.sendBytes([0xB0 | ch, 120, 0]);
            // Reset Pitch Bend
            this.sendBytes([0xE0 | ch, 0, 64]);
            // Reset Sustain
            this.sendBytes([0xB0 | ch, 64, 0]);
        }
    }
}

export const midiService = new MidiService();
