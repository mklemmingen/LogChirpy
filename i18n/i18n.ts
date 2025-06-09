import type {LanguageDetectorAsyncModule} from 'i18next';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import en from "@/locales/en/translation.json";
import de from "@/locales/de/translation.json";
import es from "@/locales/es/translation.json";
import uk from "@/locales/uk/translation.json";
import ar from "@/locales/ar/translation.json";
import fr from "@/locales/fr/translation.json";
import {SUPPORTED_LANGUAGES} from '@/types/i18n';

// Enhanced language detector with device locale fallback and error handling
const languageDetectorPlugin: LanguageDetectorAsyncModule = {
    type: 'languageDetector',
    async: true,
    detect: (callback) => {
        const detectLanguage = async () => {
            try {
                // 1. Try to get saved language preference
                const savedLang = await AsyncStorage.getItem('appLanguage');
                if (savedLang && SUPPORTED_LANGUAGES[savedLang]) {
                    console.log('🌐 Using saved language:', savedLang);
                    return savedLang;
                }

                // 2. Try device locale as fallback
                try {
                    const deviceLocales = Localization.getLocales();
                    for (const locale of deviceLocales) {
                        const langCode = locale.languageCode;
                        if (langCode && SUPPORTED_LANGUAGES[langCode]) {
                            console.log('🌐 Using device locale:', langCode);
                            // Save detected language for future use
                            await AsyncStorage.setItem('appLanguage', langCode);
                            return langCode;
                        }
                    }
                } catch (localeError) {
                    console.warn('🚨 Device locale detection failed:', localeError);
                }

                // 3. Final fallback to English
                console.log('🌐 Using fallback language: en');
                await AsyncStorage.setItem('appLanguage', 'en');
                return 'en';
                
            } catch (error) {
                console.error('🚨 Language detection failed:', error);
                return 'en';
            }
        };

        detectLanguage().then(callback);
    },
    init: () => {
        console.log('🌐 Language detector initialized');
    },
    cacheUserLanguage: async (lng: string) => {
        try {
            if (SUPPORTED_LANGUAGES[lng]) {
                await AsyncStorage.setItem('appLanguage', lng);
                console.log('🌐 Cached language:', lng);
            } else {
                console.warn('🚨 Attempted to cache unsupported language:', lng);
            }
        } catch (error) {
            console.error('🚨 Failed to cache language:', error);
        }
    },
};


// Enhanced i18n configuration with better error handling and debugging
const initOptions = {
    debug: __DEV__, // Enable debug mode in development
    fallbackLng: 'en',
    
    // Supported languages with complete translations
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES),
    
    resources: {
        en: { translation: en },
        de: { translation: de },
        es: { translation: es },
        uk: { translation: uk },
        ar: { translation: ar },
        fr: { translation: fr }
    },
    
    interpolation: {
        escapeValue: false, // React already escapes values
    },
    
    // Missing key handling
    returnNull: false,
    returnEmptyString: false,
    
    // Key separator and namespace
    keySeparator: '.',
    nsSeparator: false as const,
    
    // Missing key handler for development
    ...__DEV__ && {
        missingKeyHandler: (lngs: readonly string[], ns: string, key: string, fallbackValue: string) => {
            console.warn(`🚨 Missing translation key: ${key} for languages: ${lngs.join(', ')}`);
        }
    }
};

i18n
    .use(languageDetectorPlugin)
    .use(initReactI18next)
    .init(initOptions)
    .then(() => {
        console.log('🌐 i18n initialized successfully');
    })
    .catch((error) => {
        console.error('🚨 i18n initialization failed:', error);
    });

// Helper function to validate translation key exists
export const hasTranslationKey = (key: string, lng?: string): boolean => {
    const language = lng || i18n.language;
    return i18n.exists(key, { lng: language });
};

// Helper function to get all missing keys for a language
export const getMissingKeys = (targetLng: string): string[] => {
    const englishKeys = Object.keys(en);
    const targetResource = i18n.getResourceBundle(targetLng, 'translation');
    
    if (!targetResource) return englishKeys;
    
    const targetKeys = Object.keys(targetResource);
    return englishKeys.filter(key => !targetKeys.includes(key));
};

export default i18n;
