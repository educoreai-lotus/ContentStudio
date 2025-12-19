import { logger } from '../../infrastructure/logging/Logger.js';
import { SlideImageExtractor } from '../../services/SlideImageExtractor.js';
import { SlideSpeechBuilder } from '../../services/SlideSpeechBuilder.js';
import { VoiceIdResolver } from '../../services/VoiceIdResolver.js';
import { HeyGenTemplatePayloadBuilder } from '../../services/HeyGenTemplatePayloadBuilder.js';
import { SlidePlan } from '../../domain/slides/SlidePlan.js';
import { PptxExtractorPro } from '../../services/PptxExtractorPro.js';
import { FileTextExtractor } from '../../services/FileTextExtractor.js';
import { AVATAR_VIDEO_MAX_SLIDES, AVATAR_VIDEO_MAX_TOTAL_SECONDS, AVATAR_VIDEO_AVERAGE_WPM, MAX_WORDS_PER_SCENE } from '../../config/heygen.js';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

// HARD RUNTIME CONSTRAINTS for avatar video generation (using single source of truth from config)
// These are enforced in code, not relying on prompts or AI compliance
const MAX_SLIDES = AVATAR_VIDEO_MAX_SLIDES; // Single source of truth: 9 slides maximum
const MAX_TOTAL_SECONDS = AVATAR_VIDEO_MAX_TOTAL_SECONDS; // Single source of truth: 160 seconds (2:40 minutes)
const AVERAGE_WPM = AVATAR_VIDEO_AVERAGE_WPM; // Single source of truth: 150 words per minute

/**
 * Generate Avatar Video from Presentation Use Case
 * 
 * REFACTORED WORKFLOW - Using /v2/video/generate (not template):
 * 1. Fetch presentation content from repository
 * 2. Download PPTX file
 * 3. Extract slide images per slide (using SlideImageExtractor)
 * 4. Extract slide text and generate short narrations per slide (15-20 sec, max 40 words)
 * 5. Combine all slide speeches into one text
 * 6. Generate 30-second script using OpenAI
 * 7. Call HeyGen /v2/video/generate API with Adriana_Business_Front_public avatar
 * 
 * Video duration: Exactly 30 seconds
 */
export class GenerateAvatarVideoFromPresentationUseCase {
  constructor({
    heygenClient,
    openaiClient,
    storageClient,
    contentRepository,
    qualityCheckService,
    topicRepository,
    courseRepository,
    language = 'en',
    templateId = '01a1ee50978a4517a86a3e0858a32d6a', // Template v4 for avatar videos
    slideImageExtractor = null,
    slideSpeechBuilder = null,
    voiceIdResolver = null,
    templatePayloadBuilder = null,
  }) {
    if (!heygenClient) {
      throw new Error('heygenClient is required');
    }
    if (!storageClient) {
      throw new Error('storageClient is required');
    }
    if (!openaiClient) {
      throw new Error('openaiClient is required');
    }

    this.heygenClient = heygenClient;
    this.openaiClient = openaiClient;
    this.storageClient = storageClient;
    this.contentRepository = contentRepository;
    this.qualityCheckService = qualityCheckService;
    this.topicRepository = topicRepository;
    this.courseRepository = courseRepository;
    this.language = language;
    this.templateId = templateId;

    // Initialize services (same pattern as GammaHeyGenAvatarOrchestrator)
    this.slideImageExtractor = slideImageExtractor || new SlideImageExtractor(storageClient);
    this.slideSpeechBuilder = slideSpeechBuilder || new SlideSpeechBuilder(10);
    this.voiceIdResolver = voiceIdResolver || new VoiceIdResolver();
    this.templatePayloadBuilder = templatePayloadBuilder || new HeyGenTemplatePayloadBuilder();
  }

  /**
   * Execute the workflow
   * @param {Object} params - Request parameters
   * @param {number} params.presentation_content_id - Content ID of the presentation
   * @param {string} params.custom_prompt - Optional custom prompt from trainer (NOT USED in new workflow)
   * @param {string} params.avatar_id - Optional custom avatar ID (NOT USED in template workflow)
   * @param {string} params.language - Language code (default: 'en')
   * @returns {Promise<Object>} Video generation result
   */
  async execute(params) {
    const {
      presentation_content_id,
      custom_prompt = null, // Not used in new workflow, kept for API compatibility
      avatar_id = null, // Not used in template workflow, kept for API compatibility
      language = this.language || 'en',
    } = params;

    const jobId = randomUUID();

    try {
      // Step 1: Get presentation content
      logger.info('[GenerateAvatarVideoFromPresentation] Step 1: Fetching presentation content', {
        jobId,
        presentation_content_id,
      });

      const presentationContent = await this.contentRepository.findById(presentation_content_id);
      
      if (!presentationContent) {
        throw new Error(`Presentation content not found: ${presentation_content_id}`);
      }

      if (presentationContent.content_type_id !== 3) {
        throw new Error(`Content is not a presentation (type: ${presentationContent.content_type_id})`);
      }

      // Get presentation file URL
      const presentationFileUrl = presentationContent.content_data?.fileUrl || 
                                  presentationContent.content_data?.presentationUrl ||
                                  presentationContent.content_data?.url;

      if (!presentationFileUrl) {
        throw new Error('Presentation file URL not found in content data');
      }

      logger.info('[GenerateAvatarVideoFromPresentation] Step 2: Downloading PPTX file', {
        jobId,
        presentationFileUrl,
      });

      // Step 2: Download presentation file (PPTX or PDF)
      let fileBuffer;
      let inputFormat = 'pptx'; // Default to PPTX
      try {
        const fileResponse = await axios.get(presentationFileUrl, { responseType: 'arraybuffer' });
        fileBuffer = Buffer.from(fileResponse.data);
        
        // Detect file format from URL extension or content-type
        if (presentationFileUrl.toLowerCase().endsWith('.pdf') || 
            (fileBuffer.length > 4 && fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && 
             fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46)) { // PDF magic bytes: %PDF
          inputFormat = 'pdf';
        }
        
        logger.info('[GenerateAvatarVideoFromPresentation] File downloaded successfully', {
          jobId,
          bufferSize: fileBuffer.length,
          inputFormat,
        });
      } catch (error) {
        logger.error('[GenerateAvatarVideoFromPresentation] Failed to download presentation file', {
          jobId,
          error: error.message,
        });
        throw new Error(`Failed to download presentation file: ${error.message}`);
      }

      // Step 3: Extract slide images per slide
      // NOTE: Slide images are TEMPORARY assets used only for HeyGen video generation.
      // They are uploaded to storage for HeyGen API access but are NOT persisted as course content.
      // Images are not retained after the HeyGen video generation call completes.
      logger.info('[GenerateAvatarVideoFromPresentation] Step 3: Extracting slide images', {
        jobId,
        inputFormat,
      });

      let slideImages;
      try {
        slideImages = await this.slideImageExtractor.extractSlideImages(
          fileBuffer,
          jobId,
          MAX_SLIDES, // Hard limit: maximum 9 slides
          true, // requireFullRendering: Avatar videos MUST use fully rendered slide images (background + text + layout)
          inputFormat // Pass detected format (pdf or pptx)
        );
        logger.info('[GenerateAvatarVideoFromPresentation] Slide images extracted successfully', {
          jobId,
          slideCount: slideImages.length,
        });
      } catch (error) {
        logger.error('[GenerateAvatarVideoFromPresentation] Failed to extract slide images', {
          jobId,
          error: error.message,
        });
        throw new Error(`Failed to extract slide images: ${error.message}`);
      }

      // HARD CONSTRAINT: Global slide count limit
      // Enforce maximum 9 slides (not 10) as a hard runtime constraint.
      // This applies to the ENTIRE presentation, not per-section.
      if (slideImages.length > MAX_SLIDES) {
        const errorMsg = `Presentation exceeds maximum allowed slides (${MAX_SLIDES}). Found: ${slideImages.length} slides.`;
        logger.error('[GenerateAvatarVideoFromPresentation] Global slide count limit exceeded', {
          jobId,
          slideCount: slideImages.length,
          maxAllowed: MAX_SLIDES,
        });
        throw new Error(errorMsg);
      }

      // Step 4: Extract slides from PPTX/PDF and generate short narrations per slide
      logger.info('[GenerateAvatarVideoFromPresentation] Step 4: Extracting slides and generating short narrations', {
        jobId,
        language,
        inputFormat,
      });

      let slideSpeeches;
      try {
        // Extract slides from PPTX or PDF
        let slides = [];
        const tempFilePath = join(tmpdir(), `${inputFormat}-${jobId}.${inputFormat}`);
        
        try {
          writeFileSync(tempFilePath, fileBuffer);
          
          if (inputFormat === 'pdf') {
            // Extract text from PDF and split into slides
            // Use the number of extracted images to determine how many slides we have
            const expectedSlideCount = slideImages.length;
            logger.info('[GenerateAvatarVideoFromPresentation] Extracting text from PDF', {
              jobId,
              expectedSlideCount,
            });
            
            const text = await FileTextExtractor.extractTextFromFile(tempFilePath, '.pdf', {
              openaiClient: this.openaiClient,
            });
            
            if (!text || text.trim().length === 0) {
              throw new Error('Failed to extract text from PDF. PDF may be image-only or corrupted.');
            }
            
            // Split text into slides based on expected slide count
            // First try to split by common separators (three or more newlines)
            let slideTexts = text.split(/\n\s*\n\s*\n+/).filter(t => t.trim().length > 0);
            
            // If we got fewer slides than expected, try splitting by double newlines
            if (slideTexts.length < expectedSlideCount) {
              const fallbackSlides = text.split(/\n\s*\n+/).filter(t => t.trim().length > 0);
              if (fallbackSlides.length >= expectedSlideCount) {
                slideTexts = fallbackSlides;
              }
            }
            
            // If we still don't have enough slides, divide text evenly
            if (slideTexts.length < expectedSlideCount) {
              logger.info('[GenerateAvatarVideoFromPresentation] Dividing PDF text evenly across slides', {
                jobId,
                currentSlides: slideTexts.length,
                expectedSlides: expectedSlideCount,
              });
              
              const words = text.trim().split(/\s+/);
              const wordsPerSlide = Math.ceil(words.length / expectedSlideCount);
              
              slideTexts = [];
              for (let i = 0; i < expectedSlideCount; i++) {
                const startIdx = i * wordsPerSlide;
                const endIdx = Math.min(startIdx + wordsPerSlide, words.length);
                const slideWords = words.slice(startIdx, endIdx);
                slideTexts.push(slideWords.join(' '));
              }
            }
            
            // Limit to expected slide count and MAX_SLIDES
            const maxSlides = Math.min(expectedSlideCount, MAX_SLIDES);
            slideTexts = slideTexts.slice(0, maxSlides);
            
            // Convert to slide structure compatible with PptxExtractorPro output
            slides = slideTexts.map((text, index) => {
              const lines = text.split('\n').filter(l => l.trim().length > 0);
              const title = lines[0] || `Slide ${index + 1}`;
              const body = lines.slice(1).join(' ') || text;
              return {
                index: index + 1,
                title,
                body,
                text,
              };
            });
            
            logger.info('[GenerateAvatarVideoFromPresentation] Extracted slides from PDF', {
              jobId,
              slideCount: slides.length,
              expectedSlideCount,
              match: slides.length === expectedSlideCount,
            });
          } else {
            // Extract slides from PPTX
            slides = await PptxExtractorPro.extractSlides(tempFilePath);
          }
          
          unlinkSync(tempFilePath); // Clean up temp file

          // Generate short narrations for each slide (max 40 words, 15-20 seconds)
          const narrations = [];
          for (const slide of slides.slice(0, MAX_SLIDES)) { // Hard limit: maximum 9 slides
            try {
              const narration = await this.generateShortNarration(slide, language);
              narrations.push({
                index: slide.index,
                speakerText: narration,
              });
            } catch (error) {
              logger.warn('[GenerateAvatarVideoFromPresentation] Failed to generate narration for slide', {
                jobId,
                slideIndex: slide.index,
                error: error.message,
              });
              // Fallback to slide text (truncated to 40 words)
              const fallbackText = (slide.text || slide.body || slide.title || '').split(/\s+/).slice(0, 40).join(' ');
              narrations.push({
                index: slide.index,
                speakerText: fallbackText || 'No content available',
              });
            }
          }

          slideSpeeches = narrations;
          logger.info('[GenerateAvatarVideoFromPresentation] Short narrations generated successfully', {
            jobId,
            narrationCount: slideSpeeches.length,
          });
        } catch (extractionError) {
          // Clean up temp file if it still exists
          try {
            unlinkSync(tempFilePath);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          
          logger.error('[GenerateAvatarVideoFromPresentation] Failed to extract slides', {
            jobId,
            inputFormat,
            error: extractionError.message,
          });
          throw new Error(`Failed to extract slides from ${inputFormat.toUpperCase()}: ${extractionError.message}`);
        }
      } catch (error) {
        logger.error('[GenerateAvatarVideoFromPresentation] Failed to generate slide speeches', {
          jobId,
          error: error.message,
        });
        throw new Error(`Failed to generate slide speeches: ${error.message}`);
      }

      // CRITICAL VALIDATION: Slide count synchronization guard
      // Ensure image and speech arrays have matching counts before creating SlidePlan.
      // Mismatch indicates extraction failure and would cause payload errors.
      if (slideImages.length !== slideSpeeches.length) {
        const errorMsg = `Slide count mismatch: ${slideImages.length} images but ${slideSpeeches.length} speeches. Cannot create valid SlidePlan.`;
        logger.error('[GenerateAvatarVideoFromPresentation] Slide count synchronization failed', {
          jobId,
          imageCount: slideImages.length,
          speechCount: slideSpeeches.length,
        });
        throw new Error(errorMsg);
      }

      // PER-SLIDE SAFETY LIMIT (safety guard, not the duration rule)
      // Each slide speech must be <= 40 words as a safety limit to prevent individual slides from being too long.
      // NOTE: This is NOT the global duration constraint - that is enforced separately below.
      // This per-slide limit helps ensure reasonable pacing but the GLOBAL duration limit is what matters.
      const wordCount = (text) => text.trim().split(/\s+/).filter(w => w.length > 0).length;
      for (const speech of slideSpeeches) {
        const words = wordCount(speech.speakerText);
        if (words > 40) {
          const errorMsg = `Speech for slide ${speech.index} exceeds 40-word per-slide safety limit: ${words} words. Maximum allowed per slide: 40 words.`;
          logger.error('[GenerateAvatarVideoFromPresentation] Per-slide word count safety limit exceeded', {
            jobId,
            slideIndex: speech.index,
            wordCount: words,
            maxAllowed: 40,
            speechPreview: speech.speakerText.substring(0, 100),
          });
          throw new Error(errorMsg);
        }
      }
      logger.info('[GenerateAvatarVideoFromPresentation] Per-slide safety guard passed: all speeches <= 40 words', {
        jobId,
        slideCount: slideSpeeches.length,
      });

      // CRITICAL VALIDATION: Each slide speech must fit within 30 seconds (75 words at 150 WPM)
      // HeyGen template scenes are configured to 30 seconds duration.
      // Speech text that exceeds this limit will cause timing issues in the generated video.
      for (const speech of slideSpeeches) {
        const words = wordCount(speech.speakerText);
        if (words > MAX_WORDS_PER_SCENE) {
          const errorMsg = `Slide speech exceeds 30s limit (max ${MAX_WORDS_PER_SCENE} words). Slide index: ${speech.index}, words: ${words}`;
          logger.error('[GenerateAvatarVideoFromPresentation] Slide speech duration limit exceeded', {
            jobId,
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

      // HARD CONSTRAINT: Global duration limit (GLOBAL for entire video, NOT per slide)
      // The 2:40 minutes (160 seconds) limit applies to the ENTIRE VIDEO duration.
      // All slide narrations combined must fit within this total duration.
      // This is calculated from the sum of all words across all slides.
      const totalWords = slideSpeeches.reduce((sum, speech) => sum + wordCount(speech.speakerText), 0);
      const estimatedSeconds = (totalWords / AVERAGE_WPM) * 60;
      
      if (estimatedSeconds > MAX_TOTAL_SECONDS) {
        const errorMsg = `Total narration exceeds maximum allowed duration (2:40). Estimated: ${Math.round(estimatedSeconds)}s (${totalWords} words). Maximum: ${MAX_TOTAL_SECONDS}s.`;
        logger.error('[GenerateAvatarVideoFromPresentation] Global duration limit exceeded', {
          jobId,
          totalWords,
          estimatedSeconds: Math.round(estimatedSeconds),
          maxAllowedSeconds: MAX_TOTAL_SECONDS,
          slideCount: slideSpeeches.length,
        });
        throw new Error(errorMsg);
      }
      
      logger.info('[GenerateAvatarVideoFromPresentation] Global duration guard passed', {
        jobId,
        totalWords,
        estimatedSeconds: Math.round(estimatedSeconds),
        maxAllowedSeconds: MAX_TOTAL_SECONDS,
        slideCount: slideSpeeches.length,
      });

      // Step 5: Skip SlidePlan creation - we'll use /v2/video/generate instead of template
      logger.info('[GenerateAvatarVideoFromPresentation] Step 5: Skipping SlidePlan (using /v2/video/generate)', {
        jobId,
        imageCount: slideImages.length,
        speechCount: slideSpeeches.length,
      });

      // Logging: Avatar video constraints summary (before HeyGen call)
      // Calculate total words and estimated duration for final validation logging
      const finalWordCount = slideSpeeches.reduce((sum, speech) => sum + wordCount(speech.speakerText), 0);
      const finalEstimatedSeconds = (finalWordCount / AVERAGE_WPM) * 60;
      // FINAL HEYGEN GUARD (non-negotiable): Assert slide count consistency before HeyGen call
      // This is the last line of defense against index mismatches that cause silent HeyGen failures.
      // CRITICAL: These assertions MUST pass or HeyGen will fail silently with malformed payload.
      if (slideImages.length !== slideSpeeches.length) {
        const errorMsg = `Slide count mismatch before HeyGen call: ${slideImages.length} images but ${slideSpeeches.length} speeches. This will cause HeyGen API to fail silently.`;
        logger.error('[GenerateAvatarVideoFromPresentation] Pre-HeyGen validation failed', {
          jobId,
          imageCount: slideImages.length,
          speechCount: slideSpeeches.length,
        });
        throw new Error(errorMsg);
      }
      
      // Validate that slide count is within allowed range (1 to MAX_SLIDES)
      // MAX_SLIDES is a maximum limit, not an exact requirement
      // Presentations can have fewer slides (e.g., 5 slides is valid)
      if (slideImages.length < 1) {
        const errorMsg = `Invalid slide count: must have at least 1 slide, got ${slideImages.length}.`;
        logger.error('[GenerateAvatarVideoFromPresentation] Pre-HeyGen validation failed', {
          jobId,
          actualCount: slideImages.length,
        });
        throw new Error(errorMsg);
      }
      
      if (slideImages.length > MAX_SLIDES) {
        const errorMsg = `Slide count exceeds maximum allowed: got ${slideImages.length} slides, maximum is ${MAX_SLIDES}.`;
        logger.error('[GenerateAvatarVideoFromPresentation] Pre-HeyGen validation failed', {
          jobId,
          actualCount: slideImages.length,
          maxAllowed: MAX_SLIDES,
        });
        throw new Error(errorMsg);
      }

      logger.info('[AvatarVideoConstraints]', {
        slidesCount: slideSpeeches.length,
        totalWords: finalWordCount,
        estimatedSeconds: Math.round(finalEstimatedSeconds),
        maxAllowedSeconds: MAX_TOTAL_SECONDS,
        validated: slideImages.length === slideSpeeches.length && slideImages.length >= 1 && slideImages.length <= MAX_SLIDES,
      });

      // Step 8: Generate 30-second script using OpenAI from slide speeches
      logger.info('[GenerateAvatarVideoFromPresentation] Step 8: Generating 30-second script using OpenAI', {
        jobId,
        language,
        slideCount: slideSpeeches.length,
      });

      // Combine all slide speeches into one text
      const allSlideTexts = slideSpeeches.map(speech => speech.speakerText).join(' ');

      // Generate 30-second script using OpenAI
      let videoScript = '';
      try {
        const openaiPrompt = `Create a concise educational narration script for a 30-second video lesson from a presentation.
The script must be EXACTLY 30 seconds when spoken (approximately 300 characters, no more).
Combine the key points from all slides into one cohesive 30-second narration.

Slide content:
${allSlideTexts}

Requirements:
- Must be exactly 30 seconds when spoken (approximately 300 characters, no more)
- Educational and clear
- In ${language} language
- Professional tone
- Complete sentences only
- Combine key points from all slides`;

        videoScript = await this.openaiClient.generateText(openaiPrompt, {
          model: 'gpt-4o',
          temperature: 0.7,
          max_tokens: 150, // Limit to ensure ~300 characters
          systemPrompt: 'You are an educational content creator. Create concise, clear educational scripts.',
        });

        // Trim and ensure it's approximately 300 characters (30 seconds)
        videoScript = videoScript.trim();
        
        // If too long, truncate to ~300 characters at word boundary
        if (videoScript.length > 320) {
          const truncated = videoScript.substring(0, 300);
          const lastSpace = truncated.lastIndexOf(' ');
          videoScript = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
          logger.warn('[GenerateAvatarVideoFromPresentation] Script was too long, truncated to 30 seconds', {
            jobId,
            originalLength: videoScript.length,
            truncatedLength: videoScript.length,
          });
        }

        logger.info('[GenerateAvatarVideoFromPresentation] OpenAI script generated', {
          jobId,
          scriptLength: videoScript.length,
          scriptPreview: videoScript.substring(0, 100),
        });
      } catch (openaiError) {
        logger.error('[GenerateAvatarVideoFromPresentation] Failed to generate script with OpenAI, using combined slide text', {
          jobId,
          error: openaiError.message,
        });
        // Fallback: use first slide speech or combined text (truncated to 300 chars)
        videoScript = allSlideTexts.substring(0, 300);
        const lastSpace = videoScript.lastIndexOf(' ');
        if (lastSpace > 0) {
          videoScript = videoScript.substring(0, lastSpace);
        }
      }

      // Step 9: Call HeyGen /v2/video/generate API (not template)
      logger.info('[GenerateAvatarVideoFromPresentation] Step 9: Calling HeyGen /v2/video/generate API', {
        jobId,
        avatarId: 'Adriana_Business_Front_public',
        scriptLength: videoScript.length,
      });

      let heygenResult;
      try {
        heygenResult = await this.heygenClient.generateVideo({
          title: presentationContent.content_data?.title || 'EduCore Presentation',
          prompt: videoScript, // Use OpenAI-generated 30-second script
          language: language,
          duration: 30, // 30 seconds
          avatar_id: 'Adriana_Business_Front_public', // Use Adriana avatar
        });
        
        // Check if generation failed or was skipped
        if (heygenResult.status === 'failed' || heygenResult.status === 'skipped') {
          logger.error('[GenerateAvatarVideoFromPresentation] HeyGen video generation failed or skipped', {
            jobId,
            status: heygenResult.status,
            error: heygenResult.error,
            reason: heygenResult.reason,
          });
          throw new Error(`HeyGen video generation ${heygenResult.status}: ${heygenResult.error || heygenResult.reason || 'Unknown error'}`);
        }
        
        logger.info('[GenerateAvatarVideoFromPresentation] HeyGen video generation initiated', {
          jobId,
          videoId: heygenResult.videoId,
          status: heygenResult.status,
        });
      } catch (error) {
        logger.error('[GenerateAvatarVideoFromPresentation] Failed to generate HeyGen video', {
          jobId,
          error: error.message,
        });
        throw new Error(`Failed to generate HeyGen video: ${error.message}`);
      }

      // Step 10: Poll for video status until completed
      // HeyGen returns videoId immediately, but videoUrl only after processing
      logger.info('[GenerateAvatarVideoFromPresentation] Step 10: Polling for video status', {
        jobId,
        videoId: heygenResult.videoId,
      });

      let pollResult;
      try {
        // Poll with reasonable timeout: max 60 attempts × 5 seconds = 5 minutes total
        // Recommended limits: 5-10 seconds delay, 5-7 minutes total timeout
        const pollingMaxAttempts = 60; // 60 attempts
        const pollingInterval = 5000; // 5 seconds delay between attempts
        const totalTimeoutMinutes = (pollingMaxAttempts * pollingInterval) / 60000; // 5 minutes
        
        logger.info('[GenerateAvatarVideoFromPresentation] Polling configuration', {
          jobId,
          videoId: heygenResult.videoId,
          maxAttempts: pollingMaxAttempts,
          intervalMs: pollingInterval,
          totalTimeoutMinutes,
        });
        
        pollResult = await this.heygenClient.pollVideoStatus(
          heygenResult.videoId,
          pollingMaxAttempts,
          pollingInterval
        );
        
        logger.info('[GenerateAvatarVideoFromPresentation] Video polling completed', {
          jobId,
          videoId: heygenResult.videoId,
          status: pollResult.status,
          hasVideoUrl: !!pollResult.videoUrl,
        });
      } catch (pollError) {
        // Polling failed or timed out - return partial result with videoId
        logger.warn('[GenerateAvatarVideoFromPresentation] Video polling failed or timed out', {
          jobId,
          videoId: heygenResult.videoId,
          error: pollError.message,
          fallbackUrl: pollError.videoUrl,
        });

        // Return partial result - video is still processing
        return {
          success: true,
          status: 'processing', // Video is being generated, not failed
          videoId: heygenResult.videoId,
          videoUrl: pollError.videoUrl || `https://app.heygen.com/share/${heygenResult.videoId}`, // Fallback share URL
          duration_seconds: 30, // 30 seconds
          explanation: null,
          metadata: {
            presentation_content_id,
            presentation_file_url: presentationFileUrl,
            avatar_id: 'Adriana_Business_Front_public',
            language,
            slideCount: slideSpeeches.length,
            generated_at: new Date().toISOString(),
            jobId,
            polling_status: 'timeout',
            polling_error: pollError.message,
          },
        };
      }

      // Check if video generation failed
      if (pollResult.status === 'failed') {
        logger.error('[GenerateAvatarVideoFromPresentation] Video generation failed', {
          jobId,
          videoId: heygenResult.videoId,
          errorMessage: pollResult.errorMessage,
          errorCode: pollResult.errorCode,
          errorDetail: pollResult.errorDetail,
        });

        return {
          success: false,
          status: 'failed',
          videoId: heygenResult.videoId,
          videoUrl: null,
          error: pollResult.errorMessage || 'Video generation failed',
          errorCode: pollResult.errorCode || 'GENERATION_FAILED',
          metadata: {
            presentation_content_id,
            presentation_file_url: presentationFileUrl,
            avatar_id: 'Adriana_Business_Front_public',
            language,
            slideCount: slideSpeeches.length,
            generated_at: new Date().toISOString(),
            jobId,
            polling_status: 'failed',
            errorMessage: pollResult.errorMessage,
            errorCode: pollResult.errorCode,
            errorDetail: pollResult.errorDetail,
          },
        };
      }

      // Video is ready
      if (pollResult.status === 'completed' && pollResult.videoUrl) {
        return {
          success: true,
          status: 'completed',
          videoId: heygenResult.videoId,
          videoUrl: pollResult.videoUrl,
          duration_seconds: 30, // 30 seconds
          explanation: null,
          metadata: {
            presentation_content_id,
            presentation_file_url: presentationFileUrl,
            avatar_id: 'Adriana_Business_Front_public',
            language,
            slideCount: slideSpeeches.length,
            generated_at: new Date().toISOString(),
            jobId,
            polling_status: 'completed',
            isFallback: pollResult.isFallback || false,
          },
        };
      }

      // Video status is not completed (shouldn't happen after polling, but handle it)
      return {
        success: true,
        status: pollResult.status || 'processing',
        videoId: heygenResult.videoId,
        videoUrl: pollResult.videoUrl || `https://app.heygen.com/share/${heygenResult.videoId}`,
        duration_seconds: 30, // 30 seconds
        explanation: null,
        metadata: {
          presentation_content_id,
          presentation_file_url: presentationFileUrl,
          avatar_id: 'Adriana_Business_Front_public',
          language,
          slideCount: slideSpeeches.length,
          generated_at: new Date().toISOString(),
          jobId,
          polling_status: pollResult.status || 'unknown',
        },
      };

    } catch (error) {
      logger.error('[GenerateAvatarVideoFromPresentation] Error generating avatar video', {
        jobId,
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
   * Generate a short narration (15-20 seconds, max 40 words) for a single slide using OpenAI
   * Same implementation as GammaHeyGenAvatarOrchestrator.generateShortNarration
   * @param {Object} slide - Slide object with {index, title, body, text}
   * @param {string} languageCode - Language code (e.g., "he", "en", "ar")
   * @returns {Promise<string>} Short narration text (max 40 words)
   */
  async generateShortNarration(slide, languageCode) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available');
    }

    // Get language name for prompt (same mapping as orchestrator)
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

    // Build prompt with strict constraints (same as orchestrator, but max 40 words instead of 50)
    const prompt = `You are an expert teacher explaining a single presentation slide to students.

Slide information:

Title: ${slide.title || 'Untitled'}

Content: ${slide.body || slide.text || 'No content'}

IMPORTANT CONSTRAINTS:

- This narration MUST be suitable for ~15–20 seconds of speech.

- Do NOT exceed 40 words.

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
        max_tokens: 80, // Limit tokens to ensure short output (40 words ≈ 80 tokens)
      });

      // Ensure narration doesn't exceed 40 words
      const words = narration.trim().split(/\s+/);
      if (words.length > 40) {
        logger.warn('[GenerateAvatarVideoFromPresentation] Narration exceeded 40 words, truncating', {
          originalLength: words.length,
          slideIndex: slide.index,
        });
        return words.slice(0, 40).join(' ');
      }

      return narration.trim();
    } catch (error) {
      logger.error('[GenerateAvatarVideoFromPresentation] Failed to generate narration with OpenAI', {
        slideIndex: slide.index,
        error: error.message,
      });
      throw error;
    }
  }
}
