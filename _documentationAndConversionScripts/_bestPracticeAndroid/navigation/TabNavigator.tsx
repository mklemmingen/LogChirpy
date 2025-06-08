/**
 * TabNavigator.tsx - Android Material Design 3 optimized tab navigation
 * 
 * Uses React Navigation bottom tabs with Android-specific optimizations
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import DetectionScreen from '../screens/DetectionScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import BirdexScreen from '../screens/BirdexScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Import icons
import { IconSymbol } from '../../components/ui/IconSymbol';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // Android Material Design 3 tab bar
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceVariant,
          borderTopWidth: 0,
          elevation: 8, // Android shadow
          height: 64 + insets.bottom, // Material 3 standard
          paddingBottom: insets.bottom,
          paddingTop: 8,
          // Android performance optimizations
          position: 'absolute',
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        // Android-specific optimizations
        lazy: true, // Lazy load tabs for memory efficiency
        freezeOnBlur: true, // Prevent background tabs from updating
        tabBarHideOnKeyboard: true, // Android UX pattern
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="home" size={size} color={color} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Detection"
        component={DetectionScreen}
        options={{
          tabBarLabel: 'Detect',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="camera" size={size} color={color} />
          ),
          // Detection screen optimizations
          unmountOnBlur: true, // Free camera resources when not active
        }}
      />
      
      <Tab.Screen
        name="Archive"
        component={ArchiveScreen}
        options={{
          tabBarLabel: 'Archive',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="archive" size={size} color={color} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Birdex"
        component={BirdexScreen}
        options={{
          tabBarLabel: 'Birdex',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="bird" size={size} color={color} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}