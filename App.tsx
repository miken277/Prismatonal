
import React, { useState, useEffect, useRef } from 'react';
import TonalityDiamond, { TonalityDiamondHandle } from './components/TonalityDiamond';
import SettingsModal from './components/SettingsModal';
import SynthControls from './components/SynthControls';
import FloatingControls from './components/FloatingControls';
import LimitLayerControls from './components/LimitLayerControls';
import { audioEngine } from './services/AudioEngine'; // Import singleton
import { midiService } from './services/MidiService';
import { useStore } from './services/Store';
import { AppSettings, ChordDefinition, XYPos } from './types';
import { PIXELS_PER_MM } from './constants';

const REFERENCE_SHORT_EDGE = 1080; // Baseline resolution for 1.0 scale

const App: React.FC = () => {
  const { settings, presets, updateSettings, setPreset } = useStore();

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [spatialScale, setSpatialScale] = useState(1.0); 
  const [activeChordIds, setActiveChordIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Adaptive Scaling State
  const [autoScaleFactor, setAutoScaleFactor] = useState(1.0);
  
  // 0 = Off, 1 = Latch All, 2 = Sustain (Partial Latch)
  const [latchMode, setLatchMode] = useState<0 | 1 | 2>(0);
  
  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);

  const diamondRef = useRef<TonalityDiamondHandle>(null);

  // Computed Effective Scale (Auto * User Preference)
  const effectiveScale = autoScaleFactor * (settings.uiScale || 1.0);

  // Audio Warmup - Reinforced for iOS
  useEffect(() => {
    const warmup = (e: Event) => {
        // Prevent default for touchend to ensure audio context can resume cleanly
        // if this is the very first interaction
        // However, we must be careful not to block clicking buttons
        
        // Resume/Init context immediately on user interaction
        audioEngine.resume().then(() => {
            // Optional: Log success
        });
        
        // Remove listeners
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
  }, []);

  // Update CSS Variable for global usage if needed
  useEffect(() => {
      document.documentElement.style.setProperty('--ui-scale', effectiveScale.toString());
  }, [effectiveScale]);

  // Measure Safe Areas (Notches/Home Bars)
  const getSafeAreas = () => {
      if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
      const div = document.createElement('div');
      div.style.paddingTop = 'env(safe-area-inset-top)';
      div.style.paddingRight = 'env(safe-area-inset-right)';
      div.style.paddingBottom = 'env(safe-area-inset-bottom)';
      div.style.paddingLeft = 'env(safe-area-inset-left)';
      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      document.body.appendChild(div);
      const computed = getComputedStyle(div);
      const safe = {
          top: parseInt(computed.paddingTop) || 0,
          right: parseInt(computed.paddingRight) || 0,
          bottom: parseInt(computed.paddingBottom) || 0,
          left: parseInt(computed.paddingLeft) || 0
      };
      document.body.removeChild(div);
      return safe;
  };

  // Central Layout Calculation Logic
  const applyLayout = (w: number, h: number, scale: number) => {
      const safeArea = getSafeAreas();

      // Use configured margin, defaulting to 4mm if not set
      const marginPx = (settings.uiEdgeMargin || 4) * PIXELS_PER_MM;
      
      const marginTop = marginPx + safeArea.top;
      // Force extra margin on right if safe area is 0 to ensure visual gap from scrollbar
      const marginRight = marginPx + safeArea.right + (safeArea.right === 0 ? 4 : 0);
      const marginBottom = marginPx + safeArea.bottom;
      const marginLeft = marginPx + safeArea.left;
      
      const baseGap = marginPx; // Spacing between buttons matches the margin
      
      // --- TOP CENTER (Space & Volume) ---
      const sliderWidth = 290 * scale; // Restored to 290 for centering
      const centerGap = 120 * scale; 
      const totalTopWidth = (sliderWidth * 2) + centerGap;
      const topStartX = (w / 2) - (totalTopWidth / 2);

      const newPos = { ...settings.uiPositions };

      newPos.space = { x: topStartX, y: marginTop };
      newPos.volume = { x: topStartX + sliderWidth + centerGap, y: marginTop };

      // --- RIGHT STACK (Layers + Buttons) ---
      const largeBtn = 80 * scale; 
      
      // Precise width calculation
      // Limit Bar: p-2(8) + icon(24*s) + gap-2(8) + btn(48*s) + p-2(8) = 24 + 72*s
      // Note: scale here is effective scale
      const limitBarWidth = 24 + (72 * scale); 
      const largeBtnWidth = largeBtn;

      // Calculate Layers Height
      const layerRowHeight = 48 * scale;
      const layerGap = 12;
      const layerPadding = 16;
      const layersHeight = (layerRowHeight * 6) + (layerGap * 5) + layerPadding;

      const separatorGap = largeBtn;
      const btnGap = 10 * scale;

      const totalStackHeight = layersHeight + separatorGap + (4 * largeBtn) + (3 * btnGap);

      // Start Y (Centered vertically)
      let startY = (h / 2) - (totalStackHeight / 2);
      if (startY < marginTop + 50) startY = marginTop + 50;

      // X Positions (Right Aligned to Margin)
      // Use window.innerWidth (w) but subtract scrollbar width manually if on desktop
      // Since 'w' passed here is clientWidth from the resize handler, it already excludes scrollbar.
      const limitBarX = w - marginRight - limitBarWidth;
      const buttonsX = w - marginRight - largeBtnWidth;

      newPos.layers = { x: limitBarX, y: startY };
      
      let currentY = startY + layersHeight + separatorGap;
      
      newPos.bend = { x: buttonsX, y: currentY };
      currentY += largeBtn + btnGap;
      
      newPos.latch = { x: buttonsX, y: currentY };
      currentY += largeBtn + btnGap;
      
      newPos.off = { x: buttonsX, y: currentY };
      currentY += largeBtn + btnGap;
      
      newPos.panic = { x: buttonsX, y: currentY };

      // --- BOTTOM LEFT ROW ---
      const baseBtn = 48 * scale;
      // Lifted by ~4mm (approx 15px at scale 1.0) to match Panic visual balance
      const bottomLiftOffset = 15 * scale;
      const bottomY = h - marginBottom - baseBtn - bottomLiftOffset; 
      
      let currentX = marginLeft;
      
      newPos.center = { x: currentX, y: bottomY };
      currentX += (baseBtn + baseGap); 
      
      if (settings.showIncreaseDepthButton) {
          newPos.depth = { x: currentX, y: bottomY };
          currentX += (baseBtn + baseGap);
          newPos.decreaseDepth = { x: currentX, y: bottomY };
          currentX += (baseBtn + baseGap);
      }
      
      currentX += 20 * scale; 
      newPos.chords = { x: currentX, y: bottomY };

      return newPos;
  };

  // Resize Handler & Scale Calculator
  const windowSizeRef = useRef({ w: typeof window !== 'undefined' ? window.innerWidth : 1000, h: typeof window !== 'undefined' ? window.innerHeight : 800 });

  useEffect(() => {
    const handleResize = () => {
        // Use clientWidth to exclude scrollbars for precise inner alignment
        const w = document.documentElement.clientWidth;
        const h = document.documentElement.clientHeight;
        
        const shortEdge = Math.min(w, h);
        const newAutoScale = shortEdge / REFERENCE_SHORT_EDGE;
        setAutoScaleFactor(newAutoScale);

        const newEffectiveScale = newAutoScale * (settings.uiScale || 1.0);
        
        updateSettings(prev => ({
            ...prev,
            uiPositions: applyLayout(w, h, newEffectiveScale)
        }));
        
        windowSizeRef.current = { w, h };
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [settings.uiScale, settings.uiEdgeMargin, settings.showIncreaseDepthButton]); 

  // Init Engine updates
  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    audioEngine.setGlobalSpatialScale(spatialScale);
  }, [spatialScale]);

  const handleLimitInteraction = (limit: number) => {
    if (settings.layerOrder[settings.layerOrder.length - 1] !== limit) {
      const newOrder = settings.layerOrder.filter(l => l !== limit);
      newOrder.push(limit);
      updateSettings(prev => ({ ...prev, layerOrder: newOrder }));
    }
  };

  const handlePanic = () => {
    audioEngine.stopAll(); 
    midiService.panic(); // Robust MIDI Panic (All Notes Off)
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]); 
    setLatchMode(0);
    setIsSettingsOpen(false);
    setIsSynthOpen(false);
  };

  const handleOff = () => {
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]);
    setLatchMode(0);
  };

  const handleLatchToggle = () => {
      setLatchMode(prev => {
          const next = prev + 1;
          if (next > 2) {
              diamondRef.current?.clearLatches();
              return 0;
          }
          return next as 0 | 1 | 2;
      });
  };

  const handleBendToggle = () => {
      updateSettings(prev => ({ ...prev, isPitchBendEnabled: !prev.isPitchBendEnabled }));
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
                  id: n.id, n: n.n, d: n.d
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
          uiPositions: { ...prev.uiPositions, [key]: pos }
      }));
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Always allow Escape to close settings/synth if open
          if (e.key === 'Escape' && (isSettingsOpen || isSynthOpen)) {
              setIsSettingsOpen(false);
              setIsSynthOpen(false);
              return;
          }

          // Ignore if typing in an input field
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;

          // Gate everything else behind the setting
          if (!settings.enableKeyboardShortcuts) return;

          const key = e.key.toLowerCase();

          // Prevent defaults for app-control keys
          if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
              e.preventDefault();
          }

          switch(key) {
              case ' ': // Spacebar -> Latch
                  handleLatchToggle();
                  break;
              case 'escape': // Esc -> Panic
                  handlePanic();
                  break;
              case 'c': // C -> Center
                  handleCenter();
                  break;
              case 's': // S -> Settings
                  setIsSettingsOpen(prev => !prev);
                  if(isSynthOpen) setIsSynthOpen(false);
                  break;
              case 'm': // M -> Synth (Menu)
                  setIsSynthOpen(prev => !prev);
                  if(isSettingsOpen) setIsSettingsOpen(false);
                  break;
              case 'o': // O -> Off
                  handleOff();
                  break;
              case 'b': // B -> Bend
                  handleBendToggle();
                  break;
              case 'enter': // Enter -> Add Chord
              case 'a': // A -> Add Chord (Alternative)
                  handleAddChord();
                  break;
              case '.': // . -> Increase Depth
                  handleIncreaseDepth();
                  break;
              case ',': // , -> Decrease Depth
                  handleDecreaseDepth();
                  break;
              
              // Volume Control
              case 'arrowup': 
                  setMasterVolume(v => Math.min(1.0, v + 0.05));
                  break;
              case 'arrowdown':
                  setMasterVolume(v => Math.max(0.0, v - 0.05));
                  break;
              
              // Reverb Control (Right/Left)
              case 'arrowright':
                  setSpatialScale(s => Math.min(2.0, s + 0.05));
                  break;
              case 'arrowleft':
                  setSpatialScale(s => Math.max(0.0, s - 0.05));
                  break;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isSynthOpen, settings.enableKeyboardShortcuts]);

  // Header Safe Area Calculation
  const marginPx = (settings.uiEdgeMargin || 4) * PIXELS_PER_MM;
  const headerTop = `calc(${marginPx}px + env(safe-area-inset-top))`;
  const headerLeft = `calc(${marginPx}px + env(safe-area-inset-left))`;
  const headerRight = `calc(${marginPx}px + env(safe-area-inset-right))`;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans text-white">
      
      {/* Top Left: Title */}
      <div 
        className="absolute z-50 pointer-events-none"
        style={{ top: headerTop, left: headerLeft }}
      >
        <h1 className="text-sm font-bold tracking-widest text-slate-500 opacity-50 leading-none">PRISMATONAL</h1>
      </div>

      {/* Top Right: Synth & Settings Buttons */}
      <div 
        className="absolute z-50 flex gap-2 pointer-events-auto"
        style={{ top: headerTop, right: headerRight }}
      >
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="bg-slate-800/80 hover:bg-slate-600 px-3 py-1 text-xs rounded backdrop-blur transition border border-white/10 h-8 flex items-center font-bold"
          >
            Settings
          </button>
          <button 
            onClick={() => setIsSynthOpen(true)}
            className="bg-slate-800/80 hover:bg-indigo-600 px-3 py-1 text-xs rounded backdrop-blur transition border border-white/10 h-8 flex items-center font-bold"
          >
            Synth
          </button>
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
        latchMode={latchMode}
        globalScale={effectiveScale}
      />

      {/* Floating UI */}
      <FloatingControls 
        volume={masterVolume}
        setVolume={setMasterVolume}
        spatialScale={spatialScale}
        setSpatialScale={setSpatialScale}
        onPanic={handlePanic}
        onOff={handleOff}
        onLatch={handleLatchToggle}
        latchMode={latchMode}
        onBend={handleBendToggle}
        isBendEnabled={settings.isPitchBendEnabled}
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
        uiScale={effectiveScale}
      />

      <LimitLayerControls 
        settings={settings}
        updateSettings={updateSettings}
        draggingId={draggingId}
        setDraggingId={setDraggingId}
        uiScale={effectiveScale}
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
        presets={presets}
        onChange={setPreset}
      />
    </div>
  );
};

export default App;
