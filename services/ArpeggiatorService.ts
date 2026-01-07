
import { ArpeggioStep, ArpConfig, PlayMode } from '../types';
import { audioEngine } from './AudioEngine';
import { midiService } from './MidiService';
import { store } from './Store';

type OnStepCallback = (stepIndex: number) => void;
type OnNoteCallback = (nodeId: string, active: boolean) => void;

class ArpeggiatorService {
    private isRunning: boolean = false;
    private currentStepIndex: number = 0;
    
    // Lookahead Scheduler State
    private nextNoteTime: number = 0;
    private timerId: number | null = null;
    
    // The "source" steps from the recording
    private baseSteps: ArpeggioStep[] = [];
    private currentConfig: ArpConfig | null = null;
    
    // The "effective" steps after processing Direction and Octave Range
    private playbackQueue: { nodeId: string, ratio: number, originalIndex: number, muted?: boolean, mode?: number }[] = [];
    
    private onStepCallback: OnStepCallback | null = null;
    private onNoteCallback: OnNoteCallback | null = null; 
    
    // Track active visual nodes to ensure they are cleared on stop
    private activeVisualNodeIds: Set<string> = new Set();

    // Schedule ahead time (seconds)
    private readonly scheduleAheadTime = 0.1; // 100ms
    // Check interval (ms)
    private readonly lookaheadInterval = 25; // 25ms

    public start(steps: ArpeggioStep[], config: ArpConfig, bpm: number, onStep?: OnStepCallback, onNote?: OnNoteCallback) {
        this.stop();
        if (steps.length === 0) return;

        this.baseSteps = steps;
        this.currentConfig = config;
        this.onStepCallback = onStep || null;
        this.onNoteCallback = onNote || null;
        this.isRunning = true;
        this.currentStepIndex = 0;
        this.activeVisualNodeIds.clear();

        const ctx = audioEngine.getContext();
        if (ctx) {
            this.nextNoteTime = ctx.currentTime + 0.05; // Start slightly in future
            this.recalculateQueue();
            this.schedulerLoop();
        } else {
            // Fallback retry if context not ready
            audioEngine.init().then(() => {
                const ctx = audioEngine.getContext();
                if (ctx) {
                    this.nextNoteTime = ctx.currentTime + 0.05;
                    this.recalculateQueue();
                    this.schedulerLoop();
                }
            });
        }
    }

    public stop() {
        this.isRunning = false;
        if (this.timerId) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
        
        // Use stopGroup to clear future scheduled Arp events and trigger release for current ones
        // This ensures sound tails off naturally (doesn't hard cut like stopAll)
        audioEngine.stopGroup('arp-'); 
        
        // Explicitly clear any active visual feedback
        if (this.onNoteCallback) {
            this.activeVisualNodeIds.forEach(id => {
                this.onNoteCallback!(id, false);
            });
        }
        this.activeVisualNodeIds.clear();
        
        this.currentStepIndex = 0;
    }

    public updateBpm(newBpm: number) {
        // Scheduler picks up new BPM on next cycle automatically from store (accessed in advanceNoteTime)
    }

    private schedulerLoop() {
        if (!this.isRunning) return;

        const ctx = audioEngine.getContext();
        if (!ctx) return;

        const currentTime = ctx.currentTime;

        // Schedule notes falling within the lookahead window
        while (this.nextNoteTime < currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.nextNoteTime);
            this.advanceNoteTime();
        }
        
        this.timerId = window.setTimeout(() => this.schedulerLoop(), this.lookaheadInterval);
    }

    private advanceNoteTime() {
        const state = store.getSnapshot();
        const bpm = state.settings.arpBpm || 120;
        const config = this.currentConfig;
        if (!config) return;

        const beatMs = 60000 / bpm; 
        let div = 0.5; // default 1/8
        
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
        
        let stepDurationSeconds = (beatMs * div) / 1000;

        // Swing Logic
        if (config.swing > 0) {
            const isEvenStep = (this.currentStepIndex % 2) === 0;
            const swingAmount = (config.swing / 100) * 0.33; 
            if (isEvenStep) stepDurationSeconds *= (1.0 + swingAmount); 
            else stepDurationSeconds *= (1.0 - swingAmount);
        }

        // Humanize Logic
        if (config.humanize && config.humanize > 0) {
            const jitterSeconds = (Math.random() - 0.5) * (config.humanize / 1000);
            stepDurationSeconds += jitterSeconds;
        }

        this.nextNoteTime += Math.max(0.01, stepDurationSeconds);
        this.currentStepIndex++;
    }

    private scheduleNote(time: number) {
        if (!this.playbackQueue.length || !this.currentConfig) return;
        
        const config = this.currentConfig;
        const patternLength = Math.max(1, config.length || 8);
        const effectiveLoopLength = Math.min(this.playbackQueue.length, patternLength);
        
        const wrappedIndex = this.currentStepIndex % effectiveLoopLength;
        const step = this.playbackQueue[wrappedIndex];

        const probability = (config.probability !== undefined) ? config.probability : 1.0;
        const shouldPlay = !step.muted && Math.random() < probability;

        if (shouldPlay) {
            const voiceId = `arp-${step.nodeId}-${Date.now()}-${Math.random()}`;
            const state = store.getSnapshot();
            
            // Calculate Gate Duration
            const beatMs = 60000 / (state.settings.arpBpm || 120);
            // Re-derive division scale for gate calculation
            let divBase = 0.5;
             switch(config.division) {
                case '1/1': divBase = 4.0; break;
                case '1/2': divBase = 2.0; break;
                case '1/4': divBase = 1.0; break;
                case '1/8': divBase = 0.5; break;
                case '1/16': divBase = 0.25; break;
                case '1/32': divBase = 0.125; break;
                case '1/4T': divBase = 1.0 * (2/3); break;
                case '1/8T': divBase = 0.5 * (2/3); break;
                case '1/16T': divBase = 0.25 * (2/3); break;
            }
            const durationSec = (beatMs * divBase / 1000) * Math.min(1.0, Math.max(0.1, config.gate));
            const stopTime = time + durationSec;

            // Determine Voice Slot based on recorded mode
            // Fallback to 'keys' if mode is missing or invalid
            let voiceSlot: PlayMode = 'keys';
            if (step.mode === 1) voiceSlot = 'latch'; // Drone
            else if (step.mode === 2) voiceSlot = 'normal'; // Strings
            else if (step.mode === 3) voiceSlot = 'strum'; // Plucked
            else if (step.mode === 4) voiceSlot = 'brass'; // Brass
            else if (step.mode === 5) voiceSlot = 'keys'; // Keys

            // Trigger Audio with precise time
            audioEngine.startVoice(voiceId, step.ratio, state.settings.baseFrequency, voiceSlot, 'gate', time);
            
            // Schedule Stop
            audioEngine.stopVoice(voiceId, stopTime);

            const ctx = audioEngine.getContext();
            const delayMs = Math.max(0, (time - (ctx?.currentTime || 0)) * 1000);

            // Schedule Visuals and MIDI (Best Effort)
            // Visuals are synced to occur roughly when the sound starts
            setTimeout(() => {
                if (!this.isRunning) return;
                
                // Visual ON
                this.activeVisualNodeIds.add(step.nodeId);
                if (this.onNoteCallback) this.onNoteCallback(step.nodeId, true);
                
                // MIDI ON
                if (state.settings.midiEnabled) {
                    midiService.noteOn(voiceId, step.ratio, state.settings.baseFrequency, state.settings.midiPitchBendRange);
                }

                // Schedule OFF
                setTimeout(() => {
                    if (!this.isRunning) return;
                    
                    if (this.onNoteCallback) this.onNoteCallback(step.nodeId, false);
                    this.activeVisualNodeIds.delete(step.nodeId);
                    
                    if (state.settings.midiEnabled) midiService.noteOff(voiceId);
                }, durationSec * 1000);

            }, delayMs);
        }
        
        // Step Callback (Visual Playhead)
        const visualDelay = Math.max(0, (time - (audioEngine.getContext()?.currentTime || 0)) * 1000);
        setTimeout(() => {
            if (this.isRunning && this.onStepCallback) {
                this.onStepCallback(step.originalIndex);
            }
        }, visualDelay);
    }

    private recalculateQueue() {
        if (!this.currentConfig) return;
        const config = this.currentConfig;
        
        let pool = this.baseSteps.map((s, i) => ({ ...s, originalIndex: i }));
        let final: { nodeId: string, ratio: number, originalIndex: number, muted?: boolean, mode?: number }[] = [];

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
                    muted: step.muted,
                    mode: step.mode
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
}

export const arpeggiatorService = new ArpeggiatorService();
