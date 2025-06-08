/**
 * App.tsx - Android-optimized app entry point
 * 
 * Implements 2025 Android React Native patterns with proper memory management
 */

import React, { useEffect } from 'react';
import {
  StatusBar,
  LogBox,
  UIManager,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import RootNavigator from './navigation/RootNavigator';
import { useDetectionStore } from './store/detectionStore';

// Configure Android layout animations for better performance
if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(false); // Disabled for stability
}

// Android-specific optimizations
LogBox.ignoreLogs([
  'Remote debugger', // Ignore remote debugger warnings
  'Setting a timer', // Ignore long timer warnings
  'Require cycle', // Ignore require cycle warnings for better performance
]);

// Material Design 3 theme configuration
const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2E7D32',
    primaryContainer: '#C8E6C9',
    secondary: '#4CAF50',
    secondaryContainer: '#E8F5E8',
    tertiary: '#66BB6A',
    surface: '#FAFAFA',
    surfaceVariant: '#F5F5F5',
    background: '#FFFFFF',
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#4CAF50',
    primaryContainer: '#1B5E20',
    secondary: '#66BB6A',
    secondaryContainer: '#2E7D32',
    tertiary: '#81C784',
    surface: '#1E1E1E',
    surfaceVariant: '#2D2D2D',
    background: '#121212',
  },
};

export default function App() {
  const { updatePerformance } = useDetectionStore();

  useEffect(() => {
    // Initialize performance monitoring
    const performanceInterval = setInterval(() => {
      // Monitor memory usage (simplified for Android)
      const memoryInfo = performance.memory || { usedJSHeapSize: 0 };
      const memoryUsage = memoryInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
      
      // Monitor battery (would need native module in production)
      const batteryLevel = 100; // Placeholder
      
      updatePerformance({
        memoryUsage,
        batteryLevel,
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(performanceInterval);
  }, [updatePerformance]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={lightTheme}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor="transparent"
            translucent={true}
          />
          <RootNavigator />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}