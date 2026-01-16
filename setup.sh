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

# Start backend in background
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================="
echo "        Beatly is running!"
echo "========================================="
echo ""
echo "  Open in browser: http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

# Handle Ctrl+C to kill both processes
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Wait for processes
wait
