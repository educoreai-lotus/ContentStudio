/**
 * Skills Engine gRPC Client
 * Communicates with Skills Engine microservice via gRPC
 */
import { logger } from '../logging/Logger.js';

export class SkillsEngineClient {
  constructor({ grpcClient, serviceUrl }) {
    this.grpcClient = grpcClient;
    this.serviceUrl = serviceUrl || 'skills-engine:50051'; // Default gRPC port
  }

  /**
   * Get skills mapping for a topic
   * @param {string} trainerId - Trainer ID
   * @param {string} topicName - Topic name
   * @returns {Promise<Object>} Skills mapping with skills array
   */
  async getSkillsMapping(trainerId, topicName) {
    // TODO: Implement actual gRPC call
    // For now, return mock data if Skills Engine is not configured
    if (!this.grpcClient) {
      // Skills Engine is not configured - return mock data with fallback flag
      // Generate realistic skills based on topic name
      const mockSkills = this.generateMockSkills(topicName);
      // Convert micro/nano to simple skills array for backward compatibility
      const skillsArray = Array.isArray(mockSkills) 
        ? mockSkills 
        : [...(mockSkills.micro || []), ...(mockSkills.nano || [])];
      
      logger.info('[SkillsEngineClient] Skills Engine gRPC client not configured, returning mock data', {
        trainerId,
        topicName,
        skillsCount: skillsArray.length,
      });
      return {
        topic_id: null,
        topic_name: topicName,
        skills: skillsArray,
        difficulty_level: 'intermediate',
        validation_status: 'approved',
        fallback: true, // Mark as fallback/mock data
      };
    }

    try {
      // gRPC call would go here
      // const response = await this.grpcClient.GetSkillsMapping({
      //   trainer_id: trainerId,
      //   topic_name: topicName,
      // });
      // Skills Engine returns: { skills: string[] }
      // return response;

      // Placeholder
      throw new Error('gRPC client not fully implemented');
    } catch (error) {
      logger.warn('Skills Engine integration failed, using fallback mapping', {
        error: error.message,
        trainer_id: trainerId,
        topic_name: topicName,
      });
      return {
        topic_id: null,
        topic_name: topicName,
        skills: ['communication', 'problem_solving', 'brainstorming', 'rapid_iteration'],
        difficulty_level: 'intermediate',
        validation_status: 'pending',
        fallback: true,
      };
    }
  }

  /**
   * Validate trainer permissions for skill category
   * @param {string} trainerId - Trainer ID
   * @param {Array<string>} skills - Skills to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateSkillsPermissions(trainerId, skills) {
    // TODO: Implement gRPC call
    return {
      authorized: true,
      skills: skills,
    };
  }

  /**
   * Generate realistic mock skills based on topic name
   * @param {string} topicName - Topic name
   * @returns {Object|Array} Mock skills - can be array or object with micro/nano (for backward compatibility)
   */
  generateMockSkills(topicName) {
    const lowerTopic = topicName.toLowerCase();
    
    // Programming-related topics
    if (lowerTopic.includes('javascript') || lowerTopic.includes('js')) {
      return {
        micro: ['JavaScript Fundamentals', 'ES6+ Features', 'Async Programming'],
        nano: ['Variables & Data Types', 'Arrow Functions', 'Promises', 'Async/Await']
      };
    }
    if (lowerTopic.includes('python')) {
      return {
        micro: ['Python Basics', 'Object-Oriented Programming', 'Data Structures'],
        nano: ['Variables', 'Functions', 'Classes', 'Lists & Dictionaries']
      };
    }
    if (lowerTopic.includes('react')) {
      return {
        micro: ['React Components', 'State Management', 'Hooks'],
        nano: ['JSX', 'Props', 'useState', 'useEffect', 'Context API']
      };
    }
    
    // Data-related topics
    if (lowerTopic.includes('data') || lowerTopic.includes('database')) {
      return {
        micro: ['Data Modeling', 'Query Optimization', 'Database Design'],
        nano: ['SQL Queries', 'Indexing', 'Normalization', 'Transactions']
      };
    }
    
    // Design-related topics
    if (lowerTopic.includes('design') || lowerTopic.includes('ui') || lowerTopic.includes('ux')) {
      return {
        micro: ['User Interface Design', 'User Experience', 'Visual Design'],
        nano: ['Color Theory', 'Typography', 'Layout', 'Accessibility']
      };
    }
    
    // Default generic skills
    return {
      micro: ['Problem Solving', 'Critical Thinking', 'Communication'],
      nano: ['Analysis', 'Research', 'Documentation', 'Collaboration']
    };
  }
}



