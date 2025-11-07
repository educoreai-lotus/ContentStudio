import { Topic } from '../../domain/entities/Topic.js';

/**
 * Create Topic Use Case
 * Creates a topic/lesson with Skills Engine integration
 */
export class CreateTopicUseCase {
  constructor({ topicRepository, skillsEngineClient }) {
    this.topicRepository = topicRepository;
    this.skillsEngineClient = skillsEngineClient;
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

    // Create topic entity (will validate)
    const topic = new Topic({
      ...topicData,
      skills,
      status: 'draft',
    });

    // Persist topic
    const createdTopic = await this.topicRepository.create(topic);

    return createdTopic;
  }
}

