import { createHash } from 'crypto';
import { gzipSync } from 'zlib';
import { logger } from '../logging/Logger.js';
import { postToCoordinator } from '../coordinatorClient/coordinatorClient.js';
import { sanitizePublishEnvelopeForCoordinator } from './sanitizePublishEnvelopeForCoordinator.js';
import {
  COURSE_BUILDER_MAX_INBOUND_BYTES,
  assertPublishEnvelopeWithinCourseBuilderLimit,
  buildTrainerCoursePayloadForCompression,
} from './compressTrainerPublishCourse.js';
import {
  CB_ERROR_CODES,
  RECOVERY,
  attachPublishClassification,
  classifyTrainerPublishError,
} from './classifyTrainerPublishError.js';

/** Course Builder Phase 3 limits (decoded / Base64 chunk caps). */
export const MAX_CHUNK_BASE64_CHARS = 72000;
export const MAX_CHUNKS_PER_TRANSFER = 512;
export const MAX_DECODED_TRANSFER_BYTES = 8 * 1024 * 1024;

/** Raw gzip bytes per chunk so Base64 length stays ≤ MAX_CHUNK_BASE64_CHARS */
export const MAX_CHUNK_RAW_BYTES = Math.floor(MAX_CHUNK_BASE64_CHARS / 4) * 3;

export const TARGET_SERVICE = 'course-builder-service';
export const ACTION_INIT = 'trainer_publish_init';
export const ACTION_CHUNK = 'trainer_publish_chunk';
export const ACTION_FINALIZE = 'trainer_publish_finalize';

const PUBLISH_TIMEOUT_MS = 1200000;
/** Full INIT→CHUNK→FINALIZE restarts (e.g. TRANSFER_SESSION_GONE). */
export const MAX_FULL_TRANSFER_RESTARTS = 2;
/** Same FINALIZE envelope retries (lost ACK / transport). */
export const MAX_FINALIZE_ACK_RETRIES = 2;
/** Same-request retries for TRAINER_PUBLISH_RATE_LIMITED. */
export const MAX_RATE_LIMIT_RETRIES = 3;
/** Cap Retry-After wait per attempt (ms). */
export const MAX_RATE_LIMIT_WAIT_MS = 60_000;
/** Default backoff when Retry-After missing (ms). */
export const DEFAULT_RATE_LIMIT_WAIT_MS = 2_000;

const CONTENT_FINGERPRINT_HEX = /^[a-f0-9]{64}$/i;

/**
 * @param {Object} coursePayload - output of buildTrainerCoursePayloadForCompression
 * @returns {{ gzipBytes: Buffer, transferSha256: string, jsonByteLength: number }}
 */
export function gzipAndHashTrainerCoursePayload(coursePayload) {
  const json = JSON.stringify(coursePayload);
  const gzipBytes = gzipSync(Buffer.from(json, 'utf8'));
  if (gzipBytes.length > MAX_DECODED_TRANSFER_BYTES) {
    const err = new Error(
      `Compressed trainer course exceeds maximum decoded transfer size (${gzipBytes.length} > ${MAX_DECODED_TRANSFER_BYTES}).`
    );
    err.code = 'COURSE_PUBLISH_TRANSFER_TOO_LARGE';
    throw err;
  }
  const transferSha256 = createHash('sha256').update(gzipBytes).digest('hex');
  return { gzipBytes, transferSha256, jsonByteLength: Buffer.byteLength(json, 'utf8') };
}

/**
 * Split gzip bytes into Base64 chunks within CB and envelope limits.
 * @param {Buffer} gzipBytes
 * @returns {string[]} Base64 chunk strings
 */
export function splitGzipIntoBase64Chunks(gzipBytes) {
  if (!Buffer.isBuffer(gzipBytes) || gzipBytes.length === 0) {
    throw new Error('gzipBytes must be a non-empty Buffer');
  }

  // Leave headroom so full JSON envelope stays under 100KB
  const envelopeOverheadEstimate = 2500;
  const maxB64ForEnvelope = Math.max(
    1024,
    Math.min(
      MAX_CHUNK_BASE64_CHARS,
      Math.floor((COURSE_BUILDER_MAX_INBOUND_BYTES - envelopeOverheadEstimate) * 0.95)
    )
  );
  const rawPerChunk = Math.min(MAX_CHUNK_RAW_BYTES, Math.floor(maxB64ForEnvelope / 4) * 3);

  const chunks = [];
  for (let offset = 0; offset < gzipBytes.length; offset += rawPerChunk) {
    const slice = gzipBytes.subarray(offset, Math.min(offset + rawPerChunk, gzipBytes.length));
    const b64 = slice.toString('base64');
    if (b64.length > MAX_CHUNK_BASE64_CHARS) {
      const err = new Error('Chunk Base64 exceeds Course Builder maximum');
      err.code = 'COURSE_PUBLISH_CHUNK_TOO_LARGE';
      throw err;
    }
    chunks.push(b64);
  }

  if (chunks.length > MAX_CHUNKS_PER_TRANSFER) {
    const err = new Error(
      `Transfer requires ${chunks.length} chunks; maximum is ${MAX_CHUNKS_PER_TRANSFER}.`
    );
    err.code = 'COURSE_PUBLISH_TOO_MANY_CHUNKS';
    throw err;
  }

  return chunks;
}

function optionalOrgFields(organizationId) {
  if (typeof organizationId === 'string' && organizationId.trim() !== '') {
    return { organization_id: organizationId.trim() };
  }
  return {};
}

export function buildInitEnvelope({
  publisherTrainerId,
  sourceCourseId,
  transferSha256,
  expectedChunkCount,
  organizationId,
}) {
  return {
    requester_service: 'content-studio',
    payload: {
      action: ACTION_INIT,
      targetService: TARGET_SERVICE,
      publisher_trainer_id: publisherTrainerId,
      source_course_id: String(sourceCourseId),
      transfer_sha256: transferSha256,
      expected_chunk_count: expectedChunkCount,
      ...optionalOrgFields(organizationId),
    },
    response: {
      status: '',
      transfer_id: '',
      routing_ticket: '',
      expires_at: '',
    },
  };
}

export function buildChunkEnvelope({
  publisherTrainerId,
  sourceCourseId,
  transferSha256,
  expectedChunkCount,
  transferId,
  routingTicket,
  chunkIndex,
  chunkData,
  organizationId,
}) {
  return {
    requester_service: 'content-studio',
    payload: {
      action: ACTION_CHUNK,
      targetService: TARGET_SERVICE,
      routing_ticket: routingTicket,
      transfer_id: transferId,
      transfer_sha256: transferSha256,
      expected_chunk_count: expectedChunkCount,
      publisher_trainer_id: publisherTrainerId,
      source_course_id: String(sourceCourseId),
      chunk_index: chunkIndex,
      chunk_data: chunkData,
      ...optionalOrgFields(organizationId),
    },
    response: {
      status: '',
      transfer_id: '',
      chunk_index: null,
    },
  };
}

export function buildFinalizeEnvelope({
  publisherTrainerId,
  sourceCourseId,
  transferSha256,
  expectedChunkCount,
  transferId,
  routingTicket,
  organizationId,
}) {
  return {
    requester_service: 'content-studio',
    payload: {
      action: ACTION_FINALIZE,
      targetService: TARGET_SERVICE,
      routing_ticket: routingTicket,
      transfer_id: transferId,
      transfer_sha256: transferSha256,
      expected_chunk_count: expectedChunkCount,
      publisher_trainer_id: publisherTrainerId,
      source_course_id: String(sourceCourseId),
      ...optionalOrgFields(organizationId),
    },
    response: {
      status: '',
      transfer_id: '',
      course_id: '',
      lessons_created: null,
      lessons_expected: null,
      content_fingerprint: '',
    },
  };
}

/**
 * Extract CB/publish response object from Coordinator return value.
 * Supports parsed objects and JSON text (postToCoordinator uses responseType:'text'
 * then JSON.parse into `.data`; callers may also pass a raw JSON string).
 * Rejects empty or missing response bodies (generic HTTP 200 is not success).
 */
export function extractPublishResponseBody(coordinatorResult) {
  if (!coordinatorResult || typeof coordinatorResult !== 'object') {
    return null;
  }
  const data = coordinatorResult.data;
  if (data == null) {
    return null;
  }
  if (typeof data === 'string') {
    try {
      return extractPublishResponseBody({ data: JSON.parse(data) });
    } catch {
      return null;
    }
  }
  if (typeof data !== 'object') {
    return null;
  }
  if (data.response && typeof data.response === 'object') {
    return data.response;
  }
  if (data.data && typeof data.data === 'object' && data.data.response) {
    return data.data.response;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    return data;
  }
  return null;
}

/**
 * Course Builder returns routing_ticket as either:
 * - opaque string, or
 * - signed object `{ claims, signature }` (production shape).
 * Pass the value through without rebuilding claims/signature.
 *
 * @param {*} routingTicket
 * @returns {string|Object}
 */
export function extractRoutingTicket(routingTicket) {
  if (typeof routingTicket === 'string') {
    const trimmed = routingTicket.trim();
    if (!trimmed) {
      const err = new Error('Trainer publish INIT: routing_ticket is required.');
      err.code = 'COURSE_PUBLISH_INIT_FAILED';
      err.publishRecovery = RECOVERY.FAIL_CLOSED;
      throw err;
    }
    return trimmed;
  }

  if (
    routingTicket &&
    typeof routingTicket === 'object' &&
    !Array.isArray(routingTicket)
  ) {
    const hasClaims =
      Object.prototype.hasOwnProperty.call(routingTicket, 'claims') &&
      routingTicket.claims != null;
    const signature = routingTicket.signature;
    if (!hasClaims || typeof signature !== 'string' || !signature.trim()) {
      const err = new Error('Trainer publish INIT: routing_ticket is invalid.');
      err.code = 'COURSE_PUBLISH_INIT_FAILED';
      err.publishRecovery = RECOVERY.FAIL_CLOSED;
      throw err;
    }
    // Exact object reference — do not strip/rebuild signed fields
    return routingTicket;
  }

  const err = new Error('Trainer publish INIT: routing_ticket is required.');
  err.code = 'COURSE_PUBLISH_INIT_FAILED';
  err.publishRecovery = RECOVERY.FAIL_CLOSED;
  throw err;
}

export function assertNonEmptyPublishResponse(response, phase) {
  if (!response || typeof response !== 'object') {
    const err = new Error(
      `Trainer publish ${phase}: empty or missing response body (HTTP 200 alone is not success).`
    );
    err.code = 'COURSE_PUBLISH_EMPTY_RESPONSE';
    err.publishRecovery =
      phase === 'FINALIZE' ? RECOVERY.RETRY_SAME : RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (response.status == null || response.status === '') {
    const err = new Error(`Trainer publish ${phase}: response.status is required.`);
    err.code = 'COURSE_PUBLISH_EMPTY_RESPONSE';
    err.publishRecovery =
      phase === 'FINALIZE' ? RECOVERY.RETRY_SAME : RECOVERY.FAIL_CLOSED;
    throw err;
  }
  return response;
}

/** @deprecated Prefer classifyTrainerPublishError — kept for tests that check session codes */
export function isSessionMissingOrExpiredError(errorOrResponse) {
  const code = errorOrResponse && errorOrResponse.code;
  if (
    code === CB_ERROR_CODES.TRANSFER_SESSION_GONE ||
    code === 'COURSE_PUBLISH_SESSION_GONE' ||
    errorOrResponse?.publishRecovery === RECOVERY.FULL_RESTART
  ) {
    return true;
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rateLimitDelayMs(classified) {
  const fromHeader =
    classified.retryAfterSeconds != null
      ? classified.retryAfterSeconds * 1000
      : null;
  const ms = fromHeader != null ? fromHeader : DEFAULT_RATE_LIMIT_WAIT_MS;
  return Math.min(Math.max(ms, 0), MAX_RATE_LIMIT_WAIT_MS);
}

async function postSignedPublishEnvelope(envelope, phase) {
  const clone = JSON.parse(JSON.stringify(envelope));
  const toSend = sanitizePublishEnvelopeForCoordinator(clone);
  assertPublishEnvelopeWithinCourseBuilderLimit(toSend);

  let rateAttempt = 0;
  for (;;) {
    try {
      return await postToCoordinator(toSend, {
        endpoint: '/api/fill-content-metrics',
        timeout: PUBLISH_TIMEOUT_MS,
      });
    } catch (error) {
      const classified = classifyTrainerPublishError(error, { phase });
      if (
        classified.recovery === RECOVERY.RETRY_SAME &&
        classified.cbCode === CB_ERROR_CODES.TRAINER_PUBLISH_RATE_LIMITED &&
        rateAttempt < MAX_RATE_LIMIT_RETRIES
      ) {
        rateAttempt += 1;
        const delay = rateLimitDelayMs(classified);
        logger.warn('[ChunkedTrainerPublish] Rate limited; backing off', {
          phase,
          attempt: rateAttempt,
          delayMs: delay,
          cbCode: classified.cbCode,
        });
        await sleep(delay);
        continue;
      }
      throw attachPublishClassification(error, classified);
    }
  }
}

export function validateInitResponse(response) {
  assertNonEmptyPublishResponse(response, 'INIT');
  if (response.status !== 'initialized') {
    const err = new Error(`Trainer publish INIT: unexpected status "${response.status}".`);
    err.code = 'COURSE_PUBLISH_INIT_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (typeof response.transfer_id !== 'string' || !response.transfer_id.trim()) {
    const err = new Error('Trainer publish INIT: transfer_id is required.');
    err.code = 'COURSE_PUBLISH_INIT_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  const routingTicket = extractRoutingTicket(response.routing_ticket);
  if (typeof response.expires_at !== 'string' || !response.expires_at.trim()) {
    const err = new Error('Trainer publish INIT: expires_at is required.');
    err.code = 'COURSE_PUBLISH_INIT_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  return {
    transferId: response.transfer_id.trim(),
    routingTicket,
    expiresAt: response.expires_at.trim(),
  };
}

function validateChunkResponse(response, expectedIndex, transferId) {
  assertNonEmptyPublishResponse(response, 'CHUNK');
  if (response.status !== 'chunk_received') {
    const err = new Error(`Trainer publish CHUNK: unexpected status "${response.status}".`);
    err.code = 'COURSE_PUBLISH_CHUNK_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (String(response.transfer_id) !== String(transferId)) {
    const err = new Error('Trainer publish CHUNK: transfer_id mismatch.');
    err.code = 'COURSE_PUBLISH_CHUNK_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (Number(response.chunk_index) !== Number(expectedIndex)) {
    const err = new Error(
      `Trainer publish CHUNK: chunk_index mismatch (expected ${expectedIndex}, got ${response.chunk_index}).`
    );
    err.code = 'COURSE_PUBLISH_CHUNK_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
}

function validateFinalizeResponse(response, { transferId, sourceCourseId, expectedLessons }) {
  assertNonEmptyPublishResponse(response, 'FINALIZE');
  if (response.status !== 'published') {
    const err = new Error(`Trainer publish FINALIZE: unexpected status "${response.status}".`);
    err.code = 'COURSE_PUBLISH_FINALIZE_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (String(response.transfer_id) !== String(transferId)) {
    const err = new Error('Trainer publish FINALIZE: transfer_id mismatch.');
    err.code = 'COURSE_PUBLISH_FINALIZE_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (
    response.source_course_id == null ||
    String(response.source_course_id) !== String(sourceCourseId)
  ) {
    const err = new Error('Trainer publish FINALIZE: source_course_id mismatch or missing.');
    err.code = 'COURSE_PUBLISH_FINALIZE_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (response.course_id == null || String(response.course_id).trim() === '') {
    const err = new Error('Trainer publish FINALIZE: course_id is required.');
    err.code = 'COURSE_PUBLISH_FINALIZE_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  const created = Number(response.lessons_created);
  const expected = Number(response.lessons_expected);
  if (!Number.isFinite(created) || !Number.isFinite(expected)) {
    const err = new Error('Trainer publish FINALIZE: lessons_created/lessons_expected required.');
    err.code = 'COURSE_PUBLISH_FINALIZE_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (created !== expected) {
    const err = new Error(
      `Trainer publish FINALIZE: lessons_created (${created}) !== lessons_expected (${expected}).`
    );
    err.code = 'COURSE_PUBLISH_FINALIZE_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  if (expectedLessons != null && expected !== Number(expectedLessons)) {
    const err = new Error(
      `Trainer publish FINALIZE: lessons_expected (${expected}) !== local topic count (${expectedLessons}).`
    );
    err.code = 'COURSE_PUBLISH_FINALIZE_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  const fingerprint = response.content_fingerprint;
  if (typeof fingerprint !== 'string' || !CONTENT_FINGERPRINT_HEX.test(fingerprint.trim())) {
    const err = new Error(
      'Trainer publish FINALIZE: content_fingerprint must be a 64-character hex string.'
    );
    err.code = 'COURSE_PUBLISH_FINALIZE_FAILED';
    err.publishRecovery = RECOVERY.FAIL_CLOSED;
    throw err;
  }
  return response;
}

function shouldFullRestart(error) {
  if (!error) return false;
  if (error.publishRecovery === RECOVERY.FULL_RESTART) return true;
  if (error.code === CB_ERROR_CODES.TRANSFER_SESSION_GONE) return true;
  if (error.code === 'COURSE_PUBLISH_SESSION_GONE') return true;
  return false;
}

async function runInit(ctx) {
  const envelope = buildInitEnvelope(ctx);
  const result = await postSignedPublishEnvelope(envelope, 'INIT');
  const response = extractPublishResponseBody(result);
  return validateInitResponse(response);
}

async function runChunks(ctx, session) {
  for (let i = 0; i < ctx.chunks.length; i++) {
    const envelope = buildChunkEnvelope({
      ...ctx,
      transferId: session.transferId,
      routingTicket: session.routingTicket,
      chunkIndex: i,
      chunkData: ctx.chunks[i],
    });
    const result = await postSignedPublishEnvelope(envelope, 'CHUNK');
    const response = extractPublishResponseBody(result);
    validateChunkResponse(response, i, session.transferId);
  }
}

async function runFinalize(ctx, session) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_FINALIZE_ACK_RETRIES; attempt++) {
    try {
      const envelope = buildFinalizeEnvelope({
        ...ctx,
        transferId: session.transferId,
        routingTicket: session.routingTicket,
      });
      const result = await postSignedPublishEnvelope(envelope, 'FINALIZE');
      const response = extractPublishResponseBody(result);
      return validateFinalizeResponse(response, {
        transferId: session.transferId,
        sourceCourseId: ctx.sourceCourseId,
        expectedLessons: ctx.expectedLessons,
      });
    } catch (error) {
      lastError = error;

      if (error.publishRecovery === RECOVERY.OUTCOME_UNCERTAIN) {
        throw error;
      }

      // Session gone after possible commit → escalate for bounded full resend
      if (shouldFullRestart(error)) {
        error.code = error.code || CB_ERROR_CODES.TRANSFER_SESSION_GONE;
        error.publishRecovery = RECOVERY.FULL_RESTART;
        throw error;
      }

      const retryableEmpty =
        error.code === 'COURSE_PUBLISH_EMPTY_RESPONSE' ||
        error.publishRecovery === RECOVERY.RETRY_SAME;

      const retryableTransport =
        error.transport === 'timeout' ||
        error.transport === 'network' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNABORTED';

      if (
        (!retryableEmpty && !retryableTransport) ||
        attempt === MAX_FINALIZE_ACK_RETRIES
      ) {
        throw error;
      }

      logger.warn('[ChunkedTrainerPublish] FINALIZE ACK retry', {
        attempt: attempt + 1,
        code: error.code,
        recovery: error.publishRecovery,
      });
    }
  }
  throw lastError;
}

/**
 * Trainer Publish ONLY: INIT → CHUNK → FINALIZE through Coordinator.
 *
 * @param {Object} courseData - from PublishCourseUseCase.buildCourseObject
 * @param {Object} publisher - trusted auth context
 * @param {string} publisher.publisherTrainerId
 * @param {string} [publisher.organizationId]
 * @returns {Promise<Object>} FINALIZE response
 */
export async function sendChunkedTrainerPublish(courseData, publisher) {
  if (!publisher || typeof publisher.publisherTrainerId !== 'string' || !publisher.publisherTrainerId) {
    const err = new Error('publisher_trainer_id from authenticated context is required.');
    err.code = 'COURSE_PUBLISH_AUTH_REQUIRED';
    throw err;
  }

  const coursePayload = buildTrainerCoursePayloadForCompression(courseData);
  const { gzipBytes, transferSha256 } = gzipAndHashTrainerCoursePayload(coursePayload);
  const chunks = splitGzipIntoBase64Chunks(gzipBytes);
  const sourceCourseId = courseData.course_id;
  const expectedLessons = Array.isArray(courseData.topics) ? courseData.topics.length : 0;

  const ctx = {
    publisherTrainerId: publisher.publisherTrainerId,
    organizationId: publisher.organizationId || '',
    sourceCourseId,
    transferSha256,
    expectedChunkCount: chunks.length,
    chunks,
    expectedLessons,
  };

  let lastError;
  for (let restart = 0; restart <= MAX_FULL_TRANSFER_RESTARTS; restart++) {
    try {
      logger.info('[ChunkedTrainerPublish] Starting transfer', {
        sourceCourseId,
        transferSha256: transferSha256.slice(0, 16),
        expectedChunkCount: chunks.length,
        restart,
      });

      const session = await runInit(ctx);
      await runChunks(ctx, session);
      const finalized = await runFinalize(ctx, session);

      logger.info('[ChunkedTrainerPublish] Transfer published', {
        sourceCourseId,
        transferId: finalized.transfer_id,
        courseId: finalized.course_id,
        lessonsCreated: finalized.lessons_created,
      });

      return finalized;
    } catch (error) {
      lastError = error;

      if (error.publishRecovery === RECOVERY.OUTCOME_UNCERTAIN) {
        throw error;
      }

      const canRestart = shouldFullRestart(error);
      if (!canRestart || restart === MAX_FULL_TRANSFER_RESTARTS) {
        throw error;
      }

      logger.warn('[ChunkedTrainerPublish] Restarting full transfer', {
        restart: restart + 1,
        code: error.code,
        recovery: error.publishRecovery,
      });
    }
  }
  throw lastError;
}
