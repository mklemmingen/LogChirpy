import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform, UIManager, View, Text, Button, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Context and Services
import { AuthProvider } from '@/app/context/AuthContext';
import { CombinedMLProvider } from '@/app/context/CombinedMLProvider';
import { DatabaseLoadingScreen } from '@/components/DatabaseLoadingScreen';
import { birdDexDB } from '@/services/databaseBirDex';

// Hooks and Utils
import { useBirdDexDatabase } from '@/hooks/useBirdDexDatabase';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useTheme } from '@/hooks/useThemeColor';
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

  console.log('Android lifecycle optimizations enabled');
}


/**
 * Root Layout with Android Fragment Lifecycle Management
 * Implements expo-router with Fragment-aware navigation
 */
export default function RootLayout() {
  const colors = useUnifiedColors();
  const theme = useTheme();

  // Font loading with Fragment lifecycle awareness
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Database initialization with Fragment-safe loading
  const { 
    isLoading: isDatabaseLoading, 
    error: databaseError,
    progress: databaseProgress,
    loadedRecords
  } = useBirdDexDatabase();

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

  // Loading state management - no providers needed during loading
  if (!loaded) {
    return null;
  }

  if (isDatabaseLoading) {
    return (
      <DatabaseLoadingScreen
        isVisible={true}
        loadingProgress={databaseProgress || 0}
        loadingStatus={`Loading database... ${loadedRecords || 0} species loaded`}
      />
    );
  }

  if (databaseError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Database Error</Text>
        <Text style={styles.errorMessage}>{databaseError}</Text>
        <Button 
          title="Retry" 
          onPress={() => {
            birdDexDB.initialize();
          }} 
        />
      </View>
    );
  }

  // Main app render - with providers that need navigation context
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CombinedMLProvider>
            <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
              <StatusBar 
                style={colors.isDark ? 'light' : 'dark'} 
                backgroundColor={colors.background.elevated}
              />
              
              {/* expo-router Stack */}
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'fade',
                  gestureEnabled: true,
                  fullScreenGestureEnabled: false,
                  freezeOnBlur: true,
                }}
              >
                <Stack.Screen 
                  name="(tabs)" 
                  options={{
                    title: 'LogChirpy',
                    headerShown: false,
                  }}
                />
                
                <Stack.Screen 
                  name="log" 
                  options={{
                    title: 'Log Bird Sighting',
                    headerShown: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
                
                <Stack.Screen 
                  name="+not-found" 
                  options={{
                    title: 'Not Found',
                    headerShown: false,
                  }}
                />
              </Stack>
            </View>
          </CombinedMLProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});