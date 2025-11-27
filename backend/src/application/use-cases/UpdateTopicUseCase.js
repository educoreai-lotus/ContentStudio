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

    // Convert UpdateTopicDTO to plain object if needed
    // The repository expects (topicId, updates) where updates is a plain object
    const updates = updateData instanceof Object && !Array.isArray(updateData)
      ? { ...updateData } // Spread to get plain object
      : updateData;

    // Validate that updates is an object
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('Update data must be a non-null object');
    }

    // Persist update - pass topicId and updates separately
    const savedTopic = await this.topicRepository.update(topicId, updates);

    return savedTopic;
  }
}


