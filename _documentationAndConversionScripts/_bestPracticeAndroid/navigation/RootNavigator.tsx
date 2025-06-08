/**
 * RootNavigator.tsx - Android-optimized navigation architecture
 * 
 * Implements modal groups pattern to prevent "child already has a parent" errors
 * Uses React Navigation v7 with proper Android navigation patterns
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Dimensions } from 'react-native';

import TabNavigator from './TabNavigator';
import BirdDetectionModal from '../screens/modals/BirdDetectionModal';
import CameraModal from '../screens/modals/CameraModal';
import VideoPlayerModal from '../screens/modals/VideoPlayerModal';
import PhotoPreviewModal from '../screens/modals/PhotoPreviewModal';

const RootStack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          // Android-specific optimizations
          animationTypeForReplace: 'push',
          animation: 'slide_from_right',
        }}
      >
        {/* Main app screens group */}
        <RootStack.Group>
          <RootStack.Screen 
            name="Main" 
            component={TabNavigator}
            options={{
              // Prevent memory leaks on Android
              freezeOnBlur: true,
            }}
          />
        </RootStack.Group>

        {/* Modal screens group - prevents view hierarchy conflicts */}
        <RootStack.Group 
          screenOptions={{ 
            presentation: 'modal',
            // Android modal optimizations
            gestureEnabled: true,
            statusBarTranslucent: true,
            statusBarBackgroundColor: 'transparent',
            // Memory management
            animationDuration: 200, // Faster for Android
          }}
        >
          <RootStack.Screen 
            name="CameraModal" 
            component={CameraModal}
            options={{
              // Camera-specific optimizations
              orientation: 'portrait',
              statusBarHidden: true,
            }}
          />
          <RootStack.Screen 
            name="BirdDetectionModal" 
            component={BirdDetectionModal}
            options={{
              gestureResponseDistance: Dimensions.get('window').height * 0.3,
            }}
          />
          <RootStack.Screen 
            name="VideoPlayerModal" 
            component={VideoPlayerModal}
            options={{
              orientation: 'all',
            }}
          />
          <RootStack.Screen 
            name="PhotoPreviewModal" 
            component={PhotoPreviewModal}
            options={{
              gestureDirection: 'vertical',
            }}
          />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}