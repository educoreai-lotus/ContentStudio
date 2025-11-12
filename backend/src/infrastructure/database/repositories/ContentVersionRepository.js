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

  async findByTopicAndType(topicId, contentTypeId) {
    return this.versions
      .filter(
        v =>
          v.topic_id === topicId &&
          v.content_type_id === contentTypeId &&
          !v.deleted_at
      )
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        if (bTime !== aTime) return bTime - aTime;
        const aCreated = new Date(a.created_at || 0).getTime();
        const bCreated = new Date(b.created_at || 0).getTime();
        return bCreated - aCreated;
      });
  }

  async findCurrentVersion(topicId, contentTypeId) {
    const versions = await this.findByTopicAndType(topicId, contentTypeId);
    return versions.find(v => v.is_current_version) || null;
  }

  async getNextVersionNumber(topicId, contentTypeId) {
    // Deprecated: version_number is no longer used. This method is kept for backward compatibility
    // but returns null to indicate timestamps should be used instead.
    console.warn('[ContentVersionRepository] getNextVersionNumber is deprecated. Use timestamps for version tracking.');
    return null;
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

  async markAllAsNotCurrent(topicId, contentTypeId) {
    const versions = await this.findByTopicAndType(topicId, contentTypeId);
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



