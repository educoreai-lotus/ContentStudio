import { Content } from '../../domain/entities/Content.js';
import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';

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
🎯 Objective: Generate a complete, working code example related to ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Skills: ${skillsList}
- Language: ${language}

Guidelines:
- Generate a code block in the most relevant programming language.
- Add inline comments explaining each section.
- Include one brief exercise or question for learners.
- Output: code + short natural explanation, no JSON.`,
  presentation: ({ lessonTopic, lessonDescription, language, skillsList }) => `You are an AI educational designer for EduCore Content Studio.
🎯 Objective: Generate presentation slide text based on ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Skills: ${skillsList}
- Language: ${language}

Guidelines:
- Create content for 8–10 slides.
- Each slide: title + 2–3 short bullet points.
- Keep tone educational and professional.
- Output plain slide text only (no JSON).` ,
  audio: ({ lessonTopic, lessonDescription, language, skillsList }) => `You are a professional voice narration assistant for EduCore Content Studio.
🎯 Objective: Create an engaging spoken narration script for ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Skills: ${skillsList}
- Language: ${language}

Guidelines:
- Use a natural spoken tone.
- Length: around 1–2 minutes.
- Output: clean narration text to convert with TTS (no JSON).` ,
  mind_map: ({ lessonTopic, lessonDescription, language, skillsList }) => `You are an AI mind map generator for EduCore Content Studio.
🎯 Objective: Create a visual mind map that represents the structure of ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Skills: ${skillsList}
- Language: ${language}

Guidelines:
- Identify 5–8 main nodes based on the description and skills.
- Show relationships clearly between ideas.
- Prefer generating a mind map image (visual output).
- If image rendering fails, output Mermaid syntax:
mindmap
  root((${lessonTopic}))
    A({subtopic1})
      A1({detail1})
      A2({detail2})
    B({subtopic2})` ,
  avatar_video: ({ lessonTopic, lessonDescription, language, skillsList }) => `You are a virtual presenter in EduCore Content Studio.
🎯 Objective: Create a short 15-second video introduction about ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Skills: ${skillsList}
- Language: ${language}

Guidelines:
- Use engaging, spoken tone in ${language}.
- Limit to ~100 words (≈15 seconds).
- End with a motivational or inspiring sentence.
- Output: text narration script (for Heygen API video generation).`
};

// Supported content type IDs (integers from database)
const SUPPORTED_TYPES = [1, 2, 3, 4, 5, 6]; // text, code, presentation, audio, mind_map, avatar_video

/**
 * Generate Content Use Case
 * Handles AI-assisted content generation
 */
export class GenerateContentUseCase {
  constructor({
    contentRepository,
    aiGenerationService,
    promptTemplateService,
    qualityCheckService,
  }) {
    this.contentRepository = contentRepository;
    this.aiGenerationService = aiGenerationService;
    this.promptTemplateService = promptTemplateService;
    this.qualityCheckService = qualityCheckService;
  }

  buildPromptVariables({ lessonTopic, lessonDescription, language, skillsList, transcriptText, trainerRequestText }) {
    if (!lessonTopic || !lessonDescription || !language || !skillsList) {
      throw new Error('lessonTopic, lessonDescription, language, and skillsList are required');
    }

    const skillsAsArray = Array.isArray(skillsList)
      ? skillsList
      : String(skillsList)
          .split(',')
          .map(skill => skill.trim())
          .filter(Boolean);

    return {
      lessonTopic: lessonTopic.trim(),
      lessonDescription: lessonDescription.trim(),
      language: language.trim(),
      skillsList: skillsAsArray.join(', '),
      skillsListArray: skillsAsArray,
      transcriptText: transcriptText || null,
      trainerRequestText: trainerRequestText || null,
    };
  }

  buildPrompt(contentTypeId, variables) {
    // Map content_type_id (integer) to prompt builder key (string)
    const typeMap = {
      1: 'text',
      2: 'code',
      3: 'presentation',
      4: 'audio',
      5: 'mind_map',
      6: 'avatar_video',
    };
    
    const typeKey = typeMap[contentTypeId];
    if (!typeKey) {
      throw new Error(`Unknown content type ID: ${contentTypeId}`);
    }
    
    const builder = PROMPT_BUILDERS[typeKey];
    if (!builder) {
      throw new Error(`Prompt builder not defined for content type: ${typeKey}`);
    }
    return builder(variables);
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
      prompt = template.render({
        ...promptVariables,
        ...(generationRequest.template_variables || {}),
      });
    }

    if (!prompt) {
      prompt = this.buildPrompt(generationRequest.content_type_id, promptVariables);
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
          const presentation = await this.aiGenerationService.generatePresentation(prompt, {
            slide_count: generationRequest.slide_count || 10,
            style: generationRequest.presentation_style || 'educational',
            lessonTopic: promptVariables.lessonTopic,
            lessonDescription: promptVariables.lessonDescription,
            language: promptVariables.language,
            skillsList: promptVariables.skillsListArray,
          });
          
          // Build raw content data
          const rawContentData = {
            ...presentation,
            googleSlidesUrl: presentation.googleSlidesUrl,
            metadata: {
              style: presentation.metadata?.style,
              generated_at: presentation.metadata?.generated_at,
              googleSlidesUrl: presentation.googleSlidesUrl,
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
            language: promptVariables.language,
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



