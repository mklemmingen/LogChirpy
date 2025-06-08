import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import HomeScreen from './(tabs)/index';
import DetectionScreen from './(tabs)/detection';
import LogScreen from './(tabs)/log';
import SettingsScreen from './(tabs)/settings';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        lazy: true,
        unmountOnBlur: route.name === 'detection',
        freezeOnBlur: route.name !== 'index',
        
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 8,
          borderTopWidth: 0,
        },
        
        headerShown: false,
        
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = '';
          
          switch (route.name) {
            case 'index':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'detection':
              iconName = focused ? 'camera' : 'camera-outline';
              break;
            case 'log':
              iconName = focused ? 'clipboard-list' : 'clipboard-list-outline';
              break;
            case 'settings':
              iconName = focused ? 'cog' : 'cog-outline';
              break;
          }

            return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="index" 
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="detection" 
        component={DetectionScreen}
        options={{ title: 'Detect' }}
      />
      <Tab.Screen 
        name="log" 
        component={LogScreen}
        options={{ title: 'Sightings' }}
      />
      <Tab.Screen 
        name="settings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}