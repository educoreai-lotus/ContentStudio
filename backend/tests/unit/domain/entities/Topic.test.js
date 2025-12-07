import { Topic } from '../../../../src/domain/entities/Topic.js';

describe('Topic Entity', () => {
  describe('constructor', () => {
    it('should create a topic with valid data', () => {
      const topicData = {
        topic_id: 1,
        topic_name: 'Introduction to React Components',
        description: 'Learn React components',
        trainer_id: 'trainer123',
        course_id: 1,
        skills: ['JavaScript', 'React'],
        status: 'active',
      };

      const topic = new Topic(topicData);

      expect(topic.topic_id).toBe(1);
      expect(topic.topic_name).toBe('Introduction to React Components');
      expect(topic.description).toBe('Learn React components');
      expect(topic.trainer_id).toBe('trainer123');
      expect(topic.course_id).toBe(1);
      expect(topic.skills).toEqual(['JavaScript', 'React']);
      expect(topic.status).toBe('active');
    });

    it('should create a stand-alone topic (course_id null)', () => {
      const topicData = {
        topic_name: 'Stand-alone Lesson',
        trainer_id: 'trainer123',
        course_id: null,
        language: 'en',
      };

      const topic = new Topic(topicData);

      expect(topic.course_id).toBeNull();
      expect(topic.is_standalone).toBe(true);
    });

    it('should set default status to active if not provided', () => {
      const topicData = {
        topic_name: 'Test Topic',
        trainer_id: 'trainer123',
        course_id: 1, // Add course_id to avoid language requirement
      };

      const topic = new Topic(topicData);

      expect(topic.status).toBe('active');
    });

    it('should initialize format flags as false', () => {
      const topicData = {
        topic_name: 'Test Topic',
        trainer_id: 'trainer123',
        course_id: 1, // Add course_id to avoid language requirement
      };

      const topic = new Topic(topicData);

      expect(topic.has_text).toBe(false);
      expect(topic.has_code).toBe(false);
      expect(topic.has_presentation).toBe(false);
      expect(topic.has_audio).toBe(false);
      expect(topic.has_mind_map).toBe(false);
      expect(topic.total_content_formats).toBe(0);
    });
  });

  describe('validation', () => {
    it('should throw error if topic_name is missing', () => {
      const topicData = {
        trainer_id: 'trainer123',
      };

      expect(() => new Topic(topicData)).toThrow('Topic name is required');
    });

    it('should throw error if topic_name is too short', () => {
      const topicData = {
        topic_name: 'AB',
        trainer_id: 'trainer123',
      };

      expect(() => new Topic(topicData)).toThrow(
        'Topic name must be between 3 and 255 characters'
      );
    });

    it('should throw error if topic_name is too long', () => {
      const topicData = {
        topic_name: 'A'.repeat(256),
        trainer_id: 'trainer123',
      };

      expect(() => new Topic(topicData)).toThrow(
        'Topic name must be between 3 and 255 characters'
      );
    });

    it('should throw error if trainer_id is missing', () => {
      const topicData = {
        topic_name: 'Test Topic',
      };

      expect(() => new Topic(topicData)).toThrow('Trainer ID is required');
    });
  });

  describe('format requirement validation', () => {
    it('should validate that all 5 mandatory formats are present', () => {
      const topic = new Topic({
        topic_name: 'Test Topic',
        trainer_id: 'trainer123',
        course_id: 1, // Add course_id to avoid language requirement
      });

      // Initially no formats
      expect(topic.hasAllRequiredFormats()).toBe(false);

      // Add all 5 formats
      topic.has_text = true;
      topic.has_code = true;
      topic.has_presentation = true;
      topic.has_audio = true;
      topic.has_mind_map = true;
      topic.total_content_formats = 5;

      expect(topic.hasAllRequiredFormats()).toBe(true);
    });

    it('should return missing formats list', () => {
      const topic = new Topic({
        topic_name: 'Test Topic',
        trainer_id: 'trainer123',
        course_id: 1, // Add course_id to avoid language requirement
      });

      topic.has_text = true;
      topic.has_code = true;
      // Missing: presentation, audio, mind_map

      const missing = topic.getMissingFormats();
      expect(missing).toContain('presentation');
      expect(missing).toContain('audio');
      expect(missing).toContain('mind_map');
      expect(missing).not.toContain('text');
      expect(missing).not.toContain('code');
    });
  });

  describe('updateFormatFlags', () => {
    it('should update format flags based on content items', () => {
      const topic = new Topic({
        topic_name: 'Test Topic',
        trainer_id: 'trainer123',
        course_id: 1, // Add course_id to avoid language requirement
      });

      const contentItems = [
        { content_type: 'text' },
        { content_type: 'code' },
        { content_type: 'presentation' },
      ];

      topic.updateFormatFlags(contentItems);

      expect(topic.has_text).toBe(true);
      expect(topic.has_code).toBe(true);
      expect(topic.has_presentation).toBe(true);
      expect(topic.has_audio).toBe(false);
      expect(topic.has_mind_map).toBe(false);
      expect(topic.total_content_formats).toBe(3);
    });
  });
});


