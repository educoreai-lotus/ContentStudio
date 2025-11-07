import { Course } from '../../../../src/domain/entities/Course.js';

describe('Course Entity', () => {
  describe('constructor', () => {
    it('should create a course with valid data', () => {
      const courseData = {
        course_id: 1,
        course_name: 'Introduction to React',
        description: 'Learn React fundamentals',
        trainer_id: 'trainer123',
        skills: ['JavaScript', 'React'],
        language: 'en',
        status: 'active',
      };

      const course = new Course(courseData);

      expect(course.course_id).toBe(1);
      expect(course.course_name).toBe('Introduction to React');
      expect(course.description).toBe('Learn React fundamentals');
      expect(course.trainer_id).toBe('trainer123');
      expect(course.skills).toEqual(['JavaScript', 'React']);
      expect(course.language).toBe('en');
      expect(course.status).toBe('active');
    });

    it('should set default status to active if not provided', () => {
      const courseData = {
        course_name: 'Test Course',
        trainer_id: 'trainer123',
      };

      const course = new Course(courseData);

      expect(course.status).toBe('active');
    });

    it('should set default language to en if not provided', () => {
      const courseData = {
        course_name: 'Test Course',
        trainer_id: 'trainer123',
      };

      const course = new Course(courseData);

      expect(course.language).toBe('en');
    });
  });

  describe('validation', () => {
    it('should throw error if course_name is missing', () => {
      const courseData = {
        trainer_id: 'trainer123',
      };

      expect(() => new Course(courseData)).toThrow('Course name is required');
    });

    it('should throw error if course_name is too short', () => {
      const courseData = {
        course_name: 'AB',
        trainer_id: 'trainer123',
      };

      expect(() => new Course(courseData)).toThrow(
        'Course name must be between 3 and 255 characters'
      );
    });

    it('should throw error if course_name is too long', () => {
      const courseData = {
        course_name: 'A'.repeat(256),
        trainer_id: 'trainer123',
      };

      expect(() => new Course(courseData)).toThrow(
        'Course name must be between 3 and 255 characters'
      );
    });

    it('should throw error if trainer_id is missing', () => {
      const courseData = {
        course_name: 'Test Course',
      };

      expect(() => new Course(courseData)).toThrow('Trainer ID is required');
    });

    it('should throw error if description is too long', () => {
      const courseData = {
        course_name: 'Test Course',
        trainer_id: 'trainer123',
        description: 'A'.repeat(2001),
      };

      expect(() => new Course(courseData)).toThrow(
        'Description must not exceed 2000 characters'
      );
    });
  });

  describe('softDelete', () => {
    it('should update status to deleted', () => {
      const course = new Course({
        course_name: 'Test Course',
        trainer_id: 'trainer123',
        status: 'active',
      });

      course.softDelete();

      expect(course.status).toBe('deleted');
    });
  });

  describe('archive', () => {
    it('should update status to archived', () => {
      const course = new Course({
        course_name: 'Test Course',
        trainer_id: 'trainer123',
        status: 'active',
      });

      course.archive();

      expect(course.status).toBe('archived');
    });
  });
});

