import { jest } from '@jest/globals';
import { Course } from '../../../../src/domain/entities/Course.js';
import { Topic } from '../../../../src/domain/entities/Topic.js';
import { Content } from '../../../../src/domain/entities/Content.js';
import { Template } from '../../../../src/domain/entities/Template.js';
import { CourseRepository } from '../../../../src/infrastructure/database/repositories/CourseRepository.js';
import { TopicRepository } from '../../../../src/infrastructure/database/repositories/TopicRepository.js';
import { ContentRepository } from '../../../../src/infrastructure/database/repositories/ContentRepository.js';
import { TemplateRepository } from '../../../../src/infrastructure/database/repositories/TemplateRepository.js';
import { OwnershipService } from '../../../../src/application/services/OwnershipService.js';
import {
  OwnershipNotFoundError,
  OwnershipUnauthorizedError,
} from '../../../../src/application/services/ownershipErrors.js';
import {
  requireAuthenticatedTrainerId,
  respondToOwnershipError,
} from '../../../../src/presentation/middleware/ownershipHelpers.js';

describe('OwnershipService (in-memory)', () => {
  let ownershipService;
  let courseRepository;
  let topicRepository;
  let contentRepository;
  let templateRepository;

  beforeEach(async () => {
    courseRepository = new CourseRepository(null);
    topicRepository = new TopicRepository(null);
    contentRepository = new ContentRepository();
    templateRepository = new TemplateRepository();

    ownershipService = new OwnershipService();
    jest.spyOn(ownershipService, 'getCourseRepository').mockResolvedValue(courseRepository);
    jest.spyOn(ownershipService, 'getTopicRepository').mockResolvedValue(topicRepository);
    jest.spyOn(ownershipService, 'getContentRepository').mockResolvedValue(contentRepository);
    jest.spyOn(ownershipService, 'getTemplateRepository').mockResolvedValue(templateRepository);

    await courseRepository.create(
      new Course({
        course_name: 'Trainer X Course',
        trainer_id: 'trainer-x',
        description: 'owned by X',
      })
    );

    await topicRepository.create(
      new Topic({
        topic_name: 'Trainer X Topic',
        trainer_id: 'trainer-x',
        course_id: null,
        language: 'en',
      })
    );

    await topicRepository.create(
      new Topic({
        topic_name: 'Trainer Y Topic',
        trainer_id: 'trainer-y',
        course_id: null,
        language: 'en',
      })
    );

    await contentRepository.create(
      new Content({
        topic_id: 1,
        content_type_id: 1,
        content_data: { text: 'hello' },
        generation_method_id: 'manual',
      })
    );

    await templateRepository.create(
      new Template({
        template_name: 'Custom Template',
        template_type: 'manual',
        format_order: ['text_audio', 'code', 'presentation', 'mind_map', 'avatar_video'],
        created_by: 'trainer-y',
      })
    );
  });

  it('allows trainer X to access own course', async () => {
    const course = await ownershipService.assertTrainerOwnsCourse(1, 'trainer-x');
    expect(course.trainer_id).toBe('trainer-x');
  });

  it('denies trainer Y access to trainer X course', async () => {
    await expect(ownershipService.assertTrainerOwnsCourse(1, 'trainer-y')).rejects.toThrow(
      OwnershipNotFoundError
    );
  });

  it('denies trainer Y access to trainer X topic', async () => {
    await expect(ownershipService.assertTrainerOwnsTopic(1, 'trainer-y')).rejects.toThrow(
      OwnershipNotFoundError
    );
  });

  it('denies trainer Y access to content under trainer X topic', async () => {
    await expect(ownershipService.assertTrainerOwnsContent(1, 'trainer-y')).rejects.toThrow(
      OwnershipNotFoundError
    );
  });

  it('denies trainer Y from listing content under trainer X topic', async () => {
    await expect(ownershipService.assertTrainerOwnsTopic(1, 'trainer-y')).rejects.toThrow(
      OwnershipNotFoundError
    );
  });

  it('allows trainer X to read system templates', async () => {
    const systemTemplate = await templateRepository.findAll({ readableByTrainer: 'trainer-x' });
    expect(systemTemplate.some(t => t.created_by === 'system')).toBe(true);
    const readable = await ownershipService.assertTrainerCanReadTemplate(1, 'trainer-x');
    expect(readable.created_by).toBe('system');
  });

  it('denies trainer X from mutating system templates', async () => {
    await expect(ownershipService.assertTrainerOwnsTemplate(1, 'trainer-x')).rejects.toThrow(
      OwnershipNotFoundError
    );
  });

  it('denies trainer X from mutating trainer Y custom template', async () => {
    const custom = (await templateRepository.findAll()).find(t => t.created_by === 'trainer-y');
    await expect(
      ownershipService.assertTrainerOwnsTemplate(custom.template_id, 'trainer-x')
    ).rejects.toThrow(OwnershipNotFoundError);
  });
});

describe('ownershipHelpers', () => {
  it('requireAuthenticatedTrainerId returns 401 when missing', () => {
    expect(() => requireAuthenticatedTrainerId({ user: {} })).toThrow(OwnershipUnauthorizedError);
  });

  it('respondToOwnershipError returns 401 JSON', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const handled = respondToOwnershipError(new OwnershipUnauthorizedError(), res);
    expect(handled).toBe(true);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('respondToOwnershipError returns 404 JSON', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const handled = respondToOwnershipError(new OwnershipNotFoundError(), res);
    expect(handled).toBe(true);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Search directoryUserId safety', () => {
  it('requireAuthenticatedTrainerId rejects empty directory user id', () => {
    expect(() =>
      requireAuthenticatedTrainerId({ user: { directoryUserId: '', isTrainer: true } })
    ).toThrow(OwnershipUnauthorizedError);
  });
});
