import { Course } from '../../domain/entities/Course.js';

export class UpdateCourseUseCase {
  constructor(courseRepository) {
    this.courseRepository = courseRepository;
  }

  async execute(courseId, updateData) {
    if (!courseId) {
      throw new Error('Course ID is required');
    }

    // Get existing course
    const existingCourse = await this.courseRepository.findById(courseId);

    if (!existingCourse) {
      return null;
    }

    // Persist update with only changed fields
    const savedCourse = await this.courseRepository.update(courseId, updateData);

    return savedCourse;
  }
}

