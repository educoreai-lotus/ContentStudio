export class GetTopicsUseCase {
  constructor(topicRepository) {
    this.topicRepository = topicRepository;
  }

  async execute(trainerId, filters = {}, pagination = {}) {
    // Fallback to mock trainer if no trainer ID provided
    const effectiveTrainerId = trainerId || 'trainer-maya-levi';

    const result = await this.topicRepository.findByTrainer(effectiveTrainerId, filters, pagination);

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


