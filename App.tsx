
import React, { useState, useEffect, useRef } from 'react';
import TonalityDiamond, { TonalityDiamondHandle } from './components/TonalityDiamond';
import SettingsModal from './components/SettingsModal';
import SynthControls from './components/SynthControls';
import FloatingControls from './components/FloatingControls';
import LimitLayerControls from './components/LimitLayerControls';
import AudioEngine from './services/AudioEngine';
import { AppSettings, SynthPreset, ChordDefinition, LatticeNode, XYPos } from './types';
import { DEFAULT_COLORS, DEFAULT_SETTINGS, DEFAULT_PRESET, MARGIN_3MM, SCROLLBAR_WIDTH } from './constants';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [preset, setPreset] = useState<SynthPreset>(DEFAULT_PRESET);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [activeChordIds, setActiveChordIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);

  // Audio Engine Singleton Ref
  const engineRef = useRef<AudioEngine>(new AudioEngine(DEFAULT_PRESET));
  const diamondRef = useRef<TonalityDiamondHandle>(null);

  // Resize Handler to snap UI elements to their anchors
  const windowSize = useRef({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      const oldW = windowSize.current.w;
      const oldH = windowSize.current.h;

      setSettings(prev => {
        const p = prev.uiPositions;
        const newPos = { ...p };

        // 1. Panic (Anchor: Bottom-Right)
        // Maintains distance from Right and Bottom edges
        newPos.panic = {
            x: newW - (oldW - p.panic.x),
            y: newH - (oldH - p.panic.y)
        };

        // 2. Off (Anchor: Bottom-Right, same as panic logic)
        newPos.off = {
            x: newW - (oldW - p.off.x),
            y: newH - (oldH - p.off.y)
        };

        // 3. Volume (Anchor: Top-Center)
        // Maintains distance from Center X, fixed Top Y
        const volOffsetFromCenter = p.volume.x - (oldW / 2);
        newPos.volume = {
            x: (newW / 2) + volOffsetFromCenter,
            y: p.volume.y 
        };

        // 4. Center/Depth/Chords (Anchor: Bottom-Left)
        // Maintains distance from Left and Bottom edges
        const updateBottomLeft = (key: 'center' | 'depth' | 'chords') => {
             newPos[key] = {
                 x: p[key].x, 
                 y: newH - (oldH - p[key].y)
             };
        };
        updateBottomLeft('center');
        updateBottomLeft('depth');
        updateBottomLeft('chords');

        // 5. Layers (Anchor: Right-Center)
        // Maintains distance from Right edge.
        // Adjusts Y proportionally to maintain relative vertical position.
        newPos.layers = {
            x: newW - (oldW - p.layers.x),
            y: p.layers.y * (newH / oldH)
        };

        return {
            ...prev,
            uiPositions: newPos
        };
      });

      windowSize.current = { w: newW, h: newH };
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    engineRef.current.stopAll(); // Hard stop active voices
    diamondRef.current?.clearLatches(); // Clear visual latches
    setActiveChordIds([]); // Reset chords
  };

  const handleOff = () => {
    // Soft release: Clears latches, which triggers release envelopes via TonalityDiamond effect
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

          // Find first empty slot
          let slotIndex = settings.savedChords.findIndex(c => c.nodes.length === 0);
          
          if (slotIndex === -1) {
               slotIndex = settings.savedChords.findIndex(c => !c.visible);
          }
          
          if (slotIndex !== -1) {
              const newChords = [...settings.savedChords];
              
              const simplifiedNodes = latchedNodes.map(n => ({
                  id: n.id,
                  n: n.n,
                  d: n.d
              }));

              newChords[slotIndex] = {
                  ...newChords[slotIndex],
                  nodes: simplifiedNodes,
                  visible: true,
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

  const handleUiPositionUpdate = (key: keyof AppSettings['uiPositions'], pos: XYPos) => {
      setSettings(prev => ({
          ...prev,
          uiPositions: {
              ...prev.uiPositions,
              [key]: pos
          }
      }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans text-white">
      
      {/* Top Bar - Fixed Position, Non-Moveable */}
      <div 
        className="absolute w-full flex justify-between items-center z-40 pointer-events-none"
        style={{ 
            top: `${MARGIN_3MM}px`, 
            paddingLeft: `${MARGIN_3MM}px`,
            paddingRight: `${MARGIN_3MM + SCROLLBAR_WIDTH}px` 
        }}
      >
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
        uiUnlocked={settings.uiUnlocked}
      />

      {/* Floating UI */}
      <FloatingControls 
        volume={masterVolume}
        setVolume={setMasterVolume}
        onPanic={handlePanic}
        onOff={handleOff}
        onCenter={handleCenter}
        onIncreaseDepth={handleIncreaseDepth}
        onAddChord={handleAddChord}
        toggleChord={toggleChord}
        activeChordIds={activeChordIds}
        savedChords={settings.savedChords}
        chordShortcutSizeScale={settings.chordShortcutSizeScale}
        showIncreaseDepthButton={settings.showIncreaseDepthButton}
        uiUnlocked={settings.uiUnlocked}
        uiPositions={settings.uiPositions}
        updatePosition={handleUiPositionUpdate}
        draggingId={draggingId}
        setDraggingId={setDraggingId}
      />

      <LimitLayerControls 
        settings={settings}
        updateSettings={setSettings}
        draggingId={draggingId}
        setDraggingId={setDraggingId}
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
