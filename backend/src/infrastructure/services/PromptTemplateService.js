/**
 * Prompt Template Service
 * Handles prompt template operations
 */
export class PromptTemplateService {
  constructor({ promptTemplateRepository }) {
    this.promptTemplateRepository = promptTemplateRepository;
  }

  async getTemplate(templateId) {
    const template = await this.promptTemplateRepository.findById(templateId);
    if (!template) {
      throw new Error(`Template with id ${templateId} not found`);
    }
    return template;
  }

  async getTemplateByContentType(contentTypeId) {
    return await this.promptTemplateRepository.findByContentType(contentTypeId);
  }

  async getAllTemplates(filters = {}) {
    return await this.promptTemplateRepository.findAll(filters);
  }

  async createTemplate(templateData) {
    return await this.promptTemplateRepository.create(templateData);
  }
}



