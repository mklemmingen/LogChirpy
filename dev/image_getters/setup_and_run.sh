#!/bin/bash
# Setup script for bird image fetcher

echo "=== LogChirpy Bird Image Fetcher Setup ==="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "Installing Python packages..."
pip install -r requirements.txt

echo "Setup complete!"
echo ""
echo "Usage examples (FULLY AUTOMATED by default):"
echo "  # Dry run (see what would be downloaded):"
echo "  python bird_image_fetcher.py --dry-run"
echo ""
echo "  # Download first 10 bird images (auto-resume, smart quality):"
echo "  python bird_image_fetcher.py --limit 10"
echo ""
echo "  # Download specific species:"
echo "  python bird_image_fetcher.py --species 'Turdus migratorius'"
echo ""
echo "  # Download ALL images - FULLY AUTOMATED (takes hours):"
echo "  python bird_image_fetcher.py"
echo ""
echo "  # Start fresh (ignore previous progress):"
echo "  python bird_image_fetcher.py --no-resume"
echo ""
echo "To run the script, make sure to activate the virtual environment first:"
echo "  source venv/bin/activate"
echo "  python bird_image_fetcher.py --dry-run"