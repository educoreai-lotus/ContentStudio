export class GetCoursesUseCase {
  constructor(courseRepository) {
    this.courseRepository = courseRepository;
  }

  async execute(trainerId, filters = {}, pagination = {}) {
    // Fallback to mock trainer if no trainer ID provided
    const effectiveTrainerId = trainerId || 'trainer-maya-levi';

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

