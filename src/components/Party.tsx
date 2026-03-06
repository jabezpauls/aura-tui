import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useStore } from '../store/state';
import { partyService } from '../services/party';
import { getPartyUsername, setPartyUsername, getPartyServerUrl, setPartyServerUrl } from '../utils/config';
import { theme } from '../utils/theme';
import { getScrollWindow } from '../utils/scrollWindow';
import type { RoomInfo, ServerMessage } from '../types/party';

type ViewMode = 'main' | 'profile' | 'create' | 'browse' | 'join' | 'room' | 'settings';

export const Party: React.FC = () => {
  const { setInputFocused, setError, party, setPartyState, currentSong, isPlaying, currentTime } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [username, setUsername] = useState(getPartyUsername() || '');
  const [serverUrl, setServerUrlState] = useState(getPartyServerUrl());

  // Create form state
  const [partyName, setPartyName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [createStep, setCreateStep] = useState<'name' | 'type' | 'password'>('name');

  // Browse state
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [browseIndex, setBrowseIndex] = useState(0);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Join state
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinStep, setJoinStep] = useState<'code' | 'password'>('code');

  // Main menu state
  const [menuIndex, setMenuIndex] = useState(0);
  const menuItems = ['Create Party', 'Browse Parties', 'Join by Code', 'Settings'];

  // Settings state
  const [settingsFocus, setSettingsFocus] = useState<'username' | 'server'>('username');

  // Loading/connecting state
  const [connecting, setConnecting] = useState(false);

  // Navigate to profile if no username set when trying to create/join/browse
  const ensureUsername = useCallback(() => {
    if (!getPartyUsername()) {
      setViewMode('profile');
      return false;
    }
    return true;
  }, []);

  // Connect to server helper
  const connectToServer = useCallback(async () => {
    if (partyService.isConnected) return true;
    setConnecting(true);
    try {
      await partyService.connect();
      setConnecting(false);
      return true;
    } catch (err) {
      setConnecting(false);
      setError('Failed to connect to party server');
      return false;
    }
  }, [setError]);

  // Subscribe to party events
  useEffect(() => {
    const unsub = partyService.subscribe((msg: ServerMessage) => {
      switch (msg.type) {
        case 'user_joined':
          if (party) {
            setPartyState({ ...party, users: [...party.users, msg.username] });
          }
          break;
        case 'user_left':
          if (party) {
            setPartyState({ ...party, users: party.users.filter(u => u !== msg.username) });
          }
          break;
        case 'room_closed':
          setPartyState(null);
          partyService.disconnect();
          setViewMode('main');
          setError(msg.reason || 'Party ended');
          break;
        case 'error':
          setError(msg.message);
          break;
      }
    });
    return unsub;
  }, [party, setPartyState, setError]);

  // Handle room view (already in party)
  useEffect(() => {
    if (party?.isInParty) {
      setViewMode('room');
    }
  }, []);

  useInput((input, key) => {
    if (viewMode === 'main') {
      if (key.upArrow) setMenuIndex(i => Math.max(0, i - 1));
      if (key.downArrow) setMenuIndex(i => Math.min(menuItems.length - 1, i + 1));
      if (key.return) {
        switch (menuIndex) {
          case 0: // Create
            if (ensureUsername()) {
              setCreateStep('name');
              setPartyName('');
              setPassword('');
              setIsPublic(true);
              setViewMode('create');
              setInputFocused(true);
            } else {
              setInputFocused(true);
            }
            break;
          case 1: // Browse
            if (ensureUsername()) {
              setViewMode('browse');
              fetchRooms();
            } else {
              setInputFocused(true);
            }
            break;
          case 2: // Join
            if (ensureUsername()) {
              setJoinCode('');
              setJoinPassword('');
              setJoinStep('code');
              setViewMode('join');
              setInputFocused(true);
            } else {
              setInputFocused(true);
            }
            break;
          case 3: // Settings
            setViewMode('settings');
            setInputFocused(true);
            break;
        }
      }
      if (key.escape) {
        useStore.getState().setView('home');
      }
      return;
    }

    if (viewMode === 'profile') {
      if (key.escape) {
        setInputFocused(false);
        setViewMode('main');
      }
      return;
    }

    if (viewMode === 'settings') {
      if (key.escape) {
        setInputFocused(false);
        setViewMode('main');
      }
      if (key.tab) {
        setSettingsFocus(f => f === 'username' ? 'server' : 'username');
      }
      return;
    }

    if (viewMode === 'create') {
      if (key.escape) {
        setInputFocused(false);
        setViewMode('main');
      }
      if (createStep === 'type') {
        if (key.tab || key.leftArrow || key.rightArrow) {
          setIsPublic(!isPublic);
        }
        if (key.return) {
          if (!isPublic) {
            setCreateStep('password');
          } else {
            handleCreate();
          }
        }
      }
      return;
    }

    if (viewMode === 'browse') {
      if (key.escape) {
        setViewMode('main');
      }
      if (key.upArrow) setBrowseIndex(i => Math.max(0, i - 1));
      if (key.downArrow) setBrowseIndex(i => Math.min(rooms.length - 1, i + 1));
      if (input === 'r') fetchRooms();
      if (key.return && rooms.length > 0) {
        const room = rooms[browseIndex];
        if (room) {
          if (room.hasPassword) {
            setJoinCode(room.code);
            setJoinStep('password');
            setJoinPassword('');
            setViewMode('join');
            setInputFocused(true);
          } else {
            handleJoin(room.code);
          }
        }
      }
      return;
    }

    if (viewMode === 'join') {
      if (key.escape) {
        setInputFocused(false);
        setViewMode('main');
      }
      return;
    }

    if (viewMode === 'room') {
      if (key.escape) {
        handleLeave();
      }
      return;
    }
  });

  const fetchRooms = async () => {
    setLoadingRooms(true);
    const connected = await connectToServer();
    if (!connected) { setLoadingRooms(false); return; }
    try {
      const list = await partyService.listRooms();
      setRooms(list);
      setBrowseIndex(0);
    } catch {
      setError('Failed to fetch rooms');
    }
    setLoadingRooms(false);
  };

  const handleCreate = async () => {
    const connected = await connectToServer();
    if (!connected) return;
    setConnecting(true);
    try {
      const un = getPartyUsername() || username;
      const roomCode = await partyService.createRoom(un, partyName, isPublic, !isPublic ? password : undefined);
      setPartyState({
        isInParty: true,
        isHost: true,
        roomCode,
        partyName,
        username: un,
        users: [un],
        connected: true,
        connecting: false,
      });
      // Start heartbeat
      partyService.startHeartbeat(() => ({
        position: useStore.getState().currentTime,
        songId: useStore.getState().currentSong?.id || null,
        playing: useStore.getState().isPlaying,
      }));
      setInputFocused(false);
      setViewMode('room');
    } catch (err: any) {
      setError(err.message || 'Failed to create party');
    }
    setConnecting(false);
  };

  const handleJoin = async (code?: string) => {
    const roomCode = code || joinCode.toUpperCase();
    if (!roomCode) return;
    const connected = await connectToServer();
    if (!connected) return;
    setConnecting(true);
    try {
      const un = getPartyUsername() || username;
      const result = await partyService.joinRoom(roomCode, un, joinPassword || undefined);
      setPartyState({
        isInParty: true,
        isHost: false,
        roomCode: result.roomCode,
        partyName: result.partyName,
        username: un,
        users: result.users,
        connected: true,
        connecting: false,
      });
      // If there's a current song playing, sync to it
      if (result.currentState.song && result.currentState.playing) {
        partyService._partySync = true;
        await useStore.getState().joinPartyPlayback(result.currentState.song, result.currentState.position);
        partyService._partySync = false;
      }
      setInputFocused(false);
      setViewMode('room');
    } catch (err: any) {
      setError(err.message || 'Failed to join party');
    }
    setConnecting(false);
  };

  const handleLeave = () => {
    partyService.leaveRoom();
    partyService.disconnect();
    setPartyState(null);
    setViewMode('main');
  };

  const handleProfileSubmit = (value: string) => {
    if (value.trim()) {
      setPartyUsername(value.trim());
      setUsername(value.trim());
      setInputFocused(false);
      setViewMode('main');
    }
  };

  // Render based on viewMode
  if (viewMode === 'profile') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.primary}>Set Username</Text>
        <Text color={theme.muted}>{' '}</Text>
        <Box>
          <Text color={theme.text}>Username: </Text>
          <TextInput
            value={username}
            onChange={setUsername}
            onSubmit={handleProfileSubmit}
            focus={true}
          />
        </Box>
        <Text color={theme.muted}>{' '}</Text>
        <Text color={theme.dim}>Press Enter to save, Esc to go back</Text>
      </Box>
    );
  }

  if (viewMode === 'settings') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.primary}>Party Settings</Text>
        <Text color={theme.muted}>{' '}</Text>
        <Box>
          <Text color={settingsFocus === 'username' ? theme.active : theme.text}>Username: </Text>
          {settingsFocus === 'username' ? (
            <TextInput
              value={username}
              onChange={setUsername}
              onSubmit={(val) => {
                if (val.trim()) {
                  setPartyUsername(val.trim());
                  setUsername(val.trim());
                }
              }}
              focus={true}
            />
          ) : (
            <Text color={theme.text}>{username || '(not set)'}</Text>
          )}
        </Box>
        <Box>
          <Text color={settingsFocus === 'server' ? theme.active : theme.text}>Server: </Text>
          {settingsFocus === 'server' ? (
            <TextInput
              value={serverUrl}
              onChange={setServerUrlState}
              onSubmit={(val) => {
                if (val.trim()) {
                  setPartyServerUrl(val.trim());
                  setServerUrlState(val.trim());
                }
              }}
              focus={true}
            />
          ) : (
            <Text color={theme.text}>{serverUrl}</Text>
          )}
        </Box>
        <Text color={theme.muted}>{' '}</Text>
        <Text color={theme.dim}>Tab to switch fields, Esc to go back</Text>
      </Box>
    );
  }

  if (viewMode === 'create') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.primary}>Create Party</Text>
        <Text color={theme.muted}>{' '}</Text>
        {createStep === 'name' && (
          <Box>
            <Text color={theme.text}>Party Name: </Text>
            <TextInput
              value={partyName}
              onChange={setPartyName}
              onSubmit={(val) => {
                if (val.trim()) {
                  setPartyName(val.trim());
                  setCreateStep('type');
                  setInputFocused(false);
                }
              }}
              focus={true}
            />
          </Box>
        )}
        {createStep === 'type' && (
          <Box flexDirection="column">
            <Text color={theme.text}>Party Name: {partyName}</Text>
            <Box>
              <Text color={theme.text}>Type: </Text>
              <Text color={isPublic ? theme.active : theme.muted} bold={isPublic}>[Public]</Text>
              <Text color={theme.text}> / </Text>
              <Text color={!isPublic ? theme.active : theme.muted} bold={!isPublic}>[Private]</Text>
            </Box>
            <Text color={theme.dim}>Tab to toggle, Enter to continue</Text>
          </Box>
        )}
        {createStep === 'password' && (
          <Box flexDirection="column">
            <Text color={theme.text}>Party Name: {partyName}</Text>
            <Text color={theme.text}>Type: Private</Text>
            <Box>
              <Text color={theme.text}>Password: </Text>
              <TextInput
                value={password}
                onChange={setPassword}
                onSubmit={() => handleCreate()}
                focus={true}
              />
            </Box>
          </Box>
        )}
        {connecting && <Text color={theme.warning}>Connecting...</Text>}
        <Text color={theme.muted}>{' '}</Text>
        <Text color={theme.dim}>Esc to cancel</Text>
      </Box>
    );
  }

  if (viewMode === 'browse') {
    const { start, end } = getScrollWindow(browseIndex, rooms.length);
    const visibleRooms = rooms.slice(start, end);

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.primary}>Browse Parties</Text>
        <Text color={theme.muted}>{' '}</Text>
        {loadingRooms && <Text color={theme.warning}>Loading...</Text>}
        {!loadingRooms && rooms.length === 0 && (
          <Text color={theme.muted}>No public parties found. Press R to refresh.</Text>
        )}
        {rooms.length > 0 && (
          <>
            <Box>
              <Text color={theme.dim}>{'  '}
                {'Name'.padEnd(20)}{'Host'.padEnd(12)}{'Users'.padEnd(8)}{'Now Playing'}
              </Text>
            </Box>
            {visibleRooms.map((room, i) => {
              const actualIndex = start + i;
              const selected = actualIndex === browseIndex;
              return (
                <Box key={room.code}>
                  <Text color={selected ? theme.active : theme.text}>
                    {selected ? '> ' : '  '}
                    {room.name.slice(0, 18).padEnd(20)}
                    {room.host.slice(0, 10).padEnd(12)}
                    {String(room.userCount).padEnd(8)}
                    {room.currentSong?.title?.slice(0, 25) || '-'}
                    {room.hasPassword ? ' 🔒' : ''}
                  </Text>
                </Box>
              );
            })}
          </>
        )}
        <Text color={theme.muted}>{' '}</Text>
        <Text color={theme.dim}>[Enter] Join  [R] Refresh  [Esc] Back</Text>
      </Box>
    );
  }

  if (viewMode === 'join') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.primary}>Join Party</Text>
        <Text color={theme.muted}>{' '}</Text>
        {joinStep === 'code' && (
          <Box>
            <Text color={theme.text}>Room Code: </Text>
            <TextInput
              value={joinCode}
              onChange={setJoinCode}
              onSubmit={(val) => {
                if (val.trim()) {
                  setJoinCode(val.trim().toUpperCase());
                  handleJoin(val.trim().toUpperCase());
                }
              }}
              focus={true}
            />
          </Box>
        )}
        {joinStep === 'password' && (
          <Box flexDirection="column">
            <Text color={theme.text}>Room Code: {joinCode}</Text>
            <Box>
              <Text color={theme.text}>Password: </Text>
              <TextInput
                value={joinPassword}
                onChange={setJoinPassword}
                onSubmit={() => handleJoin()}
                focus={true}
              />
            </Box>
          </Box>
        )}
        {connecting && <Text color={theme.warning}>Connecting...</Text>}
        <Text color={theme.muted}>{' '}</Text>
        <Text color={theme.dim}>Esc to cancel</Text>
      </Box>
    );
  }

  if (viewMode === 'room' && party) {
    const formatTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.primary}>
          Party: {party.partyName || 'Unnamed'} ({party.roomCode})
        </Text>
        <Text color={theme.muted}>{' '}</Text>
        <Text color={theme.secondary}>DJ: {party.users[0] || 'Unknown'}</Text>
        <Text color={theme.muted}>{' '}</Text>
        <Text bold color={theme.text}>Connected Users:</Text>
        {party.users.map((user, i) => (
          <Text key={user} color={theme.text}>
            {'  '}{user}
            {i === 0 ? ' (DJ)' : ''}
            {user === party.username ? ' (you)' : ''}
          </Text>
        ))}
        <Text color={theme.muted}>{' '}</Text>
        {currentSong ? (
          <>
            <Text color={theme.text}>
              Now Playing: {currentSong.title} - {currentSong.artist}
            </Text>
            <Text color={theme.dim}>
              {formatTime(currentTime)} / {formatTime(currentSong.duration)}
              {isPlaying ? ' ▶' : ' ⏸'}
            </Text>
          </>
        ) : (
          <Text color={theme.muted}>No song playing</Text>
        )}
        <Text color={theme.muted}>{' '}</Text>
        {party.isHost ? (
          <Text color={theme.dim}>You are the DJ. Play music normally — guests will sync.</Text>
        ) : (
          <Text color={theme.dim}>Synced to DJ. Playback controls are locked.</Text>
        )}
        <Text color={theme.muted}>{' '}</Text>
        <Text color={theme.dim}>[Esc] Leave Party</Text>
      </Box>
    );
  }

  // Main menu
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>Listen Party</Text>
      <Text color={theme.muted}>{' '}</Text>
      {menuItems.map((item, i) => (
        <Text key={item} color={i === menuIndex ? theme.active : theme.text}>
          {i === menuIndex ? '> ' : '  '}{item}
        </Text>
      ))}
      <Text color={theme.muted}>{' '}</Text>
      <Text color={theme.text}>
        Username: {getPartyUsername() || <Text color={theme.warning}>(not set)</Text>}
      </Text>
      <Text color={theme.muted}>{' '}</Text>
      <Text color={theme.dim}>[Esc] Back</Text>
    </Box>
  );
};
