@echo off
echo ================================================
echo === Running Android with Expo ===
echo ================================================

:: Set Android SDK path (adjust if your Android SDK is in a different location)
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%ANDROID_HOME%\emulator

:: Check if adb is now available
where adb >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Android SDK tools not found!
    echo Please ensure Android SDK is installed and add to PATH:
    echo   - Platform-tools: %ANDROID_HOME%\platform-tools
    echo.
    echo You can install Android SDK through Android Studio
    pause
    exit /b 1
)

:: Kill any existing Metro/Expo instances
echo [INFO] Stopping any existing Expo/Metro instances...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *Metro*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *Expo*" 2>nul
timeout /t 2 >nul

:: Clear caches
echo [INFO] Clearing caches...
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\react-* 2>nul
rd /s /q %TEMP%\expo-* 2>nul
rd /s /q node_modules\.cache 2>nul
rd /s /q .expo 2>nul

:: Check if emulator is running
echo [INFO] Checking for running emulator...
adb devices -l
echo.

:: Count connected devices
for /f "tokens=*" %%i in ('adb devices ^| find /c "device"') do set DEVICE_COUNT=%%i
if %DEVICE_COUNT% LEQ 1 (
    echo [WARNING] No Android device/emulator detected!
    echo Please start your Android emulator first.
    pause
    exit /b 1
)

:: Setup port forwarding
echo [INFO] Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:19000 tcp:19000
adb reverse tcp:19001 tcp:19001

:: Run with Expo
echo [INFO] Starting Expo and building for Android...
echo.
echo This will:
echo 1. Start the Metro bundler
echo 2. Build the app
echo 3. Install it on your emulator
echo 4. Launch the app
echo.

:: Use the correct expo command without --clear flag
npx expo run:android

pause