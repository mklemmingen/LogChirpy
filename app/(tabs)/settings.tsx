import React, { useEffect, useState } from "react";
import {
    I18nManager,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    SafeAreaView,
    View,
    useColorScheme,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    interpolate,
    FadeInDown,
    Layout,
} from 'react-native-reanimated';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { languages } from "@/i18n/languages";
import { Config } from "@/constants/config";
import { ThemedPressable } from "@/components/ThemedPressable";
import { ModernCard } from "@/components/ModernCard";
import SettingsSection from "@/components/SettingsSection";
import { ThemedText } from "@/components/ThemedText";
import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
    useMotionValues
} from "@/hooks/useThemeColor";

// Enhanced Language Selection Card
function LanguageCard({
                          langKey,
                          langName,
                          isActive,
                          onPress,
                          index
                      }: {
    langKey: string;
    langName: string;
    isActive: boolean;
    onPress: () => void;
    index: number;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();

    const scale = useSharedValue(1);
    const glowOpacity = useSharedValue(0);

    const handlePress = () => {
        Haptics.selectionAsync();

        // Micro-animation
        scale.value = withSpring(0.98, { damping: 15, stiffness: 300 }, () => {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        });

        if (isActive) {
            glowOpacity.value = withTiming(1, { duration: 200 }, () => {
                glowOpacity.value = withTiming(0, { duration: 300 });
            });
        }

        onPress();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value * 0.3,
        transform: [{ scale: interpolate(glowOpacity.value, [0, 1], [0.95, 1.05]) }],
    }));

    // Language flag emoji mapping
    const getLanguageFlag = (key: string) => {
        const flags: Record<string, string> = {
            en: '🇺🇸',
            de: '🇩🇪',
            es: '🇪🇸',
            uk: '🇺🇦',
            ar: '🇸🇦'
        };
        return flags[key] || '🌐';
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 100).springify()}
            layout={Layout.springify()}
            style={animatedStyle}
        >
            {/* Glow effect for active state */}
            {isActive && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFillObject,
                        {
                            backgroundColor: variants.primarySubtle,
                            borderRadius: theme.borderRadius.lg,
                            margin: -2,
                        },
                        glowStyle,
                    ]}
                    pointerEvents="none"
                />
            )}

            <ModernCard
                variant={isActive ? "primary" : "outlined"}
                onPress={handlePress}
                animateOnPress
                glowOnHover={isActive}
                style={[
                    styles.languageCard,
                    isActive ? {
                        borderColor: semanticColors.primary,
                        borderWidth: 2,
                    } : {}
                ]}
            >
                <View style={styles.languageContent}>
                    <Text style={styles.languageFlag}>
                        {getLanguageFlag(langKey)}
                    </Text>

                    <View style={styles.languageText}>
                        <ThemedText
                            variant="bodyLarge"
                            style={[
                                styles.languageName,
                                {
                                    color: isActive
                                        ? semanticColors.primary
                                        : semanticColors.text,
                                    fontWeight: isActive ? '600' : '400',
                                }
                            ]}
                        >
                            {langName}
                        </ThemedText>

                        <ThemedText
                            variant="labelMedium"
                            color="secondary"
                            style={styles.languageCode}
                        >
                            {langKey.toUpperCase()}
                        </ThemedText>
                    </View>

                    {isActive && (
                        <View style={[
                            styles.activeIndicator,
                            { backgroundColor: semanticColors.primary }
                        ]}>
                            <Feather
                                name="check"
                                size={16}
                                color={semanticColors.onPrimary}
                            />
                        </View>
                    )}
                </View>
            </ModernCard>
        </Animated.View>
    );
}

// Enhanced GPS Toggle Component
function GPSToggleCard({
                           enabled,
                           onToggle
                       }: {
    enabled: boolean;
    onToggle: () => void;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();

    const iconScale = useSharedValue(1);
    const switchScale = useSharedValue(1);

    const handleToggle = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Icon animation
        iconScale.value = withSpring(1.2, { damping: 15, stiffness: 300 }, () => {
            iconScale.value = withSpring(1, { damping: 15, stiffness: 300 });
        });

        // Switch animation
        switchScale.value = withSpring(0.95, { damping: 15, stiffness: 300 }, () => {
            switchScale.value = withSpring(1, { damping: 15, stiffness: 300 });
        });

        onToggle();
    };

    const iconAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconScale.value }],
    }));

    const switchAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: switchScale.value }],
    }));

    return (
        <Animated.View
            entering={FadeInDown.delay(200).springify()}
            layout={Layout.springify()}
        >
            <ModernCard
                variant="elevated"
                style={[
                    styles.gpsCard,
                    enabled ? {
                        borderColor: variants.primaryMuted,
                        borderWidth: 1,
                    } : {}
                ]}
            >
                <View style={styles.gpsContent}>
                    <View style={styles.gpsInfo}>
                        <Animated.View style={[
                            styles.gpsIcon,
                            {
                                backgroundColor: enabled
                                    ? variants.primarySubtle
                                    : variants.surfaceHover
                            },
                            iconAnimatedStyle,
                        ]}>
                            <Feather
                                name="map-pin"
                                size={24}
                                color={enabled
                                    ? semanticColors.primary
                                    : semanticColors.textSecondary
                                }
                            />
                        </Animated.View>

                        <View style={styles.gpsTextContent}>
                            <ThemedText
                                variant="bodyLarge"
                                style={styles.gpsTitle}
                            >
                                GPS Location Logging
                            </ThemedText>

                            <ThemedText
                                variant="bodySmall"
                                color="secondary"
                                style={styles.gpsDescription}
                            >
                                Record precise coordinates with your bird sightings for mapping and analysis
                            </ThemedText>

                            <View style={styles.gpsStatus}>
                                <View style={[
                                    styles.statusDot,
                                    {
                                        backgroundColor: enabled
                                            ? semanticColors.success
                                            : semanticColors.textTertiary
                                    }
                                ]} />
                                <ThemedText
                                    variant="labelSmall"
                                    color={enabled ? "success" : "tertiary"}
                                    style={styles.statusText}
                                >
                                    {enabled ? "Active" : "Disabled"}
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    <Animated.View style={switchAnimatedStyle}>
                        <Switch
                            value={enabled}
                            onValueChange={handleToggle}
                            trackColor={{
                                false: semanticColors.border,
                                true: semanticColors.primary
                            }}
                            thumbColor={
                                enabled
                                    ? semanticColors.onPrimary
                                    : semanticColors.textSecondary
                            }
                            ios_backgroundColor={semanticColors.border}
                        />
                    </Animated.View>
                </View>
            </ModernCard>
        </Animated.View>
    );
}

export default function ModernSettingsScreen() {
    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const [gpsEnabled, setGpsEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const colorScheme = useColorScheme() ?? 'light';
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const storedGps = await AsyncStorage.getItem('gps-logging');
                if (storedGps !== null) {
                    const enabled = storedGps === 'true';
                    setGpsEnabled(enabled);
                    Config.gpsLoggingEnabled = enabled;
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        };
        loadSettings();
    }, []);

    const changeLanguage = async (lang: string) => {
        if (isLoading) return;

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await AsyncStorage.setItem('appLanguage', lang);

            if (lang === "ar") {
                if (!I18nManager.isRTL) {
                    await I18nManager.forceRTL(true);
                    await i18n.changeLanguage(lang);
                    setCurrentLanguage(lang);
                    await Updates.reloadAsync();
                    return;
                } else {
                    await i18n.changeLanguage(lang);
                    setCurrentLanguage(lang);
                }
            } else {
                if (I18nManager.isRTL) {
                    await I18nManager.forceRTL(false);
                    await i18n.changeLanguage(lang);
                    setCurrentLanguage(lang);
                    await Updates.reloadAsync();
                    return;
                } else {
                    await i18n.changeLanguage(lang);
                    setCurrentLanguage(lang);
                }
            }
        } catch (error) {
            console.error('Failed to change language:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleGpsLogging = async () => {
        const newValue = !gpsEnabled;
        setGpsEnabled(newValue);
        Config.gpsLoggingEnabled = newValue;

        try {
            await AsyncStorage.setItem('gps-logging', newValue.toString());
        } catch (error) {
            console.error('Failed to save GPS setting:', error);
        }
    };

    return (
        <SafeAreaView style={[
            styles.container,
            { backgroundColor: semanticColors.background }
        ]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View
                    entering={FadeInDown.springify()}
                    style={styles.header}
                >
                    <ThemedText variant="displaySmall" style={styles.headerTitle}>
                        Settings
                    </ThemedText>
                    <ThemedText
                        variant="bodyLarge"
                        color="secondary"
                        style={styles.headerSubtitle}
                    >
                        Customize your LogChirpy experience
                    </ThemedText>
                </Animated.View>

                {/* Language Section */}
                <SettingsSection
                    title={t("settings.language")}
                    subtitle="Choose your preferred language for the app interface"
                    variant="glass"
                    animated
                    delay={1}
                >
                    <View style={styles.languageGrid}>
                        {Object.entries(languages).map(([langKey, langName], index) => {
                            const isActive = currentLanguage.startsWith(langKey);
                            return (
                                <LanguageCard
                                    key={langKey}
                                    langKey={langKey}
                                    langName={langName}
                                    isActive={isActive}
                                    onPress={() => changeLanguage(langKey)}
                                    index={index}
                                />
                            );
                        })}
                    </View>

                    {isLoading && (
                        <View style={styles.loadingContainer}>
                            <ThemedText variant="labelMedium" color="secondary">
                                Applying language changes...
                            </ThemedText>
                        </View>
                    )}
                </SettingsSection>

                {/* Location Section */}
                <SettingsSection
                    title={t("settings.logging") || "Location Settings"}
                    subtitle="Configure how LogChirpy handles location data"
                    variant="glass"
                    animated
                    delay={2}
                >
                    <GPSToggleCard
                        enabled={gpsEnabled}
                        onToggle={toggleGpsLogging}
                    />
                </SettingsSection>

                {/* App Info Section */}
                <Animated.View
                    entering={FadeInDown.delay(300).springify()}
                    layout={Layout.springify()}
                >
                    <ModernCard
                        variant="outlined"
                        style={styles.infoCard}
                    >
                        <View style={styles.infoContent}>
                            <View style={[
                                styles.infoIcon,
                                { backgroundColor: variants.accentSubtle }
                            ]}>
                                <Feather
                                    name="feather"
                                    size={20}
                                    color={semanticColors.accent}
                                />
                            </View>

                            <View style={styles.infoText}>
                                <ThemedText variant="bodyMedium" style={styles.appName}>
                                    LogChirpy
                                </ThemedText>
                                <ThemedText variant="labelMedium" color="secondary">
                                    Your Digital Birding Companion
                                </ThemedText>
                            </View>
                        </View>
                    </ModernCard>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },

    // Header
    header: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    headerTitle: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    headerSubtitle: {
        textAlign: 'center',
        maxWidth: 280,
    },

    // Language Section
    languageGrid: {
        gap: 12,
    },
    languageCard: {
        minHeight: 72,
    },
    languageContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 16,
    },
    languageFlag: {
        fontSize: 24,
        lineHeight: 28,
    },
    languageText: {
        flex: 1,
        gap: 2,
    },
    languageName: {
        // Dynamic styles applied via component
    },
    languageCode: {
        opacity: 0.8,
    },
    activeIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
        paddingTop: 16,
    },

    // GPS Section
    gpsCard: {
        minHeight: 120,
    },
    gpsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    gpsInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
    },
    gpsIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gpsTextContent: {
        flex: 1,
        gap: 6,
    },
    gpsTitle: {
        fontWeight: '600',
    },
    gpsDescription: {
        lineHeight: 18,
    },
    gpsStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        textTransform: 'uppercase',
        fontWeight: '600',
    },

    // Info Card
    infoCard: {
        marginTop: 8,
    },
    infoContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    infoIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoText: {
        flex: 1,
        gap: 2,
    },
    appName: {
        fontWeight: '600',
    },
});