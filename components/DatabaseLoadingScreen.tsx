import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
} from 'react-native';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ModernCard } from '@/components/ModernCard';
import { ThemedPressable } from '@/components/ThemedPressable';

// Simple static bird component (no animations to avoid reanimated)
function StaticBird({ index = 0 }: { index?: number }) {
    return (
        <View 
            style={[
                styles.floatingBird, 
                { 
                    left: 20 + (index * 60),
                    top: 100 + (index * 20),
                }
            ]}
        >
            <ThemedIcon 
                name="zap" 
                size={20} 
                color="primary" 
                style={{ opacity: 0.7 }}
            />
        </View>
    );
}

// Simple progress indicator
function SimpleProgressBar({ progress }: { progress: number }) {
    return (
        <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
                <View 
                    style={[
                        styles.progressBar, 
                        { 
                            width: `${Math.min(progress * 100, 100)}%`,
                            backgroundColor: '#007AFF'
                        }
                    ]} 
                />
            </View>
            <Text style={[styles.progressText, { color: '#666' }]}>
                {Math.round(progress * 100)}%
            </Text>
        </View>
    );
}

interface DatabaseLoadingScreenProps {
    isVisible: boolean;
    loadingProgress: number;
    loadingStatus: string;
    onRetry?: () => void;
    onCancel?: () => void;
}

export function DatabaseLoadingScreen({
    isVisible,
    loadingProgress,
    loadingStatus,
    onRetry,
    onCancel,
}: DatabaseLoadingScreenProps) {
    if (!isVisible) return null;

    return (
        <SafeAreaView style={styles.container}>
            {/* Simple background decoration */}
            <View style={styles.backgroundDecoration}>
                {[0, 1, 2].map((index) => (
                    <StaticBird key={index} index={index} />
                ))}
            </View>

            {/* Main content */}
            <View style={styles.contentContainer}>
                <ModernCard style={styles.loadingCard}>
                    {/* App Logo/Icon */}
                    <View style={styles.logoContainer}>
                        <View style={[styles.logoCircle, { backgroundColor: '#007AFF' }]}>
                            <ThemedIcon name="database" size={48} color="secondary" />
                        </View>
                    </View>

                    {/* Loading Text */}
                    <Text style={[styles.title, { color: '#000' }]}>
                        Loading Bird Database
                    </Text>
                    
                    <Text style={[styles.subtitle, { color: '#666' }]}>
                        Preparing your birding experience
                    </Text>

                    {/* Progress */}
                    <SimpleProgressBar progress={loadingProgress} />

                    {/* Status */}
                    <View style={styles.statusContainer}>
                        <ActivityIndicator 
                            size="small" 
                            color="#007AFF"
                            style={styles.spinner}
                        />
                        <Text style={[styles.statusText, { color: '#666' }]}>
                            {loadingStatus}
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionContainer}>
                        {onRetry && (
                            <ThemedPressable
                                style={[styles.button, styles.retryButton]}
                                onPress={onRetry}
                            >
                                <Text style={[styles.buttonText, { color: '#007AFF' }]}>
                                    Retry
                                </Text>
                            </ThemedPressable>
                        )}
                        
                        {onCancel && (
                            <ThemedPressable
                                style={[styles.button, styles.cancelButton]}
                                onPress={onCancel}
                            >
                                <Text style={[styles.buttonText, { color: '#666' }]}>
                                    Cancel
                                </Text>
                            </ThemedPressable>
                        )}
                    </View>
                </ModernCard>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    backgroundDecoration: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    floatingBird: {
        position: 'absolute',
    },
    contentContainer: {
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    loadingCard: {
        width: '100%',
        padding: 32,
        alignItems: 'center',
    },
    logoContainer: {
        marginBottom: 24,
    },
    logoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 32,
        textAlign: 'center',
    },
    progressContainer: {
        width: '100%',
        marginBottom: 24,
        alignItems: 'center',
    },
    progressTrack: {
        width: '100%',
        height: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    spinner: {
        marginRight: 8,
    },
    statusText: {
        fontSize: 14,
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    },
    retryButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    cancelButton: {
        backgroundColor: 'transparent',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default DatabaseLoadingScreen;