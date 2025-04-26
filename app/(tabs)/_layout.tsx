import { Tabs, router } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { auth } from '@/firebase/config';

export default function TabLayout() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarButton: HapticTab,
                tabBarBackground: TabBarBackground,
                tabBarStyle: Platform.select({
                    ios: {
                        position: 'absolute',
                        height: 80,
                        paddingBottom: 10,
                        backgroundColor: theme.background,
                    },
                    default: {
                        height: 70,
                        paddingBottom: 8,
                        backgroundColor: theme.background,
                    },
                }),
                tabBarActiveTintColor: theme.tint,
                tabBarInactiveTintColor: theme.muted,
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                    marginBottom: 2,
                },
                tabBarIconStyle: {
                    marginTop: 4,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Log Chirps',
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="bird" size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="archive"
                options={{
                    title: 'Archive',
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="archive" size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    title: 'Explore',
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="explore" size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="imageModel"
                options={{
                    title: 'DEBUG: ML Model TESTS',
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="brain" size={26} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
