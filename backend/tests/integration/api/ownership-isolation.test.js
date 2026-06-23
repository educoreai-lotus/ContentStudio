import request from 'supertest';
import coursesRouter from '../../../src/presentation/routes/courses.js';
import topicsRouter from '../../../src/presentation/routes/topics.js';
import searchRouter from '../../../src/presentation/routes/search.js';
import {
  TEST_TRAINER_B,
  createIntegrationTestApp,
} from '../../helpers/testAuth.js';

describe('Trainer ownership isolation (API)', () => {
  let courseId;
  let topicId;

  beforeAll(async () => {
    const createCourseApp = createIntegrationTestApp([
      { path: '/api/courses', router: coursesRouter },
    ]);
    const courseRes = await request(createCourseApp)
      .post('/api/courses')
      .send({ course_name: 'Isolation Test Course', description: 'owned by X' });
    expect(courseRes.status).toBe(201);
    courseId = courseRes.body.course_id;
    expect(courseId).toBeDefined();

    const createTopicApp = createIntegrationTestApp([
      { path: '/api/topics', router: topicsRouter },
    ]);
    const topicRes = await request(createTopicApp)
      .post('/api/topics')
      .send({ topic_name: 'Isolation Test Topic', language: 'en' });
    expect(topicRes.status).toBe(201);
    topicId = topicRes.body.topic_id;
    expect(topicId).toBeDefined();
  }, 60000);

  describe('Courses', () => {
    const appY = createIntegrationTestApp(
      [{ path: '/api/courses', router: coursesRouter }],
      { user: TEST_TRAINER_B }
    );

    it('trainer Y cannot get trainer X course by id', async () => {
      const res = await request(appY).get(`/api/courses/${courseId}`);
      expect(res.status).toBe(404);
    });

    it('trainer Y cannot update trainer X course', async () => {
      const res = await request(appY)
        .put(`/api/courses/${courseId}`)
        .send({ course_name: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    it('trainer Y cannot delete trainer X course', async () => {
      const res = await request(appY).delete(`/api/courses/${courseId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Topics', () => {
    const appY = createIntegrationTestApp(
      [{ path: '/api/topics', router: topicsRouter }],
      { user: TEST_TRAINER_B }
    );

    it('trainer Y cannot get trainer X topic by id', async () => {
      const res = await request(appY).get(`/api/topics/${topicId}`);
      expect(res.status).toBe(404);
    });

    it('trainer Y cannot update trainer X topic', async () => {
      const res = await request(appY)
        .put(`/api/topics/${topicId}`)
        .send({ topic_name: 'Hijacked Topic' });
      expect(res.status).toBe(404);
    });

    it('trainer Y cannot delete trainer X topic', async () => {
      const res = await request(appY).delete(`/api/topics/${topicId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Search', () => {
    it('returns 401 when directoryUserId is missing', async () => {
      const app = createIntegrationTestApp(
        [{ path: '/api/search', router: searchRouter }],
        { authenticated: false }
      );
      const res = await request(app).get('/api/search').query({ q: 'test' });
      expect(res.status).toBe(401);
    });
  });
});
