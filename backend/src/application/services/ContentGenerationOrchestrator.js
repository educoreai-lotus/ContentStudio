import { logger } from '../../infrastructure/logging/Logger.js';

/**
 * Content Generation Orchestrator
 * Orchestrates automatic generation of all lesson formats from a transcript
 */
export class ContentGenerationOrchestrator {
  constructor({
    aiGenerationService,
    openaiClient,
    contentRepository,
    topicRepository,
  }) {
    this.aiGenerationService = aiGenerationService;
    this.openaiClient = openaiClient;
    this.contentRepository = contentRepository;
    this.topicRepository = topicRepository;
  }

  /**
   * Generate all lesson formats from transcript
   * @param {string} transcript - Video transcript text
   * @param {Object} options - Options
   * @param {number} options.topic_id - Topic ID (optional, will create topic if not provided)
   * @param {string} options.trainer_id - Trainer ID
   * @param {string} options.topic_name - Topic name (optional, will extract from transcript if not provided)
   * @returns {Promise<Object>} Generated content with all formats
   */
  async generateAll(transcript, options = {}) {
    logger.info('[ContentGenerationOrchestrator] Starting content generation from transcript', {
      transcriptLength: transcript.length,
      options,
    });

    // Step 1: Normalize transcript
    const normalizedTranscript = this.normalizeTranscript(transcript);
    logger.info('[ContentGenerationOrchestrator] Transcript normalized', {
      originalLength: transcript.length,
      normalizedLength: normalizedTranscript.length,
    });

    // Step 2: Detect language
    const language = await this.detectLanguage(normalizedTranscript);
    logger.info('[ContentGenerationOrchestrator] Language detected', { language });

    // Step 3: Extract metadata from transcript
    const metadata = await this.extractMetadata(normalizedTranscript, options);
    logger.info('[ContentGenerationOrchestrator] Metadata extracted', {
      title: metadata.title,
      difficulty: metadata.difficulty,
      skillsCount: metadata.skills?.length || 0,
    });

    // Step 4: Create or get topic
    let topicId = options.topic_id;
    if (!topicId) {
      // Validate trainer_id before creating topic
      if (!options.trainer_id) {
        throw new Error('Trainer ID is required to create a topic. Please provide trainer_id in options.');
      }
      
      const topic = await this.createTopic(metadata, options);
      topicId = topic.topic_id;
      logger.info('[ContentGenerationOrchestrator] Topic created', { topicId });
    }

    // Step 5: Generate all formats using transcript as master prompt
    const generatedContent = await this.generateAllFormats(
      normalizedTranscript,
      metadata,
      topicId,
      language,
      options
    );

    logger.info('[ContentGenerationOrchestrator] All formats generated', {
      topicId,
      formatsGenerated: Object.keys(generatedContent).length,
    });

    return {
      topic_id: topicId,
      transcript: {
        text: normalizedTranscript,
        language,
        length: normalizedTranscript.length,
      },
      metadata,
      content_formats: generatedContent,
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
   * Extract metadata from transcript
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
${transcript}

Extract the following information:
1. Lesson title (clear, concise, 5-10 words)
2. Main subtopics (3-7 key topics covered)
3. Key concepts (important terms/ideas)
4. Keywords (relevant search terms)
5. Difficulty level (beginner, intermediate, advanced)
6. Skills list (micro-skills and nano-skills that learners will gain)

Return ONLY valid JSON in this format:
{
  "title": "Lesson Title Here",
  "subtopics": ["Subtopic 1", "Subtopic 2", ...],
  "concepts": ["Concept 1", "Concept 2", ...],
  "keywords": ["keyword1", "keyword2", ...],
  "difficulty": "beginner|intermediate|advanced",
  "skills": ["skill1", "skill2", ...],
  "summary": "Brief summary (2-3 sentences)"
}`;

      const response = await this.openaiClient.generateText(prompt, {
        systemPrompt: 'You are an expert educational content analyst. Extract accurate metadata from educational transcripts. Return only valid JSON.',
        temperature: 0.3,
        max_tokens: 1000,
      });

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const metadata = JSON.parse(jsonMatch[0]);
        
        // Merge with options (options take precedence)
        return {
          title: options.topic_name || metadata.title || 'Untitled Lesson',
          subtopics: metadata.subtopics || [],
          concepts: metadata.concepts || [],
          keywords: metadata.keywords || [],
          difficulty: metadata.difficulty || 'intermediate',
          skills: metadata.skills || [],
          summary: metadata.summary || transcript.substring(0, 200) + '...',
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
      subtopics: [],
      concepts: words.slice(0, 5),
      keywords: words,
      difficulty: 'intermediate',
      skills: [],
      summary: transcript.substring(0, 200) + '...',
    };
  }

  /**
   * Create topic from metadata
   * @param {Object} metadata - Extracted metadata
   * @param {Object} options - Options
   * @returns {Promise<Object>} Created topic
   */
  async createTopic(metadata, options = {}) {
    if (!this.topicRepository) {
      throw new Error('Topic repository not available');
    }

    const { Topic } = await import('../../domain/entities/Topic.js');

    const topic = new Topic({
      topic_name: metadata.title,
      trainer_id: options.trainer_id,
      description: metadata.summary || metadata.title,
      course_id: options.course_id || null,
      status: 'draft',
      skills: metadata.skills || [],
    });

    return await this.topicRepository.create(topic);
  }

  /**
   * Generate all content formats from transcript
   * @param {string} transcript - Normalized transcript (MASTER PROMPT)
   * @param {Object} metadata - Extracted metadata
   * @param {number} topicId - Topic ID
   * @param {string} language - Detected language
   * @param {Object} options - Options
   * @returns {Promise<Object>} Generated content formats
   */
  async generateAllFormats(transcript, metadata, topicId, language, options = {}) {
    const results = {};
    const { Content } = await import('../../domain/entities/Content.js');

    // Use transcript as MASTER PROMPT for all formats
    const masterPrompt = transcript;

    // 1. Generate Text format
    try {
      logger.info('[ContentGenerationOrchestrator] Generating text format...');
      const textPrompt = this.buildTextPrompt(masterPrompt, metadata);
      const textContent = await this.aiGenerationService.generateText(textPrompt, {
        temperature: 0.7,
        max_tokens: 3000,
        language,
      });

      const textContentEntity = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'text',
          content_data: {
            text: textContent,
            sections: this.splitIntoSections(textContent),
            metadata,
          },
          generation_method_id: 'video_to_lesson',
        })
      );

      results.text = {
        content_id: textContentEntity.content_id,
        format: 'text',
        generated: true,
      };

      logger.info('[ContentGenerationOrchestrator] Text format generated', {
        content_id: textContentEntity.content_id,
      });
    } catch (error) {
      logger.error('[ContentGenerationOrchestrator] Failed to generate text format', {
        error: error.message,
      });
      results.text = { error: error.message };
    }

    // 2. Generate Audio format
    try {
      logger.info('[ContentGenerationOrchestrator] Generating audio format...');
      const audioResult = await this.aiGenerationService.generateAudio(masterPrompt, {
        voice: options.voice || 'alloy',
        language,
      });

      const audioContentEntity = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'audio',
          content_data: {
            audio_url: audioResult.audioUrl,
            text: audioResult.text,
            duration: audioResult.duration,
            voice: audioResult.voice,
            metadata: audioResult.metadata,
          },
          generation_method_id: 'video_to_lesson',
        })
      );

      results.audio = {
        content_id: audioContentEntity.content_id,
        format: 'audio',
        audio_url: audioResult.audioUrl,
        generated: true,
      };

      logger.info('[ContentGenerationOrchestrator] Audio format generated', {
        content_id: audioContentEntity.content_id,
      });
    } catch (error) {
      logger.error('[ContentGenerationOrchestrator] Failed to generate audio format', {
        error: error.message,
      });
      results.audio = { error: error.message };
    }

    // 3. Generate Slides/Presentation format
    try {
      logger.info('[ContentGenerationOrchestrator] Generating presentation format...');
      const slidesPrompt = this.buildSlidesPrompt(masterPrompt, metadata);
      const slidesResult = await this.aiGenerationService.generatePresentation(slidesPrompt, {
        slide_count: 10,
        style: 'educational',
        language,
        lessonTopic: metadata.title,
      });

      const slidesContentEntity = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'presentation',
          content_data: slidesResult,
          generation_method_id: 'video_to_lesson',
        })
      );

      results.presentation = {
        content_id: slidesContentEntity.content_id,
        format: 'presentation',
        slide_count: slidesResult.slide_count,
        google_slides_url: slidesResult.googleSlidesUrl,
        generated: true,
      };

      logger.info('[ContentGenerationOrchestrator] Presentation format generated', {
        content_id: slidesContentEntity.content_id,
      });
    } catch (error) {
      logger.error('[ContentGenerationOrchestrator] Failed to generate presentation format', {
        error: error.message,
      });
      results.presentation = { error: error.message };
    }

    // 4. Generate Mind Map format
    try {
      logger.info('[ContentGenerationOrchestrator] Generating mind map format...');
      const mindMapPrompt = this.buildMindMapPrompt(masterPrompt, metadata);
      const mindMapResult = await this.aiGenerationService.generateMindMap(mindMapPrompt, {
        language,
      });

      const mindMapContentEntity = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'mind_map',
          content_data: mindMapResult,
          generation_method_id: 'video_to_lesson',
        })
      );

      results.mind_map = {
        content_id: mindMapContentEntity.content_id,
        format: 'mind_map',
        generated: true,
      };

      logger.info('[ContentGenerationOrchestrator] Mind map format generated', {
        content_id: mindMapContentEntity.content_id,
      });
    } catch (error) {
      logger.error('[ContentGenerationOrchestrator] Failed to generate mind map format', {
        error: error.message,
      });
      results.mind_map = { error: error.message };
    }

    // 5. Generate Code format (if applicable)
    try {
      logger.info('[ContentGenerationOrchestrator] Generating code format...');
      const codePrompt = this.buildCodePrompt(masterPrompt, metadata);
      const codeResult = await this.aiGenerationService.generateCode(codePrompt, 'javascript', {
        language,
        include_explanation: true,
      });

      const codeContentEntity = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'code',
          content_data: codeResult,
          generation_method_id: 'video_to_lesson',
        })
      );

      results.code = {
        content_id: codeContentEntity.content_id,
        format: 'code',
        language: codeResult.language,
        generated: true,
      };

      logger.info('[ContentGenerationOrchestrator] Code format generated', {
        content_id: codeContentEntity.content_id,
      });
    } catch (error) {
      logger.warn('[ContentGenerationOrchestrator] Code format not applicable or failed', {
        error: error.message,
      });
      results.code = { skipped: true, reason: 'Not applicable or generation failed' };
    }

    // 6. Generate Avatar Video format (optional, Post-MVP)
    try {
      logger.info('[ContentGenerationOrchestrator] Generating avatar video format...');
      const avatarPrompt = this.buildAvatarPrompt(masterPrompt, metadata);
      const avatarResult = await this.aiGenerationService.generateAvatarScript(avatarPrompt, {
        language,
        max_tokens: 400,
      });

      const avatarContentEntity = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'avatar_video',
          content_data: avatarResult,
          generation_method_id: 'video_to_lesson',
        })
      );

      results.avatar_video = {
        content_id: avatarContentEntity.content_id,
        format: 'avatar_video',
        video_url: avatarResult.videoUrl,
        generated: true,
      };

      logger.info('[ContentGenerationOrchestrator] Avatar video format generated', {
        content_id: avatarContentEntity.content_id,
      });
    } catch (error) {
      logger.warn('[ContentGenerationOrchestrator] Avatar video format skipped', {
        error: error.message,
      });
      results.avatar_video = { skipped: true, reason: 'Not available or generation failed' };
    }

    return results;
  }

  /**
   * Build prompt for text format
   * @param {string} masterPrompt - Transcript (master prompt)
   * @param {Object} metadata - Extracted metadata
   * @returns {string} Text generation prompt
   */
  buildTextPrompt(masterPrompt, metadata) {
    return `Transform the following video transcript into a well-structured educational lesson.

Title: ${metadata.title}
Difficulty: ${metadata.difficulty}

Video Transcript:
${masterPrompt}

Create a comprehensive lesson with:
- Clear introduction
- Well-organized sections matching the subtopics
- Key concepts explained in detail
- Examples and practical applications
- Summary section

Format as markdown with proper headings, bullet points, and explanations.`;
  }

  /**
   * Build prompt for slides format
   * @param {string} masterPrompt - Transcript (master prompt)
   * @param {Object} metadata - Extracted metadata
   * @returns {string} Slides generation prompt
   */
  buildSlidesPrompt(masterPrompt, metadata) {
    return `Create an educational presentation based on this video transcript.

Title: ${metadata.title}
Subtopics: ${metadata.subtopics.join(', ')}

Video Transcript:
${masterPrompt}

Generate 10-12 slides covering the main topics, key concepts, and important points from the transcript.
Each slide should be clear, concise, and suitable for educational purposes.`;
  }

  /**
   * Build prompt for mind map format
   * @param {string} masterPrompt - Transcript (master prompt)
   * @param {Object} metadata - Extracted metadata
   * @returns {string} Mind map generation prompt
   */
  buildMindMapPrompt(masterPrompt, metadata) {
    return `Create a mind map structure from this video transcript.

Title: ${metadata.title}
Key Concepts: ${metadata.concepts.join(', ')}

Video Transcript:
${masterPrompt}

Create a hierarchical mind map showing:
- Main topic (center)
- Major subtopics (first level)
- Key concepts and details (second level)
- Related ideas and examples (third level)

Structure the relationships between concepts clearly.`;
  }

  /**
   * Build prompt for code format
   * @param {string} masterPrompt - Transcript (master prompt)
   * @param {Object} metadata - Extracted metadata
   * @returns {string} Code generation prompt
   */
  buildCodePrompt(masterPrompt, metadata) {
    return `Based on this video transcript, generate relevant code examples that demonstrate the concepts discussed.

Title: ${metadata.title}
Key Concepts: ${metadata.concepts.join(', ')}

Video Transcript:
${masterPrompt}

Generate practical code examples in JavaScript that:
- Illustrate the main concepts
- Follow best practices
- Include comments explaining the logic
- Provide working examples

If the transcript is not programming-related, skip code generation.`;
  }

  /**
   * Build prompt for avatar video format
   * @param {string} masterPrompt - Transcript (master prompt)
   * @param {Object} metadata - Extracted metadata
   * @returns {string} Avatar video generation prompt
   */
  buildAvatarPrompt(masterPrompt, metadata) {
    // Create a short introduction script based on transcript
    return `Create a short 30-45 second video introduction script based on this lesson.

Title: ${metadata.title}

Video Transcript:
${masterPrompt.substring(0, 1000)}...

Generate a concise, engaging introduction script that:
- Introduces the lesson topic
- Highlights key learning objectives
- Engages the viewer
- Is suitable for a virtual presenter avatar`;
  }

  /**
   * Split text into sections
   * @param {string} text - Text content
   * @returns {Array<Object>} Sections array
   */
  splitIntoSections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = { heading: 'Introduction', content: '' };

    for (const line of lines) {
      if (line.match(/^#{1,3}\s+.+$/)) {
        // New heading found
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: line.replace(/^#{1,3}\s+/, ''),
          content: '',
        };
      } else {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections.length > 0 ? sections : [{ heading: 'Main Content', content: text }];
  }
}
