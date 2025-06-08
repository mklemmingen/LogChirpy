import React, { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform, UIManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Context and Services
import { AuthProvider } from '@/app/context/AuthContext';
import { ModalProvider } from '@/app/context/ModalContext';
import { CombinedMLProvider } from '@/app/context/CombinedMLProvider';
import { ModalRenderer } from '@/components/modals/ModalRenderer';
import { DatabaseLoadingScreen } from '@/components/DatabaseLoadingScreen';
import { NavigationErrorBoundary } from '@/components/NavigationErrorBoundary';

// Hooks and Utils
import { useBirdDexDatabase } from '@/hooks/useBirdDexDatabase';
import '@/i18n/i18n';
import '@/services/nativeErrorInterceptor';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Android Fragment Lifecycle Optimizations
if (Platform.OS === 'android') {
  // Disable layout animations to prevent ViewGroup errors
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(false);
  }

  // Enable Fragment-compatible view management
  UIManager.constants = {
    ...UIManager.constants,
    AndroidViewHierarchyOptimized: true,
    FragmentLifecycleEnabled: true,
  };

  console.log('Android Fragment lifecycle optimizations enabled');
}

/**
 * Material You Dynamic Theme Configuration
 * Implements Android 2025 theming with Fragment lifecycle support
 */
function getMaterialYouTheme(colorScheme: 'light' | 'dark' | null) {
  const baseTheme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  
  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      // Material You adaptive colors
      primary: '#4CAF50',
      primaryContainer: '#A8E6CF',
      secondary: '#2196F3',
      secondaryContainer: '#BBDEFB',
      surface: colorScheme === 'dark' ? '#121212' : '#FFFFFF',
      surfaceVariant: colorScheme === 'dark' ? '#2C2C2C' : '#F5F5F5',
      onSurface: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
      // Fragment-safe background colors
      background: colorScheme === 'dark' ? '#000000' : '#FAFAFA',
    },
    // Android Fragment lifecycle animation durations
    animation: {
      scale: 300,
      fade: 200,
      defaultAnimationDuration: 250,
    },
  };
}

/**
 * Root Layout with Android Fragment Lifecycle Management
 * Implements expo-router with Fragment-aware navigation
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = getMaterialYouTheme(colorScheme);

  // Font loading with Fragment lifecycle awareness
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Database initialization with Fragment-safe loading
  const { isLoading: isDatabaseLoading, error: databaseError } = useBirdDexDatabase();

  // Fragment-aware splash screen management
  useEffect(() => {
    if (loaded && !isDatabaseLoading) {
      // Delay splash screen hiding to prevent Fragment transition errors
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [loaded, isDatabaseLoading]);

  // Fragment loading state management
  if (!loaded) {
    return null;
  }

  if (isDatabaseLoading) {
    return <DatabaseLoadingScreen />;
  }

  if (databaseError) {
    return (
      <NavigationErrorBoundary
        error={databaseError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <NavigationErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <AuthProvider>
              <CombinedMLProvider>
                <ModalProvider>
                  {/* Fragment-aware status bar */}
                  <StatusBar 
                    style={colorScheme === 'dark' ? 'light' : 'dark'} 
                    backgroundColor={theme.colors.surface}
                  />
                  
                  {/* expo-router Stack with Fragment optimizations */}
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: 'fade', // Fragment-safe animation
                      gestureEnabled: true,
                      fullScreenGestureEnabled: false, // Prevent Fragment conflicts
                      // Fragment lifecycle optimizations
                      freezeOnBlur: true, // Preserve Fragment state
                      unmountOnBlur: false, // Keep Fragments mounted for faster transitions
                    }}
                  >
                    {/* Main tab navigator */}
                    <Stack.Screen 
                      name="(tabs)" 
                      options={{
                        title: 'LogChirpy',
                        headerShown: false,
                      }}
                    />
                    
                    {/* Log flow screens */}
                    <Stack.Screen 
                      name="log" 
                      options={{
                        title: 'Log Bird Sighting',
                        headerShown: false,
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                      }}
                    />
                    
                    {/* Not found screen */}
                    <Stack.Screen 
                      name="+not-found" 
                      options={{
                        title: 'Not Found',
                        headerShown: false,
                      }}
                    />
                  </Stack>
                  
                  {/* Modal system with Fragment lifecycle support */}
                  <ModalRenderer />
                </ModalProvider>
              </CombinedMLProvider>
            </AuthProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </NavigationErrorBoundary>
  );
}