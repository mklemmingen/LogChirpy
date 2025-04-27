import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { theme } from '@/constants/theme';

export default function TabLayout() {
    const { t } = useTranslation(); // <-- import useTranslation
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

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
                        backgroundColor: currentTheme.colors.tabBarBackground,
                    },
                    default: {
                        height: 70,
                        paddingBottom: 8,
                        backgroundColor: currentTheme.colors.tabBarBackground,
                    },
                }),
                tabBarActiveTintColor: currentTheme.colors.text.secondary,
                tabBarInactiveTintColor: currentTheme.colors.text.primary,
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
                name="archive"
                options={{
                    title: t('tabs.archive'), // localized title
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="archive" size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabs.log'), // localized title
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="bird" size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    title: t('tabs.account'), // localized title
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="user" size={28} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: t('tabs.settings'), // localized title
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="settings" size={26} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
