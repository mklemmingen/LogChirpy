/**
 * Safe View Manager for Preventing UIFrameGuarded.AddViewAt Errors
 * 
 * This component manages view lifecycle and prevents native view hierarchy conflicts
 * that cause UIFrameGuarded.AddViewAt errors on Android devices.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ViewStyle, Platform, InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

interface SafeViewManagerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  enabled?: boolean;
  onViewReady?: () => void;
  onViewUnmount?: () => void;
}

/**
 * SafeViewManager prevents UIFrameGuarded errors by:
 * 1. Delaying view mounting until the next frame
 * 2. Properly managing view lifecycle
 * 3. Ensuring safe unmounting
 * 4. Preventing rapid mount/unmount cycles
 */
export function SafeViewManager({
  children,
  style,
  enabled = true,
  onViewReady,
  onViewUnmount,
}: SafeViewManagerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const mountTimeoutRef = useRef<any>(null);
  const unmountTimeoutRef = useRef<any>(null);
  const isUnmountingRef = useRef(false);

  // Safe mounting with frame delay
  const safeMountView = useCallback(() => {
    if (!enabled || isUnmountingRef.current) return;

    // Clear any pending unmount
    if (unmountTimeoutRef.current) {
      clearTimeout(unmountTimeoutRef.current);
      unmountTimeoutRef.current = null;
    }

    // Use InteractionManager to ensure mounting happens after animations
    InteractionManager.runAfterInteractions(() => {
      if (!isUnmountingRef.current && enabled) {
        mountTimeoutRef.current = setTimeout(() => {
          if (!isUnmountingRef.current && enabled) {
            setIsMounted(true);
            
            // Additional frame delay for complex views
            requestAnimationFrame(() => {
              if (!isUnmountingRef.current && enabled) {
                setIsReady(true);
                onViewReady?.();
              }
            });
          }
        }, Platform.OS === 'android' ? 50 : 16); // Longer delay on Android
      }
    });
  }, [enabled, onViewReady]);

  // Safe unmounting with cleanup delay
  const safeUnmountView = useCallback(() => {
    isUnmountingRef.current = true;

    // Clear any pending mount
    if (mountTimeoutRef.current) {
      clearTimeout(mountTimeoutRef.current);
      mountTimeoutRef.current = null;
    }

    setIsReady(false);
    onViewUnmount?.();

    // Delay actual unmounting to prevent conflicts
    unmountTimeoutRef.current = setTimeout(() => {
      if (isUnmountingRef.current) {
        setIsMounted(false);
      }
    }, Platform.OS === 'android' ? 100 : 50);
  }, [onViewUnmount]);

  // Handle focus changes
  useFocusEffect(
    useCallback(() => {
      isUnmountingRef.current = false;
      safeMountView();

      return () => {
        safeUnmountView();
      };
    }, [safeMountView, safeUnmountView])
  );

  // Handle enabled prop changes
  useEffect(() => {
    if (enabled) {
      isUnmountingRef.current = false;
      safeMountView();
    } else {
      safeUnmountView();
    }
  }, [enabled, safeMountView, safeUnmountView]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (mountTimeoutRef.current) {
        clearTimeout(mountTimeoutRef.current);
      }
      if (unmountTimeoutRef.current) {
        clearTimeout(unmountTimeoutRef.current);
      }
    };
  }, []);

  // Don't render anything until safely mounted
  if (!isMounted || !isReady) {
    return <View style={style} />;
  }

  return (
    <View style={style}>
      {children}
    </View>
  );
}

/**
 * Safe Camera View Manager
 * Specialized for camera components that are prone to view conflicts
 */
export function SafeCameraViewManager({
  children,
  style,
  isActive,
  onCameraReady,
  onCameraUnmount,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  isActive: boolean;
  onCameraReady?: () => void;
  onCameraUnmount?: () => void;
}) {
  const [cameraEnabled, setCameraEnabled] = useState(false);

  // Manage camera lifecycle more carefully
  useEffect(() => {
    if (isActive) {
      // Delay camera activation to prevent view conflicts
      const timer = setTimeout(() => {
        setCameraEnabled(true);
      }, Platform.OS === 'android' ? 200 : 100);

      return () => clearTimeout(timer);
    } else {
      // Immediate deactivation but with cleanup delay
      setCameraEnabled(false);
      setTimeout(() => {
        onCameraUnmount?.();
      }, 50);
    }
  }, [isActive, onCameraUnmount]);

  return (
    <SafeViewManager
      style={style}
      enabled={cameraEnabled}
      onViewReady={onCameraReady}
      onViewUnmount={onCameraUnmount}
    >
      {children}
    </SafeViewManager>
  );
}

/**
 * Safe Modal View Manager
 * Prevents modal-related view hierarchy conflicts
 */
export function SafeModalViewManager({
  children,
  visible,
  style,
  onModalReady,
  onModalUnmount,
}: {
  children: React.ReactNode;
  visible: boolean;
  style?: ViewStyle;
  onModalReady?: () => void;
  onModalUnmount?: () => void;
}) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      // Delay modal rendering to prevent conflicts
      const timer = setTimeout(() => {
        setShouldRender(true);
      }, Platform.OS === 'android' ? 100 : 50);

      return () => clearTimeout(timer);
    } else {
      setShouldRender(false);
    }
  }, [visible]);

  if (!shouldRender) {
    return null;
  }

  return (
    <SafeViewManager
      style={style}
      enabled={visible}
      onViewReady={onModalReady}
      onViewUnmount={onModalUnmount}
    >
      {children}
    </SafeViewManager>
  );
}

export default SafeViewManager;