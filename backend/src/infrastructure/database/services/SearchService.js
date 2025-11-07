import { SearchService as ISearchService } from '../../../domain/services/SearchService.js';

/**
 * In-memory Search Service Implementation
 * TODO: Replace with PostgreSQL full-text search (tsvector/tsquery)
 */
export class SearchService extends ISearchService {
  constructor({ courseRepository, topicRepository, contentRepository }) {
    super();
    this.courseRepository = courseRepository;
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
  }

  async search(criteria) {
    const { query, filters, pagination } = criteria;
    const results = [];
    const allItems = [];

    // Search in courses
    if (!filters.type || filters.type === 'course') {
      try {
        const courses = await this.courseRepository.findAll(
          {
            trainer_id: filters.trainer_id,
            status: filters.status,
          },
          { page: 1, limit: 1000 } // Large limit for search
        );

        if (courses && Array.isArray(courses)) {
          courses.forEach(course => {
            if (this.matchesQuery(course, query, ['course_name', 'description'])) {
              allItems.push({
                type: 'course',
                id: course.course_id,
                title: course.course_name,
                description: course.description,
                status: course.status,
                created_at: course.created_at,
              });
            }
          });
        }
      } catch (error) {
        // Ignore errors, continue with other types
        console.error('Error searching courses:', error);
      }
    }

    // Search in topics
    if (!filters.type || filters.type === 'topic') {
      try {
        const topics = await this.topicRepository.findAll({
          trainer_id: filters.trainer_id,
          status: filters.status,
          course_id: filters.course_id,
        });

        if (topics && Array.isArray(topics)) {
          topics.forEach(topic => {
            if (this.matchesQuery(topic, query, ['topic_name', 'description'])) {
              allItems.push({
                type: 'topic',
                id: topic.topic_id,
                title: topic.topic_name,
                description: topic.description,
                status: topic.status,
                course_id: topic.course_id,
                created_at: topic.created_at,
              });
            }
          });
        }
      } catch (error) {
        // Ignore errors, continue with other types
        console.error('Error searching topics:', error);
      }
    }

    // Search in content
    if (!filters.type || filters.type === 'content') {
      try {
        if (filters.topic_id) {
          const contents = await this.contentRepository.findByTopicId(
            filters.topic_id,
            {
              content_type_id: filters.content_type_id,
              generation_method_id: filters.generation_method_id,
            }
          );

          if (contents && Array.isArray(contents)) {
            contents.forEach(content => {
              const contentText = this.extractContentText(content);
              if (this.matchesQuery({ text: contentText }, query, ['text'])) {
                allItems.push({
                  type: 'content',
                  id: content.content_id,
                  title: `${content.content_type_id} content`,
                  description: contentText.substring(0, 100),
                  content_type_id: content.content_type_id,
                  generation_method_id: content.generation_method_id,
                  topic_id: content.topic_id,
                  created_at: content.created_at,
                });
              }
            });
          }
        }
      } catch (error) {
        // Ignore errors, continue
        console.error('Error searching content:', error);
      }
    }

    // Apply additional filters
    let filteredResults = allItems;
    if (filters.status) {
      filteredResults = filteredResults.filter(item => item.status === filters.status);
    }
    if (filters.content_type_id) {
      filteredResults = filteredResults.filter(
        item => item.content_type_id === filters.content_type_id
      );
    }
    if (filters.generation_method_id) {
      filteredResults = filteredResults.filter(
        item => item.generation_method_id === filters.generation_method_id
      );
    }

    // Sort by relevance (simple: items with query in title first)
    filteredResults.sort((a, b) => {
      const aInTitle = a.title?.toLowerCase().includes(query.toLowerCase());
      const bInTitle = b.title?.toLowerCase().includes(query.toLowerCase());
      if (aInTitle && !bInTitle) return -1;
      if (!aInTitle && bInTitle) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Apply pagination
    const total = filteredResults.length;
    const total_pages = Math.ceil(total / pagination.limit);
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    const paginatedResults = filteredResults.slice(startIndex, endIndex);

    return {
      results: paginatedResults,
      total,
      page: pagination.page,
      limit: pagination.limit,
      total_pages,
      filters: filters,
      query: query,
    };
  }

  matchesQuery(item, query, fields) {
    if (!query || query.trim() === '') {
      return true; // No query means match all
    }

    const queryLower = query.toLowerCase();
    return fields.some(field => {
      const value = item[field];
      if (!value) return false;
      return value.toLowerCase().includes(queryLower);
    });
  }

  extractContentText(content) {
    if (!content.content_data) return '';
    if (typeof content.content_data === 'string') return content.content_data;
    if (content.content_data.text) return content.content_data.text;
    if (content.content_data.code) return content.content_data.code;
    return JSON.stringify(content.content_data);
  }
}

