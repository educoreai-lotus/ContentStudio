export class DeleteTopicUseCase {
  constructor(topicRepository) {
    this.topicRepository = topicRepository;
  }

  async execute(topicId) {
    if (!topicId) {
      throw new Error('Topic ID is required');
    }

    // Soft delete (update status to deleted)
    await this.topicRepository.softDelete(topicId);
  }
}


