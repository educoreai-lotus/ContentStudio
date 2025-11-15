/**
 * HeyGen API Configuration
 * 
 * Voice Engine Configuration:
 * - HEYGEN: Native HeyGen voice engine (default and supported)
 * - ELEVENLABS: External ElevenLabs voice provider (not supported in this implementation)
 */

export const HEYGEN_CONFIG = {
  // Default HeyGen voice ID (female voice)
  DEFAULT_VOICE_ID: '1bd001e7e421d891986aad5158bc8',
  
  // Default avatar ID
  DEFAULT_AVATAR_ID: 'Kristin_public_3_20240108',
  
  // Supported voice engines - only HEYGEN is supported
  SUPPORTED_VOICE_ENGINES: ['heygen'],
  
  // Fallback voice engine (must be HEYGEN)
  FALLBACK_VOICE_ENGINE: 'heygen',
  
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
  
  // Get safe voice ID - override ElevenLabs with HeyGen default
  getSafeVoiceId(voiceId) {
    if (!voiceId) {
      return this.DEFAULT_VOICE_ID;
    }
    
    if (this.isElevenLabsVoice(voiceId)) {
      console.warn(`[HeyGenConfig] ElevenLabs voice ID detected (${voiceId}), overriding with HeyGen default voice`);
      return this.DEFAULT_VOICE_ID;
    }
    
    return voiceId;
  },
  
  // Get voice configuration for API request
  getVoiceConfig(voiceId, script, speed = 1.0) {
    const safeVoiceId = this.getSafeVoiceId(voiceId);
    
    return {
      type: 'text',
      input_text: script,
      voice_id: safeVoiceId,
      speed: speed,
    };
  },
};

