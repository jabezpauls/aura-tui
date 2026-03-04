import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useStore } from '../store/state';
import { theme } from '../utils/theme';
import { BAND_LABELS, EQ_PRESETS, getAllPresets, getDisplayBars, type EqPreset } from '../utils/eqPresets';
import { getCustomEqPresets, saveCustomEqPresets } from '../utils/config';

type Mode = 'browse' | 'edit' | 'save';

const MIN_GAIN = -12;
const MAX_GAIN = 12;
const BAR_HEIGHT = 12; // visual rows for the band bars

const EqEditor = () => {
  const { activeEqPreset, applyEqPreset, applyCustomGains, setView } = useStore();

  const [mode, setMode] = useState<Mode>('browse');
  const [presets, setPresets] = useState<EqPreset[]>(getAllPresets());
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [selectedBandIndex, setSelectedBandIndex] = useState(0);
  const [editingGains, setEditingGains] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [saveName, setSaveName] = useState('');
  const [basePresetName, setBasePresetName] = useState('');

  // Sync selected index to active preset on mount
  useEffect(() => {
    const allPresets = getAllPresets();
    setPresets(allPresets);
    const idx = allPresets.findIndex(p => p.name === activeEqPreset);
    if (idx >= 0) setSelectedPresetIndex(idx);
  }, []);

  const refreshPresets = () => {
    const allPresets = getAllPresets();
    setPresets(allPresets);
  };

  const selectedPreset = presets[selectedPresetIndex];

  useInput((input, key) => {
    if (mode === 'save') {
      if (key.escape) {
        setMode('edit');
        setSaveName('');
      }
      return; // TextInput handles the rest
    }

    if (mode === 'browse') {
      if (key.upArrow) {
        setSelectedPresetIndex(prev => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
        setSelectedPresetIndex(prev => Math.min(presets.length - 1, prev + 1));
      }
      if (key.return && selectedPreset) {
        applyEqPreset(selectedPreset.name);
      }
      if (input === 'e' && selectedPreset) {
        setEditingGains([...selectedPreset.gains]);
        setBasePresetName(selectedPreset.name);
        setSelectedBandIndex(0);
        setMode('edit');
        // Apply live preview
        applyCustomGains(selectedPreset.gains);
      }
      if (input === 'n') {
        // Create new preset from flat
        setEditingGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        setBasePresetName('Flat');
        setSelectedBandIndex(0);
        setMode('edit');
        applyCustomGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      }
      if (input === 'd' && selectedPreset?.isCustom) {
        const custom = getCustomEqPresets().filter(p => p.name !== selectedPreset.name);
        saveCustomEqPresets(custom);
        refreshPresets();
        // If we deleted the active preset, revert to Flat
        if (activeEqPreset === selectedPreset.name) {
          applyEqPreset('Flat');
        }
        setSelectedPresetIndex(prev => Math.min(prev, presets.length - 2));
      }
      if (key.escape) {
        setView('home');
      }
      return;
    }

    if (mode === 'edit') {
      if (key.leftArrow) {
        setSelectedBandIndex(prev => Math.max(0, prev - 1));
      }
      if (key.rightArrow) {
        setSelectedBandIndex(prev => Math.min(9, prev + 1));
      }
      if (key.upArrow) {
        setEditingGains(prev => {
          const next = [...prev];
          next[selectedBandIndex] = Math.min(MAX_GAIN, (next[selectedBandIndex] || 0) + 1);
          applyCustomGains(next);
          return next;
        });
      }
      if (key.downArrow) {
        setEditingGains(prev => {
          const next = [...prev];
          next[selectedBandIndex] = Math.max(MIN_GAIN, (next[selectedBandIndex] || 0) - 1);
          applyCustomGains(next);
          return next;
        });
      }
      if (input === 'r') {
        // Reset to base preset
        const base = presets.find(p => p.name === basePresetName);
        if (base) {
          setEditingGains([...base.gains]);
          applyCustomGains(base.gains);
        }
      }
      if (input === 's') {
        setSaveName('');
        setMode('save');
        useStore.getState().setInputFocused(true);
      }
      if (key.escape) {
        // Revert to the active preset
        const active = presets.find(p => p.name === activeEqPreset);
        if (active) {
          applyEqPreset(active.name);
        }
        setMode('browse');
      }
      return;
    }
  });

  const handleSave = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setMode('edit');
      useStore.getState().setInputFocused(false);
      return;
    }

    // Save as custom preset
    const custom = getCustomEqPresets();
    const existing = custom.findIndex(p => p.name === trimmed);
    if (existing >= 0) {
      custom[existing] = { name: trimmed, gains: [...editingGains] };
    } else {
      custom.push({ name: trimmed, gains: [...editingGains] });
    }
    saveCustomEqPresets(custom);
    refreshPresets();

    // Apply it as active
    applyEqPreset(trimmed);

    // Update selected index to the new preset
    const allPresets = getAllPresets();
    const newIdx = allPresets.findIndex(p => p.name === trimmed);
    if (newIdx >= 0) setSelectedPresetIndex(newIdx);

    useStore.getState().setInputFocused(false);
    setSaveName('');
    setMode('browse');
  };

  // Render the 10-band vertical bar visualization
  const renderBands = (gains: number[], highlightIndex?: number) => {
    const lines: string[] = [];

    // Render from top (+12) to bottom (-12)
    for (let row = MAX_GAIN; row >= MIN_GAIN; row--) {
      let line = '';
      for (let col = 0; col < 10; col++) {
        const gain = gains[col] || 0;
        const isSelected = col === highlightIndex;
        let char = '  ';

        if (row === 0) {
          // Zero line
          char = '──';
        } else if (row > 0 && gain >= row) {
          char = '██';
        } else if (row < 0 && gain <= row) {
          char = '██';
        }

        line += char + ' ';
      }

      // Row label on the right
      const label = row === MAX_GAIN ? `+${row}` : row === 0 ? ' 0' : row === MIN_GAIN ? `${row}` : '';
      lines.push({ line, row, label });
    }

    return lines;
  };

  const bandLines = mode === 'edit'
    ? renderBands(editingGains, selectedBandIndex)
    : renderBands(selectedPreset?.gains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.secondary}>Equalizer Editor</Text>
        <Text color={theme.dim}> | </Text>
        <Text color={theme.muted}>
          {mode === 'browse' ? 'Browse Presets' : mode === 'edit' ? 'Editing' : 'Save Preset'}
        </Text>
      </Box>

      <Box flexDirection="row" gap={2}>
        {/* Left panel: Preset list */}
        <Box flexDirection="column" width={20}>
          <Text bold color={theme.primary}>Presets</Text>
          <Box flexDirection="column" marginTop={1}>
            {presets.map((preset, i) => {
              const isSelected = i === selectedPresetIndex;
              const isActive = preset.name === activeEqPreset;
              return (
                <Text key={preset.name} color={isSelected ? theme.active : isActive ? theme.secondary : theme.muted}>
                  {isSelected ? '> ' : '  '}
                  {preset.name}
                  {isActive ? ' *' : ''}
                  {preset.isCustom ? ' ~' : ''}
                </Text>
              );
            })}
          </Box>

          {mode === 'browse' && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.dim}>Enter  Apply</Text>
              <Text color={theme.dim}>E      Edit</Text>
              <Text color={theme.dim}>N      New</Text>
              {selectedPreset?.isCustom && <Text color={theme.dim}>D      Delete</Text>}
              <Text color={theme.dim}>Esc    Back</Text>
            </Box>
          )}
        </Box>

        {/* Right panel: Band visualization */}
        <Box flexDirection="column">
          {/* Frequency labels */}
          <Box>
            <Text color={theme.dim}>  </Text>
            {BAND_LABELS.map((label, i) => (
              <Text
                key={label}
                color={mode === 'edit' && i === selectedBandIndex ? theme.active : theme.muted}
              >
                {label.padStart(3).padEnd(4)}
              </Text>
            ))}
          </Box>

          {/* Bars */}
          <Box flexDirection="column">
            {bandLines.map((item: any, rowIdx: number) => (
              <Text key={rowIdx}>
                {item.line.split('').map((char: string, charIdx: number) => {
                  // Figure out which band this character belongs to
                  const bandIdx = Math.floor(charIdx / 3);
                  const isSelectedBand = mode === 'edit' && bandIdx === selectedBandIndex;

                  if (char === '█') {
                    return (
                      <Text key={charIdx} color={isSelectedBand ? theme.active : item.row > 0 ? theme.primary : theme.accent}>
                        {char}
                      </Text>
                    );
                  }
                  if (char === '─') {
                    return <Text key={charIdx} color={theme.dim}>{char}</Text>;
                  }
                  return <Text key={charIdx}>{char}</Text>;
                })}
                {item.label && <Text color={theme.dim}> {item.label}</Text>}
              </Text>
            ))}
          </Box>

          {/* Gain values row */}
          <Box marginTop={0}>
            <Text color={theme.dim}>  </Text>
            {(mode === 'edit' ? editingGains : (selectedPreset?.gains || [])).map((g: number, i: number) => {
              const label = g > 0 ? `+${g}` : `${g}`;
              return (
                <Text
                  key={i}
                  color={mode === 'edit' && i === selectedBandIndex ? theme.active : theme.muted}
                >
                  {label.padStart(3).padEnd(4)}
                </Text>
              );
            })}
            <Text color={theme.dim}> dB</Text>
          </Box>

          {/* Edit mode controls */}
          {mode === 'edit' && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.text}>
                <Text color={theme.active}>{'<'}/{'>'}</Text> Band  <Text color={theme.active}>Up/Down</Text> Gain  <Text color={theme.active}>S</Text> Save  <Text color={theme.active}>R</Text> Reset  <Text color={theme.active}>Esc</Text> Cancel
              </Text>
            </Box>
          )}

          {/* Save mode */}
          {mode === 'save' && (
            <Box marginTop={1}>
              <Text color={theme.text}>Name: </Text>
              <TextInput
                value={saveName}
                onChange={setSaveName}
                onSubmit={handleSave}
                placeholder="Enter preset name..."
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default EqEditor;
