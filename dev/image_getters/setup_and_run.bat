@echo off
REM Setup script for bird image fetcher (Windows)

echo === LogChirpy Bird Image Fetcher Setup ===

REM Check if Python 3 is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python 3 is not installed. Please install Python 3 first.
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install requirements
echo Installing Python packages...
pip install -r requirements.txt

echo Setup complete!
echo.
echo Usage examples:
echo   # Dry run (see what would be downloaded):
echo   python bird_image_fetcher.py --dry-run
echo.
echo   # Download first 10 bird images:
echo   python bird_image_fetcher.py --limit 10
echo.
echo   # Download specific species:
echo   python bird_image_fetcher.py --species "Turdus migratorius"
echo.
echo   # Resume previous download:
echo   python bird_image_fetcher.py --resume
echo.
echo   # Download all images (WARNING: This will take a long time!):
echo   python bird_image_fetcher.py
echo.
echo To run the script, make sure to activate the virtual environment first:
echo   venv\Scripts\activate.bat
echo   python bird_image_fetcher.py --dry-run

pause