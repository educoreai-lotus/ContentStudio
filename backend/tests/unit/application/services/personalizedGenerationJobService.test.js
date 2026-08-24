import { jest } from '@jest/globals';
import { PersonalizedGenerationJobService } from '../../../../src/application/services/personalizedGenerationJobService.js';
import {
  CS_GENERATION_ACTIONS,
  JOB_STATUS,
  UNAVAILABLE_ERROR,
} from '../../../../src/infrastructure/jobs/personalizedAsyncJobs.js';

function envelope(overrides = {}) {
  return {
    requester_service: 'course-builder-service',
    payload: {
      company_id: 'co-1',
      learning_path: { path_title: 'Path' },
      ...(overrides.payload || {}),
    },
    response: {},
    ...overrides,
  };
}

function jobRow(overrides = {}) {
  return {
    job_id: 7,
    parent_course_builder_job_id: 'cb-parent-1',
    status: JOB_STATUS.PENDING,
    result_payload: null,
    error: null,
    ...overrides,
  };
}

describe('PersonalizedGenerationJobService', () => {
  const originalFlag = process.env.PERSONALIZED_ASYNC_JOBS_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.PERSONALIZED_ASYNC_JOBS_ENABLED;
    } else {
      process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = originalFlag;
    }
  });

  it('invokes fillCourseBuilderService when no async action is present', async () => {
    const legacy = envelope();
    legacy.response = { course: [{ course_id: 1, topics: [] }] };
    const fillCourseBuilderServiceFn = jest.fn().mockResolvedValue(legacy);
    const service = new PersonalizedGenerationJobService({
      fillCourseBuilderServiceFn,
      repository: {},
    });
    const request = envelope();
    const result = await service.executeCourseBuilderServiceRequest(request);
    expect(fillCourseBuilderServiceFn).toHaveBeenCalledTimes(1);
    expect(fillCourseBuilderServiceFn).toHaveBeenCalledWith(request);
    expect(result.response.course).toEqual([{ course_id: 1, topics: [] }]);
    expect(result.response.generation_job).toBeUndefined();
  });

  it('keeps empty-action payloads on the legacy path', async () => {
    const fillCourseBuilderServiceFn = jest.fn().mockResolvedValue(envelope({
      response: { course: [] },
    }));
    const service = new PersonalizedGenerationJobService({ fillCourseBuilderServiceFn, repository: {} });
    await service.executeCourseBuilderServiceRequest(envelope({
      payload: { cs_generation_action: '' },
    }));
    expect(fillCourseBuilderServiceFn).toHaveBeenCalled();
  });

  it('returns unavailable for async actions when the flag is off', async () => {
    delete process.env.PERSONALIZED_ASYNC_JOBS_ENABLED;
    const fillCourseBuilderServiceFn = jest.fn();
    const repository = { createOrGetByParentId: jest.fn() };
    const service = new PersonalizedGenerationJobService({ fillCourseBuilderServiceFn, repository });
    const request = envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.START,
        parent_course_builder_job_id: 'cb-parent-1',
      },
    });
    const result = await service.executeCourseBuilderServiceRequest(request);
    expect(fillCourseBuilderServiceFn).not.toHaveBeenCalled();
    expect(repository.createOrGetByParentId).not.toHaveBeenCalled();
    expect(result.response.error).toBe(UNAVAILABLE_ERROR);
    expect(result.response.generation_job).toBeNull();
    expect(result.response.course).toBeUndefined();
  });

  it('returns unavailable for STATUS and RESULT when the flag is off', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'false';
    const service = new PersonalizedGenerationJobService({
      fillCourseBuilderServiceFn: jest.fn(),
      repository: { getByParentId: jest.fn() },
    });
    const payload = {
      cs_generation_action: CS_GENERATION_ACTIONS.STATUS,
      parent_course_builder_job_id: 'cb-parent-1',
    };
    const status = await service.executeCourseBuilderServiceRequest(envelope({ payload }));
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: { ...payload, cs_generation_action: CS_GENERATION_ACTIONS.RESULT },
    }));
    expect(status.response.error).toBe(UNAVAILABLE_ERROR);
    expect(result.response.error).toBe(UNAVAILABLE_ERROR);
  });

  it('still uses legacy sync when the flag is off and no action is set', async () => {
    delete process.env.PERSONALIZED_ASYNC_JOBS_ENABLED;
    const fillCourseBuilderServiceFn = jest.fn().mockResolvedValue(envelope({
      response: { course: [{ course_id: 9 }] },
    }));
    const service = new PersonalizedGenerationJobService({ fillCourseBuilderServiceFn, repository: {} });
    const result = await service.executeCourseBuilderServiceRequest(envelope());
    expect(fillCourseBuilderServiceFn).toHaveBeenCalled();
    expect(result.response.course[0].course_id).toBe(9);
  });

  it('START creates one job and does not generate', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const fillCourseBuilderServiceFn = jest.fn();
    const repository = {
      createOrGetByParentId: jest.fn().mockResolvedValue(jobRow()),
    };
    const service = new PersonalizedGenerationJobService({ fillCourseBuilderServiceFn, repository });
    const request = envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.START,
        parent_course_builder_job_id: 'cb-parent-1',
        company_id: 'co-1',
      },
    });
    const result = await service.executeCourseBuilderServiceRequest(request);
    expect(fillCourseBuilderServiceFn).not.toHaveBeenCalled();
    expect(repository.createOrGetByParentId).toHaveBeenCalledWith('cb-parent-1', request);
    expect(result.response.generation_job.cs_job_id).toBe(7);
    expect(result.response.generation_job.status).toBe(JOB_STATUS.PENDING);
    expect(result.response.course).toBeUndefined();
  });

  it.each([
    [JOB_STATUS.PENDING],
    [JOB_STATUS.PROCESSING],
    [JOB_STATUS.COMPLETED],
    [JOB_STATUS.FAILED],
  ])('duplicate START while %s returns the same job without regeneration', async (status) => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const fillCourseBuilderServiceFn = jest.fn();
    const repository = {
      createOrGetByParentId: jest.fn().mockResolvedValue(jobRow({ status, error: status === JOB_STATUS.FAILED ? 'x' : null })),
    };
    const service = new PersonalizedGenerationJobService({ fillCourseBuilderServiceFn, repository });
    const first = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.START,
        parent_course_builder_job_id: 'cb-parent-1',
      },
    }));
    const second = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.START,
        parent_course_builder_job_id: 'cb-parent-1',
      },
    }));
    expect(fillCourseBuilderServiceFn).not.toHaveBeenCalled();
    expect(repository.createOrGetByParentId).toHaveBeenCalledTimes(2);
    expect(first.response.generation_job.cs_job_id).toBe(7);
    expect(second.response.generation_job.cs_job_id).toBe(7);
    expect(second.response.generation_job.status).toBe(status);
  });

  it('STATUS returns pending, processing, completed, failed, and unknown', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const repository = {
      getByParentId: jest.fn()
        .mockResolvedValueOnce(jobRow({ status: JOB_STATUS.PENDING }))
        .mockResolvedValueOnce(jobRow({ status: JOB_STATUS.PROCESSING }))
        .mockResolvedValueOnce(jobRow({ status: JOB_STATUS.COMPLETED }))
        .mockResolvedValueOnce(jobRow({ status: JOB_STATUS.FAILED, error: 'nope' }))
        .mockResolvedValueOnce(null),
    };
    const service = new PersonalizedGenerationJobService({ repository, fillCourseBuilderServiceFn: jest.fn() });
    const make = (parent) => envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.STATUS,
        parent_course_builder_job_id: parent,
      },
    });

    expect((await service.executeCourseBuilderServiceRequest(make('a'))).response.generation_job.status)
      .toBe(JOB_STATUS.PENDING);
    expect((await service.executeCourseBuilderServiceRequest(make('b'))).response.generation_job.status)
      .toBe(JOB_STATUS.PROCESSING);
    expect((await service.executeCourseBuilderServiceRequest(make('c'))).response.generation_job.status)
      .toBe(JOB_STATUS.COMPLETED);
    const failed = await service.executeCourseBuilderServiceRequest(make('d'));
    expect(failed.response.generation_job.status).toBe(JOB_STATUS.FAILED);
    expect(failed.response.generation_job.error).toBe('nope');
    const unknown = await service.executeCourseBuilderServiceRequest(make('missing'));
    expect(unknown.response.error).toBe('generation_job_not_found');
    expect(unknown.response.generation_job).toBeNull();
  });

  it('RESULT completed returns the exact stored legacy envelope', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const stored = {
      requester_service: 'course-builder-service',
      payload: { company_id: 'co-1', learning_path: { path_title: 'Path' } },
      response: { course: [{ course_id: 44, topics: [{ topic_name: 'T1', contents: [] }] }] },
    };
    const service = new PersonalizedGenerationJobService({
      fillCourseBuilderServiceFn: jest.fn(),
      repository: {
        getByParentId: jest.fn().mockResolvedValue(jobRow({
          status: JOB_STATUS.COMPLETED,
          result_payload: stored,
        })),
      },
    });
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.RESULT,
        parent_course_builder_job_id: 'cb-parent-1',
      },
    }));
    expect(result).toEqual(stored);
    expect(result.response.course).toEqual(stored.response.course);
  });

  it('RESULT pending/processing does not return a fake course array', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const service = new PersonalizedGenerationJobService({
      fillCourseBuilderServiceFn: jest.fn(),
      repository: {
        getByParentId: jest.fn().mockResolvedValue(jobRow({ status: JOB_STATUS.PROCESSING })),
      },
    });
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.RESULT,
        parent_course_builder_job_id: 'cb-parent-1',
      },
    }));
    expect(result.response.course).toBeUndefined();
    expect(result.response.generation_job.status).toBe(JOB_STATUS.PROCESSING);
  });

  it('RESULT failed returns a business-level failed state', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const service = new PersonalizedGenerationJobService({
      fillCourseBuilderServiceFn: jest.fn(),
      repository: {
        getByParentId: jest.fn().mockResolvedValue(jobRow({
          status: JOB_STATUS.FAILED,
          error: 'unexpected throw',
        })),
      },
    });
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.RESULT,
        parent_course_builder_job_id: 'cb-parent-1',
      },
    }));
    expect(result.response.generation_job.status).toBe(JOB_STATUS.FAILED);
    expect(result.response.generation_job.error).toBe('unexpected throw');
    expect(result.response.course).toBeUndefined();
  });

  it('RESULT unknown returns a business error', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const service = new PersonalizedGenerationJobService({
      fillCourseBuilderServiceFn: jest.fn(),
      repository: { getByParentId: jest.fn().mockResolvedValue(null) },
    });
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.RESULT,
        parent_course_builder_job_id: 'missing',
      },
    }));
    expect(result.response.error).toBe('generation_job_not_found');
    expect(result.response.generation_job).toBeNull();
  });

  it('requires parent_course_builder_job_id for async actions when enabled', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const service = new PersonalizedGenerationJobService({
      fillCourseBuilderServiceFn: jest.fn(),
      repository: { createOrGetByParentId: jest.fn() },
    });
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: { cs_generation_action: CS_GENERATION_ACTIONS.START },
    }));
    expect(result.response.error).toBe('parent_course_builder_job_id is required');
  });

  it('returns a business error when START persistence throws', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const fillCourseBuilderServiceFn = jest.fn();
    const service = new PersonalizedGenerationJobService({
      fillCourseBuilderServiceFn,
      repository: {
        createOrGetByParentId: jest.fn().mockRejectedValue(new Error('relation does not exist')),
      },
    });
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: CS_GENERATION_ACTIONS.START,
        parent_course_builder_job_id: 'cb-parent-1',
      },
    }));
    expect(fillCourseBuilderServiceFn).not.toHaveBeenCalled();
    expect(result.response.error).toBe('generation_job_error');
    expect(result.response.generation_job).toBeNull();
    expect(result.response.course).toBeUndefined();
  });

  it('unknown cs_generation_action does not call fill or create a job when flag is on', async () => {
    process.env.PERSONALIZED_ASYNC_JOBS_ENABLED = 'true';
    const fillCourseBuilderServiceFn = jest.fn();
    const repository = {
      createOrGetByParentId: jest.fn(),
      getByParentId: jest.fn(),
    };
    const service = new PersonalizedGenerationJobService({ fillCourseBuilderServiceFn, repository });
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: 'unknown_or_typo_action',
        parent_course_builder_job_id: 'cb-parent-1',
      },
    }));
    expect(fillCourseBuilderServiceFn).not.toHaveBeenCalled();
    expect(repository.createOrGetByParentId).not.toHaveBeenCalled();
    expect(repository.getByParentId).not.toHaveBeenCalled();
    expect(result.response.error).toBe('unknown_cs_generation_action');
    expect(result.response.generation_job).toBeNull();
    expect(result.response.course).toBeUndefined();
  });

  it('unknown cs_generation_action is unavailable when flag is off and never calls fill', async () => {
    delete process.env.PERSONALIZED_ASYNC_JOBS_ENABLED;
    const fillCourseBuilderServiceFn = jest.fn();
    const repository = { createOrGetByParentId: jest.fn() };
    const service = new PersonalizedGenerationJobService({ fillCourseBuilderServiceFn, repository });
    const result = await service.executeCourseBuilderServiceRequest(envelope({
      payload: {
        cs_generation_action: 'unknown_or_typo_action',
        parent_course_builder_job_id: 'cb-parent-1',
      },
    }));
    expect(fillCourseBuilderServiceFn).not.toHaveBeenCalled();
    expect(repository.createOrGetByParentId).not.toHaveBeenCalled();
    expect(result.response.error).toBe(UNAVAILABLE_ERROR);
    expect(result.response.generation_job).toBeNull();
  });
});
