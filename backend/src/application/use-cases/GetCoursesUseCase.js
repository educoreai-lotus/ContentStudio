import { BaseUseCase } from './BaseUseCase.js';

export class GetCoursesUseCase extends BaseUseCase {
  constructor(courseRepository) {
    super();
    this.courseRepository = courseRepository;
  }

  async execute(trainerId, filters = {}, pagination = {}) {
    const effectiveTrainerId = this.resolveTrainerId(trainerId);

    const result = await this.courseRepository.findByTrainer(effectiveTrainerId, filters, pagination);

    return {
      courses: result.courses,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: result.total,
        total_pages: Math.ceil(result.total / (pagination.limit || 10)),
      },
    };
  }
}

