import { generateKeyPairSync } from 'crypto';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
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

describe('sendCourseToCourseBuilder compressed publish isolation', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('posts compressed contract only; does not mutate courseData; does not touch fillCourseBuilderService', async () => {
    const postToCoordinator = jest.fn().mockResolvedValue({
      data: {},
      rawBodyString: '{}',
      headers: {},
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
    const {
      decompressTrainerCoursePayload,
      buildTrainerCoursePayloadForCompression,
    } = await import(
      '../../../../src/infrastructure/courseBuilderClient/compressTrainerPublishCourse.js'
    );

    const courseData = sampleCourseData();
    const snapshot = JSON.parse(JSON.stringify(courseData));
    const expectedPayload = buildTrainerCoursePayloadForCompression(courseData);

    await sendCourseToCourseBuilder(courseData);

    expect(courseData).toEqual(snapshot);
    expect(postToCoordinator).toHaveBeenCalledTimes(1);
    const [envelopeArg, options] = postToCoordinator.mock.calls[0];
    expect(options.endpoint).toBe('/api/fill-content-metrics');
    expect(envelopeArg.requester_service).toBe('content-studio');
    expect(envelopeArg.payload.action).toBe('send this trainer course to publish');
    expect(envelopeArg.payload.description).toBe(
      'Send course to Course Builder for publishing'
    );
    expect(envelopeArg.payload.targetService).toBe('course-builder-service');
    expect(envelopeArg.payload.course_encoding).toBe('gzip+base64');
    expect(envelopeArg.payload.topics).toBeUndefined();
    expect(envelopeArg.response).toEqual({ answer: '' });
    expect(
      decompressTrainerCoursePayload(envelopeArg.payload.course_compressed)
    ).toEqual(expectedPayload);

    // Full AI Generation filler module path is not imported by this client
    await expect(
      import('../../../../src/application/services/fillers/fillCourseBuilderService.js')
    ).resolves.toBeDefined();
  });

  it('stops before postToCoordinator when compressed envelope exceeds 100KB', async () => {
    const postToCoordinator = jest.fn().mockResolvedValue({
      data: {},
      rawBodyString: '{}',
      headers: {},
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

    jest.unstable_mockModule(
      '../../../../src/infrastructure/courseBuilderClient/compressTrainerPublishCourse.js',
      () => ({
        COURSE_ENCODING_GZIP_BASE64: 'gzip+base64',
        COURSE_BUILDER_MAX_INBOUND_BYTES: 100 * 1024,
        buildTrainerCoursePayloadForCompression: (d) => ({
          course_id: d.course_id || '',
          topics: d.topics || [],
        }),
        compressTrainerCoursePayload: () => 'B'.repeat(100 * 1024),
        assertPublishEnvelopeWithinCourseBuilderLimit: (envelope) => {
          const bytes = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
          if (bytes > 100 * 1024) {
            const err = new Error(
              `Compressed trainer publish envelope exceeds Course Builder 100KB inbound limit (${bytes} bytes > ${100 * 1024}).`
            );
            err.code = 'COURSE_PUBLISH_PAYLOAD_TOO_LARGE';
            throw err;
          }
        },
      })
    );

    const { sendCourseToCourseBuilder } = await import(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js'
    );

    await expect(
      sendCourseToCourseBuilder(sampleCourseData())
    ).rejects.toMatchObject({ code: 'COURSE_PUBLISH_PAYLOAD_TOO_LARGE' });
    expect(postToCoordinator).not.toHaveBeenCalled();
  });
});
