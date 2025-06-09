/**
 * Android14PermissionManager.ts - Android 14+ granular permission handling
 * 
 * Implements nuanced approaches to granular media access and notification permissions
 * Handles partial photo access model with RESULTS.GRANTED and RESULTS.LIMITED states
 * Manages Android 13's POST_NOTIFICATIONS permission with explicit user consent
 */

import React from 'react';
import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import { request, check, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';
import { useDetectionStore } from '@/store/detectionStore';

// Helper function to safely get numeric Platform.Version
const getPlatformVersion = (): number => {
  return typeof Platform.Version === 'string' 
    ? parseInt(Platform.Version, 10) 
    : Platform.Version;
};

export interface PermissionStatus {
  granted: boolean;
  limited: boolean;
  denied: boolean;
  blocked: boolean;
  unavailable: boolean;
}

export interface MediaPermissionState {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  photosRead: PermissionStatus;
  photosWrite: PermissionStatus;
  photosPartial: PermissionStatus;
  location: PermissionStatus;
  notifications: PermissionStatus;
  backgroundLocation: PermissionStatus;
}

export interface PermissionConfig {
  enableGranularMediaAccess: boolean;
  enablePartialPhotoAccess: boolean;
  enableNotificationPermissions: boolean;
  enableLocationPermissions: boolean;
  requestOnlyNecessary: boolean;
  showRationale: boolean;
}

const DEFAULT_CONFIG: PermissionConfig = {
  enableGranularMediaAccess: true,
  enablePartialPhotoAccess: true,
  enableNotificationPermissions: true,
  enableLocationPermissions: true,
  requestOnlyNecessary: true,
  showRationale: true,
};

export class Android14PermissionManager {
  private static instance: Android14PermissionManager;
  private config: PermissionConfig = DEFAULT_CONFIG;
  private permissionState: MediaPermissionState;
  private requestInProgress: Set<string> = new Set();

  constructor() {
    this.permissionState = this.getInitialPermissionState();
  }

  static getInstance(): Android14PermissionManager {
    if (!Android14PermissionManager.instance) {
      Android14PermissionManager.instance = new Android14PermissionManager();
    }
    return Android14PermissionManager.instance;
  }

  /**
   * Initialize permission manager and check current states
   */
  async initialize(): Promise<void> {
    try {
      console.log('[PermissionManager] Initializing Android 14+ permission manager');

      if (Platform.OS !== 'android') {
        console.warn('[PermissionManager] Android permission manager only available on Android');
        return;
      }

      // Check current permission states
      await this.refreshAllPermissions();

      console.log('[PermissionManager] Initialization complete');
      console.log('[PermissionManager] Current permissions:', this.permissionState);
    } catch (error) {
      console.error('[PermissionManager] Initialization failed:', error);
    }
  }

  /**
   * Request camera permission with Android 14+ patterns
   */
  async requestCameraPermission(): Promise<PermissionStatus> {
    try {
      const permissionKey = 'camera';
      
      if (this.requestInProgress.has(permissionKey)) {
        console.log('[PermissionManager] Camera permission request already in progress');
        return this.permissionState.camera;
      }

      this.requestInProgress.add(permissionKey);

      console.log('[PermissionManager] Requesting camera permission');

      // Show rationale if needed
      if (this.config.showRationale) {
        const shouldRequest = await this.showCameraRationale();
        if (!shouldRequest) {
          this.requestInProgress.delete(permissionKey);
          return this.permissionState.camera;
        }
      }

      // Request permission
      const result = await request(PERMISSIONS.ANDROID.CAMERA);
      const status = this.mapPermissionResult(result);

      this.permissionState.camera = status;
      this.requestInProgress.delete(permissionKey);

      console.log('[PermissionManager] Camera permission result:', status);

      // Handle blocked state
      if (status.blocked) {
        await this.handleBlockedPermission('Camera', 'camera access to identify birds');
      }

      return status;
    } catch (error) {
      console.error('[PermissionManager] Camera permission request failed:', error);
      this.requestInProgress.delete('camera');
      return this.getInitialPermissionStatus();
    }
  }

  /**
   * Request microphone permission for audio recording
   */
  async requestMicrophonePermission(): Promise<PermissionStatus> {
    try {
      const permissionKey = 'microphone';
      
      if (this.requestInProgress.has(permissionKey)) {
        return this.permissionState.microphone;
      }

      this.requestInProgress.add(permissionKey);

      console.log('[PermissionManager] Requesting microphone permission');

      if (this.config.showRationale) {
        const shouldRequest = await this.showMicrophoneRationale();
        if (!shouldRequest) {
          this.requestInProgress.delete(permissionKey);
          return this.permissionState.microphone;
        }
      }

      const result = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
      const status = this.mapPermissionResult(result);

      this.permissionState.microphone = status;
      this.requestInProgress.delete(permissionKey);

      if (status.blocked) {
        await this.handleBlockedPermission('Microphone', 'audio recording to identify bird calls');
      }

      return status;
    } catch (error) {
      console.error('[PermissionManager] Microphone permission request failed:', error);
      this.requestInProgress.delete('microphone');
      return this.getInitialPermissionStatus();
    }
  }

  /**
   * Request photo permissions with Android 14+ granular access
   */
  async requestPhotoPermissions(): Promise<{
    read: PermissionStatus;
    write: PermissionStatus;
    partial: PermissionStatus;
  }> {
    try {
      console.log('[PermissionManager] Requesting photo permissions with granular access');

      // Android 14+ granular media permissions
      const permissions = [];
      
      if (getPlatformVersion() >= 34) { // Android 14+
        permissions.push(
          PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
          PERMISSIONS.ANDROID.READ_MEDIA_VISUAL_USER_SELECTED // Partial access
        );
      } else if (getPlatformVersion() >= 33) { // Android 13
        permissions.push(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
      } else {
        // Android 12 and below
        permissions.push(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      }

      // Show rationale
      if (this.config.showRationale) {
        const shouldRequest = await this.showPhotoRationale();
        if (!shouldRequest) {
          return {
            read: this.permissionState.photosRead,
            write: this.permissionState.photosWrite,
            partial: this.permissionState.photosPartial,
          };
        }
      }

      // Request read permissions
      const readResults = await Promise.all(
        permissions.map(permission => request(permission))
      );

      // Process results
      const readStatus = this.mapPermissionResult(readResults[0]);
      const partialStatus = readResults[1] 
        ? this.mapPermissionResult(readResults[1])
        : this.getInitialPermissionStatus();

      this.permissionState.photosRead = readStatus;
      this.permissionState.photosPartial = partialStatus;

      // Handle Android 14+ partial photo access
      if (getPlatformVersion() >= 34 && this.config.enablePartialPhotoAccess) {
        await this.handlePartialPhotoAccess(readStatus, partialStatus);
      }

      // Request write permission if needed
      let writeStatus = this.getInitialPermissionStatus();
      if (getPlatformVersion() < 29) { // Before Android 10 (scoped storage)
        const writeResult = await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        writeStatus = this.mapPermissionResult(writeResult);
        this.permissionState.photosWrite = writeStatus;
      } else {
        // Android 10+ uses scoped storage, no write permission needed
        writeStatus = { granted: true, limited: false, denied: false, blocked: false, unavailable: false };
        this.permissionState.photosWrite = writeStatus;
      }

      console.log('[PermissionManager] Photo permissions result:', {
        read: readStatus,
        write: writeStatus,
        partial: partialStatus,
      });

      return {
        read: readStatus,
        write: writeStatus,
        partial: partialStatus,
      };

    } catch (error) {
      console.error('[PermissionManager] Photo permissions request failed:', error);
      return {
        read: this.getInitialPermissionStatus(),
        write: this.getInitialPermissionStatus(),
        partial: this.getInitialPermissionStatus(),
      };
    }
  }

  /**
   * Handle Android 14+ partial photo access model
   */
  private async handlePartialPhotoAccess(
    readStatus: PermissionStatus,
    partialStatus: PermissionStatus
  ): Promise<void> {
    try {
      if (partialStatus.granted) {
        console.log('[PermissionManager] Partial photo access granted');
        
        // Show user that they have partial access
        Alert.alert(
          'Partial Photo Access',
          'You\'ve granted access to selected photos. LogChirpy can save bird detections to these photos. You can grant full access anytime in Settings.',
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Grant Full Access', 
              style: 'default',
              onPress: () => this.openAppSettings()
            }
          ]
        );
      } else if (readStatus.limited) {
        console.log('[PermissionManager] Limited photo access detected');
        
        // Explain limited access
        Alert.alert(
          'Limited Photo Access',
          'LogChirpy has limited access to your photos. For the best experience, consider granting full access.',
          [
            { text: 'Continue with Limited', style: 'cancel' },
            { 
              text: 'Grant Full Access', 
              style: 'default',
              onPress: () => this.openAppSettings()
            }
          ]
        );
      }
    } catch (error) {
      console.error('[PermissionManager] Partial photo access handling failed:', error);
    }
  }

  /**
   * Request notification permission (Android 13+)
   */
  async requestNotificationPermission(): Promise<PermissionStatus> {
    try {
      console.log('[PermissionManager] Requesting notification permission');

      if (getPlatformVersion() < 33) {
        // Android 12 and below don't require notification permission
        const status = { granted: true, limited: false, denied: false, blocked: false, unavailable: false };
        this.permissionState.notifications = status;
        return status;
      }

      // Show rationale for Android 13+
      if (this.config.showRationale) {
        const shouldRequest = await this.showNotificationRationale();
        if (!shouldRequest) {
          return this.permissionState.notifications;
        }
      }

      const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      const status = this.mapPermissionResult(result);

      this.permissionState.notifications = status;

      console.log('[PermissionManager] Notification permission result:', status);

      if (status.denied || status.blocked) {
        await this.handleNotificationPermissionDenied();
      }

      return status;
    } catch (error) {
      console.error('[PermissionManager] Notification permission request failed:', error);
      return this.getInitialPermissionStatus();
    }
  }

  /**
   * Request location permissions with background support
   */
  async requestLocationPermissions(includeBackground: boolean = false): Promise<{
    foreground: PermissionStatus;
    background?: PermissionStatus;
  }> {
    try {
      console.log('[PermissionManager] Requesting location permissions');

      // Show rationale
      if (this.config.showRationale) {
        const shouldRequest = await this.showLocationRationale();
        if (!shouldRequest) {
          return {
            foreground: this.permissionState.location,
            background: this.permissionState.backgroundLocation,
          };
        }
      }

      // Request foreground location
      const foregroundResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      const foregroundStatus = this.mapPermissionResult(foregroundResult);
      this.permissionState.location = foregroundStatus;

      let backgroundStatus: PermissionStatus | undefined;

      // Request background location if needed and granted foreground
      if (includeBackground && foregroundStatus.granted && getPlatformVersion() >= 29) {
        // Show additional rationale for background location
        const shouldRequestBackground = await this.showBackgroundLocationRationale();
        
        if (shouldRequestBackground) {
          const backgroundResult = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
          backgroundStatus = this.mapPermissionResult(backgroundResult);
          this.permissionState.backgroundLocation = backgroundStatus;
        }
      }

      console.log('[PermissionManager] Location permissions result:', {
        foreground: foregroundStatus,
        background: backgroundStatus,
      });

      return {
        foreground: foregroundStatus,
        background: backgroundStatus,
      };

    } catch (error) {
      console.error('[PermissionManager] Location permissions request failed:', error);
      return {
        foreground: this.getInitialPermissionStatus(),
        background: this.getInitialPermissionStatus(),
      };
    }
  }

  /**
   * Request all necessary permissions for bird detection
   */
  async requestAllNecessaryPermissions(): Promise<MediaPermissionState> {
    try {
      console.log('[PermissionManager] Requesting all necessary permissions');

      // Request in logical order
      const cameraResult = await this.requestCameraPermission();
      const microphoneResult = await this.requestMicrophonePermission();
      const photoResults = await this.requestPhotoPermissions();
      const locationResults = await this.requestLocationPermissions(false);
      const notificationResult = await this.requestNotificationPermission();

      const finalState: MediaPermissionState = {
        camera: cameraResult,
        microphone: microphoneResult,
        photosRead: photoResults.read,
        photosWrite: photoResults.write,
        photosPartial: photoResults.partial,
        location: locationResults.foreground,
        backgroundLocation: locationResults.background || this.getInitialPermissionStatus(),
        notifications: notificationResult,
      };

      this.permissionState = finalState;

      console.log('[PermissionManager] All permissions requested. Final state:', finalState);
      return finalState;

    } catch (error) {
      console.error('[PermissionManager] Request all permissions failed:', error);
      return this.permissionState;
    }
  }

  /**
   * Refresh all permission states
   */
  async refreshAllPermissions(): Promise<MediaPermissionState> {
    try {
      const permissions = [
        { key: 'camera', permission: PERMISSIONS.ANDROID.CAMERA },
        { key: 'microphone', permission: PERMISSIONS.ANDROID.RECORD_AUDIO },
        { key: 'location', permission: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION },
      ];

      // Add version-specific permissions
      if (getPlatformVersion() >= 33) {
        permissions.push({ key: 'notifications', permission: PERMISSIONS.ANDROID.POST_NOTIFICATIONS });
      }

      if (getPlatformVersion() >= 34) {
        permissions.push(
          { key: 'photosRead', permission: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES },
          { key: 'photosPartial', permission: PERMISSIONS.ANDROID.READ_MEDIA_VISUAL_USER_SELECTED }
        );
      } else if (getPlatformVersion() >= 33) {
        permissions.push({ key: 'photosRead', permission: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES });
      } else {
        permissions.push({ key: 'photosRead', permission: PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE });
      }

      // Check all permissions
      const results = await Promise.all(
        permissions.map(async ({ key, permission }) => {
          const result = await check(permission);
          return { key, status: this.mapPermissionResult(result) };
        })
      );

      // Update state
      results.forEach(({ key, status }) => {
        (this.permissionState as any)[key] = status;
      });

      return this.permissionState;
    } catch (error) {
      console.error('[PermissionManager] Refresh permissions failed:', error);
      return this.permissionState;
    }
  }

  /**
   * Rationale dialogs
   */
  private async showCameraRationale(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Camera Permission Required',
        'LogChirpy needs camera access to identify birds through real-time object detection. This helps you quickly log bird sightings.',
        [
          { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Grant Permission', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
  }

  private async showMicrophoneRationale(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Microphone Permission Required',
        'LogChirpy uses your microphone to record bird calls for audio identification. This helps identify birds even when they\'re not visible.',
        [
          { text: 'Skip Audio Features', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Grant Permission', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
  }

  private async showPhotoRationale(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Photo Access Required',
        'LogChirpy needs access to your photos to save bird detection images and analyze existing bird photos.',
        [
          { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Grant Access', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
  }

  private async showLocationRationale(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Location Permission Required',
        'LogChirpy uses your location to record where you spotted birds and suggest nearby birding locations.',
        [
          { text: 'Skip Location Features', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Grant Permission', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
  }

  private async showBackgroundLocationRationale(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Background Location Access',
        'For automatic bird migration tracking, LogChirpy can access location in the background. This feature is optional.',
        [
          { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Allow Background Access', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
  }

  private async showNotificationRationale(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Notification Permission',
        'LogChirpy can send notifications about bird sighting reminders and interesting bird activity in your area.',
        [
          { text: 'No Notifications', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Allow Notifications', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
  }

  /**
   * Handle blocked permissions
   */
  private async handleBlockedPermission(permissionName: string, purpose: string): Promise<void> {
    Alert.alert(
      `${permissionName} Permission Blocked`,
      `${permissionName} permission is required for ${purpose}. Please enable it in app settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', style: 'default', onPress: () => this.openAppSettings() },
      ]
    );
  }

  private async handleNotificationPermissionDenied(): Promise<void> {
    Alert.alert(
      'Notifications Disabled',
      'You won\'t receive bird sighting reminders or activity notifications. You can enable them anytime in Settings.',
      [{ text: 'OK', style: 'default' }]
    );
  }

  /**
   * Open app settings
   */
  private async openAppSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('[PermissionManager] Failed to open app settings:', error);
    }
  }

  /**
   * Utility methods
   */
  private mapPermissionResult(result: string): PermissionStatus {
    return {
      granted: result === RESULTS.GRANTED,
      limited: result === RESULTS.LIMITED,
      denied: result === RESULTS.DENIED,
      blocked: result === RESULTS.BLOCKED,
      unavailable: result === RESULTS.UNAVAILABLE,
    };
  }

  private getInitialPermissionStatus(): PermissionStatus {
    return {
      granted: false,
      limited: false,
      denied: false,
      blocked: false,
      unavailable: false,
    };
  }

  private getInitialPermissionState(): MediaPermissionState {
    const initialStatus = this.getInitialPermissionStatus();
    return {
      camera: initialStatus,
      microphone: initialStatus,
      photosRead: initialStatus,
      photosWrite: initialStatus,
      photosPartial: initialStatus,
      location: initialStatus,
      notifications: initialStatus,
      backgroundLocation: initialStatus,
    };
  }

  /**
   * Get current permission state
   */
  getPermissionState(): MediaPermissionState {
    return { ...this.permissionState };
  }

  /**
   * Check if all necessary permissions are granted
   */
  hasAllNecessaryPermissions(): boolean {
    return (
      this.permissionState.camera.granted &&
      this.permissionState.microphone.granted &&
      (this.permissionState.photosRead.granted || this.permissionState.photosPartial.granted)
    );
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PermissionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[PermissionManager] Configuration updated:', this.config);
  }
}

/**
 * Hook for using Android 14+ permission manager
 */
export function useAndroid14Permissions() {
  const permissionManager = Android14PermissionManager.getInstance();
  const [permissionState, setPermissionState] = React.useState<MediaPermissionState>(
    permissionManager.getPermissionState()
  );

  React.useEffect(() => {
    const initializePermissions = async () => {
      await permissionManager.initialize();
      const currentState = await permissionManager.refreshAllPermissions();
      setPermissionState(currentState);
    };

    initializePermissions();
  }, []);

  const requestPermissions = React.useCallback(async () => {
    const newState = await permissionManager.requestAllNecessaryPermissions();
    setPermissionState(newState);
    return newState;
  }, []);

  const refreshPermissions = React.useCallback(async () => {
    const newState = await permissionManager.refreshAllPermissions();
    setPermissionState(newState);
    return newState;
  }, []);

  return {
    permissionState,
    requestPermissions,
    refreshPermissions,
    hasAllNecessary: permissionManager.hasAllNecessaryPermissions(),
    requestCamera: permissionManager.requestCameraPermission.bind(permissionManager),
    requestMicrophone: permissionManager.requestMicrophonePermission.bind(permissionManager),
    requestPhotos: permissionManager.requestPhotoPermissions.bind(permissionManager),
    requestLocation: permissionManager.requestLocationPermissions.bind(permissionManager),
    requestNotifications: permissionManager.requestNotificationPermission.bind(permissionManager),
  };
}

export default Android14PermissionManager;