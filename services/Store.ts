
import { useSyncExternalStore } from 'react';
import { AppSettings, SynthPreset } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PRESET } from '../constants';

interface StoreState {
    settings: AppSettings;
    preset: SynthPreset;
}

class PrismaStore {
  private state: StoreState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Load Settings
    const savedSettings = localStorage.getItem('prismatonal_settings');
    const loadedSettings = savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
    
    // Safety merge for nested UI Positions
    loadedSettings.uiPositions = { ...DEFAULT_SETTINGS.uiPositions, ...(loadedSettings.uiPositions || {}) };

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

    // Reference equality check optimization could be added here if needed, 
    // but settings changes usually mean deep changes.
    if (next === current) return;

    this.state = { ...this.state, settings: next };
    localStorage.setItem('prismatonal_settings', JSON.stringify(next));
    this.notify();
  };

  setPreset = (newPreset: SynthPreset) => {
    if (newPreset === this.state.preset) return;
    
    this.state = { ...this.state, preset: newPreset };
    localStorage.setItem('prismatonal_preset', JSON.stringify(newPreset));
    this.notify();
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
