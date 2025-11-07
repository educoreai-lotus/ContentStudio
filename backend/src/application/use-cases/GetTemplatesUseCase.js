/**
 * Get Templates Use Case
 */
export class GetTemplatesUseCase {
  constructor({ templateRepository }) {
    this.templateRepository = templateRepository;
  }

  async execute(filters = {}) {
    return await this.templateRepository.findAll(filters);
  }
}



