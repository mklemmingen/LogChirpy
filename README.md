DOWNGRADE TO JAVA 17! ADD TO JAVA_HOME (windows) as well as PATH!
https://adoptium.net/temurin/archive/?version=17
-------------------------

for quick webstorm terminal to expo:android if adb can find an emulator (just make sure to exchange for your project path):

```powershell

function Start-ExpoAndroid {
param(
[string]$ProjectPath = 'C:\Users\Lauterbach\WebstormProjects\moco_sose25_logchirpy'
)

    # 1) Map deep path to X: (silently skip if already mapped)
    if (-not (Test-Path X:\)) {
      subst X: $ProjectPath
    }

    # 2) Jump into the mapped drive
    Push-Location X:\

    # 3) Build & run on Android
    npx expo run:android

    # 4) (Optional) un-map X: when you exit back
    Pop-Location
    # uncomment the next line if you always want to unmap afterward
    # subst X: /D
}

# now just call:
Start-ExpoAndroid
```
or depending on client specifics, you can also use:

First Tab:
```powershell
# 1) Map X: → your project (skip if already mapped)
if (-not (Test-Path X:\)) {
  subst X: 'C:\Users\Lauterbach\WebstormProjects\moco_sose25_logchirpy'
}

# 2) Start Metro from X:\ without even cd’ing
npx --prefix X:\ expo start --dev-client --tunnel

```
Second Tab:
```powershell
# (open a NEW PowerShell tab/window to keep Metro up)

if (-not (Test-Path X:\)) {
  subst X: 'C:\Users\Lauterbach\WebstormProjects\moco_sose25_logchirpy'
}

# 3) In the fresh tab, fire up Android on the same short path
npx --prefix X:\ expo run:android

# 4) When you’re done, unmap X:
subst X: /D
```

press a in the expo terminal to open the app on your phone.

--------------------------

step by step guide to use wsl2 for local builds on a windows machine with a debugged android phone attached (it was torture to get this working, so I hope this helps you):

1. Install WSL2 (Ubuntu) on Windows

   Open PowerShell as Administrator and run:

   wsl --install -d Ubuntu

   Reboot when prompted.

   After reboot, launch Ubuntu from the Start menu and set up your UNIX username and password.

2. Install core Linux tools in WSL

# in your new Ubuntu shell:
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip adb android-sdk-platform-tools

3. Clone LogChirpy using your GitLab token

   In GitLab web UI, go to User Settings → Access Tokens, create a token with read_repository scope, and copy it.

   In WSL:

export GITLAB_TOKEN="glpat-xxxxxxxxxxxxxxxxxxxx"    # ← your token
git clone https://oauth2:${GITLAB_TOKEN}@gitlab.reutlingen-university.de/lauterba/moco_sose25_logchirpy.git
cd moco_sose25_logchirpy

Stash any local edits (if needed) then checkout your feature branch (quotes needed for “!”):

    git stash
    git fetch origin
    git checkout 'LogEntry_2!'

4. Install JS dependencies

npm install --legacy-peer-deps

This resolves the TensorFlow ↔ expo-camera peer conflict.
5. Prebuild native projects

npx expo prebuild --clean

Regenerates android/ and ios/ with your current config.
6. Install usbipd-win on Windows & bind your phone

   In Windows, download & run the usbipd-win_x64.msi from https://github.com/dorssel/usbipd-win/releases/latest

   Open PowerShell as Administrator and list USB devices:

usbipd list

Locate your phone’s BUSID (e.g. 2-1) and bind + attach:

usbipd bind --busid 2-1
usbipd attach --busid 2-1

Verify Windows sees it:

    adb devices
    # → your phone’s serial listed

7. Switch back to WSL and clear any custom ADB socket

# Ensure Linux's adb runs against the USB-shared device
unset ADB_SERVER_SOCKET
adb kill-server && adb start-server
adb devices
# → you should now see your phone’s serial here too

8. Run your Expo Android app

npx expo run:android

Expo CLI will detect the WSL-visible device and install the debug APK.
9. What made this work

   WSL2 provided a Linux environment without Windows path-length limits.

   Token-based clone (oauth2:YOUR_TOKEN) let you access the private GitLab repo.

   npm install --legacy-peer-deps resolved the TensorFlow ↔ Expo-camera peer-dependency conflict.

   expo prebuild --clean regenerated native projects with your custom config (assets, plugins, etc.).

   usbipd-win forwarded your USB-debug phone into WSL, and clearing ADB_SERVER_SOCKET let Linux’s adb talk directly to it.

--------------------------

source of all c++ tensor evil:

https://www.npmjs.com/package/@infinitered/react-native-mlkit-object-detection

--------------------------
root build.gradle

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

---------------------------


To build apks via Android Studio when opening the android folder:

1. Open:

node_modules/expo-gl/android/build.gradle

2. Immediately after:

apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'
apply plugin: 'maven-publish'

add:

android {
compileSdkVersion 35

    defaultConfig {
        minSdkVersion 24
        targetSdkVersion 34
    }
}

--------------------------

DEV via Android Emulation:

🛠 How to set up Android SDK + Emulator for WebStorm

You need:

    Android SDK

    Android Virtual Device (AVD) (an emulator)

    Connect it to WebStorm / Expo Dev Build

📦 Step 1: Install Android Studio

Even if you use WebStorm, you must install Android Studio because:

    It provides the official Android SDK

    It installs system images (virtual phones)

    It installs adb (Android Debug Bridge)

👉 Download Android Studio:

    https://developer.android.com/studio

    ✅ During installation, make sure to check "Android SDK", "Android SDK Platform Tools", "Android Emulator" — it's usually selected by default.

⚙️ Step 2: Install Android SDK via Android Studio

    Open Android Studio

    Go to Settings > Appearance & Behavior > System Settings > Android SDK

    Under the SDK Platforms tab:

        Install Android 13 (Tiramisu) or Android 12L or any recent one.

    Under the SDK Tools tab:

        Install:

            Android SDK Build-Tools

            Android Emulator

            Android SDK Platform-Tools

            Intel x86 Emulator Accelerator (HAXM installer) (only if Intel CPU)

✅ Apply and install.
📱 Step 3: Create a Virtual Device (Emulator)

    Open Android Studio

    Open the AVD Manager (top toolbar)

    Click Create Virtual Device

    Pick a popular phone (e.g., Pixel 6, Pixel 5)

    Select a system image (Android 12/13)

    Finish and launch it.

✅ This creates your "test phone".
📡 Step 4: Connect Expo (WebStorm) to Emulator

In your project:

eas build -p android --profile production

builds it on the expo servers, authentificated via the shared .env (see teams!)
download the .apk file from the build page

------------

Step 1: Install Android SDK

Ensure that you have the Android SDK installed. This can be done through the Android Studio setup or through the Command Line Tools.

    Download and install Android Studio:

        If you haven’t installed Android Studio, download it from here.

        Install it and make sure to install the Android SDK during the setup process.

    Set up the Android SDK location:

        Android Studio automatically sets up the Android SDK in your system.

        You can find the SDK in the following default locations:

            Windows: C:\Users\<YourUser>\AppData\Local\Android\Sdk

Step 2: Set ANDROID_HOME Environment Variable

To set the ANDROID_HOME environment variable, follow these steps:

    Open Environment Variables:

        Right-click on This PC (or My Computer) and select Properties.

        Click on Advanced system settings.

        Under the Advanced tab, click Environment Variables.

    Create ANDROID_HOME Variable:

        In the System variables section, click New.

        For Variable Name, enter ANDROID_HOME.

        For Variable Value, enter the path to your Android SDK, e.g., C:\Users\<YourUser>\AppData\Local\Android\Sdk.

    Add SDK to the PATH:

        In the System variables section, find and select Path, then click Edit.

        Add the following two paths (replace <YourUser> with your actual username):

            C:\Users\<YourUser>\AppData\Local\Android\Sdk\platform-tools

            C:\Users\<YourUser>\AppData\Local\Android\Sdk\tools

    Save and close:

        Click OK to save the environment variables.

        Close the System Properties window.

Step 3: Set sdk.dir in local.properties

If you’re using Gradle for building, ensure that the local.properties file in the android folder of your project contains the SDK location.

    In your project, navigate to the android folder.

    Create (or edit) a file named local.properties.

    Add the following line (again, replace <YourUser> with your username):

sdk.dir=C:\\Users\\<YourUser>\\AppData\\Local\\Android\\Sdk


-----------------

Using Windows Linux Subsystem für lokale App Erstellung via eas

🛠️ Step-by-Step: Install WSL2 with Ubuntu on Windows
✅ 1. Enable WSL2

Open PowerShell as Administrator, then run:

wsl --install -d Ubuntu

This will:

    Enable the Windows Subsystem for Linux

    Install the Ubuntu distro

    Set WSL2 as default

🔄 It will take a few minutes and ask you to reboot.
✅ 2. Open Ubuntu

After reboot, press:

Win + S → Search for "Ubuntu" → Open

🎉 This launches your new Linux terminal.

You'll be asked to create a username and password for your Linux user. Use anything you like.
✅ 3. Update and install tools in Ubuntu (inside WSL2)

Run the following:

sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip openjdk-17-jdk
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g eas-cli expo-cli

✅ This installs:

    Java 17 ✅

    Node.js ✅

    npm ✅

    eas-cli and expo-cli ✅

✅ 4. Clone your project inside WSL

git clone https://github.com/your-username/your-repo.git
cd your-repo

Or if you're working locally, you can access Windows files inside WSL like:

cd /mnt/c/Users/Lauterbach/WebstormProjects/moco_sose25_logchirpy2

✅ 5. Prebuild and install dependencies

npm install --legacy-peer-deps
npx expo prebuild

✅ 6. Build the APK locally!

eas build --platform android --profile production --local

The .apk will be output to dist/ once it's done.
✅ 7. Install APK on Android phone (optional)

Plug in your Android device via USB, then run:

adb install dist/your-app.apk

    💡 If adb isn't installed, you can install it via sudo apt install adb or use it from Windows side.