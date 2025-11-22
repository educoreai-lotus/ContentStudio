/**
 * HeyGen Avatar Configuration Loader
 * Loads and validates avatar configuration from config file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AVATAR_CONFIG_PATH = path.join(__dirname, '../../../config/heygen-avatar.json');
let cachedAvatarConfig = null;

/**
 * Load HeyGen avatar configuration from JSON file
 * Loads only once, caches in memory
 * @returns {Object|null} Avatar configuration object or null if file doesn't exist
 */
export function loadHeygenAvatarConfig() {
  // Return cached config if already loaded
  if (cachedAvatarConfig !== null) {
    console.log('[HeygenAvatarConfig] Using cached avatar config:', cachedAvatarConfig?.avatar_id);
    return cachedAvatarConfig;
  }

  try {
    console.log('[HeygenAvatarConfig] Loading avatar config from:', AVATAR_CONFIG_PATH);
    if (!fs.existsSync(AVATAR_CONFIG_PATH)) {
      console.warn('[HeygenAvatarConfig] Avatar config file not found:', AVATAR_CONFIG_PATH);
      cachedAvatarConfig = null;
      return null;
    }

    const configContent = fs.readFileSync(AVATAR_CONFIG_PATH, 'utf8');
    const config = JSON.parse(configContent);
    
    cachedAvatarConfig = config;
    console.log('[HeygenAvatarConfig] Avatar configuration loaded successfully. Avatar ID:', config?.avatar_id);
    
    return config;
  } catch (error) {
    console.error('[HeygenAvatarConfig] Failed to load avatar configuration:', error.message);
    cachedAvatarConfig = null;
    return null;
  }
}

/**
 * Get avatar ID from configuration
 * @returns {string|null} Avatar ID or null if not found
 */
export function getAvatarId() {
  const config = loadHeygenAvatarConfig();
  return config?.avatar_id || null;
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache() {
  cachedAvatarConfig = null;
}

