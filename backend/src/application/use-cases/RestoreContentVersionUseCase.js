/**
 * Restore Content Version Use Case
 * Restores content to a specific version
 */
export class RestoreContentVersionUseCase {
  constructor({
    contentVersionRepository,
    contentRepository,
    createContentVersionUseCase,
  }) {
    this.contentVersionRepository = contentVersionRepository;
    this.contentRepository = contentRepository;
    this.createContentVersionUseCase = createContentVersionUseCase;
  }

  async execute(versionId, restoredBy) {
    if (!versionId) {
      throw new Error('version_id is required');
    }

    // Get the version to restore
    const version = await this.contentVersionRepository.findById(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    // Get the content
    const content = await this.contentRepository.findById(version.content_id);
    if (!content) {
      throw new Error('Content not found');
    }

    // Update content with version data
    const updatedContent = await this.contentRepository.update(
      version.content_id,
      {
        content_data: version.content_data,
      }
    );

    // Create a new version from the restored version (preserve history)
    await this.createContentVersionUseCase.execute(
      version.content_id,
      version.content_data,
      restoredBy,
      `Restored from version ${version.version_number}`
    );

    return updatedContent;
  }
}



