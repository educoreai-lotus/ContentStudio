import apiClient from './api.js';

/**
 * Exercises API Service
 * Handles DevLab exercises creation and management
 */
export const exercisesService = {
  /**
   * Generate AI exercises for a topic
   * @param {Object} requestData - Request data:
   *   {
   *     topic_id: number,
   *     question_type: "code" | "theoretical",
   *     programming_language: string (required for code),
   *     language: string (optional),
   *     amount: number (always 4 for both code and theoretical),
   *     theoretical_question_type: "multiple_choice" | "open_ended" (required for theoretical)
   *   }
   * @returns {Promise<Object>} Response with exercises array
   */
  async generateAI(requestData) {
    const response = await apiClient.post('/api/exercises/generate-ai', requestData);
    return response.data;
  },

  /**
   * Create manual code exercises (always 4 exercises together)
   * Validates with Coordinator/DevLab before saving
   * @param {Object} exerciseData - Exercise data:
   *   {
   *     topic_id: number,
   *     topic_name: string,
   *     skills: string[],
   *     question_type: "code" (only code allowed for manual),
   *     programming_language: string (required),
   *     language: string (optional),
   *     exercises: Array<{
   *       question_text: string,
   *       hint: string (optional),
   *       solution: string (optional)
   *     }> (exactly 4 exercises)
   *   }
   * @returns {Promise<Object>} Response with validated exercises array
   */
  async createManual(exerciseData) {
    const response = await apiClient.post('/api/exercises/manual', exerciseData);
    return response.data;
  },

  /**
   * Create multiple manual exercises in batch
   * @param {Object} requestData - Request data:
   *   {
   *     topic_id: number,
   *     exercises: Array<{
   *       question_text: string,
   *       question_type: "code" | "theoretical",
   *       programming_language: string,
   *       language: string (optional),
   *       hint: string (optional),
   *       solution: string (optional)
   *     }>
   *   }
   * @returns {Promise<Object>} Response with exercises array
   */
  async createManualBatch(requestData) {
    const response = await apiClient.post('/api/exercises/manual/batch', requestData);
    return response.data;
  },

  /**
   * Get all exercises for a topic
   * @param {number} topicId - Topic ID
   * @returns {Promise<Array>} Exercises array
   */
  async getByTopicId(topicId) {
    const response = await apiClient.get(`/api/exercises/topic/${topicId}`);
    return response.data.exercises || [];
  },
};

