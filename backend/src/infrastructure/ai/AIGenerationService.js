import { AIGenerationService as IAIGenerationService } from '../../domain/services/AIGenerationService.js';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { TTSClient } from '../external-apis/openai/TTSClient.js';
import { GeminiClient } from '../external-apis/gemini/GeminiClient.js';
import { HeygenClient } from './HeygenClient.js';
import { SupabaseStorageClient } from '../storage/SupabaseStorageClient.js';
import { GammaClient } from '../gamma/GammaClient.js';
import { PromptSanitizer } from '../security/PromptSanitizer.js';
import { logger } from '../logging/Logger.js';
import {
  getValidatedLanguage,
  getTTSVoiceForLanguage,
  isTTSVoiceAvailable,
  buildLanguagePreservationInstruction,
} from './LanguageValidator.js';

/**
 * AI Generation Service Implementation
 * Uses OpenAI and Gemini APIs for content generation
 */
export class AIGenerationService extends IAIGenerationService {
  constructor({
    openaiApiKey,
    geminiApiKey,
    heygenApiKey,
    supabaseUrl,
    supabaseServiceKey,
    gammaApiKey,
  }) {
    super();
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
    this.ttsClient = openaiApiKey ? new TTSClient({ apiKey: openaiApiKey }) : null;
    this.geminiClient = geminiApiKey ? new GeminiClient({ apiKey: geminiApiKey }) : null;
    this.heygenClient = heygenApiKey ? new HeygenClient({ apiKey: heygenApiKey }) : null;
    // Always create SupabaseStorageClient - it will check environment variables if params not provided
    // This allows it to use SUPABASE_SERVICE_ROLE_KEY as fallback
    this.storageClient = new SupabaseStorageClient({ 
      supabaseUrl, 
      supabaseServiceKey,
    });
    this.gammaClient = gammaApiKey ? new GammaClient({ 
      apiKey: gammaApiKey,
      storageClient: this.storageClient,
    }) : null;
  }

  async generate(options) {
    const { prompt, content_type, config } = options;

    switch (content_type) {
      case 'text':
        return this.generateText(prompt, config);
      case 'code':
        return this.generateCode(prompt, config?.language, config);
      case 'mind_map':
        return this.generateMindMap(prompt, config);
      case 'audio':
        return this.generateAudio(prompt, config);
      case 'presentation':
        // Convert prompt/config to contentData format for new generatePresentation signature
        const contentData = typeof prompt === 'object' && prompt !== null
          ? prompt
          : {
              topicName: config?.topicName || config?.lessonTopic || 'Presentation',
              topicDescription: config?.topicDescription || config?.lessonDescription || prompt || '',
              skills: config?.skills || config?.skillsList || [],
              trainerPrompt: config?.trainerPrompt || config?.trainer_prompt || null,
              transcriptText: config?.transcriptText || config?.transcription || null,
              language: config?.language || 'en',
              audience: config?.audience || 'general',
            };
        return this.generatePresentation(contentData, config);
      case 'avatar_video':
        return this.generateAvatarVideo(prompt, config);
      default:
        throw new Error(`Unsupported content type for AI generation: ${content_type}`);
    }
  }

  async generateText(prompt, config = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    // Validate language - DO NOT default to English silently
    const languageValidation = getValidatedLanguage(config.language);
    if (!languageValidation.valid) {
      throw new Error(`Language validation failed: ${languageValidation.message}`);
    }
    const language = languageValidation.language;

    // Sanitize and wrap user prompt to prevent injection
    const sanitizedPrompt = PromptSanitizer.sanitizePrompt(prompt);
    const wrappedPrompt = PromptSanitizer.wrapUserInput(sanitizedPrompt);
    
    // Build system prompt with language preservation instruction
    const systemPrompt = this.buildSystemPrompt('text', config, language);
    const fullPrompt = this.buildTextPrompt(wrappedPrompt, config, language);

    return await this.openaiClient.generateText(fullPrompt, {
      systemPrompt,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 2000,
    });
  }

  async generateCode(prompt, language = 'javascript', config = {}) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    // Sanitize user prompt and language to prevent injection
    const sanitizedPrompt = PromptSanitizer.sanitizePrompt(prompt);
    const sanitizedLanguage = PromptSanitizer.sanitizeString(language, 'language', {
      maxLength: 50,
      removeNewlines: true,
    });

    // Wrap user input in delimiters
    const wrappedPrompt = PromptSanitizer.wrapUserInput(sanitizedPrompt);

    const securityInstruction = PromptSanitizer.getSystemInstruction();
    const systemPrompt = `${securityInstruction}

You are an expert ${sanitizedLanguage} programmer. Generate clean, production-ready code that is readable and self-explanatory. Write code that learners can read and understand easily.`;
    
    const fullPrompt = `Generate ${sanitizedLanguage} code based on the following user request:

${wrappedPrompt}

IMPORTANT REQUIREMENTS:
- Write clean, readable code without excessive comments
- Code should be self-explanatory through clear naming and structure
- Only add comments if absolutely necessary for complex logic
- Focus on writing code, not explaining it with comments
- The code itself should be the primary teaching tool
- Learners need to see clean code, not comment-heavy examples

Generate the code now:`;

    const generatedCode = await this.openaiClient.generateText(fullPrompt, {
      systemPrompt,
      temperature: config.temperature || 0.3,
      max_tokens: config.max_tokens || 3000,
    });

    return {
      code: generatedCode,
      language: sanitizedLanguage,
      explanation: config.include_explanation
        ? await this.generateCodeExplanation(generatedCode, sanitizedLanguage)
        : null,
    };
  }

  async generateMindMap(topicText, config = {}) {
    // Validate language - DO NOT default to English silently
    logger.info('[AIGenerationService] Validating language for mind map generation', {
      config_language: config.language,
      config_keys: Object.keys(config),
    });
    const languageValidation = getValidatedLanguage(config.language);
    if (!languageValidation.valid) {
      logger.error('[AIGenerationService] Language validation failed for mind map', {
        error: languageValidation.message,
        original: languageValidation.original,
      });
      throw new Error(`Language validation failed: ${languageValidation.message}`);
    }
    const language = languageValidation.language;
    logger.info('[AIGenerationService] Language validated successfully for mind map', {
      original: languageValidation.original,
      normalized: language,
    });

    // Build language preservation instruction
    const languageInstruction = buildLanguagePreservationInstruction(language);

    // Sanitize input to prevent injection
    const sanitizedTopicText = PromptSanitizer.sanitizePrompt(topicText);
    
    // Try Gemini first, fallback to OpenAI if it fails
    if (this.geminiClient) {
      try {
        // Sanitize config before passing to Gemini
        const sanitizedConfig = {
          ...config,
          language, // Pass language to Gemini client
          topic_title: config.topic_title ? PromptSanitizer.sanitizeString(config.topic_title, 'topic_title') : undefined,
          trainer_prompt: config.trainer_prompt ? PromptSanitizer.sanitizePrompt(config.trainer_prompt) : undefined,
          lessonDescription: config.lessonDescription ? PromptSanitizer.sanitizePrompt(config.lessonDescription) : undefined,
        };
        return await this.geminiClient.generateMindMap(sanitizedTopicText, sanitizedConfig);
      } catch (error) {
        console.warn('[AIGenerationService] Gemini failed, falling back to OpenAI:', error.message);
      }
    }

    // Fallback: Use OpenAI to generate mind map
    if (!this.openaiClient) {
      throw new Error('Neither Gemini nor OpenAI client is configured for mind map generation');
    }

    // Extract and sanitize variables from config or use topicText as fallback
    const topic_title = PromptSanitizer.sanitizeString(
      config.topic_title || sanitizedTopicText || 'Untitled Topic',
      'topic_title',
      { maxLength: 200, removeNewlines: true }
    );
    const skills = Array.isArray(config.skills)
      ? config.skills.map(skill => PromptSanitizer.sanitizeString(String(skill), 'skill', { maxLength: 100 }))
      : [];
    const trainer_prompt = PromptSanitizer.sanitizePrompt(
      config.trainer_prompt || config.lessonDescription || ''
    );

    // Wrap user inputs in delimiters
    const wrappedTopicTitle = PromptSanitizer.wrapUserInput(topic_title);
    const wrappedTrainerPrompt = PromptSanitizer.wrapUserInput(trainer_prompt);

    const mindMapSecurityInstruction = PromptSanitizer.getSystemInstruction();
    const prompt = `${mindMapSecurityInstruction}

You are an expert educational Knowledge-Graph MindMap Generator.

${languageInstruction}

Your task is to convert the following user inputs into a clear, professional conceptual MindMap.
ALL node labels, descriptions, and content MUST be in ${language}. Do NOT translate to English.

Topic Title:
${wrappedTopicTitle}

List of skills (for understanding only):
${JSON.stringify(skills)}

Trainer Prompt:
${wrappedTrainerPrompt}

Now create the MindMap:

IMPORTANT:
This is NOT a tree and NOT a hierarchy.
This is a radial knowledge map with conceptual clusters and semantic connections.

===============================
     OUTPUT FORMAT (JSON)
===============================

Return ONLY valid JSON:

{
  "nodes": [
    {
      "id": "string",
      "type": "concept",
      "data": {
        "label": "Concept Name",
        "description": "Short, accurate educational definition",
        "group": "core | primary | secondary | related | advanced"
      },
      "position": { "x": 0, "y": 0 },
      "style": {
        "backgroundColor": "HEX",
        "borderRadius": 12
      }
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "node_id",
      "target": "node_id",
      "type": "smoothstep",
      "label": "explains | relates-to | depends-on | part-of | similar-to | leads-to",
      "animated": true
    }
  ]
}

===============================
     RULES (NOT A TREE!)
===============================

1. Place the topic_title in the center (group: core).

2. Create conceptual clusters, NOT levels:
   - primary concepts (closest to the core)
   - secondary concepts (expansions of primary)
   - related concepts (side-connections)
   - advanced concepts (deep insight)

3. No hierarchy. No parent-child.
   Use semantic connections only.

4. Colors by group:
   - core: "#E3F2FD"
   - primary: "#FFF3E0"
   - secondary: "#E8F5E9"
   - related: "#F3E5F5"
   - advanced: "#FCE4EC"

5. Every connection (edge) must have meaning:
   explains / relates-to / part-of / similar-to / depends-on / leads-to

6. Return 12–20 total concepts.

7. Skills are used only to help interpret the topic, never included in the JSON.

8. Output JSON ONLY (no text, no markdown).

Generate a radial non-hierarchical MindMap as described above.
Return ONLY the JSON.`;

    const mindMapSystemSecurity = PromptSanitizer.getSystemInstruction();
    const response = await this.openaiClient.generateText(prompt, {
      systemPrompt: `${mindMapSystemSecurity}

You are an expert educational Knowledge-Graph MindMap Generator. Create radial, non-hierarchical mind maps with semantic connections.

${languageInstruction}
ALL node labels and descriptions MUST be in ${language}. Edge labels (explains, relates-to, etc.) may remain in English for consistency.`,
      temperature: 0.3,
      max_tokens: 4000, // Increased for more concepts
    });

    // Parse JSON response
    const cleanedResponse = response.trim();
    // Remove markdown code blocks if present
    const jsonMatch = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                     cleanedResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                     cleanedResponse.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonText);
    }

    throw new Error('Invalid JSON response from OpenAI');
  }

  buildSystemPrompt(contentType, config, language = null) {
    const style = config.style || 'educational';
    const difficulty = config.difficulty || 'intermediate';

    const basePrompt = `You are an expert educational content creator. Create ${style} content suitable for ${difficulty} level learners. 
The content should be clear, well-structured, and engaging.`;

    // Add language preservation instruction if language is provided
    const languageInstruction = language ? buildLanguagePreservationInstruction(language) : '';

    // Add security instruction for handling wrapped user input
    const securityInstruction = PromptSanitizer.getSystemInstruction();

    return `${securityInstruction}

${basePrompt}

${languageInstruction}`;
  }

  buildTextPrompt(prompt, config, language = null) {
    const style = config.style || 'educational';
    const sections = config.sections || [];

    let fullPrompt = prompt;

    // Add language preservation reminder
    if (language) {
      fullPrompt = `${buildLanguagePreservationInstruction(language)}\n\n${fullPrompt}`;
    }

    if (sections.length > 0) {
      fullPrompt += `\n\nStructure the content with the following sections: ${sections.join(', ')}`;
    }

    if (style === 'conversational') {
      fullPrompt += '\n\nUse a conversational, friendly tone.';
    } else if (style === 'formal') {
      fullPrompt += '\n\nUse a formal, academic tone.';
    }

    return fullPrompt;
  }

  async generateCodeExplanation(code, language) {
    if (!this.openaiClient) {
      return null;
    }

    const explanationPrompt = `Explain the following ${language} code in simple terms:\n\n${code}\n\nProvide a brief explanation of what the code does.`;                                                                                 

    return await this.openaiClient.generateText(explanationPrompt, {
      systemPrompt: 'You are a programming educator. Explain code clearly and simply.',
      temperature: 0.5,
      max_tokens: 500,
    });
  }

  /**
   * Generate audio narration from text
   * @param {string} text - Text to convert to audio
   * @param {Object} config - Audio generation config
   * @returns {Promise<Object>} Audio data with metadata
   */
  async generateAudio(text, config = {}) {
    if (!this.ttsClient) {
      throw new Error('TTS client not configured');
    }

    // Remove user input markers from text before generating audio
    if (text && typeof text === 'string') {
      text = PromptSanitizer.removeUserInputMarkers(text);
    }

    // Validate language - DO NOT default to English silently
    logger.info('[AIGenerationService] Validating language for audio generation', {
      config_language: config.language,
      config_keys: Object.keys(config),
    });
    const languageValidation = getValidatedLanguage(config.language);
    if (!languageValidation.valid) {
      logger.error('[AIGenerationService] Language validation failed for audio', {
        error: languageValidation.message,
        original: languageValidation.original,
      });
      throw new Error(`Language validation failed: ${languageValidation.message}`);
    }
    const language = languageValidation.language;
    logger.info('[AIGenerationService] Language validated successfully for audio', {
      original: languageValidation.original,
      normalized: language,
    });

    // Check if TTS voice is available for this language
    if (!isTTSVoiceAvailable(language)) {
      return {
        error: 'VOICE_NOT_AVAILABLE',
        errorCode: 'VOICE_NOT_AVAILABLE',
        message: `TTS voice not available for language: ${language}. Cannot generate audio.`,
        language,
        text, // Return original text for reference
      };
    }

    // Get appropriate voice for language
    const voice = getTTSVoiceForLanguage(language, config.voice);

    // If text is too long, summarize it first (preserving language)
    let textToConvert = text;
    if (text.length > 4000) {
      // Summarize long text for audio (in the same language)
      const languageInstruction = buildLanguagePreservationInstruction(language);
      const summaryPrompt = `${languageInstruction}

Summarize the following text in a clear, concise way suitable for audio narration (max 4000 characters). Keep the summary in ${language}:

${text}`;
      textToConvert = await this.openaiClient.generateText(summaryPrompt, {
        systemPrompt: `You are a content summarizer. Create clear, concise summaries suitable for audio narration. ${buildLanguagePreservationInstruction(language)}`,
        temperature: 0.5,
        max_tokens: 2000,
      });
    }

    const audioData = await this.ttsClient.generateAudioWithMetadata(textToConvert, {
      voice,
      model: config.model || 'tts-1',
      format: config.format || 'mp3',
      speed: config.speed || 1.0,
    });

    // Upload audio to Supabase Storage
    let audioUrl = null;
    let audioSha256Hash = null;
    let audioDigitalSignature = null;
    if (this.storageClient && audioData.audio) {
      try {
        const fileName = `audio_${Date.now()}.${audioData.format}`;
        const uploadResult = await this.storageClient.uploadFile(
          audioData.audio,
          fileName,
          `audio/${audioData.format}`
        );
        audioUrl = uploadResult.url;
        // Extract integrity data from upload result
        audioSha256Hash = uploadResult.sha256Hash || null;
        audioDigitalSignature = uploadResult.digitalSignature || null;
        console.log('[AIGenerationService] Audio uploaded to storage:', {
          audioUrl,
          hasHash: !!audioSha256Hash,
          hasSignature: !!audioDigitalSignature,
        });
      } catch (uploadError) {
        console.warn('[AIGenerationService] Failed to upload audio to storage:', uploadError.message);
      }
    }

    return {
      audio: audioData.audio, // Keep buffer for backward compatibility
      audioUrl, // URL for playback
      format: audioData.format,
      duration: audioData.duration,
      voice: audioData.voice,
      text: textToConvert,
      // Include file integrity data if available
      sha256Hash: audioSha256Hash,
      digitalSignature: audioDigitalSignature,
      metadata: {
        original_text_length: text.length,
        converted_text_length: textToConvert.length,
        word_count: audioData.word_count,
      },
    };
  }

  /**
   * Generate Gamma presentation from content data
   * @param {Object} contentData - Presentation content data
   * @param {string} contentData.topicName - Topic name
   * @param {string} contentData.topicDescription - Topic description
   * @param {Array<string>} contentData.skills - Skills array
   * @param {string} contentData.trainerPrompt - Trainer prompt (may be null for VideoToLesson)
   * @param {string} contentData.transcriptText - Transcription text (fallback if trainerPrompt is null)
   * @param {string} contentData.language - Language code
   * @param {string} contentData.audience - Target audience
   * @param {Object} config - Additional config
   * @returns {Promise<Object>} Gamma presentation data with storage info
   */
  async generatePresentation(contentData, config = {}) {
    if (!this.gammaClient) {
      throw new Error('Gamma client not configured');
    }

    // Extract and sanitize input data
    const topicName = PromptSanitizer.sanitizeString(
      contentData.topicName || contentData.topic || '',
      'topicName',
      { maxLength: 200 }
    );
    const topicDescription = PromptSanitizer.sanitizePrompt(
      contentData.topicDescription || contentData.description || ''
    );
    const skills = Array.isArray(contentData.skills)
      ? contentData.skills.map(skill => PromptSanitizer.sanitizeString(String(skill), 'skill', { maxLength: 100 }))
      : [];
    const language = PromptSanitizer.sanitizeString(
      contentData.language || config.language || 'en',
      'language',
      { maxLength: 10 }
    );
    const audience = PromptSanitizer.sanitizeString(
      contentData.audience || config.audience || 'general',
      'audience',
      { maxLength: 100 }
    );

    if (!topicName) {
      throw new Error('Topic name is required for presentation generation');
    }

    // Determine effective prompt: trainerPrompt if available, otherwise use transcriptText
    const trainerPrompt = contentData.trainerPrompt 
      ? PromptSanitizer.sanitizePrompt(contentData.trainerPrompt)
      : null;
    const transcriptText = contentData.transcriptText
      ? PromptSanitizer.sanitizePrompt(contentData.transcriptText)
      : null;

    const effectivePrompt = (trainerPrompt && trainerPrompt.trim().length > 0)
      ? trainerPrompt
      : (transcriptText && transcriptText.trim().length > 0)
        ? transcriptText
        : topicDescription;

    if (!effectivePrompt || effectivePrompt.trim().length === 0) {
      throw new Error('Either trainer prompt or transcript text is required for presentation generation');
    }

    // Build inputText for Gamma - combine all content into a single text
    // Gamma expects a complete text input, not a structured prompt
    const skillsList = skills.length > 0
      ? skills.map(skill => `- ${skill}`).join('\n')
      : 'None specified';

    // Build comprehensive inputText that includes all relevant information
    const inputText = `Topic: ${topicName}

Description: ${topicDescription}

Key Skills:
${skillsList}

Content:
${effectivePrompt}

This presentation should be educational and suitable for ${audience}.`;

    // Generate presentation using Gamma API with correct payload structure
    const gammaResult = await this.gammaClient.generatePresentation(inputText, {
      topicName,
      language,
      audience,
    });

    // MANDATORY: Only return Supabase Storage URL, never gammaUrl
    // Validate that presentationUrl is from Supabase Storage, not Gamma
    if (gammaResult.presentationUrl && gammaResult.presentationUrl.includes('gamma.app')) {
      throw new Error('Invalid presentation URL: Gamma URL detected. All presentations must be stored in Supabase Storage.');
    }

    if (!gammaResult.storagePath) {
      throw new Error('Missing storage path. All presentations must be stored in Supabase Storage.');
    }

    return {
      presentationUrl: gammaResult.presentationUrl, // Must be Supabase Storage URL
      storagePath: gammaResult.storagePath, // Required storage path
      format: 'gamma',
      // Include file integrity data if available
      sha256Hash: gammaResult.sha256Hash || null,
      digitalSignature: gammaResult.digitalSignature || null,
      metadata: {
        generated_at: new Date().toISOString(),
        language,
        audience,
        source: trainerPrompt ? 'prompt' : 'video_transcription',
        gamma_generation_id: gammaResult.rawResponse?.generationId || gammaResult.rawResponse?.result?.generationId,
        gamma_raw_response: gammaResult.rawResponse,
        // DO NOT include presentationUrl or storagePath in metadata - they're top-level fields
      },
    };
  }

  truncateWords(text = '', maxWords = 7) {
    const words = String(text)
      .split(/\s+/)
      .filter(Boolean);
    if (words.length <= maxWords) {
      return words.join(' ');
    }
    return `${words.slice(0, maxWords).join(' ')}…`;
  }

  /**
  /**
   * Generate avatar video
   * 
   * ⚠️ CRITICAL: This function sends ONLY the minimal required fields to HeyGen:
   * - title
   * - prompt (trainer's exact text, unmodified)
   * - topic
   * - description
   * - skills
   * 
   * NO voice, voice_id, video_inputs, script generation, or avatar selection
   * 
   * @param {string|Object} prompt - Trainer's exact prompt (unmodified) or lesson data object
   * @param {Object} config - Configuration with topic, description, skills
   * @returns {Promise<Object>} Avatar video result
   */
  async generateAvatarVideo(prompt, config = {}) {

    if (!this.heygenClient) {
      // Don't throw - return failed status
      return {
        script: '',
        videoUrl: null,
        videoId: null,
        language: config.language || 'en',
        duration_seconds: 0,
        status: 'failed',
        fallback: false,
        error: 'Heygen client not configured',
        errorCode: 'CLIENT_NOT_CONFIGURED',
        reason: 'Avatar video generation is not available. Please configure HeyGen API key.',
        metadata: {
          generation_status: 'failed',
          error_code: 'CLIENT_NOT_CONFIGURED',
          error_message: 'Heygen client not configured',
        },
      };
    }

    // Extract data - ONLY use trainer's exact prompt, topic, description, skills
    // ⚠️ CRITICAL: Do NOT modify, rewrite, or generate any text
    // ⚠️ CRITICAL: Use ONLY data from frontend + DB, unmodified
    
    let trainerPrompt = '';
    let topic = '';
    let description = '';
    let skills = [];

    if (typeof prompt === 'object' && prompt !== null) {
      // If prompt is object, extract trainer's exact prompt
      trainerPrompt = prompt.prompt || prompt.trainerPrompt || prompt.trainerRequestText || '';
      topic = prompt.topic || prompt.topicName || prompt.lessonTopic || '';
      description = prompt.description || prompt.topicDescription || prompt.lessonDescription || '';
      skills = Array.isArray(prompt.skills) ? prompt.skills : 
               (Array.isArray(prompt.skillsList) ? prompt.skillsList : []);
    } else if (typeof prompt === 'string') {
      // If prompt is string, use it as trainer's exact text
      trainerPrompt = prompt.trim();
      topic = config.topicName || config.lessonTopic || '';
      description = config.topicDescription || config.lessonDescription || '';
      skills = Array.isArray(config.skills) ? config.skills : 
               (Array.isArray(config.skillsList) ? config.skillsList : []);
    }

    // Merge config (only if not already set)
    // For VideoToLesson flow, use transcriptText as fallback if no prompt is provided
    trainerPrompt = trainerPrompt || config.trainerPrompt || config.trainerRequestText || config.transcriptText || '';
    topic = topic || config.topicName || config.lessonTopic || '';
    description = description || config.topicDescription || config.lessonDescription || '';
    skills = skills.length > 0 ? skills : 
             (Array.isArray(config.skills) ? config.skills : 
              (Array.isArray(config.skillsList) ? config.skillsList : []));

    // Validate trainer prompt is provided
    if (!trainerPrompt || trainerPrompt.trim().length === 0) {
      return {
        videoUrl: null,
        videoId: null,
        language: config.language || 'en',
        duration_seconds: 0,
        status: 'failed',
        fallback: false,
        error: 'Trainer prompt is required',
        errorCode: 'NO_PROMPT',
        reason: 'Avatar video requires trainer prompt. Please provide prompt text.',
      };
    }

    // Generate video using Heygen - send ONLY minimal required fields
    // ⚠️ CRITICAL: trainerPrompt is trainer's exact text, unmodified

    // Extract language from config (required for voice selection)
    const language = config.language || 'en';

    // Log language to ensure it's passed correctly
    console.log('[AIGenerationService] generateAvatarVideo language check:', {
      configLanguage: config.language,
      extractedLanguage: language,
      hasConfig: !!config,
      configKeys: config ? Object.keys(config) : [],
    });

    try {
      // HeyGen v2 API requires: title, prompt, language (for voice_id selection)
      const videoResult = await this.heygenClient.generateVideo({
        title: 'EduCore Lesson',
        prompt: trainerPrompt.trim(), // Trainer's exact text, unmodified
        language: language, // Required for voice_id selection
        duration: 15, // Used for response only, not sent to API
      });

      // Handle skipped status - avatar unavailable, but continue normally
      if (videoResult.status === 'skipped') {
        console.log('[AIGenerationService] Avatar video generation skipped:', videoResult.reason || 'forced_avatar_unavailable');
        return {
          videoUrl: null,
          videoId: null,
          language: config.language || 'en',
          duration_seconds: 0,
          status: 'skipped',
          fallback: false,
          reason: videoResult.reason || 'forced_avatar_unavailable',
          metadata: {
            generation_status: 'skipped',
            reason: videoResult.reason || 'forced_avatar_unavailable',
          },
        };
      }

      // Handle failed status - return partial success instead of throwing
      if (videoResult.status === 'failed') {
        return {
          videoUrl: null,
          videoId: videoResult.videoId || null,
          language: config.language || 'en',
          duration_seconds: 0,
          status: 'failed',
          fallback: false,
          error: videoResult.error || videoResult.errorMessage || 'Avatar video generation failed',
          errorCode: videoResult.errorCode || 'UNKNOWN_ERROR',
          reason: videoResult.reason || 'Avatar video generation failed',
          metadata: {
            generation_status: 'failed',
            error_code: videoResult.errorCode || 'UNKNOWN_ERROR',
            error_message: videoResult.errorMessage || 'Avatar video generation failed',
            error_detail: videoResult.errorDetail || null,
          },
        };
      }

      // Extract storage metadata if available
      const storageMetadata = videoResult.storageMetadata || null;

      return {
        videoUrl: videoResult.videoUrl,
        videoId: videoResult.videoId,
        language: config.language || 'en',
        duration_seconds: videoResult.duration || 15,
        status: videoResult.status || 'completed',
        fallback: !!videoResult.fallback,
        // Include full storage metadata if available
        fileUrl: storageMetadata?.fileUrl || videoResult.videoUrl,
        fileName: storageMetadata?.fileName || null,
        fileSize: storageMetadata?.fileSize || null,
        fileType: storageMetadata?.fileType || 'video/mp4',
        storagePath: storageMetadata?.storagePath || null,
        uploadedAt: storageMetadata?.uploadedAt || null,
        // Include file integrity data if available
        sha256Hash: storageMetadata?.sha256Hash || null,
        digitalSignature: storageMetadata?.digitalSignature || null,
        metadata: {
          heygen_video_url: videoResult.heygenVideoUrl,
          generation_status: videoResult.status || 'completed',
          storage_fallback: !!videoResult.fallback,
          error: videoResult.error || null,
          // Include storage metadata in metadata object for backward compatibility
          storage_metadata: storageMetadata || null,
        },
      };
    } catch (error) {
      // Never throw - return failed status
      return {
        videoUrl: null,
        videoId: null,
        language: config.language || 'en',
        duration_seconds: 0,
        status: 'failed',
        fallback: false,
        error: error.message || 'Avatar video generation failed',
        errorCode: 'GENERATION_ERROR',
        reason: 'Avatar video generation failed',
        metadata: {
          generation_status: 'failed',
          error_code: 'GENERATION_ERROR',
          error_message: error.message || 'Avatar video generation failed',
        },
      };
    }
  }

  /**
   * Generate avatar video from presentation
   * New workflow: presentation → extract text → OpenAI explanation → HeyGen video with presentation background
   * 
   * @param {Object} params - Request parameters
   * @param {number} params.presentation_content_id - Content ID of the presentation
   * @param {string} params.custom_prompt - Optional custom prompt from trainer
   * @param {string} params.avatar_id - Optional custom avatar ID
   * @param {string} params.language - Language code
   * @returns {Promise<Object>} Video generation result
   */
  async generateAvatarVideoFromPresentation(params) {
    const { GenerateAvatarVideoFromPresentationUseCase } = await import('../use-cases/GenerateAvatarVideoFromPresentationUseCase.js');
    
    // This will be initialized by the controller with proper dependencies
    // For now, return a placeholder that indicates this needs to be called from controller
    throw new Error('generateAvatarVideoFromPresentation must be called from controller with proper dependencies');
  }
}

