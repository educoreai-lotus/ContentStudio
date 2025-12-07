import request from 'supertest';
import app from '../server.js';

describe('Health Check', () => {
  it('should return 200 and healthy status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('content-studio');
    expect(response.body.version).toBeDefined();
  });
});

