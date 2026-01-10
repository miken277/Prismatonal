
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
import { useAppLayout } from './hooks/useAppLayout';
import { useArpeggiatorLogic } from './hooks/useArpeggiatorLogic';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { usePerformanceState } from './hooks/usePerformanceState';
import { useAudioSystem } from './hooks/useAudioSystem';

const App: React.FC = () => {
  const { settings, presets, updateSettings, setPreset } = useStore();

  // Visual State
  const [viewZoom, setViewZoom] = useState(1.0);
  
  // UI State
  const [activeChordIds, setActiveChordIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSynthOpen, setIsSynthOpen] = useState(false);
  const [isSequencerOpen, setIsSequencerOpen] = useState(false);

  const diamondRef = useRef<TonalityDiamondHandle>(null);

  // --- Custom Hooks ---
  
  // 1. Audio System (State, Sync, Warmup)
  const {
      masterVolume, setMasterVolume,
      spatialScale, setSpatialScale,
      brightness, setBrightness,
      stopAudio
  } = useAudioSystem(settings, presets);

  // 2. Layout Logic
  const { autoScaleFactor, isShortScreen } = useAppLayout(settings, updateSettings);
  const effectiveScale = autoScaleFactor * (settings.uiScale || 1.0);

  // 3. Performance Logic (Instrument Modes, Sustain, Bend, Modulation)
  const {
      latchMode,
      activeSustainedModes,
      handleDroneSelect,
      handleStringSelect,
      handlePluckedSelect,
      handleVoiceSelect,
      handleKeysSelect,
      handlePercussionSelect,
      handleSustainToggle,
      handleBendToggle,
      handleShiftToggle, // NEW
      handleModulationToggle,
      handleModulationUndo,
      handleModulationReset,
      handleSustainStatusChange
  } = usePerformanceState(settings, updateSettings);

  // 4. Arpeggiator Logic
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
  } = useArpeggiatorLogic(settings, updateSettings, diamondRef, latchMode);

  // --- Effects ---

  // Apply UI Scale CSS
  useEffect(() => {
      document.documentElement.style.setProperty('--ui-scale', effectiveScale.toString());
  }, [effectiveScale]);

  // --- Handlers ---

  const handleLimitInteraction = (limit: number) => {
    if (settings.layerOrder[settings.layerOrder.length - 1] !== limit) {
      const newOrder = settings.layerOrder.filter(l => l !== limit);
      newOrder.push(limit);
      updateSettings(prev => ({ ...prev, layerOrder: newOrder }));
    }
  };

  const handlePanic = () => {
    stopAudio(); 
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

  const handleClearSustain = (mode: number) => {
      diamondRef.current?.clearLatches(mode);
  };
  
  const handleClearActiveChords = () => {
      setActiveChordIds([]);
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
                  else if (mode === 5) modeStr = 'keys';
                  else if (mode === 6) modeStr = 'percussion';
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

  useKeyboardControls({
      settings, latchMode,
      isSettingsOpen, setIsSettingsOpen,
      isSynthOpen, setIsSynthOpen,
      setMasterVolume, setSpatialScale, setIsSequencerOpen,
      handleDroneSelect, handleStringSelect, handlePluckedSelect, handleVoiceSelect, handleKeysSelect, handlePercussionSelect,
      handleSustainToggle, handleBendToggle, handlePanic, handleCenter, handleOff,
      handleAddChord, handleIncreaseDepth, handleDecreaseDepth, handleArpBpmChange,
      handlePlayAll, handleStopAll
  });

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
        onClearActiveChords={handleClearActiveChords}
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
        onKeys={handleKeysSelect}
        onPercussion={handlePercussionSelect}
        latchMode={latchMode}
        onBend={handleBendToggle} isBendEnabled={settings.isPitchBendEnabled}
        onSustainToggle={handleSustainToggle} isSustainEnabled={settings.isSustainEnabled}
        onModulationToggle={handleModulationToggle} isModulationModeActive={settings.isModulationModeActive}
        modulationPathLength={settings.modulationPath.length}
        onModulationUndo={handleModulationUndo}
        onModulationReset={handleModulationReset}
        onShiftToggle={handleShiftToggle} isShiftModeActive={settings.isShiftModeActive}
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
