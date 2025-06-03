import React from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    useColorScheme,
    ActivityIndicator,
    Pressable,
    Animated
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { DatabaseStatus } from '@/hooks/useProgressiveDatabase';

interface MinimalLoadingSplashProps {
    databaseStatus: DatabaseStatus;
    onContinue: () => void;
}

export default function MinimalLoadingSplash({
                                                 databaseStatus,
                                                 onContinue
                                             }: MinimalLoadingSplashProps) {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];

    const {
        currentPhase,
        coreProgress,
        statusMessage,
        estimatedTimeRemaining,
        error,
        retryInitialization
    } = databaseStatus;

    // Show minimal loading only for core loading
    // Once core is ready, let user into the app
    const shouldShowSplash = currentPhase === 'initializing' || currentPhase === 'core-loading';

    if (!shouldShowSplash) {
        // Core is ready - user can enter app
        onContinue();
        return null;
    }

    const getPhaseIcon = () => {
        if (error) return 'alert-triangle';
        return 'database';
    };

    const getPhaseColor = () => {
        if (error) return pal.colors.error;
        return pal.colors.primary;
    };

    const getPhaseTitle = () => {
        if (error) return t('splash.error', 'Database Error');
        return t('splash.title', 'LogChirpy');
    };

    const getPhaseMessage = () => {
        if (error) return error;
        if (currentPhase === 'core-loading') {
            return t('splash.coreLoading', 'Loading essential bird species...');
        }
        return t('splash.initializing', 'Preparing bird database...');
    };

    const formatTimeRemaining = (seconds?: number) => {
        if (!seconds || seconds < 1) return '';
        if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
        return `~${Math.ceil(seconds / 60)}m remaining`;
    };

    return (
        <View style={[styles.container, { backgroundColor: pal.colors.background }]}>
            {/* Minimal Logo */}
            <View style={styles.logoContainer}>
                <Image
                    source={require('@/assets/images/logo_no_bg.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            {/* Status Section */}
            <View style={styles.statusContainer}>
                <View style={[styles.iconContainer, { backgroundColor: getPhaseColor() + '15' }]}>
                    {error ? (
                        <Feather name={getPhaseIcon()} size={32} color={getPhaseColor()} />
                    ) : (
                        <ActivityIndicator size="large" color={getPhaseColor()} />
                    )}
                </View>

                <Text style={[styles.title, { color: pal.colors.text.primary }]}>
                    {getPhaseTitle()}
                </Text>

                <Text style={[styles.message, { color: pal.colors.text.secondary }]}>
                    {getPhaseMessage()}
                </Text>

                {/* Progress Bar - only show during core loading */}
                {currentPhase === 'core-loading' && !error && (
                    <View style={styles.progressSection}>
                        <View style={styles.progressInfo}>
                            <Text style={[styles.progressText, { color: pal.colors.text.primary }]}>
                                {coreProgress}%
                            </Text>
                            {estimatedTimeRemaining && (
                                <Text style={[styles.timeRemaining, { color: pal.colors.text.secondary }]}>
                                    {formatTimeRemaining(estimatedTimeRemaining)}
                                </Text>
                            )}
                        </View>

                        <View style={[styles.progressBarContainer, { backgroundColor: pal.colors.border }]}>
                            <Animated.View
                                style={[
                                    styles.progressBar,
                                    {
                                        backgroundColor: pal.colors.primary,
                                        width: `${coreProgress}%`
                                    }
                                ]}
                            />
                        </View>
                    </View>
                )}

                {/* Error Actions */}
                {error && (
                    <View style={styles.actionContainer}>
                        <Pressable
                            style={[styles.retryButton, { backgroundColor: pal.colors.primary }]}
                            onPress={retryInitialization}
                            android_ripple={{ color: pal.colors.primary + '20' }}
                        >
                            <Feather name="refresh-cw" size={18} color={pal.colors.text.primary} />
                            <Text style={[styles.retryButtonText, { color: pal.colors.text.primary }]}>
                                {t('splash.retry', 'Retry')}
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* Helpful Info */}
                {!error && (
                    <View style={styles.infoContainer}>
                        <Text style={[styles.infoText, { color: pal.colors.text.secondary }]}>
                            {t('splash.info', 'Loading only essential species for quick start')}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    logoContainer: {
        marginBottom: theme.spacing.xl,
    },
    logo: {
        width: 80,
        height: 80,
    },
    statusContainer: {
        alignItems: 'center',
        maxWidth: 320,
        width: '100%',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: theme.spacing.lg,
    },
    progressSection: {
        width: '100%',
        marginBottom: theme.spacing.lg,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
    },
    progressText: {
        fontSize: 16,
        fontWeight: '600',
    },
    timeRemaining: {
        fontSize: 12,
    },
    progressBarContainer: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    actionContainer: {
        width: '100%',
        marginTop: theme.spacing.md,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        gap: theme.spacing.sm,
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    infoContainer: {
        marginTop: theme.spacing.lg,
        paddingHorizontal: theme.spacing.md,
    },
    infoText: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 16,
        fontStyle: 'italic',
    },
});