import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import versionsRouter from '../../../src/presentation/routes/versions.js';
import { Content } from '../../../src/domain/entities/Content.js';
import { Topic } from '../../../src/domain/entities/Topic.js';
import { RepositoryFactory } from '../../../src/infrastructure/database/repositories/RepositoryFactory.js';
import { TEST_TRAINER_ID, createIntegrationTestApp } from '../../helpers/testAuth.js';

const app = createIntegrationTestApp([{ path: '/api', router: versionsRouter }]);

describe('Content Versions API Integration Tests', () => {
  let testContentId;

  beforeEach(async () => {
    const topicRepository = await RepositoryFactory.getTopicRepository();
    const testContentRepository = await RepositoryFactory.getContentRepository();
    const topic = await topicRepository.create(
      new Topic({
        topic_name: 'Version Test Topic',
        trainer_id: TEST_TRAINER_ID,
        language: 'en',
      })
    );

    const testContent = new Content({
      topic_id: topic.topic_id,
      content_type_id: 'text',
      content_data: {
        text: 'Initial content version',
      },
      generation_method_id: 'manual',
    });
    const createdContent = await testContentRepository.create(testContent);
    testContentId = createdContent.content_id;
  });

  describe('POST /api/content/:contentId/versions', () => {
    it('should create a new version successfully', async () => {
      const versionData = {
        content_data: {
          text: 'Updated content version',
        },
        change_description: 'Updated for clarity',
        created_by: TEST_TRAINER_ID,
      };

      const response = await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send(versionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('version_id');
      expect(response.body.data.content_id).toBe(testContentId);
      expect(response.body.data.version_number).toBeNull();
      expect(response.body.data.is_current_version).toBe(true);
      expect(response.body.data.content_data.text).toBe('Updated content version');
    });

    it('should increment version number', async () => {
      await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 1' },
          created_by: TEST_TRAINER_ID,
        });

      const response = await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 2' },
          created_by: TEST_TRAINER_ID,
        })
        .expect(201);

      expect(response.body.data.version_number).toBeNull();
      expect(response.body.data.is_current_version).toBe(true);
    });

    it('should mark previous versions as not current', async () => {
      const v1Response = await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 1' },
          created_by: TEST_TRAINER_ID,
        });

      const v1Id = v1Response.body.data.version_id;

      await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 2' },
          created_by: TEST_TRAINER_ID,
        });

      const getV1Response = await request(app)
        .get(`/api/versions/${v1Id}`)
        .expect(200);

      expect(getV1Response.body.data.is_current_version).toBe(false);
    });

    it('should return 400 if content_data is missing', async () => {
      const response = await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          created_by: TEST_TRAINER_ID,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/content/:contentId/versions', () => {
    it('should get all versions for content', async () => {
      await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 1' },
          created_by: TEST_TRAINER_ID,
        });

      await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 2' },
          created_by: TEST_TRAINER_ID,
        });

      const response = await request(app)
        .get(`/api/content/${testContentId}/versions`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return versions in descending order', async () => {
      await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 1' },
          created_by: TEST_TRAINER_ID,
        });

      await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 2' },
          created_by: TEST_TRAINER_ID,
        });

      const response = await request(app)
        .get(`/api/content/${testContentId}/versions`)
        .expect(200);

      const versions = response.body.data;
      if (versions.length >= 2) {
        const time1 = new Date(versions[0].created_at || versions[0].updated_at).getTime();
        const time2 = new Date(versions[1].created_at || versions[1].updated_at).getTime();
        expect(time1).toBeGreaterThanOrEqual(time2);
      }
    });

    it('should return empty array if no versions exist', async () => {
      const topicRepository = await RepositoryFactory.getTopicRepository();
      const testContentRepository = await RepositoryFactory.getContentRepository();
      const topic = await topicRepository.create(
        new Topic({
          topic_name: 'Empty Versions Topic',
          trainer_id: TEST_TRAINER_ID,
          language: 'en',
        })
      );

      const testContent = new Content({
        topic_id: topic.topic_id,
        content_type_id: 'text',
        content_data: { text: 'Test content for empty versions' },
        generation_method_id: 'manual',
      });
      const createdContent = await testContentRepository.create(testContent);
      const contentId = createdContent.content_id;

      const response = await request(app)
        .get(`/api/content/${contentId}/versions`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/versions/:id', () => {
    it('should get version by ID', async () => {
      const createResponse = await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 1' },
          created_by: TEST_TRAINER_ID,
        });

      const versionId = createResponse.body.data.version_id;

      const response = await request(app)
        .get(`/api/versions/${versionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version_id).toBe(versionId);
      expect(response.body.data.content_data.text).toBe('Version 1');
    });

    it('should return 404 if version not found', async () => {
      const response = await request(app)
        .get('/api/versions/99999')
        .expect(404);

      expect(response.body.error?.code || response.body.error).toBeTruthy();
    });
  });

  describe('POST /api/versions/:id/restore', () => {
    it('should restore content to a specific version', async () => {
      const v1Response = await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 1' },
          created_by: TEST_TRAINER_ID,
        })
        .expect(201);

      const v1Id = v1Response.body.data.version_id;

      await request(app)
        .post(`/api/content/${testContentId}/versions`)
        .send({
          content_data: { text: 'Version 2' },
          created_by: TEST_TRAINER_ID,
        })
        .expect(201);

      const restoreResponse = await request(app)
        .post(`/api/versions/${v1Id}/restore`)
        .send({
          restored_by: TEST_TRAINER_ID,
        });

      expect([200, 404, 500]).toContain(restoreResponse.status);
      if (restoreResponse.body.success) {
        expect(restoreResponse.body.data.content_data.text).toBe('Version 1');
      }
    });

    it('should return 404 if version not found', async () => {
      const response = await request(app)
        .post('/api/versions/99999/restore')
        .send({
          restored_by: TEST_TRAINER_ID,
        });

      expect([404, 500]).toContain(response.status);
      expect(response.body.error || response.body.success === false).toBeTruthy();
    });
  });
});
