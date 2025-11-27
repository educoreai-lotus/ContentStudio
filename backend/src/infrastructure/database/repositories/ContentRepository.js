import { Content } from '../../../domain/entities/Content.js';
import { ContentRepository as IContentRepository } from '../../../domain/repositories/ContentRepository.js';

/**
 * In-memory Content Repository Implementation
 * TODO: Replace with PostgreSQL implementation
 */
export class ContentRepository extends IContentRepository {
  constructor() {
    super();
    this.contents = [];
    this.nextId = 1;
  }

  async create(content) {
    const contentId = this.nextId++;
    const createdContent = new Content({
      ...content,
      content_id: contentId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    this.contents.push(createdContent);
    return createdContent;
  }

  async findById(contentId) {
    const content = this.contents.find(c => c.content_id === contentId);
    return content || null;
  }

  async findByTopicId(topicId, filters = {}) {
    let results = this.contents
      .filter(c => c.topic_id === topicId)
      .filter(c => filters.includeArchived ? true : c.status !== 'archived');

    // Apply filters
    if (filters.content_type_id) {
      results = results.filter(c => c.content_type_id === filters.content_type_id);
    }

    if (filters.generation_method_id) {
      results = results.filter(
        c => c.generation_method_id === filters.generation_method_id
      );
    }

    return results;
  }

  async update(contentId, updates) {
    const index = this.contents.findIndex(c => c.content_id === contentId);
    if (index === -1) {
      throw new Error(`Content with id ${contentId} not found`);
    }

    const existingContent = this.contents[index];
    const updatedContent = new Content({
      ...existingContent,
      ...updates,
      content_id: contentId,
      updated_at: new Date(),
    });

    this.contents[index] = updatedContent;
    return updatedContent;
  }

  async delete(contentId, skipHistoryCheck = false) {
    const index = this.contents.findIndex(c => c.content_id === contentId);
    if (index === -1) {
      throw new Error(`Content with id ${contentId} not found`);
    }

    // For in-memory repository, we don't have history support
    // But we still respect the skipHistoryCheck parameter for consistency
    if (!skipHistoryCheck) {
      console.warn('[ContentRepository] WARNING: In-memory repository does not support history. Content will be deleted without history backup.');
    }

    this.contents[index].softDelete();
    return true;
  }

  async hasContentType(topicId, contentType) {
    return this.contents.some(
      c => c.topic_id === topicId && c.content_type_id === contentType
    );
  }

  async findLatestByTopicAndType(topicId, contentType) {
    const matches = this.contents
      .filter(
        c =>
          c.topic_id === topicId &&
          c.content_type_id === contentType &&
          c.status !== 'archived'
      )
      .sort((a, b) => b.created_at - a.created_at);
    return matches.length > 0 ? matches[0] : null;
  }

  async getContentTypeNamesByIds(typeIds = []) {
    const map = new Map();
    typeIds.forEach(id => {
      if (typeof id === 'string') {
        map.set(id, id);
      } else if (typeof id === 'number') {
        map.set(id, id.toString());
      }
    });
    return map;
  }
}



