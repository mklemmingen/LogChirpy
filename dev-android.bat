@echo off
setlocal enabledelayedexpansion

:: Colors for better visibility
set RED=[91m
set GREEN=[92m
set YELLOW=[93m
set BLUE=[94m
set RESET=[0m

echo %BLUE%================================================%RESET%
echo %BLUE%=== LogChirpy Android Development Script ===%RESET%
echo %BLUE%================================================%RESET%
echo.

:: === Step 1: Setup Android SDK Path ===
echo %YELLOW%[1/12]%RESET% Setting up Android SDK path...
if exist "%LOCALAPPDATA%\Android\Sdk" (
    set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
    set ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
) else if exist "C:\Android\Sdk" (
    set ANDROID_HOME=C:\Android\Sdk
) else (
    echo %RED%[ERROR]%RESET% Android SDK not found! Please install Android Studio.
    echo        Download from: https://developer.android.com/studio
    echo        Or set ANDROID_HOME environment variable
    pause
    exit /b 1
)

:: Add Android tools to PATH
set PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%ANDROID_HOME%\tools;%ANDROID_HOME%\tools\bin;%PATH%
echo %GREEN%[OK]%RESET% Android SDK found at: %ANDROID_HOME%

:: Verify adb is accessible
where adb >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%RESET% ADB not found in PATH. Android SDK may be incomplete.
    pause
    exit /b 1
)

:: === Step 2: Verify project ===
echo %YELLOW%[2/12]%RESET% Verifying project structure...
if not exist package.json (
    echo %RED%[ERROR]%RESET% This script must be run from the root of your Expo project.
    pause
    exit /b 1
)

:: Check if it's a LogChirpy project
findstr /C:"logchirpy" package.json >nul || (
    echo %YELLOW%[WARNING]%RESET% This doesn't appear to be the LogChirpy project
)

:: Fix corrupted .npmrc if needed
if exist .npmrc (
    echo %YELLOW%[INFO]%RESET% Checking .npmrc file...
    findstr /C:"legacy-peer-deps=true" .npmrc >nul || (
        echo legacy-peer-deps=true > .npmrc
        echo %GREEN%[FIXED]%RESET% Repaired .npmrc file
    )
)

:: === Step 3: Check/Install dependencies ===
echo %YELLOW%[3/12]%RESET% Checking dependencies
if not exist node_modules (
    echo %YELLOW%[INFO]%RESET% Installing dependencies (this may take a few minutes)
    call npm install
    if errorlevel 1 (
        echo %RED%[ERROR]%RESET% npm install failed.
        echo        Try running 'npm install --legacy-peer-deps' manually
        pause
        exit /b 1
    )
) else (
    echo %GREEN%[OK]%RESET% Dependencies already installed
)

:: === Step 4: Kill existing processes ===
echo %YELLOW%[4/12]%RESET% Stopping any existing Metro/Expo instances...
for /f "tokens=1,2" %%a in ('netstat -ano ^| findstr :8081') do (
    taskkill /F /PID %%b >nul 2>&1
)
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *Metro*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *Expo*" >nul 2>&1
timeout /t 2 >nul

:: === Step 5: Clear all caches ===
echo %YELLOW%[5/12]%RESET% Clearing all caches...
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\react-* 2>nul
rd /s /q %TEMP%\expo-* 2>nul
rd /s /q node_modules\.cache 2>nul
rd /s /q .expo 2>nul
rd /s /q android\.gradle 2>nul
rd /s /q android\app\build 2>nul
echo %GREEN%[OK]%RESET% Caches cleared

:: === Step 6: Prebuild ===
echo %YELLOW%[6/12]%RESET% Running expo prebuild...

:: Check if android already exists and is recent
if exist "android\gradlew.bat" (
    echo %YELLOW%[INFO]%RESET% Android folder already exists
    set /p SKIP_PREBUILD="Skip prebuild? (Y/N): "
    if /i "!SKIP_PREBUILD!"=="Y" (
        echo %GREEN%[SKIPPED]%RESET% Using existing Android configuration
        goto :PREBUILD_DONE
    )
)

:: Run prebuild
call npx expo prebuild --clean
set PREBUILD_EXIT=%ERRORLEVEL%

:PREBUILD_DONE
:: Verify android folder exists
if not exist "android\gradlew.bat" (
    echo %RED%[ERROR]%RESET% Android folder not found - prebuild may have failed
    echo %YELLOW%[DEBUG]%RESET% Checking current directory contents:
    dir android 2>nul || echo No android directory found
    echo.
    echo Common issues:
    echo        - Missing dependencies
    echo        - Invalid app.json configuration  
    echo        - Corrupted node_modules
    if defined PREBUILD_EXIT if %PREBUILD_EXIT% NEQ 0 echo        - Prebuild exit code: %PREBUILD_EXIT%
    echo.
    set /p CONTINUE_ANYWAY="Continue anyway? (Y/N): "
    if /i "!CONTINUE_ANYWAY!" NEQ "Y" (
        pause
        exit /b 1
    )
) else (
    echo %GREEN%[OK]%RESET% Android configuration ready
)

:: === Step 7: Clean Android build ===
echo %YELLOW%[7/12]%RESET% Cleaning Android build artifacts...
if exist android\gradlew.bat (
    pushd android
    call gradlew.bat clean
    popd
)

:: === Step 8: Check for device/emulator ===
echo %YELLOW%[8/12]%RESET% Checking for Android devices...
adb devices -l > temp_devices.txt 2>&1
type temp_devices.txt
del temp_devices.txt

:: Count devices (more robust check)
set DEVICE_COUNT=0
for /f "skip=1 tokens=1,2" %%a in ('adb devices 2^>nul') do (
    if "%%b"=="device" set /a DEVICE_COUNT+=1
    if "%%b"=="emulator" set /a DEVICE_COUNT+=1
)

if %DEVICE_COUNT% EQU 0 (
    echo %YELLOW%[WARNING]%RESET% No Android device/emulator detected!
    echo.
    echo Options:
    echo 1. Connect a physical device with USB debugging enabled
    echo 2. Start an emulator from Android Studio
    echo 3. Let this script start an emulator (if available)
    echo.

    set /p START_EMU="Start emulator automatically? (Y/N): "
    if /i "!START_EMU!"=="Y" (
        echo Starting first available AVD
        for /f "delims=" %%e in ('"%ANDROID_HOME%\emulator\emulator.exe" -list-avds 2^>nul') do (
            echo %YELLOW%[INFO]%RESET% Launching emulator: %%e
            start "" "%ANDROID_HOME%\emulator\emulator.exe" @%%e -no-snapshot-load
            goto :WAIT_FOR_DEVICE
        )
        echo %RED%[ERROR]%RESET% No AVDs found. Please create one via Android Studio.
        pause
        exit /b 1
    ) else (
        echo Please start a device/emulator and run this script again.
        pause
        exit /b 1
    )
)

:WAIT_FOR_DEVICE
if %DEVICE_COUNT% EQU 0 (
    echo %YELLOW%[INFO]%RESET% Waiting for emulator to boot (this may take 1-2 minutes)
    adb wait-for-device
    timeout /t 10 >nul

    :: Wait for boot completed
    :BOOT_CHECK
    adb shell getprop sys.boot_completed 2>nul | findstr "1" >nul
    if errorlevel 1 (
        echo Still booting
        timeout /t 5 >nul
        goto :BOOT_CHECK
    )
    echo %GREEN%[OK]%RESET% Emulator is ready!
)

:: === Step 9: Setup port forwarding ===
echo %YELLOW%[9/12]%RESET% Setting up port forwarding...
adb reverse tcp:8081 tcp:8081 2>nul && echo    Port 8081: Metro Bundler
adb reverse tcp:8082 tcp:8082 2>nul && echo    Port 8082: Backup Metro
adb reverse tcp:19000 tcp:19000 2>nul && echo    Port 19000: Expo DevTools
adb reverse tcp:19001 tcp:19001 2>nul && echo    Port 19001: Expo DevTools

:: === Step 10: Start Metro bundler ===
echo %YELLOW%[10/12]%RESET% Starting Metro bundler...
echo %YELLOW%[INFO]%RESET% Trying Expo start first (more stable)

:: Check if we need to use simple metro config due to middleware issues
if exist "metro.config.simple.js" (
    echo %YELLOW%[INFO]%RESET% Using simplified metro config to avoid middleware errors
    start "Metro Bundler" cmd /k "npx expo start --dev-client --clear --config metro.config.simple.js"
) else (
    start "Metro Bundler" cmd /k "npx expo start --dev-client --clear"
)

:: Wait for Metro to start
echo Waiting for Metro bundler to start
timeout /t 8 >nul

:: Check if Metro is responding
curl -s http://localhost:8081/status 2>nul | findstr "packager-status:running" >nul
if errorlevel 1 (
    echo %YELLOW%[WARNING]%RESET% Metro not responding on standard check
    echo %YELLOW%[INFO]%RESET% Checking if server is listening on port 8081
    netstat -an | findstr :8081 >nul
    if errorlevel 1 (
        echo %RED%[ERROR]%RESET% Metro failed to start! Check the Metro window for errors.
        echo %YELLOW%[INFO]%RESET% Common fixes:
        echo   1. Kill all node processes and restart
        echo   2. Clear metro cache: npx react-native start --reset-cache
        echo   3. Check for port conflicts
        set /p CONTINUE_METRO="Continue anyway? (Y/N): "
        if /i "!CONTINUE_METRO!" NEQ "Y" (
            echo Stopping script. Please fix Metro issues first.
            pause
            exit /b 1
        )
    ) else (
        echo %YELLOW%[OK]%RESET% Metro server is listening (may still be starting up)
    )
) else (
    echo %GREEN%[OK]%RESET% Metro bundler is running!
)

:: === Step 11: Start Logcat ===
echo %YELLOW%[11/12]%RESET% Starting ADB logcat monitor...
start "ADB Logcat" cmd /c "adb logcat -c && adb logcat *:S ReactNative:V ReactNativeJS:V AndroidRuntime:E ActivityManager:I"

:: === Step 12: Build and run ===
echo %YELLOW%[12/12]%RESET% Building and running Android app
echo %YELLOW%[INFO]%RESET% This may take 2-5 minutes on first build
echo.

:: Try expo run first
call npx expo run:android
if errorlevel 1 (
    echo %YELLOW%[WARNING]%RESET% Expo run failed, trying direct gradle build

    :: Fallback to manual gradle build
    cd android
    call gradlew.bat assembleDebug --stacktrace
    if errorlevel 1 (
        echo %RED%[ERROR]%RESET% Build failed! Check the error messages above.
        echo Common issues:
        echo - Java version mismatch (need Java 17)
        echo - Missing Android SDK components
        echo - Gradle sync issues
        cd ..
        pause
        exit /b 1
    )

    :: Install APK
    echo %YELLOW%[INFO]%RESET% Installing APK
    adb install -r app\build\outputs\apk\debug\app-debug.apk
    if errorlevel 1 (
        echo %RED%[ERROR]%RESET% Installation failed!
        echo Try: adb uninstall com.logchirpy.app
        cd ..
        pause
        exit /b 1
    )

    :: Launch app
    echo %YELLOW%[INFO]%RESET% Launching app
    adb shell am start -n com.logchirpy.app/.MainActivity
    cd ..
)

echo.
echo %GREEN%================================================%RESET%
echo %GREEN%[SUCCESS] App should now be running!%RESET%
echo %GREEN%================================================%RESET%
echo.
echo %YELLOW%Troubleshooting tips:%RESET%
echo.
echo If you see "Unable to load script" error:
echo   1. Check the Metro window for bundle errors
echo   2. Press Ctrl+M (or shake device) → "Reload"
echo   3. Or run: %BLUE%adb shell input keyevent 82%RESET%
echo.
echo %YELLOW%Quick commands:%RESET%
echo   • Reload app: %BLUE%adb shell input text "RR"%RESET%
echo   • Dev menu: %BLUE%adb shell input keyevent 82%RESET%
echo   • Check logs: See the "ADB Logcat" window
echo.
echo %YELLOW%Windows open:%RESET%
echo   • Metro Bundler - JavaScript bundler
echo   • ADB Logcat - Android logs
echo.
echo Press any key to stop all processes and exit
pause >nul

:: === Cleanup ===
echo.
echo %YELLOW%[CLEANUP]%RESET% Stopping all processes
taskkill /f /fi "WINDOWTITLE eq Metro Bundler*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq ADB Logcat*" >nul 2>&1
adb reverse --remove-all >nul 2>&1

echo %GREEN%[DONE]%RESET% All processes stopped. Goodbye!
endlocal
exit /b 0
