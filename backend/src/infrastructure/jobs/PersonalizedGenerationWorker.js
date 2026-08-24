import { fillCourseBuilderService } from '../../application/services/fillers/fillCourseBuilderService.js';
import { logger } from '../logging/Logger.js';
import {
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_LEASE_MS,
  DEFAULT_POLL_INTERVAL_MS,
  prepareExecutionEnvelope,
  shouldStartPersonalizedGenerationWorker,
  toSafeErrorText,
} from './personalizedAsyncJobs.js';
import { personalizedGenerationJobRepository } from './personalizedGenerationJobRepository.js';

export class PersonalizedGenerationWorker {
  constructor({
    repository = personalizedGenerationJobRepository,
    fillCourseBuilderServiceFn = fillCourseBuilderService,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    leaseMs = DEFAULT_LEASE_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {}) {
    this.repository = repository;
    this.fillCourseBuilderServiceFn = fillCourseBuilderServiceFn;
    this.pollIntervalMs = pollIntervalMs;
    this.heartbeatMs = heartbeatMs;
    this.leaseMs = leaseMs;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.claimingEnabled = false;
    this.executing = false;
    this.pollTimer = null;
    this.heartbeatTimer = null;
  }

  get isRunning() {
    return this.claimingEnabled && this.pollTimer != null;
  }

  start() {
    if (this.pollTimer) {
      return;
    }
    this.claimingEnabled = true;
    this.pollTimer = this.setIntervalFn(() => {
      this.processOne().catch((error) => {
        logger.error('[PersonalizedGenerationWorker] poll error', {
          error: error.message,
        });
      });
    }, this.pollIntervalMs);
    logger.info('[PersonalizedGenerationWorker] started', {
      pollIntervalMs: this.pollIntervalMs,
    });
  }

  stop() {
    this.claimingEnabled = false;
    if (this.pollTimer) {
      this.clearIntervalFn(this.pollTimer);
      this.pollTimer = null;
    }
    this.stopHeartbeat();
    logger.info('[PersonalizedGenerationWorker] stopped claiming');
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      this.clearIntervalFn(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  startHeartbeat(jobId, expectedAttemptCount, onOwnershipLost) {
    this.stopHeartbeat();
    this.heartbeatTimer = this.setIntervalFn(() => {
      return this.repository
        .heartbeat(jobId, expectedAttemptCount, { leaseMs: this.leaseMs })
        .then((updated) => {
          if (!updated) {
            onOwnershipLost('heartbeat');
          }
        })
        .catch((error) => {
          // Temporary DB/network failure: ownership is unproven; final writes stay fenced.
          logger.warn('[PersonalizedGenerationWorker] heartbeat failed', {
            job_id: jobId,
            attempt_count: expectedAttemptCount,
            error: error.message,
          });
        });
    }, this.heartbeatMs);
  }

  async processOne() {
    if (!this.claimingEnabled || this.executing) {
      return null;
    }

    this.executing = true;
    try {
      const job = await this.repository.claimRunnableJob({ leaseMs: this.leaseMs });
      if (!job) {
        return null;
      }
      await this.executeJob(job);
      return job;
    } finally {
      this.executing = false;
    }
  }

  async executeJob(job) {
    const expectedAttemptCount = job.attempt_count;
    let ownershipLost = false;

    const markOwnershipLost = (reason) => {
      if (ownershipLost) {
        return;
      }
      ownershipLost = true;
      this.stopHeartbeat();
      logger.warn('[PersonalizedGenerationWorker] ownership lost', {
        job_id: job.job_id,
        attempt_count: expectedAttemptCount,
        reason,
      });
    };

    this.startHeartbeat(job.job_id, expectedAttemptCount, markOwnershipLost);
    try {
      const executionEnvelope = prepareExecutionEnvelope(job.request_payload);
      const result = await this.fillCourseBuilderServiceFn(executionEnvelope);
      if (ownershipLost) {
        logger.info('[PersonalizedGenerationWorker] discarding result after ownership loss', {
          job_id: job.job_id,
          attempt_count: expectedAttemptCount,
        });
        return;
      }

      const completion = await this.repository.markCompleted(
        job.job_id,
        expectedAttemptCount,
        result
      );
      if (!completion.updated) {
        markOwnershipLost('mark_completed');
        return;
      }

      logger.info('[PersonalizedGenerationWorker] job completed', {
        job_id: job.job_id,
        attempt_count: expectedAttemptCount,
        parent_course_builder_job_id: job.parent_course_builder_job_id,
      });
    } catch (error) {
      if (ownershipLost) {
        logger.info('[PersonalizedGenerationWorker] discarding error after ownership loss', {
          job_id: job.job_id,
          attempt_count: expectedAttemptCount,
        });
        return;
      }

      const safeError = toSafeErrorText(error);
      const failure = await this.repository.markFailed(
        job.job_id,
        expectedAttemptCount,
        safeError
      );
      if (!failure.updated) {
        markOwnershipLost('mark_failed');
        return;
      }

      logger.error('[PersonalizedGenerationWorker] job failed', {
        job_id: job.job_id,
        attempt_count: expectedAttemptCount,
        error: safeError,
      });
    } finally {
      this.stopHeartbeat();
    }
  }
}

let workerInstance = null;

export function getPersonalizedGenerationWorker() {
  return workerInstance;
}

export function startPersonalizedGenerationWorkerIfEnabled({
  env = process.env,
  dbConnected = false,
  createWorker = () => new PersonalizedGenerationWorker(),
} = {}) {
  if (!shouldStartPersonalizedGenerationWorker({ env, dbConnected })) {
    return null;
  }
  if (workerInstance?.isRunning) {
    return workerInstance;
  }
  workerInstance = createWorker();
  workerInstance.start();
  return workerInstance;
}

export function stopPersonalizedGenerationWorker() {
  if (workerInstance) {
    workerInstance.stop();
    workerInstance = null;
  }
}
