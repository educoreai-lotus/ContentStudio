/**
 * Temporary runtime diagnostics for narrated-presentation video duration mismatch.
 *
 * Default: OFF (no extra ffprobe / no extra logs beyond existing).
 * Enable with: NARRATED_VIDEO_DURATION_DIAGNOSTICS=true
 *
 * Does not change generation, FFmpeg commands, or duration assertion.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isNarratedVideoDurationDiagnosticsEnabled(env = process.env) {
  return env.NARRATED_VIDEO_DURATION_DIAGNOSTICS === 'true';
}
