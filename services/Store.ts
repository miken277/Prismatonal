
import { useSyncExternalStore } from 'react';
import { AppSettings, SynthPreset, PresetState, PlayMode, StoreState } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_NORMAL_PRESET, DEFAULT_LATCH_PRESET, DEFAULT_STRUM_PRESET, DEFAULT_ARP_PRESET, DEFAULT_USER_BANK, DEFAULT_COLORS, REVERB_DEFAULTS } from '../constants';
import { XmlService } from './XmlService';

const SETTINGS_KEY = 'prismatonal_settings_v5'; 
const PRESET_KEY = 'prismatonal_presets_v5';
const USER_BANK_KEY = 'prismatonal_user_bank_v1';

class PrismaStore {
  private state: StoreState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Hardware-aware Smart Default Polyphony & Quality
    const cores = navigator.hardwareConcurrency || 4;
    let safePolyphony = 8;
    let safeOversampling = true;

    if (cores <= 4) {
        safePolyphony = 6;
        safeOversampling = false; // Disable 2x Oversampling on dual/quad core devices
    }
    else if (cores >= 8) {
        safePolyphony = 12;
        safeOversampling = true;
    }

    // Load Settings with Robust Deep Merge
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    let loadedSettings: AppSettings = { ...DEFAULT_SETTINGS, polyphony: safePolyphony, enableOversampling: safeOversampling };

    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            loadedSettings = {
                ...DEFAULT_SETTINGS,
                ...parsed,
                // Ensure polyphony is not ridiculously high if loading old settings on a weak device
                polyphony: (parsed.polyphony && parsed.polyphony > 16 && cores <= 4) ? 8 : (parsed.polyphony || safePolyphony),
                enableOversampling: (parsed.enableOversampling !== undefined) ? parsed.enableOversampling : safeOversampling,
                layoutApproach: parsed.layoutApproach || DEFAULT_SETTINGS.layoutApproach,
                limitDepths: { ...DEFAULT_SETTINGS.limitDepths, ...(parsed.limitDepths || {}) },
                limitComplexities: { ...DEFAULT_SETTINGS.limitComplexities, ...(parsed.limitComplexities || {}) },
                colors: { ...DEFAULT_COLORS, ...(parsed.colors || {}) }, 
                uiPositions: { ...DEFAULT_SETTINGS.uiPositions, ...(parsed.uiPositions || {}) },
                arpeggios: parsed.arpeggios || DEFAULT_SETTINGS.arpeggios,
                arpBpm: parsed.arpBpm || DEFAULT_SETTINGS.arpBpm
            };
            
            // Migrate stored chords to ensure soundConfig (if present) is valid
            if (loadedSettings.savedChords) {
                loadedSettings.savedChords = loadedSettings.savedChords.map(c => {
                    if (c.soundConfig) {
                        return { ...c, soundConfig: this.migratePreset(c.soundConfig) };
                    }
                    return c;
                });
            }

        } catch (e) {
            console.error("Failed to parse settings, reverting to defaults", e);
            loadedSettings = { ...DEFAULT_SETTINGS, polyphony: safePolyphony, enableOversampling: safeOversampling };
        }
    }

    // Load Presets
    const savedPresets = localStorage.getItem(PRESET_KEY);
    let loadedPresets: PresetState;
    
    if (savedPresets) {
        try {
            const parsed = JSON.parse(savedPresets);
            loadedPresets = {
                normal: this.migratePreset(parsed.normal || DEFAULT_NORMAL_PRESET),
                latch: this.migratePreset(parsed.latch || DEFAULT_LATCH_PRESET),
                strum: this.migratePreset(parsed.strum || DEFAULT_STRUM_PRESET),
                arpeggio: this.migratePreset(parsed.arpeggio || DEFAULT_ARP_PRESET)
            };
        } catch (e) {
            loadedPresets = {
                normal: JSON.parse(JSON.stringify(DEFAULT_NORMAL_PRESET)),
                latch: JSON.parse(JSON.stringify(DEFAULT_LATCH_PRESET)),
                strum: JSON.parse(JSON.stringify(DEFAULT_STRUM_PRESET)),
                arpeggio: JSON.parse(JSON.stringify(DEFAULT_ARP_PRESET))
            };
        }
    } else {
        loadedPresets = {
            normal: JSON.parse(JSON.stringify(DEFAULT_NORMAL_PRESET)),
            latch: JSON.parse(JSON.stringify(DEFAULT_LATCH_PRESET)),
            strum: JSON.parse(JSON.stringify(DEFAULT_STRUM_PRESET)),
            arpeggio: JSON.parse(JSON.stringify(DEFAULT_ARP_PRESET))
        };
    }

    // Load User Bank
    const savedUserBank = localStorage.getItem(USER_BANK_KEY);
    let loadedUserBank: SynthPreset[] = DEFAULT_USER_BANK;
    if (savedUserBank) {
        try {
            const parsed = JSON.parse(savedUserBank);
            if (Array.isArray(parsed)) {
                loadedUserBank = parsed.map(p => this.migratePreset(p));
            }
        } catch(e) {
            loadedUserBank = DEFAULT_USER_BANK;
        }
    }

    this.state = {
        settings: loadedSettings,
        presets: loadedPresets,
        userBank: loadedUserBank
    };
  }

  // Helper to ensure loaded presets have all required fields (migration from old versions)
  private migratePreset(p: any): SynthPreset {
      if (!p) return DEFAULT_NORMAL_PRESET;
      
      const safe: SynthPreset = {
          ...DEFAULT_NORMAL_PRESET, // Fallback defaults
          ...p,
          osc1: { ...DEFAULT_NORMAL_PRESET.osc1, ...(p.osc1 || {}) },
          osc2: { ...DEFAULT_NORMAL_PRESET.osc2, ...(p.osc2 || {}) },
          osc3: { ...DEFAULT_NORMAL_PRESET.osc3, ...(p.osc3 || {}) },
          modMatrix: p.modMatrix || []
      };

      // Ensure Reverb Defaults if missing
      if (safe.reverbType && (safe.reverbSize === undefined || safe.reverbDamping === undefined || safe.reverbDiffusion === undefined)) {
          const defaults = REVERB_DEFAULTS[safe.reverbType] || REVERB_DEFAULTS['hall'];
          if (safe.reverbSize === undefined) safe.reverbSize = defaults.size;
          if (safe.reverbDamping === undefined) safe.reverbDamping = defaults.damping;
          if (safe.reverbDiffusion === undefined) safe.reverbDiffusion = defaults.diffusion;
      }

      return safe;
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
      if (slotIndex < 0 || slotIndex >= 100) return;
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
              
              // Migrate imported data
              if (nextState.presets) {
                  nextState.presets = {
                      normal: this.migratePreset(nextState.presets.normal),
                      latch: this.migratePreset(nextState.presets.latch),
                      strum: this.migratePreset(nextState.presets.strum),
                      arpeggio: this.migratePreset(nextState.presets.arpeggio)
                  };
              }
              if (nextState.userBank) {
                  nextState.userBank = nextState.userBank.map(p => this.migratePreset(p));
              }
              if (nextState.settings && nextState.settings.savedChords) {
                  nextState.settings.savedChords = nextState.settings.savedChords.map(c => {
                      if (c.soundConfig) return { ...c, soundConfig: this.migratePreset(c.soundConfig) };
                      return c;
                  });
              }

              localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextState.settings));
              localStorage.setItem(PRESET_KEY, JSON.stringify(nextState.presets));
              localStorage.setItem(USER_BANK_KEY, JSON.stringify(nextState.userBank));
              this.state = nextState as StoreState; // Cast to ensure type safety after partial merge
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
