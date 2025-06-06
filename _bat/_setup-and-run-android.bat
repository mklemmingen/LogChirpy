@echo off
echo ================================================
echo === Android Development Setup & Run ===
echo ================================================

:: Try to find Android SDK in common locations
echo [INFO] Looking for Android SDK...

if exist "%LOCALAPPDATA%\Android\Sdk" (
    set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
    echo [OK] Found Android SDK at %LOCALAPPDATA%\Android\Sdk
) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
    set ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk
    echo [OK] Found Android SDK at %USERPROFILE%\AppData\Local\Android\Sdk
) else if exist "C:\Android\Sdk" (
    set ANDROID_HOME=C:\Android\Sdk
    echo [OK] Found Android SDK at C:\Android\Sdk
) else (
    echo [ERROR] Android SDK not found in common locations!
    echo.
    echo Please install Android Studio and Android SDK, then run this script again.
    echo Download from: https://developer.android.com/studio
    echo.
    echo If you have Android SDK installed elsewhere, set ANDROID_HOME:
    echo   set ANDROID_HOME=path\to\your\sdk
    echo.
    pause
    exit /b 1
)

:: Add Android tools to PATH
set PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%ANDROID_HOME%\tools;%ANDROID_HOME%\tools\bin;%PATH%

:: Verify adb is available
where adb >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ADB not found even after setting paths!
    echo Please check your Android SDK installation.
    pause
    exit /b 1
)

echo [OK] ADB found at:
where adb
echo.

:: Check for running emulator
echo [INFO] Checking for Android devices...
adb devices
echo.

:: Count devices (excluding the header line)
for /f "skip=1 tokens=*" %%i in ('adb devices') do (
    set DEVICE_FOUND=1
    goto :device_check_done
)
:device_check_done

if not defined DEVICE_FOUND (
    echo [WARNING] No Android device or emulator found!
    echo.
    echo Would you like to:
    echo 1. Start Android emulator (requires Android Studio AVD)
    echo 2. Connect physical device via USB
    echo 3. Exit
    echo.
    set /p choice="Enter choice (1-3): "
    
    if "%choice%"=="1" (
        echo [INFO] Starting Android emulator...
        start "" "%ANDROID_HOME%\emulator\emulator.exe" -list-avds
        echo.
        echo Please start an emulator from Android Studio AVD Manager
        echo Then press any key to continue...
        pause >nul
    ) else if "%choice%"=="3" (
        exit /b 0
    )
)

:: Setup port forwarding
echo [INFO] Setting up port forwarding...
adb reverse tcp:8081 tcp:8081

:: Clear caches
echo [INFO] Clearing build caches...
cd android
call gradlew clean
cd ..

:: Run the app using npm script
echo [INFO] Starting the app...
echo.
npm run android

pause