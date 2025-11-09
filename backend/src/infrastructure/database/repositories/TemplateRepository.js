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
        template_name: 'Foundational Learning Flow',
        template_type: 'ready_template',
        format_order: ['text', 'audio', 'presentation', 'code', 'mind_map'],
        description: 'Balanced sequence starting with narration and visual support.',
        created_by: 'system',
        is_active: true,
      },
      {
        template_name: 'Hands-On Coding Sprint',
        template_type: 'ready_template',
        format_order: ['text', 'audio', 'code', 'presentation', 'mind_map'],
        description: 'Ideal for coding lessons with guided narration and practical examples.',
        created_by: 'system',
        is_active: true,
      },
      {
        template_name: 'Visual Storytelling Journey',
        template_type: 'ready_template',
        format_order: ['text', 'audio', 'mind_map', 'presentation', 'code'],
        description: 'Starts with narration and mind map to reinforce story-driven lessons.',
        created_by: 'system',
        is_active: true,
      },
      {
        template_name: 'Workshop Collaboration Loop',
        template_type: 'ready_template',
        format_order: ['text', 'audio', 'presentation', 'mind_map', 'code'],
        description: 'Blends narration with collaborative visuals and practical coding.',
        created_by: 'system',
        is_active: true,
      },
      {
        template_name: 'Assessment Ready Sequence',
        template_type: 'ready_template',
        format_order: ['text', 'audio', 'code', 'mind_map', 'presentation'],
        description: 'Helps learners review key concepts before assessments.',
        created_by: 'system',
        is_active: true,
      },
      {
        template_name: 'Immersive Video Kickoff',
        template_type: 'ready_template',
        format_order: ['text', 'audio', 'avatar_video', 'presentation', 'code', 'mind_map'],
        description: 'Starts with narration and avatar video to increase engagement before diving into content.',
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

