import React, {useEffect, useState} from "react";
import {I18nManager, Linking, ScrollView, StyleSheet, Switch, Text, useColorScheme, View,} from "react-native";
import {useTranslation} from "react-i18next";
import {ThemedIcon} from '@/components/ThemedIcon';
import Animated, {
    FadeInDown,
    interpolate,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import {languages} from "@/i18n/languages";
import {Config} from "@/constants/config";
import {ThemedView, Card} from "@/components/ThemedView";
import {ThemedText} from "@/components/ThemedText";
import {ThemedPressable} from "@/components/ThemedPressable";
import {ThemedSafeAreaView} from "@/components/ThemedSafeAreaView";
import {Button} from "@/components/Button";
import {useColors, useTheme, useTypography} from "@/hooks/useThemeColor";

/**
 * Enhanced Language Selection Card with responsive design and animations
 * Displays language options with flags, names, and active state indicators
 * 
 * @param {Object} props - Component props
 * @param {string} props.langKey - Language key (e.g., 'en', 'de')
 * @param {string} props.langName - Display name of the language
 * @param {boolean} props.isActive - Whether this language is currently active
 * @param {Function} props.onPress - Callback when language is selected
 * @param {number} props.index - Index for staggered animations
 * @returns {JSX.Element} Animated language selection card
 */
function LanguageCard({
                          langKey,
                          langName,
                          isActive,
                          onPress,
                          index,
                          styles
                      }: {
    langKey: string;
    langName: string;
    isActive: boolean;
    onPress: () => void;
    index: number;
    styles: any;
}) {
    const colors = useColors();
    const theme = useTheme();
    const typography = useTypography();

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
            en: '🇬🇧 english',
            de: '🇩🇪 deutsch',
            es: '🇪🇸 español',
            fr: '🇫🇷 français',
            uk: '🇺🇦 українська',
            ar: '🇸🇦 العربية',
        };
        return flags[key] || '🌐';
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 100).springify()}
            layout={Layout.springify()}
        >
            <Animated.View style={animatedStyle}>
            {/* Glow effect for active state */}
            {isActive && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFillObject,
                        {
                            backgroundColor: colors.backgroundSecondary,
                            borderRadius: theme.borderRadius.lg,
                            margin: -2,
                        },
                        glowStyle,
                    ]}
                    pointerEvents="none"
                />
            )}

            <ThemedPressable
                variant={isActive ? "primary" : "secondary"}
                onPress={handlePress}
                style={styles.languageCard}
            >
                <Card style={[styles.languageCardInner, isActive && { borderColor: colors.primary, borderWidth: 2 }]}>
                <View style={styles.languageContent}>
                    <Text style={styles.languageFlag}>
                        {getLanguageFlag(langKey)}
                    </Text>

                    <View style={styles.languageText}>
                        <ThemedText
                            variant="body"
                            style={[
                                styles.languageName,
                                {
                                    color: isActive
                                        ? colors.primary
                                        : colors.text,
                                    fontWeight: isActive ? '600' : '400',
                                }
                            ]}
                        >
                            {langName}
                        </ThemedText>

                        <ThemedText
                            variant="label"
                            color="secondary"
                            style={styles.languageCode}
                        >
                            {langKey.toUpperCase()}
                        </ThemedText>
                    </View>

                    {isActive && (
                        <View style={[
                            styles.activeIndicator,
                            { backgroundColor: colors.primary }
                        ]}>
                            <ThemedIcon
                                name="check"
                                size={16}
                                color="primary"
                            />
                        </View>
                    )}
                </View>
                </Card>
            </ThemedPressable>
            </Animated.View>
        </Animated.View>
    );
}

/**
 * Enhanced GPS Toggle Component with animations and status indicators
 * Allows users to enable/disable GPS location logging for bird sightings
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.enabled - Whether GPS logging is currently enabled
 * @param {Function} props.onToggle - Callback when GPS setting is toggled
 * @returns {JSX.Element} Animated GPS toggle card
 */
function GPSToggleCard({
                           enabled,
                           onToggle,
                           styles
                       }: {
    enabled: boolean;
    onToggle: () => void;
    styles: any;
}) {
    const colors = useColors();
    const theme = useTheme();
    const typography = useTypography();

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
            <Card elevated style={styles.gpsCard}>
                <View style={styles.gpsContent}>
                    <View style={styles.gpsInfo}>
                        <Animated.View style={[
                            styles.gpsIcon,
                            {
                                backgroundColor: enabled
                                    ? colors.backgroundSecondary
                                    : colors.backgroundTertiary
                            },
                            iconAnimatedStyle,
                        ]}>
                            <ThemedIcon
                                name="map-pin"
                                size={24}
                                color={enabled
                                    ? 'primary'
                                    : 'secondary'
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
                                            ? colors.success
                                            : colors.textTertiary
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
                                false: colors.border,
                                true: colors.primary
                            }}
                            thumbColor={
                                enabled
                                    ? colors.textInverse
                                    : colors.textSecondary
                            }
                            ios_backgroundColor={colors.border}
                        />
                    </Animated.View>
                </View>
            </Card>
        </Animated.View>
    );
}

/**
 * Modern Settings Screen with responsive design and smooth animations
 * Provides language selection, location settings, and app information
 * 
 * @returns {JSX.Element} Complete settings screen with sections
 */
export default function ModernSettingsScreen() {
    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const [gpsEnabled, setGpsEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const colorScheme = useColorScheme() ?? 'light';
    const colors = useColors();
    const theme = useTheme();
    const typography = useTypography();
    
    const styles = createStyles();

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
        <ThemedSafeAreaView style={styles.container}>
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
                    <ThemedText variant="h2" style={styles.headerTitle}>
                        Settings
                    </ThemedText>
                    <ThemedText
                        variant="body"
                        color="secondary"
                        style={styles.headerSubtitle}
                    >
                        Customize your LogChirpy experience
                    </ThemedText>
                </Animated.View>

                {/* Language Section */}
                <ThemedView style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        {t("settings.language")}
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.sectionSubtitle}>
                        Choose your preferred language for the app interface
                    </ThemedText>
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
                                    styles={styles}
                                />
                            );
                        })}
                    </View>

                    {isLoading && (
                        <View style={styles.loadingContainer}>
                            <ThemedText variant="label" color="secondary">
                                Applying language changes...
                            </ThemedText>
                        </View>
                    )}
                </ThemedView>

                {/* Location Section */}
                <ThemedView style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        {t("settings.logging") || "Location Settings"}
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.sectionSubtitle}>
                        Configure how LogChirpy handles location data
                    </ThemedText>
                    <GPSToggleCard
                        enabled={gpsEnabled}
                        onToggle={toggleGpsLogging}
                        styles={styles}
                    />
                </ThemedView>

                {/* Tutorial Section */}
                <ThemedView style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        {t("settings.tutorial.title")}
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.sectionSubtitle}>
                        {t("settings.tutorial.subtitle")}
                    </ThemedText>
                    
                    <Animated.View
                        entering={FadeInDown.delay(250).springify()}
                        layout={Layout.springify()}
                    >
                        <Card style={styles.tutorialCard}>
                            <View style={styles.tutorialContent}>
                                <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                    {t("settings.tutorial.how_to_use.title")}
                                </ThemedText>
                                <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                    {t("settings.tutorial.how_to_use.description")}
                                </ThemedText>
                                
                                <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                    {t("settings.tutorial.image_processing.title")}
                                </ThemedText>
                                <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                    {t("settings.tutorial.image_processing.description")}
                                </ThemedText>
                                
                                <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                    {t("settings.tutorial.ai_models.title")}
                                </ThemedText>
                                <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                    {t("settings.tutorial.ai_models.description")}
                                </ThemedText>
                                
                                <ThemedText variant="bodyLarge" style={styles.tutorialSectionTitle}>
                                    {t("settings.tutorial.data_privacy.title")}
                                </ThemedText>
                                <ThemedText variant="body" color="secondary" style={styles.tutorialText}>
                                    {t("settings.tutorial.data_privacy.description")}
                                </ThemedText>
                            </View>
                        </Card>
                    </Animated.View>
                </ThemedView>

                {/* About Section */}
                <ThemedView style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        {t("settings.about.title")}
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.sectionSubtitle}>
                        {t("settings.about.subtitle")}
                    </ThemedText>
                    
                    <Animated.View
                        entering={FadeInDown.delay(300).springify()}
                        layout={Layout.springify()}
                    >
                        <Card style={styles.aboutCard}>
                            <View style={styles.aboutContent}>
                                <View style={[
                                    styles.aboutIcon,
                                    { backgroundColor: colors.backgroundSecondary }
                                ]}>
                                    <ThemedIcon
                                        name="feather"
                                        size={32}
                                        color="primary"
                                    />
                                </View>
                                
                                <View style={styles.aboutText}>
                                    <ThemedText variant="h3" style={styles.appTitle}>
                                        LogChirpy
                                    </ThemedText>
                                    <ThemedText variant="body" color="secondary" style={styles.appDescription}>
                                        {t("settings.about.app_description")}
                                    </ThemedText>
                                </View>
                            </View>
                            
                            <View style={styles.creatorsSection}>
                                <ThemedText variant="bodyLarge" style={styles.creatorsTitle}>
                                    {t("settings.about.created_by")}
                                </ThemedText>
                                
                                <ThemedPressable
                                    variant="ghost"
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        Linking.openURL('https://github.com/mklemmingen');
                                    }}
                                    style={styles.creatorCard}
                                >
                                    <View style={styles.creatorContent}>
                                        <ThemedIcon name="github" size={20} color="primary" />
                                        <ThemedText variant="body" style={styles.creatorName}>
                                            Marty "mklemmingen" Lauterbach
                                        </ThemedText>
                                    </View>
                                </ThemedPressable>
                                
                                <ThemedPressable
                                    variant="ghost"
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        Linking.openURL('https://github.com/luisluis8414');
                                    }}
                                    style={styles.creatorCard}
                                >
                                    <View style={styles.creatorContent}>
                                        <ThemedIcon name="github" size={20} color="primary" />
                                        <ThemedText variant="body" style={styles.creatorName}>
                                            Luis Wehrberger
                                        </ThemedText>
                                    </View>
                                </ThemedPressable>
                            </View>
                        </Card>
                    </Animated.View>
                </ThemedView>
            </ScrollView>
        </ThemedSafeAreaView>
    );
}

const createStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 32,
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

    // Sections
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        marginBottom: 8,
        fontWeight: '600',
    },
    sectionSubtitle: {
        marginBottom: 16,
        lineHeight: 20,
    },
    
    // Language Section
    languageGrid: {
        gap: 8,
    },
    languageCard: {
        borderRadius: 8,
    },
    languageCardInner: {
        minHeight: 56,
        padding: 0,
    },
    languageContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
    },
    languageFlag: {
        fontSize: 20,
        lineHeight: 24,
    },
    languageText: {
        flex: 1,
        gap: 0,
    },
    languageName: {
        fontSize: 15,
        lineHeight: 20,
    },
    languageCode: {
        opacity: 0.7,
        fontSize: 11,
        lineHeight: 14,
    },
    activeIndicator: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
        paddingTop: 16,
    },

    // GPS Section
    gpsCard: {
        minHeight: 84,
        padding: 0,
    },
    gpsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
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
        gap: 5,
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
        gap: 5,
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
        padding: 16,
        gap: 16,
    },
    infoIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
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

    // Tutorial Section
    tutorialCard: {
        padding: 0,
    },
    tutorialContent: {
        padding: 20,
        gap: 16,
    },
    tutorialSectionTitle: {
        fontWeight: '600',
        marginTop: 8,
    },
    tutorialText: {
        lineHeight: 20,
    },

    // About Section
    aboutCard: {
        padding: 0,
    },
    aboutContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    aboutIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    aboutText: {
        flex: 1,
        gap: 5,
    },
    appTitle: {
        fontWeight: 'bold',
    },
    appDescription: {
        lineHeight: 20,
    },
    creatorsSection: {
        padding: 20,
        paddingTop: 0,
        gap: 8,
    },
    creatorsTitle: {
        fontWeight: '600',
        marginBottom: 8,
    },
    creatorCard: {
        borderRadius: 6,
        padding: 12,
    },
    creatorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    creatorName: {
        fontWeight: '500',
    },
});