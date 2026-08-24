import {
  CS_GENERATION_ACTIONS,
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_LEASE_MS,
  UNAVAILABLE_ERROR,
  getCsGenerationAction,
  getParentCourseBuilderJobId,
  isPersonalizedAsyncJobsEnabled,
  prepareExecutionEnvelope,
  shouldStartPersonalizedGenerationWorker,
  toSafeErrorText,
} from '../../../../src/infrastructure/jobs/personalizedAsyncJobs.js';

describe('personalized async jobs helpers', () => {
  const originalFlag = process.env.PERSONALIZED_ASYNC_JOBS_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.PERSONALIZED_ASYNC_JOBS_ENABLED;
    } else {
      process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = originalFlag;
    }
  });

  it('treats absent/null/empty action as legacy sync', () => {
    expect(getCsGenerationAction({})).toBeNull();
    expect(getCsGenerationAction({ cs_generation_action: null })).toBeNull();
    expect(getCsGenerationAction({ cs_generation_action: '' })).toBeNull();
    expect(getCsGenerationAction({ cs_generation_action: '   ' })).toBeNull();
  });

  it('reads start/status/result actions', () => {
    expect(getCsGenerationAction({ cs_generation_action: CS_GENERATION_ACTIONS.START }))
      .toBe(CS_GENERATION_ACTIONS.START);
    expect(getCsGenerationAction({ cs_generation_action: ` ${CS_GENERATION_ACTIONS.STATUS} ` }))
      .toBe(CS_GENERATION_ACTIONS.STATUS);
  });

  it('requires a non-empty parent job id string', () => {
    expect(getParentCourseBuilderJobId({})).toBeNull();
    expect(getParentCourseBuilderJobId({ parent_course_builder_job_id: 123 })).toBeNull();
    expect(getParentCourseBuilderJobId({ parent_course_builder_job_id: '  ' })).toBeNull();
    expect(getParentCourseBuilderJobId({ parent_course_builder_job_id: 'cb-job-1' }))
      .toBe('cb-job-1');
  });

  it('enables the feature flag only for the string true', () => {
    delete process.env.PERSONALIZED_ASYNC_JOBS_ENABLED;
    expect(isPersonalizedAsyncJobsEnabled()).toBe(false);
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'false';
    expect(isPersonalizedAsyncJobsEnabled()).toBe(false);
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    expect(isPersonalizedAsyncJobsEnabled()).toBe(true);
  });

  it('does not start the worker when the flag is off', () => {
    expect(shouldStartPersonalizedGenerationWorker({
      env: { NODE_ENV: 'production', PERSONALIZED_ASYNC_JOBS_ENABLED: 'false' },
      dbConnected: true,
    })).toBe(false);
  });

  it('starts the worker when the flag is on and DB is ready outside test', () => {
    expect(shouldStartPersonalizedGenerationWorker({
      env: { NODE_ENV: 'production', PERSONALIZED_ASYNC_JOBS_ENABLED: 'true' },
      dbConnected: true,
    })).toBe(true);
  });

  it('does not start the worker in the test environment', () => {
    expect(shouldStartPersonalizedGenerationWorker({
      env: { NODE_ENV: 'test', PERSONALIZED_ASYNC_JOBS_ENABLED: 'true' },
      dbConnected: true,
    })).toBe(false);
    expect(shouldStartPersonalizedGenerationWorker({
      env: { NODE_ENV: 'production', JEST_WORKER_ID: '1', PERSONALIZED_ASYNC_JOBS_ENABLED: 'true' },
      dbConnected: true,
    })).toBe(false);
  });

  it('does not start the worker when DB is not connected', () => {
    expect(shouldStartPersonalizedGenerationWorker({
      env: { NODE_ENV: 'production', PERSONALIZED_ASYNC_JOBS_ENABLED: 'true' },
      dbConnected: false,
    })).toBe(false);
  });

  it('strips only async transport fields from an execution clone', () => {
    const saved = {
      requester_service: 'course-builder-service',
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.START,
        parent_course_builder_job_id: 'cb-1',
        company_id: 'co-1',
        learning_path: { path_title: 'Path' },
      },
      response: {},
    };
    const execution = prepareExecutionEnvelope(saved);
    expect(execution.payload.cs_generation_action).toBeUndefined();
    expect(execution.payload.parent_course_builder_job_id).toBeUndefined();
    expect(execution.payload.company_id).toBe('co-1');
    expect(execution.payload.learning_path).toEqual({ path_title: 'Path' });
    expect(saved.payload.cs_generation_action).toBe(CS_GENERATION_ACTIONS.START);
    expect(saved.payload.parent_course_builder_job_id).toBe('cb-1');
  });

  it('sanitizes unexpected errors without stacks', () => {
    const error = new Error('boom\n  at secret');
    error.stack = 'Error: boom\n    at /app/secret.js:1:1';
    expect(toSafeErrorText(error)).toBe('boom at secret');
    expect(toSafeErrorText(error)).not.toContain('/app/secret.js');
  });

  it('uses a 10 minute lease and 2–3 minute heartbeat', () => {
    expect(DEFAULT_LEASE_MS).toBe(10 * 60 * 1000);
    expect(DEFAULT_HEARTBEAT_MS).toBe(2.5 * 60 * 1000);
    expect(UNAVAILABLE_ERROR).toBe('personalized_async_jobs_unavailable');
  });

  it('does not reuse ENABLE_BACKGROUND_JOBS', async () => {
    const { readFileSync } = await import('fs');
    const { dirname, join } = await import('path');
    const { fileURLToPath } = await import('url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = [
      join(dir, '../../../../src/infrastructure/jobs/personalizedAsyncJobs.js'),
      join(dir, '../../../../src/infrastructure/jobs/personalizedGenerationJobRepository.js'),
      join(dir, '../../../../src/infrastructure/jobs/PersonalizedGenerationWorker.js'),
      join(dir, '../../../../src/application/services/personalizedGenerationJobService.js'),
    ];
    for (const file of files) {
      expect(readFileSync(file, 'utf8')).not.toContain('ENABLE_BACKGROUND_JOBS');
    }
  });
});
