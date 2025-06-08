/**
 * Safe Layout Manager
 * Prevents layout animation conflicts that cause UIFrameGuarded.AddViewAt errors
 */

import React, { useEffect, useRef } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';

interface SafeLayoutManagerProps {
  children: React.ReactNode;
  enableLayoutAnimations?: boolean;
}

/**
 * Component that safely manages layout animations to prevent view conflicts
 */
export function SafeLayoutManager({ 
  children, 
  enableLayoutAnimations = false 
}: SafeLayoutManagerProps) {
  const hasConfiguredAnimations = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'android' && !hasConfiguredAnimations.current) {
      // Disable layout animations by default on Android to prevent UIFrameGuarded errors
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(enableLayoutAnimations);
      }

      hasConfiguredAnimations.current = true;
    }

    return () => {
      // Cleanup: ensure animations are disabled when component unmounts
      if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(false);
      }
    };
  }, [enableLayoutAnimations]);

  // Don't use LayoutAnimation.configureNext on Android by default
  const safeLayoutAnimation = {
    configureNext: (config: any, onAnimationDidEnd?: () => void) => {
      if (Platform.OS === 'ios' || enableLayoutAnimations) {
        LayoutAnimation.configureNext(config, onAnimationDidEnd);
      } else {
        // Call the callback immediately on Android to maintain functionality
        onAnimationDidEnd?.();
      }
    },
    
    easeInEaseOut: (onAnimationDidEnd?: () => void) => {
      if (Platform.OS === 'ios' || enableLayoutAnimations) {
        LayoutAnimation.easeInEaseOut(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },

    linear: (onAnimationDidEnd?: () => void) => {
      if (Platform.OS === 'ios' || enableLayoutAnimations) {
        LayoutAnimation.linear(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },

    spring: (onAnimationDidEnd?: () => void) => {
      if (Platform.OS === 'ios' || enableLayoutAnimations) {
        LayoutAnimation.spring(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },
  };

  // Provide safe layout animation methods via context if needed
  return <>{children}</>;
}

/**
 * Hook to safely use layout animations
 */
export function useSafeLayoutAnimation(enableAnimations = false) {
  return {
    configureNext: (config: any, onAnimationDidEnd?: () => void) => {
      if (Platform.OS === 'ios' || enableAnimations) {
        LayoutAnimation.configureNext(config, onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },
    
    easeInEaseOut: (onAnimationDidEnd?: () => void) => {
      if (Platform.OS === 'ios' || enableAnimations) {
        LayoutAnimation.easeInEaseOut(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },

    linear: (onAnimationDidEnd?: () => void) => {
      if (Platform.OS === 'ios' || enableAnimations) {
        LayoutAnimation.linear(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },

    spring: (onAnimationDidEnd?: () => void) => {
      if (Platform.OS === 'ios' || enableAnimations) {
        LayoutAnimation.spring(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },
  };
}

export default SafeLayoutManager;