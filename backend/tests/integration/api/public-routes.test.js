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
});
