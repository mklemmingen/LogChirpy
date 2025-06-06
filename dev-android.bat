@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================================
echo           LogChirpy Android Development Script          
echo ========================================================
echo.
echo This script will automatically:
echo   - Setup Android SDK environment
echo   - Install dependencies if needed
echo   - Clear caches and stop conflicting processes
echo   - Start Android emulator if no device is connected
echo   - Launch Metro bundler
echo   - Build and run the app
echo.
echo [INFO] Starting in 3 seconds...
timeout /t 3 >nul
echo.

:: === Step 1: Setup Android SDK Path ===
echo.
echo [STEP 1/12] Setting up Android SDK path...
echo --------------------------------------------------------
if exist "%LOCALAPPDATA%\Android\Sdk" (
    set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
    set ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
) else if exist "C:\Android\Sdk" (
    set ANDROID_HOME=C:\Android\Sdk
) else (
    echo.
    echo [ERROR] Android SDK not found! Please install Android Studio.
    echo         Download from: https://developer.android.com/studio
    echo         Or set ANDROID_HOME environment variable
    pause
    exit /b 1
)

:: Add Android tools to PATH
set PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%ANDROID_HOME%\tools;%ANDROID_HOME%\tools\bin;%PATH%
echo [OK] Android SDK found at: %ANDROID_HOME%

:: Verify adb is accessible
where adb >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] ADB not found in PATH. Android SDK may be incomplete.
    pause
    exit /b 1
)

:: === Step 2: Verify project ===
echo.
echo [STEP 2/12] Verifying project structure...
echo --------------------------------------------------------
if not exist package.json (
    echo.
    echo [ERROR] This script must be run from the root of your Expo project.
    pause
    exit /b 1
)

:: Check if it's a LogChirpy project
findstr /C:"logchirpy" package.json >nul || (
    echo [WARNING] This doesn't appear to be the LogChirpy project
)

:: Fix corrupted .npmrc if needed
if exist .npmrc (
    echo [INFO] Checking .npmrc file...
    findstr /C:"legacy-peer-deps=true" .npmrc >nul || (
        echo legacy-peer-deps=true > .npmrc
        echo [FIXED] Repaired .npmrc file
    )
)

:: === Step 3: Check/Install dependencies ===
echo.
echo [STEP 3/12] Checking dependencies
echo --------------------------------------------------------
if not exist node_modules (
    echo [INFO] Installing dependencies (this may take a few minutes)
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        echo         Try running 'npm install --legacy-peer-deps' manually
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencies already installed
)

:: === Step 4: Kill existing processes ===
echo.
echo [STEP 4/12] Stopping any existing Metro/Expo instances...
echo --------------------------------------------------------
for /f "tokens=1,2" %%a in ('netstat -ano ^| findstr :8081') do (
    taskkill /F /PID %%b >nul 2>&1
)
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *Metro*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *Expo*" >nul 2>&1
timeout /t 2 >nul

:: === Step 5: Clear all caches ===
echo.
echo [STEP 5/12] Clearing all caches...
echo --------------------------------------------------------
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\react-* 2>nul
rd /s /q %TEMP%\expo-* 2>nul
rd /s /q node_modules\.cache 2>nul
rd /s /q .expo 2>nul
rd /s /q android\.gradle 2>nul
rd /s /q android\app\build 2>nul
echo [OK] Caches cleared

:: === Step 6: Prebuild ===
echo.
echo [STEP 6/12] Running expo prebuild...
echo --------------------------------------------------------

:: Check if android already exists and is recent
if exist "android\gradlew.bat" (
    echo [INFO] Android folder already exists, skipping prebuild
    echo [SKIPPED] Using existing Android configuration
    goto :PREBUILD_DONE
)

:: Run prebuild
call npx expo prebuild --clean
set PREBUILD_EXIT=%ERRORLEVEL%

:PREBUILD_DONE
:: Verify android folder exists
if not exist "android\gradlew.bat" (
    echo.
    echo [ERROR] Android folder not found - prebuild may have failed
    echo [DEBUG] Checking current directory contents:
    dir android 2>nul || echo No android directory found
    echo.
    echo Common issues:
    echo        - Missing dependencies
    echo        - Invalid app.json configuration  
    echo        - Corrupted node_modules
    if defined PREBUILD_EXIT if %PREBUILD_EXIT% NEQ 0 echo        - Prebuild exit code: %PREBUILD_EXIT%
    echo.
    echo [INFO] Attempting to continue with existing configuration...
) else (
    echo [OK] Android configuration ready
)

:: === Step 7: Clean Android build ===
echo.
echo [STEP 7/12] Cleaning Android build artifacts...
echo --------------------------------------------------------
if exist android\gradlew.bat (
    pushd android
    call gradlew.bat clean
    popd
)

:: === Step 8: Check for device/emulator ===
echo.
echo [STEP 8/12] Checking for Android devices...
echo --------------------------------------------------------

:: Kill any existing ADB server to ensure clean start
adb kill-server >nul 2>&1
timeout /t 2 >nul

:: Start ADB server
adb start-server >nul 2>&1
timeout /t 2 >nul

:: List devices
echo.
echo Connected devices:
adb devices

:: Count devices with improved parsing
set "DEVICE_COUNT=0"
for /f "skip=1 tokens=1,2" %%a in ('adb devices 2^>nul') do (
    if /i "%%b"=="device" (
        set /a "DEVICE_COUNT+=1"
        echo [FOUND] Device: %%a
    )
    if /i "%%b"=="emulator" (
        set /a "DEVICE_COUNT+=1"
        echo [FOUND] Emulator: %%a
    )
)

if "%DEVICE_COUNT%"=="0" (
    echo.
    echo [WARNING] No Android device/emulator detected!
    echo [INFO] Automatically starting first available emulator...
    
    :: Check for available AVDs
    set AVD_COUNT=0
    for /f "delims=" %%e in ('"%ANDROID_HOME%\emulator\emulator.exe" -list-avds 2^>nul') do (
        set /a AVD_COUNT+=1
        set FIRST_AVD=%%e
    )
    
    if %AVD_COUNT% GTR 0 (
        echo [INFO] Found %AVD_COUNT% AVD(s), launching: %FIRST_AVD%
        echo [INFO] Using GPU acceleration for faster performance
        start "" "%ANDROID_HOME%\emulator\emulator.exe" @%FIRST_AVD% -no-snapshot-load -gpu host -no-audio
        goto :WAIT_FOR_DEVICE
    ) else (
        echo.
        echo [ERROR] No AVDs found! Please create one via Android Studio.
        echo.
        echo To create an AVD:
        echo 1. Open Android Studio
        echo 2. Go to Tools → AVD Manager
        echo 3. Click "Create Virtual Device"
        echo 4. Select a device and system image
        echo.
        pause
        exit /b 1
    )
)

:WAIT_FOR_DEVICE
if "%DEVICE_COUNT%"=="0" (
    echo.
    echo [INFO] Waiting for emulator to boot (this may take 1-2 minutes)
    echo.
    adb wait-for-device
    timeout /t 10 >nul

    :: Wait for boot completed
    :BOOT_CHECK
    adb shell getprop sys.boot_completed 2>nul | findstr "1" >nul
    if errorlevel 1 (
        echo Still booting...
        timeout /t 5 >nul
        goto :BOOT_CHECK
    )
    echo [OK] Emulator is ready!
)

:: === Step 9: Setup port forwarding ===
echo.
echo [STEP 9/12] Setting up port forwarding...
echo --------------------------------------------------------
adb reverse tcp:8081 tcp:8081 2>nul && echo    Port 8081: Metro Bundler
adb reverse tcp:8082 tcp:8082 2>nul && echo    Port 8082: Backup Metro
adb reverse tcp:19000 tcp:19000 2>nul && echo    Port 19000: Expo DevTools
adb reverse tcp:19001 tcp:19001 2>nul && echo    Port 19001: Expo DevTools

:: === Step 10: Start Metro bundler ===
echo.
echo [STEP 10/12] Starting Metro bundler...
echo --------------------------------------------------------
echo [INFO] Using Expo start for better stability

:: Clean node_modules/.bin temp files that cause permission errors
echo [INFO] Cleaning temporary files that cause Metro errors
for /f "delims=" %%f in ('dir /b "node_modules\.bin\." 2^>nul') do (
    del /f /q "node_modules\.bin\%%f" 2>nul
)

start "Metro Bundler" cmd /k "npx expo start --dev-client --clear"

:: Wait for Metro to start
echo.
echo Waiting for Metro bundler to start...
timeout /t 8 >nul

:: Check if Metro is responding
curl -s http://localhost:8081/status 2>nul | findstr "packager-status:running" >nul
if errorlevel 1 (
    echo [WARNING] Metro not responding on standard check
    echo [INFO] Checking if server is listening on port 8081
    netstat -an | findstr :8081 >nul
    if errorlevel 1 (
        echo.
        echo [ERROR] Metro failed to start! Check the Metro window for errors.
        echo.
        echo [INFO] Common fixes:
        echo   1. Kill all node processes: taskkill /f /im node.exe
        echo   2. Clear metro cache: npx expo start --clear
        echo   3. Fix node_modules permissions: npm run postinstall
        echo   4. Delete node_modules and reinstall: rm -rf node_modules; npm install
        echo.
        echo [INFO] Continuing with build attempt...
    ) else (
        echo [OK] Metro server is listening (may still be starting up)
    )
) else (
    echo [OK] Metro bundler is running!
)

:: === Step 11: Start Logcat ===
echo.
echo [STEP 11/12] Starting ADB logcat monitor...
echo --------------------------------------------------------
start "ADB Logcat" cmd /c "adb logcat -c && adb logcat *:S ReactNative:V ReactNativeJS:V AndroidRuntime:E ActivityManager:I"

:: === Step 12: Build and run ===
echo.
echo [STEP 12/12] Building and running Android app
echo --------------------------------------------------------
echo [INFO] This may take 2-5 minutes on first build
echo.

:: Try expo run first
call npx expo run:android
if errorlevel 1 (
    echo.
    echo [WARNING] Expo run failed, trying direct gradle build

    :: Fallback to manual gradle build
    cd android
    call gradlew.bat assembleDebug --stacktrace
    if errorlevel 1 (
        echo.
        echo [ERROR] Build failed! Check the error messages above.
        echo Common issues:
        echo - Java version mismatch (need Java 17)
        echo - Missing Android SDK components
        echo - Gradle sync issues
        cd ..
        pause
        exit /b 1
    )

    :: Install APK
    echo.
    echo [INFO] Installing APK
    adb install -r app\build\outputs\apk\debug\app-debug.apk
    if errorlevel 1 (
        echo.
        echo [ERROR] Installation failed!
        echo Try: adb uninstall com.logchirpy.app
        cd ..
        pause
        exit /b 1
    )

    :: Launch app
    echo.
    echo [INFO] Launching app
    adb shell am start -n com.logchirpy.app/.MainActivity
    cd ..
)

echo.
echo.
echo ========================================================
echo                    BUILD COMPLETE!                     
echo ========================================================
echo.
echo [SUCCESS] App should now be running!
echo.
echo --------------------------------------------------------
echo TROUBLESHOOTING TIPS:
echo --------------------------------------------------------
echo.
echo If you see "Unable to load script" error:
echo   1. Check the Metro window for bundle errors
echo   2. Press Ctrl+M (or shake device) and select "Reload"
echo   3. Or run: adb shell input keyevent 82
echo.
echo --------------------------------------------------------
echo QUICK COMMANDS:
echo --------------------------------------------------------
echo   - Reload app: adb shell input text "RR"
echo   - Dev menu: adb shell input keyevent 82
echo   - Check logs: See the "ADB Logcat" window
echo.
echo --------------------------------------------------------
echo WINDOWS OPEN:
echo --------------------------------------------------------
echo   - Metro Bundler - JavaScript bundler
echo   - ADB Logcat - Android logs
echo.
echo.
echo Press any key to stop all processes and exit
pause >nul

:: === Cleanup ===
echo.
echo.
echo [CLEANUP] Stopping all processes...
taskkill /f /fi "WINDOWTITLE eq Metro Bundler*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq ADB Logcat*" >nul 2>&1
adb reverse --remove-all >nul 2>&1

echo [DONE] All processes stopped. Goodbye!
echo.
endlocal
exit /b 0
