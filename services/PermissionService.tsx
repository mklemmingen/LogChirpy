import React, { createContext, useContext, useEffect, useState } from 'react';
import { PermissionsAndroid, Alert, Platform } from 'react-native';

interface PermissionState {
  hasPermission: boolean;
  isLoading: boolean;
  requestCameraPermission: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  requestNotificationPermission: () => Promise<boolean>;
  requestAudioPermission: () => Promise<boolean>;
}

const PermissionContext = createContext<PermissionState | null>(null);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkCameraPermission = async () => {
    try {
      if (Platform.OS !== 'android') {
        setHasPermission(true);
        setIsLoading(false);
        return;
      }

      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      setHasPermission(granted);
      setIsLoading(false);
    } catch (error) {
      console.error('Permission check error:', error);
      setIsLoading(false);
    }
  };

  const requestCameraPermission = async () => {
    try {
      if (Platform.OS !== 'android') {
        setHasPermission(true);
        return;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Bird Detection Camera Permission',
          message: 'This app needs camera access to detect birds in real-time.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setHasPermission(true);
      } else {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera permission in settings to use bird detection.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs location access to tag bird sightings.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      if (Platform.Version < 33) {
        return true;
      }

      const granted = await PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS' as any,
        {
          title: 'Notification Permission',
          message: 'Allow notifications for bird detection alerts.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Notification permission error:', error);
      return false;
    }
  };

  const requestAudioPermission = async () => {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Audio Recording Permission',
          message: 'This app needs microphone access to record bird sounds.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Audio permission error:', error);
      return false;
    }
  };

  useEffect(() => {
    checkCameraPermission();
  }, []);

  const value: PermissionState = {
    hasPermission,
    isLoading,
    requestCameraPermission,
    requestLocationPermission,
    requestNotificationPermission,
    requestAudioPermission,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
}