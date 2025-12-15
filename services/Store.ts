
import { useSyncExternalStore } from 'react';
import { AppSettings, SynthPreset } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PRESET, DEFAULT_KEY_MAP } from '../constants';

interface StoreState {
    settings: AppSettings;
    preset: SynthPreset;
}

class PrismaStore {
  private state: StoreState;
  private listeners: Set<() => void> = new Set();
  
  // Debounce timers for persistence
  private settingsSaveTimer: number | null = null;
  private presetSaveTimer: number | null = null;

  constructor() {
    // Load Settings
    const savedSettings = localStorage.getItem('prismatonal_settings');
    let loadedSettings = savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
    
    // Safety merge for nested UI Positions
    loadedSettings.uiPositions = { ...DEFAULT_SETTINGS.uiPositions, ...(loadedSettings.uiPositions || {}) };

    // Safety merge for KeyMap (handle old versions)
    loadedSettings.keyMap = { ...DEFAULT_KEY_MAP, ...(loadedSettings.keyMap || {}) };

    // Load Preset
    const savedPreset = localStorage.getItem('prismatonal_preset');
    const loadedPreset = savedPreset ? JSON.parse(savedPreset) : DEFAULT_PRESET;

    this.state = {
        settings: loadedSettings,
        preset: loadedPreset
    };
  }

  // --- ACTIONS (Arrow functions for stability) ---
  
  updateSettings = (partial: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    const current = this.state.settings;
    let next: AppSettings;
    
    if (typeof partial === 'function') {
      next = partial(current);
    } else {
      next = { ...current, ...partial };
    }

    if (next === current) return;

    // 1. Update In-Memory State Immediately (UI Responsiveness)
    this.state = { ...this.state, settings: next };
    this.notify();

    // 2. Debounce Disk Write (Prevent blocking main thread on sliders/drag)
    if (this.settingsSaveTimer) {
        clearTimeout(this.settingsSaveTimer);
    }
    this.settingsSaveTimer = setTimeout(() => {
        localStorage.setItem('prismatonal_settings', JSON.stringify(next));
        this.settingsSaveTimer = null;
    }, 1000) as unknown as number;
  };

  setPreset = (newPreset: SynthPreset) => {
    if (newPreset === this.state.preset) return;
    
    // 1. Update In-Memory State Immediately
    this.state = { ...this.state, preset: newPreset };
    this.notify();

    // 2. Debounce Disk Write
    if (this.presetSaveTimer) {
        clearTimeout(this.presetSaveTimer);
    }
    this.presetSaveTimer = setTimeout(() => {
        localStorage.setItem('prismatonal_preset', JSON.stringify(newPreset));
        this.presetSaveTimer = null;
    }, 1000) as unknown as number;
  };

  updatePresetGlobal = (key: keyof SynthPreset, value: any) => {
    const next = { ...this.state.preset, [key]: value };
    this.setPreset(next);
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
    preset: state.preset,
    updateSettings: store.updateSettings,
    setPreset: store.setPreset,
    updatePresetGlobal: store.updatePresetGlobal
  };
}
