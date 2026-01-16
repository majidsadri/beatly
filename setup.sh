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
NODE_OK=false
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}OK${NC} ($(node -v))"
        NODE_OK=true
    else
        echo -e "${RED}OUTDATED${NC} ($(node -v))"
        echo "Node.js 18+ is required."
    fi
else
    echo -e "${RED}NOT FOUND${NC}"
fi

if [ "$NODE_OK" = false ]; then
    echo ""
    # Check if on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            read -p "Would you like to install Node.js via Homebrew now? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "Installing Node.js via Homebrew..."
                brew install node
                echo -e "${GREEN}Node.js installed successfully!${NC}"
            else
                echo "Please install Node.js and run this script again."
                echo "  brew install node"
                echo "  OR download from: https://nodejs.org"
                exit 1
            fi
        else
            echo "Please install Node.js:"
            echo "  Option 1: Install Homebrew first"
            echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "    brew install node"
            echo ""
            echo "  Option 2: Download from https://nodejs.org"
            exit 1
        fi
    else
        echo "Please install Node.js 18+ from: https://nodejs.org"
        exit 1
    fi
fi

# Find best Python version (prefer 3.12, 3.11, 3.10, 3.9)
echo -n "Checking Python... "
PYTHON_CMD=""
for cmd in python3.12 python3.11 python3.10 python3.9 python3; do
    if command -v $cmd &> /dev/null; then
        VERSION=$($cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
        if [ -n "$VERSION" ]; then
            MAJOR=$(echo $VERSION | cut -d'.' -f1)
            MINOR=$(echo $VERSION | cut -d'.' -f2)
            if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 9 ]; then
                PYTHON_CMD=$cmd
                break
            fi
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}NOT FOUND${NC}"
    echo ""
    echo "Python 3.9+ is required but not installed."
    echo ""

    # Check if on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "To install Python on macOS, choose one option:"
        echo ""

        # Check if Homebrew is installed
        if command -v brew &> /dev/null; then
            echo "  Option 1 (Recommended - you have Homebrew):"
            echo "    brew install python@3.11"
            echo ""
            echo "  Option 2: Download from python.org"
            echo "    https://www.python.org/downloads/macos/"
            echo ""

            read -p "Would you like to install Python via Homebrew now? (y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "Installing Python 3.11 via Homebrew..."
                brew install python@3.11
                PYTHON_CMD="python3.11"
                echo -e "${GREEN}Python installed successfully!${NC}"
            else
                echo "Please install Python and run this script again."
                exit 1
            fi
        else
            echo "  Option 1 (Recommended): Install Homebrew first, then Python"
            echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "    brew install python@3.11"
            echo ""
            echo "  Option 2: Download from python.org"
            echo "    https://www.python.org/downloads/macos/"
            echo ""
            exit 1
        fi
    else
        echo "Please install Python 3.9+ from: https://python.org"
        exit 1
    fi
fi

if [ -n "$PYTHON_CMD" ]; then
    PYTHON_VERSION=$($PYTHON_CMD --version)
    echo -e "${GREEN}OK${NC} ($PYTHON_VERSION using '$PYTHON_CMD')"
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
