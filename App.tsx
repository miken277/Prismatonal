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
import { AppSettings, XYPos, UISize, SynthPreset } from './types';
import { PIXELS_PER_MM, SCROLLBAR_WIDTH } from './constants';
import { arpeggiatorService } from './services/ArpeggiatorService';
import { useAppLayout } from './hooks/useAppLayout';
import { useArpeggiatorLogic } from './hooks/useArpeggiatorLogic';

const App: React.FC = () => {
  const { settings, presets, updateSettings, setPreset } = useStore();

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [spatialScale, setSpatialScale] = useState(1.0); 
  const [brightness, setBrightness] = useState(1.0); // Tone control
  const [viewZoom, setViewZoom] = useState(1.0);

  const [activeChordIds, setActiveChordIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Latch Modes: 0=Off, 1=Drone, 2=Strings, 3=Plucked, 4=Voice (Brass)
  const [latchMode, setLatchMode] = useState<0 | 1 | 2 | 3 | 4>(2);
  
  // Track sustain ON/OFF preference per instrument mode
  const [sustainStates, setSustainStates] = useState<{ [key: number]: boolean }>({ 1: true, 2: true, 3: false, 4: false });

  // Track which modes currently have active voices sustained
  const [activeSustainedModes, setActiveSustainedModes] = useState<number[]>([]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);
  const [isSequencerOpen, setIsSequencerOpen] = useState(false);

  const diamondRef = useRef<TonalityDiamondHandle>(null);

  // Use custom hooks
  const { autoScaleFactor, isShortScreen } = useAppLayout(settings, updateSettings);
  const effectiveScale = autoScaleFactor * (settings.uiScale || 1.0);

  const {
      recordingArpId,
      setRecordingArpId,
      currentArpStep,
      recordingFlash,
      handleArpToggle,
      handleArpRecordNote,
      handleArpPatternUpdate,
      handleArpBpmChange,
      handleArpRowConfigChange,
      handlePlayAll,
      handleStopAll,
      stopArpAndRecording
  } = useArpeggiatorLogic(settings, updateSettings, diamondRef);

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
    stopArpAndRecording();
    midiService.panic();
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]); 
    setIsSettingsOpen(false);
    setIsSynthOpen(false);
  };

  const handleOff = () => {
    diamondRef.current?.clearLatches(); 
    setActiveChordIds([]);
    setRecordingArpId(null);
  };

  const switchInstrument = (newMode: 0 | 1 | 2 | 3 | 4) => {
      setSustainStates(prev => ({ ...prev, [latchMode]: settings.isSustainEnabled }));
      setLatchMode(newMode);
      let nextSustainState = sustainStates[newMode] ?? false;
      updateSettings(prev => ({ ...prev, isSustainEnabled: nextSustainState }));
  };

  const handleDroneSelect = () => switchInstrument(1);
  const handleStringSelect = () => switchInstrument(2);
  const handlePluckedSelect = () => switchInstrument(3);
  const handleVoiceSelect = () => switchInstrument(4);

  const handleSustainToggle = () => {
      const willEnable = !settings.isSustainEnabled;
      setSustainStates(prev => ({ ...prev, [latchMode]: willEnable }));
      updateSettings(prev => ({ ...prev, isSustainEnabled: willEnable }));
      if (settings.midiEnabled) {
          midiService.sendSustain(willEnable);
      }
  };

  const handleBendToggle = () => {
      updateSettings(prev => ({ ...prev, isPitchBendEnabled: !prev.isPitchBendEnabled }));
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
              const soundConfigs: Partial<Record<import('./types').PlayMode, SynthPreset>> = {};
              const usedModes = new Set<import('./types').PlayMode>();

              const simplifiedNodes = latchedData.map(({ node, mode }) => {
                  let modeStr: import('./types').PlayMode = 'normal';
                  if (mode === 1) modeStr = 'latch';
                  else if (mode === 2) modeStr = 'normal';
                  else if (mode === 3) modeStr = 'strum';
                  else if (mode === 4) modeStr = 'brass'; 
                  usedModes.add(modeStr);
                  
                  return { id: node.id, n: node.n, d: node.d, voiceMode: modeStr };
              });

              usedModes.forEach(m => {
                  soundConfigs[m] = JSON.parse(JSON.stringify(presets[m]));
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
      updateSettings(prev => ({ ...prev, uiSizes: { ...prev.uiSizes, [key]: size } }));
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

          if (key === map.latch.toLowerCase()) { if (latchMode === 1) handleStringSelect(); else handleDroneSelect(); }
          else if (key === map.modeDrone.toLowerCase()) handleDroneSelect();
          else if (key === map.modeStrings.toLowerCase()) handleStringSelect();
          else if (key === map.modePlucked.toLowerCase()) handlePluckedSelect();
          else if (key === map.modeBrass.toLowerCase()) handleVoiceSelect(); 
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
          else if (key === map.bpmUp.toLowerCase()) handleArpBpmChange(settings.arpBpm + 1);
          else if (key === map.bpmDown.toLowerCase()) handleArpBpmChange(settings.arpBpm - 1);
          else if (key === map.toggleSequencer.toLowerCase()) setIsSequencerOpen(prev => !prev);
          else if (key === map.playAllArps.toLowerCase()) handlePlayAll();
          else if (key === map.stopAllArps.toLowerCase()) handleStopAll();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isSynthOpen, settings.enableKeyboardShortcuts, settings.keyMappings, latchMode, settings.arpBpm, handleArpBpmChange, handlePlayAll, handleStopAll]);

  const marginPx = (settings.uiEdgeMargin || 4) * PIXELS_PER_MM;
  const getSafeAreas = () => {
      if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
      const div = document.createElement('div');
      div.style.paddingTop = 'env(safe-area-inset-top)';
      div.style.visibility = 'hidden';
      document.body.appendChild(div);
      const computed = getComputedStyle(div);
      const top = parseInt(computed.paddingTop) || 0;
      document.body.removeChild(div);
      return { top, left: 0, right: 0, bottom: 0 };
  };
  const safeArea = getSafeAreas();
  const leftOffset = `calc(${marginPx}px + ${safeArea.left}px)`;
  const rightOffset = `calc(${marginPx}px + ${safeArea.right}px + ${SCROLLBAR_WIDTH}px)`;
  const headerTop = `calc(${marginPx}px + ${safeArea.top}px)`;

  const headerBtnClass = "bg-slate-900/50 hover:bg-slate-800 px-3 py-1 rounded-xl backdrop-blur-sm transition border border-slate-700/50 h-8 flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-white shadow-lg";

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
        
        presets={presets}
        onPresetChange={setPreset}
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
      
      <RecordingControls />
    </div>
  );
};

export default App;