
/**
 * AUTO-GENERATED FILE - Enhanced for comprehensive language support
 * 
 * This file contains hardcoded require() statements for all bird label files
 * to ensure they are bundled by Metro bundler. Enhanced to support all
 * whoBIRD languages with better error handling and validation.
 * 
 * Generated: 2025-06-17
 * Primary Languages: 6 (en, de, es, fr, uk, ar)
 * Extended Languages: 40+ supported by whoBIRD
 */

// Primary languages that we actively support in our app
export const birdLabelsMap: { [key: string]: any } = {
  'labels_en.txt': require('../../assets/model_labels_whoBird/labels_en.txt'),
  'labels_de.txt': require('../../assets/model_labels_whoBird/labels_de.txt'),
  'labels_es.txt': require('../../assets/model_labels_whoBird/labels_es.txt'),
  'labels_fr.txt': require('../../assets/model_labels_whoBird/labels_fr.txt'),
  'labels_uk.txt': require('../../assets/model_labels_whoBird/labels_uk.txt'),
  'labels_ar.txt': require('../../assets/model_labels_whoBird/labels_ar.txt'),
};

// Extended language support - dynamically loadable
export const extendedLanguagesMap: { [key: string]: any } = {
  'labels_af.txt': require('../../assets/model_labels_whoBird/labels_af.txt'),
  'labels_bg.txt': require('../../assets/model_labels_whoBird/labels_bg.txt'),
  'labels_ca.txt': require('../../assets/model_labels_whoBird/labels_ca.txt'),
  'labels_cs.txt': require('../../assets/model_labels_whoBird/labels_cs.txt'),
  'labels_da.txt': require('../../assets/model_labels_whoBird/labels_da.txt'),
  'labels_el.txt': require('../../assets/model_labels_whoBird/labels_el.txt'),
  'labels_en_uk.txt': require('../../assets/model_labels_whoBird/labels_en_uk.txt'),
  'labels_fi.txt': require('../../assets/model_labels_whoBird/labels_fi.txt'),
  'labels_he.txt': require('../../assets/model_labels_whoBird/labels_he.txt'),
  'labels_hr.txt': require('../../assets/model_labels_whoBird/labels_hr.txt'),
  'labels_hu.txt': require('../../assets/model_labels_whoBird/labels_hu.txt'),
  'labels_in.txt': require('../../assets/model_labels_whoBird/labels_in.txt'),
  'labels_is.txt': require('../../assets/model_labels_whoBird/labels_is.txt'),
  'labels_it.txt': require('../../assets/model_labels_whoBird/labels_it.txt'),
  'labels_ja.txt': require('../../assets/model_labels_whoBird/labels_ja.txt'),
  'labels_ko.txt': require('../../assets/model_labels_whoBird/labels_ko.txt'),
  'labels_lt.txt': require('../../assets/model_labels_whoBird/labels_lt.txt'),
  'labels_ml.txt': require('../../assets/model_labels_whoBird/labels_ml.txt'),
  'labels_nl.txt': require('../../assets/model_labels_whoBird/labels_nl.txt'),
  'labels_no.txt': require('../../assets/model_labels_whoBird/labels_no.txt'),
  'labels_pl.txt': require('../../assets/model_labels_whoBird/labels_pl.txt'),
  'labels_pt_BR.txt': require('../../assets/model_labels_whoBird/labels_pt_BR.txt'),
  'labels_pt_PT.txt': require('../../assets/model_labels_whoBird/labels_pt_PT.txt'),
  'labels_ro.txt': require('../../assets/model_labels_whoBird/labels_ro.txt'),
  'labels_ru.txt': require('../../assets/model_labels_whoBird/labels_ru.txt'),
  'labels_sk.txt': require('../../assets/model_labels_whoBird/labels_sk.txt'),
  'labels_sl.txt': require('../../assets/model_labels_whoBird/labels_sl.txt'),
  'labels_sr.txt': require('../../assets/model_labels_whoBird/labels_sr.txt'),
  'labels_sv.txt': require('../../assets/model_labels_whoBird/labels_sv.txt'),
  'labels_th.txt': require('../../assets/model_labels_whoBird/labels_th.txt'),
  'labels_tr.txt': require('../../assets/model_labels_whoBird/labels_tr.txt'),
  'labels_zh.txt': require('../../assets/model_labels_whoBird/labels_zh.txt'),
};

// All available languages combined
export const allLanguagesMap = { ...birdLabelsMap, ...extendedLanguagesMap };

// Primary languages we actively support
export const availableLanguages = ['en', 'de', 'es', 'fr', 'uk', 'ar'];

// All languages available in whoBIRD
export const allAvailableLanguages = [
  'en', 'de', 'es', 'fr', 'uk', 'ar', // Primary
  'af', 'bg', 'ca', 'cs', 'da', 'el', 'en_uk', 'fi', 'he', 'hr', 'hu', 
  'in', 'is', 'it', 'ja', 'ko', 'lt', 'ml', 'nl', 'no', 'pl', 
  'pt_BR', 'pt_PT', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'zh'
];

// Language name mappings for UI display
export const languageNames: { [key: string]: string } = {
  'en': 'English',
  'de': 'Deutsch',
  'es': 'Español', 
  'fr': 'Français',
  'uk': 'Українська',
  'ar': 'العربية',
  'af': 'Afrikaans',
  'bg': 'Български',
  'ca': 'Català',
  'cs': 'Čeština',
  'da': 'Dansk',
  'el': 'Ελληνικά',
  'en_uk': 'English (UK)',
  'fi': 'Suomi',
  'he': 'עברית',
  'hr': 'Hrvatski',
  'hu': 'Magyar',
  'in': 'Bahasa Indonesia',
  'is': 'Íslenska',
  'it': 'Italiano',
  'ja': '日本語',
  'ko': '한국어',
  'lt': 'Lietuvių',
  'ml': 'മലയാളം',
  'nl': 'Nederlands',
  'no': 'Norsk',
  'pl': 'Polski',
  'pt_BR': 'Português (Brasil)',
  'pt_PT': 'Português (Portugal)',
  'ro': 'Română',
  'ru': 'Русский',
  'sk': 'Slovenčina',
  'sl': 'Slovenščina',
  'sr': 'Српски',
  'sv': 'Svenska',
  'th': 'ไทย',
  'tr': 'Türkçe',
  'zh': '中文'
};

/**
 * Get labels for a specific language with enhanced fallback logic
 */
export function getLabelsForLanguage(language: string): any {
  const key = `labels_${language}.txt`;
  
  // Try primary languages first
  if (birdLabelsMap[key]) {
    return birdLabelsMap[key];
  }
  
  // Try extended languages
  if (extendedLanguagesMap[key]) {
    return extendedLanguagesMap[key];
  }
  
  // Handle regional variants
  const baseLanguage = language.split('_')[0];
  const baseKey = `labels_${baseLanguage}.txt`;
  
  if (birdLabelsMap[baseKey]) {
    return birdLabelsMap[baseKey];
  }
  
  if (extendedLanguagesMap[baseKey]) {
    return extendedLanguagesMap[baseKey];
  }
  
  // Ultimate fallback to English
  console.warn(`[BirdLabelsMap] Language '${language}' not found, falling back to English`);
  return birdLabelsMap['labels_en.txt'];
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
  const key = `labels_${language}.txt`;
  return key in allLanguagesMap;
}

/**
 * Get the display name for a language code
 */
export function getLanguageName(language: string): string {
  return languageNames[language] || language;
}

/**
 * Get all primary supported languages with their display names
 */
export function getPrimaryLanguages(): Array<{ code: string; name: string }> {
  return availableLanguages.map(code => ({
    code,
    name: getLanguageName(code)
  }));
}

/**
 * Get all available languages with their display names
 */
export function getAllLanguages(): Array<{ code: string; name: string }> {
  return allAvailableLanguages.map(code => ({
    code,
    name: getLanguageName(code)
  }));
}

/**
 * Load and parse label text for a language
 */
export async function loadAndParseLabels(language: string): Promise<{
  commonNames: string[];
  scientificNames: string[];
  totalCount: number;
} | null> {
  try {
    const labelsData = getLabelsForLanguage(language);
    
    if (!labelsData) {
      return null;
    }
    
    // Handle different possible return types from Metro bundler
    let labelsText: string;
    if (typeof labelsData === 'string') {
      labelsText = labelsData;
    } else if (labelsData && typeof labelsData === 'object') {
      if (labelsData.default) {
        labelsText = labelsData.default;
      } else if (labelsData.uri) {
        const response = await fetch(labelsData.uri);
        labelsText = await response.text();
      } else {
        const keys = Object.keys(labelsData);
        const stringKey = keys.find(key => typeof labelsData[key] === 'string');
        if (stringKey) {
          labelsText = labelsData[stringKey];
        } else {
          throw new Error('Could not resolve labels data');
        }
      }
    } else {
      throw new Error('Invalid labels data format');
    }
    
    // Parse the labels
    const lines = labelsText.trim().split('\n');
    const commonNames: string[] = [];
    const scientificNames: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Format: "Scientific_Name_Common Name" (whoBIRD format)
      const parts = trimmedLine.split('_');
      if (parts.length >= 2) {
        const scientificName = parts[0].trim();
        const commonName = parts.slice(1).join(' ').trim();
        
        scientificNames.push(scientificName);
        commonNames.push(commonName);
      } else {
        // Fallback for unexpected format
        scientificNames.push(trimmedLine);
        commonNames.push(trimmedLine);
      }
    }
    
    console.log(`[SUCCESS] Parsed ${commonNames.length} labels for language: ${language}`);
    
    return {
      commonNames,
      scientificNames,
      totalCount: commonNames.length
    };
    
  } catch (error) {
    console.error(`[ERROR] Failed to parse labels for language ${language}:`, error);
    return null;
  }
}