/** Socket inactivity timeout for long-running inbound requests (personalized generation, transcription). */
export const LONG_RUNNING_REQUEST_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Apply the long-running inbound socket timeout.
 * Does not set requestTimeout/headersTimeout (those govern request receipt, not in-flight work).
 * @param {import('http').Server} server
 */
export function applyLongRunningServerTimeouts(server) {
  server.timeout = LONG_RUNNING_REQUEST_TIMEOUT_MS;
}
