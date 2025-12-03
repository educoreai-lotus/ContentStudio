import { Topic } from '../../domain/entities/Topic.js';
import { logger } from '../../infrastructure/logging/Logger.js';

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
        // Skills Engine returns a simple skills array, not micro_skills/nano_skills
        if (skillsMapping && Array.isArray(skillsMapping.skills) && skillsMapping.skills.length > 0) {
          skills = [...new Set([...skills, ...skillsMapping.skills])];
        } else if (skillsMapping === null) {
          // Skills Engine is not configured/available - log but continue with provided skills
          console.info('[CreateTopicUseCase] Skills Engine is not configured or unavailable, using provided skills only');
        }
      } catch (error) {
        // Log error but continue without Skills Engine skills
        console.warn('[CreateTopicUseCase] Skills Engine integration failed:', error.message);
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

    // If topic belongs to a course and we have skills from Skills Engine, update course skills
    if (topicData.course_id && this.courseRepository && skills.length > 0) {
      try {
        const course = await this.courseRepository.findById(topicData.course_id);
        if (course) {
          // Get existing course skills (if any)
          const existingCourseSkills = Array.isArray(course.skills) ? course.skills : [];
          
          // Merge new skills with existing course skills (no duplicates)
          const mergedSkills = [...new Set([...existingCourseSkills, ...skills])];
          
          // Update course with merged skills
          await this.courseRepository.update(topicData.course_id, {
            skills: mergedSkills,
          });
          
          logger.info('[CreateTopicUseCase] Updated course skills with topic skills', {
            course_id: topicData.course_id,
            topic_id: createdTopic.topic_id,
            existingSkillsCount: existingCourseSkills.length,
            newSkillsCount: skills.length,
            mergedSkillsCount: mergedSkills.length,
          });
        }
      } catch (error) {
        // Log error but don't fail topic creation
        logger.warn('[CreateTopicUseCase] Failed to update course skills', {
          course_id: topicData.course_id,
          error: error.message,
        });
      }
    }

    return createdTopic;
  }
}

