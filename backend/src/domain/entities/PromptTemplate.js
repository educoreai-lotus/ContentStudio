/**
 * Prompt Template Entity
 * Represents a reusable prompt template for AI content generation
 */
export class PromptTemplate {
  constructor({
    template_id,
    template_name,
    content_type_id,
    template_text,
    variables = [],
    created_by,
    is_active = true,
    created_at = new Date(),
    updated_at = new Date(),
  }) {
    this.template_id = template_id;
    this.template_name = template_name;
    this.content_type_id = content_type_id;
    this.template_text = template_text;
    this.variables = variables.length > 0 ? variables : this.extractVariables(template_text);
    this.created_by = created_by;
    this.is_active = is_active;
    this.created_at = created_at instanceof Date ? created_at : new Date(created_at);
    this.updated_at = updated_at instanceof Date ? updated_at : new Date(updated_at);

    this.validate();
  }

  validate() {
    const errors = [];

    // Required fields
    if (!this.template_name || this.template_name.trim() === '') {
      errors.push('template_name is required and cannot be empty');
    }

    // Content type validation
    const validContentTypes = [
      'avatar_video',
      'text',
      'text_audio',
      'code',
      'presentation',
      'audio',
      'mind_map',
    ];
    if (!this.content_type_id || !validContentTypes.includes(this.content_type_id)) {
      errors.push(
        `content_type_id must be one of: ${validContentTypes.join(', ')}`
      );
    }

    // Template text validation
    if (!this.template_text || this.template_text.trim() === '') {
      errors.push('template_text is required and cannot be empty');
    }

    // Created by validation
    if (!this.created_by || this.created_by.trim() === '') {
      errors.push('created_by is required');
    }

    if (errors.length > 0) {
      throw new Error(`PromptTemplate validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Extract variables from template text (e.g., {variable_name})
   * @param {string} text - Template text
   * @returns {string[]} Array of variable names
   */
  extractVariables(text) {
    if (!text) return [];
    const regex = /\{(\w+)\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    return matches;
  }

  /**
   * Render template with variable values
   * @param {Object} variables - Variable values
   * @returns {string} Rendered template text
   */
  render(variables = {}) {
    let rendered = this.template_text;

    this.variables.forEach(variable => {
      const value = variables[variable] || `{${variable}}`;
      const regex = new RegExp(`\\{${variable}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    });

    return rendered;
  }

  /**
   * Deactivate template
   */
  deactivate() {
    this.is_active = false;
    this.updated_at = new Date();
  }

  /**
   * Activate template
   */
  activate() {
    this.is_active = true;
    this.updated_at = new Date();
  }
}



