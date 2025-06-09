// TypeScript module augmentation for react-i18next
// This provides type safety for translation keys and prevents typos

import 'react-i18next';
import type en from '@/locales/en/translation.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
    // Enable strict mode for translation keys
    returnNull: false;
  }
}