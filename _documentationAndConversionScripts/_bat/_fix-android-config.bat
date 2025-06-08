@echo off
echo ================================================
echo === Fixing Android Configuration ===
echo ================================================

:: Fix the MainActivity component name
echo [INFO] Fixing MainActivity.kt component name...
powershell -Command "(Get-Content android\app\src\main\java\com\logchirpy\app\MainActivity.kt) -replace 'override fun getMainComponentName\(\): String = \"main\"', 'override fun getMainComponentName(): String = \"App\"' | Set-Content android\app\src\main\java\com\logchirpy\app\MainActivity.kt"

:: Uncomment the theme
echo [INFO] Fixing splash screen theme...
powershell -Command "(Get-Content android\app\src\main\java\com\logchirpy\app\MainActivity.kt) -replace '// setTheme\(R.style.AppTheme\);', 'setTheme(R.style.AppTheme);' | Set-Content android\app\src\main\java\com\logchirpy\app\MainActivity.kt"

:: Create a proper metro.config.js if it doesn't exist
echo [INFO] Checking metro.config.js...
if not exist metro.config.js (
    echo [INFO] Creating metro.config.js...
    (
        echo const { getDefaultConfig } = require^('expo/metro-config'^);
        echo.
        echo const config = getDefaultConfig^(__dirname^);
        echo.
        echo module.exports = config;
    ) > metro.config.js
)

:: Ensure index.js is correct for Expo Router
echo [INFO] Fixing index.js for Expo Router...
(
    echo import 'expo-router/entry';
) > index.js

:: Clean build folders
echo [INFO] Cleaning build artifacts...
rd /s /q android\app\build 2>nul
rd /s /q android\.gradle 2>nul
rd /s /q node_modules\.cache 2>nul

:: Clear Metro cache
echo [INFO] Clearing Metro cache...
npx expo start --clear

echo.
echo [SUCCESS] Configuration fixed!
echo.
echo Next steps:
echo 1. Run 'dev-android-verbose.bat' to build and debug
echo 2. If it still fails, check the verbose output
echo.
pause