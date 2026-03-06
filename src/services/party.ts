import WebSocket from 'ws';
import { player } from './player.js';
import { getPartyServerUrl } from '../utils/config.js';
import type { ClientMessage, ServerMessage, PartySong, RoomInfo, RoomState } from '../types/party.js';

type PartyListener = (message: ServerMessage) => void;

class PartyService {
  private ws: WebSocket | null = null;
  private listeners: PartyListener[] = [];
  private heartbeatInterval: any = null;
  public _partySync = false; // Flag to prevent broadcast loops when guest executes received commands

  connect(serverUrl?: string): Promise<void> {
    const url = serverUrl || getPartyServerUrl();
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => resolve());

        this.ws.on('message', (data: any) => {
          try {
            const msg: ServerMessage = JSON.parse(data.toString());
            this.handleMessage(msg);
          } catch { /* ignore malformed */ }
        });

        this.ws.on('close', () => {
          this.stopHeartbeat();
          this.notifyListeners({ type: 'room_closed', reason: 'Connection lost' } as any);
          this.ws = null;
        });

        this.ws.on('error', (err: any) => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // Host methods
  createRoom(username: string, partyName: string, isPublic: boolean, password?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const handler = (msg: ServerMessage) => {
        if (msg.type === 'room_created') {
          this.removeListener(handler);
          resolve(msg.roomCode);
        } else if (msg.type === 'error') {
          this.removeListener(handler);
          reject(new Error(msg.message));
        }
      };
      this.addListener(handler);
      this.send({ type: 'create', username, partyName, isPublic, password });
    });
  }

  joinRoom(roomCode: string, username: string, password?: string): Promise<{ roomCode: string; users: string[]; currentState: RoomState; partyName: string }> {
    return new Promise((resolve, reject) => {
      const handler = (msg: ServerMessage) => {
        if (msg.type === 'joined') {
          this.removeListener(handler);
          resolve({ roomCode: msg.roomCode, users: msg.users, currentState: msg.currentState, partyName: msg.partyName });
        } else if (msg.type === 'error') {
          this.removeListener(handler);
          reject(new Error(msg.message));
        }
      };
      this.addListener(handler);
      this.send({ type: 'join', roomCode, username, password });
    });
  }

  listRooms(): Promise<RoomInfo[]> {
    return new Promise((resolve) => {
      const handler = (msg: ServerMessage) => {
        if (msg.type === 'room_list') {
          this.removeListener(handler);
          resolve(msg.rooms);
        }
      };
      this.addListener(handler);
      this.send({ type: 'list_rooms' });
    });
  }

  leaveRoom() {
    this.stopHeartbeat();
    this.send({ type: 'leave' });
  }

  // Host broadcast methods
  broadcastPlay(song: PartySong, position: number) {
    this.send({ type: 'play', song, position });
  }

  broadcastPause(position: number) {
    this.send({ type: 'pause', position });
  }

  broadcastResume(position: number) {
    this.send({ type: 'resume', position });
  }

  broadcastSeek(position: number) {
    this.send({ type: 'seek', position });
  }

  broadcastNext(song: PartySong) {
    this.send({ type: 'next', song });
  }

  broadcastQueueUpdate(queue: PartySong[]) {
    this.send({ type: 'queue_update', queue });
  }

  // Heartbeat — host sends position every 5s
  startHeartbeat(getState: () => { position: number; songId: string | null; playing: boolean }) {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      const state = getState();
      this.send({ type: 'heartbeat', position: state.position, songId: state.songId, playing: state.playing });
    }, 5000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Guest sync logic
  private handleMessage(msg: ServerMessage) {
    // Handle guest sync for playback commands
    if (msg.type === 'sync') {
      this.handleSync(msg);
    } else if (msg.type === 'heartbeat') {
      this.handleHeartbeatSync(msg);
    }

    // Notify all listeners (UI updates, etc.)
    this.notifyListeners(msg);
  }

  private handleSync(msg: Extract<ServerMessage, { type: 'sync' }>) {
    // Import store dynamically to avoid circular deps
    const { useStore } = require('../store/state.js');
    const store = useStore.getState();

    this._partySync = true;
    try {
      switch (msg.action) {
        case 'play': {
          store.joinPartyPlayback(msg.song, msg.position);
          break;
        }
        case 'pause': {
          player.pause();
          break;
        }
        case 'resume': {
          player.resume();
          break;
        }
        case 'seek': {
          player.goToPosition(msg.position);
          break;
        }
        case 'next': {
          store.joinPartyPlayback(msg.song, 0);
          break;
        }
        case 'queue_update': {
          break;
        }
      }
    } finally {
      this._partySync = false;
    }
  }

  private handleHeartbeatSync(msg: Extract<ServerMessage, { type: 'heartbeat' }>) {
    const playerState = player.getState();
    if (msg.playing && Math.abs(playerState.position - msg.position) > 2) {
      this._partySync = true;
      player.goToPosition(msg.position);
      this._partySync = false;
    }
  }

  // Event subscription
  subscribe(listener: PartyListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private addListener(listener: PartyListener) {
    this.listeners.push(listener);
  }

  private removeListener(listener: PartyListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners(msg: ServerMessage) {
    this.listeners.forEach(l => l(msg));
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const partyService = new PartyService();
