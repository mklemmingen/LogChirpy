import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { Android14PermissionManager } from '@/services/Android14PermissionManager';

interface PermissionStatus {
  camera: 'granted' | 'denied' | 'blocked' | 'pending';
  location: 'granted' | 'denied' | 'blocked' | 'pending';
  mediaLibrary: 'granted' | 'denied' | 'blocked' | 'pending';
  notifications: 'granted' | 'denied' | 'blocked' | 'pending';
}

interface UsePermissionsReturn {
  permissions: PermissionStatus;
  isLoading: boolean;
  requestCameraPermission: () => Promise<boolean>;
  requestLocationPermission: () => Promise<boolean>;
  requestMediaLibraryPermission: () => Promise<boolean>;
  requestNotificationPermission: () => Promise<boolean>;
  requestAllPermissions: () => Promise<PermissionStatus>;
  openSettings: () => void;
  hasEssentialPermissions: boolean;
  canUseCamera: boolean;
  canAccessLocation: boolean;
  canSaveMedia: boolean;
}

/**
 * Android Permissions Hook with Fragment Lifecycle Support
 * Wraps Android14PermissionManager with React hook interface
 */
export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: 'pending',
    location: 'pending',
    mediaLibrary: 'pending',
    notifications: 'pending',
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check all permissions on mount
  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const [cameraStatus, locationStatus, mediaStatus, notificationStatus] = await Promise.all([
        checkCameraPermission(),
        checkLocationPermission(),
        checkMediaLibraryPermission(),
        checkNotificationPermission(),
      ]);

      setPermissions({
        camera: cameraStatus,
        location: locationStatus,
        mediaLibrary: mediaStatus,
        notifications: notificationStatus,
      });
    } catch (error) {
      console.error('[usePermissions] Failed to check permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkCameraPermission = useCallback(async (): Promise<PermissionStatus['camera']> => {
    try {
      if (Platform.OS === 'android') {
        // Mock implementation for now - will be replaced with actual Android14PermissionManager
        const status = await Camera.getCameraPermissionStatus();
        return status as PermissionStatus['camera'];
      } else {
        const status = await Camera.getCameraPermissionStatus();
        return status as PermissionStatus['camera'];
      }
    } catch (error) {
      console.error('[usePermissions] Camera permission check failed:', error);
      return 'denied';
    }
  }, []);

  const checkLocationPermission = useCallback(async (): Promise<PermissionStatus['location']> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return mapExpoPermissionStatus(status);
    } catch (error) {
      console.error('[usePermissions] Location permission check failed:', error);
      return 'denied';
    }
  }, []);

  const checkMediaLibraryPermission = useCallback(async (): Promise<PermissionStatus['mediaLibrary']> => {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      return mapExpoPermissionStatus(status);
    } catch (error) {
      console.error('[usePermissions] Media library permission check failed:', error);
      return 'denied';
    }
  }, []);

  const checkNotificationPermission = useCallback(async (): Promise<PermissionStatus['notifications']> => {
    try {
      if (Platform.OS === 'android') {
        // Mock implementation for Android notifications
        return 'granted';
      } else {
        // iOS notification permissions would go here
        return 'granted';
      }
    } catch (error) {
      console.error('[usePermissions] Notification permission check failed:', error);
      return 'denied';
    }
  }, []);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const status = await Camera.requestCameraPermission();
      const granted = status === 'granted';

      const newStatus = granted ? 'granted' : 'denied';
      setPermissions(prev => ({ ...prev, camera: newStatus }));
      
      return granted;
    } catch (error) {
      console.error('[usePermissions] Camera permission request failed:', error);
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      return false;
    }
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';

      const newStatus = granted ? 'granted' : 'denied';
      setPermissions(prev => ({ ...prev, location: newStatus }));
      
      return granted;
    } catch (error) {
      console.error('[usePermissions] Location permission request failed:', error);
      setPermissions(prev => ({ ...prev, location: 'denied' }));
      return false;
    }
  }, []);

  const requestMediaLibraryPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      const granted = status === 'granted';

      const newStatus = granted ? 'granted' : 'denied';
      setPermissions(prev => ({ ...prev, mediaLibrary: newStatus }));
      
      return granted;
    } catch (error) {
      console.error('[usePermissions] Media library permission request failed:', error);
      setPermissions(prev => ({ ...prev, mediaLibrary: 'denied' }));
      return false;
    }
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Mock implementation for notifications
      const granted = true;

      const newStatus = granted ? 'granted' : 'denied';
      setPermissions(prev => ({ ...prev, notifications: newStatus }));
      
      return granted;
    } catch (error) {
      console.error('[usePermissions] Notification permission request failed:', error);
      setPermissions(prev => ({ ...prev, notifications: 'denied' }));
      return false;
    }
  }, []);

  const requestAllPermissions = useCallback(async (): Promise<PermissionStatus> => {
    setIsLoading(true);

    const results = await Promise.allSettled([
      requestCameraPermission(),
      requestLocationPermission(),
      requestMediaLibraryPermission(),
      requestNotificationPermission(),
    ]);

    // Re-check all permissions to get current status
    await checkAllPermissions();
    
    setIsLoading(false);
    return permissions;
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'android') {
      Alert.alert(
        'Permissions Required',
        'Please enable the required permissions in Settings to use all features of LogChirpy.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    } else {
      Linking.openSettings();
    }
  }, []);

  // Helper functions
  const mapAndroidPermissionStatus = (status: string): PermissionStatus['camera'] => {
    switch (status) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'never_ask_again':
        return 'blocked';
      default:
        return 'pending';
    }
  };

  const mapExpoPermissionStatus = (status: string): PermissionStatus['camera'] => {
    switch (status) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'undetermined':
        return 'pending';
      default:
        return 'denied';
    }
  };

  // Computed values
  const hasEssentialPermissions = permissions.camera === 'granted';
  const canUseCamera = permissions.camera === 'granted';
  const canAccessLocation = permissions.location === 'granted';
  const canSaveMedia = permissions.mediaLibrary === 'granted';

  return {
    permissions,
    isLoading,
    requestCameraPermission,
    requestLocationPermission,
    requestMediaLibraryPermission,
    requestNotificationPermission,
    requestAllPermissions,
    openSettings,
    hasEssentialPermissions,
    canUseCamera,
    canAccessLocation,
    canSaveMedia,
  };
}