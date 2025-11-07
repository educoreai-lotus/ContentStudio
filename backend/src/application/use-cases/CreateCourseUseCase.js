import { Course } from '../../domain/entities/Course.js';

export class CreateCourseUseCase {
  constructor(courseRepository) {
    this.courseRepository = courseRepository;
  }

  async execute(courseData) {
    // Create course entity (will validate)
    const course = new Course({
      ...courseData,
      status: 'active',
    });

    // Persist course
    const createdCourse = await this.courseRepository.create(course);

    return createdCourse;
  }
}

