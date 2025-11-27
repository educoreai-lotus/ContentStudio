import { Topic } from '../../domain/entities/Topic.js';

export class UpdateTopicUseCase {
  constructor(topicRepository) {
    this.topicRepository = topicRepository;
  }

  async execute(topicId, updateData) {
    if (!topicId) {
      throw new Error('Topic ID is required');
    }

    // Get existing topic - use findByIdIncludingDeleted if we're updating status (for restore operations)
    // This allows us to restore deleted topics by updating their status to 'active'
    const isStatusUpdate = updateData.status !== undefined;
    const existingTopic = isStatusUpdate && this.topicRepository.findByIdIncludingDeleted
      ? await this.topicRepository.findByIdIncludingDeleted(topicId)
      : await this.topicRepository.findById(topicId);

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


