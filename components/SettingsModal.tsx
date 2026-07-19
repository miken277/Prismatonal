
import React, { useState } from 'react';
import { AppSettings } from '../types';
import TonalityTab from './settings/TonalityTab';
import BehaviorTab from './settings/BehaviorTab';
import VisualsTab from './settings/VisualsTab';
import MidiTab from './settings/MidiTab';
import DataTab from './settings/DataTab';
import DiagnosticOverlay from './DiagnosticOverlay';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void;
  
  // Developer Suite Props
  presets?: any;
  setPreset?: any;
  volume?: any;
  setVolume?: any;
  spatialScale?: any;
  setSpatialScale?: any;
  brightness?: any;
  setBrightness?: any;
  viewZoom?: any;
  setViewZoom?: any;
  onPanic?: any;
  onOff?: any;
  latchMode?: any;
  onCenter?: any;
  onIncreaseDepth?: any;
  onDecreaseDepth?: any;
  onAddChord?: any;
  onDroneSelect?: any;
  onStringSelect?: any;
  onPluckedSelect?: any;
  onVoiceSelect?: any;
  onKeysSelect?: any;
  onPercussionSelect?: any;
  onSustainToggle?: any;
  onBendToggle?: any;
  onShiftToggle?: any;
  onModulationToggle?: any;
  onModulationUndo?: any;
  onModulationReset?: any;
  activeChordIds?: any;
  savedChords?: any;
  onArpToggle?: any;
  onArpBpmChange?: any;
  onPlayAll?: any;
  onStopAll?: any;
}

const SettingsModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  settings, 
  updateSettings,
  presets,
  setPreset,
  volume,
  setVolume,
  spatialScale,
  setSpatialScale,
  brightness,
  setBrightness,
  viewZoom,
  setViewZoom,
  onPanic,
  onOff,
  latchMode,
  onCenter,
  onIncreaseDepth,
  onDecreaseDepth,
  onAddChord,
  onDroneSelect,
  onStringSelect,
  onPluckedSelect,
  onVoiceSelect,
  onKeysSelect,
  onPercussionSelect,
  onSustainToggle,
  onBendToggle,
  onShiftToggle,
  onModulationToggle,
  onModulationUndo,
  onModulationReset,
  activeChordIds,
  savedChords,
  onArpToggle,
  onArpBpmChange,
  onPlayAll,
  onStopAll
}) => {
  const [activeTab, setActiveTab] = useState<'tonality' | 'behavior' | 'visuals' | 'midi' | 'data' | 'developer'>('tonality');

  if (!isOpen) return null;

  // Wrapper to simplify passing to tabs if they expect simple object merge
  const handleUpdate = (partial: Partial<AppSettings>) => updateSettings(partial);

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden text-slate-200 shadow-2xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-700 bg-slate-800 flex-shrink-0 relative z-10">
          <h2 className="text-xl md:text-2xl font-bold text-white">System Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition group">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Tabs - Mobile Optimized */}
        <div className="flex border-b border-slate-700 bg-slate-900/50 overflow-x-auto flex-shrink-0 relative z-10 scrollbar-none">
           <button onClick={() => setActiveTab('tonality')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap text-sm md:text-base ${activeTab === 'tonality' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Tonality</button>
           <button onClick={() => setActiveTab('behavior')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap text-sm md:text-base ${activeTab === 'behavior' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Behavior</button>
           <button onClick={() => setActiveTab('visuals')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap text-sm md:text-base ${activeTab === 'visuals' ? 'text-pink-400 border-b-2 border-pink-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Visuals</button>
           <button onClick={() => setActiveTab('midi')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap text-sm md:text-base ${activeTab === 'midi' ? 'text-green-400 border-b-2 border-green-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>MIDI</button>
           <button onClick={() => setActiveTab('data')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap text-sm md:text-base ${activeTab === 'data' ? 'text-orange-400 border-b-2 border-orange-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>Data</button>
           <button onClick={() => setActiveTab('developer')} className={`flex-1 py-3 px-4 font-semibold transition whitespace-nowrap text-sm md:text-base ${activeTab === 'developer' ? 'text-rose-400 border-b-2 border-rose-400 bg-slate-800' : 'text-slate-500 hover:text-rose-300'}`}>Developer Suite</button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 min-h-0 bg-slate-800">
            {activeTab === 'tonality' && (
                <TonalityTab settings={settings} updateSettings={handleUpdate} />
            )}

            {activeTab === 'behavior' && (
                <BehaviorTab settings={settings} updateSettings={handleUpdate} />
            )}

            {activeTab === 'visuals' && (
                <VisualsTab settings={settings} updateSettings={handleUpdate} />
            )}

            {activeTab === 'midi' && (
                <MidiTab settings={settings} updateSettings={handleUpdate} />
            )}

            {activeTab === 'data' && (
                <DataTab onClose={onClose} />
            )}

            {activeTab === 'developer' && (
                <DiagnosticOverlay
                    isOpen={true}
                    onClose={() => {}}
                    inline={true}
                    settings={settings}
                    updateSettings={updateSettings}
                    presets={presets}
                    setPreset={setPreset}
                    volume={volume}
                    setVolume={setVolume}
                    spatialScale={spatialScale}
                    setSpatialScale={setSpatialScale}
                    brightness={brightness}
                    setBrightness={setBrightness}
                    viewZoom={viewZoom}
                    setViewZoom={setViewZoom}
                    onPanic={onPanic}
                    onOff={onOff}
                    latchMode={latchMode}
                    onCenter={onCenter}
                    onIncreaseDepth={onIncreaseDepth}
                    onDecreaseDepth={onDecreaseDepth}
                    onAddChord={onAddChord}
                    onDroneSelect={onDroneSelect}
                    onStringSelect={onStringSelect}
                    onPluckedSelect={onPluckedSelect}
                    onVoiceSelect={onVoiceSelect}
                    onKeysSelect={onKeysSelect}
                    onPercussionSelect={onPercussionSelect}
                    onSustainToggle={onSustainToggle}
                    onBendToggle={onBendToggle}
                    onShiftToggle={onShiftToggle}
                    onModulationToggle={onModulationToggle}
                    onModulationUndo={onModulationUndo}
                    onModulationReset={onModulationReset}
                    activeChordIds={activeChordIds}
                    savedChords={savedChords}
                    onArpToggle={onArpToggle}
                    onArpBpmChange={onArpBpmChange}
                    onPlayAll={onPlayAll}
                    onStopAll={onStopAll}
                />
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
