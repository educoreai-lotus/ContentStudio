/**
 * HeyGen API Configuration
 * 
 * Voice Engine Configuration:
 * - HEYGEN: Native HeyGen voice engine (default and supported)
 * - ELEVENLABS: External ElevenLabs voice provider (not supported in this implementation)
 */

// Default voice engine (must be HEYGEN)
export const DEFAULT_VOICE_ENGINE = 'heygen';

export const HEYGEN_CONFIG = {
  // Default avatar ID
  DEFAULT_AVATAR_ID: 'Kristin_public_3_20240108',
  
  // Default voice ID for HeyGen API (required field)
  // Can be overridden via HEYGEN_VOICE_ID environment variable
  DEFAULT_VOICE_ID: process.env.HEYGEN_VOICE_ID || null,
  
  // Supported voice engines - only HEYGEN is supported
  SUPPORTED_VOICE_ENGINES: ['heygen'],
  
  // Fallback voice engine (must be HEYGEN)
  FALLBACK_VOICE_ENGINE: DEFAULT_VOICE_ENGINE,
  
  // Voice provider mapping
  VOICE_PROVIDER: {
    HEYGEN: 'heygen',
    ELEVENLABS: 'elevenlabs',
  },
  
  // Check if a voice_id belongs to ElevenLabs
  // ElevenLabs voices typically have a different format than HeyGen voices
  // This is a heuristic check - adjust based on your actual voice ID patterns
  isElevenLabsVoice(voiceId) {
    if (!voiceId || typeof voiceId !== 'string') {
      return false;
    }
    // Common patterns for ElevenLabs voice IDs:
    // - UUID format (8-4-4-4-12 hex digits)
    // - Contains specific prefixes or patterns
    // - Different length than HeyGen voice IDs
    const elevenLabsPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return elevenLabsPattern.test(voiceId) || voiceId.length > 32;
  },
  
  // Get voice configuration for API request
  // CRITICAL: HeyGen API v2 REQUIRES voice_id field in voice.text.voice_id
  // According to HeyGen API v2 docs, the structure is:
  // voice: {
  //   type: 'text',
  //   text: {
  //     input_text: "...",
  //     voice_id: "...", // REQUIRED
  //     voice_engine: "heygen",
  //     speed: 1.0
  //   }
  // }
  getVoiceConfig(voiceId, script, speed = 1.0) {
    // Resolve voice_id: use provided, fallback to env var, or use default
    let resolvedVoiceId = voiceId || this.DEFAULT_VOICE_ID || process.env.HEYGEN_VOICE_ID;
    
    // CRITICAL: HeyGen API requires voice_id field - it's mandatory
    // We must provide a valid voice_id or the API will reject the request
    if (!resolvedVoiceId || typeof resolvedVoiceId !== 'string' || resolvedVoiceId.trim().length === 0) {
      // No voice_id provided - HeyGen API requires it
      // Return voice config without voice_id - caller will need to handle this
      // But we'll still include it as undefined so the field exists in the structure
      console.warn('[HeyGen Config] No voice_id provided - HeyGen API may reject this request. Set HEYGEN_VOICE_ID environment variable.');
    }
    
    // Build voice config according to HeyGen API v2 structure
    // The voice object contains a 'text' object with voice_id inside
    const voiceConfig = {
      type: 'text',
      text: {
        input_text: script,
        voice_engine: DEFAULT_VOICE_ENGINE,
        speed: speed,
      },
    };
    
    // CRITICAL: HeyGen API requires voice_id field - it's mandatory
    // Always add voice_id, even if it's not valid - API will reject with clear error
    if (resolvedVoiceId && typeof resolvedVoiceId === 'string' && resolvedVoiceId.trim().length > 0) {
      if (this.isElevenLabsVoice(resolvedVoiceId)) {
        // ElevenLabs voice ID detected - HeyGen API doesn't support this
        console.warn('[HeyGen Config] ElevenLabs voice_id detected - HeyGen API may reject:', resolvedVoiceId);
        // Still add it - API will give clearer error
        voiceConfig.text.voice_id = resolvedVoiceId.trim();
      } else {
        // Valid HeyGen voice_id format
        voiceConfig.text.voice_id = resolvedVoiceId.trim();
      }
    } else {
      // No voice_id provided - HeyGen API requires it
      // Don't add the field at all - let caller handle this
      // This will cause API to reject with clear error message
      console.error('[HeyGen Config] CRITICAL: voice_id is required but not provided. Set HEYGEN_VOICE_ID environment variable or provide voiceId parameter.');
      // Still return the config without voice_id - API will reject but at least structure is correct
      // This allows the caller to see the error and handle it appropriately
    }
    
    return voiceConfig;
  },
};

