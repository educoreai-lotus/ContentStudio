/**
 * PublishCourseUseCase snapshot reuse — parity + call-count regression.
 *
 * FrozenOriginalPublishBehavior is a literal capture of validateCourse / buildCourseObject /
 * isContentEmpty / getContentTypeName as they existed before snapshot reuse. Tests compare
 * optimized output against this reference so business logic is not silently simplified.
 */
import { jest } from '@jest/globals';

/** Frozen pre-optimization dual-load behavior (for golden parity only). */
class FrozenOriginalPublishBehavior {
  constructor({ courseRepository, topicRepository, contentRepository, templateRepository }) {
    this.courseRepository = courseRepository;
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
    this.templateRepository = templateRepository;
  }

  isContentEmpty(contentData, formatName) {
    if (!contentData || typeof contentData !== 'object') {
      return true;
    }
    switch (formatName) {
      case 'text':
      case 'audio':
        return !contentData.text || contentData.text.trim().length === 0;
      case 'code':
        return !contentData.code || contentData.code.trim().length === 0;
      case 'presentation':
        return !contentData.presentationUrl && !contentData.fileUrl;
      case 'mind_map':
        return !contentData.nodes || !Array.isArray(contentData.nodes) || contentData.nodes.length === 0;
      case 'avatar_video':
        return !contentData.videoUrl;
      default:
        return Object.keys(contentData).length === 0;
    }
  }

  getContentTypeName(typeId) {
    const typeMap = {
      1: 'text_audio',
      2: 'code',
      3: 'presentation',
      4: 'audio',
      5: 'mind_map',
      6: 'avatar_video',
    };
    return typeMap[typeId] || 'unknown';
  }

  async validateCourse(courseId) {
    const errors = [];
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }
    const topics = await this.topicRepository.findByCourseId(courseId);
    if (!topics || topics.length === 0) {
      errors.push({
        topic: 'Course',
        issue: 'Course has no lessons/topics. Add at least one lesson before transferring.',
      });
      return { valid: false, errors };
    }

    for (const topic of topics) {
      if (!topic.template_id) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'A template has not been selected for this lesson',
        });
        continue;
      }

      const template = await this.templateRepository.findById(topic.template_id);
      if (!template) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'Selected template not found',
        });
        continue;
      }

      const formatOrder = template.format_order || [];
      if (!Array.isArray(formatOrder) || formatOrder.length === 0) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'Template has no format order defined',
        });
        continue;
      }

      const contents = await this.contentRepository.findAllByTopicId(topic.topic_id);
      const contentByType = {};
      const typeIds = contents.map((c) => c.content_type_id).filter((id) => typeof id === 'number');
      if (typeIds.length > 0) {
        const typeNameMap = await this.contentRepository.getContentTypeNamesByIds(typeIds);
        contents.forEach((content) => {
          const typeId = content.content_type_id;
          const typeName = typeof typeId === 'string' ? typeId : typeNameMap.get(typeId) || typeId;
          const normalizedTypeName = String(typeName).trim();
          if (normalizedTypeName === 'text_audio' || normalizedTypeName === 'text') {
            contentByType['text'] = content;
            contentByType['audio'] = content;
            contentByType['text_audio'] = content;
          } else if (normalizedTypeName === 'audio') {
            contentByType['audio'] = content;
            contentByType['text_audio'] = content;
          } else {
            contentByType[normalizedTypeName] = content;
          }
        });
      }

      const formatNameToDbName = {
        text: 'text_audio',
        code: 'code',
        presentation: 'presentation',
        audio: 'text_audio',
        mind_map: 'mind_map',
        avatar_video: 'avatar_video',
      };

      for (const formatName of formatOrder) {
        const dbTypeName = formatNameToDbName[formatName] || formatName;
        const content = contentByType[formatName] || contentByType[dbTypeName];
        if (!content) {
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Required format '${formatName}' has not been generated for this lesson`,
          });
          continue;
        }

        let contentData;
        try {
          contentData =
            typeof content.content_data === 'string'
              ? JSON.parse(content.content_data)
              : content.content_data || {};
        } catch {
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Content data for format '${formatName}' is invalid (parse error)`,
          });
          continue;
        }

        if (content.content_type_id === 6) {
          if (!contentData.videoUrl || contentData.error) {
            errors.push({
              topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
              issue: `Avatar video generation failed or is incomplete for format '${formatName}'`,
            });
          }
        } else if (contentData.status === 'failed') {
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Content generation failed for format '${formatName}'`,
          });
        }

        if (this.isContentEmpty(contentData, formatName)) {
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Content for format '${formatName}' is empty or incomplete`,
          });
        }
      }

      const hasValidExercises = (exercises) => {
        if (!exercises) return false;
        if (typeof exercises === 'string') {
          try {
            return hasValidExercises(JSON.parse(exercises));
          } catch {
            return exercises.trim().length > 0;
          }
        }
        if (Array.isArray(exercises)) return exercises.length > 0;
        if (typeof exercises === 'object') {
          if (exercises.questions && Array.isArray(exercises.questions) && exercises.questions.length > 0) {
            return true;
          }
          if (exercises.html && typeof exercises.html === 'string' && exercises.html.trim().length > 0) {
            return true;
          }
          const keys = Object.keys(exercises);
          return keys.length > 0 && keys.some((key) => key !== 'metadata');
        }
        return false;
      };

      if (!hasValidExercises(topic.devlab_exercises)) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'DevLab exercises are missing or invalid',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async buildCourseObject(courseId) {
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }
    const topics = await this.topicRepository.findByCourseId(courseId);
    const topicsData = [];
    for (const topic of topics) {
      const template = await this.templateRepository.findById(topic.template_id);
      const contents = await this.contentRepository.findAllByTopicId(topic.topic_id);
      let devlabExercises = topic.devlab_exercises || null;
      let devlabExercisesString = '';
      if (devlabExercises) {
        if (typeof devlabExercises === 'string') {
          devlabExercisesString = devlabExercises;
        } else if (typeof devlabExercises === 'object') {
          devlabExercisesString = JSON.stringify(devlabExercises);
        }
      }
      const contentTypeIds = contents.map((c) => c.content_type_id).filter((id) => typeof id === 'number');
      const typeNameMap =
        contentTypeIds.length > 0
          ? await this.contentRepository.getContentTypeNamesByIds(contentTypeIds)
          : new Map();

      const contentsData = contents.map((content) => {
        const contentData =
          typeof content.content_data === 'string'
            ? JSON.parse(content.content_data)
            : content.content_data || {};
        let contentType = 'unknown';
        if (typeof content.content_type_id === 'number') {
          const typeName = typeNameMap.get(content.content_type_id);
          contentType = typeName ? String(typeName).trim() : this.getContentTypeName(content.content_type_id);
        } else {
          contentType = String(content.content_type_id).trim();
        }
        const dbToTemplateMap = {
          text_audio: 'text_audio',
          code: 'code',
          presentation: 'presentation',
          audio: 'text_audio',
          mind_map: 'mind_map',
          avatar_video: 'avatar_video',
        };
        contentType = dbToTemplateMap[contentType] || contentType;
        if (contentType === 'avatar_video' && contentData) {
          if (!contentData.fileUrl && contentData.videoUrl) {
            if (
              contentData.videoUrl.includes('/storage/v1/object/public/') ||
              contentData.videoUrl.includes('supabase.co/storage')
            ) {
              contentData.fileUrl = contentData.videoUrl;
            }
          }
          if (!contentData.fileUrl && contentData.videoUrl) {
            contentData.fileUrl = contentData.videoUrl;
          }
        }
        return {
          content_id: String(content.content_id),
          content_type: contentType,
          content_data: contentData,
        };
      });

      topicsData.push({
        topic_id: String(topic.topic_id),
        topic_name: topic.topic_name || '',
        topic_description: topic.description || '',
        topic_language: topic.language || 'en',
        template_id: String(topic.template_id),
        format_order: template?.format_order || [],
        contents: contentsData,
        devlab_exercises: devlabExercisesString,
      });
    }

    return {
      course_id: String(course.course_id),
      course_name: course.course_name || '',
      course_description: course.description || '',
      course_language: course.language || 'en',
      trainer_id: course.trainer_id || '',
      trainer_name: course.trainer_id || '',
      topics: topicsData,
    };
  }
}

const TYPE_NAME_MAP = new Map([
  [1, 'text_audio'],
  [2, 'code'],
  [3, 'presentation'],
  [5, 'mind_map'],
  [6, 'avatar_video'],
]);

function makeCourse(overrides = {}) {
  return {
    course_id: 51,
    course_name: 'Large Course',
    description: 'Desc',
    language: 'en',
    trainer_id: 'trainer-1',
    status: 'active',
    ...overrides,
  };
}

function makeTopic(id, overrides = {}) {
  return {
    topic_id: id,
    topic_name: `Lesson ${id}`,
    description: `Description ${id}`,
    language: 'en',
    template_id: 10,
    created_at: new Date(2024, 0, id),
    devlab_exercises: { questions: [{ q: `Q${id}` }], html: '<p>ok</p>' },
    ...overrides,
  };
}

function makeContentsForTopic(topicId, { includeAvatar = true } = {}) {
  const contents = [
    {
      content_id: topicId * 100 + 1,
      topic_id: topicId,
      content_type_id: 1,
      content_data: { text: `Text for ${topicId}` },
      status: 'active',
    },
    {
      content_id: topicId * 100 + 2,
      topic_id: topicId,
      content_type_id: 2,
      content_data: { code: `console.log(${topicId})` },
      status: 'active',
    },
    {
      content_id: topicId * 100 + 3,
      topic_id: topicId,
      content_type_id: 3,
      content_data: { presentationUrl: `https://example.com/p/${topicId}` },
      status: 'active',
    },
    {
      content_id: topicId * 100 + 5,
      topic_id: topicId,
      content_type_id: 5,
      content_data: { nodes: [{ id: 'n1' }] },
      status: 'active',
    },
  ];
  if (includeAvatar) {
    contents.push({
      content_id: topicId * 100 + 6,
      topic_id: topicId,
      content_type_id: 6,
      content_data: {
        videoUrl: `https://xyz.supabase.co/storage/v1/object/public/videos/${topicId}.mp4`,
      },
      status: 'active',
    });
  }
  return contents;
}

function createCountingRepos(fixture) {
  const counts = {
    findByIdCourse: 0,
    findByCourseId: 0,
    findByIdTemplate: 0,
    findAllByTopicId: 0,
    getContentTypeNamesByIds: 0,
    findAllByTopicIdArgs: [],
  };

  const courseRepository = {
    findById: jest.fn(async (id) => {
      counts.findByIdCourse += 1;
      return fixture.course?.course_id === id ? structuredClone(fixture.course) : null;
    }),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const topicRepository = {
    findByCourseId: jest.fn(async () => {
      counts.findByCourseId += 1;
      return structuredClone(fixture.topics);
    }),
    incrementUsageCount: jest.fn().mockResolvedValue(undefined),
  };

  const templateRepository = {
    findById: jest.fn(async (id) => {
      counts.findByIdTemplate += 1;
      const t = fixture.templates[id];
      return t ? structuredClone(t) : null;
    }),
  };

  const contentRepository = {
    findAllByTopicId: jest.fn(async (topicId, filters = {}) => {
      counts.findAllByTopicId += 1;
      counts.findAllByTopicIdArgs.push({ topicId, filters });
      const all = fixture.contentsByTopic[topicId] || [];
      // Mirror PostgreSQLContentRepository default: exclude archived unless includeArchived
      if (!filters.includeArchived) {
        return structuredClone(all.filter((c) => c.status !== 'archived' && c.quality_check_status !== 'deleted'));
      }
      return structuredClone(all);
    }),
    getContentTypeNamesByIds: jest.fn(async (ids) => {
      counts.getContentTypeNamesByIds += 1;
      const map = new Map();
      for (const id of ids) {
        if (TYPE_NAME_MAP.has(id)) map.set(id, TYPE_NAME_MAP.get(id));
      }
      return map;
    }),
  };

  return {
    counts,
    repos: {
      courseRepository,
      topicRepository,
      contentRepository,
      templateRepository,
      exerciseRepository: {},
    },
  };
}

function representativeFixture() {
  const formatOrder = ['text', 'code', 'presentation', 'mind_map', 'avatar_video'];
  const topics = [
    makeTopic(1, {
      topic_name: 'Zebra Lesson',
      created_at: new Date('2024-01-03'),
      devlab_exercises: { questions: [{ q: 'obj' }] },
    }),
    makeTopic(2, {
      topic_name: 'Alpha Lesson',
      created_at: new Date('2024-01-01'),
      // string DevLab
      devlab_exercises: JSON.stringify({ html: '<div>lab</div>', questions: [{ q: 1 }] }),
    }),
    makeTopic(3, {
      topic_name: 'Middle Lesson',
      created_at: new Date('2024-01-02'),
      // array DevLab
      devlab_exercises: [{ id: 1 }],
      // avatar without supabase path → still fileUrl fallback
    }),
  ];
  // Order as findByCourseId would return (created_at ASC)
  topics.sort((a, b) => a.created_at - b.created_at);

  const contentsByTopic = {
    1: makeContentsForTopic(1),
    2: makeContentsForTopic(2),
    3: [
      ...makeContentsForTopic(3, { includeAvatar: false }),
      {
        content_id: 306,
        topic_id: 3,
        content_type_id: 6,
        content_data: { videoUrl: 'https://cdn.example.com/video-3.mp4' },
        status: 'active',
      },
      // archived row must be excluded by default filters
      {
        content_id: 399,
        topic_id: 3,
        content_type_id: 2,
        content_data: { code: 'archived' },
        status: 'archived',
      },
      {
        content_id: 398,
        topic_id: 3,
        content_type_id: 2,
        content_data: { code: 'deleted' },
        quality_check_status: 'deleted',
        status: 'active',
      },
    ],
  };

  return {
    course: makeCourse(),
    topics,
    templates: {
      10: { template_id: 10, format_order: formatOrder },
    },
    contentsByTopic,
  };
}

describe('PublishCourseUseCase snapshot reuse', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  async function loadUseCase(repos) {
    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    const { PublishCourseUseCase } = await import(
      '../../../../src/application/use-cases/PublishCourseUseCase.js'
    );
    return new PublishCourseUseCase(repos);
  }

  it('golden payload parity against frozen original buildCourseObject', async () => {
    const fixture = representativeFixture();
    const { repos: reposA } = createCountingRepos(fixture);
    const { repos: reposB } = createCountingRepos(fixture);

    const original = new FrozenOriginalPublishBehavior(reposA);
    const optimized = await loadUseCase(reposB);

    const expected = await original.buildCourseObject(51);
    const actual = await optimized.buildCourseObject(51);

    expect(actual).toEqual(expected);
    expect(actual.topics.map((t) => t.topic_id)).toEqual(['2', '3', '1']);
    expect(actual.topics[0].format_order).toEqual([
      'text',
      'code',
      'presentation',
      'mind_map',
      'avatar_video',
    ]);
    // DevLab string / object / array
    expect(typeof actual.topics[0].devlab_exercises).toBe('string');
    expect(actual.topics[0].devlab_exercises).toContain('lab');
    expect(actual.topics[1].devlab_exercises).toBe(JSON.stringify([{ id: 1 }]));
    expect(actual.topics[2].devlab_exercises).toContain('obj');
    // Avatar supabase → fileUrl set; non-supabase also fallback
    const avatar2 = actual.topics[0].contents.find((c) => c.content_type === 'avatar_video');
    expect(avatar2.content_data.fileUrl).toBe(avatar2.content_data.videoUrl);
    const avatar3 = actual.topics[1].contents.find((c) => c.content_type === 'avatar_video');
    expect(avatar3.content_data.fileUrl).toBe('https://cdn.example.com/video-3.mp4');
    // Archived / deleted excluded
    for (const topic of actual.topics) {
      expect(topic.contents.some((c) => c.content_id === '399' || c.content_id === '398')).toBe(false);
    }
  });

  it('identical successful validation vs frozen original', async () => {
    const fixture = representativeFixture();
    const { repos: reposA } = createCountingRepos(fixture);
    const { repos: reposB } = createCountingRepos(fixture);
    const original = new FrozenOriginalPublishBehavior(reposA);
    const optimized = await loadUseCase(reposB);

    expect(await optimized.validateCourse(51)).toEqual(await original.validateCourse(51));
  });

  it('identical validation errors and ordering vs frozen original', async () => {
    const fixture = representativeFixture();
    fixture.topics[0] = makeTopic(2, {
      topic_name: 'Alpha Lesson',
      created_at: new Date('2024-01-01'),
      template_id: null,
      devlab_exercises: null,
    });
    fixture.topics[1] = makeTopic(3, {
      topic_name: 'Middle Lesson',
      created_at: new Date('2024-01-02'),
      template_id: 10,
      devlab_exercises: { questions: [{ q: 1 }] },
    });
    fixture.contentsByTopic[3] = [
      {
        content_id: 301,
        content_type_id: 1,
        content_data: { text: '' },
        status: 'active',
      },
    ];
    fixture.topics[2] = makeTopic(1, {
      topic_name: 'Zebra Lesson',
      created_at: new Date('2024-01-03'),
      template_id: 99,
      devlab_exercises: { questions: [{ q: 1 }] },
    });

    const { repos: reposA } = createCountingRepos(fixture);
    const { repos: reposB } = createCountingRepos(fixture);
    const original = new FrozenOriginalPublishBehavior(reposA);
    const optimized = await loadUseCase(reposB);

    const expected = await original.validateCourse(51);
    const actual = await optimized.validateCourse(51);
    expect(actual).toEqual(expected);
    expect(actual.valid).toBe(false);
    expect(actual.errors.length).toBeGreaterThan(0);
    expect(actual.errors.map((e) => `${e.topic}|${e.issue}`)).toEqual(
      expected.errors.map((e) => `${e.topic}|${e.issue}`)
    );
  });

  it('execute loads each required repository item once before transfer (not twice)', async () => {
    const fixture = representativeFixture();
    const { counts, repos } = createCountingRepos(fixture);

    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    jest.unstable_mockModule(
      '../../../../src/infrastructure/directoryClient/directoryClient.js',
      () => ({ updateCourseStatusInDirectory: jest.fn().mockResolvedValue({}) })
    );
    const sendCourseToCourseBuilder = jest.fn().mockResolvedValue({ status: 'published' });
    jest.unstable_mockModule(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js',
      () => ({ sendCourseToCourseBuilder })
    );
    jest.unstable_mockModule(
      '../../../../src/application/use-cases/cleanupContentHistoryOnArchive.js',
      () => ({
        CleanupContentHistoryOnArchive: class {
          async cleanupCourseHistory() {
            return { topicsProcessed: 0, deletedFromStorage: 0, deletedFromDatabase: 0, errors: [] };
          }
        },
      })
    );

    const { PublishCourseUseCase } = await import(
      '../../../../src/application/use-cases/PublishCourseUseCase.js'
    );
    const useCase = new PublishCourseUseCase(repos);

    // Spy: capture counts after validate+build phase by wrapping send
    let countsBeforeArchive;
    sendCourseToCourseBuilder.mockImplementation(async () => {
      countsBeforeArchive = { ...counts };
      return { status: 'published' };
    });

    await useCase.execute(51, { publisherTrainerId: 'trainer-1', organizationId: 'org-1' });

    expect(countsBeforeArchive.findByIdCourse).toBe(1);
    expect(countsBeforeArchive.findByCourseId).toBe(1);
    expect(countsBeforeArchive.findByIdTemplate).toBe(fixture.topics.length);
    expect(countsBeforeArchive.findAllByTopicId).toBe(fixture.topics.length);
    expect(countsBeforeArchive.getContentTypeNamesByIds).toBe(fixture.topics.length);
    // Default filters: no includeArchived
    expect(countsBeforeArchive.findAllByTopicIdArgs.every((a) => !a.filters?.includeArchived)).toBe(
      true
    );

    expect(sendCourseToCourseBuilder).toHaveBeenCalledTimes(1);
    expect(repos.courseRepository.update).toHaveBeenCalledWith(51, { status: 'archived' });
  });

  it('synthetic 144-topic course: ~50% fewer content/template reads vs dual-load original', async () => {
    const N = 144;
    const topics = [];
    const contentsByTopic = {};
    for (let i = 1; i <= N; i += 1) {
      topics.push(
        makeTopic(i, {
          created_at: new Date(2024, 0, 1, 0, 0, i),
          topic_name: `L${String(i).padStart(3, '0')}`,
        })
      );
      contentsByTopic[i] = makeContentsForTopic(i);
    }
    const fixture = {
      course: makeCourse({ course_id: 51, course_name: 'Course 51' }),
      topics,
      templates: { 10: { template_id: 10, format_order: ['text', 'code', 'presentation', 'mind_map', 'avatar_video'] } },
      contentsByTopic,
    };

    const originalCounts = createCountingRepos(fixture);
    const optimizedCounts = createCountingRepos(fixture);

    const original = new FrozenOriginalPublishBehavior(originalCounts.repos);
    await original.validateCourse(51);
    await original.buildCourseObject(51);

    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    jest.unstable_mockModule(
      '../../../../src/infrastructure/directoryClient/directoryClient.js',
      () => ({ updateCourseStatusInDirectory: jest.fn().mockResolvedValue({}) })
    );
    const sendCourseToCourseBuilder = jest.fn().mockResolvedValue({ status: 'published' });
    jest.unstable_mockModule(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js',
      () => ({ sendCourseToCourseBuilder })
    );
    jest.unstable_mockModule(
      '../../../../src/application/use-cases/cleanupContentHistoryOnArchive.js',
      () => ({
        CleanupContentHistoryOnArchive: class {
          async cleanupCourseHistory() {
            return { topicsProcessed: 0, deletedFromStorage: 0, deletedFromDatabase: 0, errors: [] };
          }
        },
      })
    );

    const { PublishCourseUseCase } = await import(
      '../../../../src/application/use-cases/PublishCourseUseCase.js'
    );
    const useCase = new PublishCourseUseCase(optimizedCounts.repos);

    let preTransfer;
    sendCourseToCourseBuilder.mockImplementation(async (courseData) => {
      preTransfer = {
        counts: { ...optimizedCounts.counts },
        topicIds: courseData.topics.map((t) => t.topic_id),
      };
      return { status: 'published' };
    });

    await useCase.execute(51, { publisherTrainerId: 'trainer-1' });

    expect(originalCounts.counts.findAllByTopicId).toBe(N * 2);
    expect(originalCounts.counts.findByIdTemplate).toBe(N * 2);
    expect(preTransfer.counts.findAllByTopicId).toBe(N);
    expect(preTransfer.counts.findByIdTemplate).toBe(N);
    expect(preTransfer.counts.findByIdCourse).toBe(1);
    expect(preTransfer.topicIds).toHaveLength(N);
    expect(preTransfer.topicIds[0]).toBe('1');
    expect(preTransfer.topicIds[N - 1]).toBe(String(N));
  });

  it('transfer failure never archives; success preserves archive behavior', async () => {
    const fixture = representativeFixture();
    // shrink to one topic for speed
    fixture.topics = [fixture.topics[0]];
    const { repos } = createCountingRepos(fixture);

    jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    const updateDirectory = jest.fn().mockResolvedValue({});
    jest.unstable_mockModule(
      '../../../../src/infrastructure/directoryClient/directoryClient.js',
      () => ({ updateCourseStatusInDirectory: updateDirectory })
    );
    const sendCourseToCourseBuilder = jest
      .fn()
      .mockRejectedValueOnce(new Error('CB down'))
      .mockResolvedValueOnce({ status: 'published' });
    jest.unstable_mockModule(
      '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js',
      () => ({ sendCourseToCourseBuilder })
    );
    jest.unstable_mockModule(
      '../../../../src/application/use-cases/cleanupContentHistoryOnArchive.js',
      () => ({
        CleanupContentHistoryOnArchive: class {
          async cleanupCourseHistory() {
            return { topicsProcessed: 1, deletedFromStorage: 0, deletedFromDatabase: 0, errors: [] };
          }
        },
      })
    );

    const { PublishCourseUseCase } = await import(
      '../../../../src/application/use-cases/PublishCourseUseCase.js'
    );
    const useCase = new PublishCourseUseCase(repos);

    await expect(useCase.execute(51, { publisherTrainerId: 'trainer-1' })).rejects.toThrow(
      /Transfer failed/
    );
    expect(repos.courseRepository.update).not.toHaveBeenCalled();
    expect(repos.topicRepository.incrementUsageCount).not.toHaveBeenCalled();
    expect(updateDirectory).not.toHaveBeenCalled();

    await useCase.execute(51, { publisherTrainerId: 'trainer-1', organizationId: 'org' });
    expect(repos.courseRepository.update).toHaveBeenCalledWith(51, { status: 'archived' });
    expect(repos.topicRepository.incrementUsageCount).toHaveBeenCalled();
    expect(updateDirectory).toHaveBeenCalledWith('trainer-1', '51', 'archived');
  });

  it('small-course publication payload unchanged vs original', async () => {
    const fixture = {
      course: makeCourse({ course_id: 7, course_name: 'Small' }),
      topics: [makeTopic(1, { topic_name: 'Only' })],
      templates: { 10: { template_id: 10, format_order: ['code'] } },
      contentsByTopic: {
        1: [
          {
            content_id: 1,
            content_type_id: 2,
            content_data: { code: 'x' },
            status: 'active',
          },
        ],
      },
    };
    const { repos: a } = createCountingRepos(fixture);
    const { repos: b } = createCountingRepos(fixture);
    const original = new FrozenOriginalPublishBehavior(a);
    const optimized = await loadUseCase(b);
    expect(await optimized.buildCourseObject(7)).toEqual(await original.buildCourseObject(7));
    expect(await optimized.validateCourse(7)).toEqual(await original.validateCourse(7));
  });

  it.each([
    ['flag OFF (default/legacy)', undefined],
    ['flag OFF explicit', 'false'],
    ['flag ON chunked', 'true'],
  ])('execute still transfers identical courseData with %s', async (_label, flagValue) => {
    const previous = process.env.CHUNKED_TRAINER_PUBLISH_ENABLED;
    if (flagValue === undefined) {
      delete process.env.CHUNKED_TRAINER_PUBLISH_ENABLED;
    } else {
      process.env.CHUNKED_TRAINER_PUBLISH_ENABLED = flagValue;
    }

    try {
      const fixture = {
        course: makeCourse({ course_id: 7, course_name: 'Small' }),
        topics: [makeTopic(1, { topic_name: 'Only' })],
        templates: { 10: { template_id: 10, format_order: ['code'] } },
        contentsByTopic: {
          1: [{ content_id: 1, content_type_id: 2, content_data: { code: 'x' }, status: 'active' }],
        },
      };
      const { repos } = createCountingRepos(fixture);
      const { repos: frozenRepos } = createCountingRepos(fixture);
      const original = new FrozenOriginalPublishBehavior(frozenRepos);
      const expectedPayload = await original.buildCourseObject(7);

      jest.unstable_mockModule('../../../../src/infrastructure/logging/Logger.js', () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));
      jest.unstable_mockModule(
        '../../../../src/infrastructure/directoryClient/directoryClient.js',
        () => ({ updateCourseStatusInDirectory: jest.fn().mockResolvedValue({}) })
      );
      const sendCourseToCourseBuilder = jest.fn().mockResolvedValue({ status: 'published' });
      jest.unstable_mockModule(
        '../../../../src/infrastructure/courseBuilderClient/courseBuilderClient.js',
        () => ({ sendCourseToCourseBuilder })
      );
      jest.unstable_mockModule(
        '../../../../src/application/use-cases/cleanupContentHistoryOnArchive.js',
        () => ({
          CleanupContentHistoryOnArchive: class {
            async cleanupCourseHistory() {
              return { topicsProcessed: 0, deletedFromStorage: 0, deletedFromDatabase: 0, errors: [] };
            }
          },
        })
      );

      const { PublishCourseUseCase } = await import(
        '../../../../src/application/use-cases/PublishCourseUseCase.js'
      );
      await new PublishCourseUseCase(repos).execute(7, { publisherTrainerId: 'trainer-1' });

      expect(sendCourseToCourseBuilder).toHaveBeenCalledWith(
        expectedPayload,
        expect.objectContaining({ publisherTrainerId: 'trainer-1' })
      );
    } finally {
      if (previous === undefined) {
        delete process.env.CHUNKED_TRAINER_PUBLISH_ENABLED;
      } else {
        process.env.CHUNKED_TRAINER_PUBLISH_ENABLED = previous;
      }
    }
  });

  it('null DevLab fails validation identically', async () => {
    const fixture = representativeFixture();
    fixture.topics = [
      makeTopic(1, { devlab_exercises: null, topic_name: 'NoLab' }),
    ];
    fixture.contentsByTopic = { 1: makeContentsForTopic(1) };
    const { repos: a } = createCountingRepos(fixture);
    const { repos: b } = createCountingRepos(fixture);
    const original = new FrozenOriginalPublishBehavior(a);
    const optimized = await loadUseCase(b);
    expect(await optimized.validateCourse(51)).toEqual(await original.validateCourse(51));
  });
});
