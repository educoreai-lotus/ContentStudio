import { CourseRepository as ICourseRepository } from '../../../domain/repositories/CourseRepository.js';
import { Course } from '../../../domain/entities/Course.js';

/**
 * PostgreSQL Course Repository Implementation
 * TODO: Replace with actual database queries when database is set up
 */
export class CourseRepository extends ICourseRepository {
  constructor(database) {
    super();
    this.db = database;
    // In-memory storage for development/testing
    this.courses = [];
    this.nextId = 1;
  }

  async create(course) {
    // TODO: Replace with actual database INSERT
    const courseData = {
      ...course.toJSON(),
      course_id: this.nextId++,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const createdCourse = new Course(courseData);
    this.courses.push(createdCourse);

    return createdCourse;
  }

  async findById(courseId) {
    // TODO: Replace with actual database SELECT
    const courseData = this.courses.find(c => c.course_id === courseId);

    if (!courseData) {
      return null;
    }

    return new Course(courseData.toJSON());
  }

  async findAll(filters = {}, pagination = {}) {
    // Support both findAll and findByTrainer patterns
    let filteredCourses = [...this.courses];

    // Filter by trainer_id
    if (filters.trainer_id) {
      filteredCourses = filteredCourses.filter(c => c.trainer_id === filters.trainer_id);
    }

    // Filter by status
    if (filters.status) {
      filteredCourses = filteredCourses.filter(c => c.status === filters.status);
    }

    // Filter by search (course name or description)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredCourses = filteredCourses.filter(
        c =>
          c.course_name.toLowerCase().includes(searchLower) ||
          (c.description && c.description.toLowerCase().includes(searchLower))
      );
    }

    // Apply pagination
    const total = filteredCourses.length;
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const offset = (page - 1) * limit;

    const paginatedCourses = filteredCourses.slice(offset, offset + limit);

    return paginatedCourses.map(c => new Course(c.toJSON()));
  }

  async findByTrainer(trainerId, filters = {}, pagination = {}) {
    // TODO: Replace with actual database SELECT with filters and pagination
    let filteredCourses = this.courses.filter(c => c.trainer_id === trainerId);

    // Filter by status
    if (filters.status) {
      filteredCourses = filteredCourses.filter(c => c.status === filters.status);
    }

    // Filter by search (course name or description)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredCourses = filteredCourses.filter(
        c =>
          c.course_name.toLowerCase().includes(searchLower) ||
          (c.description && c.description.toLowerCase().includes(searchLower))
      );
    }

    const total = filteredCourses.length;
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const offset = (page - 1) * limit;

    const paginatedCourses = filteredCourses.slice(offset, offset + limit);

    return {
      courses: paginatedCourses.map(c => new Course(c.toJSON())),
      total,
    };
  }

  async update(course) {
    // TODO: Replace with actual database UPDATE
    const index = this.courses.findIndex(c => c.course_id === course.course_id);

    if (index === -1) {
      return null;
    }

    const updatedCourse = new Course({
      ...course.toJSON(),
      updated_at: new Date().toISOString(),
    });

    this.courses[index] = updatedCourse;

    return updatedCourse;
  }

  async softDelete(courseId) {
    // TODO: Replace with actual database UPDATE (status = 'deleted')
    const course = await this.findById(courseId);

    if (course) {
      course.softDelete();
      await this.update(course);
    }
  }
}

