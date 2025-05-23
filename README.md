<table style="width:100%;">

<tr>
    <td style="width:50%;">
      <h3>LogChirpy - ornithological archival app</h3>
       <p> 🔄 Ongoing Develoment </p>
      <p>🌐 AGPL-3.0 License</p>
      <p><strong>Tech:</strong> TensorflowJs, Typescript, Javascript, React Native, Expo, SQL, Firebase, Relational Databasing, Batch Scripts, Android and Ios Building</p>
      <p><strong>Time:</strong> Q2-Q3 2025</p>
      <p>App to live-camera-feed identify birds, as well as archive log, identify on picture and sounds, synchronise and display. Uses mobile object detection and classification of image and audio data, completely local. And optionally syncs to firestore with authentication and DSGVO-conformity.</p>
      <a href="https://github.com/mklemmingen/LogChirpy">
        <img src="https://img.shields.io/static/v1?label=mklemmingen&message=LogChirpy&color=brown&logo=github" alt="GitHub Repo">
      </a>
    </td>
    <td align="center"  style="width:50%;">
      <a>
        <img src="https://github.com/mklemmingen/mklemmingen/blob/2e0097a5f41866463d8746eed09821d5a46f3e6e/LogChirpy%20(2).gif" alt="gif of working LogChirpy Object Detection and Classification" height="150">
      </a>
    </td>
  
  </tr>
</table>

# TO-DOS:

- photo könnte eine gemachte kamera nutzen, die bilder macht und im media speicher des handys ablegt. Es sollte beim gps zu den bildern hinzufügen die setting toggle über gps logging beachtet werden. Über einen Custom Button sollte dann auf manual weitergegangen werden können, wo man (bisher noch nicht) mit einem klick auf image.add das bild in den LogContextProvider laden sollte und das bild darstellen.

- Video sollte genauso eine bestehende best practice lösung nutzen, die alles was die geräte kamera kann halt nutzen soll. Gleiches Prinzip wie bei photo, mit custom button, und dann in manual das auswählen und anzeigen

- audio genau das gleiche, wobei die audio sequenz dargestellt werden sollte, weniger komplex wie bei BirdNet, aber aussagekräftig, mit möglichkeit des schneidens, des speicherns, und der übergabe an manuel

- Save to Log und Delete in ObjectDetectionCamera Modal View (ganz unten im return)

Files funktionieren! die package und die best practice methoden mit error-catching ist in CameraObjectDetection.tsx in log

# Done Tasks:

## Marty Lauterbach

- Project Concept
- custom dev client setup
- batch script for android emulation
- metro config
- app.config.ts config for dev client
- expo config


- README setup guide
- CI/CD pipeline to Github
- EAS build setup and custom eas.json


- BirdAnimation for the background root index with custom spritesheet slicing and on-click bird sounds


- Theme with Hooks
- Slider, ThemedSnackbar, Section, NoCameraView, SettingsSection - Component and Custom IconSymbols that fit and have birds
- Dark Mode / Light Mode and Frontend-Structure Implementation with Components

- Tabs Structure


- Archive Database Structure Async on Device, with startup sql database creation and init
- archive with visualization, sorting, searching


- Localization
- Settings
- logging structure with context provider
- logging manual with:
- - Video Component (rudimentary concept structure)
- - Image Component (rudimentary concept structure)
- - Audio Component (rudimentary concept structure)
- - Direct Manual (frontend and backend structure without storage access on button click)


- ML Model Training (Object Detection)
- ML Model Integration (Object Detection and Classification (see source)) by wrapping the root layout with all models at startup
- Model Conversion from weights to .tflite as well as integration of labels into existing models in .tflite format (see _model_conversion for the python script and other received or trained models)
- Custom Camera Component with MLKit Object Detection and Image Classification | both full image and detected objects get classified with bird classifier
- - custom image and live view
- - custom rectangles with labels and confidence values
- - custom photo to data/0 storage to model pipeline
- - custom photo if over settable confidence value to media storage (confidence slider)
- - custom settable delay between photo to pipeline for making sure device not overwhelmed by models (confidence slider)

Challenges:


- Switching from a simple ExpoGo compatible build to a custom dev client build was a challenge, as it required creating custom configs for eas, metro, the package.json and the app.config.ts.
-> solved by creating the configs in the root folder and using a custom batch script that handles un-staling, installing and running the emulator with the custom dev client build and the two-port servers. Had to find the best practice for save-dev'ing the package installations to the package.json, as well as the metro.config.js and app.config.ts, as files needed to override dependencies and ask for permission for the android build with gradle as well as the cmake process and the javascript conversion.


- Handling Files on Android took a while, since the ExpoGo build does not support file handling and the custom dev client build required a lot of custom async code handling for not accessing unsaved files in the object and image classification pipeline.


- Object Detection and Image Classification as well as Custom Camera Component took quite a while to get working, 

-> Used a couple old react-native packages that were not well maintained and had a lot of issues with the latest react-native versions, as well as deprecated expo-images and expo-camera packages.

-> finally stumbled upon two packages for MLKit Object Detection and Image Classification that were well maintained, using the same core (it came from the same developers) and worked with the latest react-native versions, that I could wrap around the root _layout for quick context provider access to the models.

-> creation fitting input and output models with labels was a challenge, since I had to learn output formatting and how to convert the weights to .tflite format. I used a couple of different models, 
but finally ended up with a custom trained model from github that was able to detect birds in the wild with a good accuracy, that I simply wrote the accompanying .labels.txt file to a .tflite file with the python script in the _model_conversion folder.

- The custom camera component was also a challenge, as it required a lot of custom code to get it working with the MLKit models. 


-> since the models cant handle frameProcessing, even tho the vision camera could, I had to hack workaround by saving the images aSync to the app storage, pipelining to object detect, pipelining iterating with expo-image-manipulater for cutting out the object frame from the big image, input into the image classifier, and then afterwards delete all those temporary images, except if the images is above the user set confidence level at that point in time (it then gets saved HQ to the media storage, the temporary file is still deleted. Its a Hack, for sure, but it works without significant delay on all testing devices (Android from 2020 and later, low-end to high-end))


-> all that took a lot of try catches to only pipeline if async is finished, and a lot of useStates to make sure nothing is done if something hasnt finished setting up later.


- The Visualization of the detected objects and the custom rectangles was also a challenge, as it was hard to find a middle ground of performance, visibility and usability. Also - there are suprinsingly little drop-in slider components with out-of-the-box direkt on valule changes visualisations. Had to hack around there too, first with creating custom sliders, then hacking a package.

- BirdyDex Database and all Components, reading in the csv of all birds in the world, optimization
- Translating all known birds from the english and latin name into the localizations into the cornell university csv before building
so it doesnt have to be done in app runtime. Used a lot of scientific apis, got rate limited a lot, used chatgpt 3.5 api with 5 dollar budget.
- Forever scroll to batch pagination. Also filter and batch read in sql was hard.
- Translation Page feature using the read-in sql birdydex was cool, as it was real requirement by Ms.Martinez

## LW
- Project Setup
- Firebase and Firestore Setup 
- Firebase Authentication with Signup, Login, Logout, Account-View, Forgot Password
- Making Synchronization of Firebase and Local Archive possible

Challenges:

## YS
- Wireframe creation for visualising for all developers

Challenges:

## AF
- x

Challenges:


-------------------------

DOWNGRADE TO JAVA 17! ADD TO JAVA_HOME (windows) as well as PATH!

https://adoptium.net/temurin/archive/?version=17

-------------------------

main is force mirrored to 

https://github.com/mklemmingen/LogChirpy

automatically. Dont publish any api-keys. 
The Pipeline filters private student emails and replaces them. 
The Pipeline filters to only push commits older than the 12th April´25

-------------------------

source for the bird image classifier:
https://github.com/rprkh/Bird-Classifier


(converted label txt into the .tflite with own python metadata writer, see conversion script folder)

-------------------------


added a ( not anymore concurrently cause we aint race conditioning this one java-) script to package json so we can: 

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

