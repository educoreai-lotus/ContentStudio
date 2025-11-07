import request from 'supertest';
import express from 'express';
import cors from 'cors';
import coursesRouter from '../../../src/presentation/routes/courses.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Create a test app instance
const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/courses', coursesRouter);
  app.use(errorHandler);
  return app;
};

const testApp = createTestApp();

describe('Courses API Integration Tests', () => {
  let createdCourseId;

  describe('POST /api/courses', () => {
    it('should create a course with valid data', async () => {
      const courseData = {
        course_name: 'Integration Test Course',
        description: 'Test Description',
        trainer_id: 'trainer123',
        skills: ['JavaScript', 'React'],
        language: 'en',
      };

      const response = await request(testApp)
        .post('/api/courses')
        .send(courseData)
        .expect(201);

      expect(response.body).toHaveProperty('course_id');
      expect(response.body.course_name).toBe(courseData.course_name);
      expect(response.body.description).toBe(courseData.description);
      expect(response.body.trainer_id).toBe(courseData.trainer_id);
      expect(response.body.skills).toEqual(courseData.skills);
      expect(response.body.language).toBe(courseData.language);
      expect(response.body.status).toBe('active');

      createdCourseId = response.body.course_id;
    });

    it('should return 400 if course_name is missing', async () => {
      const courseData = {
        trainer_id: 'trainer123',
      };

      const response = await request(testApp)
        .post('/api/courses')
        .send(courseData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Course name');
    });

    it('should return 400 if course_name is too short', async () => {
      const courseData = {
        course_name: 'AB',
        trainer_id: 'trainer123',
      };

      const response = await request(testApp)
        .post('/api/courses')
        .send(courseData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if trainer_id is missing', async () => {
      const courseData = {
        course_name: 'Test Course',
      };

      const response = await request(testApp)
        .post('/api/courses')
        .send(courseData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Trainer ID');
    });
  });

  describe('GET /api/courses', () => {
    it('should return list of courses', async () => {
      const response = await request(testApp)
        .get('/api/courses')
        .query({ trainer_id: 'trainer123' })
        .expect(200);

      expect(response.body).toHaveProperty('courses');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.courses)).toBe(true);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('total_pages');
    });

    it('should support pagination', async () => {
      const response = await request(testApp)
        .get('/api/courses')
        .query({ trainer_id: 'trainer123', page: 1, limit: 10 })
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter by status', async () => {
      const response = await request(testApp)
        .get('/api/courses')
        .query({ trainer_id: 'trainer123', status: 'active' })
        .expect(200);

      expect(response.body.courses).toBeDefined();
      if (response.body.courses.length > 0) {
        response.body.courses.forEach(course => {
          expect(course.status).toBe('active');
        });
      }
    });

    it('should support search', async () => {
      const response = await request(testApp)
        .get('/api/courses')
        .query({ trainer_id: 'trainer123', search: 'Integration' })
        .expect(200);

      expect(response.body.courses).toBeDefined();
      if (response.body.courses.length > 0) {
        const course = response.body.courses[0];
        expect(
          course.course_name.toLowerCase().includes('integration') ||
          (course.description && course.description.toLowerCase().includes('integration'))
        ).toBe(true);
      }
    });
  });

  describe('GET /api/courses/:id', () => {
    it('should return course by ID', async () => {
      if (!createdCourseId) {
        // Create a course first if needed
        const createResponse = await request(testApp)
          .post('/api/courses')
          .send({
            course_name: 'Get Test Course',
            trainer_id: 'trainer123',
          });
        createdCourseId = createResponse.body.course_id;
      }

      const response = await request(testApp)
        .get(`/api/courses/${createdCourseId}`)
        .expect(200);

      expect(response.body).toHaveProperty('course_id');
      expect(response.body.course_id).toBe(createdCourseId);
    });

    it('should return 404 if course not found', async () => {
      const response = await request(testApp)
        .get('/api/courses/99999')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('COURSE_NOT_FOUND');
    });
  });

  describe('PUT /api/courses/:id', () => {
    it('should update course', async () => {
      if (!createdCourseId) {
        const createResponse = await request(testApp)
          .post('/api/courses')
          .send({
            course_name: 'Update Test Course',
            trainer_id: 'trainer123',
          });
        createdCourseId = createResponse.body.course_id;
      }

      const updateData = {
        course_name: 'Updated Course Name',
        description: 'Updated description',
      };

      const response = await request(testApp)
        .put(`/api/courses/${createdCourseId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.course_name).toBe(updateData.course_name);
      expect(response.body.description).toBe(updateData.description);
    });

    it('should return 404 if course not found', async () => {
      const response = await request(testApp)
        .put('/api/courses/99999')
        .send({ course_name: 'Updated' })
        .expect(404);

      expect(response.body.error.code).toBe('COURSE_NOT_FOUND');
    });
  });

  describe('DELETE /api/courses/:id', () => {
    it('should soft delete course', async () => {
      // Create a course to delete
      const createResponse = await request(testApp)
        .post('/api/courses')
        .send({
          course_name: 'Delete Test Course',
          trainer_id: 'trainer123',
        });
      const courseIdToDelete = createResponse.body.course_id;

      const response = await request(testApp)
        .delete(`/api/courses/${courseIdToDelete}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify course is soft deleted
      const getResponse = await request(testApp)
        .get(`/api/courses/${courseIdToDelete}`)
        .expect(200);

      expect(getResponse.body.status).toBe('deleted');
    });
  });
});
