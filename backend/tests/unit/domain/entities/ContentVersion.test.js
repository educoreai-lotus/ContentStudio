import { describe, it, expect } from '@jest/globals';
import { ContentVersion } from '../../../../src/domain/entities/ContentVersion.js';

describe('ContentVersion Entity', () => {
  describe('Constructor', () => {
    it('should create a ContentVersion with valid data', () => {
      const versionData = {
        content_id: 1,
        version_number: 1,
        content_data: { text: 'Version 1 content' },
        created_by: 'trainer123',
      };

      const version = new ContentVersion(versionData);

      expect(version.content_id).toBe(1);
      expect(version.version_number).toBe(1);
      expect(version.content_data).toEqual({ text: 'Version 1 content' });
      expect(version.created_by).toBe('trainer123');
    });

    it('should set default values for optional fields', () => {
      const versionData = {
        content_id: 1,
        version_number: 1,
        content_data: { text: 'Content' },
        created_by: 'trainer123',
      };

      const version = new ContentVersion(versionData);

      expect(version.is_current_version).toBe(false);
      expect(version.change_description).toBeNull();
      expect(version.created_at).toBeInstanceOf(Date);
    });

    it('should accept change description', () => {
      const versionData = {
        content_id: 1,
        version_number: 2,
        content_data: { text: 'Updated content' },
        created_by: 'trainer123',
        change_description: 'Updated text for clarity',
      };

      const version = new ContentVersion(versionData);

      expect(version.change_description).toBe('Updated text for clarity');
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const invalidData = {
        version_number: 1,
        content_data: { text: 'Content' },
        // missing content_id
      };

      expect(() => new ContentVersion(invalidData)).toThrow(
        'ContentVersion validation failed'
      );
    });

    it('should validate content_id is a number', () => {
      const invalidData = {
        content_id: 'not-a-number',
        version_number: 1,
        content_data: { text: 'Content' },
        created_by: 'trainer123',
      };

      expect(() => new ContentVersion(invalidData)).toThrow(
        'ContentVersion validation failed'
      );
    });

    it('should validate version_number is a positive number', () => {
      const invalidData = {
        content_id: 1,
        version_number: 0,
        content_data: { text: 'Content' },
        created_by: 'trainer123',
      };

      expect(() => new ContentVersion(invalidData)).toThrow(
        'ContentVersion validation failed'
      );
    });

    it('should validate content_data is not empty', () => {
      const invalidData = {
        content_id: 1,
        version_number: 1,
        content_data: null,
        created_by: 'trainer123',
      };

      expect(() => new ContentVersion(invalidData)).toThrow(
        'ContentVersion validation failed'
      );
    });

    it('should validate created_by is required', () => {
      const invalidData = {
        content_id: 1,
        version_number: 1,
        content_data: { text: 'Content' },
        // missing created_by
      };

      expect(() => new ContentVersion(invalidData)).toThrow(
        'ContentVersion validation failed'
      );
    });
  });

  describe('Methods', () => {
    it('should mark as current version', () => {
      const version = new ContentVersion({
        content_id: 1,
        version_number: 1,
        content_data: { text: 'Content' },
        created_by: 'trainer123',
      });

      version.markAsCurrent();
      expect(version.is_current_version).toBe(true);
    });

    it('should mark as not current version', () => {
      const version = new ContentVersion({
        content_id: 1,
        version_number: 1,
        content_data: { text: 'Content' },
        created_by: 'trainer123',
        is_current_version: true,
      });

      version.markAsNotCurrent();
      expect(version.is_current_version).toBe(false);
    });
  });
});



