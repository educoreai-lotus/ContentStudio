import { AIGenerationService as IAIGenerationService } from '../../domain/services/AIGenerationService.js';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { TTSClient } from '../external-apis/openai/TTSClient.js';
import { GeminiClient } from '../external-apis/gemini/GeminiClient.js';
import { HeygenClient } from './HeygenClient.js';
import { SupabaseStorageClient } from '../storage/SupabaseStorageClient.js';
import { GammaClient } from '../gamma/GammaClient.js';
import { PromptSanitizer } from '../security/PromptSanitizer.js';
import { logger } from '../logging/Logger.js';

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
    this.storageClient = (supabaseUrl && supabaseServiceKey)
      ? new SupabaseStorageClient({ supabaseUrl, supabaseServiceKey })
      : null;
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

    // Sanitize and wrap user prompt to prevent injection
    const sanitizedPrompt = PromptSanitizer.sanitizePrompt(prompt);
    const wrappedPrompt = PromptSanitizer.wrapUserInput(sanitizedPrompt);
    
    const systemPrompt = this.buildSystemPrompt('text', config);
    const fullPrompt = this.buildTextPrompt(wrappedPrompt, config);

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
    // Sanitize input to prevent injection
    const sanitizedTopicText = PromptSanitizer.sanitizePrompt(topicText);
    
    // Try Gemini first, fallback to OpenAI if it fails
    if (this.geminiClient) {
      try {
        // Sanitize config before passing to Gemini
        const sanitizedConfig = {
          ...config,
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

Your task is to convert the following user inputs into a clear, professional conceptual MindMap:

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

You are an expert educational Knowledge-Graph MindMap Generator. Create radial, non-hierarchical mind maps with semantic connections.`,
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

  buildSystemPrompt(contentType, config) {
    const style = config.style || 'educational';
    const difficulty = config.difficulty || 'intermediate';

    const basePrompt = `You are an expert educational content creator. Create ${style} content suitable for ${difficulty} level learners. 
The content should be clear, well-structured, and engaging.`;

    // Add security instruction for handling wrapped user input
    const securityInstruction = PromptSanitizer.getSystemInstruction();

    return `${securityInstruction}

${basePrompt}`;
  }

  buildTextPrompt(prompt, config) {
    const style = config.style || 'educational';
    const sections = config.sections || [];

    let fullPrompt = prompt;

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

    // If text is too long, summarize it first
    let textToConvert = text;
    if (text.length > 4000) {
      // Summarize long text for audio
      const summaryPrompt = `Summarize the following text in a clear, concise way suitable for audio narration (max 4000 characters):\n\n${text}`;
      textToConvert = await this.openaiClient.generateText(summaryPrompt, {
        systemPrompt: 'You are a content summarizer. Create clear, concise summaries suitable for audio narration.',
        temperature: 0.5,
        max_tokens: 2000,
      });
    }

    const audioData = await this.ttsClient.generateAudioWithMetadata(textToConvert, {
      voice: config.voice || 'alloy',
      model: config.model || 'tts-1',
      format: config.format || 'mp3',
      speed: config.speed || 1.0,
    });

    // Upload audio to Supabase Storage
    let audioUrl = null;
    if (this.storageClient && audioData.audio) {
      try {
        const fileName = `audio_${Date.now()}.${audioData.format}`;
        const uploadResult = await this.storageClient.uploadFile(
          audioData.audio,
          fileName,
          `audio/${audioData.format}`
        );
        audioUrl = uploadResult.url;
        console.log('[AIGenerationService] Audio uploaded to storage:', audioUrl);
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
   * Build avatar text from lesson data - NO GPT, pure function
   * 
   * ⚠️ CRITICAL: This function MUST NEVER call OpenAI or any LLM.
   * The avatar narration must come ONLY from HeyGen using our formatted prompt.
   * 
   * This is a pure function that formats lesson data into text for HeyGen.
   * HeyGen will generate the narration directly from this text.
   * 
   * ❌ FORBIDDEN: Do NOT call OpenAI to generate:
   * - "video script"
   * - "narration text"
   * - "summary of the topic to speak"
   * - Any text intended to be spoken by the avatar
   * 
   * ✅ REQUIRED: Use ONLY our internal prompt components:
   * - topic_name
   * - lesson_description
   * - trainer_prompt (or transcript_text)
   * - skills
   * 
   * @param {Object} lessonData - Lesson data
   * @param {string} lessonData.lessonTopic - Topic name
   * @param {string} lessonData.lessonDescription - Topic description
   * @param {Array} lessonData.skillsList - Skills list
   * @param {string} lessonData.trainerRequestText - Optional trainer request
   * @param {string} lessonData.transcriptText - Optional transcript text
   * @returns {string} Formatted text for avatar video (sent directly to HeyGen)
   */
  buildAvatarText(lessonData = {}) {
    // ⚠️ VALIDATION: This function MUST be pure - no OpenAI calls allowed
    // This is a pure function by design - no side effects, no external calls
    // Validation is enforced via tests (AvatarVideoValidation.test.js)

    // Sanitize all input to prevent injection
    const sanitizedData = PromptSanitizer.sanitizeVariables({
      lessonTopic: lessonData.lessonTopic || '',
      lessonDescription: lessonData.lessonDescription || '',
      skillsList: lessonData.skillsList || [],
      trainerRequestText: lessonData.trainerRequestText || '',
      transcriptText: lessonData.transcriptText || '',
    });

    const {
      lessonTopic = '',
      lessonDescription = '',
      skillsList = [],
      trainerRequestText = '',
      transcriptText = '',
    } = sanitizedData;

    // Ensure skillsList is an array
    let skillsArray = [];
    if (Array.isArray(skillsList)) {
      skillsArray = skillsList;
    } else if (typeof skillsList === 'string') {
      skillsArray = skillsList.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Build text from available data
    const parts = [];

    if (lessonTopic) {
      parts.push(`Today we'll learn about ${lessonTopic}.`);
    }

    if (lessonDescription) {
      parts.push(lessonDescription);
    }

    if (transcriptText && transcriptText.trim()) {
      // Use transcript text directly (first 500 chars to keep it concise)
      const transcriptExcerpt = transcriptText.trim().substring(0, 500);
      parts.push(transcriptExcerpt);
    } else if (trainerRequestText && trainerRequestText.trim()) {
      parts.push(trainerRequestText.trim());
    }

    if (skillsArray && skillsArray.length > 0) {
      const skillsText = skillsArray.join(', ');
      parts.push(`Key skills covered: ${skillsText}.`);
    }

    // Join all parts with spaces
    const finalText = parts.filter(p => p && p.trim()).join(' ').trim();

    // Fallback if no text available
    if (!finalText || finalText.length === 0) {
      return lessonTopic 
        ? `Welcome to the lesson about ${lessonTopic}.`
        : 'Welcome to this lesson.';
    }

    return finalText;
  }

  /**
   * Generate avatar video - NO GPT, uses buildAvatarText()
   * 
   * ⚠️ CRITICAL: This function MUST NEVER call OpenAI or any LLM for script generation.
   * The avatar narration must come ONLY from HeyGen using our formatted prompt.
   * 
   * ❌ FORBIDDEN: Do NOT:
   * - Request OpenAI to generate "video script" or "narration text"
   * - Forward OpenAI text output to HeyGen
   * - Use any LLM-generated text for avatar narration
   * 
   * ✅ REQUIRED: 
   * - Use buildAvatarText() to format our prompt (topic, description, skills, trainer_prompt/transcript)
   * - Send formatted text directly to HeyGen API
   * - Let HeyGen generate the narration independently
   * 
   * @param {string|Object} prompt - Prompt or lesson data object (NOT OpenAI-generated script)
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Avatar video result
   */
  async generateAvatarVideo(prompt, config = {}) {
    // ⚠️ VALIDATION: Ensure no OpenAI script generation occurs
    // This function MUST NOT call OpenAI to generate narration text
    // Validation is enforced via tests (AvatarVideoValidation.test.js)
    // Code structure prevents OpenAI calls - pure function + direct HeyGen call

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

    // Extract lesson data from prompt (can be object or string)
    let lessonData = {};
    if (typeof prompt === 'object' && prompt !== null) {
      lessonData = prompt;
    } else if (typeof prompt === 'string') {
      // If prompt is a string, try to parse it or use as description
      lessonData = {
        lessonDescription: prompt,
        ...config,
      };
    }

    // Merge config into lessonData
    lessonData = {
      ...lessonData,
      lessonTopic: config.lessonTopic || lessonData.lessonTopic,
      lessonDescription: config.lessonDescription || lessonData.lessonDescription,
      skillsList: config.skillsList || lessonData.skillsList || [],
      trainerRequestText: config.trainerRequestText || lessonData.trainerRequestText,
      transcriptText: config.transcriptText || lessonData.transcriptText,
    };

    // Build avatar text - NO GPT, pure function
    // ⚠️ CRITICAL: This MUST be a pure function that formats our prompt data.
    // Do NOT call OpenAI here. HeyGen will generate narration from this text.
    const avatarText = this.buildAvatarText(lessonData);

    // ⚠️ VALIDATION: Ensure text is from our prompt, not OpenAI-generated
    // Check that text contains expected prompt components (topic, skills, description)
    // This is a lightweight validation to detect if OpenAI text was accidentally passed
    if (avatarText && avatarText.length > 0) {
      const hasExpectedComponents = 
        (lessonData.lessonTopic && avatarText.includes(lessonData.lessonTopic)) ||
        (lessonData.lessonDescription && avatarText.includes(lessonData.lessonDescription)) ||
        (lessonData.trainerRequestText && avatarText.includes(lessonData.trainerRequestText)) ||
        (lessonData.transcriptText && avatarText.includes(lessonData.transcriptText?.substring(0, 50))) ||
        avatarText.includes('Welcome to'); // Fallback text

      if (!hasExpectedComponents && process.env.NODE_ENV !== 'production') {
        console.warn('[AIGenerationService] ⚠️ Avatar text validation: Text may not contain expected prompt components');
      }
    }

    if (!avatarText || avatarText.trim().length === 0) {
      return {
        script: '',
        videoUrl: null,
        videoId: null,
        language: config.language || 'en',
        duration_seconds: 0,
        status: 'failed',
        fallback: false,
        error: 'No text available for avatar video',
        errorCode: 'NO_TEXT',
        reason: 'Avatar video requires lesson content. Please provide lesson topic or description.',
        metadata: {
          generation_status: 'failed',
          error_code: 'NO_TEXT',
          error_message: 'No text available for avatar video',
        },
      };
    }

    // Generate video using Heygen - NO GPT, direct call
    // ⚠️ CRITICAL: avatarText is our formatted prompt, NOT OpenAI-generated script.
    // HeyGen receives our prompt and generates narration independently.
    // Do NOT inject OpenAI text here.
    // Validation: Tests ensure OpenAI is never called (see AvatarVideoValidation.test.js)

    try {
      const videoResult = await this.heygenClient.generateVideo(avatarText, {
        language: config.language || 'en',
        avatarId: config.avatarId,
        voiceId: config.voiceId,
      });

      // Handle failed status - return partial success instead of throwing
      if (videoResult.status === 'failed') {
        return {
          script: avatarText,
          videoUrl: null,
          videoId: videoResult.videoId || null,
          language: config.language || 'en',
          duration_seconds: 0,
          status: 'failed',
          fallback: false,
          error: videoResult.error || videoResult.errorMessage || 'Avatar video generation failed',
          errorCode: videoResult.errorCode || 'UNKNOWN_ERROR',
          reason: videoResult.reason || 'Avatar video failed due to unsupported voice engine. Please choose another voice.',
          metadata: {
            generation_status: 'failed',
            error_code: videoResult.errorCode || 'UNKNOWN_ERROR',
            error_message: videoResult.errorMessage || 'Avatar video generation failed',
            error_detail: videoResult.errorDetail || null,
          },
        };
      }

      return {
        script: avatarText,
        videoUrl: videoResult.videoUrl,
        videoId: videoResult.videoId,
        language: config.language || 'en',
        duration_seconds: videoResult.duration || 15,
        status: videoResult.status || 'completed',
        fallback: !!videoResult.fallback,
        metadata: {
          heygen_video_url: videoResult.heygenVideoUrl,
          generation_status: videoResult.status || 'completed',
          storage_fallback: !!videoResult.fallback,
          error: videoResult.error || null,
        },
      };
    } catch (error) {
      // Never throw - return failed status
      return {
        script: avatarText,
        videoUrl: null,
        videoId: null,
        language: config.language || 'en',
        duration_seconds: 0,
        status: 'failed',
        fallback: false,
        error: error.message || 'Avatar video generation failed',
        errorCode: 'GENERATION_ERROR',
        reason: 'Avatar video failed due to an error. Please try again or choose another voice.',
        metadata: {
          generation_status: 'failed',
          error_code: 'GENERATION_ERROR',
          error_message: error.message || 'Avatar video generation failed',
        },
      };
    }
  }
}

