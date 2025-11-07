/**
 * Integration Service Manager
 * Central manager for all microservice integrations
 */
import {
  SkillsEngineClient,
  CourseBuilderClient,
  DevLabClient,
  DirectoryClient,
  LearningAnalyticsClient,
  RAGClient,
} from './index.js';

export class IntegrationServiceManager {
  constructor({
    skillsEngineConfig,
    courseBuilderConfig,
    devLabConfig,
    directoryConfig,
    learningAnalyticsConfig,
    ragConfig,
  } = {}) {
    // Initialize gRPC clients (for future implementation)
    const grpcClient = null; // TODO: Initialize gRPC client when needed

    // Initialize HTTP client (for REST APIs)
    const httpClient = null; // TODO: Initialize HTTP client (Axios) when needed

    // Initialize all integration clients
    this.skillsEngine = new SkillsEngineClient({
      grpcClient,
      serviceUrl: skillsEngineConfig?.serviceUrl,
    });

    this.courseBuilder = new CourseBuilderClient({
      grpcClient,
      serviceUrl: courseBuilderConfig?.serviceUrl,
    });

    this.devLab = new DevLabClient({
      grpcClient,
      serviceUrl: devLabConfig?.serviceUrl,
    });

    this.directory = new DirectoryClient({
      grpcClient,
      serviceUrl: directoryConfig?.serviceUrl,
    });

    this.learningAnalytics = new LearningAnalyticsClient({
      httpClient,
      serviceUrl: learningAnalyticsConfig?.serviceUrl,
    });

    this.rag = new RAGClient({
      httpClient,
      serviceUrl: ragConfig?.serviceUrl,
    });
  }

  /**
   * Get Skills Engine client
   * @returns {SkillsEngineClient}
   */
  getSkillsEngine() {
    return this.skillsEngine;
  }

  /**
   * Get Course Builder client
   * @returns {CourseBuilderClient}
   */
  getCourseBuilder() {
    return this.courseBuilder;
  }

  /**
   * Get DevLab client
   * @returns {DevLabClient}
   */
  getDevLab() {
    return this.devLab;
  }

  /**
   * Get Directory client
   * @returns {DirectoryClient}
   */
  getDirectory() {
    return this.directory;
  }

  /**
   * Get Learning Analytics client
   * @returns {LearningAnalyticsClient}
   */
  getLearningAnalytics() {
    return this.learningAnalytics;
  }

  /**
   * Get RAG client
   * @returns {RAGClient}
   */
  getRAG() {
    return this.rag;
  }
}



