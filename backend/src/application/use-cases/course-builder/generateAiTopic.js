import { AIGenerationService } from '../../../infrastructure/ai/AIGenerationService.js';
import { ContentDataCleaner } from '../../utils/ContentDataCleaner.js';
import { PromptSanitizer } from '../../../infrastructure/security/PromptSanitizer.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

const PROMPT_BUILDERS = {
  text: ({ lessonTopic, lessonDescription, language, skillsList }) => `You are an expert educational content creator in EduCore Content Studio.
🎯 Objective: Generate a concise, audio-friendly lesson text for ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Language: ${language}
- Skills Focus: ${skillsList}

⚠️ CRITICAL CONSTRAINTS:
1. **Maximum Length: 3500 characters** (to fit audio narration limit of 4000 chars)
2. **NO CODE EXAMPLES** - this is pure explanatory text (code has its own format)
3. **NO special symbols or formatting** - plain text only for audio conversion
4. **MUST cite official sources only** - MDN, ECMAScript Docs, Microsoft Docs, W3C, RFCs, Python Docs, Kubernetes Docs, etc.
5. **NO blog posts, tutorials, StackOverflow, or personal blogs**

📝 Structure (keep concise):
- **Introduction** (2-3 sentences): Brief overview of the topic
- **Explanation** (main content): Clear, simple explanation of key concepts with official source citations
- **Real-world Examples** (2-3 examples): Short, practical examples WITHOUT code
- **Summary** (2-3 sentences): Quick recap of main points

✅ Writing Style:
- Use simple, clear language suitable for audio narration
- Short paragraphs (2-4 sentences each)
- Avoid technical jargon unless necessary
- Write as if speaking to a student
- NO bullet points, NO code blocks, NO markdown
- Always cite official documentation sources

Output only pure, conversational text in ${language}.`,
  code: ({ lessonTopic, lessonDescription, language, skillsList }) => `You are a senior coding mentor in EduCore Content Studio.
🎯 Objective: Generate clean, production-ready code example related to ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Skills: ${skillsList}
- Language: ${language}

⚠️ CRITICAL REQUIREMENTS:
- Write clean, readable code WITHOUT excessive comments
- Code should be self-explanatory through clear naming and structure
- Only add comments if absolutely necessary for complex logic
- Focus on writing code, not explaining it with comments
- Learners need to see clean code they can read and understand
- The code itself is the teaching tool - make it readable
- MUST cite official sources only - MDN, ECMAScript Docs, Microsoft Docs, W3C, RFCs, Python Docs, Kubernetes Docs, etc.
- NO blog posts, tutorials, StackOverflow, or personal blogs

Generate ${language} code that demonstrates the concepts clearly.`,
};

/**
 * Step B.3 - AI Topic Generation
 * Generates a complete topic with 6 formats using existing templates.
 * All content MUST cite official, verifiable sources only.
 * 
 * @param {Object} skillCoverageItem - Object with skill and status: "missing", source: "ai"
 * @param {string} preferredLanguage - Preferred language code (e.g. "en", "he", "ar")
 * @returns {Promise<Object|null>} Complete topic object with all 6 content formats or null
 */
export async function generateAiTopic(skillCoverageItem, preferredLanguage) {
  // Validate input
  if (!skillCoverageItem || typeof skillCoverageItem !== 'object') {
    logger.warn('[UseCase] Invalid skillCoverageItem provided');
    return null;
  }

  if (skillCoverageItem.status !== 'missing' || skillCoverageItem.source !== 'ai') {
    logger.warn('[UseCase] skillCoverageItem must have status: "missing" and source: "ai"');
    return null;
  }

  if (!skillCoverageItem.skill || typeof skillCoverageItem.skill !== 'string') {
    logger.warn('[UseCase] skillCoverageItem.skill is required');
    return null;
  }

  if (!preferredLanguage || typeof preferredLanguage !== 'string') {
    logger.warn('[UseCase] preferredLanguage is required');
    return null;
  }

  const skillName = skillCoverageItem.skill;
  const language = preferredLanguage;

  // Initialize AI Generation Service
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const heygenApiKey = process.env.HEYGEN_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  // Support both SUPABASE_SERVICE_KEY and SUPABASE_SERVICE_ROLE_KEY for compatibility
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gammaApiKey = process.env.GAMMA_API; // Note: Environment variable is GAMMA_API, not GAMMA_API_KEY

  if (!openaiApiKey) {
    logger.error('[UseCase] OpenAI API key not configured');
    return null;
  }

  const aiGenerationService = new AIGenerationService({
    openaiApiKey,
    geminiApiKey,
    heygenApiKey,
    supabaseUrl,
    supabaseServiceKey,
    gammaApiKey,
  });

  // Build lesson data
  const lessonTopic = skillName;
  const lessonDescription = `A comprehensive lesson about ${skillName} covering essential concepts, best practices, and real-world applications.`;
  const skillsList = skillName;

  // Sanitize inputs
  const sanitizedInput = PromptSanitizer.sanitizeVariables({
    lessonTopic,
    lessonDescription,
    language,
    skillsList,
  });

  const promptVariables = {
    lessonTopic: sanitizedInput.lessonTopic || lessonTopic.trim(),
    lessonDescription: sanitizedInput.lessonDescription || lessonDescription.trim(),
    language: sanitizedInput.language || language.trim(),
    skillsList: sanitizedInput.skillsList || skillsList.trim(),
    skillsListArray: [skillName],
  };

  // Build prompts using existing templates
  const wrappedVariables = {
    lessonTopic: PromptSanitizer.wrapUserInput(promptVariables.lessonTopic),
    lessonDescription: PromptSanitizer.wrapUserInput(promptVariables.lessonDescription),
    language: PromptSanitizer.wrapUserInput(promptVariables.language),
    skillsList: PromptSanitizer.wrapUserInput(promptVariables.skillsList),
  };

  const textPrompt = PROMPT_BUILDERS.text(wrappedVariables);
  const codePrompt = PROMPT_BUILDERS.code(wrappedVariables);

  const securityInstruction = PromptSanitizer.getSystemInstruction();

  try {
    const contents = [];

    // 1. Generate text_audio (type 1)
    try {
      const textPromptWithSecurity = `${securityInstruction}\n\n${textPrompt}`;
      const text = await aiGenerationService.generateText(textPromptWithSecurity, {
        language: promptVariables.language,
        temperature: 0.7,
        max_tokens: 2000,
      });

      // Auto-generate audio for text
      let audioData = null;
      try {
        audioData = await aiGenerationService.generateAudio(text, {
          voice: 'alloy',
          model: 'tts-1',
          format: 'mp3',
          language: promptVariables.language,
        });
      } catch (audioError) {
        logger.warn('[UseCase] Failed to generate audio for text', { error: audioError.message });
      }

      const rawTextAudioData = {
        text,
        audioUrl: audioData?.audioUrl,
        audioFormat: audioData?.format,
        audioDuration: audioData?.duration,
        audioVoice: audioData?.voice,
      };

      contents.push({
        content_type: 'text_audio',
        content_data: ContentDataCleaner.cleanTextAudioData(rawTextAudioData),
      });
      logger.info('[UseCase] Text/audio generated successfully', { skill: skillName });
    } catch (error) {
      logger.warn('[UseCase] Failed to generate text_audio', { 
        error: error.message,
        stack: error.stack,
        skill: skillName 
      });
    }

    // 2. Generate code (type 2)
    try {
      const codePromptWithSecurity = `${securityInstruction}\n\n${codePrompt}`;
      const codeResult = await aiGenerationService.generateCode(codePromptWithSecurity, 'javascript', {
        include_comments: false,
      });

      const rawCodeData = {
        ...codeResult,
        metadata: {
          programming_language: 'javascript',
        },
      };

      contents.push({
        content_type: 'code',
        content_data: ContentDataCleaner.cleanCodeData(rawCodeData),
      });
      logger.info('[UseCase] Code example generated successfully', { skill: skillName });
    } catch (error) {
      logger.warn('[UseCase] Failed to generate code', { 
        error: error.message,
        stack: error.stack,
        skill: skillName 
      });
    }

    // 3. Generate presentation (type 3)
    try {
      const presentationContent = {
        topicName: promptVariables.lessonTopic,
        topicDescription: promptVariables.lessonDescription,
        skills: promptVariables.skillsListArray,
        trainerPrompt: null,
        transcriptText: null,
        audience: 'general',
        language: promptVariables.language,
      };

      const presentation = await aiGenerationService.generatePresentation(presentationContent, {
        language: promptVariables.language,
        audience: 'general',
      });

      const rawPresentationData = {
        format: presentation.format || 'gamma',
        presentationUrl: presentation.presentationUrl,
        storagePath: presentation.storagePath,
        metadata: {
          source: 'ai_generated',
          audience: 'general',
          language: promptVariables.language,
          generated_at: new Date().toISOString(),
          gamma_generation_id: presentation.metadata?.gamma_generation_id,
          gamma_raw_response: presentation.metadata?.gamma_raw_response,
        },
      };

      contents.push({
        content_type: 'presentation',
        content_data: ContentDataCleaner.cleanPresentationData(rawPresentationData),
      });
      logger.info('[UseCase] Presentation generated successfully', { skill: skillName });
    } catch (error) {
      logger.warn('[UseCase] Failed to generate presentation', { 
        error: error.message,
        stack: error.stack,
        skill: skillName 
      });
    }

    // 4. Generate mind_map (type 5)
    // NOTE: Audio is already included in text_audio (type 1), so we don't generate separate audio content
    try {
      const mindMapPrompt = promptVariables.lessonDescription || promptVariables.lessonTopic;
      const mindMap = await aiGenerationService.generateMindMap(mindMapPrompt, {
        topic_title: promptVariables.lessonTopic,
        skills: promptVariables.skillsListArray,
        trainer_prompt: promptVariables.lessonDescription,
        language: promptVariables.language,
        lessonDescription: promptVariables.lessonDescription,
      });

      contents.push({
        content_type: 'mind_map',
        content_data: ContentDataCleaner.cleanMindMapData(mindMap),
      });
      logger.info('[UseCase] Mind map generated successfully', { skill: skillName });
    } catch (error) {
      logger.warn('[UseCase] Failed to generate mind_map', { 
        error: error.message,
        stack: error.stack,
        skill: skillName 
      });
    }

    // 5. Generate avatar_video (type 6)
    try {
      // Send ONLY minimal required fields to HeyGen: prompt, topic, description, skills
      // ⚠️ CRITICAL: prompt is trainer's exact text, unmodified
      const trainerPrompt = `A comprehensive lesson about ${skillName}. Cover essential concepts, best practices, and real-world applications.`;

      const avatarResult = await aiGenerationService.generateAvatarVideo({
        prompt: trainerPrompt, // Trainer's exact text, unmodified
        topic: promptVariables.lessonTopic,
        description: promptVariables.lessonDescription,
        skills: promptVariables.skillsListArray,
      }, {
        language: promptVariables.language,
        topicName: promptVariables.lessonTopic,
      });

      if (avatarResult.status !== 'failed') {
        contents.push({
          content_type: 'avatar_video',
          content_data: ContentDataCleaner.cleanAvatarVideoData(avatarResult),
        });
        logger.info('[UseCase] Avatar video generated successfully', { skill: skillName });
      } else if (avatarResult.status === 'skipped') {
        logger.info('[UseCase] Avatar video generation skipped', {
          reason: avatarResult.reason || 'forced_avatar_unavailable',
          skill: skillName,
        });
      } else {
        logger.warn('[UseCase] Avatar video generation failed', {
          error: avatarResult.error,
          skill: skillName,
        });
      }
    } catch (error) {
      logger.warn('[UseCase] Failed to generate avatar_video', { 
        error: error.message,
        stack: error.stack,
        skill: skillName 
      });
    }

    // Build topic object
    const topicName = `${skillName} - Complete Guide`;
    const topicDescription = `A comprehensive lesson covering ${skillName} with all essential formats.`;

    logger.info('[UseCase] AI topic generation completed', {
      skill: skillName,
      language,
      contents_count: contents.length,
      content_types: contents.map(c => c.content_type),
    });

    return {
      topic_id: null,
      topic_name: topicName,
      topic_description: topicDescription,
      topic_language: language,
      template_id: null,
      format_order: [
        'text_audio',
        'code',
        'presentation',
        'mind_map',
        'avatar_video',
      ],
      contents,
      devlab_exercises: null,
    };
  } catch (error) {
    logger.error('[UseCase] Failed to generate AI topic', {
      error: error.message,
      skill: skillName,
      language,
    });
    return null;
  }
}

