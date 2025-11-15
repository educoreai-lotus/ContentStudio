/**
 * HeyGen API Configuration
 * 
 * Voice Engine Configuration:
 * - HEYGEN: Native HeyGen voice engine (default and supported)
 * - ELEVENLABS: External ElevenLabs voice provider (not supported in this implementation)
 */

// Default lecturer voice for all avatar videos
export const DEFAULT_VOICE = {
  lecturer: 'Sarah', // Professional female voice
};

// Default voice engine (must be HEYGEN)
export const DEFAULT_VOICE_ENGINE = 'heygen';

export const HEYGEN_CONFIG = {
  // Default HeyGen voice ID - use DEFAULT_VOICE.lecturer
  DEFAULT_VOICE_ID: DEFAULT_VOICE.lecturer,
  
  // Default avatar ID
  DEFAULT_AVATAR_ID: 'Kristin_public_3_20240108',
  
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
  
  // Get safe voice ID - always use DEFAULT_VOICE.lecturer
  getSafeVoiceId(voiceId) {
    // Always use default lecturer voice
    if (!voiceId || this.isElevenLabsVoice(voiceId) || voiceId !== DEFAULT_VOICE.lecturer) {
      console.log(`[HeyGenConfig] Using default lecturer voice: ${DEFAULT_VOICE.lecturer}`);
      return DEFAULT_VOICE.lecturer;
    }
    
    return DEFAULT_VOICE.lecturer;
  },
  
  // Get voice configuration for API request
  getVoiceConfig(voiceId, script, speed = 1.0) {
    const safeVoiceId = this.getSafeVoiceId(voiceId);
    
    return {
      type: 'text',
      input_text: script,
      voice_id: safeVoiceId,
      voice_engine: DEFAULT_VOICE_ENGINE,
      speed: speed,
    };
  },
};

