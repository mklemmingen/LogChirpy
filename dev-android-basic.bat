@echo off
setlocal enabledelayedexpansion
echo ================================================
echo === React Native Expo Android Build Script ===
echo ================================================
:: === Step 0: Ensure Expo CLI is installed ===
where expo >nul 2>&1
if errorlevel 1 (
    echo [INFO] Expo not found globally. Installing now...
    call npm install -g expo
    if errorlevel 1 (
        echo [ERROR] Failed to install expo
        exit /b 1
    )
) else (
    echo [INFO] Expo is installed.
)
:: === Step 1: Confirm we are in a valid project ===
if not exist package.json (
    echo [ERROR] This script must be run from the root of your Expo project.
    exit /b 1
)
:: === Step 2: Check node_modules ===
if not exist node_modules (
    echo [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        exit /b 1
    )
)
:: === Step 3: Expo prebuild (sync native code) ===
echo [INFO] Running expo prebuild...
call npx expo prebuild --clean --no-install
if errorlevel 1 (
    echo [ERROR] Prebuild failed.
    exit /b 1
)
:: === Step 4: Clean artifacts ===
echo [INFO] Cleaning build artifacts...
if exist android\gradlew.bat (
    pushd android
    call gradlew.bat clean
    popd
)
rd /s /q .expo 2>nul
rd /s /q node_modules\.cache 2>nul
:: === Step 6: Check for emulator/device ===
set EMU_RUNNING=false
for /f "tokens=*" %%i in ('adb devices ^| findstr /i "emulator"') do (
    set EMU_RUNNING=true
)
if "!EMU_RUNNING!"=="false" (
    echo [INFO] Starting first available AVD...
    for /f "delims=" %%e in ('"%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -list-avds') do (
        echo [INFO] Launching emulator: %%e
        start "" "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" @%%e
        goto :WAIT_FOR_BOOT
    )
    echo [ERROR] No AVDs found. Please create one via Android Studio.
    exit /b 1
)
:WAIT_FOR_BOOT
echo [INFO] Waiting for device to boot...
set /a countdown=20
:boot_spinner
set /a filled=20 - countdown
set /a empty=countdown
set "bar=["
for /L %%i in (1,1,!filled!) do set "bar=!bar!#"
for /L %%i in (1,1,!empty!) do set "bar=!bar!."
set "bar=!bar!] !countdown!s remaining..."
<nul set /p=!bar!
timeout /t 1 >nul
echo.
set /a countdown-=1
if !countdown! gtr 0 goto boot_spinner
:: === Step 7: Ensure dev client is installed ===
:: === Step 8: Start Logcat ===
start "ADB Logcat" cmd /c "adb logcat :S ReactNative:V ReactNativeJS:V VisionCamera:V"
:: === Step 9: Launch Expo app ===
echo [INFO] Launching app via Metro...
start /wait "Metro Bundler" cmd /c "npx expo run:android"
if errorlevel 1 (
    echo [ERROR] App launch failed.
    exit /b 1
)
:: === Step 10: Cleanup ===
echo [INFO] Metro closed. Shutting down emulator and logcat...
taskkill /f /im emulator.exe >nul 2>&1
taskkill /f /im adb.exe >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq ADB Logcat" >nul 2>&1
echo [INFO] Cleanup complete. All done!
endlocal
exit /b 0
