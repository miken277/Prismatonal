import React, { useState, useCallback } from 'react';
import { AppSettings, ArpConfig, ArpeggioStep } from '../types';
import { arpeggiatorService } from '../services/ArpeggiatorService';
import { TonalityDiamondHandle } from '../components/TonalityDiamond';

export const useArpeggiatorLogic = (
    settings: AppSettings,
    updateSettings: (s: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void,
    diamondRef: React.RefObject<TonalityDiamondHandle>
) => {
    const [recordingArpId, setRecordingArpId] = useState<string | null>(null);
    const [currentArpStep, setCurrentArpStep] = useState(0);
    const [recordingFlash, setRecordingFlash] = useState<number>(0);

    const handleArpToggle = useCallback((id: string) => {
        const arp = settings.arpeggios.find(a => a.id === id);
        if (!arp) return;

        // Toggle Recording Mode
        if (recordingArpId === id) {
            setRecordingArpId(null);
            return;
        }

        if (recordingArpId) {
            setRecordingArpId(id);
            return;
        }

        // Auto-enter recording if empty
        if (arp.steps.length === 0) {
            setRecordingArpId(id);
            updateSettings(prev => ({
                ...prev,
                arpeggios: prev.arpeggios.map(a => a.id === id ? { ...a, isPlaying: false } : a)
            }));
            return;
        }

        // Toggle Playback
        const newIsPlaying = !arp.isPlaying;
        const newArps = settings.arpeggios.map(a => {
            if (a.id === id) return { ...a, isPlaying: newIsPlaying };
            return { ...a, isPlaying: false }; // Exclusive playback for now
        });
        
        updateSettings(prev => ({ ...prev, arpeggios: newArps }));

        if (newIsPlaying) {
            arpeggiatorService.start(
                arp.steps, arp.config, settings.arpBpm, 
                (step) => setCurrentArpStep(step),
                (nodeId, active) => diamondRef.current?.triggerVisual(nodeId, active)
            );
        } else {
            arpeggiatorService.stop();
        }
    }, [settings.arpeggios, settings.arpBpm, recordingArpId, updateSettings, diamondRef]);

    const handleArpRecordNote = useCallback((nodeId: string, ratio: number, n?: number, d?: number, limit?: number) => {
        if (!recordingArpId) return;

        setRecordingFlash(Date.now()); 

        const arpIndex = settings.arpeggios.findIndex(a => a.id === recordingArpId);
        if (arpIndex === -1) return;

        const currentSteps = settings.arpeggios[arpIndex].steps;
        if (currentSteps.length >= 32) {
            setRecordingArpId(null);
            return;
        }

        const newStep: ArpeggioStep = { nodeId, ratio, n, d, limit, muted: false };
        const newArps = [...settings.arpeggios];
        newArps[arpIndex] = { ...newArps[arpIndex], steps: [...currentSteps, newStep] };

        updateSettings(prev => ({ ...prev, arpeggios: newArps }));
    }, [recordingArpId, settings.arpeggios, updateSettings]);

    const handleArpPatternUpdate = useCallback((arpId: string, steps: ArpeggioStep[]) => {
        const arpIndex = settings.arpeggios.findIndex(a => a.id === arpId);
        if (arpIndex === -1) return;
        
        const newArps = [...settings.arpeggios];
        newArps[arpIndex] = { ...newArps[arpIndex], steps: steps };
        if (newArps[arpIndex].isPlaying && steps.length === 0) {
            newArps[arpIndex].isPlaying = false;
            arpeggiatorService.stop();
        }
        updateSettings(prev => ({ ...prev, arpeggios: newArps }));
    }, [settings.arpeggios, updateSettings]);

    const handleArpBpmChange = useCallback((bpm: number) => {
        updateSettings(prev => ({ ...prev, arpBpm: bpm }));
        arpeggiatorService.updateBpm(bpm);
    }, [updateSettings]);

    const handleArpRowConfigChange = useCallback((arpId: string, partial: Partial<ArpConfig>) => {
        const arpIndex = settings.arpeggios.findIndex(a => a.id === arpId);
        if (arpIndex === -1) return;

        const newArps = [...settings.arpeggios];
        newArps[arpIndex] = { ...newArps[arpIndex], config: { ...newArps[arpIndex].config, ...partial } };
        
        updateSettings(prev => ({ ...prev, arpeggios: newArps }));

        if (newArps[arpIndex].isPlaying) {
            arpeggiatorService.start(
                newArps[arpIndex].steps, newArps[arpIndex].config, settings.arpBpm, 
                (step) => setCurrentArpStep(step),
                (nodeId, active) => diamondRef.current?.triggerVisual(nodeId, active)
            );
        }
    }, [settings.arpeggios, settings.arpBpm, updateSettings, diamondRef]);

    const handlePlayAll = useCallback(() => {
        const newArps = settings.arpeggios.map(a => ({ ...a, isPlaying: a.steps.length > 0 }));
        updateSettings(prev => ({ ...prev, arpeggios: newArps }));
        
        const firstValid = newArps.find(a => a.steps.length > 0);
        if (firstValid) {
            arpeggiatorService.start(
                firstValid.steps, firstValid.config, settings.arpBpm, 
                (step) => setCurrentArpStep(step),
                (nodeId, active) => diamondRef.current?.triggerVisual(nodeId, active)
            );
        }
    }, [settings.arpeggios, settings.arpBpm, updateSettings, diamondRef]);

    const handleStopAll = useCallback(() => {
        const newArps = settings.arpeggios.map(a => ({ ...a, isPlaying: false }));
        updateSettings(prev => ({ ...prev, arpeggios: newArps }));
        arpeggiatorService.stop();
    }, [settings.arpeggios, updateSettings]);

    const stopArpAndRecording = useCallback(() => {
        handleStopAll();
        setRecordingArpId(null);
    }, [handleStopAll]);

    return {
        recordingArpId,
        setRecordingArpId,
        currentArpStep,
        recordingFlash,
        handleArpToggle,
        handleArpRecordNote,
        handleArpPatternUpdate,
        handleArpBpmChange,
        handleArpRowConfigChange,
        handlePlayAll,
        handleStopAll,
        stopArpAndRecording
    };
};