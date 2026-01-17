#!/bin/bash

echo "========================================="
echo "     Beatly Diagnostic Script"
echo "========================================="
echo ""

echo "0. Checking ffmpeg (required for audio)..."
if command -v ffmpeg &> /dev/null; then
    echo "   OK: $(ffmpeg -version 2>&1 | head -1)"
else
    echo "   ERROR: ffmpeg not found!"
    echo "   Install: brew install ffmpeg (macOS) or apt install ffmpeg (Ubuntu)"
fi

cd backend

echo ""
echo "1. Checking Python venv..."
if [ -f "./venv/bin/python" ]; then
    echo "   OK: venv exists"
    PYTHON="./venv/bin/python"
else
    echo "   ERROR: venv not found. Run ./setup.sh first"
    exit 1
fi

echo ""
echo "2. Checking Python version..."
$PYTHON --version

echo ""
echo "3. Checking installed packages..."
$PYTHON -m pip list | grep -E "demucs|torch|librosa|fastapi|uvicorn"

echo ""
echo "4. Testing Demucs import..."
$PYTHON -c "
try:
    import demucs
    print(f'   OK: Demucs {demucs.__version__}')
except ImportError as e:
    print(f'   ERROR: {e}')
"

echo ""
echo "5. Testing PyTorch..."
$PYTHON -c "
try:
    import torch
    print(f'   OK: PyTorch {torch.__version__}')
    print(f'   CUDA available: {torch.cuda.is_available()}')
except ImportError as e:
    print(f'   ERROR: {e}')
"

echo ""
echo "6. Testing torchaudio..."
$PYTHON -c "
try:
    import torchaudio
    print(f'   OK: torchaudio {torchaudio.__version__}')
except ImportError as e:
    print(f'   ERROR: {e}')
"

echo ""
echo "7. Testing Demucs separation module..."
$PYTHON -c "
try:
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    print('   OK: Demucs modules loaded')
except Exception as e:
    print(f'   ERROR: {e}')
"

echo ""
echo "8. Checking cache directories..."
for dir in cache/uploads cache/stems cache/analysis; do
    if [ -d "$dir" ]; then
        echo "   OK: $dir exists"
    else
        echo "   MISSING: $dir"
        mkdir -p "$dir"
        echo "   CREATED: $dir"
    fi
done

echo ""
echo "========================================="
echo "If Demucs shows ERROR, run:"
echo ""
echo "  cd backend"
echo "  ./venv/bin/pip install demucs torch torchaudio"
echo ""
echo "========================================="
