import { ContentVersionRepository as IContentVersionRepository } from '../../../domain/repositories/ContentVersionRepository.js';
import { ContentVersion } from '../../../domain/entities/ContentVersion.js';

/**
 * In-memory Content Version Repository Implementation
 * TODO: Replace with PostgreSQL implementation
 */
export class ContentVersionRepository extends IContentVersionRepository {
  constructor() {
    super();
    this.versions = [];
    this.nextId = 1;
  }

  async create(version) {
    const versionId = this.nextId++;
    const createdVersion = new ContentVersion({
      ...version,
      version_id: versionId,
      created_at: version.created_at || new Date(),
    });

    this.versions.push(createdVersion);
    return createdVersion;
  }

  async findById(versionId) {
    const version = this.versions.find(v => v.version_id === versionId);
    return version || null;
  }

  async findByContentId(contentId) {
    return this.versions
      .filter(v => v.content_id === contentId && !v.deleted_at)
      .sort((a, b) => b.version_number - a.version_number);
  }

  async findCurrentVersion(contentId) {
    const versions = await this.findByContentId(contentId);
    return versions.find(v => v.is_current_version) || null;
  }

  async getNextVersionNumber(contentId) {
    const versions = await this.findByContentId(contentId);
    if (versions.length === 0) {
      return 1;
    }
    const maxVersion = Math.max(...versions.map(v => v.version_number));
    return maxVersion + 1;
  }

  async update(versionId, updates) {
    const index = this.versions.findIndex(v => v.version_id === versionId);
    if (index === -1) {
      throw new Error(`Version with id ${versionId} not found`);
    }

    const existingVersion = this.versions[index];
    const updatedVersion = new ContentVersion({
      ...existingVersion,
      ...updates,
      version_id: versionId,
    });

    this.versions[index] = updatedVersion;
    return updatedVersion;
  }

  async markAllAsNotCurrent(contentId) {
    const versions = await this.findByContentId(contentId);
    versions.forEach(version => {
      version.markAsNotCurrent();
      const index = this.versions.findIndex(v => v.version_id === version.version_id);
      if (index !== -1) {
        this.versions[index] = version;
      }
    });
  }

  async softDelete(versionId) {
    const index = this.versions.findIndex(v => v.version_id === versionId);
    if (index === -1) {
      throw new Error(`Version with id ${versionId} not found`);
    }
    this.versions[index].deleted_at = new Date();
  }
}



