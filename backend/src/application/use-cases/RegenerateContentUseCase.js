import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';

/**
 * Regenerate Content Use Case
 * Handles content regeneration with mandatory history archiving
 * 
 * Flow:
 * 1. Read existing content row
 * 2. Save previous version to content_history (MANDATORY)
 * 3. Generate new content
 * 4. Update the SAME content row (do NOT create new row)
 */
export class RegenerateContentUseCase {
  constructor({
    contentRepository,
    contentHistoryService,
    aiGenerationService,
    promptTemplateService,
    qualityCheckService,
  }) {
    this.contentRepository = contentRepository;
    this.contentHistoryService = contentHistoryService;
    this.aiGenerationService = aiGenerationService;
    this.promptTemplateService = promptTemplateService;
    this.qualityCheckService = qualityCheckService;
  }

  async execute(regenerateRequest) {
    // Validate input
    if (!regenerateRequest.content_id) {
      throw new Error('content_id is required for regeneration');
    }

    if (!regenerateRequest.topic_id) {
      throw new Error('topic_id is required for regeneration');
    }

    if (!regenerateRequest.content_type_id) {
      throw new Error('content_type_id is required for regeneration');
    }

    // Step 1: Read existing content row
    const existingContent = await this.contentRepository.findById(regenerateRequest.content_id);
    if (!existingContent) {
      throw new Error(`Content with id ${regenerateRequest.content_id} not found`);
    }

    // Validate that content matches request
    if (existingContent.topic_id !== regenerateRequest.topic_id) {
      throw new Error('Content topic_id does not match request');
    }

    if (existingContent.content_type_id !== regenerateRequest.content_type_id) {
      throw new Error('Content content_type_id does not match request');
    }

    // Step 2: MANDATORY - Save previous version to content_history
    if (!this.contentHistoryService?.saveVersion) {
      throw new Error('ContentHistoryService is required for regeneration');
    }

    try {
      console.log('[RegenerateContentUseCase] Saving previous version to history:', {
        content_id: existingContent.content_id,
        topic_id: existingContent.topic_id,
        content_type_id: existingContent.content_type_id,
      });

      await this.contentHistoryService.saveVersion(existingContent, { force: true });
      console.log('[RegenerateContentUseCase] Successfully archived previous version to history');
    } catch (error) {
      console.error('[RegenerateContentUseCase] Failed to save previous version to history:', error.message, error.stack);
      throw new Error(`Failed to archive previous version: ${error.message}`);
    }

    // Step 3: Generate new content using GenerateContentUseCase logic
    // Import GenerateContentUseCase to reuse its generation logic
    const { GenerateContentUseCase } = await import('./GenerateContentUseCase.js');
    const generateContentUseCase = new GenerateContentUseCase({
      contentRepository: this.contentRepository,
      aiGenerationService: this.aiGenerationService,
      promptTemplateService: this.promptTemplateService,
      qualityCheckService: this.qualityCheckService,
    });

    // Build generation request from regenerate request
    const generationRequest = {
      topic_id: regenerateRequest.topic_id,
      content_type_id: regenerateRequest.content_type_id,
      prompt: regenerateRequest.prompt,
      template_id: regenerateRequest.template_id,
      template_variables: regenerateRequest.template_variables,
      lessonTopic: regenerateRequest.lessonTopic,
      lessonDescription: regenerateRequest.lessonDescription,
      language: regenerateRequest.language,
      skillsList: regenerateRequest.skillsList,
      style: regenerateRequest.style,
      difficulty: regenerateRequest.difficulty,
      programming_language: regenerateRequest.programming_language,
      voice: regenerateRequest.voice,
      slide_count: regenerateRequest.slide_count,
      audio_format: regenerateRequest.audio_format,
      tts_model: regenerateRequest.tts_model,
      audience: regenerateRequest.audience,
      trainerPrompt: regenerateRequest.trainerPrompt,
      transcriptText: regenerateRequest.transcriptText,
    };

    // Generate new content (this returns a Content entity, not saved yet)
    const generatedContent = await generateContentUseCase.execute(generationRequest);

    // Step 4: Update the SAME content row (do NOT create new row)
    const cleanedContentData = ContentDataCleaner.clean(
      generatedContent.content_data,
      existingContent.content_type_id
    );

    const updatedContent = await this.contentRepository.update(existingContent.content_id, {
      content_data: cleanedContentData,
      generation_method_id: regenerateRequest.generation_method_id || existingContent.generation_method_id,
      updated_at: new Date(),
    });

    console.log('[RegenerateContentUseCase] Successfully regenerated content:', {
      content_id: updatedContent.content_id,
      topic_id: updatedContent.topic_id,
      content_type_id: updatedContent.content_type_id,
    });

    return updatedContent;
  }
}

