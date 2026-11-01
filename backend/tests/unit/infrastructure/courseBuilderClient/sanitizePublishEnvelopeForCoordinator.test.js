import { createPrivateKey, generateKeyPairSync } from 'crypto';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { sanitizePublishEnvelopeForCoordinator } from '../../../../src/infrastructure/courseBuilderClient/sanitizePublishEnvelopeForCoordinator.js';
import { generateSignature, verifySignature } from '../../../../src/utils/signature.js';

function buildSyntheticPublishEnvelope() {
  return {
    requester_service: 'content-studio',
    payload: {
      action: 'send this trainer course to publish',
      description: 'Send course to Course Builder for publishing',
      targetService: 'course-builder-service',
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
      ],
    },
    response: { answer: '' },
  };
}

function generateTestKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  // Ensure PEM is usable with generateSignature
  createPrivateKey(privateKey);
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

describe('sanitizePublishEnvelopeForCoordinator (trainer publish)', () => {
  it('strips control characters from string values and keys like Coordinator sanitizeInput', () => {
    const input = {
      'key\nname': 'value\twith\ncontrols',
      nested: { a: 'x\ry' },
      list: ['a\nb', 1, true, null],
      num: 7,
    };
    const out = sanitizePublishEnvelopeForCoordinator(input);
    // Coordinator sanitizeObject maps arrays via sanitizeObject, which returns
    // primitive strings unchanged — only object property string values are stripped.
    expect(Object.keys(out)).toEqual(['keyname', 'nested', 'list', 'num']);
    expect(out.keyname).toBe('valuewithcontrols');
    expect(out.nested.a).toBe('xy');
    expect(out.list[0]).toBe('a\nb');
    expect(out.list[1]).toBe(1);
    expect(out.list[2]).toBe(true);
    expect(out.list[3]).toBe(null);
    expect(out.num).toBe(7);
  });

  it('is idempotent: second sanitization yields the same object', () => {
    const envelope = buildSyntheticPublishEnvelope();
    const once = sanitizePublishEnvelopeForCoordinator(
      JSON.parse(JSON.stringify(envelope))
    );
    const twice = sanitizePublishEnvelopeForCoordinator(
      JSON.parse(JSON.stringify(once))
    );
    expect(twice).toEqual(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('preserves publish envelope field names and nesting; leaves source object untouched', () => {
    const original = buildSyntheticPublishEnvelope();
    const snapshot = JSON.parse(JSON.stringify(original));
    const sanitized = sanitizePublishEnvelopeForCoordinator(
      JSON.parse(JSON.stringify(original))
    );

    expect(original).toEqual(snapshot);
    expect(Object.keys(sanitized)).toEqual(['requester_service', 'payload', 'response']);
    expect(sanitized.payload.action).toBe('send this trainer course to publish');
    expect(sanitized.payload.description).toBe(
      'Send course to Course Builder for publishing'
    );
    expect(sanitized.payload.targetService).toBe('course-builder-service');
    expect(sanitized.payload.topics).toHaveLength(1);
    expect(sanitized.payload.topics[0].format_order).toEqual(['text_audio', 'code']);
    expect(sanitized.payload.topics[0].contents).toHaveLength(2);
    expect(sanitized.payload.topics[0].contents[0].content_type).toBe('text_audio');
    expect(sanitized.payload.topics[0].contents[1].content_type).toBe('code');
    expect(typeof sanitized.payload.topics[0].contents[0].content_data).toBe('object');
    expect(typeof sanitized.payload.topics[0].contents[1].content_data).toBe('object');
    expect(sanitized.response).toEqual({ answer: '' });
  });

  it('removes newlines/tabs from transferred lesson strings (lossy, intentional)', () => {
    const sanitized = sanitizePublishEnvelopeForCoordinator(
      buildSyntheticPublishEnvelope()
    );
    expect(sanitized.payload.course_description).toBe('Line1Line2');
    expect(sanitized.payload.topics[0].contents[0].content_data.text).toBe(
      'HelloWorldTabbed'
    );
    expect(sanitized.payload.topics[0].contents[1].content_data.code).toBe(
      'def f(x):    if x:        return x'
    );
    expect(sanitized.payload.topics[0].devlab_exercises.includes('\n')).toBe(false);
  });

  it('original envelope signature fails after Coordinator-equivalent sanitize; sanitized envelope passes', () => {
    const { privateKeyPem, publicKeyPem } = generateTestKeyPair();
    const serviceName = 'content-studio';
    const original = buildSyntheticPublishEnvelope();

    const signatureOverOriginal = generateSignature(
      serviceName,
      privateKeyPem,
      original
    );
    const afterCoordinatorSanitize = sanitizePublishEnvelopeForCoordinator(
      JSON.parse(JSON.stringify(original))
    );

    expect(
      verifySignature(
        serviceName,
        signatureOverOriginal,
        publicKeyPem,
        afterCoordinatorSanitize
      )
    ).toBe(false);

    const signatureOverSanitized = generateSignature(
      serviceName,
      privateKeyPem,
      afterCoordinatorSanitize
    );
    const secondSanitize = sanitizePublishEnvelopeForCoordinator(
      JSON.parse(JSON.stringify(afterCoordinatorSanitize))
    );
    expect(
      verifySignature(
        serviceName,
        signatureOverSanitized,
        publicKeyPem,
        secondSanitize
      )
    ).toBe(true);
  });
});

describe('sendCourseToCourseBuilder publish isolation', () => {
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

  it('sanitizes each chunked envelope before postToCoordinator and does not mutate courseData', async () => {
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
            lessons_created: 1,
            lessons_expected: 1,
            content_fingerprint: 'a'.repeat(64),
          },
        },
      };
    });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({
        postToCoordinator,
      })
    );
    jest.unstable_mockModule(
      '../../../../src/infrastructure/logging/Logger.js',
      () => ({
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
      })
    );

    const { sendCourseToCourseBuilder } = await import(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js'
    );
    const { gunzipSync } = await import('zlib');

    const courseData = {
      course_id: '42',
      course_name: 'Demo',
      course_description: 'Keep\nMe',
      course_language: 'en',
      trainer_id: 'trainer-1',
      trainer_name: 'trainer-1',
      topics: [
        {
          topic_id: '10',
          topic_name: 'T',
          topic_description: 'D',
          topic_language: 'en',
          template_id: '1',
          format_order: ['code'],
          contents: [
            {
              content_id: '101',
              content_type: 'code',
              content_data: { code: 'a\nb', language: 'python' },
            },
          ],
          devlab_exercises: '{"q":"x\ny"}',
        },
      ],
    };
    const courseSnapshot = JSON.parse(JSON.stringify(courseData));

    await sendCourseToCourseBuilder(courseData, { publisherTrainerId: 'trainer-1' });

    expect(courseData).toEqual(courseSnapshot);
    expect(postToCoordinator.mock.calls.length).toBeGreaterThanOrEqual(3);
    const [envelopeArg, options] = postToCoordinator.mock.calls[0];
    expect(options.endpoint).toBe('/api/fill-content-metrics');
    expect(envelopeArg.requester_service).toBe('content-studio');
    expect(envelopeArg.payload.action).toBe('trainer_publish_init');
    expect(envelopeArg.payload.targetService).toBe('course-builder-service');

    const chunkCalls = postToCoordinator.mock.calls.filter(
      (c) => c[0].payload.action === 'trainer_publish_chunk'
    );
    const rebuilt = Buffer.concat(
      chunkCalls.map((c) => Buffer.from(c[0].payload.chunk_data, 'base64'))
    );
    const recovered = JSON.parse(gunzipSync(rebuilt).toString('utf8'));
    expect(recovered.course_description).toBe('Keep\nMe');
    expect(recovered.topics[0].contents[0].content_data.code).toBe('a\nb');
  });
});
