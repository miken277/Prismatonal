
import React, { useState, useEffect, useRef } from 'react';
import TonalityDiamond, { TonalityDiamondHandle } from './components/TonalityDiamond';
import SettingsModal from './components/SettingsModal';
import SynthControls from './components/SynthControls';
import FloatingControls from './components/FloatingControls';
import LimitLayerControls from './components/LimitLayerControls';
import AudioEngine from './services/AudioEngine';
import { AppSettings, SynthPreset, ChordDefinition, LatticeNode } from './types';
import { DEFAULT_COLORS, DEFAULT_SETTINGS, DEFAULT_PRESET } from './constants';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [preset, setPreset] = useState<SynthPreset>(DEFAULT_PRESET);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [activeChordIds, setActiveChordIds] = useState<string[]>([]);
  
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
    setActiveChordIds([]);
  };

  const handleCenter = () => {
      diamondRef.current?.centerView();
  };

  const handleIncreaseDepth = () => {
      diamondRef.current?.increaseDepth();
  };

  const handleAddChord = () => {
      if (diamondRef.current) {
          const latchedNodes = diamondRef.current.getLatchedNodes();
          if (latchedNodes.length === 0) return;

          // Find first empty slot or just the next available that isn't visible?
          // Strategy: Find first slot with 0 nodes.
          let slotIndex = settings.savedChords.findIndex(c => c.nodes.length === 0);
          
          // If all full, maybe overwrite the first non-visible one? Or just don't add.
          if (slotIndex === -1) {
              // Try finding one that isn't visible
               slotIndex = settings.savedChords.findIndex(c => !c.visible);
          }
          
          if (slotIndex !== -1) {
              const newChords = [...settings.savedChords];
              
              // Simplify nodes for storage
              const simplifiedNodes = latchedNodes.map(n => ({
                  id: n.id,
                  n: n.n,
                  d: n.d
                  // Don't need full coords/ratio for storage if we just need ID/label, 
                  // but coords are useful for reconstruction if IDs change (unlikely here)
                  // The type requires: id, n, d.
              }));

              newChords[slotIndex] = {
                  ...newChords[slotIndex],
                  nodes: simplifiedNodes,
                  visible: true,
                  // Position will be handled by FloatingControls default placement logic if 0,0
                  // Or we could calculate it here if we knew where the Add button is. 
                  // Leaving as 0,0 triggers the auto-placement in FloatingControls.
                  position: { x: 0, y: 0 } 
              };

              setSettings(prev => ({ ...prev, savedChords: newChords }));
          }
      }
  };

  const toggleChord = (id: string) => {
      setActiveChordIds(prev => {
          if (prev.includes(id)) {
              return prev.filter(c => c !== id);
          } else {
              return [...prev, id];
          }
      });
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
        activeChordIds={activeChordIds}
      />

      {/* Floating UI */}
      <FloatingControls 
        volume={masterVolume}
        setVolume={setMasterVolume}
        onPanic={handlePanic}
        onCenter={handleCenter}
        onIncreaseDepth={handleIncreaseDepth}
        onAddChord={handleAddChord}
        toggleChord={toggleChord}
        activeChordIds={activeChordIds}
        savedChords={settings.savedChords}
        chordShortcutSizeScale={settings.chordShortcutSizeScale}
        showIncreaseDepthButton={settings.showIncreaseDepthButton}
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
