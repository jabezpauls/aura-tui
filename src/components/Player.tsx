import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../store/state';
import { theme } from '../utils/theme';

// Loading spinner animation
const LoadingSpinner = () => {
  const [frame, setFrame] = useState(0);
  const [pulsePos, setPulsePos] = useState(0);
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const barWidth = 40;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % spinnerFrames.length);
      setPulsePos(prev => (prev + 1) % (barWidth * 2));
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // Animated pulsing loading bar that bounces left and right
  const effectivePos = pulsePos < barWidth ? pulsePos : (barWidth * 2) - pulsePos - 1;
  const loadingBar = Array.from({ length: barWidth }, (_, i) => {
    const dist = Math.abs(i - effectivePos);
    if (dist === 0) return '█';
    if (dist === 1) return '▓';
    if (dist === 2) return '▒';
    if (dist === 3) return '░';
    return '·';
  }).join('');

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.secondary}>{spinnerFrames[frame]} </Text>
        <Text color={theme.accent}>{loadingBar}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.secondary}>Loading song... please wait</Text>
      </Box>
    </Box>
  );
};

// Equalizer component with preset-aware animation
const Equalizer = ({ isPlaying }: { isPlaying: boolean }) => {
  const { activeEqPreset, eqDisplayBars } = useStore();
  const [bars, setBars] = useState(eqDisplayBars);
  const maxHeight = 7;

  useEffect(() => {
    if (!isPlaying) {
      // When paused, show the preset shape at reduced height
      setBars(eqDisplayBars.map(b => Math.max(1, Math.floor(b * 0.5))));
      return;
    }

    // When playing, animate with subtle jitter around the preset shape
    const interval = setInterval(() => {
      setBars(eqDisplayBars.map(base => {
        const jitter = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
        return Math.max(1, Math.min(maxHeight, base + jitter));
      }));
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, eqDisplayBars]);

  // Build equalizer bars vertically
  const renderBars = () => {
    const lines: string[] = [];
    for (let row = maxHeight; row >= 1; row--) {
      let line = '';
      for (let col = 0; col < 8; col++) {
        line += (bars[col] ?? 0) >= row ? '█' : ' ';
        line += ' ';
      }
      lines.push(line);
    }
    return lines;
  };

  const equalizerLines = renderBars();

  return (
    <Box flexDirection="column" alignItems="center" paddingX={1}>
      {equalizerLines.map((line, i) => (
        <Text key={`eq-${i}`} color={i < 2 ? '#d8b4fe' : i < 4 ? '#a855f7' : '#7c3aed'}>
          {line}
        </Text>
      ))}
      <Text color="#581c87">▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔</Text>
      <Text color={theme.secondary} dimColor>{activeEqPreset}</Text>
    </Box>
  );
};

const Player = () => {
  const { currentSong, isPlaying, isLoading, volume, currentTime, duration, shuffle, autoplay, queue, isRadioMode, repeatMode, party } = useStore();

  if (!currentSong) {
    return (
      <Box borderStyle="round" borderColor={theme.dim} padding={1} flexDirection="column">
        <Text color={theme.muted}>No music playing</Text>
        <Text color={theme.dim}>Press '/' to search or browse library</Text>
      </Box>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const progressBarWidth = 40;
  const filledWidth = duration > 0 ? Math.round((progress / 100) * progressBarWidth) : 0;
  const emptyWidth = progressBarWidth - filledWidth;
  const progressBar = duration > 0
    ? '█'.repeat(filledWidth) + '░'.repeat(emptyWidth)
    : '·'.repeat(progressBarWidth);

  return (
    <Box borderStyle="round" borderColor={isLoading ? theme.accent : theme.primary} padding={1} flexDirection="row">
      {/* Controls Section */}
      <Box flexDirection="column" flexGrow={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.secondary}>{isLoading ? 'Loading: ' : 'Now Playing: '}</Text>
          <Text color={theme.text}>{currentSong.title}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={theme.accent}>{currentSong.artist}</Text>
          <Text color={theme.muted}> - {currentSong.album || 'Unknown Album'}</Text>
        </Box>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <Box>
              <Text color={theme.text}>{formatTime(currentTime)} </Text>
              <Text color={theme.primary}>{progressBar}</Text>
              <Text color={theme.text}> {duration > 0 ? formatTime(duration) : '--:--'}</Text>
            </Box>

            <Box marginTop={1} gap={2}>
              <Text color={isPlaying ? theme.active : theme.muted}>
                {isPlaying ? '▶ Playing' : '⏸ Paused'}
              </Text>
              <Text color={theme.accent}>Vol: {volume}%</Text>
              <Text color={shuffle ? theme.active : theme.dim}>⤮ {shuffle ? 'Shuffle' : 'Order'}</Text>
              <Text color={autoplay ? theme.active : theme.dim}>↻ {autoplay ? 'Auto' : 'Manual'}</Text>
              <Text color={repeatMode !== 'off' ? theme.active : theme.dim}>
                {repeatMode === 'one' ? '🔂 One' : '🔁 ' + (repeatMode === 'all' ? 'All' : 'Off')}
              </Text>
              <Text color={theme.muted}>Queue: {queue.length}</Text>
              {isRadioMode && <Text color={theme.secondary}>📻 Radio</Text>}
              {party?.isInParty && (
                <Text color={theme.warning}>
                  {party.isHost ? '🎧 DJ Mode' : `🎧 Party: ${party.roomCode}`}
                </Text>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Equalizer Animation */}
      <Box marginLeft={2} justifyContent="center" alignItems="center">
        <Equalizer isPlaying={isPlaying && !isLoading} />
      </Box>
    </Box>
  );
};

export default Player;
