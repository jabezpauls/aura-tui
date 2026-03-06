import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';

// Types (mirrored from src/types/party.ts to keep server standalone)
interface PartySong {
  id: string;
  title: string;
  artist: string;
  duration: number;
}

interface RoomState {
  songId: string | null;
  song: PartySong | null;
  position: number;
  playing: boolean;
  queue: PartySong[];
}

interface Room {
  code: string;
  name: string;
  hostWs: WebSocket;
  hostUsername: string;
  guests: Map<WebSocket, string>;
  state: RoomState;
  isPublic: boolean;
  password?: string;
  lastActivity: number;
}

const PORT = parseInt(process.env.PORT || '8765');
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const rooms = new Map<string, Room>();
const clientRooms = new Map<WebSocket, string>(); // ws → roomCode

function generateRoomCode(): string {
  let code: string;
  do {
    code = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
  } while (rooms.has(code));
  return code;
}

function hashPassword(pw: string): string {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function broadcast(room: Room, message: object, exclude?: WebSocket) {
  const data = JSON.stringify(message);
  if (room.hostWs !== exclude && room.hostWs.readyState === WebSocket.OPEN) {
    room.hostWs.send(data);
  }
  for (const [ws] of room.guests) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function broadcastToGuests(room: Room, message: object) {
  const data = JSON.stringify(message);
  for (const [ws] of room.guests) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function getAllUsers(room: Room): string[] {
  const users = [room.hostUsername];
  for (const [, username] of room.guests) {
    users.push(username);
  }
  return users;
}

function destroyRoom(code: string, reason: string) {
  const room = rooms.get(code);
  if (!room) return;
  broadcastToGuests(room, { type: 'room_closed', reason });
  for (const [ws] of room.guests) {
    clientRooms.delete(ws);
  }
  clientRooms.delete(room.hostWs);
  rooms.delete(code);
  console.log(`Room ${code} destroyed: ${reason}`);
}

function removeClient(ws: WebSocket) {
  const roomCode = clientRooms.get(ws);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) {
    clientRooms.delete(ws);
    return;
  }

  if (ws === room.hostWs) {
    destroyRoom(roomCode, 'Host disconnected');
  } else {
    const username = room.guests.get(ws);
    room.guests.delete(ws);
    clientRooms.delete(ws);
    if (username) {
      broadcast(room, { type: 'user_left', username });
      console.log(`${username} left room ${roomCode}`);
    }
  }
}

function send(ws: WebSocket, message: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleMessage(ws: WebSocket, raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return send(ws, { type: 'error', message: 'Invalid JSON' });
  }

  switch (msg.type) {
    case 'create': {
      if (clientRooms.has(ws)) {
        return send(ws, { type: 'error', message: 'Already in a room' });
      }
      const code = generateRoomCode();
      const room: Room = {
        code,
        name: msg.partyName || 'Unnamed Party',
        hostWs: ws,
        hostUsername: msg.username || 'Anonymous',
        guests: new Map(),
        state: { songId: null, song: null, position: 0, playing: false, queue: [] },
        isPublic: msg.isPublic !== false,
        password: msg.password ? hashPassword(msg.password) : undefined,
        lastActivity: Date.now(),
      };
      rooms.set(code, room);
      clientRooms.set(ws, code);
      send(ws, { type: 'room_created', roomCode: code });
      console.log(`Room ${code} created by ${room.hostUsername} (${room.isPublic ? 'public' : 'private'})`);
      break;
    }

    case 'join': {
      if (clientRooms.has(ws)) {
        return send(ws, { type: 'error', message: 'Already in a room' });
      }
      const room = rooms.get(msg.roomCode);
      if (!room) {
        return send(ws, { type: 'error', message: 'Room not found' });
      }
      if (room.password) {
        if (!msg.password || hashPassword(msg.password) !== room.password) {
          return send(ws, { type: 'error', message: 'Incorrect password' });
        }
      }
      const username = msg.username || 'Anonymous';
      room.guests.set(ws, username);
      clientRooms.set(ws, msg.roomCode);
      room.lastActivity = Date.now();

      send(ws, {
        type: 'joined',
        roomCode: room.code,
        users: getAllUsers(room),
        currentState: room.state,
        partyName: room.name,
      });
      broadcast(room, { type: 'user_joined', username }, ws);
      console.log(`${username} joined room ${room.code}`);
      break;
    }

    case 'list_rooms': {
      const publicRooms = [];
      for (const [, room] of rooms) {
        if (room.isPublic) {
          publicRooms.push({
            code: room.code,
            name: room.name,
            host: room.hostUsername,
            userCount: 1 + room.guests.size,
            isPublic: true,
            hasPassword: !!room.password,
            currentSong: room.state.song,
          });
        }
      }
      send(ws, { type: 'room_list', rooms: publicRooms });
      break;
    }

    case 'leave': {
      removeClient(ws);
      break;
    }

    // Host-only playback commands
    case 'play':
    case 'pause':
    case 'resume':
    case 'seek':
    case 'next':
    case 'queue_update': {
      const roomCode = clientRooms.get(ws);
      if (!roomCode) return send(ws, { type: 'error', message: 'Not in a room' });
      const room = rooms.get(roomCode);
      if (!room) return;
      if (ws !== room.hostWs) return send(ws, { type: 'error', message: 'Only the DJ can control playback' });

      room.lastActivity = Date.now();

      // Update server-side state
      if (msg.type === 'play') {
        room.state.songId = msg.song.id;
        room.state.song = msg.song;
        room.state.position = msg.position || 0;
        room.state.playing = true;
        broadcastToGuests(room, { type: 'sync', action: 'play', song: msg.song, position: msg.position || 0 });
      } else if (msg.type === 'pause') {
        room.state.playing = false;
        room.state.position = msg.position || 0;
        broadcastToGuests(room, { type: 'sync', action: 'pause', position: msg.position || 0 });
      } else if (msg.type === 'resume') {
        room.state.playing = true;
        room.state.position = msg.position || 0;
        broadcastToGuests(room, { type: 'sync', action: 'resume', position: msg.position || 0 });
      } else if (msg.type === 'seek') {
        room.state.position = msg.position || 0;
        broadcastToGuests(room, { type: 'sync', action: 'seek', position: msg.position || 0 });
      } else if (msg.type === 'next') {
        room.state.songId = msg.song.id;
        room.state.song = msg.song;
        room.state.position = 0;
        room.state.playing = true;
        broadcastToGuests(room, { type: 'sync', action: 'next', song: msg.song });
      } else if (msg.type === 'queue_update') {
        room.state.queue = msg.queue || [];
        broadcastToGuests(room, { type: 'sync', action: 'queue_update', queue: msg.queue || [] });
      }
      break;
    }

    case 'heartbeat': {
      const roomCode = clientRooms.get(ws);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || ws !== room.hostWs) return;

      room.lastActivity = Date.now();
      room.state.position = msg.position || 0;
      room.state.songId = msg.songId;
      room.state.playing = msg.playing;

      broadcastToGuests(room, {
        type: 'heartbeat',
        position: msg.position || 0,
        songId: msg.songId,
        playing: msg.playing,
      });
      break;
    }

    default:
      send(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
  }
}

// Inactivity cleanup
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > INACTIVITY_TIMEOUT) {
      destroyRoom(code, 'Room timed out due to inactivity');
    }
  }
}, 60_000);

// Start server
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });

  ws.on('close', () => {
    removeClient(ws);
  });

  ws.on('error', () => {
    removeClient(ws);
  });
});

console.log(`Aura Party relay server running on port ${PORT}`);
