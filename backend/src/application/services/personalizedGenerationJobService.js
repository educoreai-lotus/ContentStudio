import { fillCourseBuilderService } from './fillers/fillCourseBuilderService.js';
import {
  CS_GENERATION_ACTIONS,
  JOB_STATUS,
  UNAVAILABLE_ERROR,
  getCsGenerationAction,
  getParentCourseBuilderJobId,
  isPersonalizedAsyncJobsEnabled,
} from '../../infrastructure/jobs/personalizedAsyncJobs.js';
import { personalizedGenerationJobRepository } from '../../infrastructure/jobs/personalizedGenerationJobRepository.js';
import { logger } from '../../infrastructure/logging/Logger.js';

function envelopeBase(requestBody, response) {
  return {
    requester_service: requestBody.requester_service,
    payload: requestBody.payload,
    response,
  };
}

function unavailableEnvelope(requestBody) {
  return envelopeBase(requestBody, {
    error: UNAVAILABLE_ERROR,
    generation_job: null,
  });
}

function errorEnvelope(requestBody, error) {
  return envelopeBase(requestBody, {
    error,
    generation_job: null,
  });
}

function generationJobView(job) {
  return {
    cs_job_id: job.job_id,
    parent_course_builder_job_id: job.parent_course_builder_job_id,
    status: job.status,
    ...(job.error ? { error: job.error } : { error: null }),
  };
}

export class PersonalizedGenerationJobService {
  constructor({
    repository = personalizedGenerationJobRepository,
    fillCourseBuilderServiceFn = fillCourseBuilderService,
  } = {}) {
    this.repository = repository;
    this.fillCourseBuilderServiceFn = fillCourseBuilderServiceFn;
  }

  async executeCourseBuilderServiceRequest(requestBody) {
    const action = getCsGenerationAction(requestBody?.payload);
    if (!action) {
      return this.fillCourseBuilderServiceFn(requestBody);
    }
    return this.handleAsyncAction(requestBody, action);
  }

  async handleAsyncAction(requestBody, action) {
    if (!isPersonalizedAsyncJobsEnabled()) {
      return unavailableEnvelope(requestBody);
    }

    try {
      const parentId = getParentCourseBuilderJobId(requestBody.payload);
      if (!parentId) {
        return errorEnvelope(requestBody, 'parent_course_builder_job_id is required');
      }

      switch (action) {
        case CS_GENERATION_ACTIONS.START:
          return await this.start(requestBody, parentId);
        case CS_GENERATION_ACTIONS.STATUS:
          return await this.status(requestBody, parentId);
        case CS_GENERATION_ACTIONS.RESULT:
          return await this.result(requestBody, parentId);
        default:
          return errorEnvelope(requestBody, 'unknown_cs_generation_action');
      }
    } catch (error) {
      logger.error('[PersonalizedGenerationJobService] async action failed', {
        action,
        error: error.message,
      });
      return errorEnvelope(requestBody, 'generation_job_error');
    }
  }

  async start(requestBody, parentId) {
    const job = await this.repository.createOrGetByParentId(parentId, requestBody);
    if (!job) {
      return errorEnvelope(requestBody, 'generation_job_not_found');
    }
    logger.info('[PersonalizedGenerationJobService] START', {
      cs_job_id: job.job_id,
      parent_course_builder_job_id: parentId,
      status: job.status,
    });
    return envelopeBase(requestBody, {
      generation_job: generationJobView(job),
    });
  }

  async status(requestBody, parentId) {
    const job = await this.repository.getByParentId(parentId);
    if (!job) {
      return errorEnvelope(requestBody, 'generation_job_not_found');
    }
    return envelopeBase(requestBody, {
      generation_job: generationJobView(job),
    });
  }

  async result(requestBody, parentId) {
    const job = await this.repository.getByParentId(parentId);
    if (!job) {
      return errorEnvelope(requestBody, 'generation_job_not_found');
    }

    if (job.status === JOB_STATUS.COMPLETED) {
      return job.result_payload;
    }

    if (job.status === JOB_STATUS.FAILED) {
      return envelopeBase(requestBody, {
        generation_job: generationJobView(job),
      });
    }

    return envelopeBase(requestBody, {
      generation_job: generationJobView(job),
    });
  }
}

export const personalizedGenerationJobService = new PersonalizedGenerationJobService();

export function executeCourseBuilderServiceRequest(requestBody) {
  return personalizedGenerationJobService.executeCourseBuilderServiceRequest(requestBody);
}
