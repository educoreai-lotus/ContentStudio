export class DeleteCourseUseCase {
  constructor(courseRepository) {
    this.courseRepository = courseRepository;
  }

  async execute(courseId) {
    if (!courseId) {
      throw new Error('Course ID is required');
    }

    // Soft delete (update status to deleted)
    await this.courseRepository.softDelete(courseId);
  }
}

