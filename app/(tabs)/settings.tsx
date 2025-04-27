import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useColorScheme } from "react-native";
import { useTranslation } from "react-i18next";
import { I18nManager } from "react-native";
import { languages } from "@/i18n/languages";
import { theme } from "@/constants/theme";
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

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

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
            <View style={[styles.settingsCard, { backgroundColor: currentTheme.colors.card }]}>
                <Text style={[styles.title, { color: currentTheme.colors.text.primary }]}>
                    {t("settings.language")}
                </Text>

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
        ...theme.shadows.md, // ✅ subtle card shadow for modern feeling
        gap: theme.spacing.md,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: theme.spacing.lg,
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
});
