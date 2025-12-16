
import { useSyncExternalStore } from 'react';
import { AppSettings, SynthPreset, PresetState, PlayMode, StoreState } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_NORMAL_PRESET, DEFAULT_LATCH_PRESET, DEFAULT_STRUM_PRESET, DEFAULT_USER_BANK } from '../constants';
import { XmlService } from './XmlService';

const SETTINGS_KEY = 'prismatonal_settings_v5'; 
const PRESET_KEY = 'prismatonal_presets_v5';
const USER_BANK_KEY = 'prismatonal_user_bank_v1';

class PrismaStore {
  private state: StoreState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Load Settings
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    const loadedSettings = savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
    
    loadedSettings.uiPositions = { ...DEFAULT_SETTINGS.uiPositions, ...(loadedSettings.uiPositions || {}) };

    // Load Presets
    const savedPresets = localStorage.getItem(PRESET_KEY);
    let loadedPresets: PresetState;
    
    if (savedPresets) {
        loadedPresets = JSON.parse(savedPresets);
    } else {
        loadedPresets = {
            normal: JSON.parse(JSON.stringify(DEFAULT_NORMAL_PRESET)),
            latch: JSON.parse(JSON.stringify(DEFAULT_LATCH_PRESET)),
            strum: JSON.parse(JSON.stringify(DEFAULT_STRUM_PRESET))
        };
    }

    // Load User Bank
    const savedUserBank = localStorage.getItem(USER_BANK_KEY);
    let loadedUserBank: SynthPreset[] = DEFAULT_USER_BANK;
    if (savedUserBank) {
        loadedUserBank = JSON.parse(savedUserBank);
    }

    this.state = {
        settings: loadedSettings,
        presets: loadedPresets,
        userBank: loadedUserBank
    };
  }

  // --- ACTIONS ---
  
  updateSettings = (partial: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    const current = this.state.settings;
    let next: AppSettings;
    
    if (typeof partial === 'function') {
      next = partial(current);
    } else {
      next = { ...current, ...partial };
    }

    if (next === current) return;

    this.state = { ...this.state, settings: next };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    this.notify();
  };

  setPreset = (mode: PlayMode, newPreset: SynthPreset) => {
    const current = this.state.presets[mode];
    if (newPreset === current) return;
    
    const nextPresets = { ...this.state.presets, [mode]: newPreset };
    this.state = { ...this.state, presets: nextPresets };
    
    localStorage.setItem(PRESET_KEY, JSON.stringify(nextPresets));
    this.notify();
  };

  saveUserPatch = (slotIndex: number, preset: SynthPreset) => {
      if (slotIndex < 0 || slotIndex >= 20) return;
      const newBank = [...this.state.userBank];
      newBank[slotIndex] = { ...preset, category: 'User' };
      
      this.state = { ...this.state, userBank: newBank };
      localStorage.setItem(USER_BANK_KEY, JSON.stringify(newBank));
      this.notify();
  };

  exportXML = () => {
      const xml = XmlService.exportState(this.state);
      XmlService.downloadFile(xml);
  };

  importXML = async (file: File) => {
      try {
          const partial = await XmlService.parseImport(file);
          if (partial) {
              const nextState = { ...this.state, ...partial };
              
              // Persist imported state
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextState.settings));
              localStorage.setItem(PRESET_KEY, JSON.stringify(nextState.presets));
              localStorage.setItem(USER_BANK_KEY, JSON.stringify(nextState.userBank));
              
              this.state = nextState;
              this.notify();
              return true;
          }
      } catch (e) {
          console.error(e);
          alert("Failed to import XML file.");
      }
      return false;
  };

  // --- SUBSCRIPTION ---
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => {
    return this.state;
  };

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const store = new PrismaStore();

// --- REACT HOOK ---
export function useStore() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return {
    settings: state.settings,
    presets: state.presets, 
    userBank: state.userBank,
    updateSettings: store.updateSettings,
    setPreset: store.setPreset,
    saveUserPatch: store.saveUserPatch,
    exportXML: store.exportXML,
    importXML: store.importXML
  };
}
