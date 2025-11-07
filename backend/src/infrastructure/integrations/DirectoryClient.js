/**
 * Directory gRPC Client
 * Communicates with Directory microservice via gRPC
 * Note: Reversed flow - Directory provides trainer info to Content Studio
 */
import { logger } from '../logging/Logger.js';

export class DirectoryClient {
  constructor({ grpcClient, serviceUrl }) {
    this.grpcClient = grpcClient;
    this.serviceUrl = serviceUrl || 'directory:50051';
  }

  /**
   * Receive trainer information from Directory
   * This is called by Directory service (reversed flow)
   * @param {Object} trainerInfo - Trainer information
   * @returns {Promise<void>}
   */
  async receiveTrainerInfo(trainerInfo) {
    // Directory sends trainer info to Content Studio
    // Store locally or validate
    const {
      trainer_id,
      trainer_name,
      company_id,
      company_name,
      ai_capabilities_enabled,
      can_publish_externally,
      company_logo_url,
    } = trainerInfo;

    // TODO: Store in local cache or database
    console.log('Received trainer info from Directory:', {
      trainer_id,
      trainer_name,
      ai_capabilities_enabled,
    });

    return { success: true };
  }

  /**
   * Send course/lesson updates to Directory
   * Content Studio sends updates back to Directory
   * @param {Object} courseData - Course data to sync
   * @returns {Promise<Object>} Directory response
   */
  async syncCourseToDirectory(courseData) {
    // TODO: Implement actual gRPC call
    if (!this.grpcClient) {
      // Mock response
      return {
        success: true,
        course_id: courseData.course_id,
        synced_at: new Date().toISOString(),
      };
    }

    try {
      // gRPC call: DirectoryService.UpdateCourseCatalog
      // const response = await this.grpcClient.UpdateCourseCatalog({
      //   course_id: courseData.course_id,
      //   course_name: courseData.course_name,
      //   trainer_id: courseData.trainer_id,
      //   status: courseData.status,
      // });
      // return response;
      
      throw new Error('gRPC client not fully implemented');
    } catch (error) {
      logger.warn('Directory sync failed, using fallback response', {
        error: error.message,
        course_id: courseData?.course_id,
      });
      return {
        success: false,
        course_id: courseData?.course_id || null,
        synced_at: new Date().toISOString(),
        fallback: true,
      };
    }
  }

  /**
   * Validate trainer permissions
   * @param {string} trainerId - Trainer ID
   * @returns {Promise<Object>} Trainer permissions
   */
  async validateTrainer(trainerId) {
    // TODO: Implement gRPC call
    if (!this.grpcClient) {
      // Mock response
      return {
        trainer_id: trainerId,
        authorized: true,
        ai_capabilities_enabled: true,
        can_publish_externally: true,
      };
    }

    try {
      // gRPC call: DirectoryService.GetTrainerInfo
      // const response = await this.grpcClient.GetTrainerInfo({ trainer_id: trainerId });
      // return response;
      
      throw new Error('gRPC client not fully implemented');
    } catch (error) {
      logger.warn('Directory validation failed, using fallback permissions', {
        error: error.message,
        trainer_id: trainerId,
      });
      return {
        trainer_id: trainerId,
        authorized: true,
        ai_capabilities_enabled: false,
        can_publish_externally: false,
        fallback: true,
      };
    }
  }
}



