@echo off
echo ================================================
echo === Running Android with Expo ===
echo ================================================

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

npx expo run:android --clear

pause