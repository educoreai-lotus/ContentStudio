/**
 * Language Utility Functions
 * Provides RTL/LTR detection and language direction utilities
 */

// RTL (Right-to-Left) languages
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

/**
 * Language mapper for various language inputs
 */
const LANGUAGE_MAP = {
  // English variants
  'english': 'en',
  'en': 'en',
  'eng': 'en',
  'en-us': 'en',
  'en-gb': 'en',
  // Hebrew variants
  'hebrew': 'he',
  'he': 'he',
  'heb': 'he',
  'he-il': 'he',
  // Arabic variants
  'arabic': 'ar',
  'ar': 'ar',
  'ara': 'ar',
  'ar-sa': 'ar',
  'ar-eg': 'ar',
  // Persian/Farsi variants
  'persian': 'fa',
  'farsi': 'fa',
  'fa': 'fa',
  'fa-ir': 'fa',
  // Urdu variants
  'urdu': 'ur',
  'ur': 'ur',
  'ur-pk': 'ur',
  // Spanish variants
  'spanish': 'es',
  'es': 'es',
  'es-es': 'es',
  'es-mx': 'es',
  // French variants
  'french': 'fr',
  'fr': 'fr',
  'fr-fr': 'fr',
  // German variants
  'german': 'de',
  'de': 'de',
  'de-de': 'de',
  // Italian variants
  'italian': 'it',
  'it': 'it',
  'it-it': 'it',
  // Japanese variants
  'japanese': 'ja',
  'ja': 'ja',
  'ja-jp': 'ja',
  // Chinese variants
  'chinese': 'zh',
  'zh': 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  // Korean variants
  'korean': 'ko',
  'ko': 'ko',
  'ko-kr': 'ko',
};

/**
 * Normalize language code to base language
 * @param {string} language - Language code (e.g., 'he-IL', 'ar-SA', 'en', 'English')
 * @returns {string} Normalized language code (e.g., 'he', 'ar', 'en')
 */
export function normalizeLanguage(language) {
  if (!language || typeof language !== 'string') {
    return 'en';
  }

  const normalized = language.toLowerCase().trim();
  
  // Check direct mapping first
  if (LANGUAGE_MAP[normalized]) {
    return LANGUAGE_MAP[normalized];
  }
  
  // Extract base language code (e.g., 'en' from 'en-US')
  const baseCode = normalized.split('-')[0].split('_')[0];
  
  // Check if base code exists in map
  if (LANGUAGE_MAP[baseCode]) {
    return LANGUAGE_MAP[baseCode];
  }
  
  // If base code is 2-3 characters, use it directly
  if (baseCode.length >= 2 && baseCode.length <= 3) {
    return baseCode;
  }
  
  // Default to English
  return 'en';
}

/**
 * Check if a language is RTL (Right-to-Left)
 * @param {string} language - Language code
 * @returns {boolean} True if language is RTL
 */
export function isRTL(language) {
  if (!language || typeof language !== 'string') {
    return false;
  }

  const normalized = normalizeLanguage(language);
  return RTL_LANGUAGES.includes(normalized);
}

/**
 * Get text direction for a language
 * @param {string} language - Language code
 * @returns {'rtl'|'ltr'|null} Text direction - returns null for LTR (let browser default)
 */
export function getTextDirection(language) {
  return isRTL(language) ? 'rtl' : null; // Return null for LTR to use browser default
}

