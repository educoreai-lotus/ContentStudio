import { gzipSync, gunzipSync } from 'zlib';

/** Course Builder inbound body limit for compressed trainer publish (bytes). */
export const COURSE_BUILDER_MAX_INBOUND_BYTES = 100 * 1024;

export const COURSE_ENCODING_GZIP_BASE64 = 'gzip+base64';

/**
 * Map trainer courseData into the canonical publish course object
 * (metadata + topics/contents/devlab) — same field shaping as historically
 * sent inline on the Coordinator payload (excluding routing fields).
 *
 * @param {Object} courseData
 * @returns {Object}
 */
export function buildTrainerCoursePayloadForCompression(courseData) {
  return {
    course_id: courseData.course_id || '',
    course_name: courseData.course_name || '',
    course_description: courseData.course_description || '',
    course_language: courseData.course_language || 'en',
    trainer_id: courseData.trainer_id || '',
    trainer_name: courseData.trainer_name || '',
    topics: Array.isArray(courseData.topics)
      ? courseData.topics.map((topic) => ({
          topic_id: topic.topic_id || '',
          topic_name: topic.topic_name || '',
          topic_description: topic.topic_description || '',
          topic_language: topic.topic_language || 'en',
          template_id: topic.template_id || '',
          format_order: Array.isArray(topic.format_order) ? topic.format_order : [],
          contents: Array.isArray(topic.contents)
            ? topic.contents.map((content) => ({
                content_id: content.content_id || '',
                content_type: content.content_type || '',
                content_data:
                  content.content_data && typeof content.content_data === 'object'
                    ? content.content_data
                    : {},
              }))
            : [],
          devlab_exercises: topic.devlab_exercises
            ? typeof topic.devlab_exercises === 'string'
              ? topic.devlab_exercises
              : JSON.stringify(topic.devlab_exercises)
            : '',
        }))
      : [],
  };
}

/**
 * Lossless gzip + single-line Base64 of the trainer course JSON.
 * Call BEFORE Coordinator-parity sanitization so control characters remain
 * inside the compressed bytes.
 *
 * @param {Object} coursePayload
 * @returns {string} Base64 (no newlines)
 */
export function compressTrainerCoursePayload(coursePayload) {
  const json = JSON.stringify(coursePayload);
  const gzipped = gzipSync(Buffer.from(json, 'utf8'));
  return gzipped.toString('base64');
}

/**
 * Inverse of compressTrainerCoursePayload (tests / local verification).
 * @param {string} base64
 * @returns {Object}
 */
export function decompressTrainerCoursePayload(base64) {
  if (typeof base64 !== 'string' || !base64) {
    throw new Error('course_compressed must be a non-empty Base64 string');
  }
  const json = gunzipSync(Buffer.from(base64, 'base64')).toString('utf8');
  return JSON.parse(json);
}

/**
 * @param {Object} envelope - Final envelope about to be signed/sent
 * @throws {Error} if JSON body would exceed Course Builder inbound limit
 */
export function assertPublishEnvelopeWithinCourseBuilderLimit(envelope) {
  const bytes = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
  if (bytes > COURSE_BUILDER_MAX_INBOUND_BYTES) {
    const err = new Error(
      `Compressed trainer publish envelope exceeds Course Builder 100KB inbound limit (${bytes} bytes > ${COURSE_BUILDER_MAX_INBOUND_BYTES}).`
    );
    err.code = 'COURSE_PUBLISH_PAYLOAD_TOO_LARGE';
    err.byteLength = bytes;
    throw err;
  }
  return bytes;
}
