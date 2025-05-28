import {getApp, getApps, initializeApp} from "firebase/app";
import {getReactNativePersistence, initializeAuth} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {getFirestore} from "firebase/firestore";
import {getStorage} from "firebase/storage";

// Firebase config
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:
    Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Verwende die offizielle Firebase-Lösung für React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const firestore = getFirestore(app);
const storage = getStorage(app);

export { app, auth, firestore, storage };
