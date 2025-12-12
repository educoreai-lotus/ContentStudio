/**
 * GammaHeyGenAvatarOrchestrator Service
 * Orchestrates the complete flow from Gamma PPTX generation to HeyGen avatar video
 * 
 * Steps:
 * 1. Generate Gamma PPTX with hard maxSlides=10
 * 2. Extract slide images (public URLs)
 * 3. Build slide speeches from AI explanations
 * 4. Combine into SlidePlan[]
 * 5. Resolve voice_id via VoiceIdResolver
 * 6. Build HeyGen payload using template_id
 * 7. Call HeyGen, return video_id
 */

import { randomUUID } from 'crypto';
import { logger } from '../infrastructure/logging/Logger.js';
import { SlideImageExtractor } from './SlideImageExtractor.js';
import { SlideSpeechBuilder } from './SlideSpeechBuilder.js';
import { VoiceIdResolver } from './VoiceIdResolver.js';
import { HeyGenTemplatePayloadBuilder } from './HeyGenTemplatePayloadBuilder.js';
import { SlidePlan } from '../domain/slides/SlidePlan.js';

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
      // Step 1: Generate Gamma PPTX with hard maxSlides=10
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 1: Generating Gamma PPTX', {
        jobId: finalJobId,
        topicId,
        maxSlides: 10,
      });

      let gammaResult;
      try {
        gammaResult = await this.gammaClient.generatePresentation(inputText, {
          topicName: `Topic ${topicId}`,
          language: languageCode,
          maxSlides: 10, // Hard limit
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
      });

      let slideImages;
      try {
        // Download PPTX to buffer for extraction
        const axios = (await import('axios')).default;
        const pptxResponse = await axios.get(pptxUrl, { responseType: 'arraybuffer' });
        const pptxBuffer = Buffer.from(pptxResponse.data);

        slideImages = await this.slideImageExtractor.extractSlideImages(
          pptxBuffer,
          finalJobId,
          10 // max 10 slides
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

      logger.info('[GammaHeyGenAvatarOrchestrator] Step 2 completed', {
        jobId: finalJobId,
        slideCount: slideImages.length,
      });

      // Step 3: Build slide speeches from AI explanations
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 3: Building slide speeches', {
        jobId: finalJobId,
        explanationCount: aiSlideExplanations?.length || 0,
      });

      let slideSpeeches;
      try {
        slideSpeeches = this.slideSpeechBuilder.buildSpeakerText(aiSlideExplanations || []);
        jobState.steps.speechBuilding = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          speechCount: slideSpeeches.length,
        };
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
        const maxSlides = Math.min(slideImages.length, slideSpeeches.length, 10);

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

      // Step 7: Call HeyGen, return video_id
      logger.info('[GammaHeyGenAvatarOrchestrator] Step 7: Calling HeyGen template API', {
        jobId: finalJobId,
        templateId: this.templateId,
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
}

