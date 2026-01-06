
import React, { useState, useEffect, useRef } from 'react';
import TonalityDiamond, { TonalityDiamondHandle } from './components/TonalityDiamond';
import SettingsModal from './components/SettingsModal';
import SynthControls from './components/SynthControls';
import FloatingControls from './components/FloatingControls';
import LimitLayerControls from './components/LimitLayerControls';
import RecordingControls from './components/RecordingControls';
import { audioEngine } from './services/AudioEngine';
import { midiService } from './services/MidiService';
import { useStore } from './services/Store';
import { AppSettings, ChordDefinition, XYPos, ArpeggioStep, ArpConfig, ArpeggioDefinition, PlayMode, SynthPreset, UISize } from './types';
import { PIXELS_PER_MM, SCROLLBAR_WIDTH } from './constants';
import { arpeggiatorService } from './services/ArpeggiatorService';

const REFERENCE_SHORT_EDGE = 1080; 

const App: React.FC = () => {
  const { settings, presets, updateSettings, setPreset } = useStore();

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [spatialScale, setSpatialScale] = useState(1.0); 
  const [brightness, setBrightness] = useState(1.0); // Tone control
  const [viewZoom, setViewZoom] = useState(1.0);

  const [activeChordIds, setActiveChordIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [autoScaleFactor, setAutoScaleFactor] = useState(1.0);
  
  // Latch Modes: 0=Off, 1=Drone, 2=Strings, 3=Plucked, 4=Voice (Brass)
  const [latchMode, setLatchMode] = useState<0 | 1 | 2 | 3 | 4>(2);
  
  // Track sustain ON/OFF preference per instrument mode
  // 1: Drone (Default True), 2: Strings (Default True), 3: Plucked (Default False, but user can enable), 4: Voice (Default False)
  const [sustainStates, setSustainStates] = useState<{ [key: number]: boolean }>({ 1: true, 2: true, 3: false, 4: false });

  // Track which modes currently have active voices sustained
  const [activeSustainedModes, setActiveSustainedModes] = useState<number[]>([]);

  const [isShortScreen, setIsShortScreen] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);
  const [isSequencerOpen, setIsSequencerOpen] = useState(false);

  // Arpeggio State
  const [recordingArpId, setRecordingArpId] = useState<string | null>(null);
  const [currentArpStep, setCurrentArpStep] = useState(0);
  const [recordingFlash, setRecordingFlash] = useState<number>(0); // Timestamp trigger for red flash

  const diamondRef = useRef<TonalityDiamondHandle>(null);

  const effectiveScale = autoScaleFactor * (settings.uiScale || 1.0);

  // --- AUDIO ENGINE SYNC ---
  useEffect(() => {
      audioEngine.updatePresets(presets);
  }, [presets]);

  useEffect(() => {
      audioEngine.updateSettings(settings);
  }, [settings]);
  
  // --- MIDI INPUT SYNC (SUSTAIN & BEND) ---
  useEffect(() => {
      // Subscribe to external MIDI sustain events
      const unsubscribeSustain = midiService.onSustain((isActive) => {
          setSustainStates(prev => ({ ...prev, [latchMode]: isActive }));
          updateSettings(prev => ({ ...prev, isSustainEnabled: isActive }));
      });

      // Subscribe to external MIDI Pitch Bend (Global)
      // Direct call to AudioEngine to avoid React Render Cycle for high-frequency events
      const unsubscribeBend = midiService.onGlobalBend((semitones) => {
          audioEngine.setGlobalBend(semitones);
      });

      return () => {
          unsubscribeSustain();
          unsubscribeBend();
      };
  }, [latchMode, updateSettings]);

  useEffect(() => {
    const warmup = (e: Event) => {
        audioEngine.resume().then(() => {});
        // Initialize MIDI on first interaction if enabled, or just to ensure listeners are ready
        if (settings.midiEnabled) midiService.init(); 
        
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
      const internalBlockGap = 24 * scale; 
      const baseGap = Math.max(marginPx, 32 * scale); 

      // Dimensions
      // Use dynamic sizes if available, otherwise defaults
      const volumeBarWidth = (settings.uiSizes?.volume?.width || 600) * scale;
      
      const settingsGroupWidth = 170; 
      const settingsGroupHeight = 40; 
      const largeBtn = 80 * scale; 
      const perfBtn = 92 * scale; 
      
      const colWidth = 136 * scale; 

      // VERTICAL GAPS
      const verticalStackGap = 12 * PIXELS_PER_MM * scale; 
      
      const headerGap = 8 * scale; 

      const newPos = { ...settings.uiPositions };

      // Hiding Logic for Top Header
      
      newPos.arpeggioBar = { x: marginLeft, y: marginTop };
      
      // Calculate Volume X. It is anchored right, next to settings.
      const volX = w - marginRight - settingsGroupWidth - headerGap - volumeBarWidth;
      newPos.volume = { x: volX, y: marginTop };

      // Hiding Logic for Limit Layers (Right Side)
      if (w < 600) {
          newPos.layers = { x: -9999, y: -9999 };
          newPos.instruments = { x: -9999, y: -9999 };
      } else {
          // Vertical calculation for layers (Right)
          const extraLimitMargin = 12 * scale;
          const limitBarX = w - marginRight - colWidth - extraLimitMargin;
          const layersY = marginTop + settingsGroupHeight + verticalStackGap;
          newPos.layers = { x: limitBarX, y: layersY };

          // Instruments (Left) - Pushed down to avoid overlapping the Arpeggiator Bar
          // 280 * scale ensures robust clearance
          newPos.instruments = { x: marginLeft, y: marginTop + (280 * scale) };
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

      // PERFORMANCE CLUSTER (BOTTOM RIGHT) - Horizontal Order: Bend, Sust, Off, Panic
      const perfY = h - marginBottom - perfBtn;
      
      let rightX = w - marginRight - perfBtn; // Panic (far right)
      newPos.panic = { x: rightX, y: perfY };
      
      rightX -= (perfBtn + internalBlockGap); // Off
      newPos.off = { x: rightX, y: perfY };
      
      rightX -= (perfBtn + internalBlockGap); // Sust
      newPos.sust = { x: rightX, y: perfY };
      
      rightX -= (perfBtn + internalBlockGap); // Bend
      newPos.bend = { x: rightX, y: perfY };
      
      // Legacy latch prop - cleared from UI layout but kept in logic
      newPos.latch = { x: -9999, y: -9999 };

      return newPos;
  };

  const windowSizeRef = useRef({ w: typeof window !== 'undefined' ? window.innerWidth : 1000, h: typeof window !== 'undefined' ? window.innerHeight : 800 });

  useEffect(() => {
    const handleResize = () => {
        const w = document.documentElement.clientWidth;
        const h = document.documentElement.clientHeight;
        
        setIsShortScreen(h < 800);

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
  }, [settings.uiScale, settings.uiEdgeMargin, settings.showIncreaseDepthButton, settings.uiSizes]); 

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
    // setLatchMode(0); // Don't reset instrument selection on Panic
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
    // Do not change latchMode (instrument selection) on OFF
    setRecordingArpId(null);
  };

  // Helper to switch instruments and restore their sustain state
  const switchInstrument = (newMode: 0 | 1 | 2 | 3 | 4) => {
      // 1. Save current sustain state
      setSustainStates(prev => ({ ...prev, [latchMode]: settings.isSustainEnabled }));
      
      // 2. Switch mode
      setLatchMode(newMode);
      
      // 3. Restore new mode's sustain state
      // Note: If no previous state exists, defaults are used (defined in useState above)
      let nextSustainState = sustainStates[newMode] ?? false;
      
      updateSettings(prev => ({
          ...prev,
          isSustainEnabled: nextSustainState,
      }));
  };

  const handleDroneSelect = () => switchInstrument(1);
  const handleStringSelect = () => switchInstrument(2);
  const handlePluckedSelect = () => switchInstrument(3);
  const handleVoiceSelect = () => switchInstrument(4);

  const handleSustainToggle = () => {
      const willEnable = !settings.isSustainEnabled;
      
      // Update Local Map immediately
      setSustainStates(prev => ({ ...prev, [latchMode]: willEnable }));

      updateSettings(prev => ({
          ...prev,
          isSustainEnabled: willEnable,
      }));

      // Send MIDI Sustain (CC 64) if enabled
      if (settings.midiEnabled) {
          midiService.sendSustain(willEnable);
      }
  };

  const handleBendToggle = () => {
      updateSettings(prev => ({ 
          ...prev, 
          isPitchBendEnabled: !prev.isPitchBendEnabled,
      }));
  };

  const handleSustainStatusChange = (modes: number[]) => {
      setActiveSustainedModes(modes);
  };

  const handleClearSustain = (mode: number) => {
      diamondRef.current?.clearLatches(mode);
  };

  const handleCenter = () => diamondRef.current?.centerView();
  const handleIncreaseDepth = () => diamondRef.current?.increaseDepth();
  const handleDecreaseDepth = () => diamondRef.current?.decreaseDepth();

  const handleAddChord = () => {
      if (diamondRef.current) {
          const latchedData = diamondRef.current.getLatchedNodes();
          if (latchedData.length === 0) return;
          
          let slotIndex = settings.savedChords.findIndex(c => c.nodes.length === 0);
          if (slotIndex === -1) slotIndex = settings.savedChords.findIndex(c => !c.visible);
          
          if (slotIndex !== -1) {
              const newChords = [...settings.savedChords];
              const uniqueTimestamp = Date.now();
              const soundConfigs: Partial<Record<PlayMode, SynthPreset>> = {};
              const usedModes = new Set<PlayMode>();

              const simplifiedNodes = latchedData.map(({ node, mode }) => {
                  let modeStr: PlayMode = 'normal';
                  if (mode === 1) modeStr = 'latch';
                  else if (mode === 2) modeStr = 'normal';
                  else if (mode === 3) modeStr = 'strum';
                  else if (mode === 4) modeStr = 'brass'; 
                  
                  usedModes.add(modeStr);
                  
                  return { 
                      id: node.id, 
                      n: node.n, 
                      d: node.d,
                      voiceMode: modeStr 
                  };
              });

              // Capture snapshot of presets for all used modes
              // IMPORTANT: Clone the presets so future edits to global patches don't affect this chord
              usedModes.forEach(m => {
                  soundConfigs[m] = JSON.parse(JSON.stringify(presets[m]));
                  // Tag the preset with a unique ID to ensure the worklet treats it as a new distinct sound
                  if (soundConfigs[m]) {
                      soundConfigs[m]!.id = `chord-${newChords[slotIndex].id}-${m}-${uniqueTimestamp}`;
                  }
              });

              newChords[slotIndex] = {
                  ...newChords[slotIndex],
                  nodes: simplifiedNodes,
                  visible: true,
                  position: { x: 0, y: 0 },
                  soundConfigs: soundConfigs,
                  soundConfig: undefined 
              };
              updateSettings(prev => ({ ...prev, savedChords: newChords }));
          }
      }
  };

  const toggleChord = (id: string) => {
      // If sustain is enabled, allow multiple chords (additive).
      // If sustain is disabled, only allow one chord at a time (exclusive/legato).
      if (settings.isSustainEnabled) {
          setActiveChordIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
      } else {
          setActiveChordIds(prev => prev.includes(id) ? [] : [id]);
      }
  };

  const handleRemoveChord = (id: string) => {
      const newChords = settings.savedChords.map(c => {
          if (c.id === id) {
              return { ...c, nodes: [], visible: false, soundConfig: undefined, soundConfigs: undefined };
          }
          return c;
      });
      updateSettings(prev => ({ ...prev, savedChords: newChords }));
      
      if (activeChordIds.includes(id)) {
          setActiveChordIds(prev => prev.filter(cid => cid !== id));
      }
  };

  const handleUiPositionUpdate = (key: keyof AppSettings['uiPositions'], pos: XYPos) => {
      updateSettings(prev => ({ ...prev, uiPositions: { ...prev.uiPositions, [key]: pos } }));
  };

  const handleUiSizeUpdate = (key: keyof AppSettings['uiSizes'], size: UISize) => {
      updateSettings(prev => ({ 
          ...prev, 
          uiSizes: { ...prev.uiSizes, [key]: size } 
      }));
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
          arpeggiatorService.start(
              arp.steps, 
              arp.config, 
              settings.arpBpm, 
              (step) => setCurrentArpStep(step),
              (nodeId, active) => diamondRef.current?.triggerVisual(nodeId, active) // Visual Callback
          );
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
          arpeggiatorService.start(
              newArps[arpIndex].steps, 
              newArps[arpIndex].config, 
              settings.arpBpm, 
              (step) => setCurrentArpStep(step),
              (nodeId, active) => diamondRef.current?.triggerVisual(nodeId, active)
          );
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
          arpeggiatorService.start(
              firstValid.steps, 
              firstValid.config, 
              settings.arpBpm, 
              (step) => setCurrentArpStep(step),
              (nodeId, active) => diamondRef.current?.triggerVisual(nodeId, active)
          );
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

          if (key === map.latch.toLowerCase()) {
              if (latchMode === 1) handleStringSelect(); else handleDroneSelect(); 
          }
          else if (key === map.modeDrone.toLowerCase()) handleDroneSelect();
          else if (key === map.modeStrings.toLowerCase()) handleStringSelect();
          else if (key === map.modePlucked.toLowerCase()) handlePluckedSelect();
          else if (key === map.modeBrass.toLowerCase()) handleVoiceSelect(); // New Mapping
          else if (key === map.sustain.toLowerCase()) handleSustainToggle();
          else if (key === map.bend.toLowerCase()) handleBendToggle();
          
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
          
          // Arpeggiator & BPM
          else if (key === map.bpmUp.toLowerCase()) handleArpBpmChange(settings.arpBpm + 1);
          else if (key === map.bpmDown.toLowerCase()) handleArpBpmChange(settings.arpBpm - 1);
          else if (key === map.toggleSequencer.toLowerCase()) setIsSequencerOpen(prev => !prev);
          else if (key === map.playAllArps.toLowerCase()) handlePlayAll();
          else if (key === map.stopAllArps.toLowerCase()) handleStopAll();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isSynthOpen, settings.enableKeyboardShortcuts, settings.keyMappings, latchMode, settings.arpBpm]);

  const marginPx = (settings.uiEdgeMargin || 4) * PIXELS_PER_MM;
  const safeArea = getSafeAreas();
  const leftOffset = `calc(${marginPx}px + ${safeArea.left}px)`;
  const rightOffset = `calc(${marginPx}px + ${safeArea.right}px + ${SCROLLBAR_WIDTH}px)`;
  const headerTop = `calc(${marginPx}px + ${safeArea.top}px)`;

  const headerBtnClass = "bg-slate-900/50 hover:bg-slate-800 px-3 py-1 rounded-xl backdrop-blur-sm transition border border-slate-700/50 h-8 flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-white shadow-lg";

  // Calculate available width for Arpeggiator Bar based on Volume Bar position
  const arpX = settings.uiPositions.arpeggioBar.x;
  const volX = settings.uiPositions.volume.x;
  const gap = 20 * effectiveScale;
  
  const availableArpWidth = Math.max(0, volX - arpX - gap);
  const showArpBar = availableArpWidth > 250 * effectiveScale;

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
        isCurrentSustainEnabled={settings.isSustainEnabled} 
        globalScale={effectiveScale}
        viewZoom={viewZoom}
        onNodeTrigger={handleArpRecordNote}
        onSustainStatusChange={handleSustainStatusChange}
      />

      <FloatingControls 
        volume={masterVolume} setVolume={setMasterVolume}
        spatialScale={spatialScale} setSpatialScale={setSpatialScale}
        brightness={brightness} setBrightness={setBrightness}
        viewZoom={viewZoom} setViewZoom={setViewZoom}
        
        onPanic={handlePanic} onOff={handleOff}
        onLatch={handleDroneSelect} 
        onSust={handleStringSelect} 
        onPluck={handlePluckedSelect}
        onVoice={handleVoiceSelect}
        latchMode={latchMode}
        onBend={handleBendToggle} isBendEnabled={settings.isPitchBendEnabled}
        onSustainToggle={handleSustainToggle} isSustainEnabled={settings.isSustainEnabled}
        onCenter={handleCenter}
        onIncreaseDepth={handleIncreaseDepth} onDecreaseDepth={handleDecreaseDepth}
        onAddChord={handleAddChord} toggleChord={toggleChord}
        onRemoveChord={handleRemoveChord}
        activeChordIds={activeChordIds} savedChords={settings.savedChords}
        chordShortcutSizeScale={settings.chordShortcutSizeScale}
        showIncreaseDepthButton={settings.showIncreaseDepthButton}
        uiUnlocked={settings.uiUnlocked}
        uiPositions={settings.uiPositions} updatePosition={handleUiPositionUpdate}
        uiSizes={settings.uiSizes} updateSize={handleUiSizeUpdate}
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
        
        activeSustainedModes={activeSustainedModes}
        maxArpWidth={showArpBar ? availableArpWidth : 0}
        onClearSustain={handleClearSustain}
        
        isShortScreen={isShortScreen}
        isSequencerOpen={isSequencerOpen}
        onToggleSequencer={() => setIsSequencerOpen(p => !p)}
        
        // Pass dynamics props
        presets={presets}
        onPresetChange={setPreset}
        
        // Pass Recording Setting
        // recordScreenActivity={settings.recordScreenActivity} // Removed outdated prop
      />

      <LimitLayerControls 
        settings={settings} 
        updateSettings={updateSettings} 
        draggingId={draggingId} 
        setDraggingId={setDraggingId} 
        uiScale={effectiveScale}
        isShortScreen={isShortScreen}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSettings={updateSettings} />
      <SynthControls isOpen={isSynthOpen} onClose={() => setIsSynthOpen(false)} presets={presets} onChange={setPreset} />
      
      {/* Recording Controls - Rendered at root for universal access */}
      <RecordingControls />
    </div>
  );
};

export default App;
