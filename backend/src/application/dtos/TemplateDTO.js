/**
 * Template Data Transfer Object
 */
export class TemplateDTO {
  static toTemplateResponse(template) {
    return {
      template_id: template.template_id,
      template_name: template.template_name,
      format_order: template.format_order,
      description: template.description,
      notes: template.notes,
      created_by: template.created_by,
      is_active: template.is_active,
      usage_count: template.usage_count,
      created_at: template.created_at.toISOString(),
      updated_at: template.updated_at.toISOString(),
    };
  }

  static toTemplateListResponse(templates) {
    return templates.map(template => this.toTemplateResponse(template));
  }
}



