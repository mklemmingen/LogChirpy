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
import Slider from '@react-native-community/slider';

import {languages} from "@/i18n/languages";
import {Config} from "@/constants/config";
import {ThemedView, Card} from "@/components/ThemedView";
import {ThemedText} from "@/components/ThemedText";
import {ThemedPressable} from "@/components/ThemedPressable";
import {ThemedSafeAreaView} from "@/components/ThemedSafeAreaView";
import {Button} from "@/components/Button";
import {useColors, useTheme, useTypography} from "@/hooks/useThemeColor";
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

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
    const colors = useUnifiedColors();
    const theme = useTheme();
    const typography = useTypography();
    const dimensions = useResponsiveDimensions();

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
                            backgroundColor: colors.background.secondary,
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
                <Card style={[styles.languageCardInner, isActive && { borderColor: colors.interactive.primary, borderWidth: 2 }]}>
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
                                        ? colors.interactive.primary
                                        : colors.text.primary,
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
                            { backgroundColor: colors.interactive.primary }
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
    const colors = useUnifiedColors();
    const theme = useTheme();
    const typography = useTypography();
    const dimensions = useResponsiveDimensions();

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
                                    ? colors.background.secondary
                                    : colors.background.tertiary
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
                                            ? colors.status.success
                                            : colors.text.tertiary
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
                                false: colors.border.primary,
                                true: colors.interactive.primary
                            }}
                            thumbColor={
                                enabled
                                    ? colors.interactive.primaryText
                                    : colors.text.secondary
                            }
                            ios_backgroundColor={colors.border.primary}
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
// Helper functions for object detection presets
const getDelayPresetLabel = (value: number): string => {
    if (value <= 0.25) return 'Fast (0.2s)';
    if (value <= 0.6) return 'Balanced (0.5s)';
    return 'Thorough (1s)';
};

const getConfidencePresetLabel = (value: number): string => {
    if (value < 0.4) return 'Lenient (< 40%)';
    if (value < 0.75) return 'Normal (40-75%)';
    return 'Strict (>= 75%)';
};

export default function ModernSettingsScreen() {
    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const [gpsEnabled, setGpsEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [objectDetectionSettings, setObjectDetectionSettings] = useState({
        pipelineDelay: 1,
        confidenceThreshold: 0.8,
        showSettings: false,
    });

    const colorScheme = useColorScheme() ?? 'light';
    const colors = useUnifiedColors();
    const theme = useTheme();
    const typography = useTypography();
    const dimensions = useResponsiveDimensions();
    
    const styles = createStyles(dimensions);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Load GPS settings
                const storedGps = await AsyncStorage.getItem('gps-logging');
                if (storedGps !== null) {
                    const enabled = storedGps === 'true';
                    setGpsEnabled(enabled);
                    Config.gpsLoggingEnabled = enabled;
                }

                // Load object detection settings
                const [pipelineDelay, confidenceThreshold, showSettings] = await Promise.all([
                    AsyncStorage.getItem('pipelineDelay'),
                    AsyncStorage.getItem('confidenceThreshold'),
                    AsyncStorage.getItem('showSettings'),
                ]);

                setObjectDetectionSettings({
                    pipelineDelay: pipelineDelay ? parseFloat(pipelineDelay) : 1,
                    confidenceThreshold: confidenceThreshold ? parseFloat(confidenceThreshold) : 0.8,
                    showSettings: showSettings === 'true',
                });
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

    const updateObjectDetectionSetting = async (key: keyof typeof objectDetectionSettings, value: number | boolean) => {
        const newSettings = {
            ...objectDetectionSettings,
            [key]: value,
        };
        setObjectDetectionSettings(newSettings);

        try {
            await AsyncStorage.setItem(key, value.toString());
            // Haptic feedback for changes
            if (key === 'showSettings') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else {
                Haptics.selectionAsync();
            }
        } catch (error) {
            console.error(`Failed to save ${key} setting:`, error);
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

                {/* Object Detection Camera Section */}
                <ThemedView style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        {t("settings.object_detection") || "Object Detection Camera"}
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.sectionSubtitle}>
                        Configure automatic bird detection and classification settings
                    </ThemedText>
                    
                    <Animated.View
                        entering={FadeInDown.delay(250).springify()}
                        layout={Layout.springify()}
                    >
                        <Card elevated style={styles.detectionCard}>
                            <View style={styles.detectionContent}>
                                {/* Pipeline Delay Setting */}
                                <View style={styles.detectionSetting}>
                                    <View style={styles.detectionInfo}>
                                        <ThemedText variant="bodyLarge" style={styles.detectionTitle}>
                                            {t("camera.pipeline_delay_label")}
                                        </ThemedText>
                                        <ThemedText variant="bodySmall" color="secondary">
                                            {t("camera.pipeline_delay_description")}
                                        </ThemedText>
                                    </View>
                                    <View style={styles.sliderContainer}>
                                        <Slider
                                            value={objectDetectionSettings.pipelineDelay}
                                            onValueChange={(value) => updateObjectDetectionSetting('pipelineDelay', value)}
                                            minimumValue={0.01}
                                            maximumValue={1}
                                            step={0.01}
                                            minimumTrackTintColor={colors.interactive.primary}
                                            maximumTrackTintColor={colors.border.primary}
                                            thumbTintColor={colors.interactive.primary}
                                            style={styles.slider}
                                        />
                                        <ThemedText variant="label" style={styles.sliderValue}>
                                            {objectDetectionSettings.pipelineDelay.toFixed(2)}s
                                        </ThemedText>
                                    </View>
                                    <ThemedText variant="labelSmall" color="tertiary" style={styles.presetLabel}>
                                        {getDelayPresetLabel(objectDetectionSettings.pipelineDelay)}
                                    </ThemedText>
                                </View>

                                <View style={styles.divider} />

                                {/* Confidence Threshold Setting */}
                                <View style={styles.detectionSetting}>
                                    <View style={styles.detectionInfo}>
                                        <ThemedText variant="bodyLarge" style={styles.detectionTitle}>
                                            {t("camera.confidence_threshold_label")}
                                        </ThemedText>
                                        <ThemedText variant="bodySmall" color="secondary">
                                            {t("camera.confidence_threshold_description")}
                                        </ThemedText>
                                    </View>
                                    <View style={styles.sliderContainer}>
                                        <Slider
                                            value={objectDetectionSettings.confidenceThreshold}
                                            onValueChange={(value) => updateObjectDetectionSetting('confidenceThreshold', value)}
                                            minimumValue={0}
                                            maximumValue={1}
                                            step={0.01}
                                            minimumTrackTintColor={colors.interactive.primary}
                                            maximumTrackTintColor={colors.border.primary}
                                            thumbTintColor={colors.interactive.primary}
                                            style={styles.slider}
                                        />
                                        <ThemedText variant="label" style={styles.sliderValue}>
                                            {Math.round(objectDetectionSettings.confidenceThreshold * 100)}%
                                        </ThemedText>
                                    </View>
                                    <ThemedText variant="labelSmall" color="tertiary" style={styles.presetLabel}>
                                        {getConfidencePresetLabel(objectDetectionSettings.confidenceThreshold)}
                                    </ThemedText>
                                </View>

                                <View style={styles.divider} />

                                {/* Show Settings Toggle */}
                                <View style={styles.detectionToggle}>
                                    <View style={styles.detectionInfo}>
                                        <ThemedText variant="bodyLarge" style={styles.detectionTitle}>
                                            Show Settings in Camera
                                        </ThemedText>
                                        <ThemedText variant="bodySmall" color="secondary">
                                            Display settings overlay in object detection camera view
                                        </ThemedText>
                                    </View>
                                    <Switch
                                        value={objectDetectionSettings.showSettings}
                                        onValueChange={(value) => updateObjectDetectionSetting('showSettings', value)}
                                        trackColor={{
                                            false: colors.border.primary,
                                            true: colors.interactive.primary
                                        }}
                                        thumbColor={
                                            objectDetectionSettings.showSettings
                                                ? colors.interactive.primaryText
                                                : colors.text.secondary
                                        }
                                        ios_backgroundColor={colors.border.primary}
                                    />
                                </View>
                            </View>
                        </Card>
                    </Animated.View>
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
                                    { backgroundColor: colors.background.secondary }
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

const createStyles = (dimensions: ReturnType<typeof useResponsiveDimensions>) => StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: dimensions.layout.screenPadding.vertical * 2,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: dimensions.layout.screenPadding.horizontal,
        paddingBottom: dimensions.layout.sectionSpacing,
    },

    // Header
    header: {
        paddingVertical: dimensions.layout.componentSpacing * 1.5,
        alignItems: 'center',
    },
    headerTitle: {
        fontWeight: 'bold',
        marginBottom: dimensions.layout.componentSpacing / 2,
    },
    headerSubtitle: {
        textAlign: 'center',
        maxWidth: dimensions.screen.width * 0.8,
    },

    // Sections
    section: {
        marginBottom: dimensions.layout.sectionSpacing,
    },
    sectionTitle: {
        marginBottom: dimensions.layout.componentSpacing / 2,
        fontWeight: '600',
    },
    sectionSubtitle: {
        marginBottom: dimensions.layout.componentSpacing,
        lineHeight: dimensions.screen.isSmall ? 18 : 20,
    },
    
    // Language Section
    languageGrid: {
        gap: dimensions.layout.componentSpacing / 2,
    },
    languageCard: {
        borderRadius: dimensions.card.borderRadius.md,
    },
    languageCardInner: {
        minHeight: dimensions.listItem.minHeight * 0.8,
        padding: 0,
    },
    languageContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: dimensions.card.padding.sm,
        gap: dimensions.layout.componentSpacing * 0.75,
    },
    languageFlag: {
        fontSize: dimensions.icon.md,
        lineHeight: dimensions.icon.md + 4,
    },
    languageText: {
        flex: 1,
        gap: 0,
    },
    languageName: {
        fontSize: Math.max(15 * dimensions.multipliers.font, 14),
        lineHeight: Math.max(20 * dimensions.multipliers.font, 18),
    },
    languageCode: {
        opacity: 0.7,
        fontSize: Math.max(11 * dimensions.multipliers.font, 10),
        lineHeight: Math.max(14 * dimensions.multipliers.font, 12),
    },
    activeIndicator: {
        width: dimensions.icon.lg + 4,
        height: dimensions.icon.lg + 4,
        borderRadius: (dimensions.icon.lg + 4) / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
        paddingTop: dimensions.layout.componentSpacing,
    },

    // GPS Section
    gpsCard: {
        minHeight: dimensions.listItem.minHeight * 1.5,
        padding: 0,
    },
    gpsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: dimensions.card.padding.md,
        gap: dimensions.layout.componentSpacing,
    },
    gpsInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: dimensions.layout.componentSpacing,
    },
    gpsIcon: {
        width: dimensions.icon.xxl,
        height: dimensions.icon.xxl,
        borderRadius: dimensions.icon.xxl / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gpsTextContent: {
        flex: 1,
        gap: dimensions.layout.componentSpacing / 3,
    },
    gpsTitle: {
        fontWeight: '600',
    },
    gpsDescription: {
        lineHeight: dimensions.screen.isSmall ? 16 : 18,
    },
    gpsStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: dimensions.layout.componentSpacing / 3,
        marginTop: dimensions.layout.componentSpacing / 4,
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
        marginTop: dimensions.layout.componentSpacing / 2,
    },
    infoContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: dimensions.card.padding.md,
        gap: dimensions.layout.componentSpacing,
    },
    infoIcon: {
        width: dimensions.icon.xl + 4,
        height: dimensions.icon.xl + 4,
        borderRadius: (dimensions.icon.xl + 4) / 2,
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
        padding: dimensions.card.padding.lg,
        gap: dimensions.layout.componentSpacing,
    },
    tutorialSectionTitle: {
        fontWeight: '600',
        marginTop: dimensions.layout.componentSpacing / 2,
    },
    tutorialText: {
        lineHeight: dimensions.screen.isSmall ? 18 : 20,
    },

    // About Section
    aboutCard: {
        padding: 0,
    },
    aboutContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: dimensions.card.padding.lg,
        gap: dimensions.layout.componentSpacing,
    },
    aboutIcon: {
        width: dimensions.icon.xxl * 1.5,
        height: dimensions.icon.xxl * 1.5,
        borderRadius: (dimensions.icon.xxl * 1.5) / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    aboutText: {
        flex: 1,
        gap: dimensions.layout.componentSpacing / 3,
    },
    appTitle: {
        fontWeight: 'bold',
    },
    appDescription: {
        lineHeight: dimensions.screen.isSmall ? 18 : 20,
    },
    creatorsSection: {
        padding: dimensions.card.padding.lg,
        paddingTop: 0,
        gap: dimensions.layout.componentSpacing / 2,
    },
    creatorsTitle: {
        fontWeight: '600',
        marginBottom: dimensions.layout.componentSpacing / 2,
    },
    creatorCard: {
        borderRadius: dimensions.card.borderRadius.sm,
        padding: dimensions.card.padding.sm,
    },
    creatorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: dimensions.layout.componentSpacing / 2,
    },
    creatorName: {
        fontWeight: '500',
    },

    // Object Detection Section
    detectionCard: {
        padding: 0,
    },
    detectionContent: {
        padding: dimensions.card.padding.lg,
        gap: dimensions.layout.componentSpacing,
    },
    detectionSetting: {
        gap: dimensions.layout.componentSpacing / 2,
    },
    detectionInfo: {
        gap: dimensions.layout.componentSpacing / 4,
    },
    detectionTitle: {
        fontWeight: '600',
    },
    detectionToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: dimensions.layout.componentSpacing,
    },
    sliderContainer: {
        gap: dimensions.layout.componentSpacing / 4,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    sliderValue: {
        textAlign: 'right',
        fontWeight: '600',
    },
    presetLabel: {
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: dimensions.screen.isSmall ? '#E0E0E0' : '#D0D0D0',
        marginVertical: dimensions.layout.componentSpacing / 2,
    },
});