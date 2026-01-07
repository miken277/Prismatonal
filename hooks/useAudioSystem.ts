
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

    // --- Initialization / Warmup ---
    // Handles the browser requirement for user gesture to start AudioContext
    useEffect(() => {
        const warmup = () => {
            audioEngine.resume().then(() => {});
            // Initialize MIDI only after user interaction to avoid premature permission prompts if desired,
            // though usually safe to do early if context is valid.
            if (settings.midiEnabled) midiService.init();

            // Cleanup listeners once triggered
            window.removeEventListener('pointerdown', warmup);
            window.removeEventListener('keydown', warmup);
            window.removeEventListener('touchstart', warmup);
            window.removeEventListener('touchend', warmup);
            window.removeEventListener('click', warmup);
        };

        window.addEventListener('pointerdown', warmup);
        window.addEventListener('keydown', warmup);
        window.addEventListener('touchstart', warmup);
        window.addEventListener('touchend', warmup);
        window.addEventListener('click', warmup);

        return () => {
            window.removeEventListener('pointerdown', warmup);
            window.removeEventListener('keydown', warmup);
            window.removeEventListener('touchstart', warmup);
            window.removeEventListener('touchend', warmup);
            window.removeEventListener('click', warmup);
        };
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
        stopAudio
    };
};
