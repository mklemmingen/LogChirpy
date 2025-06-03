import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    useColorScheme,
    Pressable,
    Animated
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { DatabaseStatus } from '@/hooks/useProgressiveDatabase';

interface BackgroundLoadingBannerProps {
    databaseStatus: DatabaseStatus;
}

export default function BackgroundLoadingBanner({
                                                    databaseStatus
                                                }: BackgroundLoadingBannerProps) {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];
    const [isExpanded, setIsExpanded] = useState(false);

    const {
        isBackgroundLoading,
        backgroundProgress,
        statusMessage,
        estimatedTimeRemaining
    } = databaseStatus;

    // Don't show banner if not background loading
    if (!isBackgroundLoading) return null;

    const formatTimeRemaining = (seconds?: number) => {
        if (!seconds || seconds < 1) return '';
        if (seconds < 60) return `${Math.ceil(seconds)}s`;
        return `${Math.ceil(seconds / 60)}m`;
    };

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <View style={[styles.container, { backgroundColor: pal.colors.primary + '15' }]}>
            <Pressable
                style={styles.header}
                onPress={toggleExpanded}
                android_ripple={{ color: pal.colors.primary + '20' }}
            >
                <View style={styles.headerContent}>
                    <View style={styles.iconContainer}>
                        <Feather name="download-cloud" size={16} color={pal.colors.primary} />
                    </View>

                    <View style={styles.textContainer}>
                        <Text style={[styles.title, { color: pal.colors.text.primary }]}>
                            {t('background.loadingSpecies', 'Loading additional species')}
                        </Text>
                        {estimatedTimeRemaining && (
                            <Text style={[styles.subtitle, { color: pal.colors.text.secondary }]}>
                                {formatTimeRemaining(estimatedTimeRemaining)} {t('background.remaining', 'remaining')}
                            </Text>
                        )}
                    </View>

                    <View style={styles.progressContainer}>
                        <Text style={[styles.progressText, { color: pal.colors.primary }]}>
                            {backgroundProgress}%
                        </Text>
                        <Feather
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={pal.colors.text.secondary}
                        />
                    </View>
                </View>

                {/* Compact Progress Bar */}
                <View style={[styles.compactProgressBar, { backgroundColor: pal.colors.border }]}>
                    <Animated.View
                        style={[
                            styles.compactProgressFill,
                            {
                                backgroundColor: pal.colors.primary,
                                width: `${backgroundProgress}%`
                            }
                        ]}
                    />
                </View>
            </Pressable>

            {/* Expanded Details */}
            {isExpanded && (
                <View style={[styles.expandedContent, { borderTopColor: pal.colors.border }]}>
                    <Text style={[styles.detailText, { color: pal.colors.text.secondary }]}>
                        {statusMessage || t('background.defaultMessage', 'Downloading comprehensive bird database in the background')}
                    </Text>

                    <View style={styles.detailRow}>
                        <Feather name="info" size={14} color={pal.colors.text.secondary} />
                        <Text style={[styles.infoText, { color: pal.colors.text.secondary }]}>
                            {t('background.appUsable', 'App is fully usable while this completes')}
                        </Text>
                    </View>

                    {/* Full Progress Bar */}
                    <View style={styles.fullProgressContainer}>
                        <View style={[styles.fullProgressBar, { backgroundColor: pal.colors.border }]}>
                            <Animated.View
                                style={[
                                    styles.fullProgressFill,
                                    {
                                        backgroundColor: pal.colors.primary,
                                        width: `${backgroundProgress}%`
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[styles.fullProgressText, { color: pal.colors.text.primary }]}>
                            {backgroundProgress}% {t('background.complete', 'complete')}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: theme.spacing.md,
        marginVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        ...theme.shadows.sm,
    },
    header: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.xs,
    },
    iconContainer: {
        marginRight: theme.spacing.sm,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 18,
    },
    subtitle: {
        fontSize: 12,
        lineHeight: 16,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '600',
        minWidth: 32,
        textAlign: 'right',
    },
    compactProgressBar: {
        height: 3,
        borderRadius: 1.5,
        overflow: 'hidden',
    },
    compactProgressFill: {
        height: '100%',
        borderRadius: 1.5,
    },
    expandedContent: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderTopWidth: 1,
        gap: theme.spacing.sm,
    },
    detailText: {
        fontSize: 13,
        lineHeight: 18,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    infoText: {
        fontSize: 12,
        flex: 1,
        lineHeight: 16,
    },
    fullProgressContainer: {
        gap: theme.spacing.xs,
    },
    fullProgressBar: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    fullProgressFill: {
        height: '100%',
        borderRadius: 3,
    },
    fullProgressText: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
});