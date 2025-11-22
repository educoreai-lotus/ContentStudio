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
// Note: anna-public is no longer available. This will be overridden by config file if it exists.
const DEFAULT_AVATAR_ID = null; // No default - must use config file

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
    // Try primary path first
    let configPath = AVATAR_CONFIG_PATH;
    if (!fs.existsSync(configPath)) {
      // Try alternative path
      if (fs.existsSync(ALTERNATIVE_AVATAR_PATH)) {
        configPath = ALTERNATIVE_AVATAR_PATH;
      } else {
        cachedAvatarConfig = null;
        return null;
      }
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
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
    // Try primary path first
    let configPath = VOICES_CONFIG_PATH;
    console.log('[HeyGenConfig] Attempting to load voices config from:', configPath);
    
    if (!fs.existsSync(configPath)) {
      // Try alternative path
      console.log('[HeyGenConfig] Primary path not found, trying alternative:', ALTERNATIVE_VOICES_PATH);
      if (fs.existsSync(ALTERNATIVE_VOICES_PATH)) {
        configPath = ALTERNATIVE_VOICES_PATH;
        console.log('[HeyGenConfig] Found voices config at alternative path');
      } else {
        console.warn('[HeyGenConfig] Voices config file not found at either path:');
        console.warn('  Primary:', VOICES_CONFIG_PATH);
        console.warn('  Alternative:', ALTERNATIVE_VOICES_PATH);
        cachedVoicesConfig = null;
        return null;
      }
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Validate config structure
    if (!config || typeof config !== 'object') {
      console.error('[HeyGenConfig] Invalid voices config: not an object');
      cachedVoicesConfig = null;
      return null;
    }
    
    if (!config.defaultVoices || typeof config.defaultVoices !== 'object') {
      console.error('[HeyGenConfig] Invalid voices config: defaultVoices missing or not an object');
      console.error('[HeyGenConfig] Config keys:', Object.keys(config));
      cachedVoicesConfig = null;
      return null;
    }
    
    cachedVoicesConfig = config;
    console.log('[HeyGenConfig] Voices config loaded successfully. Languages available:', Object.keys(config.defaultVoices).length);
    return config;
  } catch (error) {
    console.error('[HeyGenConfig] Failed to load voices config:', error.message);
    console.error('[HeyGenConfig] Error stack:', error.stack);
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

  // No fallback - config file is required
  // If no config file exists, return null (will skip avatar generation)
  console.warn('[HeyGenConfig] No avatar config file found and no default avatar ID. Avatar generation will be skipped.');
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

  // Debug: Log what we're working with
  if (!config) {
    console.error('[HeyGenConfig] getVoiceConfig: config is null - voices config file may not exist or failed to load');
    // Fallback to default
    console.log(`[HeyGenConfig] Using default lecturer voice due to missing config for language: ${language} (normalized: ${normalizedLang})`);
    return {
      voice_id: DEFAULT_VOICE.lecturer,
      language: 'en',
      source: 'default',
    };
  }

  if (!config.defaultVoices) {
    console.error('[HeyGenConfig] getVoiceConfig: config.defaultVoices is missing');
    console.error('[HeyGenConfig] Config structure:', Object.keys(config));
    // Fallback to default
    console.log(`[HeyGenConfig] Using default lecturer voice due to missing defaultVoices for language: ${language} (normalized: ${normalizedLang})`);
    return {
      voice_id: DEFAULT_VOICE.lecturer,
      language: 'en',
      source: 'default',
    };
  }

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
        console.log(`[HeyGenConfig] Voice lookup failed: normalizedLang=${normalizedLang}, fullName=${fullName}, voiceId=${voiceId} (null or undefined). Available keys: ${Object.keys(config.defaultVoices).slice(0, 10).join(', ')}...`);
      }
    } else {
      console.log(`[HeyGenConfig] No fullName mapping for normalizedLang=${normalizedLang}`);
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

