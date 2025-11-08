import { BaseUseCase } from './BaseUseCase.js';

export class GetTopicsUseCase extends BaseUseCase {
  constructor(topicRepository) {
    super();
    this.topicRepository = topicRepository;
  }

  async execute(trainerId, filters = {}, pagination = {}) {
    const effectiveTrainerId = this.resolveTrainerId(trainerId);

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


