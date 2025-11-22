/**
 * Language Validation and Normalization Helper
 * Ensures language is properly validated, normalized, and passed through the pipeline
 */

/**
 * Normalize language code to standard format
 * @param {string} language - Language input (can be "English", "english", "en", "EN", "he-IL", etc.)
 * @returns {string} Normalized language code (e.g., 'en', 'he', 'ar')
 */
export function normalizeLanguageCode(language) {
  if (!language || typeof language !== 'string') {
    return null;
  }

  const normalized = language.toLowerCase().trim();

  // Language mapping (similar to GammaClient but focused on common codes)
  const languageMap = {
    // English variants
    'en': 'en',
    'en-us': 'en',
    'en-gb': 'en',
    'english': 'en',
    'eng': 'en',
    
    // Hebrew variants
    'he': 'he',
    'he-il': 'he',
    'hebrew': 'he',
    'heb': 'he',
    
    // Arabic variants
    'ar': 'ar',
    'ar-sa': 'ar',
    'ar-eg': 'ar',
    'arabic': 'ar',
    'ara': 'ar',
    
    // Spanish variants
    'es': 'es',
    'es-es': 'es',
    'es-mx': 'es',
    'spanish': 'es',
    'spa': 'es',
    
    // French variants
    'fr': 'fr',
    'fr-fr': 'fr',
    'french': 'fr',
    'fra': 'fr',
    
    // German variants
    'de': 'de',
    'de-de': 'de',
    'german': 'de',
    'deu': 'de',
    
    // Italian variants
    'it': 'it',
    'it-it': 'it',
    'italian': 'it',
    'ita': 'it',
    
    // Japanese variants
    'ja': 'ja',
    'ja-jp': 'ja',
    'japanese': 'ja',
    'jpn': 'ja',
    
    // Chinese variants
    'zh': 'zh',
    'zh-cn': 'zh',
    'zh-tw': 'zh',
    'chinese': 'zh',
    'chi': 'zh',
    
    // Korean variants
    'ko': 'ko',
    'ko-kr': 'ko',
    'korean': 'ko',
    'kor': 'ko',
    
    // Portuguese variants
    'pt': 'pt',
    'pt-br': 'pt',
    'pt-pt': 'pt',
    'portuguese': 'pt',
    'por': 'pt',
    
    // Persian/Farsi variants
    'fa': 'fa',
    'fa-ir': 'fa',
    'persian': 'fa',
    'farsi': 'fa',
    
    // Urdu variants
    'ur': 'ur',
    'ur-pk': 'ur',
    'urdu': 'ur',
    
    // Russian variants
    'ru': 'ru',
    'ru-ru': 'ru',
    'russian': 'ru',
    'rus': 'ru',
  };

  // Check direct mapping first
  if (languageMap[normalized]) {
    return languageMap[normalized];
  }

  // Extract base language code (e.g., 'en' from 'en-US')
  const baseCode = normalized.split('-')[0].split('_')[0];
  
  // Check if base code exists in map
  if (languageMap[baseCode]) {
    return languageMap[baseCode];
  }

  // If base code is 2-3 characters, use it directly (but warn)
  if (baseCode.length >= 2 && baseCode.length <= 3) {
    return baseCode;
  }

  // Unknown language
  return null;
}

/**
 * Validate and normalize language from config and text input
 * @param {string} configLanguage - Language from config/UI
 * @param {string} textInputLanguage - Language detected from text input (optional)
 * @returns {Object} Validation result with normalized language or error
 */
export function getValidatedLanguage(configLanguage, textInputLanguage = null) {
  // Priority: configLanguage > textInputLanguage
  const languageToValidate = configLanguage || textInputLanguage;

  if (!languageToValidate) {
    return {
      valid: false,
      error: 'LANGUAGE_REQUIRED',
      message: 'Language must be provided. Cannot default to English silently.',
    };
  }

  const normalized = normalizeLanguageCode(languageToValidate);

  if (!normalized) {
    return {
      valid: false,
      error: 'LANGUAGE_INVALID',
      message: `Invalid or unsupported language code: ${languageToValidate}`,
      original: languageToValidate,
    };
  }

  return {
    valid: true,
    language: normalized,
    original: languageToValidate,
  };
}

/**
 * OpenAI TTS Voice Mapping
 * Maps language codes to OpenAI TTS voice IDs
 * Note: OpenAI TTS voices are language-agnostic, but we can select appropriate voices
 * For now, we use the same voice selection logic but ensure language is passed
 */
export const OPENAI_TTS_VOICES = {
  // Default voices (language-agnostic, but we track language for consistency)
  'en': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'he': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], // Hebrew - use any voice
  'ar': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], // Arabic - use any voice
  'es': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'fr': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'de': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'it': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'ja': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'zh': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'ko': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'pt': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'fa': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'ur': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  'ru': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], // Russian - use any voice
};

/**
 * Get TTS voice for language
 * @param {string} language - Normalized language code
 * @param {string} preferredVoice - Preferred voice (optional)
 * @returns {string} Voice ID to use
 */
export function getTTSVoiceForLanguage(language, preferredVoice = null) {
  const normalized = normalizeLanguageCode(language);
  
  if (!normalized) {
    return null;
  }

  const availableVoices = OPENAI_TTS_VOICES[normalized] || OPENAI_TTS_VOICES['en'];
  
  // If preferred voice is available, use it
  if (preferredVoice && availableVoices.includes(preferredVoice)) {
    return preferredVoice;
  }

  // Default to first available voice
  return availableVoices[0] || 'alloy';
}

/**
 * Check if TTS voice is available for language
 * @param {string} language - Language code
 * @returns {boolean} True if voice is available
 */
export function isTTSVoiceAvailable(language) {
  const normalized = normalizeLanguageCode(language);
  if (!normalized) {
    return false;
  }
  
  // OpenAI TTS voices are language-agnostic, so all languages are supported
  // But we validate that language is recognized
  return !!OPENAI_TTS_VOICES[normalized] || !!OPENAI_TTS_VOICES['en'];
}

/**
 * Build language preservation instruction for prompts
 * @param {string} language - Language code
 * @returns {string} Instruction text to inject into prompts
 */
export function buildLanguagePreservationInstruction(language) {
  const normalized = normalizeLanguageCode(language) || 'the requested language';
  
  return `IMPORTANT: Do NOT translate. Use the exact language provided by the user (${normalized}). 
Preserve all original text, terminology, and linguistic style. 
The output must be fully written in ${normalized} with no translation to English or any other language.`;
}

