
import React, { useState, useEffect, useRef } from 'react';
import TonalityDiamond, { TonalityDiamondHandle } from './components/TonalityDiamond';
import SettingsModal from './components/SettingsModal';
import SynthControls from './components/SynthControls';
import FloatingControls from './components/FloatingControls';
import LimitLayerControls from './components/LimitLayerControls';
import AudioEngine from './services/AudioEngine';
import { AppSettings, SynthPreset } from './types';
import { DEFAULT_COLORS, DEFAULT_SETTINGS, DEFAULT_PRESET } from './constants';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [preset, setPreset] = useState<SynthPreset>(DEFAULT_PRESET);
  const [masterVolume, setMasterVolume] = useState(0.8);
  
  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);

  // Audio Engine Singleton Ref
  const engineRef = useRef<AudioEngine>(new AudioEngine(DEFAULT_PRESET));
  const diamondRef = useRef<TonalityDiamondHandle>(null);

  // Init Engine updates
  useEffect(() => {
    engineRef.current.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    engineRef.current.setPreset(preset);
  }, [preset]);

  const handleLimitInteraction = (limit: number) => {
    // Move touched limit to the end of the array (front)
    // Only if it's not already at the front
    if (settings.layerOrder[settings.layerOrder.length - 1] !== limit) {
      const newOrder = settings.layerOrder.filter(l => l !== limit);
      newOrder.push(limit);
      setSettings(prev => ({ ...prev, layerOrder: newOrder }));
    }
  };

  const handlePanic = () => {
    engineRef.current.stopAll();
    diamondRef.current?.clearLatches();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans text-white">
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-40 pointer-events-none">
        <h1 className="text-xl font-bold tracking-widest text-slate-500 opacity-50">PRISMATONAL</h1>
        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setIsSynthOpen(true)}
            className="bg-slate-800/80 hover:bg-indigo-600 px-4 py-2 rounded-lg backdrop-blur transition border border-white/10"
          >
            Synth
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="bg-slate-800/80 hover:bg-slate-600 px-4 py-2 rounded-lg backdrop-blur transition border border-white/10"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <TonalityDiamond 
        ref={diamondRef}
        settings={settings} 
        audioEngine={engineRef.current} 
        onLimitInteraction={handleLimitInteraction}
      />

      {/* Floating UI */}
      <FloatingControls 
        volume={masterVolume}
        setVolume={setMasterVolume}
        onPanic={handlePanic}
        pitchOffLocked={settings.pitchOffLocked}
        volumeLocked={settings.volumeLocked}
      />

      <LimitLayerControls 
        settings={settings}
        updateSettings={setSettings}
      />

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        updateSettings={setSettings}
      />

      <SynthControls 
        isOpen={isSynthOpen}
        onClose={() => setIsSynthOpen(false)}
        preset={preset}
        onChange={setPreset}
      />
    </div>
  );
};

export default App;
