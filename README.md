# Beatly - DJ-Style Mixing with SoundCloud

A production-lean MVP web application that connects to the SoundCloud API, lets users pick a playlist, and performs DJ-style mixing with layered transitions using ML-assisted audio analysis.

## Features

### SoundCloud Integration
- OAuth login with SoundCloud
- Browse and select user playlists
- Stream tracks through secure proxy (handles CORS and auth)
- Token refresh handling

### DJ Player
- Two-deck player (Deck A and Deck B)
- Real-time audio playback using Web Audio API
- 3-band EQ per deck (Low, Mid, High)
- Crossfader with equal-power curve
- Volume controls and master output

### Automated DJ Transitions
- Beat-aligned crossfades
- Phrase-boundary detection (every 8 or 16 bars)
- Two transition styles:
  - **Smooth**: Gradual 32-bar transition with careful EQ management
  - **Hype**: Quick 16-bar transition with riser FX and dramatic bass swap
- BPM sync via time-stretching

### ML-Assisted Analysis
- BPM detection using librosa beat tracking
- Key estimation using chroma features and Camelot wheel mapping
- Energy curve analysis (RMS over time)
- Drop and peak detection
- Phrase boundary markers

### Stem Separation
- Full stem separation using Demucs (when available)
- Fallback to pseudo-stems using spectral filtering
- Four stems: drums, bass, vocals, other
- Cached results for instant replay

### Smart Track Ordering
- Mix compatibility scoring based on:
  - BPM closeness (40% weight)
  - Key compatibility using Camelot wheel (35% weight)
  - Energy flow continuity (25% weight)
- Greedy algorithm for optimal playlist order
- Detailed compatibility breakdown in UI

## Architecture

```
beatly/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── audio/     # Web Audio engine
│   │   ├── components/# React components
│   │   ├── store/     # Zustand state management
│   │   ├── types/     # TypeScript types
│   │   └── utils/     # Utilities
│   └── ...
├── backend/           # Python FastAPI
│   ├── app/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   └── config.py  # Configuration
│   └── tests/         # Backend tests
└── package.json       # Root workspace config
```

## Setup

### Prerequisites

- Node.js >= 18.0.0
- Python >= 3.10
- pnpm (recommended) or npm
- uv (recommended) or pip

### SoundCloud App Credentials

1. Go to [SoundCloud Developer Portal](https://soundcloud.com/you/apps)
2. Click "Register a new application"
3. Fill in your app details:
   - Application name: Your app name
   - Website URL: `http://localhost:5173`
   - Redirect URI: `http://localhost:5173/callback`
4. After registration, note your:
   - Client ID
   - Client Secret

### Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env and add your SoundCloud credentials
# SOUNDCLOUD_CLIENT_ID=your_client_id
# SOUNDCLOUD_CLIENT_SECRET=your_client_secret

# Install dependencies using uv (recommended)
uv sync

# Or using pip
pip install -e .

# Install stem separation support (optional, CPU-intensive)
uv sync --extra stems
# Or: pip install -e ".[stems]"
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
pnpm install
# Or: npm install
```

### Install Root Dependencies

```bash
# From project root
pnpm install
```

## Running the Application

### Development Mode (Recommended)

From the project root, run both frontend and backend concurrently:

```bash
pnpm dev
```

This starts:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

### Individual Services

```bash
# Frontend only
pnpm dev:frontend

# Backend only
pnpm dev:backend
```

## How to Use DJ Mode

1. **Connect with SoundCloud**: Click the login button and authorize with your SoundCloud account

2. **Select a Playlist**: Choose a playlist from your SoundCloud library

3. **Load Tracks**:
   - Deck A auto-loads the first track
   - Use the dropdown to load any track into either deck

4. **Analyze Tracks**: Tracks are automatically analyzed when loaded (BPM, key, energy)

5. **Enable DJ Mode**: Toggle "Auto Mixing" in the mixer controls

6. **Choose Transition Style**:
   - **Smooth**: Long, gradual blend (32 bars)
   - **Hype**: Quick, dramatic drop (16 bars)

7. **Start Transition**: Click "Start Transition" when both decks have tracks loaded

8. **Use Smart Order** (optional): Enable to reorder playlist by compatibility

## API Endpoints

### Authentication
- `GET /api/auth/soundcloud/url` - Get OAuth authorization URL
- `POST /api/auth/soundcloud/callback` - Exchange code for token
- `POST /api/auth/soundcloud/refresh` - Refresh access token
- `GET /api/auth/soundcloud/me` - Get current user info

### Playlists
- `GET /api/playlists` - Get user's playlists
- `GET /api/playlists/{id}/tracks` - Get tracks in a playlist
- `GET /api/playlists/{id}/smart-order` - Get optimized track order

### Tracks
- `GET /api/tracks/{id}/stream` - Proxy stream audio
- `POST /api/tracks/{id}/analyze` - Analyze track (BPM, key, energy)
- `GET /api/tracks/{id}/analysis` - Get cached analysis
- `POST /api/tracks/{id}/stems` - Request stem separation
- `GET /api/tracks/{id}/stems/status` - Get stem separation status
- `GET /api/tracks/{id}/stems/{name}` - Stream a stem
- `GET /api/tracks/compatibility` - Calculate compatibility score

## Testing

```bash
# Run all tests
pnpm test

# Frontend tests only
pnpm test:frontend

# Backend tests only
pnpm test:backend
```

## Technical Details

### DJ Mixing Math

#### Beat Grid & Phrases
```
BPM = beats per minute
Beat Duration = 60 / BPM seconds
Bar Duration = Beat Duration × 4 (assuming 4/4 time)
Phrase Duration = Bar Duration × 16 (standard 16-bar phrase)
```

#### BPM Sync (Time-Stretching)
```javascript
// To match deck B's BPM to deck A:
playbackRate = targetBPM / sourceBPM

// Example: Match 125 BPM to 128 BPM
playbackRate = 128 / 125 = 1.024 (2.4% faster)
```

#### Equal-Power Crossfade
```javascript
// Position: -1 (full A) to 1 (full B)
normalizedPosition = (position + 1) / 2  // 0 to 1

gainA = cos(normalizedPosition × π/2)
gainB = sin(normalizedPosition × π/2)
```

### Key Compatibility (Camelot Wheel)

The Camelot wheel organizes musical keys for harmonic mixing:
- Same key: Perfect match (100%)
- Adjacent number, same mode: Very compatible (90%)
- Same number, different mode (relative major/minor): Compatible (80%)
- Energy boost (+7 semitones): Good for building energy (70%)

### Stem Separation

**With Demucs** (full quality):
- Uses `htdemucs` model (4-stem separation)
- Outputs: drums, bass, vocals, other
- Requires ~4-6 minutes per track on CPU

**Pseudo-Stems** (fallback):
- Uses harmonic-percussive separation for drums
- Spectral filtering for bass (<200Hz) and vocals (300Hz-4kHz)
- Near-instant processing

## Security & Compliance

### Data Handling
- OAuth tokens stored only in browser localStorage
- Backend proxies audio streams without storing
- No hardcoded secrets (all via environment variables)

### SoundCloud ToS Compliance
- All audio playback through official SoundCloud streams
- Users must authenticate with their own accounts
- Audio analysis performed locally, no redistribution
- Respect streaming rights and regional availability

### Rate Limiting
- All API endpoints are rate-limited
- Analysis: 20 requests/minute
- Stems: 5 requests/minute
- General: 60 requests/minute

## Limitations & Future Work

### Current Limitations
- Stem separation is CPU-intensive (consider GPU acceleration)
- Real-time beat alignment accuracy depends on analysis quality
- Some SoundCloud tracks may not be streamable (geo-restrictions, rights)

### Potential Improvements
- GPU-accelerated stem separation with CUDA
- WebSocket for real-time analysis progress
- Waveform visualization using track waveform data
- Recording/export of mixed sessions
- More transition styles (backspin, echo out, etc.)
- Machine learning model for transition timing optimization

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions welcome! Please read the contributing guidelines before submitting PRs.

---

Built with React, FastAPI, Web Audio API, librosa, and Demucs.
