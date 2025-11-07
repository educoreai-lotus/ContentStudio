/**
 * RAG (Contextual Assistant) REST Client
 * Communicates with RAG microservice via REST API
 */
import { logger } from '../logging/Logger.js';

export class RAGClient {
  constructor({ httpClient, serviceUrl }) {
    this.httpClient = httpClient;
    this.serviceUrl = serviceUrl || 'http://rag:3000';
  }

  /**
   * Index content for RAG
   * Send approved content to RAG for indexing
   * @param {Object} contentData - Content to index
   * @returns {Promise<Object>} RAG response
   */
  async indexContent(contentData) {
    const {
      course_id,
      course_name,
      lesson_id,
      topic_id,
      topic_name,
      trainer_id,
      trainer_name,
      micro_skills,
      nano_skills,
      content_type,
      content_data,
    } = contentData;

    // TODO: Implement actual REST call
    if (!this.httpClient) {
      // Mock response
      return {
        success: true,
        indexed: true,
        content_id: contentData.content_id,
        indexed_at: new Date().toISOString(),
      };
    }

    try {
      const response = await this.httpClient.post(
        `${this.serviceUrl}/api/index/content`,
        {
          course_id,
          course_name,
          lesson_id,
          topic_id,
          topic_name,
          trainer_id,
          trainer_name,
          micro_skills,
          nano_skills,
          content_type,
          content_data,
        }
      );

      return response.data;
    } catch (error) {
      logger.warn('RAG indexing failed, using fallback acknowledgement', {
        error: error.message,
        lesson_id,
        topic_id,
      });
      return {
        success: false,
        indexed: false,
        content_id: contentData?.content_id || null,
        fallback: true,
      };
    }
  }

  /**
   * Update indexed content
   * @param {string} contentId - Content ID
   * @param {Object} updates - Content updates
   * @returns {Promise<Object>} RAG response
   */
  async updateIndexedContent(contentId, updates) {
    // TODO: Implement REST call
    if (!this.httpClient) {
      return { success: true, updated: true };
    }

    try {
      const response = await this.httpClient.put(
        `${this.serviceUrl}/api/index/content/${contentId}`,
        updates
      );

      return response.data;
    } catch (error) {
      logger.warn('RAG update failed, using fallback acknowledgement', {
        error: error.message,
        content_id: contentId,
      });
      return {
        success: false,
        updated: false,
        fallback: true,
      };
    }
  }
}



