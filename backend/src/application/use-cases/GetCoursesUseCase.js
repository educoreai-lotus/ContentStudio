export class GetCoursesUseCase {
  constructor(courseRepository) {
    this.courseRepository = courseRepository;
  }

  async execute(trainerId, filters = {}, pagination = {}) {
    if (!trainerId) {
      throw new Error('Trainer ID is required');
    }

    const result = await this.courseRepository.findByTrainer(trainerId, filters, pagination);

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

