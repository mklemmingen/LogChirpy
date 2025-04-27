import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, useColorScheme } from "react-native";
import { useTranslation } from "react-i18next";
import { I18nManager } from "react-native";
import { languages } from "@/i18n/languages";
import { theme } from "@/constants/theme";
import { Config } from "@/constants/config"; // <-- import global config
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsSection from "@/components/SettingsSection";

export default function SettingsScreen() {
    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const [gpsEnabled, setGpsEnabled] = useState(true); // <-- new
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    useEffect(() => {
        // Load GPS setting from AsyncStorage when screen loads
        const loadSettings = async () => {
            const storedGps = await AsyncStorage.getItem('gps-logging');
            if (storedGps !== null) {
                const enabled = storedGps === 'true';
                setGpsEnabled(enabled);
                Config.gpsLoggingEnabled = enabled;
            }
        };
        loadSettings();
    }, []);

    const changeLanguage = async (lang: string) => {
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
    };

    const toggleGpsLogging = async () => {
        const newValue = !gpsEnabled;
        setGpsEnabled(newValue);
        Config.gpsLoggingEnabled = newValue;
        await AsyncStorage.setItem('gps-logging', newValue.toString());
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: currentTheme.colors.background }]}>

            {/* Language Section */}
            <SettingsSection title={t("settings.language")}>
                <View style={{ gap: theme.spacing.sm }}>
                    {Object.entries(languages).map(([langKey, langName]: [string, string]) => {
                        const isActive = currentLanguage.startsWith(langKey);
                        return (
                            <TouchableOpacity
                                key={langKey}
                                style={[
                                    styles.languageButton,
                                    {
                                        backgroundColor: isActive ? currentTheme.colors.primary : currentTheme.colors.background,
                                        borderColor: currentTheme.colors.border,
                                    }
                                ]}
                                onPress={() => changeLanguage(langKey)}
                            >
                                <Text
                                    style={[
                                        styles.languageButtonText,
                                        {
                                            color: isActive ? currentTheme.colors.text.light : currentTheme.colors.text.primary,
                                            fontWeight: isActive ? "bold" : "normal",
                                        }
                                    ]}
                                >
                                    {langName}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </SettingsSection>

            {/* Logging Settings Section */}
            <SettingsSection title={t("settings.logging") || "Logging Settings"}>
                <View style={styles.gpsToggleContainer}>
                    <View style={styles.gpsTextContainer}>
                        <Text style={[styles.gpsLabel, { color: currentTheme.colors.text.primary }]} numberOfLines={2} ellipsizeMode="tail">
                            {t("settings.enable_gps_logging")}
                        </Text>
                    </View>
                    <Switch
                        value={gpsEnabled}
                        onValueChange={toggleGpsLogging}
                        trackColor={{ false: currentTheme.colors.border, true: currentTheme.colors.primary }}
                        thumbColor={gpsEnabled ? currentTheme.colors.text.light : currentTheme.colors.text.primary}
                    />
                </View>
            </SettingsSection>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    settingsCard: {
        width: '100%',
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        ...theme.shadows.md,
        gap: theme.spacing.md,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
    },
    languageButton: {
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
    },
    languageButtonText: {
        textAlign: "center",
        fontSize: 16,
    },
    gpsToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        borderTopWidth: 1,
        borderColor: '#ccc',
    },
    gpsTextContainer: {
        flex: 1, // take up available space
    },
    gpsLabel: {
        fontSize: 18,
    },
});
