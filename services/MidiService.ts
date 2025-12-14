
export interface MidiDevice {
    id: string;
    name: string;
}

// Interface for the Electron Preload Bridge
interface ElectronMidiBridge {
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
}

// Interface for a hypothetical VST Bridge (e.g., embedded WebView)
interface VSTMidiBridge {
    sendMidi: (bytes: number[]) => void;
}

declare global {
    interface Window {
        electronMidi?: ElectronMidiBridge;
        vstMidi?: VSTMidiBridge;
    }
}

type MidiBackendType = 'web' | 'electron' | 'vst' | 'none';

class MidiService {
    private access: any = null;
    private output: any = null;
    private initialized = false;
    private backend: MidiBackendType = 'none';
    
    // Channel Management for Polyphonic Pitch Bend (MPE-style)
    private activeNotes: Map<string, { channel: number, note: number }> = new Map(); 
    private nextChannel = 0; // 0-15 (corresponding to Ch 1-16)

    constructor() {}

    public async init(): Promise<boolean> {
        if (this.initialized) return true;

        // 1. Check for Electron Bridge
        if (window.electronMidi) {
            console.log("Initializing MIDI: Electron Backend Detected");
            this.backend = 'electron';
            this.initialized = true;
            return true;
        }

        // 2. Check for VST Bridge
        if (window.vstMidi) {
             console.log("Initializing MIDI: VST Backend Detected");
             this.backend = 'vst';
             this.initialized = true;
             return true;
        }

        // 3. Fallback to Standard Web MIDI
        if ((navigator as any).requestMIDIAccess) {
            console.log("Initializing MIDI: Web MIDI Backend Detected");
            try {
                this.access = await (navigator as any).requestMIDIAccess();
                this.backend = 'web';
                this.initialized = true;
                return true;
            } catch (e) {
                console.error("Failed to access Web MIDI", e);
                return false;
            }
        }

        console.warn("MIDI not supported in this environment");
        return false;
    }

    public getOutputs(): MidiDevice[] {
        // In Electron/VST mode, the "Device" is effectively the Virtual Port created by the host
        if (this.backend === 'electron') {
            return [{ id: 'virtual', name: 'PrismaTonal Virtual Output' }];
        }
        if (this.backend === 'vst') {
            return [{ id: 'host', name: 'DAW Host' }];
        }

        if (this.backend === 'web' && this.access) {
            const devices: MidiDevice[] = [];
            this.access.outputs.forEach((output: any) => {
                devices.push({
                    id: output.id,
                    name: output.name || `MIDI Output ${output.id}`
                });
            });
            return devices;
        }

        return [];
    }

    public setOutput(id: string | null) {
        if (this.backend === 'web' && this.access && id) {
            this.output = this.access.outputs.get(id) || null;
        }
        // Electron/VST don't need explicit output selection as they route to the host/virtual port
    }

    // --- MIDI MESSAGES ---

    private sendBytes(bytes: number[]) {
        if (this.backend === 'web' && this.output) {
            this.output.send(bytes);
        } else if (this.backend === 'electron' && window.electronMidi) {
            window.electronMidi.send('midi-message', bytes);
        } else if (this.backend === 'vst' && window.vstMidi) {
            window.vstMidi.sendMidi(bytes);
        }
    }

    public noteOn(id: string, ratio: number, baseFreq: number, bendRange: number) {
        const freq = baseFreq * ratio;
        const midiFloat = 69 + 12 * Math.log2(freq / 440);
        const noteNumber = Math.round(midiFloat);
        const bendSemitones = midiFloat - noteNumber;
        
        const normalizedBend = bendSemitones / bendRange; 
        const bendValue = Math.min(16383, Math.max(0, Math.round(8192 + (normalizedBend * 8192))));

        // Channel
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
}

export const midiService = new MidiService();
