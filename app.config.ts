import 'dotenv/config';

export default {
  expo: {
    name: "LogChirpy",
    slug: "logchirpy",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "logchirpy",
    userInterfaceStyle: "automatic",
    description: "Your personal bird watching companion. Log, identify, and track your bird sightings with ease.",
    keywords: ["birds", "birdwatching", "nature", "wildlife", "identification", "logging"],
    privacy: "public",
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
      package: "com.logchirpy.app", // Cleaner package name
      versionCode: 1,
      compileSdkVersion: 34,
      targetSdkVersion: 34,
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#FAFAFA" // Light neutral
      }
    },
    newArchEnabled: false,
    ios: {
      bundleIdentifier: "com.logchirpy.app", // Consistent with Android
      buildNumber: "1",
      supportsTablet: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription: "LogChirpy needs access to your photo library to let you select and save bird photos for your sightings.",
        NSPhotoLibraryAddUsageDescription: "LogChirpy needs permission to save captured bird photos to your photo library.",
        NSCameraUsageDescription: "LogChirpy needs camera access to take photos of birds for identification and logging.",
        NSLocationWhenInUseUsageDescription: "LogChirpy uses your location to record where you spotted birds and suggest nearby birding locations.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "LogChirpy uses your location to record where you spotted birds and suggest nearby birding locations."
      }
    },
    platforms: ["android", "ios"],
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
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
          "photosPermission": "Allow LogChirpy to save bird photos to your gallery",
          "savePhotosPermission": "Allow LogChirpy to save bird photos to your gallery",
          "isAccessMediaLocationEnabled": true
        }
      ]
    ],
    experiments: {
      typedRoutes: true
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
    }
  }
};