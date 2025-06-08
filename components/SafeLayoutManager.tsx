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
    if (!hasConfiguredAnimations.current) {
      // Disable layout animations by default on Android to prevent UIFrameGuarded errors
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(enableLayoutAnimations);
      }

      hasConfiguredAnimations.current = true;
    }

    return () => {
      // Cleanup: ensure animations are disabled when component unmounts
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(false);
      }
    };
  }, [enableLayoutAnimations]);

  // Disable layout animations by default on Android
  const safeLayoutAnimation = {
    configureNext: (config: any, onAnimationDidEnd?: () => void) => {
      if (enableLayoutAnimations) {
        LayoutAnimation.configureNext(config, onAnimationDidEnd);
      } else {
        // Call the callback immediately to maintain functionality
        onAnimationDidEnd?.();
      }
    },
    
    easeInEaseOut: (onAnimationDidEnd?: () => void) => {
      if (enableLayoutAnimations) {
        LayoutAnimation.easeInEaseOut(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },

    linear: (onAnimationDidEnd?: () => void) => {
      if (enableLayoutAnimations) {
        LayoutAnimation.linear(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },

    spring: (onAnimationDidEnd?: () => void) => {
      if (enableLayoutAnimations) {
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
      if (enableAnimations) {
        LayoutAnimation.configureNext(config, onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },
    
    easeInEaseOut: (onAnimationDidEnd?: () => void) => {
      if (enableAnimations) {
        LayoutAnimation.easeInEaseOut(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },

    linear: (onAnimationDidEnd?: () => void) => {
      if (enableAnimations) {
        LayoutAnimation.linear(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },

    spring: (onAnimationDidEnd?: () => void) => {
      if (enableAnimations) {
        LayoutAnimation.spring(onAnimationDidEnd);
      } else {
        onAnimationDidEnd?.();
      }
    },
  };
}

export default SafeLayoutManager;