#!/bin/bash

# Beatly - DJ Mixing App Setup Script
# This script installs all dependencies and starts the application

set -e

echo "=========================================="
echo "  Beatly - AI-Powered DJ Mixing App"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}OK${NC} ($(node -v))"
    else
        echo -e "${RED}FAILED${NC}"
        echo "Node.js 18+ is required. Current version: $(node -v)"
        echo "Please update Node.js: https://nodejs.org"
        exit 1
    fi
else
    echo -e "${RED}NOT FOUND${NC}"
    echo "Node.js is required. Please install it from: https://nodejs.org"
    exit 1
fi

# Find best Python version (prefer 3.11, 3.10, 3.9, then python3)
echo -n "Checking Python... "
PYTHON_CMD=""
for cmd in python3.12 python3.11 python3.10 python3.9 python3; do
    if command -v $cmd &> /dev/null; then
        VERSION=$($cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        MAJOR=$(echo $VERSION | cut -d'.' -f1)
        MINOR=$(echo $VERSION | cut -d'.' -f2)
        if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 9 ]; then
            PYTHON_CMD=$cmd
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}NOT FOUND${NC}"
    echo "Python 3.9+ is required. Please install it from: https://python.org"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version)
echo -e "${GREEN}OK${NC} ($PYTHON_VERSION using '$PYTHON_CMD')"

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    echo -e "${GREEN}OK${NC} ($(npm -v))"
else
    echo -e "${RED}NOT FOUND${NC}"
    echo "npm is required. It should come with Node.js."
    exit 1
fi

echo ""
echo "Installing dependencies..."
echo ""

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Install Python dependencies in virtual environment
echo ""
echo "Setting up Python virtual environment..."
cd backend

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment with $PYTHON_CMD..."
    $PYTHON_CMD -m venv venv
fi

# Upgrade pip and install dependencies using venv python directly
echo "Upgrading pip..."
./venv/bin/python -m pip install --upgrade pip

echo "Installing Python dependencies..."
./venv/bin/python -m pip install -r requirements.txt

cd ..

# Create uploads directory if it doesn't exist
mkdir -p backend/uploads

echo ""
echo -e "${GREEN}=========================================="
echo "  Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Starting the application..."
echo ""
echo "  App:  http://localhost:5173"
echo "  API:  http://localhost:8000"
echo ""

# Get local IP for mobile testing
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "")
if [ -n "$LOCAL_IP" ]; then
    echo "For mobile testing on the same network:"
    echo "  http://${LOCAL_IP}:5173"
    echo ""
fi

# Start the app
npm run dev
