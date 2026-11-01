import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { isChunkedTrainerPublishEnabled } from '../../../../src/infrastructure/courseBuilderClient/trainerPublishFeatureFlag.js';

describe('isChunkedTrainerPublishEnabled', () => {
  it('defaults OFF when missing', () => {
    expect(isChunkedTrainerPublishEnabled({})).toBe(false);
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: undefined })).toBe(
      false
    );
  });

  it('is OFF for false-like values', () => {
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: 'false' })).toBe(
      false
    );
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: '0' })).toBe(false);
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: '' })).toBe(false);
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: 'no' })).toBe(false);
  });

  it('is ON only for explicit true-like values', () => {
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: 'true' })).toBe(true);
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: 'TRUE' })).toBe(true);
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: '1' })).toBe(true);
    expect(isChunkedTrainerPublishEnabled({ CHUNKED_TRAINER_PUBLISH_ENABLED: ' yes ' })).toBe(true);
  });
});

describe('sendCourseToCourseBuilder feature flag routing', () => {
  const originalEnv = process.env.CHUNKED_TRAINER_PUBLISH_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CHUNKED_TRAINER_PUBLISH_ENABLED;
    } else {
      process.env.CHUNKED_TRAINER_PUBLISH_ENABLED = originalEnv;
    }
  });

  beforeEach(() => {
    jest.resetModules();
  });

  function sampleCourse() {
    return {
      course_id: '42',
      course_name: 'Demo',
      course_description: 'D',
      course_language: 'en',
      trainer_id: 't1',
      trainer_name: 't1',
      topics: [
        {
          topic_id: '1',
          topic_name: 'L',
          topic_description: '',
          topic_language: 'en',
          template_id: '1',
          format_order: ['code'],
          contents: [{ content_id: '1', content_type: 'code', content_data: { code: 'x' } }],
          devlab_exercises: '{"questions":[{"q":"a"}]}',
        },
      ],
    };
  }

  it('flag absent → legacy publish path (course_compressed)', async () => {
    delete process.env.CHUNKED_TRAINER_PUBLISH_ENABLED;
    const postToCoordinator = jest.fn().mockResolvedValue({ data: {}, rawBodyString: '{}' });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendCourseToCourseBuilder } = await import(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js'
    );

    await sendCourseToCourseBuilder(sampleCourse(), {
      publisherTrainerId: '11111111-2222-4333-8444-555555555555',
    });

    expect(postToCoordinator).toHaveBeenCalledTimes(1);
    const payload = postToCoordinator.mock.calls[0][0].payload;
    expect(payload.action).toBe('send this trainer course to publish');
    expect(payload.course_encoding).toBe('gzip+base64');
    expect(typeof payload.course_compressed).toBe('string');
    expect(payload.course_compressed.length).toBeGreaterThan(0);
  });

  it('flag false → legacy publish path', async () => {
    process.env.CHUNKED_TRAINER_PUBLISH_ENABLED = 'false';
    const postToCoordinator = jest.fn().mockResolvedValue({ data: {}, rawBodyString: '{}' });

    jest.unstable_mockModule(
      '../../../../src/infrastructure/coordinatorClient/coordinatorClient.js',
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendCourseToCourseBuilder } = await import(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js'
    );

    await sendCourseToCourseBuilder(sampleCourse());
    expect(postToCoordinator.mock.calls[0][0].payload.action).toBe(
      'send this trainer course to publish'
    );
  });

  it('flag true → chunked INIT protocol', async () => {
    process.env.CHUNKED_TRAINER_PUBLISH_ENABLED = 'true';
    const postToCoordinator = jest.fn().mockImplementation(async (envelope) => {
      const action = envelope.payload.action;
      if (action === 'trainer_publish_init') {
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
      () => ({ postToCoordinator })
    );
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendCourseToCourseBuilder } = await import(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js'
    );

    await sendCourseToCourseBuilder(sampleCourse(), {
      publisherTrainerId: '11111111-2222-4333-8444-555555555555',
    });

    expect(postToCoordinator.mock.calls[0][0].payload.action).toBe('trainer_publish_init');
    expect(
      postToCoordinator.mock.calls.some((c) => c[0].payload.course_compressed)
    ).toBe(false);
  });

  it('chunked failure never falls back to legacy', async () => {
    process.env.CHUNKED_TRAINER_PUBLISH_ENABLED = 'true';
    const postToCoordinator = jest.fn().mockImplementation(async () => {
      const err = new Error('Request failed with status code 502');
      err.response = {
        status: 502,
        data: '{"code":"TRANSFER_HASH_MISMATCH"}',
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

    const { sendCourseToCourseBuilder } = await import(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js'
    );

    await expect(
      sendCourseToCourseBuilder(sampleCourse(), {
        publisherTrainerId: '11111111-2222-4333-8444-555555555555',
      })
    ).rejects.toMatchObject({ code: 'TRANSFER_HASH_MISMATCH' });

    const actions = postToCoordinator.mock.calls.map((c) => c[0].payload.action);
    expect(actions.every((a) => a === 'trainer_publish_init')).toBe(true);
    expect(actions.some((a) => a === 'send this trainer course to publish')).toBe(false);
  });
});
