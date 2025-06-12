@echo off
echo ================================================
echo === Starting Android App with Metro ===
echo ================================================

:: Kill any existing Metro instances
echo [INFO] Stopping any existing Metro instances...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Metro*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq React*" 2>nul
timeout /t 2 >nul

:: Clear caches
echo [INFO] Clearing caches...
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\react-* 2>nul
rd /s /q node_modules\.cache 2>nul

:: Start Metro in a separate window
echo [INFO] Starting Metro bundler...
start "Metro" cmd /k "npx react-native start --reset-cache"

:: Wait for Metro to start
echo [INFO] Waiting for Metro to start...
timeout /t 8 >nul

:: Setup port forwarding
echo [INFO] Setting up port forwarding...
adb reverse tcp:8081 tcp:8081

:: Run Android
echo [INFO] Building and running Android app...
npx react-native run-android

pause