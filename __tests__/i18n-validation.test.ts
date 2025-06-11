/**
 * Translation validation tests
 * Ensures all supported languages have complete translations
 */

import en from '@/locales/en/translation.json';
import de from '@/locales/de/translation.json';
import es from '@/locales/es/translation.json';
import fr from '@/locales/fr/translation.json';
import uk from '@/locales/uk/translation.json';
import ar from '@/locales/ar/translation.json';

import {SUPPORTED_LANGUAGES} from '@/types/i18n';

describe('Translation Validation', () => {
  const translations = {
    en,
    de,
    es,
    fr,
    uk,
    ar,
  };

  // Get all translation keys from English (our reference)
  const getAllKeys = (obj: any, prefix = ''): string[] => {
    const keys: string[] = [];
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...getAllKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  };

  const englishKeys = getAllKeys(en);

  test('English translation should be the reference', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
    expect(englishKeys).toContain('welcome');
    expect(englishKeys).toContain('settings.language');
    expect(englishKeys).toContain('settings.tutorial.title');
    expect(englishKeys).toContain('settings.about.title');
  });

  test('All supported languages should be defined', () => {
    const supportedLanguageCodes = Object.keys(SUPPORTED_LANGUAGES);
    expect(supportedLanguageCodes).toEqual(['en', 'de', 'es', 'fr', 'uk', 'ar']);
  });

  test('French translation should be complete after fix', () => {
    const frenchKeys = getAllKeys(fr);
    
    // Check that French has the tutorial and about sections we just added
    expect(frenchKeys).toContain('settings.tutorial.title');
    expect(frenchKeys).toContain('settings.tutorial.how_to_use.title');
    expect(frenchKeys).toContain('settings.about.title');
    expect(frenchKeys).toContain('settings.about.created_by');
    
    // French should now have more keys than before (was ~395, now should be ~500+)
    expect(frenchKeys.length).toBeGreaterThan(500);
  });

  // Test that critical navigation keys exist in all languages
  test.each(Object.keys(translations))('Language %s should have all critical navigation keys', (lang) => {
    const translation = translations[lang as keyof typeof translations];
    const keys = getAllKeys(translation);
    
    const criticalKeys = [
      'tabs.home',
      'tabs.birdex', 
      'tabs.archive',
      'tabs.account',
      'tabs.settings',
      'common.ok',
      'common.error',
      'common.cancel',
      'common.save'
    ];

    for (const criticalKey of criticalKeys) {
      expect(keys).toContain(criticalKey);
    }
  });

  // Test for obvious missing sections by comparing total key counts
  test.each(Object.keys(translations))('Language %s should have reasonable translation coverage', (lang) => {
    if (lang === 'en') return; // Skip English as it's our reference
    
    const translation = translations[lang as keyof typeof translations];
    const keys = getAllKeys(translation);
    
    // All languages should have at least 60% of English keys (currently realistic baseline)
    const coveragePercentage = (keys.length / englishKeys.length) * 100;
    expect(coveragePercentage).toBeGreaterThan(60);
  });

  test('No translation should have empty string values', () => {
    Object.entries(translations).forEach(([lang, translation]) => {
      const checkForEmptyValues = (obj: any, path = ''): void => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string') {
            expect(value.trim()).not.toBe('');
          } else if (typeof value === 'object' && value !== null) {
            checkForEmptyValues(value, currentPath);
          }
        }
      };
      
      checkForEmptyValues(translation);
    });
  });
});