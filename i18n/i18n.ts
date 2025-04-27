import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguageDetectorAsyncModule } from 'i18next';

import en from "@/locales/en/translation.json";
import de from "@/locales/de/translation.json";
import es from "@/locales/es/translation.json";
import uk from "@/locales/uk/translation.json";
import ar from "@/locales/ar/translation.json";

// Small helper to load saved language
const languageDetectorPlugin: LanguageDetectorAsyncModule = {
    type: 'languageDetector',
    async: true,
    detect: async (callback) => {
        try {
            const savedLang = await AsyncStorage.getItem('appLanguage');
            if (savedLang) {
                callback(savedLang);
            } else {
                callback('en');
            }
        } catch (error) {
            console.error('Failed to detect language', error);
            callback('en');
        }
    },
    init: () => {},
    cacheUserLanguage: () => {},
};


i18n
    .use(languageDetectorPlugin)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        resources: {
            en: { translation: en },
            de: { translation: de },
            es: { translation: es },
            uk: { translation: uk },
            ar: { translation: ar },
        },
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
