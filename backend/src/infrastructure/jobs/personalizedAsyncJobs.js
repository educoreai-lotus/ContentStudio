export const CS_GENERATION_ACTIONS = {
  START: 'start_personalized_generation',
  STATUS: 'get_personalized_generation_status',
  RESULT: 'get_personalized_generation_result',
};

export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const UNAVAILABLE_ERROR = 'personalized_async_jobs_unavailable';

/** Lease compatible with 10+ minute generation. */
export const DEFAULT_LEASE_MS = 10 * 60 * 1000;

/** Heartbeat while a claimed job is executing. */
export const DEFAULT_HEARTBEAT_MS = 2.5 * 60 * 1000;

/** Worker poll interval — do not busy-loop. */
export const DEFAULT_POLL_INTERVAL_MS = 5000;

export function isPersonalizedAsyncJobsEnabled(env = process.env) {
  return env.PERSONALIZED_ASYNC_JOBS_ENABLED === 'true';
}

export function shouldStartPersonalizedGenerationWorker({
  env = process.env,
  dbConnected = false,
} = {}) {
  if (env.NODE_ENV === 'test' || env.JEST_WORKER_ID) {
    return false;
  }
  if (!isPersonalizedAsyncJobsEnabled(env)) {
    return false;
  }
  if (!dbConnected) {
    return false;
  }
  return true;
}

export function getCsGenerationAction(payload) {
  const action = payload?.cs_generation_action;
  if (typeof action !== 'string') {
    return null;
  }
  const trimmed = action.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getParentCourseBuilderJobId(payload) {
  const parentId = payload?.parent_course_builder_job_id;
  if (typeof parentId !== 'string') {
    return null;
  }
  const trimmed = parentId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Clone stored envelope and strip async transport-only fields.
 * Does not mutate the original request_payload.
 */
export function prepareExecutionEnvelope(savedEnvelope) {
  const clone = JSON.parse(JSON.stringify(savedEnvelope ?? {}));
  if (clone.payload && typeof clone.payload === 'object' && !Array.isArray(clone.payload)) {
    const nextPayload = { ...clone.payload };
    delete nextPayload.cs_generation_action;
    delete nextPayload.parent_course_builder_job_id;
    clone.payload = nextPayload;
  }
  return clone;
}

export function toSafeErrorText(error) {
  const message = error && typeof error.message === 'string' && error.message.trim()
    ? error.message
    : 'Generation failed';
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}
