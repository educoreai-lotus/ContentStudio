export class GetCourseUseCase {
  constructor(courseRepository) {
    this.courseRepository = courseRepository;
  }

  async execute(courseId) {
    if (!courseId) {
      throw new Error('Course ID is required');
    }

    const course = await this.courseRepository.findById(courseId);

    return course;
  }
}

