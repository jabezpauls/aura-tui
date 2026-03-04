import { getCustomEqPresets } from './config';

export type EqPresetName = 'Flat' | 'Bass Boost' | 'Treble Boost' | 'Rock' | 'Pop' | 'Jazz' | 'Classical' | 'Vocal';

// 10-band EQ frequencies (Hz) — standard graphic equalizer bands
export const BANDS_HZ = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const BAND_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

export interface EqPreset {
  name: string;
  // 10-band gains in dB (-12 to +12, 0 = flat)
  gains: number[];
  isCustom?: boolean;
}

// Map 10 bands to 8 display bars by picking representative indices
// 31Hz, 125Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz
const DISPLAY_BAND_INDICES = [0, 2, 4, 5, 6, 7, 8, 9];

// Gain values in dB, tuned against Winamp/industry-standard presets
// Flat = no filter applied (0 across all bands, untouched audio)
export const EQ_PRESETS: EqPreset[] = [
  { name: 'Flat',         gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost',   gains: [8, 7, 5, 3, 1, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost', gains: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6] },
  { name: 'Rock',         gains: [5, 4, 2, 0, -1, 0, 2, 3, 4, 4] },
  { name: 'Pop',          gains: [0, 1, 3, 4, 3, 0, -1, 1, 2, 3] },
  { name: 'Jazz',         gains: [3, 2, 0, -1, 0, 1, 2, 2, 3, 3] },
  { name: 'Classical',    gains: [0, 0, 0, 0, 0, 0, -1, 2, 3, 4] },
  { name: 'Vocal',        gains: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
];

export const PRESET_NAMES: string[] = EQ_PRESETS.map(p => p.name);

// Get all presets: built-in + custom from config
export function getAllPresets(): EqPreset[] {
  const custom = getCustomEqPresets().map(p => ({ ...p, isCustom: true }));
  return [...EQ_PRESETS, ...custom];
}

// Get all preset names: built-in + custom
export function getAllPresetNames(): string[] {
  return getAllPresets().map(p => p.name);
}

// Find a preset by name (searches built-in first, then custom)
export function findPreset(name: string): EqPreset | undefined {
  return getAllPresets().find(p => p.name === name);
}

// Build MPV af filter string from gains array
export function buildAfStringFromGains(gains: number[]): string {
  const filters = gains
    .map((gain, i) => {
      if (gain === 0) return null;
      const freq = BANDS_HZ[i];
      return `equalizer=f=${freq}:t=o:w=1:g=${gain}`;
    })
    .filter(Boolean)
    .join(',');

  if (!filters) return '';
  return `lavfi=[${filters}]`;
}

// Build MPV af filter string using FFmpeg's parametric equalizer
// Chains individual band filters for clean audio quality
export function buildAfString(preset: EqPreset): string {
  const filters = preset.gains
    .map((gain, i) => {
      if (gain === 0) return null; // skip flat bands
      const freq = BANDS_HZ[i];
      // width_type=o means octave bandwidth, width=1 = 1 octave
      return `equalizer=f=${freq}:t=o:w=1:g=${gain}`;
    })
    .filter(Boolean)
    .join(',');

  if (!filters) return ''; // all flat = no filter needed
  return `lavfi=[${filters}]`;
}

// Get the 8 display bar heights (scaled 1-7 for the Equalizer component)
export function getDisplayBars(preset: EqPreset): number[] {
  return DISPLAY_BAND_INDICES.map(idx => {
    const gain = preset.gains[idx];
    // Map dB range (-12..+12) to bar height (1..7), with 0dB = 4
    return Math.max(1, Math.min(7, Math.round(gain * 0.4 + 4)));
  });
}
