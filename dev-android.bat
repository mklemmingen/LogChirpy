@echo off
setlocal enabledelayedexpansion

echo === React Native Expo Android Build Script ===

:: Step 1: Ensure we're in the project root
if not exist package.json (
    echo [ERROR] This script must be run from the root of your Expo project.
    exit /b 1
)

:: Step 2: Check for node_modules
if not exist node_modules (
    echo [INFO] node_modules not found. Running npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        exit /b 1
    )
)

:: Step 3: Run expo prebuild
echo [INFO] Running expo prebuild...
call npx expo prebuild --clean --no-install
if errorlevel 1 (
    echo [ERROR] Expo prebuild failed.
    exit /b 1
)

:: Step 4: Clean build artifacts
echo [INFO] Cleaning build artifacts...
if exist android\gradlew.bat (
    pushd android
    call gradlew.bat clean
    popd
)
rd /s /q .expo 2>nul
rd /s /q node_modules\.cache 2>nul

:: Step 5: Check if any emulator is running
set EMU_RUNNING=false
for /f "tokens=*" %%i in ('adb devices ^| findstr /i "emulator"') do (
    set EMU_RUNNING=true
)

:: Step 6: Launch first available emulator if none is running
if "!EMU_RUNNING!"=="false" (
    echo [INFO] No emulator running. Attempting to start the first available AVD...

    for /f "delims=" %%e in ('"%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -list-avds') do (
        echo [INFO] Starting emulator: %%e
        start "" "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" @%%e
        goto :WAIT_FOR_EMULATOR
    )

    echo [ERROR] No emulators found. Please create one using Android Studio AVD Manager.
    exit /b 1
)

:WAIT_FOR_EMULATOR
echo [INFO] Waiting for emulator to boot...

set /a countdown=20
:spinner_loop
set /a countdown-=1
<nul set /p="Emulator starting... !countdown!s remaining... "
timeout /t 1 >nul
cls
if !countdown! gtr 0 goto spinner_loop

echo [INFO] Waiting for device to become ready...
adb wait-for-device

:: Step 7: Start ADB Logcat viewer (background window)
start "ADB Logcat" cmd /c "adb logcat *:S ReactNative:V ReactNativeJS:V VisionCamera:V"

:: Step 8: Run the Expo app and wait until closed
echo [INFO] Launching Expo app on Android...
start /wait "Metro Bundler" cmd /c "npx expo run:android"
if errorlevel 1 (
    echo [ERROR] Failed to launch app on Android.
    exit /b 1
)

:: Step 9: Clean up processes when Metro closes
echo [INFO] Metro closed. Cleaning up emulator and logger...

taskkill /f /im emulator.exe >nul 2>&1
taskkill /f /im adb.exe >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq ADB Logcat*" >nul 2>&1

echo [👋 INFO] Emulator and logger closed. All done!

endlocal
exit /b 0
