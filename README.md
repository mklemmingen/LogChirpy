DOWNGRADE TO JAVA 17! ADD TO JAVA_HOME (windows) as well as PATH!

https://adoptium.net/temurin/archive/?version=17

-------------------------

source for the bird image classifier:
https://github.com/rprkh/Bird-Classifier


(converted label txt into the .tflite with own python metadata writer, see conversion script folder)

-------------------------


added a concurrently script to package json so we can: 

npm run dev:android

make sure you change the route to your emulator in the dev-android.bat script before!

Part of the script:

:: === Start Android emulator (adjust name if needed) ===

start "Emulator" cmd /c ""%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" @Pixel_6_Pro"


-------------------------

# Project README | or how I learned to love the Expo

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Launch: Single-Command PowerShell Function](#quick-launch-single-command-powershell-function)
3. [Alternative Two-Tab PowerShell Workflow](#alternative-two-tab-powershell-workflow)
4. [WSL2-Based Local Android Builds](#wsl2-based-local-android-builds)
   - [1. Install WSL2](#1-install-wsl2)
   - [2. Install Linux Tools](#2-install-linux-tools)
   - [3. Clone the Repository](#3-clone-the-repository)
   - [4. Install JavaScript Dependencies](#4-install-javascript-dependencies)
   - [5. Prebuild Native Projects](#5-prebuild-native-projects)
   - [6. USB Debugging Setup with `usbipd-win`](#6-usb-debugging-setup-with-usbipd-win)
   - [7. Launch the Expo Android App](#7-launch-the-expo-android-app)
5. [Advanced Configuration](#advanced-configuration)
   - [Gradle Native Build Disables](#gradle-native-build-disables)
   - [APK Build via Android Studio](#apk-build-via-android-studio)
6. [Android SDK & Emulator for WebStorm](#android-sdk--emulator-for-webstorm)
7. [Troubleshooting & Tips](#troubleshooting--tips)
8. [References](#references)

---

## Prerequisites

- **Node.js & npm** (latest LTS)
- **Expo CLI**: `npm install -g expo-cli`
- **Android SDK & Platform Tools**
- **PowerShell** (Windows)
- **Windows Subsystem for Linux 2 (WSL2)** for local builds (optional)
- **usbipd-win** (for WSL2 USB forwarding)

---

## Quick Launch: Single-Command PowerShell Function

Define a reusable PowerShell function that maps your project to the `X:` drive and runs your Expo Android build:

```powershell
function Start-ExpoAndroid {
    param(
        [string]$ProjectPath = 'C:\Path\To\Your\Project'
    )

    # 1. Map X: to your project (skip if already mapped)
    if (-not (Test-Path X:\)) {
        subst X: $ProjectPath
    }

    # 2. Change to mapped drive
    Push-Location X:\

    # 3. Build & launch on Android
    npx expo run:android

    # 4. Restore previous location (and optionally unmap)
    Pop-Location
    # To always unmap, uncomment:
    # subst X: /D
}

# Usage:
Start-ExpoAndroid -ProjectPath 'C:\Users\YourUser\WebstormProjects\my-app'
```

---

## Alternative Two-Tab PowerShell Workflow

Use this workflow to keep Metro running in one tab and launch on Android in another.

### Tab 1: Start Metro

```powershell
# 1. Map project to X:\ (if needed)
if (-not (Test-Path X:\)) {
  subst X: 'C:\Path\To\Your\Project'
}

# 2. Launch Metro with dev client & tunnel
npx --prefix X:\ expo start --dev-client --tunnel
```

### Tab 2: Run on Android

```powershell
# 1. Ensure X: is mapped
if (-not (Test-Path X:\)) {
  subst X: 'C:\Path\To\Your\Project'
}

# 2. Build & launch on Android
npx --prefix X:\ expo run:android

# 3. (Optional) Unmap X: when done
subst X: /D
```

> **Tip:** Press `a` in the Expo Metro terminal (Tab 1) to open the app on a connected device.

---

## WSL2-Based Local Android Builds

Follow these steps to build and deploy your Expo Android app from a Linux environment on Windows, using a USB-connected device.

### 1. Install WSL2

```powershell
# Open PowerShell as Administrator:
wsl --install -d Ubuntu
# Reboot when prompted.
```

Launch Ubuntu from Start, then set your Linux user credentials.

### 2. Install Linux Tools

```bash
# In your Ubuntu shell:
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip adb android-sdk-platform-tools
```

### 3. Clone the Repository

1. Generate a GitLab access token with **read_repository** scope.
2. In Ubuntu:
   ```bash
   export GITLAB_TOKEN="glpat-<YOUR_TOKEN>"
   git clone https://oauth2:${GITLAB_TOKEN}@gitlab.example.com/your-user/your-repo.git
   cd your-repo

   # Optional: stash local changes and switch branches
   git stash
   git fetch origin
   git checkout 'your-feature-branch'
   ```

### 4. Install JavaScript Dependencies

```bash
npm install --legacy-peer-deps
```

This resolves potential peer conflicts (e.g., TensorFlow ↔ expo-camera).

### 5. Prebuild Native Projects

```bash
npx expo prebuild --clean
```

Regenerates the `android/` and `ios/` directories based on your configuration.

### 6. USB Debugging Setup with `usbipd-win`

1. Download & install **usbipd-win** MSI from [the GitHub releases page].
2. In Windows PowerShell (Admin):
   ```powershell
   usbipd list
   usbipd bind --busid <BUSID>
   usbipd attach --busid <BUSID>
   adb devices  # Verify your device serial appears
   ```
3. In WSL:
   ```bash
   unset ADB_SERVER_SOCKET
   adb kill-server && adb start-server
   adb devices  # Your device should appear here
   ```

### 7. Launch the Expo Android App

```bash
npx expo run:android
```

Expo CLI will detect the WSL-visible device and install the debug APK.

---

## Advanced Configuration

### Gradle Native Build Disables

In your **`root build.gradle`**, disable unwanted native builds:

```groovy
gradle.projectsEvaluated {
  subprojects { project ->
    if (project.name.contains("expo-gl")) {
      project.tasks.configureEach { task ->
        if (task.name.contains("externalNativeBuild")) {
          task.enabled = false
        }
      }
    }
  }
}

subprojects { subproject ->
  if (subproject.name.contains('react-native-reanimated')) {
    subproject.buildDir = file("${rootProject.buildDir}/${subproject.name}")
    subproject.tasks.configureEach { task ->
      if (task.name.contains('externalNativeBuild')) {
        task.enabled = false
      }
    }
  }
}
```

### APK Build via Android Studio

1. Open `node_modules/expo-gl/android/build.gradle`.
2. Add after existing plugins:
   ```groovy
   android {
     compileSdkVersion 35
     defaultConfig {
       minSdkVersion 24
       targetSdkVersion 34
     }
   }
   ```
3. Open the `android/` folder in Android Studio and build APKs via the **Build** menu.

---

## Android SDK & Emulator for WebStorm

1. **Install Android Studio** (provides SDK, Emulator, ADB).
2. In **SDK Manager**:
   - **SDK Platforms**: Install Android 12/13.
   - **SDK Tools**: Ensure **Platform Tools**, **Emulator**, **Build Tools**, and **Intel HAXM** (Intel CPUs) are installed.
3. In **AVD Manager**, create and launch a virtual device (e.g., Pixel 6 with Android 13).
4. In your project directory, run:
   ```bash
   eas build -p android --profile production
   ```
   Download the resulting `.apk` from Expo’s build page.

---

## Troubleshooting & Tips

- **Mapping Issues**: Always check `Test-Path X:\` before `subst`.
- **ADB Conflicts**: Clear `ADB_SERVER_SOCKET` in WSL when using `usbipd-win`.
- **Peer Dependency Errors**: Use `npm install --legacy-peer-deps`.
- **Long Path Errors**: Leverage WSL2 to avoid Windows path-length limits.

---

## References

- [@infinitered/react-native-mlkit-object-detection npm package](https://www.npmjs.com/package/@infinitered/react-native-mlkit-object-detection)
- [usbipd-win Releases](https://github.com/dorssel/usbipd-win/releases)
- [WSL2 Installation Guide](https://docs.microsoft.com/windows/wsl/install)

