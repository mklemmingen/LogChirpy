import 'dotenv/config';

export default {
  expo: {
    name: "moco_sose25_logchirpy",
    slug: "moco_sose25_logchirpy",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
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
      "**/*.csv"         // include all CSVs anywhere
    ],
    android: {
      "package": "com.dhfgkjhksdfgsd.moco_sose25_logchirpy",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES",
      ]
    },
    newArchEnabled: false,
    ios: {
      bundleIdentifier: "com.dhfgkjhksdfgsd.moco-sose25-logchirpy",
      supportsTablet: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription:      "Allow LogChirpy to show your bird photos",
        NSPhotoLibraryAddUsageDescription:   "Allow LogChirpy to save captured bird photos"
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
          "cameraPermissionText": "$(PRODUCT_NAME) needs access to your camera",
          "enableMicrophonePermission": false
        }
      ],
      "expo-sqlite",
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
        projectId: "582ad999-1bd1-4f12-835b-7eaf4e6dacd5"
      }
    }
  }
};
