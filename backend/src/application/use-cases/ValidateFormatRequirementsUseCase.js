export class ValidateFormatRequirementsUseCase {
  constructor(topicRepository) {
    this.topicRepository = topicRepository;
  }

  async execute(topicId, contentItems = []) {
    if (!topicId || isNaN(topicId)) {
      throw new Error('Topic ID is required');
    }

    // Get topic
    const topic = await this.topicRepository.findById(topicId);

    if (!topic) {
      throw new Error('Topic not found');
    }

    // Update format flags based on content items
    topic.updateFormatFlags(contentItems);

    // Check if all required formats are present
    const hasAllFormats = topic.hasAllRequiredFormats();
    const missingFormats = topic.getMissingFormats();

    // Update topic in repository
    await this.topicRepository.update(topic);

    return {
      hasAllFormats,
      missingFormats,
      totalFormats: topic.total_content_formats,
      requiredFormats: 5,
      formatFlags: {
        has_text: topic.has_text,
        has_code: topic.has_code,
        has_presentation: topic.has_presentation,
        has_audio: topic.has_audio,
        has_mind_map: topic.has_mind_map,
      },
    };
  }
}


