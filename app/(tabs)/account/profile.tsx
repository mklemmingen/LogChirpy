import React, {useEffect} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ThemedIcon} from '@/components/ThemedIcon';
import Animated, {useAnimatedStyle, useSharedValue, withSpring, withTiming} from 'react-native-reanimated';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {ModernCard} from '@/components/ModernCard';
import {useColorVariants, useSemanticColors, useTheme, useTypography} from '@/hooks/useThemeColor';
import {useAuth} from '@/contexts/AuthContext';
import {Feather} from '@expo/vector-icons';
import {ProtectedRoute} from '@/components/ProtectedRoute';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Account profile screen component
 * Provides user account management, sync settings, and sign-out functionality
 */
export default function AccountProfileScreen() {
    const { t } = useTranslation();
    const theme = useTheme();
    const typography = useTypography();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const { user, isAuthenticated, signOut: authSignOut, isLoading } = useAuth();

    const signOutScale = useSharedValue(1);
    const fadeInOpacity = useSharedValue(0);

    useEffect(() => {
        if (isAuthenticated) {
            fadeInOpacity.value = withTiming(1, { duration: 300 });
        }
    }, [isAuthenticated]);

    const fadeInStyle = useAnimatedStyle(() => ({
        opacity: fadeInOpacity.value,
    }));

    const slideInStyle = useAnimatedStyle(() => ({
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
                            await authSignOut();
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

    useFocusEffect(
        React.useCallback(() => {
            if (!isLoading && !isAuthenticated) {
                router.replace('/(tabs)/account/(auth)/login');
            }
        }, [isLoading, isAuthenticated])
    );

    if (isLoading) {
        return null;
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <ProtectedRoute>
            <ThemedSafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={[typography.h2, styles.headerTitle]}>
                        {t('account.title')}
                    </Text>
                    <Text style={[typography.body, styles.headerSubtitle, { color: semanticColors.secondary }]}>
                        {t('account.subtitle', 'Manage your LogChirpy account')}
                    </Text>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={fadeInStyle}>
                        <Animated.View style={slideInStyle}>
                            <ModernCard
                                elevated={true}
                                bordered={false}
                                style={styles.profileCard}
                            >
                                <View style={styles.profileContent}>
                                    <View style={[styles.avatarContainer, { backgroundColor: variants.primary.light }]}>
                                        <Feather name="user" size={32} color={semanticColors.primary} />
                                    </View>

                                    <View style={styles.userInfo}>
                                        <Text style={[typography.body, { color: semanticColors.secondary }]}>
                                            {t('account.email_label')}
                                        </Text>
                                        <Text style={[typography.body, { color: semanticColors.primary }]}>
                                            {user?.email}
                                        </Text>
                                    </View>
                                </View>
                            </ModernCard>

                            <ModernCard
                                elevated={false}
                                bordered={true}
                                style={styles.actionsCard}
                            >
                                <View style={styles.actionsList}>

                                    <View style={styles.actionLeft}>
                                        <View style={[styles.actionIcon, { backgroundColor: variants.secondary.light }]}>
                                            <Feather name="refresh-cw" size={18} color={semanticColors.secondary} />
                                        </View>
                                        <View style={styles.actionText}>
                                            <Text style={[typography.body, { color: semanticColors.primary }]}>
                                                {t('account.syncStatus', 'Sync Status')}
                                            </Text>
                                            <Text style={[typography.label, { color: semanticColors.secondary }]}>
                                                {t('account.syncDescription', 'Cloud synchronization settings')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.actionLeft}>
                                        <View style={[styles.actionIcon, { backgroundColor: variants.primary.light }]}>
                                            <Feather name="shield" size={18} color={semanticColors.primary} />
                                        </View>
                                        <View style={styles.actionText}>
                                            <Text style={[typography.body, { color: semanticColors.primary }]}>
                                                {t('account.privacy', 'Privacy Settings')}
                                            </Text>
                                            <Text style={[typography.label, { color: semanticColors.secondary }]}>
                                                {t('account.privacyDescription', 'Manage your data and privacy')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </ModernCard>

                            <View style={styles.signOutSection}>
                                <Animated.View style={signOutAnimatedStyle}>
                                    <AnimatedPressable
                                        style={[
                                            styles.signOutButton,
                                            { backgroundColor: semanticColors.error },
                                        ]}
                                        onPress={handleSignOut}
                                        onPressIn={handleSignOutPressIn}
                                        onPressOut={handleSignOutPressOut}
                                        android_ripple={{ color: theme.colors.surface + '33' }}
                                    >
                                        <ThemedIcon name="log-out" size={20} color="primary" />
                                        <Text style={[typography.body, styles.signOutText, { color: semanticColors.background }]}>
                                            {t('buttons.signout')}
                                        </Text>
                                    </AnimatedPressable>
                                </Animated.View>

                                <Text style={[typography.label, styles.signOutWarning, { color: semanticColors.secondary }]}>
                                    {t('account.signOutWarning', 'You will need to sign in again to access cloud features')}
                                </Text>
                            </View>
                        </Animated.View>
                    </Animated.View>
                </ScrollView>
            </ThemedSafeAreaView>
        </ProtectedRoute>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    header: {
        paddingHorizontal: 24,
        paddingVertical: 24,
    },
    headerTitle: {
        marginBottom: 8,
    },
    headerSubtitle: {
        lineHeight: 22,
    },

    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 120,
        gap: 32,
    },

    profileCard: {
        marginBottom: 16,
    },
    profileContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        padding: 4,
    },
    avatarContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
        gap: 6,
    },

    actionsCard: {
        marginBottom: 16,
    },
    actionsList: {
        gap: 16,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    actionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 16,
        padding: 8,
    },
    actionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        flex: 1,
        gap: 4,
    },

    signOutSection: {
        marginTop: 24,
        gap: 16,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 28,
        borderRadius: 14,
        gap: 12,
    },
    signOutText: {
        fontWeight: '600',
    },
    signOutWarning: {
        textAlign: 'center',
        marginTop: 12,
    },
}); 