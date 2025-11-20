import { logger } from '../../infrastructure/logging/Logger.js';
import { GenerateContentUseCase } from '../use-cases/GenerateContentUseCase.js';
import { Content } from '../../domain/entities/Content.js';

/**
 * Content Generation Orchestrator
 * Orchestrates automatic generation of all lesson formats from a video transcript
 * Uses existing prompt templates and generation logic
 */
export class ContentGenerationOrchestrator {
  constructor({
    aiGenerationService,
    openaiClient,
    contentRepository,
    topicRepository,
    promptTemplateService,
    qualityCheckService,
  }) {
    this.aiGenerationService = aiGenerationService;
    this.openaiClient = openaiClient;
    this.contentRepository = contentRepository;
    this.topicRepository = topicRepository;
    this.promptTemplateService = promptTemplateService;
    this.qualityCheckService = qualityCheckService;

    // Initialize GenerateContentUseCase with existing dependencies
    this.generateContentUseCase = new GenerateContentUseCase({
      contentRepository,
      aiGenerationService,
      promptTemplateService,
      qualityCheckService,
    });
  }

  /**
   * Generate all lesson formats from transcript
   * @param {string} transcript - Video transcript text
   * @param {Object} options - Options
   * @param {number} options.topic_id - Topic ID (required)
   * @param {string} options.trainer_id - Trainer ID (optional, for topic creation)
   * @param {string} options.topic_name - Topic name (optional, will extract from transcript if not provided)
   * @param {string} options.language - Language code (optional, will detect if not provided)
   * @param {Array} options.skillsList - Skills list (optional, will extract from transcript if not provided)
   * @param {Function} options.onProgress - Progress callback: (format, status, message) => void
   * @returns {Promise<Object>} Generated content with all formats
   */
  async generateAll(transcript, options = {}) {
    logger.info('[ContentGenerationOrchestrator] Starting content generation from transcript', {
      transcriptLength: transcript.length,
      topic_id: options.topic_id,
    });

    // Validate required fields
    if (!options.topic_id) {
      throw new Error('topic_id is required for content generation');
    }

    const topicId = options.topic_id;
    const onProgress = options.onProgress || (() => {});

    // Step 1: Normalize transcript
    const normalizedTranscript = this.normalizeTranscript(transcript);
    logger.info('[ContentGenerationOrchestrator] Transcript normalized', {
      originalLength: transcript.length,
      normalizedLength: normalizedTranscript.length,
    });

    // Step 2: Get topic metadata or extract from transcript
    let topicMetadata = await this.getTopicMetadata(topicId);
    
    // If topic metadata is missing, extract from transcript
    if (!topicMetadata.lessonTopic || !topicMetadata.lessonDescription) {
      const extractedMetadata = await this.extractMetadata(normalizedTranscript, options);
      topicMetadata = {
        lessonTopic: topicMetadata.lessonTopic || extractedMetadata.title || options.topic_name || 'Untitled Lesson',
        lessonDescription: topicMetadata.lessonDescription || normalizedTranscript.substring(0, 500) + '...',
        language: topicMetadata.language || extractedMetadata.language || options.language || await this.detectLanguage(normalizedTranscript),
        skillsList: topicMetadata.skillsList || extractedMetadata.skills || options.skillsList || [],
      };
    }

    // Step 3: Use transcript as lessonDescription (replaces trainer prompt)
    // The transcript replaces the trainer prompt in all prompt templates
    const generationRequestBase = {
      topic_id: topicId,
      lessonTopic: topicMetadata.lessonTopic,
      lessonDescription: normalizedTranscript, // TRANSCRIPT REPLACES TRAINER PROMPT
      language: topicMetadata.language || 'English',
      skillsList: topicMetadata.skillsList || [],
      transcriptText: normalizedTranscript, // Pass transcript text for avatar video generation
    };

    // Step 4: Generate all 6 formats in parallel with progress events
    const formats = [
      { id: 1, name: 'text', label: 'Text & Audio', contentType: 'text' },
      { id: 2, name: 'code', label: 'Code Examples', contentType: 'code' },
      { id: 3, name: 'presentation', label: 'Presentation Slides', contentType: 'presentation' },
      { id: 4, name: 'audio', label: 'Audio', contentType: 'audio' },
      { id: 5, name: 'mind_map', label: 'Mind Map', contentType: 'mind_map' },
      { id: 6, name: 'avatar_video', label: 'Avatar Video', contentType: 'avatar_video' },
    ];

    const results = {};
    const startTime = Date.now();
    
    const progressPromises = formats.map(async (format) => {
      const formatStartTime = Date.now();
      try {
        // Emit progress: starting
        onProgress(format.name, 'starting', `[AI] Starting: ${format.label}`);
        logger.info(`[ContentGenerationOrchestrator] Starting generation: ${format.label}`, {
          format: format.name,
          content_type_id: format.id,
        });

        // Build generation request for this format
        const generationRequest = {
          ...generationRequestBase,
          content_type_id: format.id,
        };

        logger.info(`[ContentGenerationOrchestrator] Calling GenerateContentUseCase for ${format.label}`, {
          topic_id: generationRequest.topic_id,
          content_type_id: format.id,
          lessonTopic: generationRequest.lessonTopic,
        });

        // Generate content using existing GenerateContentUseCase
        // Add timeout of 5 minutes per format
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Generation timeout: ${format.label} took more than 5 minutes`));
          }, 300000); // 5 minutes
        });

        const generatedContent = await Promise.race([
          this.generateContentUseCase.execute(generationRequest),
          timeoutPromise,
        ]);

        logger.info(`[ContentGenerationOrchestrator] Content generated for ${format.label}`, {
          format: format.name,
          hasContentData: !!generatedContent.content_data,
          contentDataKeys: generatedContent.content_data ? Object.keys(generatedContent.content_data) : [],
          // Status removed for avatar_video - check videoUrl/error instead
          hasVideoUrl: format.name === 'avatar_video' ? !!generatedContent.content_data?.videoUrl : undefined,
          hasError: format.name === 'avatar_video' ? !!generatedContent.content_data?.error : undefined,
        });

        // Check if avatar_video failed (by checking if videoUrl is null/undefined, since status is removed)
        const isFailed = format.name === 'avatar_video' && (!generatedContent.content_data?.videoUrl || generatedContent.content_data?.error);

        // Override generation_method_id to 'video_to_lesson' (instead of 'ai_assisted')
        generatedContent.generation_method_id = 'video_to_lesson';

        // Save to database (even if failed, save it with failed status)
        logger.info(`[ContentGenerationOrchestrator] Saving ${format.label} to database...`, {
          format: format.name,
          isFailed,
        });

        const savedContent = await this.contentRepository.create(generatedContent);

        const formatDuration = Date.now() - formatStartTime;

        if (isFailed) {
          // Emit progress: failed
          const reason = generatedContent.content_data?.reason || 'Avatar video generation failed';
          onProgress(format.name, 'failed', `[AI] Failed: ${format.label} - ${reason}`);
          logger.warn(`[ContentGenerationOrchestrator] ⚠️ Avatar video failed but saved to database`, {
            format: format.name,
            content_id: savedContent.content_id,
            reason,
            duration: `${formatDuration}ms`,
          });

          // Return failed result - but don't throw, allow other formats to continue
          results[format.name] = {
            content_id: savedContent.content_id,
            format: format.name,
            content_type_id: format.id,
            generated: false,
            status: 'failed',
            reason,
            error: generatedContent.content_data?.error || 'Avatar video generation failed',
            content_data: savedContent.content_data,
          };
        } else {
          logger.info(`[ContentGenerationOrchestrator] Saved ${format.label} to database`, {
            format: format.name,
            content_id: savedContent.content_id,
            duration: `${formatDuration}ms`,
          });

          // Emit progress: completed
          onProgress(format.name, 'completed', `[AI] Completed: ${format.label}`);
          logger.info(`[ContentGenerationOrchestrator] ✅ Completed generation: ${format.label}`, {
            content_id: savedContent.content_id,
            duration: `${formatDuration}ms`,
          });

          // Return result
          results[format.name] = {
            content_id: savedContent.content_id,
            format: format.name,
            content_type_id: format.id,
            generated: true,
            content_data: savedContent.content_data,
          };
        }

        return results[format.name];
      } catch (error) {
        const formatDuration = Date.now() - formatStartTime;
        // Emit progress: failed
        const errorMessage = error.message || 'Unknown error';
        onProgress(format.name, 'failed', `[AI] Failed: ${format.label} - ${errorMessage}`);
        logger.error(`[ContentGenerationOrchestrator] ❌ Failed to generate ${format.label}`, {
          format: format.name,
          error: errorMessage,
          duration: `${formatDuration}ms`,
          stack: error.stack,
        });

        results[format.name] = {
          format: format.name,
          content_type_id: format.id,
          generated: false,
          error: errorMessage,
        };

        return results[format.name];
      }
    });

    // Wait for all formats to complete (or fail)
    // Use Promise.allSettled to ensure all formats complete even if some fail
    logger.info('[ContentGenerationOrchestrator] Waiting for all formats to complete...', {
      topicId,
      formatsCount: formats.length,
    });

    const settledResults = await Promise.allSettled(progressPromises);
    
    const totalDuration = Date.now() - startTime;
    const successCount = Object.keys(results).filter(k => results[k].generated).length;
    const failedCount = Object.keys(results).filter(k => !results[k].generated).length;

    logger.info('[ContentGenerationOrchestrator] ✅ All formats processed', {
      topicId,
      formatsGenerated: successCount,
      formatsFailed: failedCount,
      totalDuration: `${totalDuration}ms (${Math.round(totalDuration / 1000)}s)`,
      settledResultsCount: settledResults.length,
    });

    // Log detailed results
    formats.forEach(format => {
      const result = results[format.name];
      if (result) {
        if (result.generated) {
          logger.info(`[ContentGenerationOrchestrator] ✅ ${format.label}: Success`, {
            content_id: result.content_id,
          });
        } else {
          logger.warn(`[ContentGenerationOrchestrator] ❌ ${format.label}: Failed`, {
            error: result.error,
          });
        }
      }
    });

    // Check if avatar_video failed (by checking if videoUrl is null/undefined, since status is removed)
    const avatarVideoFailed = results.avatar_video && (!results.avatar_video.videoUrl || results.avatar_video.error);

    return {
      topic_id: topicId,
      transcript: {
        text: normalizedTranscript,
        language: topicMetadata.language,
        length: normalizedTranscript.length,
      },
      metadata: {
        lessonTopic: topicMetadata.lessonTopic,
        language: topicMetadata.language,
        skillsList: topicMetadata.skillsList,
      },
      content_formats: {
        text_audio: results.text,
        code_examples: results.code,
        slides: results.presentation,
        audio: results.audio,
        mind_map: results.mind_map,
        avatar_video: results.avatar_video,
      },
      // Add continue_generation flag if avatar_video failed
      ...(avatarVideoFailed && {
        continue_generation: true,
        avatar_video: {
          status: 'failed',
          reason: results.avatar_video.reason || 'Avatar video failed due to unsupported voice engine. Please choose another voice.',
        },
      }),
    };
  }

  /**
   * Get topic metadata from database
   * @param {number} topicId - Topic ID
   * @returns {Promise<Object>} Topic metadata
   */
  async getTopicMetadata(topicId) {
    if (!this.topicRepository) {
      return {
        lessonTopic: null,
        lessonDescription: null,
        language: null,
        skillsList: [],
      };
    }

    try {
      const topic = await this.topicRepository.findById(topicId);
      if (topic) {
        return {
          lessonTopic: topic.topic_name,
          lessonDescription: topic.description,
          language: topic.language || 'English',
          skillsList: Array.isArray(topic.skills) ? topic.skills : (topic.skills ? [topic.skills] : []),
        };
      }
    } catch (error) {
      logger.warn('[ContentGenerationOrchestrator] Failed to fetch topic metadata', {
        topicId,
        error: error.message,
      });
    }

    return {
      lessonTopic: null,
      lessonDescription: null,
      language: null,
      skillsList: [],
    };
  }

  /**
   * Normalize transcript text
   * @param {string} transcript - Raw transcript
   * @returns {string} Normalized transcript
   */
  normalizeTranscript(transcript) {
    if (!transcript || typeof transcript !== 'string') {
      return '';
    }

    // Remove extra whitespace
    let normalized = transcript.trim();

    // Normalize line breaks
    normalized = normalized.replace(/\r\n/g, '\n');
    normalized = normalized.replace(/\r/g, '\n');

    // Remove excessive line breaks (more than 2 in a row)
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    // Remove excessive spaces
    normalized = normalized.replace(/[ \t]{2,}/g, ' ');

    // Remove special characters that might cause issues
    normalized = normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return normalized.trim();
  }

  /**
   * Detect language from transcript
   * @param {string} transcript - Transcript text
   * @returns {Promise<string>} Language code (e.g., 'en', 'he', 'ar')
   */
  async detectLanguage(transcript) {
    if (!this.openaiClient) {
      // Fallback: simple heuristic
      return this.detectLanguageHeuristic(transcript);
    }

    try {
      const prompt = `Detect the language of the following text and return only the ISO 639-1 language code (e.g., 'en', 'he', 'ar', 'es', 'fr').

Text:
${transcript.substring(0, 500)}

Return only the 2-letter language code, nothing else.`;

      const response = await this.openaiClient.generateText(prompt, {
        systemPrompt: 'You are a language detection expert. Return only the ISO 639-1 language code.',
        temperature: 0.1,
        max_tokens: 10,
      });

      const languageCode = response.trim().toLowerCase();
      const validCodes = ['en', 'he', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
      
      if (validCodes.includes(languageCode)) {
        return languageCode;
      }

      return this.detectLanguageHeuristic(transcript);
    } catch (error) {
      logger.warn('[ContentGenerationOrchestrator] Language detection failed, using heuristic', {
        error: error.message,
      });
      return this.detectLanguageHeuristic(transcript);
    }
  }

  /**
   * Heuristic language detection
   * @param {string} transcript - Transcript text
   * @returns {string} Language code
   */
  detectLanguageHeuristic(transcript) {
    const hebrewPattern = /[\u0590-\u05FF]/;
    const arabicPattern = /[\u0600-\u06FF]/;

    if (hebrewPattern.test(transcript)) {
      return 'he';
    }
    if (arabicPattern.test(transcript)) {
      return 'ar';
    }
    return 'en'; // Default to English
  }

  /**
   * Extract metadata from transcript (fallback if topic metadata is missing)
   * @param {string} transcript - Normalized transcript
   * @param {Object} options - Options
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(transcript, options = {}) {
    if (!this.openaiClient) {
      return this.extractMetadataFallback(transcript, options);
    }

    try {
      const prompt = `Analyze the following video transcript and extract key educational metadata.

Transcript:
${transcript.substring(0, 2000)}

Extract the following information:
1. Lesson title (clear, concise, 5-10 words)
2. Key concepts (important terms/ideas)
3. Skills list (micro-skills and nano-skills that learners will gain)

Return ONLY valid JSON in this format:
{
  "title": "Lesson Title Here",
  "concepts": ["Concept 1", "Concept 2", ...],
  "skills": ["skill1", "skill2", ...]
}`;

      const response = await this.openaiClient.generateText(prompt, {
        systemPrompt: 'You are an expert educational content analyst. Extract accurate metadata from educational transcripts. Return only valid JSON.',
        temperature: 0.3,
        max_tokens: 500,
      });

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const metadata = JSON.parse(jsonMatch[0]);
        
        return {
          title: metadata.title || options.topic_name || 'Untitled Lesson',
          concepts: metadata.concepts || [],
          skills: metadata.skills || [],
          language: 'en', // Will be detected separately
        };
      }

      return this.extractMetadataFallback(transcript, options);
    } catch (error) {
      logger.warn('[ContentGenerationOrchestrator] Metadata extraction failed, using fallback', {
        error: error.message,
      });
      return this.extractMetadataFallback(transcript, options);
    }
  }

  /**
   * Fallback metadata extraction
   * @param {string} transcript - Transcript text
   * @param {Object} options - Options
   * @returns {Object} Basic metadata
   */
  extractMetadataFallback(transcript, options = {}) {
    // Extract first sentence as title
    const firstSentence = transcript.split(/[.!?]/)[0]?.trim() || 'Untitled Lesson';
    const title = options.topic_name || firstSentence.substring(0, 60);

    // Simple keyword extraction (first few significant words)
    const words = transcript
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 10);

    return {
      title,
      concepts: words.slice(0, 5),
      skills: [],
      language: 'en',
    };
  }
}
