export class GetTopicUseCase {
  constructor(topicRepository) {
    this.topicRepository = topicRepository;
  }

  async execute(topicId) {
    if (!topicId) {
      throw new Error('Topic ID is required');
    }

    const topic = await this.topicRepository.findById(topicId);

    return topic;
  }
}


