
import React, { useState, useEffect, useRef } from 'react';
import TonalityDiamond, { TonalityDiamondHandle } from './components/TonalityDiamond';
import SettingsModal from './components/SettingsModal';
import SynthControls from './components/SynthControls';
import FloatingControls from './components/FloatingControls';
import LimitLayerControls from './components/LimitLayerControls';
import { audioEngine } from './services/AudioEngine';
import { midiService } from './services/MidiService';
import { useStore } from './services/Store';
import { AppSettings, ChordDefinition, XYPos, ArpeggioStep, ArpConfig, ArpeggioDefinition } from './types';
import { PIXELS_PER_MM, SCROLLBAR_WIDTH } from './constants';
import { arpeggiatorService } from './services/ArpeggiatorService';

const REFERENCE_SHORT_EDGE = 1080; 

const App: React.FC = () => {
  const { settings, presets, updateSettings, setPreset } = useStore();

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [spatialScale, setSpatialScale] = useState(1.0); 
  const [brightness, setBrightness] = useState(1.0); // Tone control

  const [activeChordIds, setActiveChordIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [autoScaleFactor, setAutoScaleFactor] = useState(1.0);
  const [latchMode, setLatchMode] = useState<0 | 1 | 2>(0);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);

  // Arpeggio State
  const [recordingArpId, setRecordingArpId] = useState<string | null>(null);
  const [currentArpStep, setCurrentArpStep] = useState(0);
  const [recordingFlash, setRecordingFlash] = useState<number>(0); // Timestamp trigger for red flash

  const diamondRef = useRef<TonalityDiamondHandle>(null);

  const effectiveScale = autoScaleFactor * (settings.uiScale || 1.0);

  useEffect(() => {
    const warmup = (e: Event) => {
        audioEngine.resume().then(() => {});
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

  useEffect(() => {
      document.documentElement.style.setProperty('--ui-scale', effectiveScale.toString());
  }, [effectiveScale]);

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

  const applyLayout = (w: number, h: number, scale: number) => {
      const safeArea = getSafeAreas();
      const marginPx = (settings.uiEdgeMargin || 4) * PIXELS_PER_MM;
      
      const marginLeft = marginPx + safeArea.left;
      const marginTop = marginPx + safeArea.top;
      const marginRight = marginPx + safeArea.right + SCROLLBAR_WIDTH;
      const marginBottom = marginPx + safeArea.bottom + SCROLLBAR_WIDTH;
      
      // QUADRUPLED SPACING LOGIC
      // internalBlockGap is the primary spacer for Center Display and Latch clusters
      const internalBlockGap = 24 * scale; 
      // baseGap is the distance between clusters; scaled to match the increased "breath"
      const baseGap = Math.max(marginPx, 32 * scale); 

      // Dimensions
      const volumeBarWidth = 600 * scale; 
      const arpBarWidth = 675 * scale; 
      const settingsGroupWidth = 170; 
      const settingsGroupHeight = 40; 
      const largeBtn = 80 * scale; 
      const perfBtn = 92 * scale; 
      
      const colWidth = 136 * scale; 

      // VERTICAL GAPS
      const verticalStackGap = 12 * PIXELS_PER_MM * scale; 
      
      const newPos = { ...settings.uiPositions };

      // Hiding Logic
      const requiredWidth = volumeBarWidth + arpBarWidth + settingsGroupWidth + (baseGap * 4);
      const shouldHideExtras = w < requiredWidth;

      // Vertical calculation for layers
      const extraLimitMargin = 12 * scale;
      const limitBarX = w - marginRight - colWidth - extraLimitMargin;
      const layersY = marginTop + settingsGroupHeight + verticalStackGap;

      if (shouldHideExtras) {
          newPos.arpeggioBar = { x: -9999, y: -9999 };
          newPos.layers = { x: -9999, y: -9999 };
          newPos.volume = { x: (w / 2) - (volumeBarWidth / 2), y: marginTop };
      } else {
          // Arp Top Left
          newPos.arpeggioBar = { x: marginLeft, y: marginTop };
          
          // Audio Stack - Aligned relative to Settings group
          const volX = w - marginRight - settingsGroupWidth - baseGap - volumeBarWidth;
          newPos.volume = { x: volX, y: marginTop };

          // Right Side: Limit Layers
          newPos.layers = { x: limitBarX, y: layersY };
      }

      newPos.space = { x: -9999, y: -9999 };

      // BOTTOM CONTROLS - NAV CLUSTER (LEFT)
      const bottomY = h - marginBottom - largeBtn; 
      let currentX = marginLeft;
      
      newPos.center = { x: currentX, y: bottomY };
      currentX += (largeBtn + internalBlockGap); 
      
      if (settings.showIncreaseDepthButton) {
          newPos.depth = { x: currentX, y: bottomY };
          currentX += (largeBtn + internalBlockGap);
          newPos.decreaseDepth = { x: currentX, y: bottomY };
          currentX += (largeBtn + internalBlockGap);
      }
      
      // Gap between navigation and chords
      currentX += baseGap; 
      newPos.chords = { x: currentX, y: bottomY };

      // PERFORMANCE CLUSTER (BOTTOM RIGHT) - Horizontal Order: Bend, Latch, Off, Panic
      const perfY = h - marginBottom - perfBtn;
      
      let rightX = w - marginRight - perfBtn; // Panic (far right)
      newPos.panic = { x: rightX, y: perfY };
      
      rightX -= (perfBtn + internalBlockGap); // Off
      newPos.off = { x: rightX, y: perfY };
      
      rightX -= (perfBtn + internalBlockGap); // Latch
      newPos.latch = { x: rightX, y: perfY };
      
      rightX -= (perfBtn + internalBlockGap); // Bend
      newPos.bend = { x: rightX, y: perfY };

      return newPos;
  };

  const windowSizeRef = useRef({ w: typeof window !== 'undefined' ? window.innerWidth : 1000, h: typeof window !== 'undefined' ? window.innerHeight : 800 });

  useEffect(() => {
    const handleResize = () => {
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

  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    audioEngine.setGlobalSpatialScale(spatialScale);
  }, [spatialScale]);

  useEffect(() => {
    audioEngine.setGlobalBrightness(brightness);
  }, [brightness]);

  const handleLimitInteraction = (limit: number) => {
    if (settings.layerOrder[settings.layerOrder.length - 1] !== limit) {
      const newOrder = settings.layerOrder.filter(l => l !== limit);
      newOrder.push(limit);
      updateSettings(prev => ({ ...prev, layerOrder: newOrder }));
    }
  };

  const handlePanic = () => {
    audioEngine.stopAll(); 
    arpeggiatorService.stop();
    midiService.panic();
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]); 
    setLatchMode(0);
    setRecordingArpId(null);
    updateSettings(prev => ({ 
        ...prev, 
        arpeggios: prev.arpeggios.map(a => ({ ...a, isPlaying: false })) 
    }));
    setIsSettingsOpen(false);
    setIsSynthOpen(false);
  };

  const handleOff = () => {
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]);
    setLatchMode(0);
    setRecordingArpId(null);
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
      // Disabled if in Full Latch mode
      if (latchMode === 1) return;
      updateSettings(prev => ({ ...prev, isPitchBendEnabled: !prev.isPitchBendEnabled }));
  };

  const handleCenter = () => diamondRef.current?.centerView();
  const handleIncreaseDepth = () => diamondRef.current?.increaseDepth();
  const handleDecreaseDepth = () => diamondRef.current?.decreaseDepth();

  const handleAddChord = () => {
      if (diamondRef.current) {
          const latchedNodes = diamondRef.current.getLatchedNodes();
          if (latchedNodes.length === 0) return;
          let slotIndex = settings.savedChords.findIndex(c => c.nodes.length === 0);
          if (slotIndex === -1) slotIndex = settings.savedChords.findIndex(c => !c.visible);
          
          if (slotIndex !== -1) {
              const newChords = [...settings.savedChords];
              const simplifiedNodes = latchedNodes.map(n => ({ id: n.id, n: n.n, d: n.d }));
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
      setActiveChordIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleUiPositionUpdate = (key: keyof AppSettings['uiPositions'], pos: XYPos) => {
      updateSettings(prev => ({ ...prev, uiPositions: { ...prev.uiPositions, [key]: pos } }));
  };

  // --- Arp Handlers ---
  const handleArpToggle = (id: string) => {
      const arp = settings.arpeggios.find(a => a.id === id);
      if (!arp) return;

      if (recordingArpId === id) {
          setRecordingArpId(null);
          return;
      }

      if (recordingArpId) {
          setRecordingArpId(id);
          return;
      }

      if (arp.steps.length === 0) {
          setRecordingArpId(id);
          updateSettings(prev => ({
              ...prev,
              arpeggios: prev.arpeggios.map(a => a.id === id ? { ...a, isPlaying: false } : a)
          }));
          return;
      }

      const newIsPlaying = !arp.isPlaying;
      const newArps = settings.arpeggios.map(a => {
          if (a.id === id) return { ...a, isPlaying: newIsPlaying };
          return { ...a, isPlaying: false }; 
      });
      
      updateSettings(prev => ({ ...prev, arpeggios: newArps }));

      if (newIsPlaying) {
          arpeggiatorService.start(arp.steps, arp.config, settings.arpBpm, (step) => setCurrentArpStep(step));
      } else {
          arpeggiatorService.stop();
      }
  };

  const handleArpRecordNote = (nodeId: string, ratio: number, n?: number, d?: number, limit?: number) => {
      if (!recordingArpId) return;

      setRecordingFlash(Date.now()); 

      const arpIndex = settings.arpeggios.findIndex(a => a.id === recordingArpId);
      if (arpIndex === -1) return;

      const currentSteps = settings.arpeggios[arpIndex].steps;
      if (currentSteps.length >= 32) {
          setRecordingArpId(null);
          return;
      }

      const newStep: ArpeggioStep = { nodeId, ratio, n, d, limit, muted: false };
      const newArps = [...settings.arpeggios];
      newArps[arpIndex] = {
          ...newArps[arpIndex],
          steps: [...currentSteps, newStep]
      };

      updateSettings(prev => ({ ...prev, arpeggios: newArps }));
  };

  const handleArpPatternUpdate = (arpId: string, steps: ArpeggioStep[]) => {
      const arpIndex = settings.arpeggios.findIndex(a => a.id === arpId);
      if (arpIndex === -1) return;
      
      const newArps = [...settings.arpeggios];
      newArps[arpIndex] = {
          ...newArps[arpIndex],
          steps: steps
      };
      if (newArps[arpIndex].isPlaying && steps.length === 0) {
          newArps[arpIndex].isPlaying = false;
          arpeggiatorService.stop();
      }
      updateSettings(prev => ({ ...prev, arpeggios: newArps }));
  };

  const handleArpBpmChange = (bpm: number) => {
      updateSettings(prev => ({ ...prev, arpBpm: bpm }));
      arpeggiatorService.updateBpm(bpm);
  };

  const handleArpRowConfigChange = (arpId: string, partial: Partial<ArpConfig>) => {
      const arpIndex = settings.arpeggios.findIndex(a => a.id === arpId);
      if (arpIndex === -1) return;

      const newArps = [...settings.arpeggios];
      newArps[arpIndex] = {
          ...newArps[arpIndex],
          config: { ...newArps[arpIndex].config, ...partial }
      };
      
      updateSettings(prev => ({ ...prev, arpeggios: newArps }));

      if (newArps[arpIndex].isPlaying) {
          arpeggiatorService.start(newArps[arpIndex].steps, newArps[arpIndex].config, settings.arpBpm, (step) => setCurrentArpStep(step));
      }
  };

  const handlePlayAll = () => {
      const newArps = settings.arpeggios.map(a => ({
          ...a,
          isPlaying: a.steps.length > 0
      }));
      updateSettings(prev => ({ ...prev, arpeggios: newArps }));
      
      const firstValid = newArps.find(a => a.steps.length > 0);
      if (firstValid) {
          arpeggiatorService.start(firstValid.steps, firstValid.config, settings.arpBpm, (step) => setCurrentArpStep(step));
      }
  };

  const handleStopAll = () => {
      const newArps = settings.arpeggios.map(a => ({ ...a, isPlaying: false }));
      updateSettings(prev => ({ ...prev, arpeggios: newArps }));
      arpeggiatorService.stop();
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape' && (isSettingsOpen || isSynthOpen)) {
              setIsSettingsOpen(false); setIsSynthOpen(false); return;
          }
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
          if (!settings.enableKeyboardShortcuts) return;

          const key = e.key.toLowerCase();
          const map = settings.keyMappings;

          if ([map.latch, map.volumeUp, map.volumeDown, map.spatialScaleUp, map.spatialScaleDown].map(k => k.toLowerCase()).includes(key)) e.preventDefault();

          if (key === map.latch.toLowerCase()) handleLatchToggle();
          else if (key === map.panic.toLowerCase()) handlePanic();
          else if (key === map.center.toLowerCase()) handleCenter();
          else if (key === map.settings.toLowerCase()) { setIsSettingsOpen(prev => !prev); if(isSynthOpen) setIsSynthOpen(false); }
          else if (key === map.synth.toLowerCase()) { setIsSynthOpen(prev => !prev); if(isSettingsOpen) setIsSettingsOpen(false); }
          else if (key === map.off.toLowerCase()) handleOff();
          else if (key === map.bend.toLowerCase()) handleBendToggle();
          else if (key === map.addChord.toLowerCase()) handleAddChord();
          else if (key === map.increaseDepth.toLowerCase()) handleIncreaseDepth();
          else if (key === map.decreaseDepth.toLowerCase()) handleDecreaseDepth();
          else if (key === map.volumeUp.toLowerCase()) setMasterVolume(v => Math.min(1.0, v + 0.05));
          else if (key === map.volumeDown.toLowerCase()) setMasterVolume(v => Math.max(0.0, v - 0.05));
          else if (key === map.spatialScaleUp.toLowerCase()) setSpatialScale(s => Math.min(2.0, s + 0.05));
          else if (key === map.spatialScaleDown.toLowerCase()) setSpatialScale(s => Math.max(0.0, s - 0.05));
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isSynthOpen, settings.enableKeyboardShortcuts, settings.keyMappings, latchMode]);

  const marginPx = (settings.uiEdgeMargin || 4) * PIXELS_PER_MM;
  const safeArea = getSafeAreas();
  const leftOffset = `calc(${marginPx}px + ${safeArea.left}px)`;
  const rightOffset = `calc(${marginPx}px + ${safeArea.right}px + ${SCROLLBAR_WIDTH}px)`;
  const headerTop = `calc(${marginPx}px + ${safeArea.top}px)`;

  const headerBtnClass = "bg-slate-900/50 hover:bg-slate-800 px-3 py-1 rounded-xl backdrop-blur-sm transition border border-slate-700/50 h-8 flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-white shadow-lg";

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans text-white">
      <div className="absolute z-50 pointer-events-none" style={{ top: headerTop, left: leftOffset }}>
        <h1 className="text-sm font-bold tracking-widest text-slate-500 opacity-20 leading-none">PRISMATONAL</h1>
      </div>

      <div className="absolute z-50 flex gap-2 pointer-events-auto" style={{ top: headerTop, right: rightOffset }}>
          <button onClick={() => setIsSettingsOpen(true)} className={headerBtnClass}>Settings</button>
          <button onClick={() => setIsSynthOpen(true)} className={headerBtnClass}>Synth</button>
      </div>

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
        onNodeTrigger={handleArpRecordNote} 
      />

      <FloatingControls 
        volume={masterVolume} setVolume={setMasterVolume}
        spatialScale={spatialScale} setSpatialScale={setSpatialScale}
        brightness={brightness} setBrightness={setBrightness}
        
        onPanic={handlePanic} onOff={handleOff}
        onLatch={handleLatchToggle} latchMode={latchMode}
        onBend={handleBendToggle} isBendEnabled={settings.isPitchBendEnabled}
        onCenter={handleCenter}
        onIncreaseDepth={handleIncreaseDepth} onDecreaseDepth={handleDecreaseDepth}
        onAddChord={handleAddChord} toggleChord={toggleChord}
        activeChordIds={activeChordIds} savedChords={settings.savedChords}
        chordShortcutSizeScale={settings.chordShortcutSizeScale}
        showIncreaseDepthButton={settings.showIncreaseDepthButton}
        uiUnlocked={settings.uiUnlocked}
        uiPositions={settings.uiPositions} updatePosition={handleUiPositionUpdate}
        draggingId={draggingId} setDraggingId={setDraggingId}
        uiScale={effectiveScale}
        
        arpeggios={settings.arpeggios}
        arpBpm={settings.arpBpm}
        onArpToggle={handleArpToggle}
        onArpBpmChange={handleArpBpmChange}
        onArpRowConfigChange={handleArpRowConfigChange}
        onArpPatternUpdate={handleArpPatternUpdate}
        recordingArpId={recordingArpId}
        currentArpStep={currentArpStep}
        recordingFlash={recordingFlash}
        onPlayAll={handlePlayAll}
        onStopAll={handleStopAll}
      />

      <LimitLayerControls settings={settings} updateSettings={updateSettings} draggingId={draggingId} setDraggingId={setDraggingId} uiScale={effectiveScale} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSettings={updateSettings} />
      <SynthControls isOpen={isSynthOpen} onClose={() => setIsSynthOpen(false)} presets={presets} onChange={setPreset} />
    </div>
  );
};

export default App;
