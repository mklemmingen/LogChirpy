import { useEffect, useState } from "react";
import { I18nManager, Linking, ScrollView, StyleSheet, Switch, useColorScheme, View, } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedIcon } from '@/components/ThemedIcon';
import Animated, {
    FadeInDown,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { languages } from "@/i18n/languages";
import { Config, STORAGE_KEYS } from "@/constants/config";
import Slider from '@react-native-community/slider';
import { ThemedView, Card } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedPressable } from "@/components/ThemedPressable";
import { ThemedSafeAreaView } from "@/components/ThemedSafeAreaView";
import { useColors, useTheme, useTypography } from "@/hooks/useThemeColor";

/**
 * Language selection card with flags and animations
 * 
 * @param props.langKey - Language key (e.g., 'en', 'de')
 * @param props.langName - Display name of the language
 * @param props.isActive - Whether this language is currently active
 * @param props.onPress - Callback when language is selected
 * @param props.index - Index for staggered animations
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
    const borderOpacity = useSharedValue(isActive ? 1 : 0);

    const handlePress = () => {
        Haptics.selectionAsync();
        scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }, () => {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        });
        onPress();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const borderAnimatedStyle = useAnimatedStyle(() => ({
        opacity: borderOpacity.value,
    }));

    useEffect(() => {
        borderOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 });
    }, [isActive, borderOpacity]);

    const getLanguageFlag = (key: string) => {
        const flags: Record<string, string> = {
            en: '🇬🇧',
            de: '🇩🇪',
            es: '🇪🇸',
            fr: '🇫🇷',
            uk: '🇺🇦',
            ar: '🇸🇦',
        };
        return flags[key] || '🌐';
    };


    return (
        <Animated.View
            entering={FadeInDown.delay(index * 80).springify()}
            layout={Layout.springify()}
        >
            <Animated.View style={animatedStyle}>
                <ThemedPressable
                    variant="ghost"
                    onPress={handlePress}
                    style={[
                        styles.languageCard,
                        {
                            backgroundColor: isActive
                                ? colors.backgroundTertiary
                                : colors.backgroundSecondary,
                        }
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.activeBorder,
                            { backgroundColor: colors.primary },
                            borderAnimatedStyle
                        ]}
                    />

                    <View style={styles.languageContent}>
                        <View style={styles.languageInfo}>
                            <View style={[
                                styles.flagContainer,
                                { backgroundColor: colors.background }
                            ]}>
                                <ThemedText style={styles.languageFlag}>
                                    {getLanguageFlag(langKey)}
                                </ThemedText>
                            </View>

                            <View style={styles.languageText}>
                                <ThemedText
                                    variant="body"
                                    style={[
                                        styles.languageName,
                                        {
                                            color: isActive ? colors.textSecondary : colors.text,
                                            fontWeight: isActive ? '500' : '600',
                                            textAlign: 'left',
                                            width: '100%'
                                        }
                                    ]}
                                >
                                    {langName}
                                </ThemedText>

                                <ThemedText
                                    variant="caption"
                                    color="tertiary"
                                    style={[
                                        styles.languageCode,
                                        {
                                            textAlign: 'left',
                                            width: '100%'
                                        }
                                    ]}
                                >
                                    {langKey.toUpperCase()}
                                </ThemedText>
                            </View>
                        </View>

                        <View style={styles.languageActions}>
                            {isActive ? (
                                <View style={[
                                    styles.activeIndicator,
                                    { backgroundColor: colors.primary }
                                ]}>
                                    <ThemedIcon
                                        name="check"
                                        size={14}
                                        color="inverse"
                                    />
                                </View>
                            ) : (
                                <View style={[
                                    styles.inactiveIndicator,
                                    { borderColor: colors.border }
                                ]} />
                            )}
                        </View>
                    </View>
                </ThemedPressable>
            </Animated.View>
        </Animated.View>
    );
}


/**
 * GPS toggle component with status indicators
 * 
 * @param props.enabled - Whether GPS logging is currently enabled
 * @param props.onToggle - Callback when GPS setting is toggled
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
 * Settings screen with language selection, location settings, and app information
 */
export default function SettingsScreen() {
    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const [gpsEnabled, setGpsEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    // Camera settings state
    const [cameraSettings, setCameraSettings] = useState({
        pipelineDelay: Config.camera.pipelineDelay,
        confidenceThreshold: Config.camera.confidenceThreshold,
        showSettings: Config.camera.showSettings,
    });

    const colorScheme = useColorScheme() ?? 'light';
    const colors = useColors();
    const theme = useTheme();
    const typography = useTypography();

    const styles = createStyles();

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [storedGps, storedDelay, storedThreshold, storedShowSettings] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.gpsLogging),
                    AsyncStorage.getItem(STORAGE_KEYS.cameraPipelineDelay),
                    AsyncStorage.getItem(STORAGE_KEYS.cameraConfidenceThreshold),
                    AsyncStorage.getItem(STORAGE_KEYS.cameraShowSettings),
                ]);

                // GPS setting
                if (storedGps !== null) {
                    const enabled = storedGps === 'true';
                    setGpsEnabled(enabled);
                    Config.gpsLoggingEnabled = enabled;
                }

                // Camera settings
                const newCameraSettings = { ...cameraSettings };
                if (storedDelay !== null) {
                    newCameraSettings.pipelineDelay = parseFloat(storedDelay);
                    Config.camera.pipelineDelay = newCameraSettings.pipelineDelay;
                }
                if (storedThreshold !== null) {
                    newCameraSettings.confidenceThreshold = parseFloat(storedThreshold);
                    Config.camera.confidenceThreshold = newCameraSettings.confidenceThreshold;
                }
                if (storedShowSettings !== null) {
                    newCameraSettings.showSettings = storedShowSettings === 'true';
                    Config.camera.showSettings = newCameraSettings.showSettings;
                }
                setCameraSettings(newCameraSettings);
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
            await AsyncStorage.setItem(STORAGE_KEYS.gpsLogging, newValue.toString());
        } catch (error) {
            console.error('Failed to save GPS setting:', error);
        }
    };

    // Camera settings handlers
    const updateCameraSetting = async <K extends keyof typeof cameraSettings>(
        key: K,
        value: typeof cameraSettings[K]
    ) => {
        const newSettings = { ...cameraSettings, [key]: value };
        setCameraSettings(newSettings);

        // Type-safe assignment to global config
        if (key === 'pipelineDelay') {
            Config.camera.pipelineDelay = value as number;
        } else if (key === 'confidenceThreshold') {
            Config.camera.confidenceThreshold = value as number;
        } else if (key === 'showSettings') {
            Config.camera.showSettings = value as boolean;
        }

        try {
            let storageKey: string;
            switch (key) {
                case 'pipelineDelay':
                    storageKey = STORAGE_KEYS.cameraPipelineDelay;
                    break;
                case 'confidenceThreshold':
                    storageKey = STORAGE_KEYS.cameraConfidenceThreshold;
                    break;
                case 'showSettings':
                    storageKey = STORAGE_KEYS.cameraShowSettings;
                    break;
                default:
                    console.warn(`Unknown camera setting key: ${key}`);
                    return;
            }
            await AsyncStorage.setItem(storageKey, value.toString());
        } catch (error) {
            console.error(`Failed to save camera setting ${key}:`, error);
        }
    };

    // Helper functions for camera settings
    const getDelayPresetLabel = (value: number): string => {
        if (value <= 0.25) return '>0,25s | Performance might be impacted';
        if (value <= 0.6) return 'Balanced (0.5s)';
        return '1s | Better Performance';
    };

    const getConfidencePresetLabel = (value: number): string => {
        if (value < 0.4) return 'Lenient (< 40%)';
        if (value < 0.75) return 'Normal (40–75%)';
        return 'Strict (≥ 75%)';
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
                        Configure your LogChirpy app
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
                        Location data settings
                    </ThemedText>
                    <GPSToggleCard
                        enabled={gpsEnabled}
                        onToggle={toggleGpsLogging}
                        styles={styles}
                    />
                </ThemedView>

                {/* Camera AI Settings Section */}
                <ThemedView style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        Camera AI Settings
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.sectionSubtitle}>
                        Adjust bird detection settings
                    </ThemedText>

                    <Animated.View
                        entering={FadeInDown.delay(250).springify()}
                        layout={Layout.springify()}
                    >
                        <Card style={styles.cameraCard}>
                            <View style={styles.cameraContent}>
                                {/* Detection Speed */}
                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <ThemedText variant="bodyLarge" style={styles.settingTitle}>
                                            Detection Speed
                                        </ThemedText>
                                        <ThemedText variant="bodySmall" color="secondary" style={styles.settingDescription}>
                                            How frequently the AI analyzes camera feed
                                        </ThemedText>
                                        <ThemedText variant="labelSmall" color="primary" style={styles.settingPreset}>
                                            {getDelayPresetLabel(cameraSettings.pipelineDelay)}
                                        </ThemedText>
                                    </View>
                                    <View style={styles.sliderContainer}>
                                        <Slider
                                            value={cameraSettings.pipelineDelay}
                                            onValueChange={(value) => updateCameraSetting('pipelineDelay', value)}
                                            minimumValue={0.1}
                                            maximumValue={1.0}
                                            step={0.01}
                                            style={styles.slider}
                                            minimumTrackTintColor={colors.primary}
                                            maximumTrackTintColor={colors.border}
                                            thumbTintColor={colors.primary}
                                        />
                                        <ThemedText variant="labelSmall" color="secondary" style={styles.sliderValue}>
                                            {cameraSettings.pipelineDelay.toFixed(2)}s
                                        </ThemedText>
                                    </View>
                                </View>

                                {/* Confidence Threshold */}
                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <ThemedText variant="bodyLarge" style={styles.settingTitle}>
                                            Detection Confidence
                                        </ThemedText>
                                        <ThemedText variant="bodySmall" color="secondary" style={styles.settingDescription}>
                                            Minimum confidence required to save bird detections
                                        </ThemedText>
                                        <ThemedText variant="labelSmall" color="primary" style={styles.settingPreset}>
                                            {getConfidencePresetLabel(cameraSettings.confidenceThreshold)}
                                        </ThemedText>
                                    </View>
                                    <View style={styles.sliderContainer}>
                                        <Slider
                                            value={cameraSettings.confidenceThreshold}
                                            onValueChange={(value) => updateCameraSetting('confidenceThreshold', value)}
                                            minimumValue={0.1}
                                            maximumValue={1.0}
                                            step={0.01}
                                            style={styles.slider}
                                            minimumTrackTintColor={colors.primary}
                                            maximumTrackTintColor={colors.border}
                                            thumbTintColor={colors.primary}
                                        />
                                        <ThemedText variant="labelSmall" color="secondary" style={styles.sliderValue}>
                                            {Math.round(cameraSettings.confidenceThreshold * 100)}%
                                        </ThemedText>
                                    </View>
                                </View>

                                {/* Settings Toggle */}
                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <ThemedText variant="bodyLarge" style={styles.settingTitle}>
                                            Show Camera Controls
                                        </ThemedText>
                                        <ThemedText variant="bodySmall" color="secondary" style={styles.settingDescription}>
                                            Display advanced controls overlay in camera view
                                        </ThemedText>
                                    </View>
                                    <Switch
                                        value={cameraSettings.showSettings}
                                        onValueChange={(value) => updateCameraSetting('showSettings', value)}
                                        trackColor={{
                                            false: colors.border,
                                            true: colors.primary
                                        }}
                                        thumbColor={
                                            cameraSettings.showSettings
                                                ? colors.textInverse
                                                : colors.textSecondary
                                        }
                                        ios_backgroundColor={colors.border}
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
                                    Created by
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
                                            Marty Lauterbach
                                        </ThemedText>
                                    </View>
                                </ThemedPressable>
                            </View>

                            <View style={styles.creatorsSection}>
                                <ThemedText variant="bodyLarge" style={styles.creatorsTitle}>
                                    Online Storage Solution by
                                </ThemedText>

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
        gap: 12,
    },
    languageCard: {
        borderRadius: 16,
        minHeight: 72,
        position: 'relative',
        overflow: 'hidden',
    },
    activeBorder: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    languageContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingLeft: 20,
    },
    languageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 16,
    },
    flagContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    languageFlag: {
        fontSize: 22,
        lineHeight: 26,
    },
    languageText: {
        flex: 1,
        gap: 2,
    },
    languageName: {
        fontSize: 16,
        lineHeight: 22,
    },
    languageCode: {
        fontSize: 12,
        lineHeight: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    languageActions: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    inactiveIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingTop: 20,
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

    // Camera Settings Section
    cameraCard: {
        padding: 0,
    },
    cameraContent: {
        padding: 20,
        gap: 24,
    },
    settingRow: {
        gap: 12,
    },
    settingInfo: {
        gap: 4,
    },
    settingTitle: {
        fontWeight: '600',
    },
    settingDescription: {
        lineHeight: 18,
    },
    settingPreset: {
        fontWeight: '600',
        marginTop: 4,
    },
    sliderContainer: {
        gap: 8,
    },
    slider: {
        height: 40,
    },
    sliderValue: {
        textAlign: 'right',
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