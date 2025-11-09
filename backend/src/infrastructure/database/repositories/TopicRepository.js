import { TopicRepository as ITopicRepository } from '../../../domain/repositories/TopicRepository.js';
import { Topic } from '../../../domain/entities/Topic.js';

/**
 * PostgreSQL Topic Repository Implementation
 * TODO: Replace with actual database queries when database is set up
 */
export class TopicRepository extends ITopicRepository {
  constructor(database) {
    super();
    this.db = database;
    // In-memory storage for development/testing
    this.topics = [];
    this.nextId = 1;
  }

  async create(topic) {
    // TODO: Replace with actual database INSERT
    const topicData = {
      ...topic.toJSON(),
      topic_id: this.nextId++,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const createdTopic = new Topic(topicData);
    this.topics.push(createdTopic);

    return createdTopic;
  }

  async findById(topicId) {
    // TODO: Replace with actual database SELECT
    const topicData = this.topics.find(t => t.topic_id === topicId);

    if (!topicData) {
      return null;
    }

    return new Topic(topicData.toJSON());
  }

  /**
   * Find all topics with optional filters and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Array>} Array of topics
   */
  async findAll(filters = {}, pagination = { page: 1, limit: 100 }) {
    let filtered = [...this.topics];

    // Apply filters
    if (filters.course_id !== undefined) {
      if (filters.course_id === null) {
        // Stand-alone topics (course_id is null)
        filtered = filtered.filter((t) => t.course_id === null || t.course_id === undefined);
      } else {
        filtered = filtered.filter((t) => t.course_id === filters.course_id);
      }
    }

    if (filters.status) {
      filtered = filtered.filter((t) => t.status === filters.status);
    }

    if (filters.language) {
      filtered = filtered.filter((t) => t.language === filters.language);
    }

    // Apply pagination
    const page = pagination.page || 1;
    const limit = pagination.limit || 100;
    const start = (page - 1) * limit;
    const end = start + limit;

    return filtered.slice(start, end);
  }

  async findByTrainer(trainerId, filters = {}, pagination = {}) {
    // TODO: Replace with actual database SELECT with filters and pagination
    let filteredTopics = this.topics.filter(t => t.trainer_id === trainerId);

    // Filter by status
    if (filters.status) {
      filteredTopics = filteredTopics.filter(t => t.status === filters.status);
    }

    // Filter by course_id
    if (filters.course_id !== undefined && filters.course_id !== null) {
      filteredTopics = filteredTopics.filter(t => t.course_id === filters.course_id);
    } else if (filters.course_id === null) {
      // Stand-alone topics (explicitly null)
      filteredTopics = filteredTopics.filter(t => t.course_id === null || t.course_id === undefined);
    }

    // Filter by search (topic name or description)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTopics = filteredTopics.filter(
        t =>
          t.topic_name.toLowerCase().includes(searchLower) ||
          (t.description && t.description.toLowerCase().includes(searchLower))
      );
    }

    const total = filteredTopics.length;
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const offset = (page - 1) * limit;

    const paginatedTopics = filteredTopics.slice(offset, offset + limit);

    return {
      topics: paginatedTopics.map(t => new Topic(t.toJSON())),
      total,
    };
  }

  async findByCourseId(courseId) {
    // TODO: Replace with actual database SELECT
    const courseTopics = this.topics.filter(t => t.course_id === courseId);

    return courseTopics.map(t => new Topic(t.toJSON()));
  }

  async update(topicOrId, updates = null) {
    // TODO: Replace with actual database UPDATE
    let targetTopic;
    let index;

    if (topicOrId instanceof Topic) {
      targetTopic = topicOrId;
      index = this.topics.findIndex(t => t.topic_id === targetTopic.topic_id);
    } else if (typeof topicOrId === 'object' && topicOrId.topic_id) {
      targetTopic = new Topic(topicOrId);
      index = this.topics.findIndex(t => t.topic_id === targetTopic.topic_id);
    } else {
      const topicId = topicOrId;
      index = this.topics.findIndex(t => t.topic_id === topicId);
      if (index === -1) {
        return null;
      }
      const current = this.topics[index];
      const merged = {
        ...current.toJSON(),
        ...(updates || {}),
        topic_id: current.topic_id,
        updated_at: new Date().toISOString(),
      };
      const updatedTopic = new Topic(merged);
      this.topics[index] = updatedTopic;
      return updatedTopic;
    }

    if (index === -1) {
      return null;
    }

    const updatedTopic = new Topic({
      ...targetTopic.toJSON(),
      ...(updates || {}),
      updated_at: new Date().toISOString(),
    });

    this.topics[index] = updatedTopic;

    return updatedTopic;
  }

  async softDelete(topicId) {
    // TODO: Replace with actual database UPDATE (status = 'deleted')
    const topic = await this.findById(topicId);

    if (topic) {
      topic.status = 'deleted';
      await this.update(topic);
    }
  }

  async incrementUsageCount(topicId) {
    // TODO: Replace with actual database UPDATE (usage_count++)
    const topic = await this.findById(topicId);

    if (topic) {
      topic.incrementUsageCount();
      await this.update(topic);
    }
  }
}

