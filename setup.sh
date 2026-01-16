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

# Check Python
echo -n "Checking Python... "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 9 ]; then
        echo -e "${GREEN}OK${NC} (Python $PYTHON_VERSION)"
    else
        echo -e "${YELLOW}WARNING${NC} (Python $PYTHON_VERSION)"
        echo "Python 3.9+ is recommended. Some features may not work."
    fi
else
    echo -e "${RED}NOT FOUND${NC}"
    echo "Python 3 is required. Please install it from: https://python.org"
    exit 1
fi

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

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
cd backend

# Check if pip is available
if ! python3 -m pip --version &> /dev/null; then
    echo -e "${RED}pip not found. Installing pip...${NC}"
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py
    rm get-pip.py
fi

python3 -m pip install --upgrade pip

# Install with verbose output on failure
if ! python3 -m pip install -r requirements.txt; then
    echo ""
    echo -e "${YELLOW}Some packages failed to install. Trying with --user flag...${NC}"
    python3 -m pip install --user -r requirements.txt
fi

cd ..

# Create uploads directory if it doesn't exist
mkdir -p backend/uploads

echo ""
echo -e "${GREEN}=========================================="
echo "  Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "To start the application, run:"
echo ""
echo "  npm run dev"
echo ""
echo "Then open your browser to:"
echo ""
echo "  http://localhost:5173"
echo ""
echo "For mobile testing on the same network:"
echo ""
echo "  http://$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "YOUR_IP"):5173"
echo ""
