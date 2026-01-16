# Beatly

A DJ-style mixing web app with audio analysis and stem separation powered by Demucs AI.

## Features

- Upload and mix audio files (MP3, WAV, FLAC, M4A, OGG)
- Two-deck DJ interface with crossfader
- Auto BPM and key detection
- AI-powered stem separation (drums, bass, vocals, other) using Demucs
- Auto Mix mode with smart transitions
- Drum machine with pattern selection
- Real-time waveform visualization

## Requirements

- Node.js 18+
- Python 3.9+
- ~4GB disk space (for PyTorch and Demucs models)

## Quick Setup

```bash
# Clone the repository
git clone https://github.com/majidsadri/beatly.git
cd beatly

# Run the setup script
chmod +x setup.sh
./setup.sh

# Start the development servers
npm run dev
```

The app will be available at http://localhost:5173

## Manual Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

## Project Structure

```
beatly/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── audio/     # Web Audio API engine
│   │   ├── components/# React components
│   │   └── store/     # Zustand state management
│   └── package.json
├── backend/           # FastAPI + Python
│   ├── app/
│   │   ├── routes/    # API endpoints
│   │   └── services/  # Audio analysis, Demucs
│   └── requirements.txt
├── setup.sh           # Setup script
└── package.json       # Root scripts
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend**: FastAPI, Python 3.9+
- **Audio**: Web Audio API, librosa, Demucs (PyTorch)
- **Stem Separation**: Demucs (same AI as Ultimate Vocal Remover)

## License

MIT
