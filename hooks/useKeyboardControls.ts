
import React, { useEffect } from 'react';
import { AppSettings } from '../types';

interface Props {
    settings: AppSettings;
    latchMode: number;
    
    isSettingsOpen: boolean;
    setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    
    isSynthOpen: boolean;
    setIsSynthOpen: React.Dispatch<React.SetStateAction<boolean>>;
    
    setMasterVolume: React.Dispatch<React.SetStateAction<number>>;
    setSpatialScale: React.Dispatch<React.SetStateAction<number>>;
    setIsSequencerOpen: React.Dispatch<React.SetStateAction<boolean>>;
    
    handleDroneSelect: () => void;
    handleStringSelect: () => void;
    handlePluckedSelect: () => void;
    handleVoiceSelect: () => void;
    handleKeysSelect?: () => void;
    handlePercussionSelect?: () => void; 
    handleSustainToggle: () => void;
    handleBendToggle: () => void;
    handleShiftToggle?: () => void; // NEW
    handlePanic: () => void;
    handleCenter: () => void;
    handleOff: () => void;
    handleAddChord: () => void;
    handleIncreaseDepth: () => void;
    handleDecreaseDepth: () => void;
    handleArpBpmChange: (bpm: number) => void;
    handlePlayAll: () => void;
    handleStopAll: () => void;
}

export const useKeyboardControls = ({
    settings, latchMode, isSettingsOpen, setIsSettingsOpen, isSynthOpen, setIsSynthOpen,
    setMasterVolume, setSpatialScale, setIsSequencerOpen,
    handleDroneSelect, handleStringSelect, handlePluckedSelect, handleVoiceSelect, handleKeysSelect, handlePercussionSelect,
    handleSustainToggle, handleBendToggle, handleShiftToggle, handlePanic, handleCenter, handleOff,
    handleAddChord, handleIncreaseDepth, handleDecreaseDepth, handleArpBpmChange,
    handlePlayAll, handleStopAll
}: Props) => {
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && (isSettingsOpen || isSynthOpen)) {
                setIsSettingsOpen(false); 
                setIsSynthOpen(false); 
                return;
            }
            
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
            if (!settings.enableKeyboardShortcuts) return;

            const key = e.key.toLowerCase();
            const map = settings.keyMappings;

            // Prevent default scrolling/browser actions for specific mapped keys
            if ([map.latch, map.volumeUp, map.volumeDown, map.spatialScaleUp, map.spatialScaleDown].map(k => k.toLowerCase()).includes(key)) {
                e.preventDefault();
            }

            if (key === map.latch.toLowerCase()) { if (latchMode === 1) handleStringSelect(); else handleDroneSelect(); }
            else if (key === map.modeDrone.toLowerCase()) handleDroneSelect();
            else if (key === map.modeStrings.toLowerCase()) handleStringSelect();
            else if (key === map.modePlucked.toLowerCase()) handlePluckedSelect();
            else if (key === map.modeBrass.toLowerCase()) handleVoiceSelect(); 
            else if (key === (map.modeKeys || '5').toLowerCase() && handleKeysSelect) handleKeysSelect(); 
            else if (key === (map.modePercussion || '6').toLowerCase() && handlePercussionSelect) handlePercussionSelect();
            else if (key === map.sustain.toLowerCase()) handleSustainToggle();
            else if (key === map.bend.toLowerCase()) handleBendToggle();
            else if (key === (map.shift || 'shift').toLowerCase() && handleShiftToggle) handleShiftToggle(); // NEW
            else if (key === map.panic.toLowerCase()) handlePanic();
            else if (key === map.center.toLowerCase()) handleCenter();
            else if (key === map.settings.toLowerCase()) { setIsSettingsOpen(prev => !prev); if(isSynthOpen) setIsSettingsOpen(false); }
            else if (key === map.synth.toLowerCase()) { setIsSynthOpen(prev => !prev); if(isSettingsOpen) setIsSettingsOpen(false); }
            else if (key === map.off.toLowerCase()) handleOff();
            else if (key === map.addChord.toLowerCase()) handleAddChord();
            else if (key === map.increaseDepth.toLowerCase()) handleIncreaseDepth();
            else if (key === map.decreaseDepth.toLowerCase()) handleDecreaseDepth();
            else if (key === map.volumeUp.toLowerCase()) setMasterVolume(v => Math.min(1.0, v + 0.05));
            else if (key === map.volumeDown.toLowerCase()) setMasterVolume(v => Math.max(0.0, v - 0.05));
            else if (key === map.spatialScaleUp.toLowerCase()) setSpatialScale(s => Math.min(2.0, s + 0.05));
            else if (key === map.spatialScaleDown.toLowerCase()) setSpatialScale(s => Math.max(0.0, s - 0.05));
            else if (key === map.bpmUp.toLowerCase()) handleArpBpmChange(settings.arpBpm + 1);
            else if (key === map.bpmDown.toLowerCase()) handleArpBpmChange(settings.arpBpm - 1);
            else if (key === map.toggleSequencer.toLowerCase()) setIsSequencerOpen(prev => !prev);
            else if (key === map.playAllArps.toLowerCase()) handlePlayAll();
            else if (key === map.stopAllArps.toLowerCase()) handleStopAll();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        settings.enableKeyboardShortcuts, 
        settings.keyMappings, 
        settings.arpBpm,
        latchMode, 
        isSettingsOpen, 
        isSynthOpen,
        handleDroneSelect, handleStringSelect, handlePluckedSelect, handleVoiceSelect, handleKeysSelect, handlePercussionSelect,
        handleSustainToggle, handleBendToggle, handleShiftToggle, handlePanic, handleCenter, handleOff,
        handleAddChord, handleIncreaseDepth, handleDecreaseDepth, handleArpBpmChange,
        handlePlayAll, handleStopAll, setIsSettingsOpen, setIsSynthOpen, setMasterVolume, setSpatialScale, setIsSequencerOpen
    ]);
};
