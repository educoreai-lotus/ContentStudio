/**
 * Trainer manual Type-6 feature flag for narrated presentation video:
 * Presentation PDF → NarrationBundle → NarratedPresentationVideoService → MP4.
 *
 * Independent from PERSONALIZED_NARRATED_PRESENTATION_ENABLED and
 * VIDEO_TO_LESSON_NARRATED_PRESENTATION_ENABLED.
 *
 * Default: OFF (existing Trainer HeyGen GenerateAvatarVideoFromPresentationUseCase).
 * Enable with: TRAINER_NARRATED_PRESENTATION_ENABLED=true
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isTrainerNarratedPresentationEnabled(env = process.env) {
  return env.TRAINER_NARRATED_PRESENTATION_ENABLED === 'true';
}
