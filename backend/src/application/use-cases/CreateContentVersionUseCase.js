import { ContentVersion } from '../../domain/entities/ContentVersion.js';

/**
 * Create Content Version Use Case
 * Creates a new version when content is updated
 */
export class CreateContentVersionUseCase {
  constructor({ contentVersionRepository, contentRepository }) {
    this.contentVersionRepository = contentVersionRepository;
    this.contentRepository = contentRepository;
  }

  async execute(contentId, contentData, createdBy, changeDescription = null) {
    if (!contentId) {
      throw new Error('content_id is required');
    }

    if (!contentData) {
      throw new Error('content_data is required');
    }

    const content = await this.contentRepository.findById?.(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    const { topic_id, content_type_id } = content;

    const currentVersion = await this.contentVersionRepository.findCurrentVersion(
      topic_id,
      content_type_id
    );
    const parentVersionId = currentVersion ? currentVersion.version_id : null;

    // Mark all previous versions as not current before creating new one
    await this.contentVersionRepository.markAllAsNotCurrent(topic_id, content_type_id);

    const now = new Date();
    const version = new ContentVersion({
      content_id: contentId, // Include content_id in version
      version_number: null, // Deprecated: use timestamps instead
      content_data: contentData,
      created_by: createdBy,
      is_current_version: true,
      change_description: changeDescription,
      parent_version_id: parentVersionId,
      topic_id,
      content_type_id,
      generation_method_id: content.generation_method_id,
      created_at: now,
      updated_at: now,
    });

    return await this.contentVersionRepository.create(version);
  }
}



