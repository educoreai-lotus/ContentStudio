import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { OwnershipNotFoundError } from './ownershipErrors.js';

const SYSTEM_TEMPLATE_OWNER = 'system';

/**
 * Trainer resource ownership checks (Phase 1 — no DB migration).
 */
export class OwnershipService {
  async getCourseRepository() {
    return RepositoryFactory.getCourseRepository();
  }

  async getTopicRepository() {
    return RepositoryFactory.getTopicRepository();
  }

  async getContentRepository() {
    return RepositoryFactory.getContentRepository();
  }

  async getTemplateRepository() {
    return RepositoryFactory.getTemplateRepository();
  }

  async getContentVersionRepository() {
    return RepositoryFactory.getContentVersionRepository();
  }

  async loadCourse(courseId, { includeDeleted = false } = {}) {
    const courseRepository = await this.getCourseRepository();
    if (includeDeleted && typeof courseRepository.findByIdIncludingDeleted === 'function') {
      return courseRepository.findByIdIncludingDeleted(courseId);
    }
    return courseRepository.findById(courseId);
  }

  async loadTopic(topicId, { includeDeleted = false } = {}) {
    const topicRepository = await this.getTopicRepository();
    if (includeDeleted && typeof topicRepository.findByIdIncludingDeleted === 'function') {
      return topicRepository.findByIdIncludingDeleted(topicId);
    }
    return topicRepository.findById(topicId);
  }

  async assertTrainerOwnsCourse(courseId, trainerId, { includeDeleted = false } = {}) {
    const course = await this.loadCourse(courseId, { includeDeleted });
    if (!course || course.trainer_id !== trainerId) {
      throw new OwnershipNotFoundError();
    }
    return course;
  }

  async assertTrainerOwnsTopic(topicId, trainerId, { includeDeleted = false } = {}) {
    const topic = await this.loadTopic(topicId, { includeDeleted });
    if (!topic || topic.trainer_id !== trainerId) {
      throw new OwnershipNotFoundError();
    }
    return topic;
  }

  async assertTrainerOwnsContent(contentId, trainerId) {
    const contentRepository = await this.getContentRepository();
    const content = await contentRepository.findById(contentId);
    if (!content) {
      throw new OwnershipNotFoundError();
    }
    await this.assertTrainerOwnsTopic(content.topic_id, trainerId, { includeDeleted: true });
    return content;
  }

  async assertTrainerCanReadTemplate(templateId, trainerId) {
    const templateRepository = await this.getTemplateRepository();
    const template = await templateRepository.findById(templateId);
    if (
      !template ||
      (template.created_by !== trainerId && template.created_by !== SYSTEM_TEMPLATE_OWNER)
    ) {
      throw new OwnershipNotFoundError();
    }
    return template;
  }

  async assertTrainerOwnsTemplate(templateId, trainerId) {
    const templateRepository = await this.getTemplateRepository();
    const template = await templateRepository.findById(templateId);
    if (!template || template.created_by !== trainerId || template.created_by === SYSTEM_TEMPLATE_OWNER) {
      throw new OwnershipNotFoundError();
    }
    return template;
  }

  async assertTrainerOwnsHistory(historyId, trainerId) {
    const contentVersionRepository = await this.getContentVersionRepository();
    const version = await contentVersionRepository.findById(historyId);
    if (!version) {
      throw new OwnershipNotFoundError();
    }
    const topicId = version.topic_id || version.topicId;
    if (!topicId) {
      throw new OwnershipNotFoundError();
    }
    await this.assertTrainerOwnsTopic(topicId, trainerId, { includeDeleted: true });
    return version;
  }
}

export const ownershipService = new OwnershipService();
