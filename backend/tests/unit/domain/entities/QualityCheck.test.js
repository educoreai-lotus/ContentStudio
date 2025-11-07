import { describe, it, expect } from '@jest/globals';
import { QualityCheck } from '../../../../src/domain/entities/QualityCheck.js';

describe('QualityCheck Entity', () => {
  describe('Constructor', () => {
    it('should create a QualityCheck with valid data', () => {
      const qualityCheckData = {
        content_id: 1,
        check_type: 'full',
        status: 'pending',
      };

      const qualityCheck = new QualityCheck(qualityCheckData);

      expect(qualityCheck.content_id).toBe(1);
      expect(qualityCheck.check_type).toBe('full');
      expect(qualityCheck.status).toBe('pending');
    });

    it('should set default values for optional fields', () => {
      const qualityCheckData = {
        content_id: 1,
        check_type: 'full',
        status: 'pending',
      };

      const qualityCheck = new QualityCheck(qualityCheckData);

      expect(qualityCheck.results).toBeNull();
      expect(qualityCheck.score).toBeNull();
      expect(qualityCheck.created_at).toBeInstanceOf(Date);
    });

    it('should accept all quality metrics', () => {
      const qualityCheckData = {
        content_id: 1,
        check_type: 'full',
        status: 'completed',
        results: {
          clarity: 85,
          difficulty: 'intermediate',
          structure: 90,
          originality: 95,
          plagiarism_detected: false,
        },
        score: 90,
      };

      const qualityCheck = new QualityCheck(qualityCheckData);

      expect(qualityCheck.results.clarity).toBe(85);
      expect(qualityCheck.results.difficulty).toBe('intermediate');
      expect(qualityCheck.results.originality).toBe(95);
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const invalidData = {
        check_type: 'full',
        // missing content_id
      };

      expect(() => new QualityCheck(invalidData)).toThrow('QualityCheck validation failed');
    });

    it('should validate content_id is a number', () => {
      const invalidData = {
        content_id: 'not-a-number',
        check_type: 'full',
        status: 'pending',
      };

      expect(() => new QualityCheck(invalidData)).toThrow('QualityCheck validation failed');
    });

    it('should validate check_type is valid enum', () => {
      const invalidData = {
        content_id: 1,
        check_type: 'invalid_type',
        status: 'pending',
      };

      expect(() => new QualityCheck(invalidData)).toThrow('QualityCheck validation failed');
    });

    it('should validate status is valid enum', () => {
      const invalidData = {
        content_id: 1,
        check_type: 'full',
        status: 'invalid_status',
      };

      expect(() => new QualityCheck(invalidData)).toThrow('QualityCheck validation failed');
    });
  });

  describe('Methods', () => {
    it('should mark as completed with results', () => {
      const qualityCheck = new QualityCheck({
        content_id: 1,
        check_type: 'full',
        status: 'pending',
      });

      const results = {
        clarity: 85,
        difficulty: 'intermediate',
        structure: 90,
        originality: 95,
        plagiarism_detected: false,
      };

      qualityCheck.markCompleted(results, 90);

      expect(qualityCheck.status).toBe('completed');
      expect(qualityCheck.results).toEqual(results);
      expect(qualityCheck.score).toBe(90);
    });

    it('should mark as failed', () => {
      const qualityCheck = new QualityCheck({
        content_id: 1,
        check_type: 'full',
        status: 'pending',
      });

      qualityCheck.markFailed('AI service unavailable');

      expect(qualityCheck.status).toBe('failed');
      expect(qualityCheck.error_message).toBe('AI service unavailable');
    });

    it('should calculate overall score from results', () => {
      const qualityCheck = new QualityCheck({
        content_id: 1,
        check_type: 'full',
        status: 'completed',
        results: {
          clarity: 80,
          structure: 85,
          originality: 90,
        },
      });

      const score = qualityCheck.calculateScore();

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should check if quality is acceptable', () => {
      const highQualityCheck = new QualityCheck({
        content_id: 1,
        check_type: 'full',
        status: 'completed',
        results: {
          clarity: 90,
          structure: 85,
          originality: 95,
          plagiarism_detected: false,
        },
        score: 90,
      });

      expect(highQualityCheck.isAcceptable()).toBe(true);

      const lowQualityCheck = new QualityCheck({
        content_id: 2,
        check_type: 'full',
        status: 'completed',
        results: {
          clarity: 50,
          structure: 45,
          originality: 60,
          plagiarism_detected: true,
        },
        score: 50,
      });

      expect(lowQualityCheck.isAcceptable()).toBe(false);
    });
  });
});



