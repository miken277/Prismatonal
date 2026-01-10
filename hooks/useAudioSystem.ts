
import { useState, useEffect, useCallback } from 'react';
import { AppSettings, PresetState } from '../types';
import { audioEngine } from '../services/AudioEngine';
import { midiService } from '../services/MidiService';

export const useAudioSystem = (
    settings: AppSettings,
    presets: PresetState
) => {
    // Audio Performance State
    const [masterVolume, setMasterVolume] = useState(0.8);
    const [spatialScale, setSpatialScale] = useState(1.0);
    const [brightness, setBrightness] = useState(1.0);

    // --- Audio Engine Synchronization ---
    
    // Sync Presets
    useEffect(() => {
        audioEngine.updatePresets(presets);
    }, [presets]);

    // Sync Settings
    useEffect(() => {
        audioEngine.updateSettings(settings);
    }, [settings]);

    // Sync Master FX
    useEffect(() => {
        audioEngine.setMasterVolume(masterVolume);
    }, [masterVolume]);

    useEffect(() => {
        audioEngine.setGlobalSpatialScale(spatialScale);
    }, [spatialScale]);

    useEffect(() => {
        audioEngine.setGlobalBrightness(brightness);
    }, [brightness]);

    // --- Explicit Initialization ---
    const startAudio = useCallback(async () => {
        try {
            await audioEngine.resume();
            console.log("Audio Context Resumed");
            
            // Initialize MIDI if enabled
            if (settings.midiEnabled) {
                const success = await midiService.init();
                if (!success) console.log("MIDI initialization skipped or failed (benign)");
            }
        } catch (e) {
            console.error("Failed to start audio engine", e);
        }
    }, [settings.midiEnabled]);

    const stopAudio = useCallback(() => {
        audioEngine.stopAll();
    }, []);

    return {
        masterVolume,
        setMasterVolume,
        spatialScale,
        setSpatialScale,
        brightness,
        setBrightness,
        startAudio, // Exposed for Splash Screen
        stopAudio
    };
};
