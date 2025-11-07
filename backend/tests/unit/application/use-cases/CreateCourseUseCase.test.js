import { jest } from '@jest/globals';
import { CreateCourseUseCase } from '../../../../src/application/use-cases/CreateCourseUseCase.js';
import { Course } from '../../../../src/domain/entities/Course.js';

describe('CreateCourseUseCase', () => {
  let mockCourseRepository;
  let createCourseUseCase;

  beforeEach(() => {
    mockCourseRepository = {
      create: jest.fn(),
    };

    createCourseUseCase = new CreateCourseUseCase(mockCourseRepository);
  });

  it('should create a course successfully', async () => {
    const courseData = {
      course_name: 'Introduction to React',
      description: 'Learn React fundamentals',
      trainer_id: 'trainer123',
      skills: ['JavaScript', 'React'],
      language: 'en',
    };

    const createdCourse = new Course({
      ...courseData,
      course_id: 1,
      status: 'active',
    });

    mockCourseRepository.create.mockResolvedValue(createdCourse);

    const result = await createCourseUseCase.execute(courseData);

    expect(result).toEqual(createdCourse);
    expect(mockCourseRepository.create).toHaveBeenCalledWith(
      expect.any(Course)
    );
    expect(mockCourseRepository.create).toHaveBeenCalledTimes(1);
  });

  it('should throw error if course name is invalid', async () => {
    const courseData = {
      course_name: 'AB', // Too short
      trainer_id: 'trainer123',
    };

    await expect(createCourseUseCase.execute(courseData)).rejects.toThrow(
      'Course name must be between 3 and 255 characters'
    );

    expect(mockCourseRepository.create).not.toHaveBeenCalled();
  });

  it('should throw error if trainer_id is missing', async () => {
    const courseData = {
      course_name: 'Test Course',
    };

    await expect(createCourseUseCase.execute(courseData)).rejects.toThrow(
      'Trainer ID is required'
    );

    expect(mockCourseRepository.create).not.toHaveBeenCalled();
  });

  it('should handle repository errors', async () => {
    const courseData = {
      course_name: 'Test Course',
      trainer_id: 'trainer123',
    };

    const repositoryError = new Error('Database connection failed');
    mockCourseRepository.create.mockRejectedValue(repositoryError);

    await expect(createCourseUseCase.execute(courseData)).rejects.toThrow(
      'Database connection failed'
    );
  });
});

