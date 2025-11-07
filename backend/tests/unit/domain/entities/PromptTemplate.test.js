import { describe, it, expect } from '@jest/globals';
import { PromptTemplate } from '../../../../src/domain/entities/PromptTemplate.js';

describe('PromptTemplate Entity', () => {
  describe('Constructor', () => {
    it('should create a PromptTemplate with valid data', () => {
      const templateData = {
        template_name: 'Lesson Text Template',
        content_type_id: 'text',
        template_text: 'Generate a lesson about {topic} covering {key_points}',
        variables: ['topic', 'key_points'],
        created_by: 'trainer123',
      };

      const template = new PromptTemplate(templateData);

      expect(template.template_name).toBe('Lesson Text Template');
      expect(template.content_type_id).toBe('text');
      expect(template.template_text).toBe('Generate a lesson about {topic} covering {key_points}');
      expect(template.variables).toEqual(['topic', 'key_points']);
      expect(template.created_by).toBe('trainer123');
    });

    it('should set default values for optional fields', () => {
      const templateData = {
        template_name: 'Test Template',
        content_type_id: 'text',
        template_text: 'Template text',
        created_by: 'trainer123',
      };

      const template = new PromptTemplate(templateData);

      expect(template.variables).toEqual([]);
      expect(template.is_active).toBe(true);
      expect(template.created_at).toBeInstanceOf(Date);
    });

    it('should extract variables from template text automatically', () => {
      const templateData = {
        template_name: 'Template with Variables',
        content_type_id: 'text',
        template_text: 'Generate {format} content about {topic} for {audience}',
        created_by: 'trainer123',
      };

      const template = new PromptTemplate(templateData);

      // Should extract variables from {variable_name} pattern
      expect(template.variables.length).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const invalidData = {
        content_type_id: 'text',
        // missing template_name
      };

      expect(() => new PromptTemplate(invalidData)).toThrow('PromptTemplate validation failed');
    });

    it('should validate template_name is not empty', () => {
      const invalidData = {
        template_name: '',
        content_type_id: 'text',
        template_text: 'Template',
        created_by: 'trainer123',
      };

      expect(() => new PromptTemplate(invalidData)).toThrow('PromptTemplate validation failed');
    });

    it('should validate content_type_id is valid enum', () => {
      const invalidData = {
        template_name: 'Test',
        content_type_id: 'invalid_type',
        template_text: 'Template',
        created_by: 'trainer123',
      };

      expect(() => new PromptTemplate(invalidData)).toThrow('PromptTemplate validation failed');
    });

    it('should validate template_text is not empty', () => {
      const invalidData = {
        template_name: 'Test',
        content_type_id: 'text',
        template_text: '',
        created_by: 'trainer123',
      };

      expect(() => new PromptTemplate(invalidData)).toThrow('PromptTemplate validation failed');
    });

    it('should validate created_by is required', () => {
      const invalidData = {
        template_name: 'Test',
        content_type_id: 'text',
        template_text: 'Template',
        // missing created_by
      };

      expect(() => new PromptTemplate(invalidData)).toThrow('PromptTemplate validation failed');
    });
  });

  describe('Methods', () => {
    it('should render template with variables', () => {
      const template = new PromptTemplate({
        template_name: 'Test Template',
        content_type_id: 'text',
        template_text: 'Generate lesson about {topic} for {audience}',
        variables: ['topic', 'audience'],
        created_by: 'trainer123',
      });

      const rendered = template.render({
        topic: 'JavaScript',
        audience: 'beginners',
      });

      expect(rendered).toBe('Generate lesson about JavaScript for beginners');
    });

    it('should handle missing variables in render', () => {
      const template = new PromptTemplate({
        template_name: 'Test Template',
        content_type_id: 'text',
        template_text: 'Generate lesson about {topic}',
        variables: ['topic'],
        created_by: 'trainer123',
      });

      const rendered = template.render({});

      expect(rendered).toBe('Generate lesson about {topic}');
    });

    it('should deactivate template', () => {
      const template = new PromptTemplate({
        template_name: 'Test Template',
        content_type_id: 'text',
        template_text: 'Template',
        created_by: 'trainer123',
      });

      template.deactivate();

      expect(template.is_active).toBe(false);
    });
  });
});



