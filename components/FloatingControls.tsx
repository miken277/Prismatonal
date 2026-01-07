
import React, { useState, useEffect } from 'react';
import { ChordDefinition, XYPos, AppSettings, ArpeggioDefinition, ArpConfig, ArpeggioStep, PresetState, PlayMode, SynthPreset, UISize } from '../types';
import ArpeggiatorBar from './controls/ArpeggiatorBar';
import InstrumentCluster from './controls/InstrumentCluster';
import MasterControls from './controls/MasterControls';
import PerformanceControls from './controls/PerformanceControls';
import ViewControls from './controls/ViewControls';
import ChordBar from './controls/ChordBar';
import { useDragManager } from '../hooks/useDragManager';

interface Props {
  volume: number;
  setVolume: (v: number) => void;
  spatialScale: number;
  setSpatialScale: (v: number) => void;
  brightness: number;
  setBrightness: (v: number) => void;
  viewZoom: number;
  setViewZoom: (v: number) => void;
  
  onPanic: () => void;
  onOff: () => void;
  onLatch: () => void; 
  onSust?: () => void; 
  onPluck?: () => void; 
  onVoice?: () => void; 
  onKeys?: () => void;
  onPercussion?: () => void; // New prop
  latchMode: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Updated type
  onBend: () => void;
  isBendEnabled: boolean;
  onSustainToggle?: () => void;
  isSustainEnabled?: boolean;
  onCenter: () => void;
  onIncreaseDepth: () => void;
  onDecreaseDepth: () => void;
  onAddChord: () => void;
  toggleChord: (id: string) => void;
  onRemoveChord?: (id: string) => void;
  activeChordIds: string[];
  savedChords: ChordDefinition[];
  chordShortcutSizeScale: number;
  showIncreaseDepthButton: boolean;
  uiUnlocked: boolean;
  uiPositions: AppSettings['uiPositions'];
  updatePosition: (key: keyof AppSettings['uiPositions'], pos: XYPos) => void;
  uiSizes?: AppSettings['uiSizes'];
  updateSize?: (key: keyof AppSettings['uiSizes'], size: UISize) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  uiScale?: number;
  
  arpeggios?: ArpeggioDefinition[];
  arpBpm?: number;
  onArpToggle?: (id: string) => void;
  onArpBpmChange?: (bpm: number) => void;
  onArpRowConfigChange?: (arpId: string, config: Partial<ArpConfig>) => void;
  onArpPatternUpdate?: (arpId: string, steps: ArpeggioStep[]) => void;
  recordingArpId?: string | null; 
  currentArpStep?: number;
  recordingFlash?: number;
  onPlayAll?: () => void;
  onStopAll?: () => void;
  
  maxArpWidth?: number; 
  activeSustainedModes?: number[];
  onClearSustain?: (mode: number) => void;
  
  isSequencerOpen: boolean;
  onToggleSequencer: () => void;

  presets?: PresetState;
  onPresetChange?: (mode: PlayMode, preset: SynthPreset) => void;
}

const FloatingControls: React.FC<Props> = ({ 
  volume, setVolume, spatialScale, setSpatialScale, brightness, setBrightness, viewZoom, setViewZoom,
  onPanic, onOff, onLatch, onSust, onPluck, onVoice, onKeys, onPercussion, latchMode, onBend, isBendEnabled, onSustainToggle, isSustainEnabled, onCenter, onIncreaseDepth, onDecreaseDepth, onAddChord, toggleChord, onRemoveChord,
  activeChordIds, savedChords, chordShortcutSizeScale,
  showIncreaseDepthButton, uiUnlocked, uiPositions, updatePosition,
  uiSizes, updateSize,
  draggingId, setDraggingId, uiScale = 1.0,
  arpeggios = [], arpBpm = 120, onArpToggle, onArpBpmChange, onArpRowConfigChange, onArpPatternUpdate, recordingArpId, currentArpStep, recordingFlash = 0,
  onPlayAll, onStopAll,
  maxArpWidth,
  activeSustainedModes = [],
  onClearSustain,
  isSequencerOpen,
  onToggleSequencer,
  presets,
  onPresetChange
}) => {
  
  const [isFlashingRed, setIsFlashingRed] = useState(false);
  
  useEffect(() => {
      if (recordingFlash > 0) {
          setIsFlashingRed(true);
          const t = setTimeout(() => setIsFlashingRed(false), 200);
          return () => clearTimeout(t);
      }
  }, [recordingFlash]);

  const handleDrag = useDragManager(
      uiUnlocked,
      draggingId,
      setDraggingId,
      (id, pos) => updatePosition(id as any, pos),
      uiPositions as any
  );

  const handleResize = (e: React.PointerEvent, key: 'volume' | 'arpeggioBar', axis: 'x' | 'y' | 'xy') => {
      e.stopPropagation();
      e.preventDefault();
      if (!updateSize || !uiSizes) return;

      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      
      const startX = e.clientX;
      const startY = e.clientY;
      
      const initialWidth = uiSizes[key]?.width || (key === 'volume' ? 600 : 760);
      const initialHeight = uiSizes[key]?.height || (key === 'volume' ? 75 : 0); 

      const onMove = (evt: PointerEvent) => {
          const deltaX = (evt.clientX - startX) / uiScale;
          const deltaY = (evt.clientY - startY) / uiScale;
          
          let newWidth = initialWidth;
          let newHeight = initialHeight;

          if (axis === 'x' || axis === 'xy') {
              const minW = key === 'volume' ? 320 : 300; 
              newWidth = Math.max(minW, initialWidth + deltaX);
          }
          if ((axis === 'y' || axis === 'xy') && key === 'volume') {
              const minH = 60; 
              newHeight = Math.max(minH, initialHeight + deltaY);
          }

          updateSize(key, { width: newWidth, height: newHeight });
      };

      const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
  };

  const arpBaseWidth = uiSizes?.arpeggioBar?.width || 760;
  const userArpWidth = arpBaseWidth * uiScale;
  const effectiveArpWidth = maxArpWidth ? Math.min(userArpWidth, maxArpWidth) : userArpWidth;
  const isConstrained = effectiveArpWidth < (760 * uiScale) * 0.95;
  
  const resizeHandleStyle = "absolute z-50 bg-yellow-500/50 hover:bg-yellow-400 rounded-sm border border-white/50 shadow-sm transition-colors";

  return (
    <>
      <MasterControls 
          volume={volume} setVolume={setVolume}
          spatialScale={spatialScale} setSpatialScale={setSpatialScale}
          brightness={brightness} setBrightness={setBrightness}
          viewZoom={viewZoom} setViewZoom={setViewZoom}
          uiScale={uiScale}
          uiUnlocked={uiUnlocked}
          position={uiPositions.volume}
          size={uiSizes?.volume || { width: 600, height: 75 }}
          onDragStart={(e) => handleDrag(e, 'volume')}
          onResize={(e, axis) => handleResize(e, 'volume', axis)}
      />

      {/* Independent Resize Handle for Arp Bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
          {uiUnlocked && (
              <div 
                  className={`${resizeHandleStyle} cursor-ew-resize`}
                  style={{ 
                      left: uiPositions.arpeggioBar.x + effectiveArpWidth - 6, 
                      top: uiPositions.arpeggioBar.y, 
                      height: 52 * uiScale, 
                      width: 12,
                      zIndex: 160 
                  }}
                  onPointerDown={(e) => handleResize(e, 'arpeggioBar', 'x')}
              />
          )}
      </div>

      <ArpeggiatorBar 
          arpeggios={arpeggios}
          arpBpm={arpBpm}
          onArpToggle={onArpToggle}
          onArpBpmChange={onArpBpmChange}
          onArpRowConfigChange={onArpRowConfigChange}
          onArpPatternUpdate={onArpPatternUpdate}
          recordingArpId={recordingArpId}
          currentArpStep={currentArpStep}
          onPlayAll={onPlayAll}
          onStopAll={onStopAll}
          isSequencerOpen={isSequencerOpen}
          onToggleSequencer={onToggleSequencer}
          uiScale={uiScale}
          position={uiPositions.arpeggioBar}
          isConstrained={isConstrained}
          width={effectiveArpWidth}
          onDragStart={(e) => handleDrag(e, 'arpeggioBar')}
          isFlashingRed={isFlashingRed}
          uiUnlocked={uiUnlocked}
      />

      <InstrumentCluster 
          latchMode={latchMode}
          onLatch={onLatch}
          onSust={onSust}
          onPluck={onPluck}
          onVoice={onVoice}
          onKeys={onKeys}
          onPercussion={onPercussion}
          activeSustainedModes={activeSustainedModes}
          onClearSustain={onClearSustain}
          presets={presets}
          onPresetChange={onPresetChange}
          uiScale={uiScale}
          position={uiPositions.instruments}
          onDragStart={(e) => handleDrag(e, 'instruments')}
          uiUnlocked={uiUnlocked}
      />

      <PerformanceControls 
          isBendEnabled={isBendEnabled}
          latchMode={latchMode as any} // Cast safe due to component flexibility
          isSustainEnabled={isSustainEnabled}
          uiUnlocked={uiUnlocked}
          uiScale={uiScale}
          positions={uiPositions}
          onBend={onBend}
          onSustainToggle={onSustainToggle}
          onOff={onOff}
          onPanic={onPanic}
          onDragStart={handleDrag}
      />

      <ViewControls 
          showIncreaseDepthButton={showIncreaseDepthButton}
          uiUnlocked={uiUnlocked}
          uiScale={uiScale}
          positions={uiPositions}
          onCenter={onCenter}
          onIncreaseDepth={onIncreaseDepth}
          onDecreaseDepth={onDecreaseDepth}
          onDragStart={handleDrag}
      />

      <ChordBar 
          savedChords={savedChords}
          activeChordIds={activeChordIds}
          chordShortcutSizeScale={chordShortcutSizeScale}
          uiUnlocked={uiUnlocked}
          uiScale={uiScale}
          position={uiPositions.chords}
          onAddChord={onAddChord}
          toggleChord={toggleChord}
          onRemoveChord={onRemoveChord}
          onDragStart={handleDrag}
      />
    </>
  );
};

export default FloatingControls;
