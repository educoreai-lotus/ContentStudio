/**
 * Coordinator-parity sanitization for trainer Publish Course envelopes only.
 *
 * Mirrors Coordinator middleware sanitizeInput (validation.js):
 * - Recursively walk objects/arrays
 * - Strip control characters from string keys and string values with
 *   /[\x00-\x1F\x7F]/g
 *
 * This is intentionally lossy for newlines/tabs in lesson content so the
 * signed body matches what Coordinator verifies after sanitizeInput.
 */

const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(CONTROL_CHARS, '');
}

/**
 * Deep-sanitize a value the same way Coordinator sanitizeObject does.
 * @param {*} obj
 * @returns {*}
 */
export function sanitizePublishEnvelopeForCoordinator(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizePublishEnvelopeForCoordinator);
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[sanitizeString(key)] =
      typeof value === 'string'
        ? sanitizeString(value)
        : sanitizePublishEnvelopeForCoordinator(value);
  }
  return sanitized;
}
