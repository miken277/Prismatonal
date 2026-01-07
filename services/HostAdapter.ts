
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
export type MidiMessageCallback = (status: number, data1: number, data2: number) => void;

// Global augmentations for bridge detection
declare global {
    interface Window {
        // Native Interop Flags
        __PRISMA_WRAPPER__?: 'electron' | 'juce_webview';
        
        // Electron / Generic Bridge
        electronMidi?: {
            send: (channel: string, ...args: any[]) => void;
            receive?: (channel: string, func: Function) => void;
        };
        
        // JUCE / VST Bridge
        __postMessageToHost?: (message: string) => void;
    }
}

export interface IHostAdapter {
    type: 'web' | 'electron' | 'vst';
    audioBackend: 'web' | 'native'; // 'web' = JS AudioContext, 'native' = C++ DSP
    init(): Promise<boolean>;
    getOutputs(): Promise<MidiDevice[]>;
    setOutput(id: string | null): void;
    sendMidi(bytes: number[]): void;
    sendCommand(type: string, payload: any): void; // New generic command sender
    setTransportCallback(cb: TransportCallback | null): void;
    setInputCallback(cb: MidiMessageCallback | null): void;
}

/**
 * Standard Web MIDI Implementation
 */
export class WebHostAdapter implements IHostAdapter {
    type = 'web' as const;
    audioBackend = 'web' as const;
    private access: any = null;
    private output: any = null;
    private inputCallback: MidiMessageCallback | null = null;

    async init(): Promise<boolean> {
        if ((navigator as any).requestMIDIAccess) {
            try {
                this.access = await (navigator as any).requestMIDIAccess();
                this.setupInputs();
                
                this.access.onstatechange = (e: any) => {
                    if (e.port.type === 'input' && e.port.state === 'connected') {
                        this.setupInputs();
                    }
                };
                return true;
            } catch (e) {
                console.error("Web MIDI Access Refused", e);
                return false;
            }
        }
        return false;
    }

    private setupInputs() {
        if (!this.access) return;
        this.access.inputs.forEach((input: any) => {
            input.onmidimessage = (e: any) => {
                if (this.inputCallback && e.data.length >= 2) {
                    const d2 = e.data.length > 2 ? e.data[2] : 0;
                    this.inputCallback(e.data[0], e.data[1], d2);
                }
            };
        });
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

    sendMidi(bytes: number[]) {
        if (this.output) this.output.send(bytes);
    }

    sendCommand(type: string, payload: any) {
        // In Web Mode, commands are internal or logged
        // console.log("Command:", type, payload);
    }

    setTransportCallback(cb: TransportCallback | null) {}

    setInputCallback(cb: MidiMessageCallback | null) {
        this.inputCallback = cb;
        this.setupInputs();
    }
}

/**
 * Electron IPC Bridge Implementation
 */
export class ElectronHostAdapter implements IHostAdapter {
    type = 'electron' as const;
    audioBackend = 'web' as const; // Usually Electron still uses Web Audio

    async init(): Promise<boolean> {
        return !!window.electronMidi;
    }

    async getOutputs(): Promise<MidiDevice[]> {
        return [{ id: 'virtual', name: 'PrismaTonal Virtual Output' }];
    }

    setOutput(id: string | null) {}

    sendMidi(bytes: number[]) {
        if (window.electronMidi) {
            window.electronMidi.send('midi-message', bytes);
        }
    }

    sendCommand(type: string, payload: any) {
        if (window.electronMidi) {
            window.electronMidi.send('app-command', { type, payload });
        }
    }

    setTransportCallback(cb: TransportCallback | null) {
        if (window.electronMidi && window.electronMidi.receive && cb) {
            window.electronMidi.receive('transport-update', (_: any, data: TransportData) => {
                cb(data);
            });
        }
    }

    setInputCallback(cb: MidiMessageCallback | null) {
        if (window.electronMidi && window.electronMidi.receive && cb) {
            window.electronMidi.receive('midi-input', (_: any, bytes: number[]) => {
               if (bytes.length >= 2) {
                   const d2 = bytes.length > 2 ? bytes[2] : 0;
                   cb(bytes[0], bytes[1], d2);
               }
            });
        }
    }
}

/**
 * VST/Plugin WebView Bridge Implementation (JUCE)
 */
export class VSTHostAdapter implements IHostAdapter {
    type = 'vst' as const;
    audioBackend = 'native' as const; // VST handles audio, JS UI is remote

    async init(): Promise<boolean> {
        return !!window.__postMessageToHost || !!(window as any).invokeNative;
    }

    async getOutputs(): Promise<MidiDevice[]> {
        return [{ id: 'host', name: 'DAW Host Track' }];
    }

    setOutput(id: string | null) {}

    sendMidi(bytes: number[]) {
        // Send as JSON object to C++
        this.sendNative({ type: 'midi', bytes });
    }

    sendCommand(type: string, payload: any) {
        this.sendNative({ type: 'command', command: type, payload });
    }

    private sendNative(msg: any) {
        if (window.__postMessageToHost) {
            window.__postMessageToHost(JSON.stringify(msg));
        }
    }

    setTransportCallback(cb: TransportCallback | null) {
        // Listen for window events dispatched by C++
        window.addEventListener('transport', (e: any) => {
            if (cb && e.detail) cb(e.detail);
        });
    }

    setInputCallback(cb: MidiMessageCallback | null) {}
}

/**
 * Factory to detect and instantiate the correct adapter
 */
export const createHostAdapter = async (): Promise<IHostAdapter | null> => {
    // 1. JUCE WebView (VST)
    if (window.__PRISMA_WRAPPER__ === 'juce_webview' || window.__postMessageToHost) {
        const adapter = new VSTHostAdapter();
        await adapter.init();
        return adapter;
    }
    // 2. Electron
    if (window.__PRISMA_WRAPPER__ === 'electron' || window.electronMidi) {
        const adapter = new ElectronHostAdapter();
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
    return new WebHostAdapter(); // Fallback
}
