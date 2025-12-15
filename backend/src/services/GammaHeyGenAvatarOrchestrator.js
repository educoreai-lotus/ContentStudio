/**
 * GammaHeyGenAvatarOrchestrator Service
 * Orchestrates the complete flow from Gamma PPTX generation to HeyGen avatar video
 * 
 * Steps:
 * 1. Generate Gamma PPTX with hard maxSlides=AVATAR_VIDEO_MAX_SLIDES (9)
 * 2. Extract slide images (public URLs) - validate count matches AVATAR_VIDEO_MAX_SLIDES
 * 3. Extract slide text from PPTX and generate short narrations with OpenAI (15-20 seconds, max 40 words per slide)
 *    - If OpenAI client is available: generates short narrations using strict prompt
 *    - Falls back to aiSlideExplanations if OpenAI is not available or extraction fails
 * 4. Combine into SlidePlan[]
 * 5. Resolve voice_id via VoiceIdResolver
 * 6. Build HeyGen payload using template_id
 * 7. Call HeyGen, return video_id
 * 
 * Video duration: Maximum 2:40 minutes (9 slides × ~15-20 seconds = ~2.25-3 minutes)
 * Hard constraints enforced: MAX_SLIDES=9, MAX_TOTAL_SECONDS=160
 */

import { randomUUID } from 'crypto';
import { logger } from '../infrastructure/logging/Logger.js';
import { SlideImageExtractor } from './SlideImageExtractor.js';
import { SlideSpeechBuilder } from './SlideSpeechBuilder.js';
import { VoiceIdResolver } from './VoiceIdResolver.js';
import { HeyGenTemplatePayloadBuilder } from './HeyGenTemplatePayloadBuilder.js';
import { SlidePlan } from '../domain/slides/SlidePlan.js';
import { PptxExtractorPro } from './PptxExtractorPro.js';
import { AVATAR_VIDEO_MAX_SLIDES, MAX_WORDS_PER_SCENE } from '../config/heygen.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

/**
 * Domain Error for orchestrator steps
 */
export class OrchestratorStepError extends Error {
  constructor(step, message, originalError = null) {
    super(`[Step ${step}] ${message}`);
    this.name = 'OrchestratorStepError';
    this.step = step;
    this.originalError = originalError;
    this.jobId = null; // Will be set by orchestrator
  }
}

/**
 * GammaHeyGenAvatarOrchestrator Class
 * Orchestrates Gamma PPTX → HeyGen Avatar Video pipeline
 */
export class GammaHeyGenAvatarOrchestrator {
  /**
   * @param {Object} dependencies - Service dependencies
   * @param {Object} dependencies.gammaClient - GammaClient instance
   * @param {Object} dependencies.storageClient - SupabaseStorageClient instance
   * @param {Object} dependencies.heygenClient - HeygenClient instance
   * @param {Object} [dependencies.openaiClient] - OpenAIClient instance (required for generating short narrations)
   * @param {string} [dependencies.templateId] - HeyGen template ID (default: '2c01158bec1149c49d35effb4bd79791')
   * @param {Object} [dependencies.slideImageExtractor] - SlideImageExtractor instance (optional, will be created)
   * @param {Object} [dependencies.slideSpeechBuilder] - SlideSpeechBuilder instance (optional, will be created)
   * @param {Object} [dependencies.voiceIdResolver] - VoiceIdResolver instance (optional, will be created)
   * @param {Object} [dependencies.templatePayloadBuilder] - HeyGenTemplatePayloadBuilder instance (optional, will be created)
   */
  constructor({
    gammaClient,
    storageClient,
    heygenClient,
    openaiClient = null,
    templateId = '2c01158bec1149c49d35effb4bd79791',
    slideImageExtractor = null,
    slideSpeechBuilder = null,
    voiceIdResolver = null,
    templatePayloadBuilder = null,
  }) {
    if (!gammaClient) {
      throw new Error('gammaClient is required');
    }
    if (!storageClient) {
      throw new Error('storageClient is required');
    }
    if (!heygenClient) {
      throw new Error('heygenClient is required');
    }

    this.gammaClient = gammaClient;
    this.storageClient = storageClient;
    this.heygenClient = heygenClient;
    this.openaiClient = openaiClient;
    this.templateId = templateId;

    // Initialize services (or use provided instances)
    this.slideImageExtractor = slideImageExtractor || new SlideImageExtractor(storageClient);
    this.slideSpeechBuilder = slideSpeechBuilder || new SlideSpeechBuilder(10);
    this.voiceIdResolver = voiceIdResolver || new VoiceIdResolver();
    this.templatePayloadBuilder = templatePayloadBuilder || new HeyGenTemplatePayloadBuilder();
  }

  /**
   * Execute the complete orchestrator pipeline
   * @param {Object} params - Pipeline parameters
   * @param {string} params.trainerId - Trainer ID
   * @param {number} params.topicId - Topic ID
   * @param {string} params.languageCode - Language code (e.g., "he", "en", "ar")
   * @param {string} params.mode - Mode (must be "avatar" to proceed)
   * @param {string} params.inputText - Input text for Gamma generation
   * @param {Array<string|Object>} params.aiSlideExplanations - AI-generated slide explanations
   * @param {string} [params.jobId] - Optional job ID (will be generated if not provided)
   * @returns {Promise<Object>} Result with video_id and job state
   * @throws {OrchestratorStepError} If any step fails
   */
  async execute({
    trainerId,
    topicId,
    languageCode,
    mode,
    inputText,
    aiSlideExplanations,
    jobId = null,
  }) {
    // Validate mode
    if (mode !== 'avatar') {
      throw new OrchestratorStepError(
        'validation',
        `Mode must be "avatar" to proceed. Received: ${mode}`
      );
    }

    // Generate job ID if not provided
    const finalJobId = jobId || randomUUID();
    const jobState = {
      jobId: finalJobId,
      trainerId,
      topicId,
      languageCode,
      mode,
      steps: {},
      startedAt: new Date().toISOString(),
    };

    logger.info('[GammaHeyGenAvatarOrchestrator] Starting pipeline execution', {
      jobId: finalJobId,
      trainerId,
      topicId,
      languageCode,
      mode,
    });

    try {
      // Step 1: Generate Gamma PPTX with hard maxSlides from single source of truth
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 1: Generating Gamma PPTX', {
        jobId: finalJobId,
        topicId,
        maxSlides: AVATAR_VIDEO_MAX_SLIDES,
      });

      let gammaResult;
      try {
        // Use PDF export for avatar videos (easier to convert to images without LibreOffice)
        // PDF can be converted directly to PNG using pdftoppm (poppler-utils)
        gammaResult = await this.gammaClient.generatePresentation(inputText, {
          topicName: `Topic ${topicId}`,
          language: languageCode,
          maxSlides: AVATAR_VIDEO_MAX_SLIDES, // Hard limit from single source of truth
          exportFormat: 'pdf', // Use PDF for easier image extraction (no LibreOffice needed)
        });
        jobState.steps.gammaGeneration = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          presentationUrl: gammaResult.fileUrl || gammaResult.presentationUrl || gammaResult.url,
        };
      } catch (error) {
        const stepError = new OrchestratorStepError('gamma_generation', error.message, error);
        stepError.jobId = finalJobId;
        jobState.steps.gammaGeneration = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error.message,
        };
        throw stepError;
      }

      if (!gammaResult || (!gammaResult.fileUrl && !gammaResult.presentationUrl && !gammaResult.url)) {
        const stepError = new OrchestratorStepError(
          'gamma_generation',
          'Gamma generation did not return a file URL'
        );
        stepError.jobId = finalJobId;
        throw stepError;
      }

      const pptxUrl = gammaResult.fileUrl || gammaResult.presentationUrl || gammaResult.url;
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 1 completed', {
        jobId: finalJobId,
        presentationUrl: pptxUrl,
      });

      // Step 2: Extract slide images (public URLs)
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 2: Extracting slide images', {
        jobId: finalJobId,
        pptxUrl,
        exportFormat: gammaResult.exportFormat || 'pdf', // Gamma exports PDF for avatar videos
      });

      let slideImages;
      let pptxBuffer; // Store buffer for later use in Step 3 (can be PDF or PPTX)
      try {
        // Download file to buffer for extraction (PDF or PPTX)
        const axios = (await import('axios')).default;
        const fileResponse = await axios.get(pptxUrl, { responseType: 'arraybuffer' });
        pptxBuffer = Buffer.from(fileResponse.data);

        slideImages = await this.slideImageExtractor.extractSlideImages(
          pptxBuffer,
          finalJobId,
          AVATAR_VIDEO_MAX_SLIDES, // Hard limit from single source of truth
          true, // requireFullRendering: Avatar videos MUST use fully rendered slide images (background + text + layout)
          'pdf' // inputFormat: Gamma exports PDF for avatar videos (easier to convert without LibreOffice)
        );

        jobState.steps.imageExtraction = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          slideCount: slideImages.length,
          imageUrls: slideImages.map(img => img.imageUrl),
        };
      } catch (error) {
        const stepError = new OrchestratorStepError('image_extraction', error.message, error);
        stepError.jobId = finalJobId;
        jobState.steps.imageExtraction = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error.message,
        };
        throw stepError;
      }

      // CRITICAL VALIDATION: Fail fast if Gamma violated slide count contract
      // Gamma was instructed to generate exactly AVATAR_VIDEO_MAX_SLIDES slides.
      // If the extracted slide count doesn't match, Gamma violated the contract.
      if (slideImages.length !== AVATAR_VIDEO_MAX_SLIDES) {
        const errorMsg = `Gamma slide count violation: expected exactly ${AVATAR_VIDEO_MAX_SLIDES} slides, got ${slideImages.length}. Gamma may have added extra slides (title-only, conclusion, etc.) despite explicit instructions.`;
        const stepError = new OrchestratorStepError('gamma_slide_count_violation', errorMsg);
        stepError.jobId = finalJobId;
        jobState.steps.gammaGeneration = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: errorMsg,
          expectedSlides: AVATAR_VIDEO_MAX_SLIDES,
          actualSlides: slideImages.length,
        };
        throw stepError;
      }

      logger.info('[GammaHeyGenAvatarOrchestrator] Step 2 completed', {
        jobId: finalJobId,
        slideCount: slideImages.length,
        validated: slideImages.length === AVATAR_VIDEO_MAX_SLIDES,
      });

      // Step 3: Extract slide text from PPTX and generate short narrations with OpenAI
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 3: Extracting slides and generating short narrations', {
        jobId: finalJobId,
        hasOpenAIClient: !!this.openaiClient,
        hasAiExplanations: !!aiSlideExplanations && aiSlideExplanations.length > 0,
      });

      let slideSpeeches;
      try {
        // If OpenAI client is available, generate short narrations (15-20 seconds, max 50 words per slide)
        if (this.openaiClient && pptxBuffer) {
          // Extract slides from PPTX
          const tempPptxPath = join(tmpdir(), `pptx-${finalJobId}.pptx`);
          try {
            writeFileSync(tempPptxPath, pptxBuffer);
            const slides = await PptxExtractorPro.extractSlides(tempPptxPath);
            unlinkSync(tempPptxPath); // Clean up temp file

            // Generate short narrations for each slide
            const narrations = [];
            for (const slide of slides.slice(0, AVATAR_VIDEO_MAX_SLIDES)) { // Hard limit from single source of truth
              try {
                const narration = await this.generateShortNarration(slide, languageCode);
                narrations.push({
                  index: slide.index,
                  speakerText: narration,
                });
              } catch (error) {
                logger.warn('[GammaHeyGenAvatarOrchestrator] Failed to generate narration for slide', {
                  jobId: finalJobId,
                  slideIndex: slide.index,
                  error: error.message,
                });
                // Fallback to slide text (truncated to 50 words)
                const fallbackText = (slide.text || slide.body || slide.title || '').split(/\s+/).slice(0, 50).join(' ');
                narrations.push({
                  index: slide.index,
                  speakerText: fallbackText,
                });
              }
            }

            slideSpeeches = narrations;
            jobState.steps.speechBuilding = {
              status: 'completed',
              completedAt: new Date().toISOString(),
              speechCount: slideSpeeches.length,
              method: 'openai_generated',
            };
          } catch (extractionError) {
            logger.warn('[GammaHeyGenAvatarOrchestrator] Failed to extract slides from PPTX, falling back to aiSlideExplanations', {
              jobId: finalJobId,
              error: extractionError.message,
            });
            // Fallback to using aiSlideExplanations
            slideSpeeches = this.slideSpeechBuilder.buildSpeakerText(aiSlideExplanations || []);
            jobState.steps.speechBuilding = {
              status: 'completed',
              completedAt: new Date().toISOString(),
              speechCount: slideSpeeches.length,
              method: 'fallback_ai_explanations',
            };
          }
        } else {
          // No OpenAI client or no PPTX buffer, use provided aiSlideExplanations
          slideSpeeches = this.slideSpeechBuilder.buildSpeakerText(aiSlideExplanations || []);
          jobState.steps.speechBuilding = {
            status: 'completed',
            completedAt: new Date().toISOString(),
            speechCount: slideSpeeches.length,
            method: 'ai_explanations',
          };
        }
      } catch (error) {
        const stepError = new OrchestratorStepError('speech_building', error.message, error);
        stepError.jobId = finalJobId;
        jobState.steps.speechBuilding = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error.message,
        };
        throw stepError;
      }

      logger.info('[GammaHeyGenAvatarOrchestrator] Step 3 completed', {
        jobId: finalJobId,
        speechCount: slideSpeeches.length,
      });

      // CRITICAL VALIDATION: Each slide speech must fit within 30 seconds (75 words at 150 WPM)
      // HeyGen template scenes are configured to 30 seconds duration.
      // Speech text that exceeds this limit will cause timing issues in the generated video.
      const wordCount = (text) => text.trim().split(/\s+/).filter(w => w.length > 0).length;
      for (const speech of slideSpeeches) {
        const words = wordCount(speech.speakerText);
        if (words > MAX_WORDS_PER_SCENE) {
          const errorMsg = `Slide speech exceeds 30s limit (max ${MAX_WORDS_PER_SCENE} words). Slide index: ${speech.index}, words: ${words}`;
          logger.error('[GammaHeyGenAvatarOrchestrator] Slide speech duration limit exceeded', {
            jobId: finalJobId,
            slideIndex: speech.index,
            wordCount: words,
            maxAllowedWords: MAX_WORDS_PER_SCENE,
            speechPreview: speech.speakerText.substring(0, 100),
          });
          throw new Error(errorMsg);
        }
        logger.info('[SlideDurationGuard]', {
          slideIndex: speech.index,
          wordCount: words,
          maxAllowedWords: MAX_WORDS_PER_SCENE,
        });
      }

      // Step 4: Combine into SlidePlan[]
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 4: Creating SlidePlan', {
        jobId: finalJobId,
        imageCount: slideImages.length,
        speechCount: slideSpeeches.length,
      });

      let slidePlan;
      try {
        // Match images with speeches by index
        const slides = [];
        const maxSlides = Math.min(slideImages.length, slideSpeeches.length, AVATAR_VIDEO_MAX_SLIDES);

        for (let i = 0; i < maxSlides; i++) {
          const image = slideImages.find(img => img.index === i + 1);
          const speech = slideSpeeches.find(sp => sp.index === i + 1);

          if (!image || !speech) {
            logger.warn('[GammaHeyGenAvatarOrchestrator] Mismatch between images and speeches', {
              jobId: finalJobId,
              slideIndex: i + 1,
              hasImage: !!image,
              hasSpeech: !!speech,
            });
            continue; // Skip this slide
          }

          slides.push({
            index: i + 1,
            imageUrl: image.imageUrl,
            speakerText: speech.speakerText,
          });
        }

        if (slides.length === 0) {
          throw new Error('No valid slides could be created from images and speeches');
        }

        slidePlan = new SlidePlan(slides);
        jobState.steps.slidePlanCreation = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          slideCount: slidePlan.slideCount,
        };
      } catch (error) {
        const stepError = new OrchestratorStepError('slide_plan_creation', error.message, error);
        stepError.jobId = finalJobId;
        jobState.steps.slidePlanCreation = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error.message,
        };
        throw stepError;
      }

      logger.info('[GammaHeyGenAvatarOrchestrator] Step 4 completed', {
        jobId: finalJobId,
        slideCount: slidePlan.slideCount,
      });

      // Step 5: Resolve voice_id via VoiceIdResolver
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 5: Resolving voice ID', {
        jobId: finalJobId,
        languageCode,
      });

      let voiceId;
      try {
        voiceId = this.voiceIdResolver.resolve(languageCode);
        jobState.steps.voiceResolution = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          voiceId,
          languageCode,
        };
      } catch (error) {
        const stepError = new OrchestratorStepError('voice_resolution', error.message, error);
        stepError.jobId = finalJobId;
        jobState.steps.voiceResolution = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error.message,
        };
        throw stepError;
      }

      logger.info('[GammaHeyGenAvatarOrchestrator] Step 5 completed', {
        jobId: finalJobId,
        voiceId,
      });

      // Step 6: Build HeyGen payload using template_id
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 6: Building HeyGen template payload', {
        jobId: finalJobId,
        templateId: this.templateId,
        slideCount: slidePlan.slideCount,
      });

      let heygenPayload;
      try {
        const slides = slidePlan.getAllSlides();
        heygenPayload = this.templatePayloadBuilder.buildPayload({
          templateId: this.templateId,
          slides,
          title: `EduCore Presentation - Topic ${topicId}`,
          caption: true,
          voiceId,
        });
        jobState.steps.payloadBuilding = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          variableCount: Object.keys(heygenPayload.variables || {}).length,
        };
      } catch (error) {
        const stepError = new OrchestratorStepError('payload_building', error.message, error);
        stepError.jobId = finalJobId;
        jobState.steps.payloadBuilding = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error.message,
        };
        throw stepError;
      }

      logger.info('[GammaHeyGenAvatarOrchestrator] Step 6 completed', {
        jobId: finalJobId,
        variableCount: Object.keys(heygenPayload.variables || {}).length,
      });

      // FINAL HEYGEN GUARD (non-negotiable): Assert slide count consistency before HeyGen call
      // This is the last line of defense against index mismatches that cause silent HeyGen failures.
      if (slideImages.length !== slideSpeeches.length) {
        const errorMsg = `Slide count mismatch before HeyGen call: ${slideImages.length} images but ${slideSpeeches.length} speeches. This will cause HeyGen API to fail silently.`;
        const stepError = new OrchestratorStepError('pre_heygen_validation', errorMsg);
        stepError.jobId = finalJobId;
        throw stepError;
      }
      
      if (slideImages.length !== AVATAR_VIDEO_MAX_SLIDES) {
        const errorMsg = `Slide count mismatch before HeyGen call: expected exactly ${AVATAR_VIDEO_MAX_SLIDES} slides, got ${slideImages.length}. This violates the hard constraint.`;
        const stepError = new OrchestratorStepError('pre_heygen_validation', errorMsg);
        stepError.jobId = finalJobId;
        throw stepError;
      }

      // Step 7: Call HeyGen, return video_id
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 7: Calling HeyGen template API', {
        jobId: finalJobId,
        templateId: this.templateId,
        validatedSlideCount: slideImages.length,
      });

      let heygenResult;
      try {
        heygenResult = await this.heygenClient.generateTemplateVideo(
          this.templateId,
          heygenPayload
        );
        jobState.steps.heygenGeneration = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          videoId: heygenResult.video_id,
        };
      } catch (error) {
        const stepError = new OrchestratorStepError('heygen_generation', error.message, error);
        stepError.jobId = finalJobId;
        jobState.steps.heygenGeneration = {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error.message,
        };
        throw stepError;
      }

      jobState.completedAt = new Date().toISOString();
      jobState.status = 'completed';
      jobState.videoId = heygenResult.video_id;

      logger.info('[GammaHeyGenAvatarOrchestrator] Pipeline execution completed successfully', {
        jobId: finalJobId,
        videoId: heygenResult.video_id,
        totalSteps: Object.keys(jobState.steps).length,
      });

      return {
        success: true,
        video_id: heygenResult.video_id,
        jobId: finalJobId,
        jobState,
      };

    } catch (error) {
      // If it's already an OrchestratorStepError, re-throw it
      if (error instanceof OrchestratorStepError) {
        jobState.status = 'failed';
        jobState.failedAt = new Date().toISOString();
        jobState.failedStep = error.step;
        throw error;
      }

      // Wrap unexpected errors
      const stepError = new OrchestratorStepError('unknown', error.message, error);
      stepError.jobId = finalJobId;
      jobState.status = 'failed';
      jobState.failedAt = new Date().toISOString();
      jobState.failedStep = 'unknown';
      throw stepError;
    }
  }

  /**
   * Generate a short narration (15-20 seconds, max 50 words) for a single slide using OpenAI
   * @param {Object} slide - Slide object with {index, title, body, text}
   * @param {string} languageCode - Language code (e.g., "he", "en", "ar")
   * @returns {Promise<string>} Short narration text (max 50 words)
   */
  async generateShortNarration(slide, languageCode) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    // Get language name for prompt
    const languageMap = {
      'he': 'Hebrew',
      'en': 'English',
      'ar': 'Arabic',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
    };
    const languageName = languageMap[languageCode] || languageCode;

    // Build prompt with strict constraints
    const prompt = `You are an expert teacher explaining a single presentation slide to students.

Slide information:

Title: ${slide.title || 'Untitled'}

Content: ${slide.body || slide.text || 'No content'}

IMPORTANT CONSTRAINTS:

- This narration MUST be suitable for ~15–20 seconds of speech.

- Do NOT exceed 50 words.

- Be clear, simple, and focused on the main idea only.

Instructions:

- Explain the slide as if speaking to students.

- No long introductions.

- No repetition.

- No extra examples unless strictly necessary.

Output:

- A short spoken narration.

- Language: ${languageName}

Generate the narration now.`;

    try {
      const narration = await this.openaiClient.generateText(prompt, {
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 100, // Limit tokens to ensure short output
      });

      // Ensure narration doesn't exceed 50 words
      const words = narration.trim().split(/\s+/);
      if (words.length > 50) {
        logger.warn('[GammaHeyGenAvatarOrchestrator] Narration exceeded 50 words, truncating', {
          originalLength: words.length,
          slideIndex: slide.index,
        });
        return words.slice(0, 50).join(' ');
      }

      return narration.trim();
    } catch (error) {
      logger.error('[GammaHeyGenAvatarOrchestrator] Failed to generate narration with OpenAI', {
        slideIndex: slide.index,
        error: error.message,
      });
      throw error;
    }
  }
}

