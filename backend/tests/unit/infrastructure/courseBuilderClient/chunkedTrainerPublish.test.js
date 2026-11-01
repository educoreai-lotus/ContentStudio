import { createHash, randomBytes } from 'crypto';
import { gunzipSync } from 'zlib';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  ACTION_CHUNK,
  ACTION_FINALIZE,
  ACTION_INIT,
  MAX_CHUNK_BASE64_CHARS,
  MAX_CHUNKS_PER_TRANSFER,
  MAX_DECODED_TRANSFER_BYTES,
  TARGET_SERVICE,
  assertNonEmptyPublishResponse,
  buildChunkEnvelope,
  buildFinalizeEnvelope,
  buildInitEnvelope,
  extractPublishResponseBody,
  gzipAndHashTrainerCoursePayload,
  isSessionMissingOrExpiredError,
  splitGzipIntoBase64Chunks,
} from '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js';
import {
  COURSE_BUILDER_MAX_INBOUND_BYTES,
  buildTrainerCoursePayloadForCompression,
} from '../../../../src/infrastructure/courseBuilderClient/compressTrainerPublishCourse.js';
import { sanitizePublishEnvelopeForCoordinator } from '../../../../src/infrastructure/courseBuilderClient/sanitizePublishEnvelopeForCoordinator.js';
import { generateKeyPairSync } from 'crypto';
import { generateSignature, verifySignature } from '../../../../src/utils/signature.js';

const PUBLISHER_ID = '11111111-2222-4333-8444-555555555555';
const ORG_ID = 'org-trusted-1';
const VALID_FINGERPRINT = 'a'.repeat(64);

function sampleCourseData(topicCount = 2) {
  const topics = [];
  for (let i = 0; i < topicCount; i++) {
    topics.push({
      topic_id: String(100 + i),
      topic_name: `Lesson ${i}`,
      topic_description: `Desc ${i}\nwith newline`,
      topic_language: 'en',
      template_id: '1',
      format_order: ['text_audio', 'code'],
      contents: [
        {
          content_id: String(1000 + i),
          content_type: 'text_audio',
          content_data: { text: `Body ${i}\n\nParagraph` },
        },
        {
          content_id: String(2000 + i),
          content_type: 'code',
          content_data: { code: `print(${i})\n`, language: 'python' },
        },
      ],
      devlab_exercises: JSON.stringify({
        questions: [{ q: `Q${i}\n` }],
        html: `<pre>${i}</pre>`,
      }),
    });
  }
  return {
    course_id: '42',
    course_name: 'Chunked Demo',
    course_description: 'Line1\nLine2',
    course_language: 'en',
    trainer_id: PUBLISHER_ID,
    trainer_name: PUBLISHER_ID,
    topics,
  };
}

function mockSuccessfulCoordinator(expectedLessons) {
  return jest.fn().mockImplementation(async (envelope) => {
    const action = envelope?.payload?.action;
    if (action === ACTION_INIT) {
      return {
        data: {
          response: {
            status: 'initialized',
            transfer_id: 'xfer-1',
            routing_ticket: 'ticket-abc.signature',
            expires_at: '2099-01-01T00:00:00.000Z',
          },
        },
        rawBodyString: '{}',
        headers: {},
      };
    }
    if (action === ACTION_CHUNK) {
      return {
        data: {
          response: {
            status: 'chunk_received',
            transfer_id: 'xfer-1',
            chunk_index: envelope.payload.chunk_index,
          },
        },
        rawBodyString: '{}',
        headers: {},
      };
    }
    if (action === ACTION_FINALIZE) {
      return {
        data: {
          response: {
            status: 'published',
            transfer_id: 'xfer-1',
            course_id: 'cb-uuid-1',
            source_course_id: envelope.payload.source_course_id,
            lessons_created: expectedLessons,
            lessons_expected: expectedLessons,
            content_fingerprint: VALID_FINGERPRINT,
          },
        },
        rawBodyString: '{}',
        headers: {},
      };
    }
    throw new Error(`Unexpected action: ${action}`);
  });
}

describe('chunkedTrainerPublish helpers', () => {
  it('computes transfer_sha256 over exact GZIP bytes', () => {
    const payload = buildTrainerCoursePayloadForCompression(sampleCourseData(3));
    const { gzipBytes, transferSha256 } = gzipAndHashTrainerCoursePayload(payload);
    expect(transferSha256).toBe(createHash('sha256').update(gzipBytes).digest('hex'));
    expect(gzipBytes[0]).toBe(0x1f);
    expect(gzipBytes[1]).toBe(0x8b);
  });

  it('splits into Base64 chunks within CB limits with lossless round-trip', () => {
    const payload = buildTrainerCoursePayloadForCompression(sampleCourseData(20));
    const { gzipBytes, transferSha256 } = gzipAndHashTrainerCoursePayload(payload);
    const chunks = splitGzipIntoBase64Chunks(gzipBytes);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThanOrEqual(MAX_CHUNKS_PER_TRANSFER);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_BASE64_CHARS);
      expect(c).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    }

    const rebuilt = Buffer.concat(chunks.map((c) => Buffer.from(c, 'base64')));
    expect(createHash('sha256').update(rebuilt).digest('hex')).toBe(transferSha256);
    const recovered = JSON.parse(gunzipSync(rebuilt).toString('utf8'));
    expect(recovered.topics).toHaveLength(20);
    expect(recovered.topics.map((t) => t.topic_id)).toEqual(
      payload.topics.map((t) => t.topic_id)
    );
    expect(recovered).toEqual(payload);
  });

  it('rejects decoded transfers larger than 8 MiB', () => {
    // High-entropy pad so GZIP cannot shrink below the decoded transfer limit
    const pad = randomBytes(9 * 1024 * 1024).toString('base64');
    try {
      gzipAndHashTrainerCoursePayload({ pad });
      throw new Error('expected COURSE_PUBLISH_TRANSFER_TOO_LARGE');
    } catch (e) {
      expect(e.code).toBe('COURSE_PUBLISH_TRANSFER_TOO_LARGE');
    }
  });

  it('builds INIT/CHUNK/FINALIZE envelopes with authenticated publisher identity', () => {
    const init = buildInitEnvelope({
      publisherTrainerId: PUBLISHER_ID,
      sourceCourseId: '42',
      transferSha256: 'abc',
      expectedChunkCount: 2,
      organizationId: ORG_ID,
    });
    expect(init.payload).toMatchObject({
      action: ACTION_INIT,
      targetService: TARGET_SERVICE,
      publisher_trainer_id: PUBLISHER_ID,
      source_course_id: '42',
      transfer_sha256: 'abc',
      expected_chunk_count: 2,
      organization_id: ORG_ID,
    });
    expect(init.payload.trainer_id).toBeUndefined();

    const chunk = buildChunkEnvelope({
      publisherTrainerId: PUBLISHER_ID,
      sourceCourseId: '42',
      transferSha256: 'abc',
      expectedChunkCount: 2,
      transferId: 'xfer-1',
      routingTicket: 'ticket',
      chunkIndex: 0,
      chunkData: 'QQ==',
      organizationId: ORG_ID,
    });
    expect(chunk.payload.action).toBe(ACTION_CHUNK);
    expect(chunk.payload.chunk_data).toBe('QQ==');
    expect(chunk.payload.routing_ticket).toBe('ticket');

    const fin = buildFinalizeEnvelope({
      publisherTrainerId: PUBLISHER_ID,
      sourceCourseId: '42',
      transferSha256: 'abc',
      expectedChunkCount: 2,
      transferId: 'xfer-1',
      routingTicket: 'ticket',
      organizationId: '',
    });
    expect(fin.payload.action).toBe(ACTION_FINALIZE);
    expect(fin.payload.organization_id).toBeUndefined();
  });

  it('rejects empty HTTP 200 style responses', () => {
    expect(extractPublishResponseBody({ data: {} })).toBeNull();
    expect(() => assertNonEmptyPublishResponse(null, 'FINALIZE')).toThrow(
      /empty or missing response/
    );
    expect(() => assertNonEmptyPublishResponse({}, 'FINALIZE')).toThrow(
      /response.status/
    );
    expect(() => assertNonEmptyPublishResponse({ status: '' }, 'INIT')).toThrow(
      /response.status/
    );
  });

  it('detects session-gone via structured recovery codes only', () => {
    expect(
      isSessionMissingOrExpiredError({ code: 'TRANSFER_SESSION_GONE' })
    ).toBe(true);
    expect(
      isSessionMissingOrExpiredError({ publishRecovery: 'FULL_RESTART' })
    ).toBe(true);
    expect(isSessionMissingOrExpiredError({ message: 'transfer not found' })).toBe(
      false
    );
  });

  it('keeps each CHUNK envelope under Course Builder 100KB after sanitize', () => {
    // Large-ish payload to force multiple chunks near the size cap
    const course = sampleCourseData(40);
    for (const t of course.topics) {
      t.contents[0].content_data.text = 'W'.repeat(8000);
    }
    const payload = buildTrainerCoursePayloadForCompression(course);
    const { gzipBytes, transferSha256 } = gzipAndHashTrainerCoursePayload(payload);
    const chunks = splitGzipIntoBase64Chunks(gzipBytes);

    for (let i = 0; i < chunks.length; i++) {
      const env = buildChunkEnvelope({
        publisherTrainerId: PUBLISHER_ID,
        sourceCourseId: '42',
        transferSha256,
        expectedChunkCount: chunks.length,
        transferId: 'xfer-1',
        routingTicket: 'ticket-abc.signature',
        chunkIndex: i,
        chunkData: chunks[i],
        organizationId: ORG_ID,
      });
      const sanitized = sanitizePublishEnvelopeForCoordinator(JSON.parse(JSON.stringify(env)));
      const bytes = Buffer.byteLength(JSON.stringify(sanitized), 'utf8');
      expect(bytes).toBeLessThanOrEqual(COURSE_BUILDER_MAX_INBOUND_BYTES);
    }
  });

  it('preserves 114+ lessons without truncation or reordering', () => {
    const course = sampleCourseData(114);
    const payload = buildTrainerCoursePayloadForCompression(course);
    const { gzipBytes, transferSha256 } = gzipAndHashTrainerCoursePayload(payload);
    const chunks = splitGzipIntoBase64Chunks(gzipBytes);
    expect(chunks.length).toBeLessThanOrEqual(MAX_CHUNKS_PER_TRANSFER);

    const rebuilt = Buffer.concat(chunks.map((c) => Buffer.from(c, 'base64')));
    expect(createHash('sha256').update(rebuilt).digest('hex')).toBe(transferSha256);
    const recovered = JSON.parse(gunzipSync(rebuilt).toString('utf8'));
    expect(recovered.topics).toHaveLength(114);
    expect(recovered.topics.map((t) => t.topic_id)).toEqual(
      Array.from({ length: 114 }, (_, i) => String(100 + i))
    );
    expect(recovered).toEqual(payload);
  });

  it('signed sanitized INIT envelope verifies with ECDSA', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
    const env = buildInitEnvelope({
      publisherTrainerId: PUBLISHER_ID,
      sourceCourseId: '42',
      transferSha256: 'deadbeef',
      expectedChunkCount: 1,
      organizationId: ORG_ID,
    });
    const sanitized = sanitizePublishEnvelopeForCoordinator(JSON.parse(JSON.stringify(env)));
    const sig = generateSignature('content-studio', privateKeyPem, sanitized);
    expect(verifySignature('content-studio', sig, publicKeyPem, sanitized)).toBe(true);
  });
});

describe('sendChunkedTrainerPublish orchestration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('sends INIT then CHUNKs then FINALIZE with authenticated publisher and validates acks', async () => {
    const course = sampleCourseData(3);
    const postToCoordinator = mockSuccessfulCoordinator(3);

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    const result = await sendChunkedTrainerPublish(course, {
      publisherTrainerId: PUBLISHER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe('published');
    expect(result.transfer_id).toBe('xfer-1');
    expect(result.course_id).toBe('cb-uuid-1');
    expect(result.lessons_created).toBe(3);

    const actions = postToCoordinator.mock.calls.map((c) => c[0].payload.action);
    expect(actions[0]).toBe(ACTION_INIT);
    expect(actions[actions.length - 1]).toBe(ACTION_FINALIZE);
    expect(actions.slice(1, -1).every((a) => a === ACTION_CHUNK)).toBe(true);

    const initPayload = postToCoordinator.mock.calls[0][0].payload;
    expect(initPayload.publisher_trainer_id).toBe(PUBLISHER_ID);
    expect(initPayload.organization_id).toBe(ORG_ID);
    expect(initPayload.transfer_sha256).toMatch(/^[a-f0-9]{64}$/);

    for (const [envelope] of postToCoordinator.mock.calls) {
      expect(envelope.payload.targetService).toBe(TARGET_SERVICE);
      expect(Buffer.byteLength(JSON.stringify(envelope), 'utf8')).toBeLessThanOrEqual(
        COURSE_BUILDER_MAX_INBOUND_BYTES
      );
    }

    // CHUNK uses routing ticket from INIT
    const chunkCall = postToCoordinator.mock.calls.find(
      (c) => c[0].payload.action === ACTION_CHUNK
    );
    expect(chunkCall[0].payload.routing_ticket).toBe('ticket-abc.signature');
  });

  it('rejects empty FINALIZE HTTP 200 and does not treat it as success', async () => {
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      if (envelope.payload.action === ACTION_INIT) {
        return {
          data: {
            response: {
              status: 'initialized',
              transfer_id: 'xfer-1',
              routing_ticket: 't',
              expires_at: '2099-01-01T00:00:00.000Z',
            },
          },
        };
      }
      if (envelope.payload.action === ACTION_CHUNK) {
        return {
          data: {
            response: {
              status: 'chunk_received',
              transfer_id: 'xfer-1',
              chunk_index: envelope.payload.chunk_index,
            },
          },
        };
      }
      // Empty 200
      return { data: {}, rawBodyString: '{}', headers: {} };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    await expect(
      sendChunkedTrainerPublish(sampleCourseData(1), { publisherTrainerId: PUBLISHER_ID })
    ).rejects.toMatchObject({ code: 'COURSE_PUBLISH_EMPTY_RESPONSE' });
  });

  it('requires authenticated publisher_trainer_id (never trusts client alone)', async () => {
    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator: jest.fn() })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    await expect(sendChunkedTrainerPublish(sampleCourseData(1), {})).rejects.toMatchObject({
      code: 'COURSE_PUBLISH_AUTH_REQUIRED',
    });
    await expect(
      sendChunkedTrainerPublish(sampleCourseData(1), { publisherTrainerId: '' })
    ).rejects.toMatchObject({ code: 'COURSE_PUBLISH_AUTH_REQUIRED' });
  });

  it('restarts with INIT when TRANSFER_SESSION_GONE mid-transfer', async () => {
    let initCount = 0;
    let chunkAttempts = 0;
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      const action = envelope.payload.action;
      if (action === ACTION_INIT) {
        initCount += 1;
        return {
          data: {
            response: {
              status: 'initialized',
              transfer_id: `xfer-${initCount}`,
              routing_ticket: `ticket-${initCount}`,
              expires_at: '2099-01-01T00:00:00.000Z',
            },
          },
        };
      }
      if (action === ACTION_CHUNK) {
        chunkAttempts += 1;
        if (initCount === 1 && chunkAttempts === 1) {
          const err = new Error('Request failed with status code 502');
          err.response = {
            status: 502,
            data: 'status 410: {"code":"TRANSFER_SESSION_GONE"}',
            headers: {},
          };
          throw err;
        }
        return {
          data: {
            response: {
              status: 'chunk_received',
              transfer_id: envelope.payload.transfer_id,
              chunk_index: envelope.payload.chunk_index,
            },
          },
        };
      }
      return {
        data: {
          response: {
            status: 'published',
            transfer_id: envelope.payload.transfer_id,
            course_id: 'cb-1',
            source_course_id: '42',
            lessons_created: 1,
            lessons_expected: 1,
            content_fingerprint: VALID_FINGERPRINT,
          },
        },
      };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    const result = await sendChunkedTrainerPublish(sampleCourseData(1), {
      publisherTrainerId: PUBLISHER_ID,
    });
    expect(result.status).toBe('published');
    expect(initCount).toBeGreaterThanOrEqual(2);
  });

  it('retries FINALIZE once on empty response then accepts idempotent published', async () => {
    let finalizeAttempts = 0;
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      if (envelope.payload.action === ACTION_INIT) {
        return {
          data: {
            response: {
              status: 'initialized',
              transfer_id: 'xfer-1',
              routing_ticket: 't',
              expires_at: '2099-01-01T00:00:00.000Z',
            },
          },
        };
      }
      if (envelope.payload.action === ACTION_CHUNK) {
        return {
          data: {
            response: {
              status: 'chunk_received',
              transfer_id: 'xfer-1',
              chunk_index: envelope.payload.chunk_index,
            },
          },
        };
      }
      finalizeAttempts += 1;
      if (finalizeAttempts === 1) {
        return { data: {}, rawBodyString: '{}' };
      }
      return {
        data: {
          response: {
            status: 'published',
            transfer_id: 'xfer-1',
            course_id: 'cb-1',
            source_course_id: '42',
            lessons_created: 1,
            lessons_expected: 1,
            content_fingerprint: VALID_FINGERPRINT,
          },
        },
      };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    const result = await sendChunkedTrainerPublish(sampleCourseData(1), {
      publisherTrainerId: PUBLISHER_ID,
    });
    expect(result.status).toBe('published');
    expect(finalizeAttempts).toBe(2);
  });
});

describe('PublishCourseUseCase archive timing', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('does not archive when transfer fails; archives only after FINALIZE success', async () => {
    const update = jest.fn().mockResolvedValue({});
    const incrementUsageCount = jest.fn().mockResolvedValue({});
    const findByCourseId = jest.fn().mockResolvedValue([
      {
        topic_id: 1,
        topic_name: 'L1',
        template_id: 1,
        description: '',
        language: 'en',
        devlab_exercises: { questions: [{ q: 'a' }] },
      },
    ]);

    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    jest.unstable_mockModule(
      '../../../../src/infrastructure/directoryClient/directoryClient.js',
      () => ({ updateCourseStatusInDirectory: jest.fn().mockResolvedValue({}) })
    );

    const sendCourseToCourseBuilder = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('fail'), { code: 'COURSE_PUBLISH_CHUNK_FAILED' }))
      .mockResolvedValueOnce({
        status: 'published',
        transfer_id: 'xfer-1',
        course_id: 'cb-1',
        lessons_created: 1,
        lessons_expected: 1,
      });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js',
      () => ({ sendCourseToCourseBuilder })
    );

    const { PublishCourseUseCase } = await import(
      '../../../../src/application/use-cases/PublishCourseUseCase.js'
    );

    const useCase = new PublishCourseUseCase({
      courseRepository: {
        findById: jest.fn().mockResolvedValue({
          course_id: 42,
          course_name: 'C',
          description: '',
          language: 'en',
          trainer_id: PUBLISHER_ID,
          status: 'draft',
        }),
        update,
      },
      topicRepository: { findByCourseId, incrementUsageCount },
      contentRepository: {
        findAllByTopicId: jest.fn().mockResolvedValue([
          {
            content_id: 1,
            content_type_id: 2,
            content_data: { code: 'x' },
          },
        ]),
        getContentTypeNamesByIds: jest.fn().mockResolvedValue(new Map([[2, 'code']])),
      },
      templateRepository: {
        findById: jest.fn().mockResolvedValue({ format_order: ['code'] }),
      },
      exerciseRepository: {},
    });

    await expect(
      useCase.execute(42, { publisherTrainerId: PUBLISHER_ID })
    ).rejects.toThrow(/Transfer failed/);
    expect(update).not.toHaveBeenCalled();
    expect(incrementUsageCount).not.toHaveBeenCalled();

    await useCase.execute(42, { publisherTrainerId: PUBLISHER_ID, organizationId: ORG_ID });
    expect(sendCourseToCourseBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: '42' }),
      { publisherTrainerId: PUBLISHER_ID, organizationId: ORG_ID }
    );
    expect(update).toHaveBeenCalledWith(42, { status: 'archived' });
    expect(incrementUsageCount).toHaveBeenCalled();
  });
});

describe('error recovery hardening', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('lost FINALIZE ACK then TRANSFER_SESSION_GONE triggers bounded full resend to idempotent published', async () => {
    let initCount = 0;
    let finalizeCount = 0;
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      const action = envelope.payload.action;
      if (action === ACTION_INIT) {
        initCount += 1;
        return {
          data: {
            response: {
              status: 'initialized',
              transfer_id: `xfer-${initCount}`,
              routing_ticket: `ticket-${initCount}`,
              expires_at: '2099-01-01T00:00:00.000Z',
            },
          },
        };
      }
      if (action === ACTION_CHUNK) {
        return {
          data: {
            response: {
              status: 'chunk_received',
              transfer_id: envelope.payload.transfer_id,
              chunk_index: envelope.payload.chunk_index,
            },
          },
        };
      }
      finalizeCount += 1;
      if (initCount === 1 && finalizeCount === 1) {
        return { data: {} }; // lost ACK / empty 200
      }
      if (initCount === 1 && finalizeCount === 2) {
        const err = new Error('Request failed with status code 502');
        err.response = {
          status: 502,
          data: 'status 410: {"code":"TRANSFER_SESSION_GONE"}',
          headers: {},
        };
        throw err;
      }
      return {
        data: {
          response: {
            status: 'published',
            transfer_id: envelope.payload.transfer_id,
            course_id: 'cb-deterministic-1',
            source_course_id: '42',
            lessons_created: 1,
            lessons_expected: 1,
            content_fingerprint: VALID_FINGERPRINT,
          },
        },
      };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    const result = await sendChunkedTrainerPublish(sampleCourseData(1), {
      publisherTrainerId: PUBLISHER_ID,
    });
    expect(result.status).toBe('published');
    expect(result.course_id).toBe('cb-deterministic-1');
    expect(result.content_fingerprint).toBe(VALID_FINGERPRINT);
    expect(initCount).toBeGreaterThanOrEqual(2);
  });

  it('fails closed on TRAINER_PUBLISH_CONFLICT without restart', async () => {
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      if (envelope.payload.action === ACTION_INIT) {
        return {
          data: {
            response: {
              status: 'initialized',
              transfer_id: 'xfer-1',
              routing_ticket: 't',
              expires_at: '2099-01-01T00:00:00.000Z',
            },
          },
        };
      }
      if (envelope.payload.action === ACTION_CHUNK) {
        return {
          data: {
            response: {
              status: 'chunk_received',
              transfer_id: 'xfer-1',
              chunk_index: envelope.payload.chunk_index,
            },
          },
        };
      }
      const err = new Error('Request failed with status code 502');
      err.response = {
        status: 502,
        data: JSON.stringify({
          downstream_status: 409,
          body: { code: 'TRAINER_PUBLISH_CONFLICT' },
        }),
        headers: {},
      };
      throw err;
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    await expect(
      sendChunkedTrainerPublish(sampleCourseData(1), { publisherTrainerId: PUBLISHER_ID })
    ).rejects.toMatchObject({
      code: 'TRAINER_PUBLISH_CONFLICT',
      publishRecovery: 'FAIL_CLOSED',
    });
    const inits = postToCoordinator.mock.calls.filter(
      (c) => c[0].payload.action === ACTION_INIT
    );
    expect(inits).toHaveLength(1);
  });

  it('applies bounded rate-limit backoff then succeeds', async () => {
    let chunkHits = 0;
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      if (envelope.payload.action === ACTION_INIT) {
        return {
          data: {
            response: {
              status: 'initialized',
              transfer_id: 'xfer-1',
              routing_ticket: 't',
              expires_at: '2099-01-01T00:00:00.000Z',
            },
          },
        };
      }
      if (envelope.payload.action === ACTION_CHUNK) {
        chunkHits += 1;
        if (chunkHits === 1) {
          const err = new Error('Request failed with status code 502');
          err.response = {
            status: 502,
            data: 'status 429: {"code":"TRAINER_PUBLISH_RATE_LIMITED"}',
            headers: { 'retry-after': '0' },
          };
          throw err;
        }
        return {
          data: {
            response: {
              status: 'chunk_received',
              transfer_id: 'xfer-1',
              chunk_index: envelope.payload.chunk_index,
            },
          },
        };
      }
      return {
        data: {
          response: {
            status: 'published',
            transfer_id: 'xfer-1',
            course_id: 'cb-1',
            source_course_id: '42',
            lessons_created: 1,
            lessons_expected: 1,
            content_fingerprint: VALID_FINGERPRINT,
          },
        },
      };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    const result = await sendChunkedTrainerPublish(sampleCourseData(1), {
      publisherTrainerId: PUBLISHER_ID,
    });
    expect(result.status).toBe('published');
    expect(chunkHits).toBeGreaterThanOrEqual(2);
  });

  it('rejects FINALIZE without valid content_fingerprint', async () => {
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      if (envelope.payload.action === ACTION_INIT) {
        return {
          data: {
            response: {
              status: 'initialized',
              transfer_id: 'xfer-1',
              routing_ticket: 't',
              expires_at: '2099-01-01T00:00:00.000Z',
            },
          },
        };
      }
      if (envelope.payload.action === ACTION_CHUNK) {
        return {
          data: {
            response: {
              status: 'chunk_received',
              transfer_id: 'xfer-1',
              chunk_index: envelope.payload.chunk_index,
            },
          },
        };
      }
      return {
        data: {
          response: {
            status: 'published',
            transfer_id: 'xfer-1',
            course_id: 'cb-1',
            source_course_id: '42',
            lessons_created: 1,
            lessons_expected: 1,
            content_fingerprint: 'short',
          },
        },
      };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendChunkedTrainerPublish } = await import(
      '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js'
    );

    await expect(
      sendChunkedTrainerPublish(sampleCourseData(1), { publisherTrainerId: PUBLISHER_ID })
    ).rejects.toMatchObject({ code: 'COURSE_PUBLISH_FINALIZE_FAILED' });
  });
});

describe('Full AI Generation isolation', () => {
  it('does not import fillCourseBuilderService from chunked publish module', async () => {
    const src = await import('fs').then((fs) =>
      fs.promises.readFile(
        new URL(
          '../../../../src/infrastructure/courseBuilderClient/chunkedTrainerPublish.js',
          import.meta.url
        ),
        'utf8'
      )
    );
    expect(src).not.toMatch(/fillCourseBuilderService/);
    expect(src).not.toMatch(/fill-course-builder/i);
  });

  it('classifier module does not touch Full AI fillers', async () => {
    const src = await import('fs').then((fs) =>
      fs.promises.readFile(
        new URL(
          '../../../../src/infrastructure/courseBuilderClient/classifyTrainerPublishError.js',
          import.meta.url
        ),
        'utf8'
      )
    );
    expect(src).not.toMatch(/fillCourseBuilderService/);
    expect(src).not.toMatch(/coordinatorClient/);
  });
});
