import { describe, it, expect } from '@jest/globals';
import {
  CB_ERROR_CODES,
  RECOVERY,
  attachPublishClassification,
  classifyTrainerPublishError,
  extractEmbeddedJsonObjects,
  parseRetryAfterSeconds,
  redactSensitiveFields,
  tryParseJsonObject,
} from '../../../../src/infrastructure/courseBuilderClient/classifyTrainerPublishError.js';

function axiosError({ status, data, headers = {}, code, message }) {
  const err = new Error(message || `Request failed with status code ${status}`);
  if (status != null) {
    err.response = { status, data, headers };
  }
  if (code) err.code = code;
  return err;
}

describe('classifyTrainerPublishError helpers', () => {
  it('parses JSON objects and embedded code-bearing JSON', () => {
    expect(tryParseJsonObject('{"code":"TRANSFER_SESSION_GONE"}').code).toBe(
      'TRANSFER_SESSION_GONE'
    );
    const embedded = extractEmbeddedJsonObjects(
      'upstream failed status 410: {"code":"TRANSFER_SESSION_GONE","message":"gone"} trailing'
    );
    expect(embedded[0].code).toBe(CB_ERROR_CODES.TRANSFER_SESSION_GONE);
  });

  it('redacts sensitive fields', () => {
    const redacted = redactSensitiveFields({
      code: 'X',
      routing_ticket: 'secret-ticket',
      chunk_data: 'AAAA',
      nested: { signature: 'sig' },
    });
    expect(redacted.routing_ticket).toBe('[redacted]');
    expect(redacted.chunk_data).toBe('[redacted]');
    expect(redacted.nested.signature).toBe('[redacted]');
    expect(redacted.code).toBe('X');
  });

  it('parses Retry-After seconds', () => {
    expect(parseRetryAfterSeconds({ 'retry-after': '5' })).toBe(5);
    expect(parseRetryAfterSeconds({ 'Retry-After': '99999' })).toBeNull();
  });
});

describe('Coordinator 502 with embedded CB JSON', () => {
  it('classifies 410 TRANSFER_SESSION_GONE as FULL_RESTART', () => {
    const error = axiosError({
      status: 502,
      data: 'Target returned status 410: {"code":"TRANSFER_SESSION_GONE","message":"session missing"}',
    });
    const c = classifyTrainerPublishError(error, { phase: 'CHUNK' });
    expect(c.cbCode).toBe(CB_ERROR_CODES.TRANSFER_SESSION_GONE);
    expect(c.recovery).toBe(RECOVERY.FULL_RESTART);
    expect(c.downstreamHttpStatus).toBe(410);
  });

  it('classifies 409 TRAINER_PUBLISH_CONFLICT as FAIL_CLOSED', () => {
    const error = axiosError({
      status: 502,
      data: JSON.stringify({
        error: 'upstream',
        downstream_status: 409,
        body: { code: 'TRAINER_PUBLISH_CONFLICT' },
      }),
    });
    const c = classifyTrainerPublishError(error, { phase: 'FINALIZE' });
    expect(c.cbCode).toBe(CB_ERROR_CODES.TRAINER_PUBLISH_CONFLICT);
    expect(c.recovery).toBe(RECOVERY.FAIL_CLOSED);
    expect(c.downstreamHttpStatus).toBe(409);
  });

  it('classifies 429 TRAINER_PUBLISH_RATE_LIMITED as RETRY_SAME with Retry-After', () => {
    const error = axiosError({
      status: 502,
      data: 'status 429: {"code":"TRAINER_PUBLISH_RATE_LIMITED"}',
      headers: { 'retry-after': '3' },
    });
    const c = classifyTrainerPublishError(error, { phase: 'CHUNK' });
    expect(c.cbCode).toBe(CB_ERROR_CODES.TRAINER_PUBLISH_RATE_LIMITED);
    expect(c.recovery).toBe(RECOVERY.RETRY_SAME);
    expect(c.retryAfterSeconds).toBe(3);
  });

  it('fails closed on malformed/missing downstream JSON in 502', () => {
    const error = axiosError({
      status: 502,
      data: 'Bad gateway — upstream exploded',
    });
    const c = classifyTrainerPublishError(error, { phase: 'CHUNK' });
    expect(c.cbCode).toBeNull();
    expect(c.recovery).toBe(RECOVERY.FAIL_CLOSED);
  });

  it('does not treat every 502 as retryable', () => {
    const error = axiosError({
      status: 502,
      data: '{"code":"TRANSFER_HASH_MISMATCH"}',
    });
    const c = classifyTrainerPublishError(error, { phase: 'FINALIZE' });
    expect(c.recovery).toBe(RECOVERY.FAIL_CLOSED);
  });
});

describe('Coordinator auth and ticket handling', () => {
  it('fails closed on Coordinator 401/403', () => {
    expect(
      classifyTrainerPublishError(axiosError({ status: 401, data: 'Unauthorized' }), {
        phase: 'INIT',
      }).recovery
    ).toBe(RECOVERY.FAIL_CLOSED);
    expect(
      classifyTrainerPublishError(axiosError({ status: 403, data: '{}' }), {
        phase: 'INIT',
      }).recovery
    ).toBe(RECOVERY.FAIL_CLOSED);
  });

  it('expires ticket → FULL_RESTART; invalid/unknown → FAIL_CLOSED', () => {
    const expired = classifyTrainerPublishError(
      axiosError({
        status: 502,
        data: JSON.stringify({
          code: 'TRANSFER_TICKET_INVALID',
          reason: 'expired',
        }),
      }),
      { phase: 'CHUNK' }
    );
    expect(expired.ticketExpiry).toBe(true);
    expect(expired.recovery).toBe(RECOVERY.FULL_RESTART);

    const forged = classifyTrainerPublishError(
      axiosError({
        status: 502,
        data: JSON.stringify({
          code: 'TRANSFER_TICKET_INVALID',
          reason: 'forged',
        }),
      }),
      { phase: 'CHUNK' }
    );
    expect(forged.ticketExpiry).toBe(false);
    expect(forged.recovery).toBe(RECOVERY.FAIL_CLOSED);

    const unknown = classifyTrainerPublishError(
      axiosError({
        status: 502,
        data: JSON.stringify({ code: 'TRANSFER_TICKET_INVALID' }),
      }),
      { phase: 'CHUNK' }
    );
    expect(unknown.ticketExpiry).toBeNull();
    expect(unknown.recovery).toBe(RECOVERY.FAIL_CLOSED);
  });

  it('FINALIZE internal error → OUTCOME_UNCERTAIN', () => {
    const c = classifyTrainerPublishError(
      axiosError({
        status: 502,
        data: '{"code":"TRAINER_PUBLISH_INTERNAL_ERROR"}',
      }),
      { phase: 'FINALIZE' }
    );
    expect(c.recovery).toBe(RECOVERY.OUTCOME_UNCERTAIN);
    const attached = attachPublishClassification(new Error('x'), c);
    expect(attached.code).toBe('COURSE_PUBLISH_OUTCOME_UNCERTAIN');
    expect(attached.message).not.toMatch(/ticket|signature|chunk_data/i);
  });
});
