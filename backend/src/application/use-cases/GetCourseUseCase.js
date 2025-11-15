export class GetCourseUseCase {
  constructor(courseRepository) {
    this.courseRepository = courseRepository;
  }

  async execute(courseId) {
    if (!courseId) {
      throw new Error('Course ID is required');
    }

    const course = await this.courseRepository.findById(courseId);

    if (course) {
      // Increment usage_count when course is fetched
      try {
        await this.courseRepository.incrementUsageCount(courseId);
      } catch (error) {
        console.warn('[GetCourseUseCase] Failed to increment usage count:', error.message);
        // Don't fail the entire operation if usage count increment fails
      }
    }

    return course;
  }
}

