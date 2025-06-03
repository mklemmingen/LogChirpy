import React, {useEffect, useState} from 'react';
import {Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View,} from 'react-native';
import {signOut} from 'firebase/auth';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Feather} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {useAnimatedStyle, useSharedValue, withSpring, withTiming,} from 'react-native-reanimated';

import {ModernCard} from '@/components/ModernCard';
import {auth} from '@/firebase/config';
import {useColorVariants, useMotionValues, useSemanticColors, useTheme, useTypography,} from '@/hooks/useThemeColor';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ModernAccountScreen() {
    const { t } = useTranslation();
    const semanticColors = useSemanticColors();
    const theme = useTheme();
    const typography = useTypography();
    const variants = useColorVariants();
    const motion = useMotionValues();
    const insets = useSafeAreaInsets();

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Animation values
    const signOutScale = useSharedValue(1);
    const fadeInOpacity = useSharedValue(0);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            setIsLoggedIn(!!user);
            setUserEmail(user?.email || null);

            if (!user) {
                requestAnimationFrame(() =>
                    router.replace('/(tabs)/account/(auth)/login')
                );
            } else {
                // Fade in animation when user loads
                fadeInOpacity.value = withTiming(1, { duration: motion.duration.medium });
            }
        });
        return unsubscribe;
    }, []);

    const fadeInStyle = useAnimatedStyle(() => ({
        opacity: fadeInOpacity.value,
        transform: [{ translateY: withTiming(fadeInOpacity.value === 1 ? 0 : 20) }],
    }));

    const signOutAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: signOutScale.value }],
    }));

    const handleSignOut = async () => {
        Alert.alert(
            t('account.signOutTitle', 'Sign Out'),
            t('account.signOutMessage', 'Are you sure you want to sign out?'),
            [
                {
                    text: t('common.cancel'),
                    style: 'cancel',
                },
                {
                    text: t('buttons.signout'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut(auth);
                            setIsLoggedIn(false);
                        } catch (error) {
                            console.error('Error signing out:', error);
                            Alert.alert(
                                t('common.error'),
                                t('account.signOutError', 'Failed to sign out. Please try again.')
                            );
                        }
                    },
                },
            ]
        );
    };

    const handleSignOutPressIn = () => {
        signOutScale.value = withSpring(0.95);
    };

    const handleSignOutPressOut = () => {
        signOutScale.value = withSpring(1);
    };

    if (!isLoggedIn) {
        return null; // Will redirect to login
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
            {/* Header */}
            <View style={[styles.header, { marginTop: insets.top }]}>
                <Text style={[typography.displayMedium, styles.headerTitle]}>
                    {t('account.title')}
                </Text>
                <Text style={[typography.bodyMedium, styles.headerSubtitle, { color: semanticColors.textSecondary }]}>
                    {t('account.subtitle', 'Manage your LogChirpy account')}
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={fadeInStyle}>
                    {/* Profile Section */}
                    <ModernCard
                        variant="elevated"
                        style={styles.profileCard}
                        title={t('account.profileInfo', 'Profile Information')}
                        headerAction={
                            <View style={[styles.statusBadge, { backgroundColor: variants.primarySubtle }]}>
                                <Feather name="check-circle" size={14} color={semanticColors.primary} />
                                <Text style={[typography.labelSmall, { color: semanticColors.primary }]}>
                                    {t('account.verified', 'Verified')}
                                </Text>
                            </View>
                        }
                    >
                        <View style={styles.profileContent}>
                            {/* Avatar */}
                            <View style={[styles.avatarContainer, { backgroundColor: variants.primarySubtle }]}>
                                <Feather name="user" size={32} color={semanticColors.primary} />
                            </View>

                            {/* User Info */}
                            <View style={styles.userInfo}>
                                <Text style={[typography.labelMedium, { color: semanticColors.textSecondary }]}>
                                    {t('account.email_label')}
                                </Text>
                                <Text style={[typography.bodyLarge, { color: semanticColors.text }]}>
                                    {userEmail}
                                </Text>
                            </View>
                        </View>
                    </ModernCard>

                    {/* Account Actions */}
                    <ModernCard
                        variant="outlined"
                        style={styles.actionsCard}
                        title={t('account.actions', 'Account Actions')}
                    >
                        <View style={styles.actionsList}>
                            {/* Sync Status */}
                            <Pressable
                                style={styles.actionItem}
                                onPress={() => {
                                    // Navigate to sync settings or show sync status
                                }}
                                android_ripple={{ color: variants.surfacePressed }}
                            >
                                <View style={styles.actionLeft}>
                                    <View style={[styles.actionIcon, { backgroundColor: variants.accentSubtle }]}>
                                        <Feather name="refresh-cw" size={18} color={semanticColors.accent} />
                                    </View>
                                    <View style={styles.actionText}>
                                        <Text style={[typography.bodyMedium, { color: semanticColors.text }]}>
                                            {t('account.syncStatus', 'Sync Status')}
                                        </Text>
                                        <Text style={[typography.labelSmall, { color: semanticColors.textSecondary }]}>
                                            {t('account.syncDescription', 'Cloud synchronization settings')}
                                        </Text>
                                    </View>
                                </View>
                                <Feather name="chevron-right" size={18} color={semanticColors.textSecondary} />
                            </Pressable>

                            {/* Privacy Settings */}
                            <Pressable
                                style={styles.actionItem}
                                onPress={() => {
                                    // Navigate to privacy settings
                                }}
                                android_ripple={{ color: variants.surfacePressed }}
                            >
                                <View style={styles.actionLeft}>
                                    <View style={[styles.actionIcon, { backgroundColor: variants.primarySubtle }]}>
                                        <Feather name="shield" size={18} color={semanticColors.primary} />
                                    </View>
                                    <View style={styles.actionText}>
                                        <Text style={[typography.bodyMedium, { color: semanticColors.text }]}>
                                            {t('account.privacy', 'Privacy Settings')}
                                        </Text>
                                        <Text style={[typography.labelSmall, { color: semanticColors.textSecondary }]}>
                                            {t('account.privacyDescription', 'Manage your data and privacy')}
                                        </Text>
                                    </View>
                                </View>
                                <Feather name="chevron-right" size={18} color={semanticColors.textSecondary} />
                            </Pressable>

                            {/* Export Data */}
                            <Pressable
                                style={styles.actionItem}
                                onPress={() => {
                                    // Handle data export
                                }}
                                android_ripple={{ color: variants.surfacePressed }}
                            >
                                <View style={styles.actionLeft}>
                                    <View style={[styles.actionIcon, { backgroundColor: variants.accentSubtle }]}>
                                        <Feather name="download" size={18} color={semanticColors.accent} />
                                    </View>
                                    <View style={styles.actionText}>
                                        <Text style={[typography.bodyMedium, { color: semanticColors.text }]}>
                                            {t('account.exportData', 'Export Data')}
                                        </Text>
                                        <Text style={[typography.labelSmall, { color: semanticColors.textSecondary }]}>
                                            {t('account.exportDescription', 'Download your bird sightings')}
                                        </Text>
                                    </View>
                                </View>
                                <Feather name="chevron-right" size={18} color={semanticColors.textSecondary} />
                            </Pressable>
                        </View>
                    </ModernCard>

                    {/* Sign Out Section */}
                    <View style={styles.signOutSection}>
                        <AnimatedPressable
                            style={[
                                styles.signOutButton,
                                { backgroundColor: semanticColors.error },
                                signOutAnimatedStyle,
                            ]}
                            onPress={handleSignOut}
                            onPressIn={handleSignOutPressIn}
                            onPressOut={handleSignOutPressOut}
                            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                        >
                            <Feather name="log-out" size={20} color={semanticColors.onPrimary} />
                            <Text style={[typography.bodyLarge, styles.signOutText, { color: semanticColors.onPrimary }]}>
                                {t('buttons.signout')}
                            </Text>
                        </AnimatedPressable>

                        <Text style={[typography.labelSmall, styles.signOutWarning, { color: semanticColors.textTertiary }]}>
                            {t('account.signOutWarning', 'You will need to sign in again to access cloud features')}
                        </Text>
                    </View>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 40,
    },

    // Header
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    headerTitle: {
        marginBottom: 4,
    },
    headerSubtitle: {
        lineHeight: 20,
    },

    // Scroll View
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 100,
        gap: 24,
    },

    // Profile Card
    profileCard: {
        marginBottom: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    profileContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatarContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
        gap: 4,
    },

    // Actions Card
    actionsCard: {
        marginBottom: 8,
    },
    actionsList: {
        gap: 4,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 4,
        borderRadius: 12,
    },
    actionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    actionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        flex: 1,
        gap: 2,
    },

    // Sign Out Section
    signOutSection: {
        marginTop: 16,
        gap: 12,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 8,
    },
    signOutText: {
        fontWeight: '600',
    },
    signOutWarning: {
        textAlign: 'center',
        lineHeight: 16,
        fontStyle: 'italic',
    },
});