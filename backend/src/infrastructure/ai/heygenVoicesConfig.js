import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory cache for voices configuration
let voicesConfigCache = null;

/**
 * Load HeyGen voices configuration from JSON file
 * Loads only once at startup, caches in memory
 * @returns {Object|null} Voices configuration object or null if file doesn't exist
 */
export function loadHeygenVoicesConfig() {
  // Return cached config if already loaded
  if (voicesConfigCache !== null) {
    return voicesConfigCache;
  }

  try {
    const configPath = path.join(__dirname, '../../../config/heygen-voices.json');
    
    if (!fs.existsSync(configPath)) {
      console.warn('[HeygenVoicesConfig] Voices config file not found:', configPath);
      voicesConfigCache = null;
      return null;
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    voicesConfigCache = config;
    console.log('[HeygenVoicesConfig] Voices configuration loaded successfully');
    
    return config;
  } catch (error) {
    console.error('[HeygenVoicesConfig] Failed to load voices configuration:', error.message);
    voicesConfigCache = null;
    return null;
  }
}

/**
 * Normalize language code to match config keys
 * Maps various input formats to standardized keys
 * @param {string} language - Language code (e.g., 'en-US', 'ar', 'he-IL', 'english')
 * @returns {string} Normalized language code
 */
function normalizeLanguageCode(language) {
  if (!language || typeof language !== 'string') {
    return 'en'; // Default fallback
  }

  const langLower = language.toLowerCase().trim();

  // Direct mapping for common formats
  const languageMap = {
    // English variants
    'en': 'en',
    'en-us': 'en',
    'en-gb': 'en',
    'english': 'en',
    'eng': 'en',
    
    // Arabic variants
    'ar': 'ar',
    'ar-sa': 'ar',
    'ar-eg': 'ar',
    'arabic': 'ar',
    'ara': 'ar',
    
    // Hebrew variants
    'he': 'he',
    'he-il': 'he',
    'hebrew': 'he',
    'heb': 'he',
    
    // Korean variants
    'ko': 'ko',
    'ko-kr': 'ko',
    'korean': 'ko',
    'kor': 'ko',
    
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
    
    // Portuguese variants
    'pt': 'pt',
    'pt-br': 'pt',
    'pt-pt': 'pt',
    'portuguese': 'pt',
    'por': 'pt',
    
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
    
    // Turkish variants
    'tr': 'tr',
    'tr-tr': 'tr',
    'turkish': 'tr',
    'turkey': 'tr', // Map 'turkey' to 'tr' -> 'turkish'
    'tur': 'tr',
  };

  // Check direct mapping first
  if (languageMap[langLower]) {
    return languageMap[langLower];
  }

  // Extract base language code (e.g., 'en' from 'en-US')
  const baseCode = langLower.split('-')[0].split('_')[0];
  
  // Check if base code exists in map
  if (languageMap[baseCode]) {
    return languageMap[baseCode];
  }

  // If base code is 2-3 characters, use it directly
  if (baseCode.length >= 2 && baseCode.length <= 3) {
    return baseCode;
  }

  // Fallback to English
  return 'en';
}

/**
 * Get voice ID for a specific language
 * @param {string} language - Language code (e.g., 'en-US', 'ar', 'he-IL', 'english')
 * @returns {string|null} Voice ID or null if not found
 */
export function getVoiceIdForLanguage(language) {
  const config = loadHeygenVoicesConfig();
  
  if (!config || !config.defaultVoices) {
    return null;
  }

  // Normalize language code
  const normalizedLang = normalizeLanguageCode(language);
  
  // Try normalized code first (e.g., 'ar', 'he', 'en')
  let voiceId = config.defaultVoices[normalizedLang];
  
  if (voiceId) {
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
    'tr': 'turkish',
  };

  const fullName = fullNameMap[normalizedLang];
  if (fullName) {
    voiceId = config.defaultVoices[fullName];
    if (voiceId) {
      return voiceId;
    }
  }

  // If normalized code not found and it's not 'en', try English fallback
  if (normalizedLang !== 'en') {
    // Try 'en' first
    voiceId = config.defaultVoices['en'];
    if (voiceId) {
      return voiceId;
    }
    // Then try 'english'
    voiceId = config.defaultVoices['english'];
    if (voiceId) {
      return voiceId;
    }
  }

  // Return null if no voice found (even for English)
  return null;
}

