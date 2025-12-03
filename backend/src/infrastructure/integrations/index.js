/**
 * Microservice Integration Clients
 * Central export for all integration clients
 */
// Use REST client for Skills Engine instead of gRPC
export { SkillsEngineClient } from '../skillsEngineClient/skillsEngineClient.js';
export { CourseBuilderClient } from './CourseBuilderClient.js';
export { DevLabClient } from './DevLabClient.js';
export { DirectoryClient } from './DirectoryClient.js';
export { LearningAnalyticsClient } from './LearningAnalyticsClient.js';
export { RAGClient } from './RAGClient.js';
export { AuthenticationClient } from './AuthenticationClient.js';



