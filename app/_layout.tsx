import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {useColorScheme, View, StyleSheet} from 'react-native';
import 'react-native-reanimated';

import { theme } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const currentTheme = theme[colorScheme];

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
      <ThemeProvider
          value={{
              dark: colorScheme === 'dark',
              light: colorScheme === 'light',
              colors: {
                  notification: currentTheme.colors.active,
                  background: currentTheme.colors.background,
                  card: currentTheme.colors.accent,
                  text: currentTheme.colors.text.primary,
                  border: currentTheme.colors.border,
                  primary: currentTheme.colors.primary,
              },
              fonts: {
                  regular: currentTheme.fonts.regular,
                  medium: currentTheme.fonts.medium,
                  bold: currentTheme.fonts.bold,
                  heavy: currentTheme.fonts.heavy,
              },
          }}
      >
      <View style={styles.container}>
          <View style={styles.content}>
              <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
              </Stack>
          </View>
      </View>
      <StatusBar style="auto" />
  </ThemeProvider>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        position: 'relative',
    },
    birdAnimation: {
        ...StyleSheet.absoluteFillObject, // Füllt den gesamten Bildschirm
        zIndex: -1, // Stellt sicher, dass es hinter allen anderen Elementen liegt
    },
});