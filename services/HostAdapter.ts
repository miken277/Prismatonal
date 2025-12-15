
export interface MidiDevice {
    id: string;
    name: string;
}

export interface TransportData {
    isPlaying: boolean;
    bpm: number;
    position: number; // Measures or Seconds
}

export type TransportCallback = (data: TransportData) => void;
export type MidiInputCallback = (bytes: number[]) => void;

// Global augmentations for bridge detection
declare global {
    interface Window {
        electronMidi?: {
            send: (channel: string, ...args: any[]) => void;
            receive?: (channel: string, func: Function) => void;
        };
        vstMidi?: {
            sendMidi: (bytes: number[]) => void;
        };
    }
}

export interface IHostAdapter {
    type: 'web' | 'electron' | 'vst';
    init(): Promise<boolean>;
    getOutputs(): Promise<MidiDevice[]>;
    setOutput(id: string | null): void;
    getInputs(): Promise<MidiDevice[]>;
    setInput(id: string | null): void;
    setInputCallback(cb: MidiInputCallback | null): void;
    sendMidi(bytes: number[]): void;
    setTransportCallback(cb: TransportCallback | null): void;
}

/**
 * Standard Web MIDI Implementation
 */
export class WebHostAdapter implements IHostAdapter {
    type = 'web' as const;
    private access: any = null;
    private output: any = null;
    private input: any = null;
    private inputCallback: MidiInputCallback | null = null;

    async init(): Promise<boolean> {
        if ((navigator as any).requestMIDIAccess) {
            try {
                this.access = await (navigator as any).requestMIDIAccess();
                return true;
            } catch (e) {
                console.error("Web MIDI Access Refused", e);
                return false;
            }
        }
        return false;
    }

    async getOutputs(): Promise<MidiDevice[]> {
        if (!this.access) return [];
        const devices: MidiDevice[] = [];
        this.access.outputs.forEach((output: any) => {
            devices.push({ id: output.id, name: output.name || `Output ${output.id}` });
        });
        return devices;
    }

    setOutput(id: string | null) {
        if (this.access && id) {
            this.output = this.access.outputs.get(id) || null;
        } else {
            this.output = null;
        }
    }

    async getInputs(): Promise<MidiDevice[]> {
        if (!this.access) return [];
        const devices: MidiDevice[] = [];
        this.access.inputs.forEach((input: any) => {
            devices.push({ id: input.id, name: input.name || `Input ${input.id}` });
        });
        return devices;
    }

    setInput(id: string | null) {
        // Clear previous
        if (this.input) {
            this.input.onmidimessage = null;
            this.input = null;
        }

        if (this.access && id) {
            this.input = this.access.inputs.get(id) || null;
            if (this.input) {
                this.input.onmidimessage = this.handleMidiMessage;
            }
        }
    }

    setInputCallback(cb: MidiInputCallback | null) {
        this.inputCallback = cb;
    }

    private handleMidiMessage = (event: any) => {
        if (this.inputCallback && event.data) {
            this.inputCallback(Array.from(event.data));
        }
    }

    sendMidi(bytes: number[]) {
        if (this.output) {
            this.output.send(bytes);
        }
    }

    setTransportCallback(cb: TransportCallback | null) {
        // Web MIDI doesn't strictly have a transport standard without WebMIDI Clock parsing.
        // Future implementation could parse MIDI Clock messages here.
    }
}

/**
 * Electron IPC Bridge Implementation
 */
export class ElectronHostAdapter implements IHostAdapter {
    type = 'electron' as const;

    async init(): Promise<boolean> {
        return !!window.electronMidi;
    }

    async getOutputs(): Promise<MidiDevice[]> {
        return [{ id: 'virtual_out', name: 'PrismaTonal Virtual Output' }];
    }

    async getInputs(): Promise<MidiDevice[]> {
        return [{ id: 'virtual_in', name: 'PrismaTonal Virtual Input' }];
    }

    setOutput(id: string | null) {
        // Electron bridge typically routes to a virtual port managed by the main process
    }

    setInput(id: string | null) {
        // Electron bridge manages input internally
    }

    setInputCallback(cb: MidiInputCallback | null) {
        if (window.electronMidi && window.electronMidi.receive) {
            window.electronMidi.receive('midi-message-in', (_: any, data: number[]) => {
                 if (cb) cb(data);
            });
        }
    }

    sendMidi(bytes: number[]) {
        if (window.electronMidi) {
            window.electronMidi.send('midi-message', bytes);
        }
    }

    setTransportCallback(cb: TransportCallback | null) {
        if (window.electronMidi && window.electronMidi.receive && cb) {
            window.electronMidi.receive('transport-update', (_: any, data: TransportData) => {
                cb(data);
            });
        }
    }
}

/**
 * VST/Plugin WebView Bridge Implementation
 */
export class VSTHostAdapter implements IHostAdapter {
    type = 'vst' as const;

    async init(): Promise<boolean> {
        return !!window.vstMidi;
    }

    async getOutputs(): Promise<MidiDevice[]> {
        return [{ id: 'host_out', name: 'DAW Host Track' }];
    }
    
    async getInputs(): Promise<MidiDevice[]> {
        return [{ id: 'host_in', name: 'DAW Input' }];
    }

    setOutput(id: string | null) {}
    setInput(id: string | null) {}

    setInputCallback(cb: MidiInputCallback | null) {
        // VST Bridge would need to expose a way to receive MIDI
        // For now, this is a placeholder
        // window.vstMidi.onMessage = cb;
    }

    sendMidi(bytes: number[]) {
        if (window.vstMidi) {
            window.vstMidi.sendMidi(bytes);
        }
    }

    setTransportCallback(cb: TransportCallback | null) {
        // VST Bridge would inject JS to call a global function on frame updates
        // This is a placeholder for that integration
    }
}

/**
 * Factory to detect and instantiate the correct adapter
 */
export const createHostAdapter = async (): Promise<IHostAdapter | null> => {
    // 1. Electron
    if (window.electronMidi) {
        const adapter = new ElectronHostAdapter();
        await adapter.init();
        return adapter;
    }
    // 2. VST
    if (window.vstMidi) {
        const adapter = new VSTHostAdapter();
        await adapter.init();
        return adapter;
    }
    // 3. Web
    if ((navigator as any).requestMIDIAccess) {
        const adapter = new WebHostAdapter();
        if (await adapter.init()) {
            return adapter;
        }
    }
    return null;
}
