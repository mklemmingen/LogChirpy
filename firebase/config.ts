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

// Validate Firebase config
const isValidConfig = firebaseConfig.apiKey && 
                     firebaseConfig.authDomain && 
                     firebaseConfig.projectId && 
                     firebaseConfig.appId;

let app: any = null;
let auth: any = null;
let firestore: any = null;
let storage: any = null;

if (isValidConfig) {
  try {
    console.log('[Firebase] Initializing Firebase with valid config');
    // Initialize App
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    // Initialize Firebase services
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

    firestore = getFirestore(app);
    storage = getStorage(app);
    
    console.log('[Firebase] Firebase initialized successfully');
  } catch (error) {
    console.error('[Firebase] Firebase initialization failed:', error);
    console.warn('[Firebase] App will continue in offline mode');
  }
} else {
  console.warn('[Firebase] Invalid Firebase configuration - running in offline mode');
  console.warn('[Firebase] Missing config values:', {
    apiKey: !!firebaseConfig.apiKey,
    authDomain: !!firebaseConfig.authDomain,
    projectId: !!firebaseConfig.projectId,
    appId: !!firebaseConfig.appId,
  });
}

export { app, auth, firestore, storage };
