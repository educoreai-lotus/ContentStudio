import { Topic } from '../../domain/entities/Topic.js';

/**
 * Create Topic Use Case
 * Creates a topic/lesson with Skills Engine integration
 */
export class CreateTopicUseCase {
  constructor({ topicRepository, skillsEngineClient, courseRepository }) {
    this.topicRepository = topicRepository;
    this.skillsEngineClient = skillsEngineClient;
    this.courseRepository = courseRepository;
  }

  async execute(topicData) {
    // Get skills mapping from Skills Engine (if topic_name provided)
    let skills = topicData.skills || [];
    
    if (topicData.topic_name && this.skillsEngineClient) {
      try {
        const skillsMapping = await this.skillsEngineClient.getSkillsMapping(
          topicData.trainer_id,
          topicData.topic_name
        );
        
        // Merge provided skills with Skills Engine response
        if (skillsMapping && skillsMapping.micro_skills) {
          skills = [...new Set([...skills, ...skillsMapping.micro_skills])];
        }
      } catch (error) {
        // Log error but continue without Skills Engine skills
        console.warn('Skills Engine integration failed:', error.message);
        // Continue with provided skills only
      }
    }

    // If topic belongs to a course, get language from course
    let topicLanguage = topicData.language;
    if (topicData.course_id && this.courseRepository) {
      try {
        const course = await this.courseRepository.findById(topicData.course_id);
        if (course && course.language) {
          topicLanguage = course.language;
          console.log('[CreateTopicUseCase] Topic language inherited from course:', {
            course_id: topicData.course_id,
            course_language: course.language,
            topic_language: topicLanguage,
          });
        }
      } catch (error) {
        console.warn('[CreateTopicUseCase] Failed to get course language:', error.message);
        // Continue with provided language or default
      }
    }

    // Create topic entity (will validate)
    const topic = new Topic({
      ...topicData,
      skills,
      language: topicLanguage,
      status: topicData.status || 'active', // Default to 'active' - ENUM doesn't support 'draft'
    });

    // Persist topic
    const createdTopic = await this.topicRepository.create(topic);

    return createdTopic;
  }
}

