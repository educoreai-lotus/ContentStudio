import { QualityCheck } from '../../../domain/entities/QualityCheck.js';

/**
 * In-memory Quality Check Repository Implementation
 * TODO: Replace with PostgreSQL implementation
 */
export class QualityCheckRepository {
  constructor() {
    this.qualityChecks = [];
    this.nextId = 1;
  }

  async create(qualityCheck) {
    const qualityCheckId = this.nextId++;
    const createdCheck = new QualityCheck({
      ...qualityCheck,
      quality_check_id: qualityCheckId,
      created_at: new Date(),
    });

    this.qualityChecks.push(createdCheck);
    return createdCheck;
  }

  async findById(qualityCheckId) {
    const check = this.qualityChecks.find(
      qc => qc.quality_check_id === qualityCheckId
    );
    return check || null;
  }

  async findByContentId(contentId) {
    return this.qualityChecks
      .filter(qc => qc.content_id === contentId)
      .sort((a, b) => b.created_at - a.created_at);
  }

  async findLatestByContentId(contentId) {
    const checks = await this.findByContentId(contentId);
    return checks.length > 0 ? checks[0] : null;
  }

  async findAll(filters = {}) {
    let results = [...this.qualityChecks];

    if (filters.content_id) {
      results = results.filter(qc => qc.content_id === filters.content_id);
    }

    if (filters.status) {
      results = results.filter(qc => qc.status === filters.status);
    }

    if (filters.check_type) {
      results = results.filter(qc => qc.check_type === filters.check_type);
    }

    return results.sort((a, b) => b.created_at - a.created_at);
  }

  async update(qualityCheckId, updates) {
    const index = this.qualityChecks.findIndex(
      qc => qc.quality_check_id === qualityCheckId
    );
    if (index === -1) {
      throw new Error(`Quality check with id ${qualityCheckId} not found`);
    }

    const existingCheck = this.qualityChecks[index];
    const updatedCheck = new QualityCheck({
      ...existingCheck,
      ...updates,
      quality_check_id: qualityCheckId,
    });

    this.qualityChecks[index] = updatedCheck;
    return updatedCheck;
  }

  async delete(qualityCheckId) {
    const index = this.qualityChecks.findIndex(
      qc => qc.quality_check_id === qualityCheckId
    );
    if (index === -1) {
      throw new Error(`Quality check with id ${qualityCheckId} not found`);
    }

    this.qualityChecks.splice(index, 1);
  }
}



