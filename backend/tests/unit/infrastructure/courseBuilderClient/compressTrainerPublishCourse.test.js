import { generateKeyPairSync } from 'crypto';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  COURSE_BUILDER_MAX_INBOUND_BYTES,
  COURSE_ENCODING_GZIP_BASE64,
  assertPublishEnvelopeWithinCourseBuilderLimit,
  buildTrainerCoursePayloadForCompression,
  compressTrainerCoursePayload,
  decompressTrainerCoursePayload,
} from '../../../../src/infrastructure/courseBuilderClient/compressTrainerPublishCourse.js';
import { sanitizePublishEnvelopeForCoordinator } from '../../../../src/infrastructure/courseBuilderClient/sanitizePublishEnvelopeForCoordinator.js';
import { generateSignature, verifySignature } from '../../../../src/utils/signature.js';

function sampleCourseData() {
  return {
    course_id: '42',
    course_name: 'Demo',
    course_description: 'Line1\nLine2',
    course_language: 'en',
    trainer_id: 'trainer-1',
    trainer_name: 'trainer-1',
    topics: [
      {
        topic_id: '10',
        topic_name: 'Loops',
        topic_description: 'Intro\r\nwith CR',
        topic_language: 'en',
        template_id: '1',
        format_order: ['text_audio', 'code'],
        contents: [
          {
            content_id: '100',
            content_type: 'text_audio',
            content_data: { text: 'Hello\n\nWorld\tTabbed' },
          },
          {
            content_id: '101',
            content_type: 'code',
            content_data: {
              code: 'def f(x):\n    if x:\n        return x\n',
              language: 'python',
            },
          },
        ],
        devlab_exercises: JSON.stringify({
          questions: [{ q: 'Print hi\nnext', starter: 'print("a")\nprint("b")' }],
          html: '<pre>a\nb</pre>',
        }),
      },
      {
        topic_id: '11',
        topic_name: 'Second',
        topic_description: 'd',
        topic_language: 'en',
        template_id: '1',
        format_order: ['presentation'],
        contents: [
          {
            content_id: '200',
            content_type: 'presentation',
            content_data: { fileUrl: 'https://example.invalid/x.pptx' },
          },
        ],
        devlab_exercises: '',
      },
    ],
  };
}

describe('compressTrainerPublishCourse', () => {
  it('gzip+base64 round-trip restores trainer payload without loss', () => {
    const courseData = sampleCourseData();
    const payload = buildTrainerCoursePayloadForCompression(courseData);
    const b64 = compressTrainerCoursePayload(payload);
    expect(b64.includes('\n')).toBe(false);
    expect(b64.includes('\r')).toBe(false);

    const recovered = decompressTrainerCoursePayload(b64);
    expect(recovered).toEqual(payload);
    expect(recovered.topics.map((t) => t.topic_id)).toEqual(['10', '11']);
    expect(recovered.topics[0].format_order).toEqual(['text_audio', 'code']);
    expect(recovered.topics[0].contents[0].content_data.text).toBe('Hello\n\nWorld\tTabbed');
    expect(recovered.topics[0].contents[1].content_data.code).toContain('\n    ');
    expect(recovered.topics[0].devlab_exercises).toBe(payload.topics[0].devlab_exercises);
  });

  it('keeps recoverable content when envelope is Coordinator-sanitized after compression', () => {
    const payload = buildTrainerCoursePayloadForCompression(sampleCourseData());
    const b64 = compressTrainerCoursePayload(payload);
    const envelope = {
      requester_service: 'content-studio',
      payload: {
        action: 'send this trainer course to publish',
        description: 'Send course to Course Builder for publishing',
        targetService: 'course-builder-service',
        course_encoding: COURSE_ENCODING_GZIP_BASE64,
        course_compressed: b64,
      },
      response: { answer: '' },
    };
    const sanitized = sanitizePublishEnvelopeForCoordinator(
      JSON.parse(JSON.stringify(envelope))
    );
    expect(sanitized.payload.course_encoding).toBe('gzip+base64');
    expect(sanitized.payload.course_compressed).toBe(b64);
    expect(decompressTrainerCoursePayload(sanitized.payload.course_compressed)).toEqual(
      payload
    );
  });

  it('signed sanitized compressed envelope verifies after second sanitize', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const payload = buildTrainerCoursePayloadForCompression(sampleCourseData());
    const envelope = sanitizePublishEnvelopeForCoordinator({
      requester_service: 'content-studio',
      payload: {
        action: 'send this trainer course to publish',
        description: 'Send course to Course Builder for publishing',
        targetService: 'course-builder-service',
        course_encoding: COURSE_ENCODING_GZIP_BASE64,
        course_compressed: compressTrainerCoursePayload(payload),
      },
      response: { answer: '' },
    });
    const sig = generateSignature('content-studio', privateKey, envelope);
    const again = sanitizePublishEnvelopeForCoordinator(JSON.parse(JSON.stringify(envelope)));
    expect(verifySignature('content-studio', sig, publicKey, again)).toBe(true);
  });

  it('rejects envelopes over the Course Builder 100KB inbound limit', () => {
    const huge = 'A'.repeat(COURSE_BUILDER_MAX_INBOUND_BYTES);
    const envelope = {
      requester_service: 'content-studio',
      payload: {
        action: 'send this trainer course to publish',
        description: 'Send course to Course Builder for publishing',
        targetService: 'course-builder-service',
        course_encoding: COURSE_ENCODING_GZIP_BASE64,
        course_compressed: huge,
      },
      response: { answer: '' },
    };
    expect(() => assertPublishEnvelopeWithinCourseBuilderLimit(envelope)).toThrow(
      /100KB inbound limit/
    );
    try {
      assertPublishEnvelopeWithinCourseBuilderLimit(envelope);
    } catch (e) {
      expect(e.code).toBe('COURSE_PUBLISH_PAYLOAD_TOO_LARGE');
    }
  });
});

describe('sendCourseToCourseBuilder chunked publish isolation', () => {
  const previousFlag = process.env.CHUNKED_TRAINER_PUBLISH_ENABLED;

  beforeEach(() => {
    jest.resetModules();
    process.env.CHUNKED_TRAINER_PUBLISH_ENABLED = 'true';
  });

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env.CHUNKED_TRAINER_PUBLISH_ENABLED;
    } else {
      process.env.CHUNKED_TRAINER_PUBLISH_ENABLED = previousFlag;
    }
  });

  it('uses INIT/CHUNK/FINALIZE via Coordinator; does not mutate courseData; leaves Full AI filler untouched', async () => {
    const topicCount = sampleCourseData().topics.length;
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      const action = envelope.payload.action;
      if (action === 'trainer_publish_init') {
        return {
          data: {
            response: {
              status: 'initialized',
              transfer_id: 'xfer-1',
              routing_ticket: 'ticket-1',
              expires_at: '2099-01-01T00:00:00.000Z',
            },
          },
        };
      }
      if (action === 'trainer_publish_chunk') {
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
            lessons_created: topicCount,
            lessons_expected: topicCount,
            content_fingerprint: 'a'.repeat(64),
          },
        },
      };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    }));

    const { sendCourseToCourseBuilder } = await import(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js'
    );

    const courseData = sampleCourseData();
    const snapshot = JSON.parse(JSON.stringify(courseData));

    await sendCourseToCourseBuilder(courseData, {
      publisherTrainerId: 'trainer-1',
      organizationId: 'org-1',
    });

    expect(courseData).toEqual(snapshot);
    expect(postToCoordinator.mock.calls.length).toBeGreaterThanOrEqual(3);
    const [envelopeArg, options] = postToCoordinator.mock.calls[0];
    expect(options.endpoint).toBe('/api/fill-content-metrics');
    expect(envelopeArg.requester_service).toBe('content-studio');
    expect(envelopeArg.payload.action).toBe('trainer_publish_init');
    expect(envelopeArg.payload.targetService).toBe('course-builder-service');
    expect(envelopeArg.payload.publisher_trainer_id).toBe('trainer-1');
    expect(envelopeArg.payload.topics).toBeUndefined();
    expect(envelopeArg.payload.course_compressed).toBeUndefined();

    await expect(
      import('../../../../src/application/services/fillers/fillCourseBuilderService.js')
    ).resolves.toBeDefined();
  });

  it('rejects publish without authenticated publisher context when chunked is enabled', async () => {
    const postToCoordinator = jest.fn();
    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    }));

    const { sendCourseToCourseBuilder } = await import(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js'
    );

    await expect(sendCourseToCourseBuilder(sampleCourseData())).rejects.toMatchObject({
      code: 'COURSE_PUBLISH_AUTH_REQUIRED',
    });
    expect(postToCoordinator).not.toHaveBeenCalled();
  });
});
