DOWNGRADE TO JAVA 17! ADD TO JAVA_HOME (windows) as well as PATH!
https://adoptium.net/temurin/archive/?version=17

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