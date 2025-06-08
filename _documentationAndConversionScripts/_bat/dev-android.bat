@echo off
setlocal enabledelayedexpansion

:: Set UTF-8 encoding for better character support
chcp 65001 >nul 2>&1

:: Check if running with admin privileges (useful for some operations)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Not running as administrator. Some operations may fail.
)

:: Script version
set SCRIPT_VERSION=2.0

:: Setup logging
set "LOG_DIR=%USERPROFILE%\.logchirpy\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" 2>nul
set "LOG_FILE=%LOG_DIR%\android-build.log"

:: Parse command line arguments
set "SKIP_DEPS=0"
set "SKIP_CLEAN=0"
set "DEEP_CLEAN=0"
set "DEVICE_ID="
set "BUILD_TYPE=debug"

:PARSE_ARGS
if "%~1"=="" goto :ARGS_DONE
if /i "%~1"=="--help" goto :SHOW_HELP
if /i "%~1"=="-h" goto :SHOW_HELP
if /i "%~1"=="--skip-deps" set "SKIP_DEPS=1"
if /i "%~1"=="--skip-clean" set "SKIP_CLEAN=1"
if /i "%~1"=="--deep-clean" set "DEEP_CLEAN=1"
if /i "%~1"=="--device" set "DEVICE_ID=%~2" & shift
if /i "%~1"=="--release" set "BUILD_TYPE=release"
shift
goto :PARSE_ARGS

:ARGS_DONE

echo.
echo ========================================================
echo           LogChirpy Android Development Script          
echo                    Version %SCRIPT_VERSION%                     
echo ========================================================
echo.
echo This script will automatically:
echo   - Setup Android SDK environment
echo   - Install dependencies if needed
echo   - Clear caches and stop conflicting processes
echo   - Start Android emulator if no device is connected
echo   - Launch Metro bundler
echo   - Build and run the app (%BUILD_TYPE% mode)
echo.
if "%SKIP_DEPS%"=="1" echo [INFO] Skipping dependency check (--skip-deps)
if "%SKIP_CLEAN%"=="1" echo [INFO] Skipping cache clean (--skip-clean)
if "%DEEP_CLEAN%"=="1" echo [INFO] Deep clean mode enabled (--deep-clean)
if defined DEVICE_ID echo [INFO] Target device: %DEVICE_ID%
echo.
echo [INFO] Starting in 3 seconds... (Press Ctrl+C to cancel)
timeout /t 3 >nul
echo.

:: Record start time for performance tracking
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a "START_TIME=(((%%a*60)+%%b)*60+%%c)*100+%%d"
)

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
if "%SKIP_DEPS%"=="1" (
    echo [INFO] Skipping dependency check (--skip-deps flag)
) else (
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
)

:: Use working legacy expo commands (like the old script)
echo [INFO] Using legacy expo commands that actually work...
echo [INFO] Metro: expo start --dev-client --clear
echo [INFO] Android build: gradlew.bat assembleDebug + adb install
echo [INFO] Prebuild: expo prebuild --clean --no-install (with custom plugins)
echo [INFO] Custom Android plugin: Adds missing Fullscreen style for expo-video

:: === Step 4: Kill existing processes ===
echo.
echo [STEP 4/12] Stopping any existing Metro/Expo instances...
echo --------------------------------------------------------
echo [INFO] Checking for processes on port 8081...
for /f "tokens=1,2" %%a in ('netstat -ano ^| findstr :8081 2^>nul') do (
    echo [INFO] Killing process on port 8081: %%b
    taskkill /F /PID %%b >nul 2>&1
)
echo [INFO] Killing Metro and Expo processes...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *Metro*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *Expo*" >nul 2>&1
echo [INFO] Waiting 2 seconds...
timeout /t 2 >nul
echo [OK] Process cleanup completed

:: === Step 5: Clear all caches ===
echo.
echo [STEP 5/12] Clearing all caches...
echo --------------------------------------------------------
if "%SKIP_CLEAN%"=="1" (
    echo [INFO] Skipping cache cleanup (--skip-clean flag)
) else (
    echo [INFO] Clearing Metro caches...
    rd /s /q %TEMP%\metro-* 2>nul
    rd /s /q %TEMP%\react-* 2>nul
    rd /s /q %TEMP%\expo-* 2>nul
    
    echo [INFO] Clearing project caches...
    rd /s /q node_modules\.cache 2>nul
    rd /s /q .expo 2>nul
    
    echo [INFO] Clearing Android build caches...
    rd /s /q android\.gradle 2>nul
    rd /s /q android\app\build 2>nul
    
    if "%DEEP_CLEAN%"=="1" (
        echo [INFO] Performing deep clean...
        echo [INFO] Clearing npm cache...
        call npm cache clean --force >nul 2>&1
        echo [INFO] Removing additional temp files...
        rd /s /q %TEMP%\haste-* 2>nul
        del /q /s *.lock 2>nul
        echo [INFO] Deep clean completed
    )
    
    echo [OK] Caches cleared
)
echo [INFO] Step 5 completed, moving to Step 6...

:: === Step 6: Prebuild ===
echo.
echo [STEP 6/12] Running expo prebuild...
echo --------------------------------------------------------

:: Always run prebuild to ensure latest config (including custom plugins)
echo [INFO] Running prebuild to ensure Android config is up to date...

:: Use legacy expo that actually works
echo [INFO] Running expo prebuild (legacy)...
call npx expo prebuild --clean --no-install
set PREBUILD_EXIT=%ERRORLEVEL%
goto :PREBUILD_DONE

:PREBUILD_DONE
:: Initialize PREBUILD_EXIT if not set (when prebuild was skipped)
if not defined PREBUILD_EXIT set PREBUILD_EXIT=0

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
    if not "%PREBUILD_EXIT%"=="0" echo        - Prebuild exit code: %PREBUILD_EXIT%
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

:: === Step 8: Start Android emulator ===
echo.
echo [STEP 8/12] Starting Android emulator...
echo --------------------------------------------------------

:: Reset ADB
adb kill-server >nul 2>&1
timeout /t 2 >nul
adb start-server >nul 2>&1

:: Check if any device is already connected
adb devices | findstr -v "List of devices" | findstr "device\|emulator" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Device/emulator already running
    goto :DEVICE_READY
)

:: No device found, start first available emulator
echo [INFO] Starting first available emulator...
for /f "delims=" %%e in ('emulator -list-avds 2^>nul') do (
    echo [INFO] Launching emulator: %%e
    start "Android Emulator" emulator -avd %%e -gpu host -no-audio
    goto :WAIT_FOR_EMULATOR
)

:: No AVDs found
echo [ERROR] No Android Virtual Devices found!
echo [INFO] Create an AVD in Android Studio first.
pause
exit /b 1

:WAIT_FOR_EMULATOR
echo [INFO] Waiting for emulator to start...
adb wait-for-device
timeout /t 10 >nul
echo [OK] Emulator ready!

:DEVICE_READY

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

:: Ensure we're in the right directory
cd /d "%~dp0"

:: Clean node_modules/.bin temp files that cause permission errors
echo [INFO] Cleaning temporary files that cause Metro errors
for /f "delims=" %%f in ('dir /b "node_modules\.bin\." 2^>nul') do (
    del /f /q "node_modules\.bin\%%f" 2>nul
)

:: Start Metro with modern expo command
echo [INFO] Starting Metro bundler...
start "Metro Bundler" cmd /c "cd /d "%CD%" && call npx expo start --dev-client --clear"

:: Wait for Metro to initialize
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
echo [INFO] Build type: %BUILD_TYPE%
echo [INFO] This may take 2-5 minutes on first build

:: Check Java version
echo [INFO] Checking Java version...
for /f "tokens=*" %%i in ('java -version 2^>^&1 ^| findstr "version"') do (
    echo [INFO] Java version: %%i
    goto :JAVA_CHECKED
)
:JAVA_CHECKED
echo.

:: Device should be ready from previous step

:: Set build variant based on build type
set "BUILD_VARIANT="
if "%BUILD_TYPE%"=="release" (
    set "BUILD_VARIANT=--variant release"
    echo [INFO] Building release APK...
) else (
    echo [INFO] Building debug APK...
)

:: Build device targeting arguments
set "DEVICE_ARGS="
if defined DEVICE_ID (
    set "DEVICE_ARGS=--device %DEVICE_ID%"
    echo [INFO] Targeting device: %DEVICE_ID%
)

:: Use modern expo commands
echo [INFO] Running npx expo run:android command...
call npx expo run:android --no-bundler %BUILD_VARIANT% %DEVICE_ARGS%
if errorlevel 1 (
    echo.
    echo [WARNING] Expo run failed, trying direct gradle build

    :: Fallback to manual gradle build
    cd android
    if "%BUILD_TYPE%"=="release" (
        echo [INFO] Building release APK with gradle...
        call gradlew.bat assembleRelease --stacktrace
        set "GRADLE_EXIT=%ERRORLEVEL%"
        set "APK_PATH=app\build\outputs\apk\release\app-release.apk"
    ) else (
        echo [INFO] Building debug APK with gradle...
        call gradlew.bat assembleDebug --stacktrace
        set "GRADLE_EXIT=%ERRORLEVEL%"
        set "APK_PATH=app\build\outputs\apk\debug\app-debug.apk"
    )
    
    echo [INFO] Gradle exit code: %GRADLE_EXIT%
    if "%GRADLE_EXIT%" NEQ "0" (
        echo.
        echo [ERROR] Build failed! Check the error messages above.
        echo Common issues:
        echo - Java version mismatch (need Java 17)
        echo - Missing Android SDK components
        echo - Gradle sync issues
        echo.
        call :LOG ERROR "Gradle build failed"
        cd ..
        echo.
        echo Would you like to try quick fixes?
        set /p TRY_FIX="Enter Y to open fix menu, or any key to exit: "
        if /i "%TRY_FIX%"=="Y" call :QUICK_FIX
        exit /b 1
    )

    :: Install APK
    echo.
    echo [INFO] Installing APK: %APK_PATH%
    if defined DEVICE_ID (
        adb -s %DEVICE_ID% install -r %APK_PATH%
    ) else (
        adb install -r %APK_PATH%
    )
    if errorlevel 1 (
        echo.
        echo [ERROR] Installation failed!
        if defined DEVICE_ID (
            echo Try: adb -s %DEVICE_ID% uninstall com.logchirpy.app
        ) else (
            echo Try: adb uninstall com.logchirpy.app
        )
        cd ..
        pause
        exit /b 1
    )

    :: Launch app
    echo.
    echo [INFO] Launching app
    if defined DEVICE_ID (
        adb -s %DEVICE_ID% shell am start -n com.logchirpy.app/.MainActivity
    ) else (
        adb shell am start -n com.logchirpy.app/.MainActivity
    )
    cd ..
)

:: Calculate build time
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a "END_TIME=(((%%a*60)+%%b)*60+%%c)*100+%%d"
)
set /a "ELAPSED_TIME=(%END_TIME%-%START_TIME%)/100"
set /a "ELAPSED_MIN=%ELAPSED_TIME%/60"
set /a "ELAPSED_SEC=%ELAPSED_TIME%%%60"

echo.
echo.
echo ========================================================
echo                    BUILD COMPLETE!                     
echo ========================================================
echo.
echo [SUCCESS] App should now be running!
echo [TIME] Build completed in %ELAPSED_MIN%m %ELAPSED_SEC%s
echo.
call :LOG INFO "Build completed successfully in %ELAPSED_MIN%m %ELAPSED_SEC%s"

:: Save success state
echo %date% %time% > "%USERPROFILE%\.logchirpy\last_successful_build.txt"
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

:: === Helper Functions ===

:ENSURE_DEVICE_READY
:: Re-check for devices before running
set "DEVICE_CHECK=0"
for /f "skip=1 tokens=1,2" %%a in ('adb devices 2^>nul') do (
    if /i "%%b"=="device" set "DEVICE_CHECK=1"
    if /i "%%b"=="emulator" set "DEVICE_CHECK=1"
)

if "%DEVICE_CHECK%"=="0" (
    echo.
    echo [WARNING] No device connected after emulator launch
    echo [INFO] Waiting 30 more seconds for emulator to fully boot...
    timeout /t 30 >nul
    
    :: Final check
    for /f "skip=1 tokens=1,2" %%a in ('adb devices 2^>nul') do (
        if /i "%%b"=="device" set "DEVICE_CHECK=1"
        if /i "%%b"=="emulator" set "DEVICE_CHECK=1"
    )
    
    if "%DEVICE_CHECK%"=="0" (
        echo [ERROR] Still no device available. Please check emulator status.
        pause
        exit /b 1
    )
)
echo [OK] Device is ready
goto :EOF

:SHOW_HELP
echo.
echo LogChirpy Android Development Script - Help
echo ========================================================
echo.
echo Usage: dev-android.bat [options]
echo.
echo Options:
echo   --help, -h         Show this help message
echo   --skip-deps        Skip dependency installation check
echo   --skip-clean       Skip cache cleaning step
echo   --device ID        Target specific device by ID
echo   --release          Build release version instead of debug
echo   --deep-clean       Perform deep cache clean (including npm cache)
echo.
echo Examples:
echo   dev-android.bat                    Run with default settings
echo   dev-android.bat --skip-deps        Skip npm install check
echo   dev-android.bat --device emulator-5554   Use specific device
echo   dev-android.bat --release          Build release APK
echo.
echo Environment Variables:
echo   ANDROID_HOME       Path to Android SDK (auto-detected if not set)
echo   ANDROID_SERIAL     Default device to use
echo.
exit /b 0

:LOG
:: Usage: call :LOG LEVEL "message"
set "LOG_LEVEL=%~1"
set "LOG_MSG=%~2"
set "TIMESTAMP=%date% %time%"
echo [%TIMESTAMP%] [%LOG_LEVEL%] %LOG_MSG% >> "%LOG_FILE%"
if /i "%LOG_LEVEL%"=="ERROR" (
    echo [ERROR] %LOG_MSG% >&2
    echo [%TIMESTAMP%] [ERROR] %LOG_MSG% >> "%LOG_DIR%\errors.log"
)
goto :EOF

:NETWORK_CHECK
:: Check internet connectivity
ping -n 1 8.8.8.8 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] No internet connection detected
    echo [INFO] Some features may not work properly
    set "OFFLINE_MODE=1"
    call :LOG WARNING "No internet connection"
) else (
    echo [OK] Internet connection verified
)

:: Check if behind proxy
if defined HTTP_PROXY (
    echo [INFO] HTTP Proxy detected: %HTTP_PROXY%
    call :LOG INFO "Using proxy: %HTTP_PROXY%"
)
if defined HTTPS_PROXY (
    echo [INFO] HTTPS Proxy detected: %HTTPS_PROXY%
)
goto :EOF

:QUICK_FIX
echo.
echo ========================================================
echo                    Quick Fix Menu                      
echo ========================================================
echo.
echo Select an option to fix common issues:
echo.
echo [1] Kill all Java/Node processes and retry
echo [2] Clear all caches and rebuild
echo [3] Reset ADB and reconnect devices
echo [4] Fix Metro bundler issues
echo [5] Reinstall node_modules
echo [6] Switch to different emulator
echo [0] Exit
echo.
set /p FIX_CHOICE="Enter choice (0-6): "

if "%FIX_CHOICE%"=="1" (
    echo [INFO] Killing all Java and Node processes...
    taskkill /f /im java.exe 2>nul
    taskkill /f /im node.exe 2>nul
    timeout /t 2 >nul
    echo [INFO] Please restart the script manually
)
if "%FIX_CHOICE%"=="2" (
    echo [INFO] Performing deep clean...
    call :CLEAN_ALL_DEEP
    echo [INFO] Please restart the script manually
)
if "%FIX_CHOICE%"=="3" (
    echo [INFO] Resetting ADB...
    adb kill-server
    timeout /t 2 >nul
    adb start-server
    adb devices
    pause
)
if "%FIX_CHOICE%"=="4" (
    echo [INFO] Fixing Metro bundler...
    rd /s /q %TEMP%\metro-* 2>nul
    taskkill /f /fi "WINDOWTITLE eq *Metro*" 2>nul
    echo [INFO] Start Metro manually with: npx expo start --clear
)
if "%FIX_CHOICE%"=="5" (
    echo [INFO] Reinstalling dependencies...
    rd /s /q node_modules 2>nul
    npm install
    echo [INFO] Please restart the script manually
)
if "%FIX_CHOICE%"=="6" (
    echo [INFO] Available emulators:
    emulator -list-avds
    echo.
    set /p NEW_AVD="Enter AVD name: "
    if defined NEW_AVD emulator -avd %NEW_AVD% -gpu host
)
goto :EOF

:CLEAN_ALL_DEEP
echo [INFO] Performing deep clean...
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\react-* 2>nul
rd /s /q %TEMP%\haste-* 2>nul
rd /s /q %TEMP%\expo-* 2>nul
rd /s /q node_modules\.cache 2>nul
rd /s /q .expo 2>nul
rd /s /q android\.gradle 2>nul
rd /s /q android\app\build 2>nul
rd /s /q android\build 2>nul
del /q /s *.lock 2>nul
npm cache clean --force 2>nul
echo [OK] Deep clean completed
goto :EOF
