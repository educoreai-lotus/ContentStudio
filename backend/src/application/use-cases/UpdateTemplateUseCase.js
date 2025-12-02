/**
 * Update Template Use Case
 */
export class UpdateTemplateUseCase {
  constructor({ templateRepository }) {
    this.templateRepository = templateRepository;
  }

  async execute(templateId, updates) {
    // Validate format_order if provided
    if (updates.format_order) {
      const validContentTypes = [
        'avatar_video',
        'text',
        'text_audio',
        'code',
        'presentation',
        'audio',
        'mind_map',
      ];
      const invalidTypes = updates.format_order.filter(
        type => !validContentTypes.includes(type)
      );
      if (invalidTypes.length > 0) {
        throw new Error(`Invalid content types: ${invalidTypes.join(', ')}`);
      }
    }

    return await this.templateRepository.update(templateId, updates);
  }
}



