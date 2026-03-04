import Conf from 'conf';

export interface HistoryEntry {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  thumbnail?: string;
}

export interface CustomEqPreset {
  name: string;
  gains: number[];
}

export interface ConfigSchema {
  adBlock: boolean;
  setupCompleted: boolean;
  playHistory: HistoryEntry[];
  activeEqPreset: string;
  customEqPresets: CustomEqPreset[];
}

const defaultConfig: ConfigSchema = {
  adBlock: true,
  setupCompleted: false,
  playHistory: [],
  activeEqPreset: 'Flat',
  customEqPresets: [],
};

const config = new Conf<ConfigSchema>({
  projectName: 'aura-tui',
  defaults: defaultConfig
});

export const getConfig = (): ConfigSchema => config.store;
export const setConfig = (key: keyof ConfigSchema, value: any) => config.set(key, value);

// Persistent play history
export const getPlayHistory = (): HistoryEntry[] => config.get('playHistory') || [];
export const savePlayHistory = (history: HistoryEntry[]) => {
  // Keep only last 50 entries
  const trimmed = history.slice(-50);
  config.set('playHistory', trimmed);
};

export const isFirstRun = (): boolean => {
  return !config.get('setupCompleted');
};

export const markSetupCompleted = () => config.set('setupCompleted', true);

export const getActiveEqPreset = (): string => config.get('activeEqPreset') || 'Flat';
export const saveActiveEqPreset = (preset: string) => config.set('activeEqPreset', preset);

export const getCustomEqPresets = (): CustomEqPreset[] => config.get('customEqPresets') || [];
export const saveCustomEqPresets = (presets: CustomEqPreset[]) => config.set('customEqPresets', presets);

export default config;
