
import React, { useState, useEffect, useRef } from 'react';
import TonalityDiamond, { TonalityDiamondHandle } from './components/TonalityDiamond';
import SettingsModal from './components/SettingsModal';
import SynthControls from './components/SynthControls';
import FloatingControls from './components/FloatingControls';
import LimitLayerControls from './components/LimitLayerControls';
import { audioEngine } from './services/AudioEngine'; // Import singleton
import { useStore } from './services/Store';
import { AppSettings, ChordDefinition, XYPos } from './types';
import { MARGIN_3MM, SCROLLBAR_WIDTH } from './constants';

const App: React.FC = () => {
  const { settings, preset, updateSettings, setPreset } = useStore();

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [activeChordIds, setActiveChordIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);

  const diamondRef = useRef<TonalityDiamondHandle>(null);

  // Audio Warmup: Pre-initialize audio context on any user interaction
  useEffect(() => {
    const warmup = () => {
        audioEngine.init();
        
        // Remove listeners once warmed up
        window.removeEventListener('pointerdown', warmup);
        window.removeEventListener('keydown', warmup);
        window.removeEventListener('touchstart', warmup);
    };

    window.addEventListener('pointerdown', warmup);
    window.addEventListener('keydown', warmup);
    window.addEventListener('touchstart', warmup);

    return () => {
        window.removeEventListener('pointerdown', warmup);
        window.removeEventListener('keydown', warmup);
        window.removeEventListener('touchstart', warmup);
    };
  }, []);

  // Sanitize UI Positions on Load to prevent off-screen elements
  useEffect(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      updateSettings(prev => {
          const p = { ...prev.uiPositions };
          let changed = false;
          
          // Helper to check and clamp
          const checkAndFix = (key: keyof typeof p, width: number, height: number) => {
              let x = p[key].x;
              let y = p[key].y;
              
              const maxX = w - width - MARGIN_3MM;
              const maxY = h - height - MARGIN_3MM;
              const minX = MARGIN_3MM;
              const minY = MARGIN_3MM;

              // Clamp if out of bounds
              if (x > maxX) { x = maxX; changed = true; }
              if (x < minX) { x = minX; changed = true; }
              if (y > maxY) { y = maxY; changed = true; }
              if (y < minY) { y = minY; changed = true; }
              
              p[key] = { x, y };
          };

          // Estimates for element sizes (width, height)
          checkAndFix('volume', 160, 40);
          checkAndFix('panic', 80, 80);
          checkAndFix('off', 80, 80);
          checkAndFix('center', 48, 48);
          checkAndFix('depth', 48, 48);
          checkAndFix('decreaseDepth', 48, 48);
          checkAndFix('chords', 300, 48); // Chords container can be wide
          checkAndFix('layers', 90, 310);

          return changed ? { ...prev, uiPositions: p } : prev;
      });
  }, []); // Run once on mount

  // Resize Handler to snap UI elements to their anchors
  const windowSize = useRef({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      const oldW = windowSize.current.w;
      const oldH = windowSize.current.h;

      updateSettings(prev => {
        const p = prev.uiPositions;
        const newPos = { ...p };

        // 1. Panic (Anchor: Bottom-Right)
        newPos.panic = {
            x: newW - (oldW - p.panic.x),
            y: newH - (oldH - p.panic.y)
        };

        // 2. Off (Anchor: Bottom-Right)
        newPos.off = {
            x: newW - (oldW - p.off.x),
            y: newH - (oldH - p.off.y)
        };

        // 3. Volume (Anchor: Top-Center)
        const volOffsetFromCenter = p.volume.x - (oldW / 2);
        newPos.volume = {
            x: (newW / 2) + volOffsetFromCenter,
            y: p.volume.y 
        };

        // 4. Center/Depth/Chords (Anchor: Bottom-Left)
        const updateBottomLeft = (key: 'center' | 'depth' | 'decreaseDepth' | 'chords') => {
             newPos[key] = {
                 x: p[key].x, 
                 y: newH - (oldH - p[key].y)
             };
        };
        updateBottomLeft('center');
        updateBottomLeft('depth');
        updateBottomLeft('decreaseDepth');
        updateBottomLeft('chords');

        // 5. Layers (Anchor: Right-Center)
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
  }, [updateSettings]);

  // Init Engine updates
  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  const handleLimitInteraction = (limit: number) => {
    if (settings.layerOrder[settings.layerOrder.length - 1] !== limit) {
      const newOrder = settings.layerOrder.filter(l => l !== limit);
      newOrder.push(limit);
      updateSettings(prev => ({ ...prev, layerOrder: newOrder }));
    }
  };

  const handlePanic = () => {
    audioEngine.stopAll(); 
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]); 
  };

  const handleOff = () => {
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]);
  };

  const handleCenter = () => {
      diamondRef.current?.centerView();
  };

  const handleIncreaseDepth = () => {
      diamondRef.current?.increaseDepth();
  };

  const handleDecreaseDepth = () => {
      diamondRef.current?.decreaseDepth();
  };

  const handleAddChord = () => {
      if (diamondRef.current) {
          const latchedNodes = diamondRef.current.getLatchedNodes();
          if (latchedNodes.length === 0) return;

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

              updateSettings(prev => ({ ...prev, savedChords: newChords }));
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
      updateSettings(prev => ({
          ...prev,
          uiPositions: {
              ...prev.uiPositions,
              [key]: pos
          }
      }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans text-white">
      
      {/* Top Bar - Fixed Position */}
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
        updateSettings={updateSettings}
        audioEngine={audioEngine} 
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
        onDecreaseDepth={handleDecreaseDepth}
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
        updateSettings={updateSettings}
        draggingId={draggingId}
        setDraggingId={setDraggingId}
      />

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
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
