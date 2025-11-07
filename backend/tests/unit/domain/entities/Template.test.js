import { describe, it, expect } from '@jest/globals';
import { Template } from '../../../../src/domain/entities/Template.js';

describe('Template Entity', () => {
  describe('Constructor', () => {
    it('should create a Template with valid data', () => {
      const templateData = {
        template_name: 'Standard Lesson Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        created_by: 'trainer123',
      };

      const template = new Template(templateData);

      expect(template.template_name).toBe('Standard Lesson Template');
      expect(template.format_order).toEqual(['text', 'code', 'presentation', 'audio', 'mind_map']);
      expect(template.created_by).toBe('trainer123');
    });

    it('should set default values for optional fields', () => {
      const templateData = {
        template_name: 'Test Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        created_by: 'trainer123',
      };

      const template = new Template(templateData);

      expect(template.is_active).toBe(true);
      expect(template.created_at).toBeInstanceOf(Date);
      expect(template.usage_count).toBe(0);
    });

      it('should accept description and notes', () => {
        const templateData = {
          template_name: 'Template with Description',
          format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
          description: 'A template for programming lessons',
          notes: 'Use this for coding tutorials',
          created_by: 'trainer123',
        };

        const template = new Template(templateData);

        expect(template.description).toBe('A template for programming lessons');
        expect(template.notes).toBe('Use this for coding tutorials');
      });
  });

  describe('Validation', () => {
      it('should validate required fields', () => {
        const invalidData = {
          format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
          // missing template_name
        };

        expect(() => new Template(invalidData)).toThrow('Template validation failed');
      });

      it('should validate template_name is not empty', () => {
        const invalidData = {
          template_name: '',
          format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
          created_by: 'trainer123',
        };

        expect(() => new Template(invalidData)).toThrow('Template validation failed');
      });

    it('should validate format_order is an array', () => {
      const invalidData = {
        template_name: 'Test',
        format_order: 'not-an-array',
        created_by: 'trainer123',
      };

      expect(() => new Template(invalidData)).toThrow('Template validation failed');
    });

    it('should validate format_order is not empty', () => {
      const invalidData = {
        template_name: 'Test',
        format_order: [],
        created_by: 'trainer123',
      };

      expect(() => new Template(invalidData)).toThrow('Template validation failed');
    });

      it('should validate format_order contains valid content types', () => {
        const invalidData = {
          template_name: 'Test',
          format_order: ['text', 'code', 'presentation', 'audio', 'mind_map', 'invalid_type'],
          created_by: 'trainer123',
        };

        expect(() => new Template(invalidData)).toThrow('Template validation failed');
      });

      it('should validate created_by is required', () => {
        const invalidData = {
          template_name: 'Test',
          format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
          // missing created_by
        };

        expect(() => new Template(invalidData)).toThrow('Template validation failed');
      });
  });

  describe('Methods', () => {
      it('should increment usage count', () => {
        const template = new Template({
          template_name: 'Test Template',
          format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
          created_by: 'trainer123',
        });

        template.incrementUsage();
        expect(template.usage_count).toBe(1);

        template.incrementUsage();
        expect(template.usage_count).toBe(2);
      });

    it('should deactivate template', () => {
      const template = new Template({
        template_name: 'Test Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        created_by: 'trainer123',
      });

      template.deactivate();
      expect(template.is_active).toBe(false);
      expect(template.updated_at).toBeInstanceOf(Date);
    });

    it('should activate template', () => {
      const template = new Template({
        template_name: 'Test Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        created_by: 'trainer123',
        is_active: false,
      });

      template.activate();
      expect(template.is_active).toBe(true);
    });

    it('should update format order', () => {
      const template = new Template({
        template_name: 'Test Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        created_by: 'trainer123',
      });

      template.updateFormatOrder(['code', 'text', 'presentation', 'audio', 'mind_map']);
      expect(template.format_order).toEqual(['code', 'text', 'presentation', 'audio', 'mind_map']);
      expect(template.updated_at).toBeInstanceOf(Date);
    });

    it('should validate format order on update', () => {
      const template = new Template({
        template_name: 'Test Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        created_by: 'trainer123',
      });

      expect(() => template.updateFormatOrder(['text', 'code', 'presentation', 'audio', 'mind_map', 'invalid_type'])).toThrow(
        'Invalid content type in format_order'
      );
    });
  });
});

