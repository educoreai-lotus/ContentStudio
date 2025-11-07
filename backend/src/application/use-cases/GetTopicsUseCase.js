export class GetTopicsUseCase {
  constructor(topicRepository) {
    this.topicRepository = topicRepository;
  }

  async execute(trainerId, filters = {}, pagination = {}) {
    if (!trainerId) {
      throw new Error('Trainer ID is required');
    }

    const result = await this.topicRepository.findByTrainer(trainerId, filters, pagination);

    return {
      topics: result.topics,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: result.total,
        total_pages: Math.ceil(result.total / (pagination.limit || 10)),
      },
    };
  }
}


