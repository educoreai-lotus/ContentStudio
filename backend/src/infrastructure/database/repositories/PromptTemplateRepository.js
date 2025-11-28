import { PromptTemplate } from '../../../domain/entities/PromptTemplate.js';

/**
 * In-memory Prompt Template Repository Implementation
 * TODO: Replace with PostgreSQL implementation
 */
export class PromptTemplateRepository {
  constructor() {
    this.templates = [];
    this.nextId = 1;

    // Seed with default templates
    this.initializeDefaultTemplates();
  }

  initializeDefaultTemplates() {
    const defaultTemplates = [
      {
        template_name: 'Default Text Lesson Template',
        content_type_id: 'text',
        template_text:
          'Create an educational lesson about {topic}. The lesson should cover {key_points} and be suitable for {audience}. Include examples and clear explanations.',
        variables: ['topic', 'key_points', 'audience'],
        created_by: 'system',
        is_active: true,
      },
      {
        template_name: 'Default Code Example Template',
        content_type_id: 'code',
        template_text:
          'Generate a {language} code example demonstrating {concept}. Include comments explaining the code logic.',
        variables: ['language', 'concept'],
        created_by: 'system',
        is_active: true,
      },
    ];

    defaultTemplates.forEach(template => {
      const promptTemplate = new PromptTemplate({
        ...template,
        template_id: this.nextId++,
      });
      this.templates.push(promptTemplate);
    });
  }

  async create(template) {
    const templateId = this.nextId++;
    const createdTemplate = new PromptTemplate({
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

  async findByContentType(contentTypeId) {
    return this.templates.filter(
      t => t.content_type_id === contentTypeId && t.is_active
    );
  }

  async findAll(filters = {}) {
    let results = this.templates.filter(t => t.is_active);

    if (filters.content_type_id) {
      results = results.filter(t => t.content_type_id === filters.content_type_id);
    }

    if (filters.created_by) {
      results = results.filter(t => t.created_by === filters.created_by);
    }

    return results;
  }

  async update(templateId, updates) {
    const index = this.templates.findIndex(t => t.template_id === templateId);
    if (index === -1) {
      throw new Error(`Template with id ${templateId} not found`);
    }

    const existingTemplate = this.templates[index];
    const updatedTemplate = new PromptTemplate({
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



