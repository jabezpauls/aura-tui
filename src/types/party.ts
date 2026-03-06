// Shared types for the Listen Party protocol

export interface PartySong {
  id: string;
  title: string;
  artist: string;
  duration: number;
}

export interface RoomState {
  songId: string | null;
  song: PartySong | null;
  position: number;
  playing: boolean;
  queue: PartySong[];
}

export interface RoomInfo {
  code: string;
  name: string;
  host: string;
  userCount: number;
  isPublic: boolean;
  hasPassword: boolean;
  currentSong?: PartySong | null;
}

// Client → Server messages
export type ClientMessage =
  | { type: 'create'; username: string; partyName: string; isPublic: boolean; password?: string }
  | { type: 'join'; roomCode: string; username: string; password?: string }
  | { type: 'list_rooms' }
  | { type: 'leave' }
  | { type: 'play'; song: PartySong; position: number }
  | { type: 'pause'; position: number }
  | { type: 'resume'; position: number }
  | { type: 'seek'; position: number }
  | { type: 'next'; song: PartySong }
  | { type: 'queue_update'; queue: PartySong[] }
  | { type: 'heartbeat'; position: number; songId: string | null; playing: boolean };

// Server → Client messages
export type ServerMessage =
  | { type: 'room_created'; roomCode: string }
  | { type: 'joined'; roomCode: string; users: string[]; currentState: RoomState; partyName: string }
  | { type: 'room_list'; rooms: RoomInfo[] }
  | { type: 'user_joined'; username: string }
  | { type: 'user_left'; username: string }
  | { type: 'sync'; action: 'play'; song: PartySong; position: number }
  | { type: 'sync'; action: 'pause'; position: number }
  | { type: 'sync'; action: 'resume'; position: number }
  | { type: 'sync'; action: 'seek'; position: number }
  | { type: 'sync'; action: 'next'; song: PartySong }
  | { type: 'sync'; action: 'queue_update'; queue: PartySong[] }
  | { type: 'heartbeat'; position: number; songId: string | null; playing: boolean }
  | { type: 'error'; message: string }
  | { type: 'room_closed'; reason: string };
