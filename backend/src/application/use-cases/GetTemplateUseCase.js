/**
 * Get Template Use Case
 */
export class GetTemplateUseCase {
  constructor({ templateRepository }) {
    this.templateRepository = templateRepository;
  }

  async execute(templateId) {
    return await this.templateRepository.findById(templateId);
  }
}



