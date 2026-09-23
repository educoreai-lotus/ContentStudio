/**
 * Personalized Fill feature flag for synchronized
 * Presentation → NarrationBundle → Type-1 + Type-6 narrated video.
 *
 * Default: OFF (existing HeyGen + independent text/TTS path).
 * Enable with: PERSONALIZED_NARRATED_PRESENTATION_ENABLED=true
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isPersonalizedNarratedPresentationEnabled(env = process.env) {
  return env.PERSONALIZED_NARRATED_PRESENTATION_ENABLED === 'true';
}
