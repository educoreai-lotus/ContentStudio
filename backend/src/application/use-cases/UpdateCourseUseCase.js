import { Course } from '../../domain/entities/Course.js';

export class UpdateCourseUseCase {
  constructor(courseRepository) {
    this.courseRepository = courseRepository;
  }

  async execute(courseId, updateData) {
    if (!courseId) {
      throw new Error('Course ID is required');
    }

    // Get existing course - use findByIdIncludingDeleted if we're updating status (for restore operations)
    // This allows us to restore deleted courses by updating their status to 'active'
    const isStatusUpdate = updateData.status !== undefined;
    const existingCourse = isStatusUpdate && this.courseRepository.findByIdIncludingDeleted
      ? await this.courseRepository.findByIdIncludingDeleted(courseId)
      : await this.courseRepository.findById(courseId);

    if (!existingCourse) {
      return null;
    }

    // Persist update with only changed fields
    const savedCourse = await this.courseRepository.update(courseId, updateData);

    return savedCourse;
  }
}

