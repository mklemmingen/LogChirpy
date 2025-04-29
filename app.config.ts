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
      "assets/models/*",
      "assets/fonts/*",
      "assets/images/*"
    ],
    android: {
      "package": "com.dhfgkjhksdfgsd.moco_sose25_logchirpy"
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
    platforms: ["android", "ios", "web"],
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
      "expo-sqlite",
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      eas: {
        projectId: "582ad999-1bd1-4f12-835b-7eaf4e6dacd5"
      },
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
    }
  }
};
