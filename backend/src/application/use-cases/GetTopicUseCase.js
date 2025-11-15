export class GetTopicUseCase {
  constructor(topicRepository) {
    this.topicRepository = topicRepository;
  }

  async execute(topicId) {
    if (!topicId) {
      throw new Error('Topic ID is required');
    }

    const topic = await this.topicRepository.findById(topicId);

    if (topic) {
      // Increment usage_count when topic is fetched
      try {
        await this.topicRepository.incrementUsageCount(topicId);
      } catch (error) {
        console.warn('[GetTopicUseCase] Failed to increment usage count:', error.message);
        // Don't fail the entire operation if usage count increment fails
      }
    }

    return topic;
  }
}


