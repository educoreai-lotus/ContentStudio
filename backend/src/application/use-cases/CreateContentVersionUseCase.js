import { ContentVersion } from '../../domain/entities/ContentVersion.js';

/**
 * Create Content Version Use Case
 * Creates a new version when content is updated
 */
export class CreateContentVersionUseCase {
  constructor({ contentVersionRepository }) {
    this.contentVersionRepository = contentVersionRepository;
  }

  async execute(contentId, contentData, createdBy, changeDescription = null) {
    if (!contentId) {
      throw new Error('content_id is required');
    }

    if (!contentData) {
      throw new Error('content_data is required');
    }

    // Get next version number
    const versionNumber = await this.contentVersionRepository.getNextVersionNumber(
      contentId
    );

    // Get current version as parent
    const currentVersion = await this.contentVersionRepository.findCurrentVersion(
      contentId
    );
    const parentVersionId = currentVersion ? currentVersion.version_id : null;

    // Mark all previous versions as not current
    await this.contentVersionRepository.markAllAsNotCurrent(contentId);

    // Create new version
    const version = new ContentVersion({
      content_id: contentId,
      version_number: versionNumber,
      content_data: contentData,
      created_by: createdBy,
      is_current_version: true,
      change_description: changeDescription,
      parent_version_id: parentVersionId,
    });

    return await this.contentVersionRepository.create(version);
  }
}



