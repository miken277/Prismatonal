
import { ArpeggioStep, ArpConfig } from '../types';
import { audioEngine } from './AudioEngine';
import { midiService } from './MidiService';
import { store } from './Store';

type OnStepCallback = (stepIndex: number) => void;

class ArpeggiatorService {
    private isRunning: boolean = false;
    private timerId: number | null = null;
    private currentStepIndex: number = 0;
    
    // The "source" steps from the recording
    private baseSteps: ArpeggioStep[] = [];
    private currentConfig: ArpConfig | null = null;
    
    // The "effective" steps after processing Direction and Octave Range
    private playbackQueue: { nodeId: string, ratio: number, originalIndex: number, muted?: boolean }[] = [];
    
    private onStepCallback: OnStepCallback | null = null;
    private lastPlayedVoiceId: string | null = null;
    private lastNoteOffTimer: number | null = null;

    public start(steps: ArpeggioStep[], config: ArpConfig, bpm: number, onStep?: OnStepCallback) {
        this.stop();
        if (steps.length === 0) return;

        this.baseSteps = steps;
        this.currentConfig = config;
        this.onStepCallback = onStep || null;
        this.isRunning = true;
        this.currentStepIndex = 0;

        this.recalculateQueue();
        this.scheduleNextStep();
    }

    public stop() {
        this.isRunning = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (this.lastNoteOffTimer) {
            clearTimeout(this.lastNoteOffTimer);
            this.lastNoteOffTimer = null;
        }
        this.stopLastNote();
        this.currentStepIndex = 0;
    }

    public updateBpm(newBpm: number) {
        // Just continue running, the next schedule will pick up the new BPM from store/args
    }

    private stopLastNote() {
        if (this.lastPlayedVoiceId) {
            audioEngine.stopVoice(this.lastPlayedVoiceId);
            midiService.noteOff(this.lastPlayedVoiceId);
            this.lastPlayedVoiceId = null;
        }
    }

    private recalculateQueue() {
        if (!this.currentConfig) return;
        const config = this.currentConfig;
        
        let pool = this.baseSteps.map((s, i) => ({ ...s, originalIndex: i }));
        let final: { nodeId: string, ratio: number, originalIndex: number, muted?: boolean }[] = [];

        // 1. Octave Expansion
        const octaves = Math.max(1, Math.min(4, config.octaves));
        let expandedPool = [];
        for (let oct = 0; oct < octaves; oct++) {
            const mult = Math.pow(2, oct);
            for (const step of pool) {
                expandedPool.push({
                    nodeId: step.nodeId, 
                    ratio: step.ratio * mult,
                    originalIndex: step.originalIndex,
                    sortRatio: step.ratio * mult,
                    muted: step.muted
                });
            }
        }

        // 2. Direction
        switch (config.direction) {
            case 'up':
                expandedPool.sort((a, b) => a.sortRatio - b.sortRatio);
                final = expandedPool;
                break;
            case 'down':
                expandedPool.sort((a, b) => b.sortRatio - a.sortRatio);
                final = expandedPool;
                break;
            case 'updown':
                {
                    const up = [...expandedPool].sort((a, b) => a.sortRatio - b.sortRatio);
                    const down = [...expandedPool].sort((a, b) => b.sortRatio - a.sortRatio);
                    final = [...up, ...down];
                }
                break;
            case 'random':
                // Shuffle
                for (let i = expandedPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [expandedPool[i], expandedPool[j]] = [expandedPool[j], expandedPool[i]];
                }
                final = expandedPool;
                break;
            case 'order':
            default:
                final = expandedPool; 
                break;
        }
        
        this.playbackQueue = final;
    }

    private scheduleNextStep() {
        if (!this.isRunning || !this.currentConfig) return;

        const state = store.getSnapshot();
        const bpm = state.settings.arpBpm || 120;
        const config = this.currentConfig;

        // 1. Calculate Note Duration
        const beatMs = 60000 / bpm; // Duration of 1/4 note
        let div = 0.5; // default 1/8 relative to 1/4 beat
        
        switch(config.division) {
            case '1/1': div = 4.0; break;
            case '1/2': div = 2.0; break;
            case '1/4': div = 1.0; break;
            case '1/8': div = 0.5; break;
            case '1/16': div = 0.25; break;
            case '1/32': div = 0.125; break;
            case '1/4T': div = 1.0 * (2/3); break;
            case '1/8T': div = 0.5 * (2/3); break;
            case '1/16T': div = 0.25 * (2/3); break;
        }
        const stepDurationMs = beatMs * div;

        // 2. Calculate Swing
        let currentDelay = stepDurationMs;
        if (config.swing > 0) {
            const isEvenStep = (this.currentStepIndex % 2) !== 0; 
            const swingAmount = (config.swing / 100) * 0.33; 
            
            if (isEvenStep) {
                currentDelay = stepDurationMs * (1.0 - swingAmount); 
            } else {
                currentDelay = stepDurationMs * (1.0 + swingAmount);
            }
        }

        // 3. Apply Humanize Jitter
        if (config.humanize && config.humanize > 0) {
            const jitter = (Math.random() - 0.5) * config.humanize;
            currentDelay += jitter;
            // Ensure we don't go backwards excessively (min delay 10ms)
            if (currentDelay < 10) currentDelay = 10;
        }

        // 4. Play Current Step
        this.recalculateQueue(); 
        if (this.playbackQueue.length === 0) return;

        const patternLength = Math.max(1, config.length || 8);
        const effectiveLoopLength = Math.min(this.playbackQueue.length, patternLength);
        
        const wrappedIndex = this.currentStepIndex % effectiveLoopLength;
        const step = this.playbackQueue[wrappedIndex];

        // Trigger Sound
        if (this.lastPlayedVoiceId) {
            this.stopLastNote();
        }
        
        const probability = (config.probability !== undefined) ? config.probability : 1.0;
        const shouldPlay = !step.muted && Math.random() < probability;

        if (shouldPlay) {
            const voiceId = `arp-${step.nodeId}-${Date.now()}`;
            audioEngine.startVoice(voiceId, step.ratio, state.settings.baseFrequency, 'arpeggio');
            if (state.settings.midiEnabled) {
                midiService.noteOn(voiceId, step.ratio, state.settings.baseFrequency, state.settings.midiPitchBendRange);
            }
            this.lastPlayedVoiceId = voiceId;
        }

        if (this.onStepCallback) {
            this.onStepCallback(step.originalIndex);
        }

        // Schedule Note Off (Gate)
        const gateLen = stepDurationMs * Math.min(1.0, Math.max(0.1, config.gate));
        this.lastNoteOffTimer = window.setTimeout(() => {
            this.stopLastNote();
        }, gateLen);

        // Schedule Next Step
        this.timerId = window.setTimeout(() => {
            this.currentStepIndex++;
            this.scheduleNextStep();
        }, currentDelay);
    }
}

export const arpeggiatorService = new ArpeggiatorService();
