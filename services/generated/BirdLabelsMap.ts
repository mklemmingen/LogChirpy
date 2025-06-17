
/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * 
 * This file contains hardcoded require() statements for all bird label files
 * to ensure they are bundled by Metro bundler.
 * 
 * Generated: 2025-06-16
 * Languages: 6 (en, de, es, fr, uk, ar)
 */

export const birdLabelsMap: { [key: string]: any } = {
  'labels_en.txt': require('../../assets/model_labels_whoBird/labels_en.txt'),
  'labels_de.txt': require('../../assets/model_labels_whoBird/labels_de.txt'),
  'labels_es.txt': require('../../assets/model_labels_whoBird/labels_es.txt'),
  'labels_fr.txt': require('../../assets/model_labels_whoBird/labels_fr.txt'),
  'labels_uk.txt': require('../../assets/model_labels_whoBird/labels_uk.txt'),
  'labels_ar.txt': require('../../assets/model_labels_whoBird/labels_ar.txt'),
};

export const availableLanguages = ['en', 'de', 'es', 'fr', 'uk', 'ar'];

export function getLabelsForLanguage(language: string): any {
  const key = `labels_${language}.txt`;
  return birdLabelsMap[key] || birdLabelsMap['labels_en.txt']; // Fallback to English
}