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

    // Update course with new data
    const updatedCourse = new Course({
      ...existingCourse.toJSON(),
      ...updateData,
      course_id: courseId,
      updated_at: new Date().toISOString(),
    });

    // Persist update
    const savedCourse = await this.courseRepository.update(updatedCourse);

    return savedCourse;
  }
}

