import { describe, it, expect } from '@jest/globals';
import { Content } from '../../../../src/domain/entities/Content.js';

describe('Content Entity', () => {
  describe('Constructor', () => {
    it('should create a Content entity with valid data', () => {
      const contentData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample lesson text' },
        generation_method_id: 'manual',
      };

      const content = new Content(contentData);

      expect(content.topic_id).toBe(1);
      expect(content.content_type_id).toBe('text');
      expect(content.content_data).toEqual({ text: 'Sample lesson text' });
      expect(content.generation_method_id).toBe('manual');
      expect(content.created_at).toBeInstanceOf(Date);
    });

    it('should set default values for optional fields', () => {
      const contentData = {
        topic_id: 1,
        content_type_id: 'code',
        content_data: { code: 'console.log("hello");' },
        generation_method_id: 'manual',
      };

      const content = new Content(contentData);

      expect(content.quality_check_status).toBeNull();
      expect(content.quality_check_data).toBeNull();
      expect(content.quality_checked_at).toBeNull();
    });

    it('should accept quality check data', () => {
      const qualityCheckData = {
        clarity_score: 8.5,
        originality_score: 9.0,
        structure_score: 8.0,
        issues: [],
      };

      const contentData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample text' },
        generation_method_id: 'manual',
        quality_check_data: qualityCheckData,
        quality_check_status: 'approved',
        quality_checked_at: new Date(),
      };

      const content = new Content(contentData);

      expect(content.quality_check_data).toEqual(qualityCheckData);
      expect(content.quality_check_status).toBe('approved');
      expect(content.quality_checked_at).toBeInstanceOf(Date);
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const invalidData = {
        content_type_id: 'text',
        // missing topic_id
      };

      expect(() => new Content(invalidData)).toThrow('Content validation failed');
    });

    it('should validate topic_id is a positive integer', () => {
      const invalidData = {
        topic_id: -1,
        content_type_id: 'text',
        content_data: {},
        generation_method_id: 'manual',
      };

      expect(() => new Content(invalidData)).toThrow('Content validation failed');
    });

    it('should validate content_type_id is valid enum', () => {
      const invalidData = {
        topic_id: 1,
        content_type_id: 'invalid_type',
        content_data: {},
        generation_method_id: 'manual',
      };

      expect(() => new Content(invalidData)).toThrow('Content validation failed');
    });

    it('should validate generation_method_id is valid enum', () => {
      const invalidData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: {},
        generation_method_id: 'invalid_method',
      };

      expect(() => new Content(invalidData)).toThrow('Content validation failed');
    });

    it('should validate content_data is an object', () => {
      const invalidData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: 'not an object',
        generation_method_id: 'manual',
      };

      expect(() => new Content(invalidData)).toThrow('Content validation failed');
    });

    it('should validate quality_check_status if provided', () => {
      const invalidData = {
        topic_id: 1,
        content_type_id: 'text',
        content_data: {},
        generation_method_id: 'manual',
        quality_check_status: 'invalid_status',
      };

      expect(() => new Content(invalidData)).toThrow('Content validation failed');
    });
  });

  describe('Methods', () => {
    it('should update quality check data', () => {
      const content = new Content({
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample' },
        generation_method_id: 'manual',
      });

      const qualityCheckData = {
        clarity_score: 8.5,
        originality_score: 9.0,
        issues: ['Minor grammar issue'],
      };

      content.updateQualityCheck(qualityCheckData, 'approved');

      expect(content.quality_check_data).toEqual(qualityCheckData);
      expect(content.quality_check_status).toBe('approved');
      expect(content.quality_checked_at).toBeInstanceOf(Date);
    });

    it('should mark content as needing quality check', () => {
      const content = new Content({
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample' },
        generation_method_id: 'manual',
      });

      expect(content.needsQualityCheck()).toBe(true);
    });

    it('should mark content as not needing quality check if already checked', () => {
      const content = new Content({
        topic_id: 1,
        content_type_id: 'text',
        content_data: { text: 'Sample' },
        generation_method_id: 'manual',
        quality_check_status: 'approved',
      });

      expect(content.needsQualityCheck()).toBe(false);
    });
  });
});


