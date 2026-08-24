import { jest } from '@jest/globals';
import {
  PersonalizedGenerationWorker,
  startPersonalizedGenerationWorkerIfEnabled,
  stopPersonalizedGenerationWorker,
  getPersonalizedGenerationWorker,
} from '../../../../src/infrastructure/jobs/PersonalizedGenerationWorker.js';
import { JOB_STATUS } from '../../../../src/infrastructure/jobs/personalizedAsyncJobs.js';
import { CLAIM_JOB_SELECT_SQL } from '../../../../src/infrastructure/jobs/personalizedGenerationJobRepository.js';

describe('PersonalizedGenerationWorker', () => {
  afterEach(() => {
    stopPersonalizedGenerationWorker();
  });

  it('does not start when the flag is off', () => {
    const worker = startPersonalizedGenerationWorkerIfEnabled({
      env: { NODE_ENV: 'production', PERSONALIZED_ASYNC_JOBS_ENABLED: 'false' },
      dbConnected: true,
    });
    expect(worker).toBeNull();
    expect(getPersonalizedGenerationWorker()).toBeNull();
  });

  it('starts when the flag is on and DB is ready', () => {
    const fake = {
      isRunning: true,
      start: jest.fn(),
      stop: jest.fn(),
    };
    const worker = startPersonalizedGenerationWorkerIfEnabled({
      env: { NODE_ENV: 'production', PERSONALIZED_ASYNC_JOBS_ENABLED: 'true' },
      dbConnected: true,
      createWorker: () => fake,
    });
    expect(worker).toBe(fake);
    expect(fake.start).toHaveBeenCalled();
    expect(getPersonalizedGenerationWorker()).toBe(fake);
  });

  it('does not start in the test environment even if the flag is on', () => {
    const worker = startPersonalizedGenerationWorkerIfEnabled({
      env: { NODE_ENV: 'test', PERSONALIZED_ASYNC_JOBS_ENABLED: 'true' },
      dbConnected: true,
      createWorker: () => ({ start: jest.fn(), stop: jest.fn(), isRunning: true }),
    });
    expect(worker).toBeNull();
  });

  it('claims then executes fill outside the claim transaction', async () => {
    const claimed = {
      job_id: 3,
      attempt_count: 1,
      parent_course_builder_job_id: 'cb-1',
      status: JOB_STATUS.PROCESSING,
      request_payload: {
        requester_service: 'course-builder-service',
        payload: {
          cs_generation_action: 'start_personalized_generation',
          parent_course_builder_job_id: 'cb-1',
          company_id: 'co-1',
        },
        response: {},
      },
    };
    const legacyResult = {
      requester_service: 'course-builder-service',
      payload: { company_id: 'co-1' },
      response: { course: [{ course_id: 1 }] },
    };
    const repository = {
      claimRunnableJob: jest.fn().mockResolvedValue(claimed),
      heartbeat: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn().mockResolvedValue({
        updated: true,
        job: { ...claimed, status: JOB_STATUS.COMPLETED },
      }),
      markFailed: jest.fn(),
    };
    const fillCourseBuilderServiceFn = jest.fn().mockResolvedValue(legacyResult);
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn,
      setIntervalFn: () => 1,
      clearIntervalFn: jest.fn(),
    });
    worker.claimingEnabled = true;
    await worker.processOne();

    expect(repository.claimRunnableJob).toHaveBeenCalled();
    expect(fillCourseBuilderServiceFn).toHaveBeenCalledWith({
      requester_service: 'course-builder-service',
      payload: { company_id: 'co-1' },
      response: {},
    });
    expect(repository.markCompleted).toHaveBeenCalledWith(3, 1, legacyResult);
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('marks completed when fill returns response.course = []', async () => {
    const repository = {
      claimRunnableJob: jest.fn().mockResolvedValue({
        job_id: 4,
        attempt_count: 1,
        parent_course_builder_job_id: 'cb-1',
        request_payload: { payload: {}, response: {} },
      }),
      heartbeat: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn().mockResolvedValue({ updated: true, job: { job_id: 4 } }),
      markFailed: jest.fn(),
    };
    const emptyResult = { requester_service: 'course-builder-service', payload: {}, response: { course: [] } };
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn: jest.fn().mockResolvedValue(emptyResult),
      setIntervalFn: () => 1,
      clearIntervalFn: jest.fn(),
    });
    worker.claimingEnabled = true;
    await worker.processOne();
    expect(repository.markCompleted).toHaveBeenCalledWith(4, 1, emptyResult);
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('marks failed on unexpected throw and clears heartbeat', async () => {
    const clearIntervalFn = jest.fn();
    const repository = {
      claimRunnableJob: jest.fn().mockResolvedValue({
        job_id: 5,
        attempt_count: 1,
        parent_course_builder_job_id: 'cb-1',
        request_payload: { payload: {}, response: {} },
      }),
      heartbeat: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn(),
      markFailed: jest.fn().mockResolvedValue({ updated: true, job: { job_id: 5 } }),
    };
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn: jest.fn().mockRejectedValue(new Error('provider exploded')),
      setIntervalFn: () => 99,
      clearIntervalFn,
    });
    worker.claimingEnabled = true;
    await worker.processOne();
    expect(repository.markFailed).toHaveBeenCalledWith(5, 1, 'provider exploded');
    expect(repository.markCompleted).not.toHaveBeenCalled();
    expect(clearIntervalFn).toHaveBeenCalled();
    expect(worker.heartbeatTimer).toBeNull();
  });

  it('cleans heartbeat timers after success', async () => {
    const clearIntervalFn = jest.fn();
    const worker = new PersonalizedGenerationWorker({
      repository: {
        claimRunnableJob: jest.fn().mockResolvedValue({
          job_id: 6,
          attempt_count: 1,
          request_payload: { payload: {}, response: {} },
        }),
        heartbeat: jest.fn().mockResolvedValue(true),
        markCompleted: jest.fn().mockResolvedValue({ updated: true, job: { job_id: 6 } }),
        markFailed: jest.fn(),
      },
      fillCourseBuilderServiceFn: jest.fn().mockResolvedValue({ response: { course: [{ course_id: 1 }] } }),
      setIntervalFn: () => 42,
      clearIntervalFn,
    });
    worker.claimingEnabled = true;
    await worker.processOne();
    expect(clearIntervalFn).toHaveBeenCalledWith(42);
    expect(worker.heartbeatTimer).toBeNull();
  });

  it('does not claim a second job while one is executing', async () => {
    let releaseFill;
    const fillPromise = new Promise((resolve) => {
      releaseFill = resolve;
    });
    const repository = {
      claimRunnableJob: jest.fn().mockResolvedValue({
        job_id: 8,
        attempt_count: 1,
        request_payload: { payload: {}, response: {} },
      }),
      heartbeat: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn().mockResolvedValue({ updated: true, job: { job_id: 8 } }),
      markFailed: jest.fn(),
    };
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn: jest.fn(() => fillPromise),
      setIntervalFn: () => 1,
      clearIntervalFn: jest.fn(),
    });
    worker.claimingEnabled = true;
    const first = worker.processOne();
    await Promise.resolve();
    const second = await worker.processOne();
    expect(second).toBeNull();
    expect(repository.claimRunnableJob).toHaveBeenCalledTimes(1);
    releaseFill({ response: { course: [] } });
    await first;
  });

  it('acquires the executing guard before claiming so overlapping ticks cannot claim', async () => {
    let releaseClaim;
    const claimPromise = new Promise((resolve) => {
      releaseClaim = resolve;
    });
    const repository = {
      claimRunnableJob: jest.fn(() => claimPromise),
      heartbeat: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn: jest.fn(),
      setIntervalFn: () => 1,
      clearIntervalFn: jest.fn(),
    });
    worker.claimingEnabled = true;
    const first = worker.processOne();
    await Promise.resolve();
    expect(worker.executing).toBe(true);
    expect(repository.claimRunnableJob).toHaveBeenCalledTimes(1);
    const second = await worker.processOne();
    expect(second).toBeNull();
    expect(repository.claimRunnableJob).toHaveBeenCalledTimes(1);
    releaseClaim(null);
    await first;
    expect(worker.executing).toBe(false);
  });

  it('stop() prevents new claims', async () => {
    const repository = { claimRunnableJob: jest.fn() };
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn: jest.fn(),
      setIntervalFn: () => 1,
      clearIntervalFn: jest.fn(),
    });
    worker.start();
    worker.stop();
    await worker.processOne();
    expect(repository.claimRunnableJob).not.toHaveBeenCalled();
  });

  it('documents SKIP LOCKED as the claim contract', () => {
    expect(CLAIM_JOB_SELECT_SQL).toMatch(/FOR UPDATE SKIP LOCKED/);
  });

  it('heartbeat extends the lease while generation is active', async () => {
    const heartbeatFns = [];
    const repository = {
      claimRunnableJob: jest.fn().mockResolvedValue({
        job_id: 9,
        attempt_count: 2,
        parent_course_builder_job_id: 'cb-1',
        request_payload: { payload: { company_id: 'co-1' }, response: {} },
      }),
      heartbeat: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn().mockResolvedValue({ updated: true, job: { job_id: 9 } }),
      markFailed: jest.fn(),
    };
    let releaseFill;
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn: jest.fn(() => new Promise((resolve) => {
        releaseFill = resolve;
      })),
      setIntervalFn: (fn) => {
        heartbeatFns.push(fn);
        return heartbeatFns.length;
      },
      clearIntervalFn: jest.fn(),
      leaseMs: 600000,
    });
    worker.claimingEnabled = true;
    const running = worker.processOne();
    for (let i = 0; i < 20 && heartbeatFns.length === 0; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(heartbeatFns.length).toBeGreaterThan(0);
    await heartbeatFns[0]();
    expect(repository.heartbeat).toHaveBeenCalledWith(9, 2, expect.objectContaining({ leaseMs: 600000 }));
    releaseFill({ response: { course: [] } });
    await running;
  });

  it('discards fill result after stale reclaim ownership loss', async () => {
    const heartbeatFns = [];
    const clearIntervalFn = jest.fn();
    const repository = {
      claimRunnableJob: jest.fn().mockResolvedValue({
        job_id: 123,
        attempt_count: 1,
        parent_course_builder_job_id: 'cb-1',
        request_payload: { payload: {}, response: {} },
      }),
      heartbeat: jest.fn().mockResolvedValue(false),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };
    let releaseFill;
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn: jest.fn(() => new Promise((resolve) => {
        releaseFill = resolve;
      })),
      setIntervalFn: (fn) => {
        heartbeatFns.push(fn);
        return heartbeatFns.length;
      },
      clearIntervalFn,
      leaseMs: 600000,
    });
    worker.claimingEnabled = true;
    const running = worker.processOne();
    for (let i = 0; i < 20 && heartbeatFns.length === 0; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    await heartbeatFns[0]();
    expect(repository.heartbeat).toHaveBeenCalledWith(123, 1, expect.any(Object));
    releaseFill({ response: { course: [{ course_id: 99 }] } });
    await running;
    expect(repository.markCompleted).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('treats a fenced markCompleted miss as ownership loss, not failure', async () => {
    const repository = {
      claimRunnableJob: jest.fn().mockResolvedValue({
        job_id: 123,
        attempt_count: 1,
        parent_course_builder_job_id: 'cb-1',
        request_payload: { payload: {}, response: {} },
      }),
      heartbeat: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn().mockResolvedValue({ updated: false, job: null }),
      markFailed: jest.fn(),
    };
    const worker = new PersonalizedGenerationWorker({
      repository,
      fillCourseBuilderServiceFn: jest.fn().mockResolvedValue({ response: { course: [] } }),
      setIntervalFn: () => 1,
      clearIntervalFn: jest.fn(),
    });
    worker.claimingEnabled = true;
    await worker.processOne();
    expect(repository.markCompleted).toHaveBeenCalledWith(123, 1, { response: { course: [] } });
    expect(repository.markFailed).not.toHaveBeenCalled();
  });
});
