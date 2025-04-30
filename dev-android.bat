@echo off
setlocal ENABLEEXTENSIONS

:: === MAKE SURE IF YOU ARE ON WINDOWS, YOU HAVE THE PROJECT NEAR THE ROOT OF YOUR DRIVE! ===

:: === Resolve project path and remove trailing backslash ===
set "PROJECT_PATH=%~dp0"
if "%PROJECT_PATH:~-1%"=="\" set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

:: === Ensure node_modules exists ===
if not exist node_modules (
    echo [INFO] node_modules folder missing. Running npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Aborting build.
        subst X: /d
        endlocal
        exit /b 1
    )
)

:: === Run Expo prebuild to sync native code ===
echo [INFO] Running expo prebuild...
call npx expo prebuild --clean --no-install
if errorlevel 1 (
    echo [ERROR] Expo prebuild failed. Aborting.
    subst X: /d
    endlocal
    exit /b 1
)

:: === Clean old build artifacts ===
echo Cleaning build artifacts...
if exist android\gradlew.bat (
    pushd android
    call gradlew.bat clean
    popd
)

rmdir /s /q .expo >nul 2>&1
rmdir /s /q node_modules\.cache >nul 2>&1

:: === Use drive X: to shorten long paths (helps with reanimated build) ===
subst X: "%PROJECT_PATH%"
:: Move to the substituted drive
pushd X:\%~n0

:: === Start Metro bundler ===
echo Current directory is: %CD%
if not exist android\ (
    echo ERROR: You are not in the project root! Aborting.
    subst X: /d
    endlocal
    exit /b 1
)
start "Metro Bundler" cmd /c "npx expo start --dev-client"

:: === Start Android emulator (adjust name if needed) ===
start "Emulator" cmd /c ""%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" @Pixel_6_Pro"

:: === Wait for boot time ===
timeout /t 10 >nul

:: === Run Expo Android build ===
echo Current directory is: %CD%
if not exist android\ (
    echo ERROR: You are not in the project root! Aborting.
    subst X: /d
    endlocal
    exit /b 1
)

:: === Run the Android build ===
call npx expo run:android

:: === Start ADB Logcat viewer ===
start "ADB Logcat" cmd /c "adb logcat *:S ReactNative:V ReactNativeJS:V VisionCamera:V"

:: === Unmap the virtual X: drive ===
subst X: /d
endlocal
