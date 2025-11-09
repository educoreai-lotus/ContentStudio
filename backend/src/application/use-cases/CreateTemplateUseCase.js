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
    const mandatoryFormats = ['text', 'code', 'presentation', 'audio', 'mind_map'];
    const providedFormats = templateData.format_order || [];

    // Add missing mandatory formats if not provided
    const missingFormats = mandatoryFormats.filter(
      format => !providedFormats.includes(format)
    );

    if (missingFormats.length > 0) {
      // Add missing formats at the end
      templateData.format_order = [...providedFormats, ...missingFormats];
    }

    // Ensure audio is with text (text before or immediately after audio)
    const audioIndex = templateData.format_order.indexOf('audio');
    const textIndex = templateData.format_order.indexOf('text');

    if (audioIndex !== -1 && textIndex !== -1) {
      const isTextBeforeAudio = textIndex < audioIndex;
      const isTextImmediatelyAfter = textIndex === audioIndex + 1;

      if (!isTextBeforeAudio && !isTextImmediatelyAfter) {
        // Fix: Move text to be immediately after audio
        templateData.format_order.splice(textIndex, 1); // Remove text from current position
        templateData.format_order.splice(audioIndex + 1, 0, 'text'); // Insert after audio
      }
    }

    const template = new Template({
      template_type: templateData.template_type || 'manual',
      ...templateData,
    });
    return await this.templateRepository.create(template);
  }
}

