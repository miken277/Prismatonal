
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  
  // Latch State: 0 = Off, 1 = Active (Green), 2 = Frozen (Momentary Only)
  const [latchStatus, setLatchStatus] = useState<0 | 1 | 2>(0);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);
  
  // Visual Focus Mode
  const [showUI, setShowUI] = useState(true);

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
          checkAndFix('volume', 180, 48); // Increased width for new design
          checkAndFix('panic', 64, 64);
          checkAndFix('off', 64, 64);
          checkAndFix('latch', 64, 64);
          checkAndFix('center', 160, 48); // Increased width for grouped Navigation Bar
          checkAndFix('chords', 300, 48); 
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

        // 3. Latch (Anchor: Bottom-Right)
        newPos.latch = {
            x: newW - (oldW - p.latch.x),
            y: newH - (oldH - p.latch.y)
        };

        // 4. Volume (Anchor: Top-Center)
        const volOffsetFromCenter = p.volume.x - (oldW / 2);
        newPos.volume = {
            x: (newW / 2) + volOffsetFromCenter,
            y: p.volume.y 
        };

        // 5. Center/Chords (Anchor: Bottom-Left)
        const updateBottomLeft = (key: 'center' | 'chords') => {
             newPos[key] = {
                 x: p[key].x, 
                 y: newH - (oldH - p[key].y)
             };
        };
        updateBottomLeft('center');
        updateBottomLeft('chords');

        // 6. Layers (Anchor: Vertical Center on Right Edge)
        newPos.layers = {
            x: newW - (oldW - p.layers.x), // Maintain distance from right edge
            y: (newH / 2) - 155 // Recenter vertically (height/2)
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

  const handlePanic = useCallback(() => {
    audioEngine.stopAll(); 
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]); 
    setLatchStatus(0); // Reset Latch
  }, []);

  // Musical Off: Unlatch nodes but let tails fade
  const handleOff = () => {
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]);
    setLatchStatus(0); // Reset Latch
  };

  // Tri-State Logic: Off (0) -> Active (1) -> Frozen (2) -> Off (0)
  const handleLatchToggle = () => {
      setLatchStatus(prev => {
          if (prev === 0) return 1;
          if (prev === 1) return 2;
          if (prev === 2) {
              diamondRef.current?.clearLatches(); // "Taking foot off pedal"
              return 0;
          }
          return 0;
      });
  };

  const handleCenter = useCallback(() => {
      diamondRef.current?.centerView();
  }, []);

  const handleIncreaseDepth = () => {
      diamondRef.current?.increaseDepth();
  };

  const handleDecreaseDepth = () => {
      diamondRef.current?.decreaseDepth();
  };

  const handleAddChord = useCallback(() => {
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
  }, [settings.savedChords, updateSettings]);

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

  // --- Keyboard Shortcuts ---
  const handleToggleLimit = useCallback((limit: number) => {
      const isHidden = settings.hiddenLimits.includes(limit);
      let newHidden = [...settings.hiddenLimits];
      if (isHidden) {
          newHidden = newHidden.filter(l => l !== limit);
      } else {
          newHidden.push(limit);
      }
      updateSettings(prev => ({ ...prev, hiddenLimits: newHidden }));
  }, [settings.hiddenLimits, updateSettings]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore if typing in an input
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

          // Mapping
          const map = settings.keyMap;

          switch(e.code) {
              case map.panic:
                  e.preventDefault();
                  handlePanic();
                  break;
              case map.center:
                  e.preventDefault();
                  handleCenter();
                  break;
              case map.increaseDepth:
                  e.preventDefault();
                  handleIncreaseDepth();
                  break;
              case map.decreaseDepth:
                  e.preventDefault();
                  handleDecreaseDepth();
                  break;
              case map.addChord:
                  e.preventDefault();
                  handleAddChord();
                  break;
              case map.toggleSynth:
                  e.preventDefault();
                  setIsSynthOpen(prev => !prev);
                  break;
              case map.toggleSettings:
                  e.preventDefault();
                  setIsSettingsOpen(prev => !prev);
                  break;
              case map.toggleUI:
                  e.preventDefault();
                  setShowUI(prev => !prev);
                  break;
              case map.closeModals:
                  e.preventDefault();
                  setIsSettingsOpen(false);
                  setIsSynthOpen(false);
                  break;
              
              // Volume Control
              case map.volumeUp:
                  e.preventDefault();
                  setMasterVolume(v => Math.min(1.0, v + 0.05));
                  break;
              case map.volumeDown:
                  e.preventDefault();
                  setMasterVolume(v => Math.max(0.0, v - 0.05));
                  break;

              // Limits
              case map.limit3: e.preventDefault(); handleToggleLimit(3); break;
              case map.limit5: e.preventDefault(); handleToggleLimit(5); break;
              case map.limit7: e.preventDefault(); handleToggleLimit(7); break;
              case map.limit11: e.preventDefault(); handleToggleLimit(11); break;
              case map.limit13: e.preventDefault(); handleToggleLimit(13); break;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePanic, handleCenter, handleAddChord, handleToggleLimit, settings.keyMap]);

  return (
    <div 
        className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans text-white"
        onContextMenu={(e) => e.preventDefault()} // Prevent native context menu for app-like feel
    >
      
      {/* Top Bar - Fixed Position */}
      <div 
        className={`absolute w-full flex justify-between items-center z-40 pointer-events-none transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}
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
        latchStatus={latchStatus}
      />

      {/* Floating UI */}
      {showUI && (
          <FloatingControls 
            volume={masterVolume}
            setVolume={setMasterVolume}
            onPanic={handlePanic}
            onOff={handleOff}
            latchStatus={latchStatus}
            onLatchToggle={handleLatchToggle}
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
      )}

      {showUI && (
          <LimitLayerControls 
            settings={settings}
            updateSettings={updateSettings}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
          />
      )}

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
