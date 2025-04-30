@echo off
setlocal ENABLEEXTENSIONS

:: Gets the absolute path to this script's directory
set "PROJECT_PATH=%~dp0"
:: Remove trailing backslash if present
if "%PROJECT_PATH:~-1%"=="\" set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

:: Map the project path to drive X:
subst X: "%PROJECT_PATH%"
:: Move to the substituted drive
pushd X:\%~n0

:: -------- START Metro bundler --------
start "Metro Bundler" cmd /c "npx expo start --dev-client"

:: -------- Start emulator (change to your AVD name if needed) --------
start "Emulator" cmd /c ""%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" @Pixel_6_Pro"

:: Wait for Metro + emulator to boot
timeout /t 10 >nul

:: -------- Run Android build --------
call npx expo run:android

:: -------- Start logcat in separate window --------
start "ADB Logcat" cmd /c "adb logcat *:S ReactNative:V ReactNativeJS:V VisionCamera:V"

:: Clean up subst drive
subst X: /d
endlocal
