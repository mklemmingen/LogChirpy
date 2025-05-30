import React, {useEffect, useState} from 'react';
import {Image, StyleSheet, TouchableOpacity, useColorScheme} from 'react-native';
import {signOut} from 'firebase/auth';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';

import {ThemedText} from '@/components/ThemedText';
import {ThemedView} from '@/components/ThemedView';
import {auth} from '@/firebase/config';
import {theme} from '@/constants/theme';
import ParallaxScrollView from '../../../components/ParallaxScrollView';

export default function AccountScreen() {
    const { t } = useTranslation(); // <-- Hook into translations
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(user => {
            setIsLoggedIn(!!user);
            /** don’t navigate *while* we’re in the same render frame */
            if (!user) requestAnimationFrame(() =>
                router.replace('/(tabs)/account/(auth)/login')
            );
        });
        return unsub;
    }, []);

    return (
        <ParallaxScrollView
            headerBackgroundColor={{
                light: currentTheme.colors.background,
                dark: currentTheme.colors.background,
            }}
            headerImage={
                <Image
                    source={require('../../../assets/images/avatar_placeholder.png')}
                    style={styles.headerAvatar}
                />
            }>
            <ThemedView style={styles.container}>
                <ThemedView style={styles.section}>
                    <ThemedText type="title" style={{ color: currentTheme.colors.text.primary }}>
                        {t('account.title')}
                    </ThemedText>
                    <ThemedView style={[styles.infoContainer, { backgroundColor: currentTheme.colors.background }]}>
                        <ThemedText style={{ color: currentTheme.colors.text.primary }} type="default">
                            {t('account.email_label')}
                        </ThemedText>
                        <ThemedText style={{ color: currentTheme.colors.text.secondary }}>
                            {auth.currentUser?.email}
                        </ThemedText>
                    </ThemedView>
                </ThemedView>

                <ThemedView style={styles.section}>
                    <TouchableOpacity
                        style={[styles.signOutButton, { backgroundColor: currentTheme.colors.primary }]}
                        onPress={async () => {
                            try {
                                await signOut(auth);
                                setIsLoggedIn(false);
                            } catch (error) {
                                console.error('Error signing out:', error);
                            }
                        }}
                    >
                        <ThemedText style={[styles.signOutButtonText, { color: currentTheme.colors.text.primary }]} type="default">
                            {t('buttons.signout')}
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
        marginBottom: theme.spacing.xl,
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
    linkText: {
        fontSize: 18,
        textAlign: 'center',
        padding: 16,
    },
});
