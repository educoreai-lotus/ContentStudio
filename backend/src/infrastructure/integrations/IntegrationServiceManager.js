/**
 * Integration Service Manager
 * Central manager for all microservice integrations
 */
import {
  SkillsEngineClient,
  CourseBuilderClient,
  DevLabClient,
  DirectoryClient,
  AuthenticationClient,
} from './index.js';

export class IntegrationServiceManager {
  constructor({
    skillsEngineConfig,
    courseBuilderConfig,
    devLabConfig,
    directoryConfig,
    authenticationConfig,
  } = {}) {
    // Initialize gRPC clients (for future implementation)
    const grpcClient = null; // TODO: Initialize gRPC client when needed

    // Initialize HTTP client (for REST APIs)
    const httpClient = null; // TODO: Initialize HTTP client (Axios) when needed

    // Initialize all integration clients
    // Skills Engine uses REST API, not gRPC
    this.skillsEngine = new SkillsEngineClient();

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

    this.authentication = new AuthenticationClient({
      serviceUrl: authenticationConfig?.serviceUrl,
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
   * Get Authentication client
   * @returns {AuthenticationClient}
   */
  getAuthentication() {
    return this.authentication;
  }
}



