/**
 * Video-to-Lesson feature flag for synchronized
 * Presentation → NarrationBundle → Type-1 + Type-4 + Type-6.
 *
 * Independent from PERSONALIZED_NARRATED_PRESENTATION_ENABLED.
 *
 * Default: OFF (legacy parallel V2L path with HeyGen avatar).
 * Enable with: VIDEO_TO_LESSON_NARRATED_PRESENTATION_ENABLED=true
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isVideoToLessonNarratedPresentationEnabled(env = process.env) {
  return env.VIDEO_TO_LESSON_NARRATED_PRESENTATION_ENABLED === 'true';
}
