import { Content } from '../../domain/entities/Content.js';
import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';
import { PromptSanitizer } from '../../infrastructure/security/PromptSanitizer.js';

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

📝 Structure (keep concise):
- **Introduction** (2-3 sentences): Brief overview of the topic
- **Explanation** (main content): Clear, simple explanation of key concepts
- **Real-world Examples** (2-3 examples): Short, practical examples WITHOUT code
- **Summary** (2-3 sentences): Quick recap of main points

✅ Writing Style:
- Use simple, clear language suitable for audio narration
- Short paragraphs (2-4 sentences each)
- Avoid technical jargon unless necessary
- Write as if speaking to a student
- NO bullet points, NO code blocks, NO markdown

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

Generate ${language} code that demonstrates the concepts clearly.`,
};

const SUPPORTED_TYPES = [1, 2, 3, 4, 5, 6]; // text, code, presentation, audio, mind_map, avatar_video

export class GenerateContentUseCase {
  constructor({
    aiGenerationService,
    contentRepository,
    promptTemplateService,
    qualityCheckService,
  }) {
    this.aiGenerationService = aiGenerationService;
    this.contentRepository = contentRepository;
    this.promptTemplateService = promptTemplateService;
    this.qualityCheckService = qualityCheckService;
  }

  buildPromptVariables({ lessonTopic, lessonDescription, language, skillsList, transcriptText, trainerRequestText }) {
    if (!lessonTopic || !lessonDescription || !language || !skillsList) {
      throw new Error('lessonTopic, lessonDescription, language, and skillsList are required');
    }

    // Sanitize all input variables to prevent prompt injection
    const sanitizedInput = PromptSanitizer.sanitizeVariables({
      lessonTopic,
      lessonDescription,
      language,
      skillsList,
      transcriptText,
      trainerRequestText,
    });

    // Rebuild skills array after sanitization
    const skillsAsArray = Array.isArray(sanitizedInput.skillsList)
      ? sanitizedInput.skillsList
      : (sanitizedInput.skillsList || String(skillsList))
          .split(',')
          .map(skill => skill.trim())
          .filter(Boolean);

    return {
      lessonTopic: sanitizedInput.lessonTopic || lessonTopic.trim(),
      lessonDescription: sanitizedInput.lessonDescription || lessonDescription.trim(),
      language: sanitizedInput.language || language.trim(),
      skillsList: skillsAsArray.join(', '),
      skillsListArray: sanitizedInput.skillsListArray || skillsAsArray,
      transcriptText: sanitizedInput.transcriptText || transcriptText || null,
      trainerRequestText: sanitizedInput.trainerRequestText || trainerRequestText || null,
    };
  }

  buildPrompt(contentTypeId, variables) {
    // Map content_type_id (integer) to prompt builder key (string)
    const typeMap = {
      1: 'text',
      2: 'code',
    };

    const builderKey = typeMap[contentTypeId];
    if (!builderKey || !PROMPT_BUILDERS[builderKey]) {
      throw new Error(`No prompt builder for content type: ${contentTypeId}`);
    }

    const builder = PROMPT_BUILDERS[builderKey];
    
    // Wrap user input variables in delimiters
    const wrappedVariables = {
      lessonTopic: PromptSanitizer.wrapUserInput(variables.lessonTopic || ''),
      lessonDescription: PromptSanitizer.wrapUserInput(variables.lessonDescription || ''),
      language: PromptSanitizer.wrapUserInput(variables.language || ''),
      skillsList: PromptSanitizer.wrapUserInput(variables.skillsList || ''),
    };
    
    // Build prompt with wrapped variables
    const basePrompt = builder(wrappedVariables);
    
    // Add security instruction at the beginning
    const securityInstruction = PromptSanitizer.getSystemInstruction();
    
    return `${securityInstruction}

${basePrompt}`;
  }

  async execute(generationRequest) {
    // Validate input
    if (!generationRequest.topic_id) {
      throw new Error('topic_id is required');
    }

    if (!generationRequest.content_type_id) {
      throw new Error('content_type_id is required');
    }

    if (!SUPPORTED_TYPES.includes(generationRequest.content_type_id)) {
      throw new Error(
        `AI generation not yet supported for type: ${generationRequest.content_type_id}`
      );
    }

    const promptVariables = this.buildPromptVariables(generationRequest);

    // Build prompt (template_id still supported if provided)
    let prompt = generationRequest.prompt;
    if (generationRequest.template_id) {
      const template = await this.promptTemplateService.getTemplate(
        generationRequest.template_id
      );
      
      // Sanitize template variables if provided
      const sanitizedTemplateVars = generationRequest.template_variables
        ? PromptSanitizer.sanitizeVariables(generationRequest.template_variables)
        : {};
      
      prompt = template.render({
        ...promptVariables,
        ...sanitizedTemplateVars,
      });
    }

    // For presentation (type 3), we don't need a prompt builder - we use Gamma API directly
    // For other types, build prompt if not provided
    if (!prompt && generationRequest.content_type_id !== 3) {
      prompt = this.buildPrompt(generationRequest.content_type_id, promptVariables);
    }

    // Sanitize the final prompt before sending to AI (only if prompt exists)
    // Note: User inputs are already wrapped in delimiters by buildPrompt()
    // For presentation (type 3), prompt is not needed - we use Gamma API directly
    if (prompt && generationRequest.content_type_id !== 3) {
      prompt = PromptSanitizer.sanitizePrompt(prompt);
    }

    // Generate content based on type
    let contentData = {};
    try {
      switch (generationRequest.content_type_id) {
        case 1: { // text
          const text = await this.aiGenerationService.generateText(prompt, {
            language: promptVariables.language,
          });
          
          // Auto-generate audio narration for the text
          let audioData = null;
          try {
            console.log('[AI Generation] Auto-generating audio for text content...');
            audioData = await this.aiGenerationService.generateAudio(text, {
              voice: 'alloy',
              model: 'tts-1',
              format: 'mp3',
              language: promptVariables.language,
            });
            console.log('[AI Generation] Audio generated successfully:', {
              hasAudio: !!audioData.audio,
              format: audioData.format,
              duration: audioData.duration,
            });
          } catch (audioError) {
            console.warn('[AI Generation] Failed to generate audio, continuing without it:', audioError.message);
          }
          
          // Build raw content data
          const rawContentData = {
            text,
            audioUrl: audioData?.audioUrl, // URL for playback
            audioFormat: audioData?.format,
            audioDuration: audioData?.duration,
            audioVoice: audioData?.voice,
          };
          
          // Clean content data: remove audioText (duplicate) and metadata (redundant)
          contentData = ContentDataCleaner.cleanTextAudioData(rawContentData);
          break;
        }

        case 2: { // code
          const language =
            generationRequest.programming_language || generationRequest.language || 'javascript';
          const codeResult = await this.aiGenerationService.generateCode(prompt, language, {
            include_comments: generationRequest.include_comments !== false,
          });
          
          // Build raw content data
          const rawContentData = {
            ...codeResult,
            metadata: {
              programming_language: language,
            },
          };
          
          // Clean content data: remove redundant topic/skills metadata
          contentData = ContentDataCleaner.cleanCodeData(rawContentData);
          break;
        }

        case 3: { // presentation
          // Build content object for Gamma API with VideoToLesson support
          const presentationContent = {
            topicName: promptVariables.lessonTopic,
            topicDescription: promptVariables.lessonDescription,
            skills: promptVariables.skillsListArray || [],
            trainerPrompt: promptVariables.trainerRequestText || null, // May be null for VideoToLesson
            transcriptText: promptVariables.transcriptText || null, // Fallback if trainerPrompt is null
            audience: generationRequest.audience || 'general',
            language: promptVariables.language,
          };

          const presentation = await this.aiGenerationService.generatePresentation(presentationContent, {
            language: promptVariables.language,
            audience: generationRequest.audience || 'general',
          });
          
          // Build raw content data
          const rawContentData = {
            ...presentation,
            presentationUrl: presentation.presentationUrl,
            storagePath: presentation.storagePath,
            metadata: {
              generated_at: presentation.metadata?.generated_at,
              presentationUrl: presentation.metadata?.presentationUrl,
              storagePath: presentation.metadata?.storagePath,
              language: presentation.metadata?.language,
              audience: presentation.metadata?.audience,
              source: presentation.metadata?.source,
              gamma_raw_response: presentation.metadata?.gamma_raw_response,
            },
          };
          
          // Clean content data: remove redundant topic/skills metadata
          contentData = ContentDataCleaner.cleanPresentationData(rawContentData);
          break;
        }

        case 4: { // audio
          const audio = await this.aiGenerationService.generateAudio(prompt, {
            voice: generationRequest.voice || 'alloy',
            model: generationRequest.tts_model || 'tts-1',
            format: generationRequest.audio_format || 'mp3',
            language: promptVariables.language,
          });
          
          // Build raw content data
          const rawContentData = {
            audioUrl: audio.audioUrl,
            audioFormat: audio.format,
            audioDuration: audio.duration,
            audioVoice: audio.voice,
          };
          
          // Clean content data: remove redundant metadata
          contentData = ContentDataCleaner.cleanAudioData(rawContentData);
          break;
        }

        case 5: { // mind_map
          const mindMap = await this.aiGenerationService.generateMindMap(prompt, {
            topic_title: promptVariables.lessonTopic,
            skills: promptVariables.skillsListArray,
            trainer_prompt: promptVariables.trainerRequestText || promptVariables.lessonDescription,
            language: promptVariables.language,
            lessonDescription: promptVariables.lessonDescription,
          });
          
          // Clean content data: remove redundant metadata
          contentData = ContentDataCleaner.cleanMindMapData(mindMap);
          break;
        }

        case 6: { // avatar_video
          // Build lesson data for avatar text generation (NO GPT)
          // Ensure skillsList is an array
          const skillsListArray = Array.isArray(promptVariables.skillsListArray)
            ? promptVariables.skillsListArray
            : Array.isArray(promptVariables.skillsList)
            ? promptVariables.skillsList
            : typeof promptVariables.skillsList === 'string'
            ? promptVariables.skillsList.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          
          const lessonData = {
            lessonTopic: promptVariables.lessonTopic,
            lessonDescription: promptVariables.lessonDescription || prompt, // Use prompt as description if available
            skillsList: skillsListArray, // Use array, not string
            transcriptText: promptVariables.transcriptText || null,
            trainerRequestText: promptVariables.trainerRequestText || null,
          };

          // Generate avatar video - NO GPT, uses buildAvatarText()
          const avatarResult = await this.aiGenerationService.generateAvatarVideo(lessonData, {
            language: promptVariables.language,
          });
          
          // Handle failed status - save as failed content instead of throwing
          if (avatarResult.status === 'failed') {
            // Create failed content data structure
            contentData = {
              status: 'failed',
              script: avatarResult.script || null,
              videoUrl: null,
              videoId: avatarResult.videoId || null,
              error: avatarResult.error || avatarResult.errorMessage || 'Avatar video generation failed',
              errorCode: avatarResult.errorCode || 'UNKNOWN_ERROR',
              reason: avatarResult.reason || 'Avatar video failed due to unsupported voice engine. Please choose another voice.',
              metadata: avatarResult.metadata || {},
            };
            // Don't break - continue to save failed content
          } else {
            // Clean content data: remove redundant topic/skills metadata
            contentData = ContentDataCleaner.cleanAvatarVideoData(avatarResult);
          }
          break;
        }

        default:
          throw new Error(
            `AI generation not yet supported for type: ${generationRequest.content_type_id}`
          );
      }
    } catch (error) {
      throw new Error(`AI generation failed: ${error.message}`);
    }

    // Ensure content_data is cleaned before creating entity
    const cleanedContentData = ContentDataCleaner.clean(contentData, generationRequest.content_type_id);

    // Create content entity (but don't save yet - trainer needs to approve)
    const content = new Content({
      topic_id: generationRequest.topic_id,
      content_type_id: generationRequest.content_type_id,
      content_data: cleanedContentData,
      generation_method_id: 'ai_assisted',
    });

    // Return the generated content for preview (not saved to DB yet)
    return content;
  }
}
