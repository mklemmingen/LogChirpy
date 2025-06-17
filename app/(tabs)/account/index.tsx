import React, { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, } from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedIcon } from '@/components/ThemedIcon';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, } from 'react-native-reanimated';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';

import { ModernCard } from '@/components/ModernCard';
import { useTheme, useTypography, useSemanticColors, useColorVariants } from '@/hooks/useThemeColor';
import { useAuth } from '@/contexts/AuthContext';
import { Feather } from '@expo/vector-icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Account screen component
 * Provides user account management, sync settings, and sign-out functionality
 * 
 * @returns {JSX.Element} Complete account screen with profile and actions
 */
export default function Account() {
    return <Redirect href="/(tabs)/account/profile" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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