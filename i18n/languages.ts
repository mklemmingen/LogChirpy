export const languages: Record<string, string> = {
    en: "English",
    de: "Deutsch",
    es: "Español",
    uk: "Українська",
    ar: "العربية"
};

export type LanguageKey = keyof typeof languages;
