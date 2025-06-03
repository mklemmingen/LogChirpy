// components/DatabaseLoadingSplash.tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    useColorScheme,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '@/constants/theme';
import BirdAnimation from '@/components/BirdAnimation';
import {initBirdDexDB, isDbReady, type ProgressData} from '@/services/databaseBirDex';

const { width: screenWidth } = Dimensions.get('window');

interface DatabaseLoadingSplashProps {
    onComplete: () => void;
    onError: (error: string) => void;
}

export default function DatabaseLoadingSplash({ onComplete, onError }: DatabaseLoadingSplashProps) {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];

    const [progress, setProgress] = useState<ProgressData>({
        loaded: 0,
        total: 100,
        phase: 'parsing',
        message: 'Preparing database...',
    });

    useEffect(() => {
        let isMounted = true;

        // Check if already initialized
        if (isDbReady()) {
            onComplete();
            return;
        }

        const initializeDatabase = async () => {
            try {
                await initBirdDexDB((progressData: ProgressData) => {
                    if (!isMounted) return;
                    setProgress(progressData);

                    if (progressData.phase === 'complete') {
                        setTimeout(() => {
                            if (isMounted) {
                                onComplete();
                            }
                        }, 500); // Reduced delay
                    }
                });
            } catch (err) {
                if (isMounted) {
                    onError(err instanceof Error ? err.message : 'Database initialization failed');
                }
            }
        };

        initializeDatabase();

        return () => {
            isMounted = false;
        };
    }, [onComplete, onError]);

    const percentComplete = Math.round((progress.loaded / progress.total) * 100);

    const getPhaseText = (phase: string): string => {
        switch (phase) {
            case 'parsing': return t('splash.parsing', 'Parsing bird database...');
            case 'inserting': return t('splash.inserting', 'Loading bird species...');
            case 'indexing': return t('splash.indexing', 'Optimizing search...');
            case 'complete': return t('splash.complete', 'Ready!');
            default: return phase;
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: pal.colors.background }]}>
            {/* Background Animation */}
            <BirdAnimation numberOfBirds={3} />

            {/* Logo */}
            <View style={styles.logoContainer}>
                <Image
                    source={require('@/assets/images/logo_no_bg.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>

            {/* Loading Content */}
            <View style={styles.loadingContent}>
                <Text style={[styles.mainTitle, { color: pal.colors.text.primary }]}>
                    {t('splash.title', 'LogChirpy')}
                </Text>

                <Text style={[styles.subtitle, { color: pal.colors.text.secondary }]}>
                    {t('splash.subtitle', 'Loading Database of all Bird Species...')}
                </Text>

                <Text style={[styles.subtitle2, { color: pal.colors.text.secondary }]}>
                    {t('splash.subtitle2', 'Initialising intelligent detection tool...')}
                </Text>

                {/* Progress Section */}
                <View style={styles.progressSection}>
                    <ActivityIndicator
                        size="large"
                        color={pal.colors.primary}
                        style={styles.spinner}
                    />

                    <Text style={[styles.phaseText, { color: pal.colors.text.primary }]}>
                        {getPhaseText(progress.phase)}
                    </Text>

                    {progress.message && (
                        <Text style={[styles.messageText, { color: pal.colors.text.secondary }]}>
                            {progress.message}
                        </Text>
                    )}

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <Text style={[styles.progressText, { color: pal.colors.text.primary }]}>
                            {percentComplete}%
                        </Text>

                        <View style={[styles.progressBarContainer, { backgroundColor: pal.colors.border }]}>
                            <View
                                style={[
                                    styles.progressBar,
                                    {
                                        backgroundColor: pal.colors.primary,
                                        width: `${percentComplete}%`
                                    }
                                ]}
                            />
                        </View>
                    </View>

                    {/* Table Progress */}
                    {progress.tables && Object.entries(progress.tables).length > 0 && (
                        <View style={styles.tablesContainer}>
                            {Object.entries(progress.tables).map(([tableName, tableProgress]) => {
                                const tablePercent = Math.round((tableProgress.loaded / tableProgress.total) * 100);
                                return (
                                    <View key={tableName} style={styles.tableProgressItem}>
                                        <Text style={[styles.tableName, { color: pal.colors.text.secondary }]}>
                                            {tableProgress.loaded.toLocaleString()} / {tableProgress.total.toLocaleString()} species
                                        </Text>
                                        <View style={[styles.tableProgressBarContainer, { backgroundColor: pal.colors.border }]}>
                                            <View
                                                style={[
                                                    styles.tableProgressBar,
                                                    {
                                                        backgroundColor: pal.colors.accent,
                                                        width: `${tablePercent}%`
                                                    }
                                                ]}
                                            />
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: theme.spacing.xxl,
    },
    logo: {
        width: 120,
        height: 120,
    },
    loadingContent: {
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        maxWidth: screenWidth * 0.9,
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: theme.spacing.md,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: theme.spacing.sm,
        lineHeight: 24,
    },
    subtitle2: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: theme.spacing.xxl,
        lineHeight: 22,
        fontStyle: 'italic',
    },
    progressSection: {
        alignItems: 'center',
        width: '100%',
        gap: theme.spacing.md,
    },
    spinner: {
        marginBottom: theme.spacing.sm,
    },
    phaseText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    messageText: {
        fontSize: 14,
        textAlign: 'center',
        maxWidth: '90%',
    },
    progressContainer: {
        width: '100%',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    progressText: {
        fontSize: 18,
        fontWeight: '600',
    },
    progressBarContainer: {
        width: '100%',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    tablesContainer: {
        width: '100%',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.md,
    },
    tableProgressItem: {
        gap: theme.spacing.xs,
    },
    tableName: {
        fontSize: 12,
        textAlign: 'center',
    },
    tableProgressBarContainer: {
        width: '100%',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    tableProgressBar: {
        height: '100%',
        borderRadius: 2,
    },
});