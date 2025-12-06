/**
 * Language Code to Full Name Mapper
 * Converts ISO 639-1 language codes (2 letters) to full language names
 * Used for DevLab and other services that require full language names
 */

const LANGUAGE_CODE_TO_NAME = {
  'en': 'english',
  'he': 'hebrew',
  'ar': 'arabic',
  'es': 'spanish',
  'fr': 'french',
  'de': 'german',
  'it': 'italian',
  'pt': 'portuguese',
  'ru': 'russian',
  'zh': 'chinese',
  'ja': 'japanese',
  'ko': 'korean',
  'hi': 'hindi',
  'tr': 'turkish',
  'pl': 'polish',
  'nl': 'dutch',
  'sv': 'swedish',
  'da': 'danish',
  'no': 'norwegian',
  'fi': 'finnish',
  'cs': 'czech',
  'ro': 'romanian',
  'hu': 'hungarian',
  'el': 'greek',
  'th': 'thai',
  'vi': 'vietnamese',
  'id': 'indonesian',
  'ms': 'malay',
  'uk': 'ukrainian',
  'bg': 'bulgarian',
  'hr': 'croatian',
  'sk': 'slovak',
  'sl': 'slovenian',
  'sr': 'serbian',
  'et': 'estonian',
  'lv': 'latvian',
  'lt': 'lithuanian',
  'mk': 'macedonian',
  'sq': 'albanian',
  'is': 'icelandic',
  'ga': 'irish',
  'mt': 'maltese',
  'cy': 'welsh',
  'eu': 'basque',
  'ca': 'catalan',
  'gl': 'galician',
};

/**
 * Convert ISO 639-1 language code to full language name
 * @param {string} languageCode - 2-letter ISO 639-1 language code (e.g., 'en', 'he', 'ar')
 * @returns {string} Full language name (e.g., 'english', 'hebrew', 'arabic') or 'english' as default
 */
export function getLanguageName(languageCode) {
  if (!languageCode || typeof languageCode !== 'string') {
    return 'english'; // Default fallback
  }

  // Normalize to lowercase
  const normalizedCode = languageCode.toLowerCase().trim();

  // Return mapped name or default to 'english'
  return LANGUAGE_CODE_TO_NAME[normalizedCode] || 'english';
}

/**
 * Get language name with fallback
 * @param {string} languageCode - 2-letter ISO 639-1 language code
 * @param {string} fallback - Fallback language name (default: 'english')
 * @returns {string} Full language name
 */
export function getLanguageNameWithFallback(languageCode, fallback = 'english') {
  if (!languageCode || typeof languageCode !== 'string') {
    return fallback;
  }

  const normalizedCode = languageCode.toLowerCase().trim();
  return LANGUAGE_CODE_TO_NAME[normalizedCode] || fallback;
}

