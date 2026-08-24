import { db } from '../database/DatabaseConnection.js';
import { DEFAULT_LEASE_MS, JOB_STATUS } from './personalizedAsyncJobs.js';

export const CLAIM_JOB_SELECT_SQL = `SELECT job_id
FROM personalized_content_generation_jobs
WHERE status = 'pending'
   OR (status = 'processing' AND lease_expires_at < CURRENT_TIMESTAMP)
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED`;

const INSERT_ON_CONFLICT_SQL = `INSERT INTO personalized_content_generation_jobs
  (parent_course_builder_job_id, status, request_payload, updated_at)
VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT (parent_course_builder_job_id) DO NOTHING
RETURNING *`;

function parseJsonField(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function mapJob(row) {
  if (!row) {
    return null;
  }
  return {
    job_id: row.job_id,
    parent_course_builder_job_id: row.parent_course_builder_job_id,
    status: row.status,
    request_payload: parseJsonField(row.request_payload),
    result_payload: parseJsonField(row.result_payload),
    error: row.error,
    attempt_count: row.attempt_count,
    locked_at: row.locked_at,
    lease_expires_at: row.lease_expires_at,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
  };
}

function writeResult(result) {
  const updated = Number(result.rowCount) > 0;
  return {
    updated,
    job: updated ? mapJob(result.rows[0]) : null,
  };
}

export class PersonalizedGenerationJobRepository {
  constructor({ database = db } = {}) {
    this.db = database;
  }

  async createOrGetByParentId(parentCourseBuilderJobId, requestPayload) {
    const insertResult = await this.db.query(INSERT_ON_CONFLICT_SQL, [
      parentCourseBuilderJobId,
      JOB_STATUS.PENDING,
      JSON.stringify(requestPayload),
    ]);

    if (insertResult.rows[0]) {
      return mapJob(insertResult.rows[0]);
    }

    return this.getByParentId(parentCourseBuilderJobId);
  }

  async getByParentId(parentCourseBuilderJobId) {
    const result = await this.db.query(
      `SELECT * FROM personalized_content_generation_jobs
       WHERE parent_course_builder_job_id = $1`,
      [parentCourseBuilderJobId]
    );
    return mapJob(result.rows[0]);
  }

  async getByJobId(jobId) {
    const result = await this.db.query(
      `SELECT * FROM personalized_content_generation_jobs
       WHERE job_id = $1`,
      [jobId]
    );
    return mapJob(result.rows[0]);
  }

  async claimRunnableJob({ leaseMs = DEFAULT_LEASE_MS, now = () => new Date() } = {}) {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      const selected = await client.query(CLAIM_JOB_SELECT_SQL);
      const jobId = selected.rows[0]?.job_id;
      if (!jobId) {
        await client.query('COMMIT');
        return null;
      }

      const leaseExpiresAt = new Date(now().getTime() + leaseMs);
      const updated = await client.query(
        `UPDATE personalized_content_generation_jobs
         SET status = $2,
             locked_at = CURRENT_TIMESTAMP,
             lease_expires_at = $3,
             started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
             attempt_count = attempt_count + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE job_id = $1
         RETURNING *`,
        [jobId, JOB_STATUS.PROCESSING, leaseExpiresAt]
      );
      await client.query('COMMIT');
      return mapJob(updated.rows[0]);
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback errors; original error is more useful.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Extend lease only if this claim still owns the job.
   * @returns {Promise<boolean>} true when exactly one row was updated
   */
  async heartbeat(jobId, expectedAttemptCount, { leaseMs = DEFAULT_LEASE_MS, now = () => new Date() } = {}) {
    const leaseExpiresAt = new Date(now().getTime() + leaseMs);
    const result = await this.db.query(
      `UPDATE personalized_content_generation_jobs
       SET lease_expires_at = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1
         AND status = $3
         AND attempt_count = $4
         AND lease_expires_at > CURRENT_TIMESTAMP
       RETURNING job_id`,
      [jobId, leaseExpiresAt, JOB_STATUS.PROCESSING, expectedAttemptCount]
    );
    return Number(result.rowCount) > 0;
  }

  /**
   * Persist a successful fill result only for the owning claim.
   * @returns {Promise<{ updated: boolean, job: object|null }>}
   */
  async markCompleted(jobId, expectedAttemptCount, resultPayload) {
    const result = await this.db.query(
      `UPDATE personalized_content_generation_jobs
       SET status = $2,
           result_payload = $3::jsonb,
           error = NULL,
           locked_at = NULL,
           lease_expires_at = NULL,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1
         AND status = $4
         AND attempt_count = $5
         AND lease_expires_at > CURRENT_TIMESTAMP
       RETURNING *`,
      [
        jobId,
        JOB_STATUS.COMPLETED,
        JSON.stringify(resultPayload),
        JOB_STATUS.PROCESSING,
        expectedAttemptCount,
      ]
    );
    return writeResult(result);
  }

  /**
   * Persist a failed fill only for the owning claim.
   * @returns {Promise<{ updated: boolean, job: object|null }>}
   */
  async markFailed(jobId, expectedAttemptCount, errorText) {
    const result = await this.db.query(
      `UPDATE personalized_content_generation_jobs
       SET status = $2,
           error = $3,
           locked_at = NULL,
           lease_expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1
         AND status = $4
         AND attempt_count = $5
         AND lease_expires_at > CURRENT_TIMESTAMP
       RETURNING *`,
      [
        jobId,
        JOB_STATUS.FAILED,
        errorText,
        JOB_STATUS.PROCESSING,
        expectedAttemptCount,
      ]
    );
    return writeResult(result);
  }
}

export const personalizedGenerationJobRepository = new PersonalizedGenerationJobRepository();
