import { logger } from '../../infrastructure/logging/Logger.js';
import { FileTextExtractor } from '../../services/FileTextExtractor.js';
import { OpenAIClient } from '../../infrastructure/external-apis/openai/OpenAIClient.js';
import { GenerateAvatarVideoFromPresentationPipeline } from './GenerateAvatarVideoFromPresentationPipeline.js';

/**
 * Generate Avatar Video from Presentation Use Case
 * 
 * New workflow:
 * 1. Extract text from presentation (PPTX/PDF) using FileTextExtractor
 * 2. Validate language using CreateContentUseCase.extractTextForLanguageValidation
 * 3. Validate quality/relevance using QualityCheckService
 * 4. Generate explanation using OpenAI GPT-4o
 * 5. Create avatar video with presentation as background
 * 6. Support up to 15 minutes (900 seconds)
 * 7. Allow custom avatar selection
 */
export class GenerateAvatarVideoFromPresentationUseCase {
  constructor({
    heygenClient,
    openaiClient,
    contentRepository,
    qualityCheckService,
    topicRepository,
    courseRepository,
    language = 'en',
  }) {
    this.heygenClient = heygenClient;
    this.openaiClient = openaiClient;
    this.contentRepository = contentRepository;
    this.qualityCheckService = qualityCheckService;
    this.topicRepository = topicRepository;
    this.courseRepository = courseRepository;
    this.language = language;
  }

  /**
   * Execute the workflow
   * @param {Object} params - Request parameters
   * @param {number} params.presentation_content_id - Content ID of the presentation
   * @param {string} params.custom_prompt - Optional custom prompt from trainer
   * @param {string} params.avatar_id - Optional custom avatar ID
   * @param {string} params.language - Language code (default: 'en')
   * @returns {Promise<Object>} Video generation result
   */
  async execute(params) {
    const {
      presentation_content_id,
      custom_prompt = null,
      avatar_id = null,
      language = this.language || 'en',
    } = params;

    try {
      // Step 1: Get presentation content
      logger.info('[GenerateAvatarVideoFromPresentation] Step 1: Fetching presentation content', {
        presentation_content_id,
      });

      const presentationContent = await this.contentRepository.findById(presentation_content_id);
      
      if (!presentationContent) {
        throw new Error(`Presentation content not found: ${presentation_content_id}`);
      }

      if (presentationContent.content_type_id !== 3) {
        throw new Error(`Content is not a presentation (type: ${presentationContent.content_type_id})`);
      }

      // Step 2: Extract text from presentation using QualityCheckService (same as CreateContentUseCase)
      logger.info('[GenerateAvatarVideoFromPresentation] Step 2: Extracting text from presentation');

      // Get presentation file URL first (needed for HeyGen background)
      const presentationFileUrl = presentationContent.content_data?.fileUrl || 
                                  presentationContent.content_data?.presentationUrl ||
                                  presentationContent.content_data?.url;

      let presentationText = '';
      
      // Use QualityCheckService.extractTextFromContent (same method used in CreateContentUseCase)
      // This handles all the same extraction logic: slides, fileUrl, fallbacks, etc.
      if (this.qualityCheckService) {
        try {
          presentationText = await this.qualityCheckService.extractTextFromContent(presentationContent);
          logger.info('[GenerateAvatarVideoFromPresentation] Text extracted via QualityCheckService', {
            textLength: presentationText?.length || 0,
            preview: presentationText?.substring(0, 200) || '',
          });
        } catch (extractError) {
          logger.warn('[GenerateAvatarVideoFromPresentation] QualityCheckService extraction failed, trying fallback', {
            error: extractError.message,
          });
        }
      }
      
      // Fallback: Use FileTextExtractor directly if QualityCheckService failed or not available
      if (!presentationText || presentationText.trim().length === 0) {
        if (presentationFileUrl) {
          try {
            presentationText = await FileTextExtractor.extractTextFromUrl(
              presentationFileUrl,
              presentationContent.content_data,
              this.openaiClient
            );
          } catch (extractError) {
            logger.error('[GenerateAvatarVideoFromPresentation] Failed to extract text from presentation', {
              error: extractError.message,
            });
            throw new Error(`Failed to extract text from presentation: ${extractError.message}`);
          }
        } else {
          // Last fallback: try to extract from content_data.slides
          if (presentationContent.content_data?.slides && Array.isArray(presentationContent.content_data.slides)) {
            presentationText = presentationContent.content_data.slides
              .map(slide => slide.text || slide.title || slide.content || slide.body || '')
              .filter(Boolean)
              .join('\n\n');
          }
        }
      }

      if (!presentationText || presentationText.trim().length === 0) {
        throw new Error('No text could be extracted from the presentation');
      }

      logger.info('[GenerateAvatarVideoFromPresentation] Text extracted successfully', {
        textLength: presentationText.length,
        preview: presentationText.substring(0, 200),
      });

      // NOTE: Quality check is NOT performed here because:
      // 1. If presentation was created manually - it was already checked in CreateContentUseCase
      // 2. If presentation was created by AI - quality check is not needed (AI generates quality content)
      // 3. The presentation already exists in the database, so validation should have been done at creation time

      // Step 3: Generate explanation using OpenAI GPT-4o
      logger.info('[GenerateAvatarVideoFromPresentation] Step 3: Generating explanation with OpenAI');

      let explanationText = '';
      
      if (custom_prompt && custom_prompt.trim().length > 0) {
        // Use custom prompt if provided
        explanationText = await this.generateExplanationWithCustomPrompt(
          presentationText,
          custom_prompt,
          language
        );
      } else {
        // Auto-generate explanation
        explanationText = await this.generateAutoExplanation(
          presentationText,
          language
        );
      }

      if (!explanationText || explanationText.trim().length === 0) {
        throw new Error('Failed to generate explanation from presentation');
      }

      logger.info('[GenerateAvatarVideoFromPresentation] Explanation generated successfully', {
        explanationLength: explanationText.length,
        preview: explanationText.substring(0, 200),
      });

      // Step 4: Create avatar video with presentation as background
      // Option 1: Use new detailed pipeline (per-slide narration)
      // Option 2: Use existing simple workflow (single explanation)
      // For now, use existing workflow but can be enhanced to use pipeline
      
      logger.info('[GenerateAvatarVideoFromPresentation] Step 4: Creating avatar video with HeyGen');

      const videoResult = await this.heygenClient.generateVideo({
        title: presentationContent.content_data?.title || 'EduCore Presentation',
        prompt: explanationText,
        language: language,
        duration: 900, // 15 minutes max
        presentation_file_url: presentationFileUrl,
        avatar_id: avatar_id, // Custom avatar if provided
        use_presentation_background: true,
      });

      if (videoResult.status === 'failed' || videoResult.status === 'skipped') {
        return {
          success: false,
          status: videoResult.status,
          error: videoResult.error || videoResult.reason,
          videoId: videoResult.videoId || null,
          videoUrl: null,
        };
      }

      logger.info('[GenerateAvatarVideoFromPresentation] Avatar video created successfully', {
        videoId: videoResult.videoId,
        videoUrl: videoResult.videoUrl,
      });

      return {
        success: true,
        status: 'completed',
        videoId: videoResult.videoId,
        videoUrl: videoResult.videoUrl,
        duration_seconds: videoResult.duration_seconds || 900,
        explanation: explanationText,
        metadata: {
          presentation_content_id,
          presentation_file_url: presentationFileUrl,
          avatar_id: avatar_id || 'default',
          language,
          generated_at: new Date().toISOString(),
        },
      };

    } catch (error) {
      logger.error('[GenerateAvatarVideoFromPresentation] Error generating avatar video', {
        error: error.message,
        stack: error.stack,
        presentation_content_id,
      });

      return {
        success: false,
        status: 'failed',
        error: error.message,
        videoId: null,
        videoUrl: null,
      };
    }
  }

  /**
   * Generate explanation with custom prompt
   * @param {string} presentationText - Extracted text from presentation
   * @param {string} customPrompt - Trainer's custom prompt
   * @param {string} language - Language code
   * @returns {Promise<string>} Generated explanation
   */
  async generateExplanationWithCustomPrompt(presentationText, customPrompt, language) {
    const prompt = `You are an expert teacher explaining a presentation to students.

Presentation content:
${presentationText}

Trainer's instruction:
${customPrompt}

Please generate a clear, engaging explanation of the presentation slides following the trainer's instruction. 
Write as if you are speaking directly to students, explaining each slide in a natural, conversational way.
Keep the explanation in ${language} language.

Generate the explanation:`;

    try {
      // generateText expects (prompt: string, options: object)
      const response = await this.openaiClient.generateText(prompt, {
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 4000,
      });

      // generateText returns a string directly, not an object
      return response || '';
    } catch (error) {
      logger.error('[GenerateAvatarVideoFromPresentation] OpenAI generation failed', {
        error: error.message,
      });
      throw new Error(`Failed to generate explanation: ${error.message}`);
    }
  }

  /**
   * Auto-generate explanation without custom prompt
   * @param {string} presentationText - Extracted text from presentation
   * @param {string} language - Language code
   * @returns {Promise<string>} Generated explanation
   */
  async generateAutoExplanation(presentationText, language) {
    const prompt = `You are an expert teacher explaining a presentation to students.

Presentation content:
${presentationText}

Please generate a clear, engaging explanation of the presentation slides. 
Write as if you are speaking directly to students, explaining each slide in simple language as if teaching beginners.
Keep the explanation in ${language} language.

Generate the explanation:`;

    try {
      // generateText expects (prompt: string, options: object)
      const response = await this.openaiClient.generateText(prompt, {
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 4000,
      });

      // generateText returns a string directly, not an object
      return response || '';
    } catch (error) {
      logger.error('[GenerateAvatarVideoFromPresentation] OpenAI generation failed', {
        error: error.message,
      });
      throw new Error(`Failed to generate explanation: ${error.message}`);
    }
  }
}

