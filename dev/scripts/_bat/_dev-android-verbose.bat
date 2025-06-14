@echo off
setlocal enabledelayedexpansion

echo ================================================
echo === Verbose Android Build & Debug Script ===
echo ================================================

:: Check if Metro is already running
echo [DEBUG] Checking for existing Metro processes...
netstat -an | findstr :8081
if not errorlevel 1 (
    echo [WARNING] Metro bundler may already be running on port 8081
    echo [INFO] Killing existing Metro processes...
    taskkill /F /IM node.exe /FI "WINDOWTITLE eq Metro*" 2>nul
    timeout /t 2 >nul
)

:: Start Metro bundler in a new window
echo [INFO] Starting Metro bundler...
start "Metro Bundler" cmd /k "npx react-native start --reset-cache"
timeout /t 5 >nul

:: Verify Metro is running
echo [DEBUG] Verifying Metro bundler is accessible...
curl -s http://localhost:8081/status | findstr "packager-status:running"
if errorlevel 1 (
    echo [ERROR] Metro bundler failed to start!
    echo [DEBUG] Trying to access Metro directly...
    curl -v http://localhost:8081/
    pause
    exit /b 1
)

:: Check emulator status
echo [DEBUG] Checking connected devices...
adb devices -l

:: Get device IP for reverse port forwarding
echo [INFO] Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
if errorlevel 1 (
    echo [ERROR] Failed to set up port forwarding!
    echo [DEBUG] This might mean no device is connected
)

:: List reverse ports
echo [DEBUG] Current reverse ports:
adb reverse --list

:: Check if app is installed
echo [DEBUG] Checking if app is installed...
adb shell pm list packages | findstr com.logchirpy.app
if errorlevel 1 (
    echo [INFO] App not installed, will install fresh
) else (
    echo [INFO] App already installed, uninstalling first...
    adb uninstall com.logchirpy.app
)

:: Clear app data and cache
echo [INFO] Clearing app data...
adb shell pm clear com.logchirpy.app 2>nul

:: Install the app
echo [INFO] Building and installing app...
cd android
call gradlew.bat installDebug --info
if errorlevel 1 (
    echo [ERROR] Build/install failed! Check the output above.
    pause
    exit /b 1
)
cd ..

:: Check Metro bundle accessibility from device
echo [DEBUG] Testing Metro bundle accessibility from device...
adb shell curl -s http://10.0.2.2:8081/status
echo.

:: Launch the app with explicit activity
echo [INFO] Launching app...
adb shell am start -n com.logchirpy.app/.MainActivity
if errorlevel 1 (
    echo [ERROR] Failed to launch app!
)

:: Show logcat for debugging
echo [INFO] Showing relevant logs (press Ctrl+C to stop)...
echo [DEBUG] Look for errors in red, especially:
echo        - Unable to load script
echo        - Metro connection errors
echo        - JavaScript errors
echo.
adb logcat -c
adb logcat *:S ReactNative:V ReactNativeJS:V AndroidRuntime:E ActivityManager:I

pause
endlocal