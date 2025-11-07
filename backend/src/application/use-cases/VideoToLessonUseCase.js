import { Topic } from '../../domain/entities/Topic.js';
import { Content } from '../../domain/entities/Content.js';

/**
 * Video-to-Lesson Transformation Use Case
 * Converts uploaded video into structured lesson with all formats
 */
export class VideoToLessonUseCase {
  constructor({
    whisperClient,
    openaiClient,
    geminiClient,
    ttsClient,
    topicRepository,
    contentRepository,
    aiGenerationService,
  }) {
    this.whisperClient = whisperClient;
    this.openaiClient = openaiClient;
    this.geminiClient = geminiClient;
    this.ttsClient = ttsClient;
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
    this.aiGenerationService = aiGenerationService;
  }

  /**
   * Transform video to lesson
   * @param {Object} videoData - Video data
   * @param {string|Buffer} videoData.file - Video file path or buffer
   * @param {string} videoData.trainer_id - Trainer ID
   * @param {string} videoData.topic_name - Topic name
   * @param {string} videoData.description - Topic description (optional)
   * @param {number} videoData.course_id - Course ID (optional, for stand-alone lesson)
   * @returns {Promise<Object>} Created lesson with all content formats
   */
  async execute(videoData) {
    const { file, trainer_id, topic_name, description, course_id } = videoData;

    // Step 1: Transcribe video with Whisper
    console.log('Step 1: Transcribing video...');
    const transcription = await this.whisperClient.transcribeWithMetadata(file, {
      language: 'auto', // Auto-detect language
      response_format: 'verbose_json',
    });

    // Step 2: Summarize and structure lesson text with GPT-4o-mini
    console.log('Step 2: Structuring lesson content...');
    const structuredContent = await this.structureLessonContent(
      transcription.text,
      topic_name
    );

    // Step 3: Create topic/lesson
    console.log('Step 3: Creating topic...');
    const topic = new Topic({
      topic_name,
      trainer_id,
      description: description || structuredContent.summary,
      course_id: course_id || null,
      status: 'draft',
      skills: structuredContent.skills || [],
    });

    const createdTopic = await this.topicRepository.create(topic);

    // Step 4: Generate all 6 formats automatically
    console.log('Step 4: Generating content formats...');
    const contentFormats = await this.generateAllFormats(
      createdTopic.topic_id,
      structuredContent,
      transcription
    );

    return {
      topic: createdTopic,
      transcription: {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        word_count: transcription.metadata.word_count,
      },
      content_formats: contentFormats,
      structured_content: structuredContent,
    };
  }

  /**
   * Structure lesson content from transcript
   * @param {string} transcript - Video transcript
   * @param {string} topicName - Topic name
   * @returns {Promise<Object>} Structured content
   */
  async structureLessonContent(transcript, topicName) {
    const prompt = `Analyze the following video transcript and create a structured lesson:

Topic: ${topicName}
Transcript:
${transcript}

Create a structured lesson with:
1. Summary (2-3 sentences)
2. Key learning objectives (3-5 bullet points)
3. Main content sections (with headings and explanations)
4. Key concepts and definitions
5. Related skills (micro-skills and nano-skills)

Format as JSON:
{
  "summary": "...",
  "learning_objectives": ["...", "..."],
  "sections": [
    {"heading": "...", "content": "..."}
  ],
  "key_concepts": [{"term": "...", "definition": "..."}],
  "skills": ["skill1", "skill2"]
}`;

    try {
      const response = await this.openaiClient.generateText(prompt, {
        systemPrompt: 'You are an expert educational content creator. Structure educational content clearly and logically.',
        temperature: 0.7,
        max_tokens: 3000,
      });

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: Create simple structure
      return {
        summary: transcript.substring(0, 200) + '...',
        learning_objectives: ['Understand the main concepts', 'Apply the knowledge'],
        sections: [{ heading: 'Main Content', content: transcript }],
        key_concepts: [],
        skills: [],
      };
    } catch (error) {
      throw new Error(`Failed to structure lesson content: ${error.message}`);
    }
  }

  /**
   * Generate all 6 content formats
   * @param {number} topicId - Topic ID
   * @param {Object} structuredContent - Structured content
   * @param {Object} transcription - Transcription data
   * @returns {Promise<Array>} Array of created content items
   */
  async generateAllFormats(topicId, structuredContent, transcription) {
    const formats = [];
    const baseContent = this.buildBaseContent(structuredContent);

    // 1. Text format
    try {
      const textContent = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'text',
          content_data: {
            text: baseContent,
            sections: structuredContent.sections,
            learning_objectives: structuredContent.learning_objectives,
          },
          generation_method_id: 'video_to_lesson',
        })
      );
      formats.push({ type: 'text', content_id: textContent.content_id });
    } catch (error) {
      console.error('Failed to create text content:', error);
    }

    // 2. Code format (if applicable)
    try {
      const codePrompt = `Based on this lesson content, generate relevant code examples:\n\n${baseContent}`;
      const codeResult = await this.aiGenerationService.generate({
        prompt: codePrompt,
        content_type: 'code',
        config: { language: 'javascript' },
      });

      const codeContent = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'code',
          content_data: codeResult,
          generation_method_id: 'video_to_lesson',
        })
      );
      formats.push({ type: 'code', content_id: codeContent.content_id });
    } catch (error) {
      console.error('Failed to create code content:', error);
    }

    // 3. Presentation format
    try {
      const presentationResult = await this.aiGenerationService.generate({
        prompt: baseContent,
        content_type: 'presentation',
        config: { slide_count: 10, style: 'educational' },
      });

      const presentationContent = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'presentation',
          content_data: presentationResult,
          generation_method_id: 'video_to_lesson',
        })
      );
      formats.push({ type: 'presentation', content_id: presentationContent.content_id });
    } catch (error) {
      console.error('Failed to create presentation content:', error);
    }

    // 4. Audio format (from same transcript)
    try {
      const audioResult = await this.aiGenerationService.generate({
        prompt: transcription.text,
        content_type: 'audio',
        config: { voice: 'alloy', format: 'mp3' },
      });

      const audioContent = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'audio',
          content_data: {
            audio_url: null, // Would be stored in Supabase
            duration: audioResult.duration,
            voice: audioResult.voice,
            text: audioResult.text,
          },
          generation_method_id: 'video_to_lesson',
        })
      );
      formats.push({ type: 'audio', content_id: audioContent.content_id });
    } catch (error) {
      console.error('Failed to create audio content:', error);
    }

    // 5. Mind Map format
    try {
      const mindMapResult = await this.aiGenerationService.generate({
        prompt: baseContent,
        content_type: 'mind_map',
        config: {},
      });

      const mindMapContent = await this.contentRepository.create(
        new Content({
          topic_id: topicId,
          content_type_id: 'mind_map',
          content_data: mindMapResult,
          generation_method_id: 'video_to_lesson',
        })
      );
      formats.push({ type: 'mind_map', content_id: mindMapContent.content_id });
    } catch (error) {
      console.error('Failed to create mind map content:', error);
    }

    // 6. Avatar Video (optional, Post-MVP)
    // Would use Heygen API here

    return formats;
  }

  /**
   * Build base content text from structured content
   * @param {Object} structuredContent - Structured content
   * @returns {string} Base content text
   */
  buildBaseContent(structuredContent) {
    let content = structuredContent.summary || '';
    content += '\n\n## Learning Objectives\n';
    structuredContent.learning_objectives?.forEach(obj => {
      content += `- ${obj}\n`;
    });
    content += '\n\n## Content\n';
    structuredContent.sections?.forEach(section => {
      content += `### ${section.heading}\n${section.content}\n\n`;
    });
    return content;
  }
}



