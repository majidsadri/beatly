#!/bin/bash

# Beatly Setup Script
# This script sets up the development environment for Beatly

set -e

echo "========================================="
echo "        Beatly Setup Script"
echo "========================================="

# Check for required tools
echo ""
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+ first."
    echo "       Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi
echo "  Node.js $(node -v)"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed. Please install Python 3.9+ first."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info.minor)')
if [ "$PYTHON_VERSION" -lt 9 ]; then
    echo "ERROR: Python 3.9+ is required."
    exit 1
fi
echo "  Python $(python3 --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed."
    exit 1
fi
echo "  npm $(npm -v)"

# Check ffmpeg (required for audio processing)
if ! command -v ffmpeg &> /dev/null; then
    echo ""
    echo "WARNING: ffmpeg is not installed."
    echo "         Audio processing (especially Demucs) requires ffmpeg."
    echo ""

    # Try to install ffmpeg automatically
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - try Homebrew
        if command -v brew &> /dev/null; then
            echo "Attempting to install ffmpeg via Homebrew..."
            brew install ffmpeg
        else
            echo "  Homebrew not found. Install ffmpeg manually:"
            echo "    1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "    2. Then run: brew install ffmpeg"
            echo ""
            read -p "Continue without ffmpeg? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux - try apt
        if command -v apt &> /dev/null; then
            echo "Attempting to install ffmpeg via apt..."
            sudo apt update && sudo apt install -y ffmpeg
        elif command -v yum &> /dev/null; then
            echo "Attempting to install ffmpeg via yum..."
            sudo yum install -y ffmpeg
        else
            echo "  Install ffmpeg manually:"
            echo "    Ubuntu/Debian: sudo apt install ffmpeg"
            echo "    Fedora/RHEL:   sudo yum install ffmpeg"
            echo ""
            read -p "Continue without ffmpeg? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        echo "  Install ffmpeg:"
        echo "    macOS:   brew install ffmpeg"
        echo "    Ubuntu:  sudo apt install ffmpeg"
        echo "    Windows: Download from https://ffmpeg.org/download.html"
        echo ""
        read -p "Continue without ffmpeg? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Verify ffmpeg after potential install
if command -v ffmpeg &> /dev/null; then
    echo "  ffmpeg $(ffmpeg -version 2>&1 | head -1 | cut -d' ' -f3)"
else
    echo "  WARNING: ffmpeg still not available. Stem separation may fail."
fi

echo ""
echo "Installing root dependencies..."
npm install

echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "Setting up Python virtual environment..."
cd backend

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  Created virtual environment"
fi

# Activate venv and install dependencies
echo "Installing Python dependencies (this may take a while for PyTorch/Demucs)..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Verify Demucs installation and download models
echo ""
echo "Verifying Demucs installation..."
if python -c "import demucs; import torch; print(f'Demucs {demucs.__version__} with PyTorch {torch.__version__}')" 2>/dev/null; then
    echo "  Demucs is installed"
    echo ""
    echo "Downloading Demucs model (htdemucs)... This may take a while on first run."
    python -c "
from demucs.pretrained import get_model
try:
    model = get_model('htdemucs')
    print('  Model downloaded and ready!')
except Exception as e:
    print(f'  WARNING: Could not download model: {e}')
" 2>/dev/null || echo "  WARNING: Model download failed. Will try on first use."
else
    echo "  WARNING: Demucs not working. Stem separation will use fallback mode."
    echo "  To fix, try: pip install demucs torch torchaudio"
fi

# Create cache directories
mkdir -p cache/uploads cache/stems cache/analysis

cd ..

echo ""
echo "========================================="
echo "        Setup Complete!"
echo "========================================="
echo ""
echo "Starting Beatly..."
echo ""

# Start backend
echo "Starting backend server..."
cd backend
./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start and verify it's running
sleep 3
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "  Backend running on http://localhost:8000"
else
    echo "  WARNING: Backend may not have started correctly"
    echo "  Check for errors above"
fi

# Start frontend
echo "Starting frontend server..."
cd frontend
npm run dev 2>&1 &
FRONTEND_PID=$!
cd ..

sleep 2

echo ""
echo "========================================="
echo "        Beatly is running!"
echo "========================================="
echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

# Handle Ctrl+C to kill both processes
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Wait for processes
wait
