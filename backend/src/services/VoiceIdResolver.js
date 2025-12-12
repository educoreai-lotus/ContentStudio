/**
 * VoiceIdResolver Service
 * Resolves voice_id from language code using cached JSON mapping
 * 
 * Requirements:
 * - Input: languageCode (e.g., "he", "en", "ar")
 * - Reads from existing cached JSON mapping (heygen-voices.json)
 * - Output: voice_id string
 * - Fallback to default voice_id if mapping missing (configurable)
 * - Log warning on fallback
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../infrastructure/logging/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '../..');

/**
 * VoiceIdResolver Class
 * Resolves voice IDs from language codes
 */
export class VoiceIdResolver {
  /**
   * @param {string} defaultVoiceId - Default voice ID to use when mapping is missing (default: English voice)
   * @param {Function} loadConfigFn - Optional function to load config (for testing)
   */
  constructor(defaultVoiceId = '77a8b81df32f482f851684c5e2ebb0d2', loadConfigFn = null) {
    if (!defaultVoiceId || typeof defaultVoiceId !== 'string') {
      throw new Error('defaultVoiceId must be a non-empty string');
    }
    this.defaultVoiceId = defaultVoiceId;
    this.loadConfigFn = loadConfigFn; // null means use default file loading
    this._configCache = null;
  }

  /**
   * Load voices config (with caching)
   * @private
   * @returns {Object|null} Config object or null
   */
  _loadConfig() {
    if (this._configCache !== null) {
      return this._configCache;
    }

    try {
      // If custom loadConfigFn is provided, use it (for testing)
      if (this.loadConfigFn) {
        const config = this.loadConfigFn();
        this._configCache = config;
        return config;
      }

      // Otherwise, load from heygen-voices.json file directly
      // Paths: backend/config/heygen-voices.json or process.cwd()/config/heygen-voices.json
      const configPath = join(__dirname, '../../../config/heygen-voices.json');
      const altPath = join(process.cwd(), 'config', 'heygen-voices.json');

      let actualPath = configPath;
      if (!existsSync(configPath) && existsSync(altPath)) {
        actualPath = altPath;
      }

      if (!existsSync(actualPath)) {
        this._configCache = null;
        return null;
      }

      const configContent = readFileSync(actualPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // Validate structure
      if (!config || typeof config !== 'object' || !config.defaultVoices) {
        this._configCache = null;
        return null;
      }

      this._configCache = config;
      return config;
    } catch (error) {
      logger.error('[VoiceIdResolver] Failed to load voices config', {
        error: error.message,
      });
      this._configCache = null;
      return null;
    }
  }

  /**
   * Normalize language code
   * @private
   * @param {string} languageCode - Language code
   * @returns {string} Normalized language code
   */
  _normalizeLanguageCode(languageCode) {
    if (!languageCode || typeof languageCode !== 'string') {
      return 'en';
    }

    const langLower = languageCode.toLowerCase().trim();

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
      'ru': 'ru', 'ru-ru': 'ru', 'russian': 'ru', 'rus': 'ru',
      'tr': 'tr', 'tr-tr': 'tr', 'turkish': 'tr', 'tur': 'tr',
    };

    if (languageMap[langLower]) {
      return languageMap[langLower];
    }

    // Extract base code (e.g., 'en-US' -> 'en')
    const baseCode = langLower.split('-')[0].split('_')[0];
    if (languageMap[baseCode]) {
      return languageMap[baseCode];
    }

    // Default fallback
    return 'en';
  }

  /**
   * Resolve voice ID from language code
   * @param {string} languageCode - Language code (e.g., "he", "en", "ar")
   * @returns {string} Voice ID
   */
  resolve(languageCode) {
    const config = this._loadConfig();

    // If config is not available, use default
    if (!config || !config.defaultVoices) {
      logger.warn('[VoiceIdResolver] Voices config not available, using default voice', {
        languageCode,
        defaultVoiceId: this.defaultVoiceId,
      });
      return this.defaultVoiceId;
    }

    const normalizedLang = this._normalizeLanguageCode(languageCode);

    // Try normalized code first (e.g., 'en', 'ar', 'he')
    let voiceId = config.defaultVoices[normalizedLang];

    // Check if voiceId exists and is not null
    if (voiceId && voiceId !== null) {
      logger.debug('[VoiceIdResolver] Found voice ID for language', {
        languageCode,
        normalizedLang,
        voiceId,
      });
      return voiceId;
    }

    // Try full language name mapping (config uses full names like "arabic", "hebrew", "english")
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
      'fa': 'persian',
      'ur': 'urdu',
      'ru': 'russian',
      'tr': 'turkish',
    };

    const fullName = fullNameMap[normalizedLang];
    if (fullName) {
      voiceId = config.defaultVoices[fullName];
      if (voiceId && voiceId !== null) {
        logger.debug('[VoiceIdResolver] Found voice ID via full name mapping', {
          languageCode,
          normalizedLang,
          fullName,
          voiceId,
        });
        return voiceId;
      }
    }

    // No mapping found - use default and log warning
    logger.warn('[VoiceIdResolver] No voice mapping found for language, using default', {
      languageCode,
      normalizedLang,
      fullName: fullName || 'N/A',
      defaultVoiceId: this.defaultVoiceId,
      availableLanguages: Object.keys(config.defaultVoices).slice(0, 10).join(', '),
    });

    return this.defaultVoiceId;
  }

  /**
   * Clear config cache (useful for testing)
   */
  clearCache() {
    this._configCache = null;
  }
}

