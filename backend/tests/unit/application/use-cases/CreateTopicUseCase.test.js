import { jest } from '@jest/globals';
import { CreateTopicUseCase } from '../../../../src/application/use-cases/CreateTopicUseCase.js';
import { Topic } from '../../../../src/domain/entities/Topic.js';

describe('CreateTopicUseCase', () => {
  let mockTopicRepository;
  let mockSkillsEngineClient;
  let createTopicUseCase;

  beforeEach(() => {
    mockTopicRepository = {
      create: jest.fn(),
    };

    mockSkillsEngineClient = {
      getSkillsMapping: jest.fn(),
    };

    createTopicUseCase = new CreateTopicUseCase({
      topicRepository: mockTopicRepository,
      skillsEngineClient: mockSkillsEngineClient,
    });
  });

  it('should create a topic successfully', async () => {
    const topicData = {
      topic_name: 'Introduction to React',
      trainer_id: 'trainer123',
      description: 'Learn React basics',
      course_id: 1, // Add course_id to avoid language requirement
    };

    const createdTopic = new Topic({
      ...topicData,
      topic_id: 1,
      status: 'active',
    });

    mockTopicRepository.create.mockResolvedValue(createdTopic);

    const result = await createTopicUseCase.execute(topicData);

    expect(result).toEqual(createdTopic);
    expect(mockTopicRepository.create).toHaveBeenCalledWith(expect.any(Topic));
    expect(mockTopicRepository.create).toHaveBeenCalledTimes(1);
  });

  it('should fetch skills from Skills Engine when topic_name provided', async () => {
    const topicData = {
      topic_name: 'React Hooks',
      trainer_id: 'trainer123',
      course_id: 1, // Add course_id to avoid language requirement
    };

    const skillsMapping = {
      micro_skills: ['JavaScript', 'React', 'Hooks'],
      nano_skills: ['useState', 'useEffect'],
      difficulty: 'intermediate',
    };

    mockSkillsEngineClient.getSkillsMapping.mockResolvedValue(skillsMapping);

    const createdTopic = new Topic({
      ...topicData,
      topic_id: 1,
      skills: skillsMapping.micro_skills,
      status: 'active',
    });

    mockTopicRepository.create.mockResolvedValue(createdTopic);

    await createTopicUseCase.execute(topicData);

    expect(mockSkillsEngineClient.getSkillsMapping).toHaveBeenCalledWith(
      'trainer123',
      'React Hooks'
    );
  });

  it('should use provided skills if Skills Engine fails', async () => {
    const topicData = {
      topic_name: 'React Hooks',
      trainer_id: 'trainer123',
      skills: ['JavaScript', 'React'],
      course_id: 1, // Add course_id to avoid language requirement
    };

    mockSkillsEngineClient.getSkillsMapping.mockRejectedValue(
      new Error('Skills Engine unavailable')
    );

    const createdTopic = new Topic({
      ...topicData,
      topic_id: 1,
      skills: topicData.skills,
      status: 'active',
    });

    mockTopicRepository.create.mockResolvedValue(createdTopic);

    const result = await createTopicUseCase.execute(topicData);

    expect(result.skills).toEqual(topicData.skills);
    expect(mockTopicRepository.create).toHaveBeenCalled();
  });

  it('should throw error if topic name is invalid', async () => {
    const topicData = {
      topic_name: 'AB', // Too short
      trainer_id: 'trainer123',
    };

    await expect(createTopicUseCase.execute(topicData)).rejects.toThrow(
      'Topic name must be between 3 and 255 characters'
    );

    expect(mockTopicRepository.create).not.toHaveBeenCalled();
  });

  it('should throw error if trainer_id is missing', async () => {
    const topicData = {
      topic_name: 'Test Topic',
    };

    await expect(createTopicUseCase.execute(topicData)).rejects.toThrow(
      'Trainer ID is required'
    );

    expect(mockTopicRepository.create).not.toHaveBeenCalled();
  });
});

