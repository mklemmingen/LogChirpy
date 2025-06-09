// Auto-generated translation key types for type-safe i18n usage
// This file provides TypeScript IntelliSense and compile-time checking for translation keys

import type en from '@/locales/en/translation.json';

export type TranslationKeys = keyof typeof en;

// Recursive type for nested translation keys
type FlattenKeys<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends object
    ? FlattenKeys<T[K], `${Prefix}${string & K}.`>
    : `${Prefix}${string & K}`;
}[keyof T];

export type TranslationKey = FlattenKeys<typeof en>;

// Helper type for interpolation values
export type TranslationValues = Record<string, string | number>;

// Enhanced useTranslation hook type
export interface UseTranslationReturn {
  t: (key: TranslationKey, values?: TranslationValues) => string;
  i18n: {
    language: string;
    changeLanguage: (lng: string) => Promise<void>;
  };
}

// Language configuration
export interface LanguageConfig {
  code: string;
  name: string;
  flag: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  en: { code: 'en', name: 'English', flag: '🇬🇧' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' },
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
  uk: { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  ar: { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;