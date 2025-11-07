/**
 * DevLab gRPC Client
 * Communicates with DevLab microservice via gRPC
 */
import { logger } from '../logging/Logger.js';

export class DevLabClient {
  constructor({ grpcClient, serviceUrl }) {
    this.grpcClient = grpcClient;
    this.serviceUrl = serviceUrl || 'devlab:50051';
  }

  /**
   * Generate AI exercises
   * Case 1: AI-Generated Exercises
   * @param {Object} exerciseRequest - Exercise generation request
   * @returns {Promise<Array>} Generated exercises
   */
  async generateExercises(exerciseRequest) {
    const {
      lesson_id,
      topic_id,
      topic_name,
      skills,
      question_type,
      programming_language,
      number_of_questions,
    } = exerciseRequest;

    // TODO: Implement actual gRPC call
    if (!this.grpcClient) {
      // Mock response
      return Array.from({ length: number_of_questions || 3 }, (_, i) => ({
        question_id: `q${i + 1}`,
        lesson_id,
        question_text: `Generated question ${i + 1}`,
        question_type,
        programming_language,
        generated_by: 'AI',
        validation_status: 'approved',
        ajax_block: `<div>Exercise ${i + 1}</div>`,
      }));
    }

    try {
      // gRPC call: DevLabService.GenerateExercises
      // const response = await this.grpcClient.GenerateExercises({
      //   lesson_id,
      //   topic_id,
      //   topic_name,
      //   skills,
      //   question_type,
      //   programming_language,
      //   number_of_questions,
      // });
      // return response.exercises;
      
      throw new Error('gRPC client not fully implemented');
    } catch (error) {
      logger.warn('DevLab generateExercises failed, returning fallback data', {
        error: error.message,
        lesson_id,
        topic_id,
      });
      return Array.from({ length: number_of_questions || 3 }, (_, i) => ({
        question_id: `fallback_${i + 1}`,
        lesson_id,
        question_text: `Fallback question ${i + 1} for ${topic_name}`,
        question_type,
        programming_language,
        generated_by: 'AI-fallback',
        validation_status: 'pending',
        ajax_block: `<div>Fallback exercise ${i + 1}</div>`,
        fallback: true,
      }));
    }
  }

  /**
   * Validate trainer-created exercise
   * Case 2: Trainer-Created Exercises
   * @param {Object} exerciseData - Exercise to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateExercise(exerciseData) {
    const {
      lesson_id,
      question_text,
      topic_id,
      topic_name,
      skills,
      question_type,
      programming_language,
    } = exerciseData;

    // TODO: Implement gRPC call with Gemini validation
    if (!this.grpcClient) {
      // Mock validation
      return {
        question_id: `q_${Date.now()}`,
        lesson_id,
        question_text,
        question_type,
        programming_language,
        generated_by: 'trainer',
        validation_status: 'approved',
        ajax_block: `<div>${question_text}</div>`,
      };
    }

    try {
      // gRPC call: DevLabService.ValidateExercise
      // const response = await this.grpcClient.ValidateExercise({
      //   lesson_id,
      //   question_text,
      //   topic_id,
      //   topic_name,
      //   skills,
      //   question_type,
      //   programming_language,
      // });
      // return response;
      
      throw new Error('gRPC client not fully implemented');
    } catch (error) {
      logger.warn('DevLab validateExercise failed, using fallback validation', {
        error: error.message,
        lesson_id,
        topic_id,
      });
      return {
        question_id: `fallback_${Date.now()}`,
        lesson_id,
        question_text,
        question_type,
        programming_language,
        generated_by: 'trainer',
        validation_status: 'pending',
        ajax_block: `<div>${question_text}</div>`,
        fallback: true,
      };
    }
  }
}



