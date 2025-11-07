/**
 * Template Repository Interface
 * Defines contract for template data operations
 */
export class TemplateRepository {
  /**
   * Create a new template
   * @param {Template} template - Template entity
   * @returns {Promise<Template>} Created template
   */
  async create(template) {
    throw new Error('TemplateRepository.create() must be implemented');
  }

  /**
   * Find template by ID
   * @param {number} templateId - Template ID
   * @returns {Promise<Template|null>} Template or null if not found
   */
  async findById(templateId) {
    throw new Error('TemplateRepository.findById() must be implemented');
  }

  /**
   * Find all templates
   * @param {Object} filters - Filter options
   * @returns {Promise<Template[]>} Array of templates
   */
  async findAll(filters = {}) {
    throw new Error('TemplateRepository.findAll() must be implemented');
  }

  /**
   * Update template
   * @param {number} templateId - Template ID
   * @param {Object} updates - Update data
   * @returns {Promise<Template>} Updated template
   */
  async update(templateId, updates) {
    throw new Error('TemplateRepository.update() must be implemented');
  }

  /**
   * Delete template (soft delete)
   * @param {number} templateId - Template ID
   * @returns {Promise<void>}
   */
  async delete(templateId) {
    throw new Error('TemplateRepository.delete() must be implemented');
  }
}



