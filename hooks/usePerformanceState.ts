
import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '../types';
import { midiService } from '../services/MidiService';
import { audioEngine } from '../services/AudioEngine';

export const usePerformanceState = (
    settings: AppSettings,
    updateSettings: (s: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void
) => {
    // Latch Modes: 0=Off, 1=Drone, 2=Strings, 3=Plucked, 4=Brass, 5=Keys, 6=Percussion
    const [latchMode, setLatchMode] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(2);
    
    // Track sustain ON/OFF preference per instrument mode
    const [sustainStates, setSustainStates] = useState<{ [key: number]: boolean }>({ 
        1: true, // Drone defaults to True
        2: false, 
        3: false, 
        4: false, 
        5: false,
        6: false
    });

    // Track bend ON/OFF preference per instrument mode
    const [bendStates, setBendStates] = useState<{ [key: number]: boolean }>({
        1: false, 
        2: false, 
        3: false, 
        4: false, 
        5: false, 
        6: false
    });

    // Track which modes currently have active voices sustained
    const [activeSustainedModes, setActiveSustainedModes] = useState<number[]>([]);

    // --- MIDI Sync for Sustain & Bend ---
    useEffect(() => {
        // Subscribe to external MIDI sustain events
        const unsubscribeSustain = midiService.onSustain((isActive) => {
            setSustainStates(prev => ({ ...prev, [latchMode]: isActive }));
            updateSettings(prev => ({ ...prev, isSustainEnabled: isActive }));
        });

        // Subscribe to external MIDI Pitch Bend (Global)
        const unsubscribeBend = midiService.onGlobalBend((semitones) => {
            audioEngine.setGlobalBend(semitones);
        });

        return () => {
            unsubscribeSustain();
            unsubscribeBend();
        };
    }, [latchMode, updateSettings]);

    // --- Actions ---

    const switchInstrument = useCallback((newMode: 0 | 1 | 2 | 3 | 4 | 5 | 6) => {
        // Save current states for old mode
        setSustainStates(prev => ({ ...prev, [latchMode]: settings.isSustainEnabled }));
        setBendStates(prev => ({ ...prev, [latchMode]: settings.isPitchBendEnabled }));
        
        setLatchMode(newMode);
        
        // Load stored states for new mode
        const nextSustainState = sustainStates[newMode] ?? false;
        const nextBendState = bendStates[newMode] ?? false;
        
        updateSettings(prev => ({ 
            ...prev, 
            isSustainEnabled: nextSustainState,
            isPitchBendEnabled: nextBendState
        }));
    }, [latchMode, settings.isSustainEnabled, settings.isPitchBendEnabled, sustainStates, bendStates, updateSettings]);

    const handleSustainToggle = useCallback(() => {
        const willEnable = !settings.isSustainEnabled;
        setSustainStates(prev => ({ ...prev, [latchMode]: willEnable }));
        updateSettings(prev => ({ ...prev, isSustainEnabled: willEnable }));
        if (settings.midiEnabled) {
            midiService.sendSustain(willEnable);
        }
    }, [latchMode, settings.isSustainEnabled, settings.midiEnabled, updateSettings]);

    const handleBendToggle = useCallback(() => {
        const willEnable = !settings.isPitchBendEnabled;
        setBendStates(prev => ({ ...prev, [latchMode]: willEnable }));
        updateSettings(prev => ({ ...prev, isPitchBendEnabled: willEnable }));
    }, [latchMode, settings.isPitchBendEnabled, updateSettings]);

    const handleSustainStatusChange = useCallback((modes: number[]) => {
        setActiveSustainedModes(modes);
    }, []);

    return {
        latchMode,
        activeSustainedModes,
        switchInstrument,
        handleSustainToggle,
        handleBendToggle,
        handleSustainStatusChange,
        // Helper aliases
        handleDroneSelect: () => switchInstrument(1),
        handleStringSelect: () => switchInstrument(2),
        handlePluckedSelect: () => switchInstrument(3),
        handleVoiceSelect: () => switchInstrument(4),
        handleKeysSelect: () => switchInstrument(5),
        handlePercussionSelect: () => switchInstrument(6),
    };
};
