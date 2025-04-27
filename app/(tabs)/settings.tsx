import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { useTranslation } from "react-i18next";
import { I18nManager } from "react-native";
import { languages } from "@/i18n/languages";
import { theme } from "@/constants/theme";
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const colorScheme = useColorScheme() ?? 'light'; // detect theme (light/dark)
    const currentTheme = theme[colorScheme]; // load correct color set

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
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
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
                                borderColor: currentTheme.colors.border,
                                backgroundColor: isActive ? currentTheme.colors.primary : 'transparent'
                            }
                        ]}
                        onPress={() => changeLanguage(langKey)}
                    >
                        <Text
                            style={[
                                styles.languageButtonText,
                                {
                                    color: isActive
                                        ? currentTheme.colors.text.light
                                        : currentTheme.colors.text.primary,
                                    fontWeight: isActive ? "bold" : "normal"
                                }
                            ]}
                        >
                            {langName}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: theme.spacing.lg,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: theme.spacing.lg,
    },
    languageButton: {
        padding: theme.spacing.md,
        borderWidth: 1,
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.sm,
    },
    languageButtonText: {
        textAlign: "center",
        fontSize: 16,
    }
});
