import { logger } from '../../infrastructure/logging/Logger.js';
import { FileTextExtractor } from '../../services/FileTextExtractor.js';
import { PptxExtractorPro } from '../../services/PptxExtractorPro.js';
import { OpenAIClient } from '../../infrastructure/external-apis/openai/OpenAIClient.js';
import { getSafeAvatarId, getVoiceConfig } from '../../config/heygen.js';
import axios from 'axios';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

/**
 * Generate Avatar Video from Presentation Pipeline
 * 
 * Multi-step pipeline to create a fully synchronized avatar video from a presentation:
 * 1. Extract slide text from uploaded presentation (PDF/PPTX) - structured array
 * 2. Generate educational narration for each slide using OpenAI GPT-4o
 * 3. Combine slide narrations into a single script formatted for HeyGen
 * 4. Choose HeyGen avatar ID and voice_id from configuration
 * 5. Prepare HeyGen API call payload with presentation as background
 * 6. Ensure script text does not exceed HeyGen limits
 * 7. Return structured payload ready for HeyGen execution
 */
export class GenerateAvatarVideoFromPresentationPipeline {
  constructor({
    heygenClient,
    openaiClient,
    heygenApiKey,
    language = 'en',
  }) {
    this.heygenClient = heygenClient;
    this.openaiClient = openaiClient;
    this.heygenApiKey = heygenApiKey;
    this.language = language;
    
    // HeyGen API limits
    this.MAX_PROMPT_LENGTH = 8000; // Characters for 15-minute videos
    this.HEYGEN_BASE_URL = 'https://api.heygen.com';
  }

  /**
   * Execute the full pipeline
   * @param {Object} params - Request parameters
   * @param {string} params.presentationFileUrl - URL to presentation file (PDF/PPTX)
   * @param {string} params.language - Language code (default: 'en')
   * @param {string} params.avatar_id - Optional custom avatar ID
   * @param {string} params.custom_prompt - Optional custom prompt for narration
   * @returns {Promise<Object>} Structured payload ready for HeyGen
   */
  async execute(params) {
    const {
      presentationFileUrl,
      language = this.language || 'en',
      avatar_id = null,
      custom_prompt = null,
    } = params;

    try {
      // Step 1: Extract slide text from presentation
      logger.info('[AvatarVideoPipeline] Step 1: Extracting slides from presentation');
      const slides = await this.extractSlidesFromPresentation(presentationFileUrl);
      
      if (!slides || slides.length === 0) {
        throw new Error('No slides could be extracted from the presentation');
      }

      logger.info('[AvatarVideoPipeline] Slides extracted successfully', {
        slideCount: slides.length,
        slidesWithContent: slides.filter(s => s.text && s.text.trim().length > 0).length,
      });

      // Step 2: Generate narration for each slide using OpenAI GPT-4o
      logger.info('[AvatarVideoPipeline] Step 2: Generating narrations for each slide');
      const slidesWithNarration = await this.generateSlideNarrations(slides, language, custom_prompt);
      
      logger.info('[AvatarVideoPipeline] Narrations generated successfully', {
        slideCount: slidesWithNarration.length,
        totalNarrationLength: slidesWithNarration.reduce((sum, s) => sum + (s.narration?.length || 0), 0),
      });

      // Step 3: Combine narrations into HeyGen script format
      logger.info('[AvatarVideoPipeline] Step 3: Combining narrations into HeyGen script');
      const script = this.combineNarrationsToScript(slidesWithNarration);
      
      logger.info('[AvatarVideoPipeline] Script created', {
        scriptLength: script.length,
        estimatedDuration: this.estimateVideoDuration(script),
      });

      // Step 4: Choose avatar and voice
      logger.info('[AvatarVideoPipeline] Step 4: Selecting avatar and voice');
      const avatarId = avatar_id || getSafeAvatarId();
      const voiceConfig = getVoiceConfig(language);
      const voiceId = voiceConfig.voice_id;
      
      if (!avatarId) {
        throw new Error('Avatar ID not configured. Please set up HeyGen avatar configuration.');
      }
      
      if (!voiceId) {
        throw new Error(`Voice ID not available for language: ${language}`);
      }

      logger.info('[AvatarVideoPipeline] Avatar and voice selected', {
        avatarId,
        voiceId,
        language,
        voiceLanguage: voiceConfig.language,
      });

      // Step 5: Upload presentation to HeyGen media API (if needed)
      logger.info('[AvatarVideoPipeline] Step 5: Preparing presentation asset for HeyGen');
      const presentationAssetId = await this.uploadPresentationToHeyGen(presentationFileUrl);
      
      logger.info('[AvatarVideoPipeline] Presentation asset prepared', {
        presentationAssetId: presentationAssetId || 'using URL directly',
      });

      // Step 6: Ensure script doesn't exceed limits
      logger.info('[AvatarVideoPipeline] Step 6: Validating script length');
      const finalScript = this.truncateScriptIfNeeded(script, slidesWithNarration);
      
      logger.info('[AvatarVideoPipeline] Script validated', {
        originalLength: script.length,
        finalLength: finalScript.length,
        truncated: script.length !== finalScript.length,
      });

      // Step 7: Prepare HeyGen payload
      logger.info('[AvatarVideoPipeline] Step 7: Preparing HeyGen API payload');
      const heygenPayload = this.buildHeyGenPayload({
        title: 'EduCore Presentation',
        script: finalScript,
        avatarId,
        voiceId,
        language,
        presentationAssetId,
        presentationFileUrl,
      });

      logger.info('[AvatarVideoPipeline] Pipeline completed successfully', {
        slideCount: slides.length,
        narrationCount: slidesWithNarration.length,
        scriptLength: finalScript.length,
        avatarId,
        voiceId,
      });

      // Return structured result ready for backend execution
      return {
        presentationAssetId: presentationAssetId || null,
        avatarId,
        voiceId,
        heygenPayload,
        openaiSlidesJson: {
          slides: slidesWithNarration.map(s => ({
            index: s.index,
            narration: s.narration,
          })),
        },
        metadata: {
          slideCount: slides.length,
          scriptLength: finalScript.length,
          language,
          generated_at: new Date().toISOString(),
        },
      };

    } catch (error) {
      logger.error('[AvatarVideoPipeline] Pipeline failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Step 1: Extract slides from presentation file
   * @param {string} presentationFileUrl - URL to presentation file
   * @returns {Promise<Array>} Array of slides with {index, title, body, text}
   */
  async extractSlidesFromPresentation(presentationFileUrl) {
    try {
      // Download file to temp location
      const tempPath = join(tmpdir(), `presentation-${Date.now()}-${Math.random().toString(36).substring(7)}.pptx`);
      
      logger.info('[AvatarVideoPipeline] Downloading presentation file', {
        url: presentationFileUrl.substring(0, 100) + '...',
        tempPath,
      });

      const response = await axios.get(presentationFileUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });

      writeFileSync(tempPath, response.data);

      // Determine file extension
      const urlLower = presentationFileUrl.toLowerCase();
      const isPptx = urlLower.endsWith('.pptx');
      const isPdf = urlLower.endsWith('.pdf');

      let slides = [];

      if (isPptx) {
        // Use PptxExtractorPro to extract structured slides
        slides = await PptxExtractorPro.extractSlides(tempPath);
      } else if (isPdf) {
        // For PDF, extract text and split into slides (heuristic)
        const text = await FileTextExtractor.extractTextFromFile(tempPath, '.pdf');
        if (text) {
          // Split by common slide separators or page breaks
          const slideTexts = text.split(/\n\s*\n\s*\n/).filter(t => t.trim().length > 0);
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
        }
      } else {
        throw new Error(`Unsupported file type. Expected PDF or PPTX, got: ${presentationFileUrl}`);
      }

      // Clean up temp file
      try {
        unlinkSync(tempPath);
      } catch (cleanupError) {
        logger.warn('[AvatarVideoPipeline] Failed to cleanup temp file', {
          error: cleanupError.message,
        });
      }

      return slides;
    } catch (error) {
      logger.error('[AvatarVideoPipeline] Failed to extract slides', {
        error: error.message,
      });
      throw new Error(`Failed to extract slides from presentation: ${error.message}`);
    }
  }

  /**
   * Step 2: Generate narration for each slide using OpenAI GPT-4o
   * @param {Array} slides - Array of slides with {index, title, body, text}
   * @param {string} language - Language code
   * @param {string} custom_prompt - Optional custom prompt
   * @returns {Promise<Array>} Slides with added narration field
   */
  async generateSlideNarrations(slides, language, custom_prompt = null) {
    const slidesWithNarration = [];

    for (const slide of slides) {
      try {
        const narrationPrompt = this.buildNarrationPrompt(slide, language, custom_prompt);
        
        const narration = await this.openaiClient.generateText(narrationPrompt, {
          model: 'gpt-4o',
          temperature: 0.7,
          max_tokens: 500, // Per slide narration
        });

        slidesWithNarration.push({
          ...slide,
          narration: narration || slide.text, // Fallback to slide text if narration fails
        });

        logger.debug('[AvatarVideoPipeline] Narration generated for slide', {
          index: slide.index,
          narrationLength: narration?.length || 0,
        });
      } catch (error) {
        logger.warn('[AvatarVideoPipeline] Failed to generate narration for slide', {
          index: slide.index,
          error: error.message,
        });
        // Fallback to slide text
        slidesWithNarration.push({
          ...slide,
          narration: slide.text || slide.body || slide.title,
        });
      }
    }

    return slidesWithNarration;
  }

  /**
   * Build prompt for generating slide narration
   * @param {Object} slide - Slide object with {index, title, body, text}
   * @param {string} language - Language code
   * @param {string} custom_prompt - Optional custom prompt
   * @returns {string} Formatted prompt
   */
  buildNarrationPrompt(slide, language, custom_prompt = null) {
    const basePrompt = `You are an expert teacher explaining a presentation slide to students.

Slide ${slide.index}:
Title: ${slide.title}
Content: ${slide.body || slide.text}

${custom_prompt ? `Trainer's instruction: ${custom_prompt}\n` : ''}Please generate a clear, engaging narration for this slide. 
Write as if you are speaking directly to students, explaining the slide content in a natural, conversational way.
Keep the narration in ${language} language.
Make it educational, clear, and suitable for learners.

Generate the narration (2-4 sentences):`;

    return basePrompt;
  }

  /**
   * Step 3: Combine narrations into HeyGen script format
   * @param {Array} slidesWithNarration - Slides with narration field
   * @returns {string} Combined script with slide markers
   */
  combineNarrationsToScript(slidesWithNarration) {
    const scriptParts = slidesWithNarration.map((slide, index) => {
      const marker = `Slide ${slide.index}:`;
      const narration = slide.narration || slide.text || slide.body || '';
      return `${marker} ${narration}`;
    });

    return scriptParts.join('\n\n');
  }

  /**
   * Step 4: Estimate video duration based on script length
   * @param {string} script - Combined script
   * @returns {number} Estimated duration in seconds
   */
  estimateVideoDuration(script) {
    // Rough estimate: ~150 words per minute, average word length ~5 chars
    const words = script.split(/\s+/).length;
    const minutes = words / 150;
    return Math.ceil(minutes * 60);
  }

  /**
   * Step 5: Upload presentation to HeyGen media API
   * @param {string} presentationFileUrl - URL to presentation file
   * @returns {Promise<string|null>} HeyGen asset ID or null if using URL directly
   */
  async uploadPresentationToHeyGen(presentationFileUrl) {
    // HeyGen API v2 supports direct URLs for background media
    // If the URL is publicly accessible, we can use it directly
    // Otherwise, we would need to upload via HeyGen media API
    
    // For now, return null to indicate we'll use the URL directly
    // In production, you might want to upload to HeyGen's media storage
    logger.info('[AvatarVideoPipeline] Using presentation URL directly (HeyGen supports public URLs)');
    return null;
  }

  /**
   * Step 6: Truncate script if it exceeds HeyGen limits
   * @param {string} script - Full script
   * @param {Array} slidesWithNarration - Original slides
   * @returns {string} Truncated script (at slide boundaries)
   */
  truncateScriptIfNeeded(script, slidesWithNarration) {
    if (script.length <= this.MAX_PROMPT_LENGTH) {
      return script;
    }

    logger.warn('[AvatarVideoPipeline] Script exceeds limit, truncating at slide boundaries', {
      originalLength: script.length,
      maxLength: this.MAX_PROMPT_LENGTH,
    });

    // Truncate at slide boundaries
    let truncatedScript = '';
    for (const slide of slidesWithNarration) {
      const slideScript = `Slide ${slide.index}: ${slide.narration || slide.text || ''}\n\n`;
      
      if ((truncatedScript + slideScript).length > this.MAX_PROMPT_LENGTH) {
        break;
      }
      
      truncatedScript += slideScript;
    }

    return truncatedScript.trim();
  }

  /**
   * Step 7: Build HeyGen API v2 payload
   * @param {Object} params - Payload parameters
   * @returns {Object} HeyGen API payload
   */
  buildHeyGenPayload({
    title,
    script,
    avatarId,
    voiceId,
    language,
    presentationAssetId,
    presentationFileUrl,
  }) {
    // Map language code to HeyGen format
    const heygenLanguageMap = {
      'he': 'he',
      'ar': 'ar',
      'ru': 'ru',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'it': 'it',
      'ko': 'ko',
      'ja': 'ja',
      'zh': 'zh',
      'en': 'en',
    };
    const heygenLanguage = heygenLanguageMap[language] || language;

    const payload = {
      title: title || 'EduCore Presentation',
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: avatarId,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: voiceId,
            language_code: heygenLanguage,
          },
          // Add presentation as background if available
          ...(presentationFileUrl ? {
            background: {
              type: 'image',
              url: presentationFileUrl, // HeyGen supports public URLs
            },
          } : {}),
        },
      ],
      dimension: {
        width: 1280,
        height: 720,
      },
      // Enable captions
      captions: {
        enabled: true,
      },
    };

    return payload;
  }
}

