#!/bin/bash

# Beatly - DJ Mixing App Setup Script
# This script installs all dependencies and starts the application

echo "=========================================="
echo "  Beatly - AI-Powered DJ Mixing App"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect Homebrew path (Apple Silicon vs Intel)
if [ -d "/opt/homebrew/bin" ]; then
    BREW_PREFIX="/opt/homebrew"
elif [ -d "/usr/local/bin" ]; then
    BREW_PREFIX="/usr/local"
else
    BREW_PREFIX=""
fi

# Add Homebrew to PATH if exists
if [ -n "$BREW_PREFIX" ]; then
    export PATH="$BREW_PREFIX/bin:$PATH"
fi

# Function to install Homebrew
install_homebrew() {
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Set up Homebrew path
    if [ -d "/opt/homebrew/bin" ]; then
        BREW_PREFIX="/opt/homebrew"
    else
        BREW_PREFIX="/usr/local"
    fi
    export PATH="$BREW_PREFIX/bin:$PATH"

    # Add to shell profile
    if [ -f "$HOME/.zshrc" ]; then
        echo "eval \"\$($BREW_PREFIX/bin/brew shellenv)\"" >> "$HOME/.zshrc"
    fi
    eval "$($BREW_PREFIX/bin/brew shellenv)"
}

# Check if on macOS
IS_MACOS=false
if [[ "$OSTYPE" == "darwin"* ]]; then
    IS_MACOS=true
fi

# Check Homebrew on macOS
if [ "$IS_MACOS" = true ]; then
    if ! command -v brew &> /dev/null; then
        echo -e "${YELLOW}Homebrew not found.${NC}"
        echo "Homebrew is the easiest way to install dependencies on macOS."
        echo ""
        read -p "Would you like to install Homebrew now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_homebrew
        else
            echo "Please install dependencies manually:"
            echo "  Node.js: https://nodejs.org"
            echo "  Python:  https://python.org"
            exit 1
        fi
    fi
fi

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}OK${NC} ($(node -v))"
    else
        echo -e "${YELLOW}OUTDATED${NC} ($(node -v), need 18+)"
        if [ "$IS_MACOS" = true ]; then
            echo "Upgrading Node.js via Homebrew..."
            brew upgrade node || brew install node
            export PATH="$BREW_PREFIX/bin:$PATH"
        else
            echo "Please upgrade Node.js to 18+: https://nodejs.org"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}NOT FOUND${NC}"
    if [ "$IS_MACOS" = true ]; then
        echo "Installing Node.js via Homebrew..."
        brew install node
        export PATH="$BREW_PREFIX/bin:$PATH"
        echo -e "${GREEN}Node.js installed!${NC}"
    else
        echo "Please install Node.js 18+: https://nodejs.org"
        exit 1
    fi
fi

# Check Python
echo -n "Checking Python 3.9+... "
PYTHON_CMD=""

# Check common Python commands
for cmd in python3 python3.12 python3.11 python3.10 python3.9; do
    if command -v $cmd &> /dev/null; then
        VERSION=$($cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "")
        if [ -n "$VERSION" ]; then
            MAJOR=$(echo $VERSION | cut -d'.' -f1)
            MINOR=$(echo $VERSION | cut -d'.' -f2)
            if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 9 ]; then
                PYTHON_CMD=$cmd
                break
            fi
        fi
    fi
done

# Also check Homebrew Python paths directly
if [ -z "$PYTHON_CMD" ] && [ -n "$BREW_PREFIX" ]; then
    for ver in 3.12 3.11 3.10 3.9; do
        if [ -x "$BREW_PREFIX/bin/python$ver" ]; then
            PYTHON_CMD="$BREW_PREFIX/bin/python$ver"
            break
        fi
    done
fi

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${YELLOW}NOT FOUND${NC}"
    if [ "$IS_MACOS" = true ]; then
        echo "Installing Python via Homebrew..."
        brew install python@3.11
        export PATH="$BREW_PREFIX/bin:$PATH"

        # Use the Homebrew Python path directly
        if [ -x "$BREW_PREFIX/bin/python3.11" ]; then
            PYTHON_CMD="$BREW_PREFIX/bin/python3.11"
        elif [ -x "$BREW_PREFIX/opt/python@3.11/bin/python3.11" ]; then
            PYTHON_CMD="$BREW_PREFIX/opt/python@3.11/bin/python3.11"
        else
            PYTHON_CMD="$BREW_PREFIX/bin/python3"
        fi
        echo -e "${GREEN}Python installed!${NC}"
    else
        echo "Please install Python 3.9+: https://python.org"
        exit 1
    fi
fi

echo -e "${GREEN}OK${NC} ($($PYTHON_CMD --version))"

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    echo -e "${GREEN}OK${NC} ($(npm -v))"
else
    echo -e "${RED}NOT FOUND${NC}"
    echo "npm should come with Node.js. Try reinstalling Node.js."
    exit 1
fi

echo ""
echo "Installing dependencies..."
echo ""

# Install Node.js dependencies
echo "Installing root dependencies..."
npm install

echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install Python dependencies in virtual environment
echo ""
echo "Setting up Python virtual environment..."
cd backend

# Remove old venv if it exists but is broken
if [ -d "venv" ] && [ ! -x "venv/bin/python" ]; then
    echo "Removing broken virtual environment..."
    rm -rf venv
fi

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment with $PYTHON_CMD..."
    $PYTHON_CMD -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to create virtual environment${NC}"
        echo "Try: $PYTHON_CMD -m pip install --user virtualenv"
        exit 1
    fi
fi

# Upgrade pip and install dependencies
echo "Upgrading pip..."
./venv/bin/python -m pip install --upgrade pip --quiet

echo "Installing Python dependencies..."
./venv/bin/python -m pip install -r requirements.txt

cd ..

# Create uploads directory
mkdir -p backend/uploads
mkdir -p backend/cache

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
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "")
if [ -n "$LOCAL_IP" ]; then
    echo "For mobile testing on the same network:"
    echo "  http://${LOCAL_IP}:5173"
    echo ""
fi

# Start the app
npm run dev
