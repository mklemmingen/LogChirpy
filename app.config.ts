import 'dotenv/config';

export default {
  expo: {
    name: "LogChirpy",
    slug: "log-chirpy-android",
    scheme: "birddetection",
    version: "1.0.0",
    platforms: ["android"],
    newArchEnabled: true,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",
    description: "Android-optimized bird detection app with real-time AI identification",
    splash: {
      image: "./assets/images/logo_no_bg.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "assets/**/*", // all assets basically
      "assets/models/*",
      "assets/fonts/*",
      "assets/images/*",
      "**/*.csv" // include all CSVs anywhere
    ],
    android: {
      compileSdkVersion: 35,
      targetSdkVersion: 35,
      minSdkVersion: 26,
      package: "com.birddetection.android",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#FFFFFF"
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.POST_NOTIFICATIONS"
      ],
      enableProguardInReleaseBuilds: true,
      enableSeparateBuildPerCPUArchitecture: true
    },
    plugins: [
      "expo-router",
      [
        "react-native-vision-camera",
        {
          cameraPermissionText: "LogChirpy needs camera access to help you photograph and identify birds",
          enableMicrophonePermission: false
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "LogChirpy uses your location to record where you spotted birds and suggest nearby birding locations.",
          locationWhenInUsePermission: "LogChirpy uses your location to record where you spotted birds.",
          isIosBackgroundLocationEnabled: false
        }
      ],
      "expo-sqlite",
      "expo-video",
      [
        "expo-media-library",
        {
          "photosPermission": "Allow LogChirpy to access your photos to save bird detections",
          "savePhotosPermission": "Allow LogChirpy to save bird photos to your gallery",
          "isAccessMediaLocationEnabled": true
        }
      ],
      [
        "react-native-fast-tflite",
        {
          "enableAndroidGpuLibraries": [
            "libOpenCL-pixel.so",
            "libGLES_mali.so"
          ]
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    updates: {
      url: "https://u.expo.dev/f3cad8d2-c8a4-4696-a73f-9f57db6f7f08"
    },
    extra: {
      EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      eas: {
        projectId: "f3cad8d2-c8a4-4696-a73f-9f57db6f7f08"
      }
    },
  }
};