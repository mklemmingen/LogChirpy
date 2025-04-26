import { Tabs, Stack, router } from 'expo-router';
import {Platform, useColorScheme} from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { theme } from '@/constants/theme';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function TabLayout() {
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
                        backgroundColor: currentTheme.colors.tabBarBackground, // 👈 dynamically from theme
                    },
                    default: {
                        height: 70,
                        paddingBottom: 8,
                        backgroundColor: currentTheme.colors.tabBarBackground, // 👈
                    },
                }),
                tabBarActiveTintColor: currentTheme.colors.text.light, // 👈 bright white or light
                tabBarInactiveTintColor: currentTheme.colors.text.secondary, // 👈 softer text
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
                    title: 'Archive',
                    tabBarIcon: ({ color }) => (
                        <IconSymbol name="archive" size={26} color={color} />
                    ),
                }}
            />
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
                name="account"
                options={{
                    title: 'Cloud Sync',
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="user" color={color} />,
                }}
            />
        </Tabs>
    );
}
