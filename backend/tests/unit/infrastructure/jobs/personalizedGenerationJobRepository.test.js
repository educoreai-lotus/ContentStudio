import { jest } from '@jest/globals';
import {
  CLAIM_JOB_SELECT_SQL,
  PersonalizedGenerationJobRepository,
} from '../../../../src/infrastructure/jobs/personalizedGenerationJobRepository.js';
import { JOB_STATUS } from '../../../../src/infrastructure/jobs/personalizedAsyncJobs.js';

function jobRow(overrides = {}) {
  return {
    job_id: 10,
    parent_course_builder_job_id: 'cb-1',
    status: JOB_STATUS.PENDING,
    request_payload: { requester_service: 'course-builder-service', payload: {}, response: {} },
    result_payload: null,
    error: null,
    attempt_count: 0,
    locked_at: null,
    lease_expires_at: null,
    created_at: new Date(),
    started_at: null,
    completed_at: null,
    updated_at: new Date(),
    ...overrides,
  };
}

describe('PersonalizedGenerationJobRepository', () => {
  it('uses FOR UPDATE SKIP LOCKED when claiming', () => {
    expect(CLAIM_JOB_SELECT_SQL).toContain('FOR UPDATE SKIP LOCKED');
    expect(CLAIM_JOB_SELECT_SQL).toContain("status = 'pending'");
    expect(CLAIM_JOB_SELECT_SQL).toContain("status = 'processing'");
    expect(CLAIM_JOB_SELECT_SQL).toContain('lease_expires_at < CURRENT_TIMESTAMP');
    expect(CLAIM_JOB_SELECT_SQL).toContain('ORDER BY created_at ASC');
    expect(CLAIM_JOB_SELECT_SQL).toContain('LIMIT 1');
  });

  it('creates a job on first insert', async () => {
    const row = jobRow();
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [row] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const created = await repo.createOrGetByParentId('cb-1', { payload: { a: 1 } });
    expect(created.job_id).toBe(10);
    expect(database.query.mock.calls[0][0]).toContain('ON CONFLICT (parent_course_builder_job_id) DO NOTHING');
  });

  it('returns the existing row when insert conflicts', async () => {
    const existing = jobRow({ status: JOB_STATUS.PROCESSING, attempt_count: 1 });
    const database = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [existing] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const job = await repo.createOrGetByParentId('cb-1', { payload: {} });
    expect(job.status).toBe(JOB_STATUS.PROCESSING);
    expect(job.job_id).toBe(10);
    expect(database.query).toHaveBeenCalledTimes(2);
  });

  it('claims a pending job in a short transaction and increments attempt_count', async () => {
    const claimed = jobRow({ status: JOB_STATUS.PROCESSING, attempt_count: 1 });
    const queries = [];
    const client = {
      query: jest.fn(async (sql) => {
        queries.push(sql);
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (sql === CLAIM_JOB_SELECT_SQL) {
          return { rows: [{ job_id: 10 }] };
        }
        return { rows: [claimed] };
      }),
      release: jest.fn(),
    };
    const database = { getClient: jest.fn().mockResolvedValue(client) };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const job = await repo.claimRunnableJob({ leaseMs: 600000 });

    expect(queries[0]).toBe('BEGIN');
    expect(queries[1]).toBe(CLAIM_JOB_SELECT_SQL);
    expect(queries[2]).toContain('attempt_count = attempt_count + 1');
    expect(queries[2]).toContain('status = $2');
    expect(queries[3]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(job.status).toBe(JOB_STATUS.PROCESSING);
    expect(job.attempt_count).toBe(1);
  });

  it('does not update when no runnable job is selected', async () => {
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === CLAIM_JOB_SELECT_SQL) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    const repo = new PersonalizedGenerationJobRepository({
      database: { getClient: jest.fn().mockResolvedValue(client) },
    });
    const job = await repo.claimRunnableJob();
    expect(job).toBeNull();
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('SET status'))).toBe(false);
  });

  it('extends the lease only for the owning processing claim', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ job_id: 10 }] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const updated = await repo.heartbeat(10, 1);
    expect(updated).toBe(true);
    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toContain('AND status = $3');
    expect(sql).toContain('AND attempt_count = $4');
    expect(sql).toContain('AND lease_expires_at > CURRENT_TIMESTAMP');
    expect(params[2]).toBe(JOB_STATUS.PROCESSING);
    expect(params[3]).toBe(1);
  });

  it('heartbeat fence rejects a stale attempt_count', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const updated = await repo.heartbeat(123, 1);
    expect(updated).toBe(false);
    expect(database.query.mock.calls[0][1][3]).toBe(1);
  });

  it('marks completed with stored result and clears the lease when fence matches', async () => {
    const resultPayload = { requester_service: 'course-builder-service', response: { course: [{ course_id: 1 }] } };
    const database = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [jobRow({ status: JOB_STATUS.COMPLETED, result_payload: resultPayload, attempt_count: 1 })],
      }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const write = await repo.markCompleted(10, 1, resultPayload);
    expect(write.updated).toBe(true);
    expect(database.query.mock.calls[0][0]).toContain('locked_at = NULL');
    expect(database.query.mock.calls[0][0]).toContain('lease_expires_at = NULL');
    expect(database.query.mock.calls[0][0]).toContain('AND attempt_count = $5');
    expect(database.query.mock.calls[0][0]).toContain('AND lease_expires_at > CURRENT_TIMESTAMP');
    expect(database.query.mock.calls[0][1][1]).toBe(JOB_STATUS.COMPLETED);
    expect(database.query.mock.calls[0][1][3]).toBe(JOB_STATUS.PROCESSING);
    expect(database.query.mock.calls[0][1][4]).toBe(1);
  });

  it('completion fence rejects a stale attempt_count', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const write = await repo.markCompleted(123, 1, { response: { course: [] } });
    expect(write.updated).toBe(false);
    expect(write.job).toBeNull();
  });

  it('marks failed without changing result_payload contract when fence matches', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [jobRow({ status: JOB_STATUS.FAILED, error: 'Generation failed', attempt_count: 1 })],
      }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const write = await repo.markFailed(10, 1, 'Generation failed');
    expect(write.updated).toBe(true);
    expect(write.job.status).toBe(JOB_STATUS.FAILED);
    expect(database.query.mock.calls[0][0]).not.toContain('completed_at = CURRENT_TIMESTAMP');
    expect(database.query.mock.calls[0][0]).toContain('AND attempt_count = $5');
    expect(database.query.mock.calls[0][0]).toContain('AND status = $4');
    expect(database.query.mock.calls[0][1][3]).toBe(JOB_STATUS.PROCESSING);
    expect(database.query.mock.calls[0][1][4]).toBe(1);
  });

  it('failure fence rejects a stale attempt_count', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const write = await repo.markFailed(123, 1, 'stale');
    expect(write.updated).toBe(false);
    expect(write.job).toBeNull();
  });

  it('does not let markFailed mutate a completed row', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const write = await repo.markFailed(10, 1, 'too late');
    expect(write.updated).toBe(false);
    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toContain('AND status = $4');
    expect(params[3]).toBe(JOB_STATUS.PROCESSING);
  });

  it('does not let markCompleted mutate a failed row', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const write = await repo.markCompleted(10, 1, { response: { course: [{ course_id: 1 }] } });
    expect(write.updated).toBe(false);
    const [sql, params] = database.query.mock.calls[0];
    expect(sql).toContain('AND status = $4');
    expect(params[3]).toBe(JOB_STATUS.PROCESSING);
  });

  it('parses JSONB string payloads from the driver', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [jobRow({
          request_payload: JSON.stringify({ requester_service: 'course-builder-service' }),
          result_payload: JSON.stringify({ response: { course: [] } }),
        })],
      }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const job = await repo.getByParentId('cb-1');
    expect(job.request_payload).toEqual({ requester_service: 'course-builder-service' });
    expect(job.result_payload).toEqual({ response: { course: [] } });
  });

  it('loads a job by CS job id', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [jobRow({ job_id: 22 })] }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const job = await repo.getByJobId(22);
    expect(job.job_id).toBe(22);
    expect(database.query.mock.calls[0][0]).toContain('WHERE job_id = $1');
  });

  it('concurrent create conflict resolves to one row', async () => {
    const existing = jobRow();
    let insertCalls = 0;
    const database = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('INSERT')) {
          insertCalls += 1;
          if (insertCalls === 1) {
            return { rows: [existing] };
          }
          return { rows: [] };
        }
        return { rows: [existing] };
      }),
    };
    const repo = new PersonalizedGenerationJobRepository({ database });
    const [first, second] = await Promise.all([
      repo.createOrGetByParentId('cb-1', { payload: { n: 1 } }),
      repo.createOrGetByParentId('cb-1', { payload: { n: 2 } }),
    ]);
    expect(first.job_id).toBe(10);
    expect(second.job_id).toBe(10);
    expect(insertCalls).toBe(2);
  });

  it('claim SQL reclaims stale processing leases and ignores active/failed/completed jobs', () => {
    expect(CLAIM_JOB_SELECT_SQL).toContain(
      "(status = 'processing' AND lease_expires_at < CURRENT_TIMESTAMP)"
    );
    expect(CLAIM_JOB_SELECT_SQL).not.toMatch(/status = 'failed'/);
    expect(CLAIM_JOB_SELECT_SQL).not.toMatch(/status = 'completed'/);
  });

  it('reclaims a stale processing job and increments attempt_count', async () => {
    const claimed = jobRow({ status: JOB_STATUS.PROCESSING, attempt_count: 2 });
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (sql === CLAIM_JOB_SELECT_SQL) {
          return { rows: [{ job_id: 10 }] };
        }
        return { rows: [claimed] };
      }),
      release: jest.fn(),
    };
    const repo = new PersonalizedGenerationJobRepository({
      database: { getClient: jest.fn().mockResolvedValue(client) },
    });
    const job = await repo.claimRunnableJob();
    expect(job.status).toBe(JOB_STATUS.PROCESSING);
    expect(job.attempt_count).toBe(2);
    expect(job.job_id).toBe(10);
  });

  it('rolls back and releases the client when claim fails', async () => {
    const client = {
      query: jest.fn(async (sql) => {
        if (sql === 'BEGIN') {
          return { rows: [] };
        }
        if (sql === CLAIM_JOB_SELECT_SQL) {
          throw new Error('db down');
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    const repo = new PersonalizedGenerationJobRepository({
      database: { getClient: jest.fn().mockResolvedValue(client) },
    });
    await expect(repo.claimRunnableJob()).rejects.toThrow('db down');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
