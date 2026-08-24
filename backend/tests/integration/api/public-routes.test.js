import request from 'supertest';
import app from '../../../server.js';

describe('Public and inter-service routes (unchanged by ownership)', () => {
  it('GET /health remains public', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('POST /api/exchange is not blocked by trainer auth', async () => {
    const response = await request(app)
      .post('/api/exchange')
      .send({ serviceName: 'unknown-service', payload: {} });

    expect(response.status).not.toBe(401);
  });

  it('POST /api/fill-content-metrics is not blocked by trainer auth', async () => {
    const response = await request(app)
      .post('/api/fill-content-metrics')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(response.status).not.toBe(401);
  });

  it('POST /api/fill-content-metrics course-builder-service START is unavailable when flag is off', async () => {
    const response = await request(app)
      .post('/api/fill-content-metrics')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({
        requester_service: 'course-builder-service',
        payload: {
          cs_generation_action: 'start_personalized_generation',
          parent_course_builder_job_id: 'cb-job-1',
          learning_path: { path_title: 'Path', learning_modules: [] },
        },
        response: {},
      }));

    expect(response.status).toBe(200);
    const body = typeof response.body === 'object' && Object.keys(response.body).length
      ? response.body
      : JSON.parse(response.text);
    expect(body.response.error).toBe('personalized_async_jobs_unavailable');
    expect(body.response.generation_job).toBeNull();
    expect(body.response.course).toBeUndefined();
  });
});
