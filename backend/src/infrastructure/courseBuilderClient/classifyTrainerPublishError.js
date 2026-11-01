/**
 * Isolated Trainer Publish error classification (INIT / CHUNK / FINALIZE only).
 * Parses Coordinator 4xx bodies and Coordinator 502 wrappers that embed
 * downstream HTTP status + JSON. Does not match human-readable prose.
 */

export const CB_ERROR_CODES = Object.freeze({
  TRANSFER_SESSION_GONE: 'TRANSFER_SESSION_GONE',
  TRANSFER_TICKET_INVALID: 'TRANSFER_TICKET_INVALID',
  TRANSFER_METADATA_INVALID: 'TRANSFER_METADATA_INVALID',
  TRANSFER_INCOMPLETE: 'TRANSFER_INCOMPLETE',
  TRANSFER_HASH_MISMATCH: 'TRANSFER_HASH_MISMATCH',
  TRANSFER_SIZE_EXCEEDED: 'TRANSFER_SIZE_EXCEEDED',
  TRAINER_PUBLISH_CONFLICT: 'TRAINER_PUBLISH_CONFLICT',
  TRAINER_PUBLISH_INTERNAL_ERROR: 'TRAINER_PUBLISH_INTERNAL_ERROR',
  TRAINER_PUBLISH_UNAUTHORIZED: 'TRAINER_PUBLISH_UNAUTHORIZED',
  TRAINER_PUBLISH_RATE_LIMITED: 'TRAINER_PUBLISH_RATE_LIMITED',
});

const KNOWN_CB_CODES = new Set(Object.values(CB_ERROR_CODES));

/** Safe actions for the chunked sender recovery layer */
export const RECOVERY = Object.freeze({
  FULL_RESTART: 'FULL_RESTART',
  RETRY_SAME: 'RETRY_SAME',
  FAIL_CLOSED: 'FAIL_CLOSED',
  OUTCOME_UNCERTAIN: 'OUTCOME_UNCERTAIN',
});

const SENSITIVE_KEY = /ticket|signature|chunk_data|password|secret|authorization|private_key|stack|sql|query/i;

/**
 * @param {*} value
 * @returns {object|null}
 */
function asObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return null;
}

/**
 * Parse JSON text; returns object or null.
 * @param {string} text
 * @returns {object|null}
 */
export function tryParseJsonObject(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return asObject(parsed);
  } catch {
    return null;
  }
}

/**
 * Extract balanced `{...}` JSON object substrings and parse those with a `code` field.
 * Deterministic brace matching — not prose/substring heuristics on messages.
 * @param {string} text
 * @returns {object[]}
 */
export function extractEmbeddedJsonObjects(text) {
  if (typeof text !== 'string' || !text.includes('{')) {
    return [];
  }
  const found = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const slice = text.slice(i, j + 1);
          const obj = tryParseJsonObject(slice);
          if (obj && typeof obj.code === 'string') {
            found.push(obj);
          }
          i = j;
          break;
        }
      }
    }
  }
  return found;
}

/**
 * @param {object} obj
 * @returns {string|null}
 */
function pickKnownCode(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.code,
    obj.error_code,
    asObject(obj.error)?.code,
    asObject(obj.body)?.code,
    asObject(obj.downstream)?.code,
    asObject(obj.upstream)?.code,
    asObject(obj.details)?.code,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && KNOWN_CB_CODES.has(c)) {
      return c;
    }
  }
  return null;
}

/**
 * @param {object} obj
 * @returns {number|null}
 */
function pickDownstreamHttpStatus(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.downstream_status,
    obj.downstreamStatus,
    obj.upstream_status,
    obj.upstreamStatus,
    obj.target_status,
    obj.targetStatus,
    obj.statusCode,
    obj.status_code,
    asObject(obj.downstream)?.status,
    asObject(obj.upstream)?.status,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isInteger(n) && n >= 100 && n <= 599) {
      return n;
    }
  }
  return null;
}

/**
 * Prefer structured body objects; unwrap stringified nested body once.
 * @param {object} root
 * @returns {object|null}
 */
function resolveDownstreamBody(root) {
  if (!root) return null;
  if (typeof root.body === 'string') {
    const parsed = tryParseJsonObject(root.body);
    if (parsed) return parsed;
  }
  const nested = asObject(root.body) || asObject(root.downstream) || asObject(root.error);
  if (nested && typeof nested.body === 'string') {
    const parsed = tryParseJsonObject(nested.body);
    if (parsed) return parsed;
  }
  if (nested && pickKnownCode(nested)) {
    return nested;
  }
  if (pickKnownCode(root)) {
    return root;
  }
  return nested || root;
}

/**
 * Strip sensitive fields from a shallow copy used for safe logging/throw payloads.
 * @param {object|null} obj
 * @returns {object|null}
 */
export function redactSensitiveFields(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[redacted]';
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSensitiveFields(v);
    } else if (typeof v === 'string' && v.length > 500) {
      out[k] = `${v.slice(0, 120)}…[truncated]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {*} headers
 * @returns {number|null} seconds
 */
export function parseRetryAfterSeconds(headers) {
  if (!headers || typeof headers !== 'object') return null;
  const raw =
    headers['retry-after'] ||
    headers['Retry-After'] ||
    headers['RETRY-AFTER'];
  if (raw == null) return null;
  const asInt = parseInt(String(raw).trim(), 10);
  if (Number.isFinite(asInt) && asInt >= 0 && asInt <= 3600) {
    return asInt;
  }
  const dateMs = Date.parse(String(raw));
  if (Number.isFinite(dateMs)) {
    const sec = Math.ceil((dateMs - Date.now()) / 1000);
    if (sec >= 0 && sec <= 3600) return sec;
  }
  return null;
}

/**
 * Classify an Axios/Coordinator failure for Trainer Publish recovery.
 *
 * @param {Error|object} error
 * @param {{ phase?: string }} [context]
 * @returns {{
 *   cbCode: string|null,
 *   httpStatus: number|null,
 *   downstreamHttpStatus: number|null,
 *   recovery: string,
 *   ticketExpiry: boolean|null,
 *   retryAfterSeconds: number|null,
 *   safeMessage: string,
 *   redactedBody: object|null,
 * }}
 */
export function classifyTrainerPublishError(error, context = {}) {
  const phase = context.phase || 'UNKNOWN';
  const httpStatus =
    error?.response?.status != null ? Number(error.response.status) : null;
  const headers = error?.response?.headers || {};
  const retryAfterSeconds = parseRetryAfterSeconds(headers);

  let root = null;
  const data = error?.response?.data;

  if (typeof data === 'string') {
    root = tryParseJsonObject(data);
    if (!root) {
      const embedded = extractEmbeddedJsonObjects(data);
      root = embedded.find((o) => pickKnownCode(o)) || embedded[0] || null;
      if (!root && embedded.length === 0) {
        // Keep raw non-JSON body only for downstream status digit patterns in structured prefixes
        root = { _raw: data.slice(0, 2000) };
      }
    } else {
      // Also search embedded known codes inside string fields
      const fromFields = [];
      for (const v of Object.values(root)) {
        if (typeof v === 'string' && v.includes('{')) {
          fromFields.push(...extractEmbeddedJsonObjects(v));
        }
      }
      const withCode = fromFields.find((o) => pickKnownCode(o));
      if (withCode && !pickKnownCode(root)) {
        root = { ...root, ...withCode };
      }
    }
  } else if (data && typeof data === 'object') {
    root = data;
    for (const v of Object.values(root)) {
      if (typeof v === 'string' && v.includes('{')) {
        const embedded = extractEmbeddedJsonObjects(v);
        const withCode = embedded.find((o) => pickKnownCode(o));
        if (withCode) {
          root = { ...root, body: withCode };
          break;
        }
      }
    }
  }

  // Axios message rarely holds body; still scan for embedded JSON with code
  if ((!root || !pickKnownCode(root)) && typeof error?.message === 'string') {
    const embedded = extractEmbeddedJsonObjects(error.message);
    const withCode = embedded.find((o) => pickKnownCode(o));
    if (withCode) {
      root = { ...(root || {}), ...withCode };
    }
  }

  const downstreamBody = resolveDownstreamBody(root);
  let cbCode = pickKnownCode(downstreamBody) || pickKnownCode(root);
  let downstreamHttpStatus = pickDownstreamHttpStatus(root) || pickDownstreamHttpStatus(downstreamBody);

  // Deterministic: "status <code>:" prefix before JSON is common in Coord wrappers —
  // only accept when adjacent to a parseable known-code JSON object already found.
  if (downstreamHttpStatus == null && typeof data === 'string') {
    const m = data.match(/\b(?:status|HTTP)\s*[:=]?\s*(\d{3})\b/i);
    if (m && cbCode) {
      downstreamHttpStatus = Number(m[1]);
    }
  }
  if (
    downstreamHttpStatus == null &&
    typeof error?.message === 'string' &&
    cbCode
  ) {
    const m = error.message.match(/\b(?:status|HTTP)\s*[:=]?\s*(\d{3})\b/i);
    if (m) downstreamHttpStatus = Number(m[1]);
  }

  // Coordinator own auth failures (4xx without CB code)
  if (!cbCode && httpStatus === 401) {
    return {
      cbCode: null,
      httpStatus,
      downstreamHttpStatus: null,
      recovery: RECOVERY.FAIL_CLOSED,
      ticketExpiry: null,
      retryAfterSeconds,
      safeMessage: 'Trainer publish rejected: Coordinator authentication failed.',
      redactedBody: redactSensitiveFields(asObject(root)),
      phase,
    };
  }
  if (!cbCode && httpStatus === 403) {
    return {
      cbCode: null,
      httpStatus,
      downstreamHttpStatus: null,
      recovery: RECOVERY.FAIL_CLOSED,
      ticketExpiry: null,
      retryAfterSeconds,
      safeMessage: 'Trainer publish rejected: Coordinator authorization failed.',
      redactedBody: redactSensitiveFields(asObject(root)),
      phase,
    };
  }

  // Network / timeout (no HTTP response)
  if (httpStatus == null) {
    const code = error?.code;
    const isTimeout =
      code === 'ECONNABORTED' ||
      code === 'ETIMEDOUT' ||
      code === 'ERR_CANCELED';
    const isNetwork =
      code === 'ECONNRESET' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ERR_NETWORK';
    if (isTimeout || isNetwork) {
      return {
        cbCode: null,
        httpStatus: null,
        downstreamHttpStatus: null,
        recovery:
          phase === 'FINALIZE' ? RECOVERY.RETRY_SAME : RECOVERY.FAIL_CLOSED,
        ticketExpiry: null,
        retryAfterSeconds: null,
        safeMessage: isTimeout
          ? 'Trainer publish transport timeout.'
          : 'Trainer publish network failure.',
        redactedBody: null,
        phase,
        transport: isTimeout ? 'timeout' : 'network',
      };
    }
  }

  // Opaque 502 without parseable CB code → fail closed (not retryable)
  if (httpStatus === 502 && !cbCode) {
    return {
      cbCode: null,
      httpStatus,
      downstreamHttpStatus,
      recovery: RECOVERY.FAIL_CLOSED,
      ticketExpiry: null,
      retryAfterSeconds,
      safeMessage:
        'Trainer publish failed: upstream error from Coordinator (unclassified).',
      redactedBody: redactSensitiveFields(asObject(root)),
      phase,
    };
  }

  let ticketExpiry = null;
  if (cbCode === CB_ERROR_CODES.TRANSFER_TICKET_INVALID) {
    const reason =
      downstreamBody?.reason ||
      downstreamBody?.detail ||
      downstreamBody?.cause ||
      root?.reason;
    if (reason === 'expired' || reason === 'ticket_expired' || downstreamBody?.expired === true) {
      ticketExpiry = true;
    } else if (
      reason === 'invalid' ||
      reason === 'forged' ||
      reason === 'signature_invalid' ||
      downstreamBody?.expired === false
    ) {
      ticketExpiry = false;
    } else {
      ticketExpiry = null; // fail closed
    }
  }

  const recovery = decideRecovery(cbCode, phase, ticketExpiry);

  return {
    cbCode,
    httpStatus,
    downstreamHttpStatus,
    recovery,
    ticketExpiry,
    retryAfterSeconds,
    safeMessage: buildSafeMessage(cbCode, phase, recovery),
    redactedBody: redactSensitiveFields(asObject(downstreamBody) || asObject(root)),
    phase,
  };
}

function decideRecovery(cbCode, phase, ticketExpiry) {
  switch (cbCode) {
    case CB_ERROR_CODES.TRANSFER_SESSION_GONE:
      return RECOVERY.FULL_RESTART;
    case CB_ERROR_CODES.TRANSFER_TICKET_INVALID:
      // Only restart on explicitly identified expiry; otherwise fail closed
      return ticketExpiry === true ? RECOVERY.FULL_RESTART : RECOVERY.FAIL_CLOSED;
    case CB_ERROR_CODES.TRAINER_PUBLISH_RATE_LIMITED:
      return RECOVERY.RETRY_SAME;
    case CB_ERROR_CODES.TRANSFER_METADATA_INVALID:
    case CB_ERROR_CODES.TRANSFER_HASH_MISMATCH:
    case CB_ERROR_CODES.TRANSFER_SIZE_EXCEEDED:
    case CB_ERROR_CODES.TRAINER_PUBLISH_CONFLICT:
    case CB_ERROR_CODES.TRANSFER_INCOMPLETE:
    case CB_ERROR_CODES.TRAINER_PUBLISH_UNAUTHORIZED:
      return RECOVERY.FAIL_CLOSED;
    case CB_ERROR_CODES.TRAINER_PUBLISH_INTERNAL_ERROR:
      return phase === 'FINALIZE'
        ? RECOVERY.OUTCOME_UNCERTAIN
        : RECOVERY.FAIL_CLOSED;
    default:
      return RECOVERY.FAIL_CLOSED;
  }
}

function buildSafeMessage(cbCode, phase, recovery) {
  if (recovery === RECOVERY.OUTCOME_UNCERTAIN) {
    return `Trainer publish ${phase}: outcome uncertain (server internal error after possible commit). Source course was not archived.`;
  }
  if (cbCode) {
    return `Trainer publish ${phase} failed (${cbCode}).`;
  }
  return `Trainer publish ${phase} failed.`;
}

/**
 * Attach classification onto an Error for the sender without leaking secrets.
 * @param {Error} error
 * @param {ReturnType<typeof classifyTrainerPublishError>} classified
 * @returns {Error}
 */
export function attachPublishClassification(error, classified) {
  const err = error instanceof Error ? error : new Error(classified.safeMessage);
  err.message = classified.safeMessage;
  if (classified.recovery === RECOVERY.OUTCOME_UNCERTAIN) {
    err.code = 'COURSE_PUBLISH_OUTCOME_UNCERTAIN';
    err.cbCode = classified.cbCode;
  } else {
    err.code = classified.cbCode || 'COURSE_PUBLISH_FAILED';
  }
  err.publishRecovery = classified.recovery;
  err.publishPhase = classified.phase;
  err.downstreamHttpStatus = classified.downstreamHttpStatus;
  err.retryAfterSeconds = classified.retryAfterSeconds;
  err.ticketExpiry = classified.ticketExpiry;
  if (classified.transport) {
    err.transport = classified.transport;
  }
  // Never attach raw tickets / chunk bodies
  err.details = classified.redactedBody;
  return err;
}
