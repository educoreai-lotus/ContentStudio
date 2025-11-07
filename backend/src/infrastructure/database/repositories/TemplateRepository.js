import { TemplateRepository as ITemplateRepository } from '../../../domain/repositories/TemplateRepository.js';
import { Template } from '../../../domain/entities/Template.js';

/**
 * In-memory Template Repository Implementation
 * TODO: Replace with PostgreSQL implementation
 */
export class TemplateRepository extends ITemplateRepository {
  constructor() {
    super();
    this.templates = [];
    this.nextId = 1;

    // Seed with default templates
    this.initializeDefaultTemplates();
  }

  initializeDefaultTemplates() {
    const defaultTemplates = [
      {
        template_name: 'Standard Lesson Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        description: 'Standard template for most lessons',
        created_by: 'system',
        is_active: true,
      },
      {
        template_name: 'Programming Lesson Template',
        format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
        description: 'Template optimized for programming lessons',
        created_by: 'system',
        is_active: true,
      },
      {
        template_name: 'Video-First Template',
        format_order: ['avatar_video', 'text', 'code', 'presentation', 'audio', 'mind_map'],
        description: 'Template starting with avatar video',
        created_by: 'system',
        is_active: true,
      },
    ];

    defaultTemplates.forEach(templateData => {
      const template = new Template({
        ...templateData,
        template_id: this.nextId++,
      });
      this.templates.push(template);
    });
  }

  async create(template) {
    const templateId = this.nextId++;
    const createdTemplate = new Template({
      ...template,
      template_id: templateId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    this.templates.push(createdTemplate);
    return createdTemplate;
  }

  async findById(templateId) {
    const template = this.templates.find(t => t.template_id === templateId && t.is_active);
    return template || null;
  }

  async findAll(filters = {}) {
    let results = this.templates.filter(t => t.is_active);

    if (filters.created_by) {
      results = results.filter(t => t.created_by === filters.created_by);
    }

    if (filters.template_name) {
      const searchTerm = filters.template_name.toLowerCase();
      results = results.filter(t =>
        t.template_name.toLowerCase().includes(searchTerm)
      );
    }

    return results;
  }

  async update(templateId, updates) {
    const index = this.templates.findIndex(t => t.template_id === templateId);
    if (index === -1) {
      return null; // Return null instead of throwing for 404 handling
    }

    const existingTemplate = this.templates[index];
    const updatedTemplate = new Template({
      ...existingTemplate,
      ...updates,
      template_id: templateId,
      updated_at: new Date(),
    });

    this.templates[index] = updatedTemplate;
    return updatedTemplate;
  }

  async delete(templateId) {
    const index = this.templates.findIndex(t => t.template_id === templateId);
    if (index === -1) {
      throw new Error(`Template with id ${templateId} not found`);
    }

    // Soft delete
    this.templates[index].deactivate();
  }
}

