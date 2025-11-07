import { Topic } from '../../domain/entities/Topic.js';

export class UpdateTopicUseCase {
  constructor(topicRepository) {
    this.topicRepository = topicRepository;
  }

  async execute(topicId, updateData) {
    if (!topicId) {
      throw new Error('Topic ID is required');
    }

    // Get existing topic
    const existingTopic = await this.topicRepository.findById(topicId);

    if (!existingTopic) {
      return null;
    }

    // Update topic with new data
    const updatedTopic = new Topic({
      ...existingTopic.toJSON(),
      ...updateData,
      topic_id: topicId,
      updated_at: new Date().toISOString(),
    });

    // Persist update
    const savedTopic = await this.topicRepository.update(updatedTopic);

    return savedTopic;
  }
}


