import { useEffect, useState } from 'react';
import {StyleSheet, useColorScheme} from 'react-native';
import { signOut } from 'firebase/auth';
import { Stack, router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { TouchableOpacity, Image } from 'react-native';
import { auth } from '@/firebase/config';
import { theme } from '@/constants/theme';
import ParallaxScrollView from '@/components/ParallaxScrollView';


export default function AccountScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setIsLoggedIn(!!user);
        });

        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.replace('/account/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (!isLoggedIn) {
        return (
            <Stack>
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="signup" options={{ headerShown: false }} />
                <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            </Stack>
        );
    }

    return (
        <ParallaxScrollView
            headerBackgroundColor={{
                light: currentTheme.colors.highlight,
                dark: currentTheme.colors.shadow
            }}
            headerImage={
                <Image
                    source={require('@/assets/images/avatar_placeholder.png')}
                    style={styles.headerAvatar}
                />
            }>
            <ThemedView style={styles.container}>
                <ThemedView style={styles.section}>
                    <ThemedText type="title" style={{ color: currentTheme.colors.text.primary }}>Account Details</ThemedText>
                    <ThemedView style={[styles.infoContainer, { backgroundColor: currentTheme.colors.background }]}>
                        <ThemedText style={{ color: currentTheme.colors.text.primary }} type="subtitle">Email</ThemedText>
                        <ThemedText style={{ color: currentTheme.colors.text.secondary }}>{auth.currentUser?.email}</ThemedText>
                    </ThemedView>
                </ThemedView>

                <ThemedView style={styles.section}>
                    <TouchableOpacity
                        style={[styles.signOutButton, { backgroundColor: currentTheme.colors.primary }]}
                        onPress={handleSignOut}
                    >
                        <ThemedText style={[styles.signOutButtonText, { color: currentTheme.colors.text.light }]}>
                            Sign Out
                        </ThemedText>
                    </TouchableOpacity>
                </ThemedView>
            </ThemedView>
        </ParallaxScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: theme.spacing.lg,
        gap: theme.spacing.xl,
    },
    headerAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        position: 'absolute',
        bottom: theme.spacing.xl,
        alignSelf: 'center',
    },
    section: {
        gap: theme.spacing.md,
    },
    infoContainer: {
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        gap: theme.spacing.xs,
        borderWidth: 1,
        borderColor: theme.light.colors.border,
        ...theme.shadows.md,
    },
    signOutButton: {
        height: 50,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    signOutButtonText: {
        fontWeight: '600',
    },
}); 