@echo off
setlocal ENABLEEXTENSIONS

:: === Resolve project path and remove trailing backslash ===
set "PROJECT_PATH=%~dp0"
if "%PROJECT_PATH:~-1%"=="\" set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

:: === Use drive X: to shorten long paths (helps with reanimated build) ===
subst X: "%PROJECT_PATH%"
:: Move to the substituted drive
pushd X:\%~n0

:: === Clean old build artifacts ===
echo Cleaning build artifacts...
if exist android\gradlew.bat (
    pushd android
    call gradlew.bat clean
    popd
)
rmdir /s /q .expo >nul 2>&1
rmdir /s /q node_modules\.cache >nul 2>&1

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

:: === TEMPORARY FIX ===
set REANIMATED_DISABLE_CMAKE=true

:: === Run the Android build ===
call npx expo run:android

:: === Start ADB Logcat viewer ===
start "ADB Logcat" cmd /c "adb logcat *:S ReactNative:V ReactNativeJS:V VisionCamera:V"

:: === Unmap the virtual X: drive ===
subst X: /d
endlocal
