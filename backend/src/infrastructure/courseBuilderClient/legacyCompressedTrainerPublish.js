import { logger } from '../logging/Logger.js';
import { postToCoordinator } from '../coordinatorClient/coordinatorClient.js';
import { sanitizePublishEnvelopeForCoordinator } from './sanitizePublishEnvelopeForCoordinator.js';
import {
  COURSE_ENCODING_GZIP_BASE64,
  assertPublishEnvelopeWithinCourseBuilderLimit,
  buildTrainerCoursePayloadForCompression,
  compressTrainerCoursePayload,
} from './compressTrainerPublishCourse.js';

/**
 * Pre–Phase 5 Trainer Publish: single gzip+base64 course_compressed envelope
 * via Coordinator. Unchanged contract for flag-OFF production safety.
 *
 * @param {Object} courseData
 * @returns {Promise<void>}
 */
export async function sendLegacyCompressedTrainerPublish(courseData) {
  if (!courseData || typeof courseData !== 'object') {
    logger.warn('[LegacyTrainerPublish] Invalid courseData, skipping course publish', {
      courseDataType: typeof courseData,
    });
    return;
  }

  const coursePayload = buildTrainerCoursePayloadForCompression(courseData);
  const courseCompressed = compressTrainerCoursePayload(coursePayload);

  const envelope = {
    requester_service: 'content-studio',
    payload: {
      action: 'send this trainer course to publish',
      description: 'Send course to Course Builder for publishing',
      targetService: 'course-builder-service',
      course_encoding: COURSE_ENCODING_GZIP_BASE64,
      course_compressed: courseCompressed,
    },
    response: {
      answer: '',
    },
  };

  const envelopeClone = JSON.parse(JSON.stringify(envelope));
  const envelopeToSign = sanitizePublishEnvelopeForCoordinator(envelopeClone);
  assertPublishEnvelopeWithinCourseBuilderLimit(envelopeToSign);

  await postToCoordinator(envelopeToSign, {
    endpoint: '/api/fill-content-metrics',
    timeout: 1200000,
  });

  logger.info('[LegacyTrainerPublish] Course sent to Course Builder successfully', {
    courseId: courseData.course_id,
    courseEncoding: COURSE_ENCODING_GZIP_BASE64,
  });
}
