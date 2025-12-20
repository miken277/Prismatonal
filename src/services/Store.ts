
import { useSyncExternalStore } from 'react';
import { AppSettings, SynthPreset, PresetState, PlayMode, StoreState, StoredLayout } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_NORMAL_PRESET, DEFAULT_LATCH_PRESET, DEFAULT_STRUM_PRESET, DEFAULT_ARP_PRESET, DEFAULT_USER_BANK, DEFAULT_COLORS } from '../constants';
import { XmlService } from './XmlService';

const SETTINGS_KEY = 'prismatonal_settings_v5'; 
const PRESET_KEY = 'prismatonal_presets_v5';
const USER_BANK_KEY = 'prismatonal_user_bank_v1';

class PrismaStore {
  private state: StoreState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Load Settings with Robust Deep Merge
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    let loadedSettings: AppSettings = DEFAULT_SETTINGS;

    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            
            // Explicitly merge UI positions to ensure new keys (like 'zoom') are present
            // even if the saved object lacks them.
            const mergedUiPositions = {
                ...DEFAULT_SETTINGS.uiPositions,
                ...(parsed.uiPositions || {})
            };

            loadedSettings = {
                ...DEFAULT_SETTINGS,
                ...parsed,
                layoutApproach: parsed.layoutApproach || DEFAULT_SETTINGS.layoutApproach,
                limitDepths: { ...DEFAULT_SETTINGS.limitDepths, ...(parsed.limitDepths || {}) },
                limitComplexities: { ...DEFAULT_SETTINGS.limitComplexities, ...(parsed.limitComplexities || {}) },
                colors: { ...DEFAULT_COLORS, ...(parsed.colors || {}) }, 
                limitVisuals: { ...DEFAULT_SETTINGS.limitVisuals, ...(parsed.limitVisuals || {}) },
                uiPositions: mergedUiPositions,
                arpeggios: parsed.arpeggios || DEFAULT_SETTINGS.arpeggios,
                arpBpm: parsed.arpBpm || DEFAULT_SETTINGS.arpBpm,
                generationOrigins: parsed.generationOrigins || DEFAULT_SETTINGS.generationOrigins
            };
        } catch (e) {
            console.error("Failed to parse settings, reverting to defaults", e);
            loadedSettings = DEFAULT_SETTINGS;
        }
    }

    // Load Presets
    const savedPresets = localStorage.getItem(PRESET_KEY);
    let loadedPresets: PresetState;
    
    if (savedPresets) {
        try {
            const parsed = JSON.parse(savedPresets);
            loadedPresets = {
                normal: parsed.normal || JSON.parse(JSON.stringify(DEFAULT_NORMAL_PRESET)),
                latch: parsed.latch || JSON.parse(JSON.stringify(DEFAULT_LATCH_PRESET)),
                strum: parsed.strum || JSON.parse(JSON.stringify(DEFAULT_STRUM_PRESET)),
                arpeggio: parsed.arpeggio || JSON.parse(JSON.stringify(DEFAULT_ARP_PRESET))
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
            loadedUserBank = JSON.parse(savedUserBank);
        } catch(e) {
            loadedUserBank = DEFAULT_USER_BANK;
        }
    }

    this.state = {
        settings: loadedSettings,
        presets: loadedPresets,
        userBank: loadedUserBank,
        layout: null // Layout is not persisted to localStorage to save space/quota
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
      if (slotIndex < 0 || slotIndex >= 100) return;
      const newBank = [...this.state.userBank];
      newBank[slotIndex] = { ...preset, category: 'User' };
      
      this.state = { ...this.state, userBank: newBank };
      localStorage.setItem(USER_BANK_KEY, JSON.stringify(newBank));
      this.notify();
  };

  setLayout = (layout: StoredLayout | null) => {
      this.state = { ...this.state, layout };
      // Do not save to localStorage
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

export function useStore() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return {
    settings: state.settings,
    presets: state.presets, 
    userBank: state.userBank,
    layout: state.layout,
    updateSettings: store.updateSettings,
    setPreset: store.setPreset,
    saveUserPatch: store.saveUserPatch,
    setLayout: store.setLayout,
    exportXML: store.exportXML,
    importXML: store.importXML
  };
}
