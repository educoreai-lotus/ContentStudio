/**
 * Server-side only. Never expose to the frontend.
 * Default OFF: missing / empty / anything other than explicit true → legacy publish.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isChunkedTrainerPublishEnabled(env = process.env) {
  const raw = env?.CHUNKED_TRAINER_PUBLISH_ENABLED;
  if (raw == null) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}
