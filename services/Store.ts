
import { useState, useEffect } from 'react';
import { AppSettings, SynthPreset } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PRESET } from '../constants';

// --- STORE EVENT BUS ---
type Listener = () => void;

class PrismaStore {
  private listeners: Set<Listener> = new Set();
  
  private _settings: AppSettings;
  private _preset: SynthPreset;

  constructor() {
    // Load Settings
    const savedSettings = localStorage.getItem('prismatonal_settings');
    this._settings = savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
    
    // Safety merge for nested UI Positions (handles new keys like 'decreaseDepth')
    this._settings.uiPositions = { ...DEFAULT_SETTINGS.uiPositions, ...(this._settings.uiPositions || {}) };

    // Load Preset
    const savedPreset = localStorage.getItem('prismatonal_preset');
    this._preset = savedPreset ? JSON.parse(savedPreset) : DEFAULT_PRESET;
  }

  // --- GETTERS ---
  get settings() { return this._settings; }
  get preset() { return this._preset; }

  // --- ACTIONS ---
  updateSettings(partial: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) {
    if (typeof partial === 'function') {
      this._settings = partial(this._settings);
    } else {
      this._settings = { ...this._settings, ...partial };
    }
    localStorage.setItem('prismatonal_settings', JSON.stringify(this._settings));
    this.notify();
  }

  setPreset(newPreset: SynthPreset) {
    this._preset = newPreset;
    localStorage.setItem('prismatonal_preset', JSON.stringify(this._preset));
    this.notify();
  }

  updatePresetGlobal(key: keyof SynthPreset, value: any) {
    this._preset = { ...this._preset, [key]: value };
    localStorage.setItem('prismatonal_preset', JSON.stringify(this._preset));
    this.notify();
  }

  // --- SUBSCRIPTION ---
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const store = new PrismaStore();

// --- REACT HOOK ---
export function useStore() {
  // We use a simple tick to force re-render when store notifies
  const [_, setTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => setTick(t => t + 1));
  }, []);

  return {
    settings: store.settings,
    preset: store.preset,
    updateSettings: store.updateSettings.bind(store),
    setPreset: store.setPreset.bind(store),
    updatePresetGlobal: store.updatePresetGlobal.bind(store)
  };
}
