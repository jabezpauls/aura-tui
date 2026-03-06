# AuraTUI

A terminal-based YouTube Music player. Search, stream, queue, and enjoy music — right from your terminal.

![License](https://img.shields.io/badge/license-MIT-purple)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

## Features

- **Search & Stream** — Search YouTube and stream audio instantly
- **Queue Management** — Add, remove, reorder, shuffle, repeat
- **Synced Lyrics** — Real-time synced lyrics with teleprompter display
- **Playlists** — Create, edit, import YouTube playlists
- **10-Band Equalizer** — 8 built-in presets + custom EQ with visual editor
- **Listen Party** — Sync playback with friends over WebSocket (host as DJ)
- **Radio Mode** — YouTube Mix for endless playback
- **Ad Blocking** — Heuristic ad detection and skipping
- **Keyboard-Driven** — Full control without leaving the terminal

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/JibinES/aura-tui/main/install.sh | bash
```

This installs all prerequisites (mpv, yt-dlp, curl) and AuraTUI itself.

## Manual Install

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [mpv](https://mpv.io/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [curl](https://curl.se/)

**macOS:**
```bash
brew install mpv yt-dlp curl
```

**Debian/Ubuntu:**
```bash
sudo apt install mpv curl
pip install yt-dlp
```

**Arch:**
```bash
sudo pacman -S mpv yt-dlp curl
```

### Install AuraTUI

```bash
npm install -g aura-tui
```

## Usage

```bash
aura
```

## Keyboard Shortcuts

### Navigation

| Key | Action |
|-----|--------|
| `1` | Home |
| `2` `/` | Search |
| `3` | Queue |
| `4` | Playlists |
| `5` | EQ Editor |
| `6` | Listen Party |
| `Y` | Lyrics |
| `?` | Help |
| `Esc` | Go Back |
| `Ctrl+Q` | Quit |

### Playback

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `N` | Next Track |
| `P` | Previous Track |
| `+` / `-` | Volume Up / Down |
| `,` / `.` | Seek ±5s |
| `L` | Cycle Repeat (Off → All → One) |
| `E` | Cycle EQ Preset |

### Search

| Key | Action |
|-----|--------|
| `Enter` | Search / Play selected |
| `Tab` | Exit search input |
| `A` | Add to Queue |
| `P` | Add to Playlist |

### Queue

| Key | Action |
|-----|--------|
| `Enter` | Play selected song |
| `Tab` / `H` | Switch Queue / History |
| `K` / `J` | Move item Up / Down |
| `X` | Remove from queue |

### Playlists

| Key | Action |
|-----|--------|
| `N` | New Playlist |
| `I` | Import YouTube Playlist |
| `P` | Play All |
| `S` | Shuffle Play |
| `R` | Autoplay / Radio |
| `D` | Delete Playlist |

## Equalizer

AuraTUI has a built-in 10-band equalizer with a visual editor.

### Built-in Presets

| Preset | Style |
|--------|-------|
| Flat | Neutral — no EQ |
| Bass Boost | Heavy low-end |
| Treble Boost | Bright highs |
| Rock | Scooped mids, boosted lows & highs |
| Pop | Vocal-forward with warmth |
| Jazz | Smooth mids and airy highs |
| Classical | Natural, wide dynamic range |
| Vocal | Midrange emphasis for vocals |

### EQ Editor Keys

| Key | Action |
|-----|--------|
| `E` | Edit current preset |
| `N` | New custom preset |
| `←` / `→` | Select frequency band |
| `↑` / `↓` | Adjust gain (±1 dB) |
| `S` | Save custom preset |
| `R` | Reset to flat |
| `D` | Delete custom preset |

Press `E` anywhere to cycle through presets quickly. The EQ visualizer in the player bar reflects the active preset in real-time.

## Listen Party

Listen to the same music with friends in real-time. The host acts as DJ — only they control playback. Each client streams audio from YouTube independently; only metadata is synced over WebSocket.

### How it works

1. Press `6` to open the Party menu
2. Set a username (persists across sessions)
3. **Create** a party (public or private with password) — you become the DJ
4. Share the 4-character room code with friends
5. Friends press `6` → **Join by Code** or **Browse Parties** (public only)
6. Play music normally — guests auto-sync to your playback

### Party Features

- **Public Parties** — Listed in Browse, anyone can join
- **Private Parties** — Require room code + password
- **DJ Mode** — Only the host controls play/pause/seek/skip
- **Guest Lockout** — Playback keys are disabled for guests
- **Auto-Sync** — Heartbeat every 5s corrects drift > 2 seconds
- **Live User List** — See who's connected in the room view

### Party Keys

| Key | Action |
|-----|--------|
| `Enter` | Select / Join |
| `↑` / `↓` | Navigate menu |
| `Tab` | Toggle public/private |
| `R` | Refresh party list |
| `Esc` | Leave party / Go back |

### Self-Hosting the Relay Server

The relay server is in `server/`. It only forwards JSON metadata (~100 bytes per message) — no audio is relayed.

```bash
cd server
docker compose up -d
```

Then point clients to your server in Party → Settings → Server URL.

## Authors

- **Jacob Ashirwad** — [github.com/irl-jacob](https://github.com/irl-jacob)
- **Jibin ES** — [github.com/JibinES](https://github.com/JibinES)
- **Jabez Paul** — [github.com/jabezpauls](https://github.com/jabezpauls)

## License

MIT
