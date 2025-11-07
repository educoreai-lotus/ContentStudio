/**
 * Delete Template Use Case
 */
export class DeleteTemplateUseCase {
  constructor({ templateRepository }) {
    this.templateRepository = templateRepository;
  }

  async execute(templateId) {
    // Soft delete
    await this.templateRepository.delete(templateId);
  }
}



