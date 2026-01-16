# Beatly - AI-Powered DJ Mixing App

A professional DJ mixing web application with AI-powered stem separation, beat analysis, and automatic mixing tools.

## Features

- **Dual Deck Player** - Two independent decks with full transport controls
- **AI Stem Separation** - Isolate drums, bass, vocals, and melody from any track
- **BPM & Key Detection** - Automatic analysis using librosa
- **Auto Crossfade** - Smooth transitions between tracks with adjustable duration
- **3-Band EQ** - Per-deck equalizer (Low, Mid, High)
- **Drag & Drop Playlist** - Upload and reorder tracks with drag and drop
- **BPM Sync** - Match tempos between decks
- **Waveform Display** - Real-time audio visualization
- **Mobile Support** - Works on iOS Safari and mobile browsers

## Quick Start

### Prerequisites

- Node.js 18+ (https://nodejs.org)
- Python 3.9+ (https://python.org)
- npm (comes with Node.js)

### Option 1: One-Command Setup (Mac/Linux)

```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

```bash
# 1. Install all dependencies
npm install

# 2. Install Python dependencies
cd backend
python3 -m pip install -r requirements.txt
cd ..

# 3. Run the app
npm run dev
```

### Access the App

Once running, open your browser:
- **App**: http://localhost:5173
- **API**: http://localhost:8000

## Usage Guide

### 1. Upload Tracks
- Click "Add Tracks" or drag & drop MP3/WAV/M4A/OGG/FLAC files
- Multiple files can be uploaded at once

### 2. Load Tracks to Decks
- Click **A** or **B** buttons next to any track to load it to that deck
- First two tracks auto-load when you upload multiple files

### 3. Play & Mix
- Click the **Play** button on each deck
- Use the **crossfader** in the Mixer panel to blend between decks
- Click **"Fade to A"** or **"Fade to B"** for automatic crossfade

### 4. Stem Isolation (AI-Powered)
- Click **"Separate into Stems"** on any deck
- Wait for AI processing (uses librosa for fast pseudo-stems)
- Toggle **"Stems ON"** to enable stem mode
- **Mute (M)** or **Solo (S)** individual stems (drums, bass, vocals, melody)
- Adjust volume sliders for each stem

### 5. Sync & Match
- Click **"Sync BPM"** to match deck tempos automatically
- BPM and musical key are auto-detected for each track

### 6. Reorder Playlist
- Drag tracks up/down to reorder your playlist
- Use arrow buttons for fine control

## Project Structure

```
beatly/
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── audio/         # Web Audio API engine
│   │   ├── components/    # React components
│   │   ├── store/         # Zustand state management
│   │   └── types/         # TypeScript types
│   └── package.json
├── backend/                # Python FastAPI
│   ├── app/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Audio analysis & stem separation
│   │   └── config.py      # Configuration
│   └── requirements.txt
├── package.json            # Root scripts
├── setup.sh               # Auto-setup script
└── README.md
```

## Configuration (Optional)

Create a `.env` file in the `backend/` directory for advanced settings:

```env
# API Settings
API_HOST=0.0.0.0
API_PORT=8000

# Stem Separation (optional - for GPU acceleration)
DEMUCS_MODEL=htdemucs
DEMUCS_DEVICE=cpu  # or "cuda" for NVIDIA GPU
```

### For Higher Quality Stem Separation (Optional)

Install Demucs for professional-grade stem separation:

```bash
pip install demucs torch
```

Without Demucs, the app uses fast pseudo-stems (spectral filtering), which work well for most use cases.

## Available Scripts

```bash
# Run both frontend and backend (development)
npm run dev

# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:backend

# Build for production
npm run build
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/uploads/upload` | POST | Upload audio file |
| `/api/uploads/tracks` | GET | List all tracks |
| `/api/uploads/tracks/{id}/stream` | GET | Stream audio |
| `/api/uploads/tracks/{id}/analyze` | POST | Analyze BPM/key |
| `/api/uploads/tracks/{id}/stems` | POST | Separate stems |
| `/api/uploads/tracks/{id}/stems/{name}` | GET | Stream stem audio |
| `/api/health` | GET | Health check |

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite (build tool)
- Tailwind CSS
- Zustand (state management)
- Web Audio API

### Backend
- Python 3.9+
- FastAPI
- librosa (audio analysis)
- soundfile (audio I/O)
- Demucs (optional, ML stem separation)

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 14+ |
| Edge | 80+ |
| iOS Safari | 14+ |

## Troubleshooting

### Audio doesn't play
- **Safari/iOS**: Tap anywhere on the page first to unlock audio
- Check that your device volume is up

### Stem separation is slow
- This is normal for CPU processing
- For faster results, install Demucs with CUDA (GPU)

### Port already in use
```bash
# Kill processes on the ports
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:8000 | xargs kill -9 2>/dev/null
```

### Python dependencies fail
```bash
# Try using pip directly
cd backend
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

### Node.js version too old
```bash
# Check your version
node --version

# Should be 18.0.0 or higher
# Update at: https://nodejs.org
```

## Development

### Adding New Features

1. Frontend components go in `frontend/src/components/`
2. Audio engine code in `frontend/src/audio/`
3. API routes in `backend/app/routes/`
4. Audio services in `backend/app/services/`

### Running Tests

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && python -m pytest
```

## License

MIT License - feel free to use this project for any purpose.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

Made with love for music
