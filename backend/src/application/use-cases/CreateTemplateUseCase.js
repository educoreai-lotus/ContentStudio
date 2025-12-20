import { Template } from '../../domain/entities/Template.js';

/**
 * Create Template Use Case
 */
export class CreateTemplateUseCase {
  constructor({ templateRepository }) {
    this.templateRepository = templateRepository;
  }

  async execute(templateData) {
    // Ensure all 5 mandatory formats are included
    const mandatoryFormats = ['text_audio', 'code', 'presentation', 'mind_map', 'avatar_video'];
    const providedFormats = templateData.format_order || [];

    // Handle legacy formats: convert 'text' and 'audio' to 'text_audio'
    let normalizedFormats = [...providedFormats];
    const hasText = normalizedFormats.includes('text');
    const hasAudio = normalizedFormats.includes('audio');
    if (hasText || hasAudio) {
      normalizedFormats = normalizedFormats.filter(f => f !== 'text' && f !== 'audio');
      if (!normalizedFormats.includes('text_audio')) {
        normalizedFormats.unshift('text_audio');
      }
    }

    // Add missing mandatory formats if not provided
    const missingFormats = mandatoryFormats.filter(
      format => !normalizedFormats.includes(format)
    );

    if (missingFormats.length > 0) {
      // Add missing formats at the end
      normalizedFormats = [...normalizedFormats, ...missingFormats];
    }

    templateData.format_order = normalizedFormats;

    const template = new Template({
      template_type: templateData.template_type || 'manual',
      ...templateData,
    });
    return await this.templateRepository.create(template);
  }
}

