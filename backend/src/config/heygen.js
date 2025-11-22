/**
 * HeyGen Configuration Module
 * Centralized configuration for HeyGen avatar and voice settings
 * Supports manual config files with fallback to defaults
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default avatar ID (fallback if config file doesn't exist)
const DEFAULT_AVATAR_ID = 'anna-public';

// Default voice ID for lecturer (Sarah) - fallback when language voice not found
// This should be a valid English voice ID from HeyGen
const DEFAULT_VOICE = {
  lecturer: '77a8b81df32f482f851684c5e2ebb0d2', // English voice from config (Sarah equivalent)
};

// Paths to config files
const AVATAR_CONFIG_PATH = path.join(__dirname, '../../../config/heygen-avatar.json');
const VOICES_CONFIG_PATH = path.join(__dirname, '../../../config/heygen-voices.json');

// In-memory caches
let cachedAvatarConfig = null;
let cachedVoicesConfig = null;

/**
 * Load avatar configuration from file
 * @returns {Object|null} Avatar config or null if file doesn't exist
 */
function loadAvatarConfig() {
  if (cachedAvatarConfig !== null) {
    return cachedAvatarConfig;
  }

  try {
    if (!fs.existsSync(AVATAR_CONFIG_PATH)) {
      cachedAvatarConfig = null;
      return null;
    }

    const configContent = fs.readFileSync(AVATAR_CONFIG_PATH, 'utf8');
    const config = JSON.parse(configContent);
    cachedAvatarConfig = config;
    console.log('[HeyGenConfig] Avatar config loaded from file:', config?.avatar_id);
    return config;
  } catch (error) {
    console.error('[HeyGenConfig] Failed to load avatar config:', error.message);
    cachedAvatarConfig = null;
    return null;
  }
}

/**
 * Load voices configuration from file
 * @returns {Object|null} Voices config or null if file doesn't exist
 */
function loadVoicesConfig() {
  if (cachedVoicesConfig !== null) {
    return cachedVoicesConfig;
  }

  try {
    if (!fs.existsSync(VOICES_CONFIG_PATH)) {
      cachedVoicesConfig = null;
      return null;
    }

    const configContent = fs.readFileSync(VOICES_CONFIG_PATH, 'utf8');
    const config = JSON.parse(configContent);
    cachedVoicesConfig = config;
    console.log('[HeyGenConfig] Voices config loaded from file');
    return config;
  } catch (error) {
    console.error('[HeyGenConfig] Failed to load voices config:', error.message);
    cachedVoicesConfig = null;
    return null;
  }
}

/**
 * Get safe avatar ID - prefers manual config, falls back to default
 * @returns {string|null} Avatar ID or null if neither config nor default available
 */
export function getSafeAvatarId() {
  const config = loadAvatarConfig();
  
  if (config?.avatar_id) {
    return config.avatar_id;
  }

  // Fallback to default
  if (DEFAULT_AVATAR_ID) {
    console.log('[HeyGenConfig] Using default avatar ID:', DEFAULT_AVATAR_ID);
    return DEFAULT_AVATAR_ID;
  }

  return null;
}

/**
 * Normalize language code for voice lookup
 * @param {string} language - Language code
 * @returns {string} Normalized language code
 */
function normalizeLanguageCode(language) {
  if (!language || typeof language !== 'string') {
    return 'en';
  }

  const langLower = language.toLowerCase().trim();
  
  // Direct mapping
  const languageMap = {
    'en': 'en', 'en-us': 'en', 'en-gb': 'en', 'english': 'en', 'eng': 'en',
    'ar': 'ar', 'ar-sa': 'ar', 'ar-eg': 'ar', 'arabic': 'ar', 'ara': 'ar',
    'he': 'he', 'he-il': 'he', 'hebrew': 'he', 'heb': 'he',
    'ko': 'ko', 'ko-kr': 'ko', 'korean': 'ko', 'kor': 'ko',
    'es': 'es', 'es-es': 'es', 'es-mx': 'es', 'spanish': 'es', 'spa': 'es',
    'fr': 'fr', 'fr-fr': 'fr', 'french': 'fr', 'fra': 'fr',
    'de': 'de', 'de-de': 'de', 'german': 'de', 'ger': 'de',
    'it': 'it', 'it-it': 'it', 'italian': 'it', 'ita': 'it',
    'pt': 'pt', 'pt-pt': 'pt', 'pt-br': 'pt', 'portuguese': 'pt', 'por': 'pt',
    'ja': 'ja', 'ja-jp': 'ja', 'japanese': 'ja', 'jpn': 'ja',
    'zh': 'zh', 'zh-cn': 'zh', 'zh-tw': 'zh', 'chinese': 'zh', 'zho': 'zh',
    'fa': 'fa', 'persian': 'fa', 'fas': 'fa',
    'ur': 'ur', 'urdu': 'ur', 'urd': 'ur',
  };

  if (languageMap[langLower]) {
    return languageMap[langLower];
  }

  const baseCode = langLower.split('-')[0].split('_')[0];
  if (languageMap[baseCode]) {
    return languageMap[baseCode];
  }

  return 'en'; // Default fallback
}

/**
 * Get voice configuration for a language
 * Prioritizes config file, falls back to default lecturer voice (Sarah)
 * @param {string} language - Language code
 * @returns {Object} Voice config with voice_id and source info
 */
export function getVoiceConfig(language) {
  const config = loadVoicesConfig();
  const normalizedLang = normalizeLanguageCode(language);

  // Try to find voice in config
  if (config?.defaultVoices) {
    // Try normalized code first (e.g., 'en', 'ar', 'he')
    let voiceId = config.defaultVoices[normalizedLang];
    
    // If found and not null, return it
    if (voiceId) {
      return {
        voice_id: voiceId,
        language: normalizedLang,
        source: 'config',
      };
    }

    // Try full language name mapping (e.g., 'en' -> 'english')
    const fullNameMap = {
      'ar': 'arabic',
      'he': 'hebrew',
      'en': 'english',
      'ko': 'korean',
      'es': 'spanish',
      'fr': 'french',
      'de': 'german',
      'it': 'italian',
      'pt': 'portuguese',
      'ja': 'japanese',
      'zh': 'chinese',
    };

    const fullName = fullNameMap[normalizedLang];
    if (fullName) {
      voiceId = config.defaultVoices[fullName];
      // Check if voiceId exists and is not null
      if (voiceId) {
        return {
          voice_id: voiceId,
          language: normalizedLang,
          source: 'config',
        };
      } else {
        // Log why it failed (for debugging)
        console.log(`[HeyGenConfig] Voice lookup: normalizedLang=${normalizedLang}, fullName=${fullName}, voiceId=${voiceId} (null or undefined)`);
      }
    }
  } else {
    console.log(`[HeyGenConfig] Voices config not loaded or defaultVoices missing`);
  }

  // Fallback to default lecturer voice (Sarah)
  console.log(`[HeyGenConfig] Using default lecturer voice due to missing voice for language: ${language} (normalized: ${normalizedLang})`);
  return {
    voice_id: DEFAULT_VOICE.lecturer,
    language: 'en',
    source: 'default',
  };
}

/**
 * Clear all caches (useful for testing)
 */
export function clearCaches() {
  cachedAvatarConfig = null;
  cachedVoicesConfig = null;
}

// Export constants for reference
export { DEFAULT_AVATAR_ID, DEFAULT_VOICE };

