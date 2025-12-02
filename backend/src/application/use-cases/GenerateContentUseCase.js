import { Content } from '../../domain/entities/Content.js';
import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';
import { PromptSanitizer } from '../../infrastructure/security/PromptSanitizer.js';

const PROMPT_BUILDERS = {
  text: ({ lessonTopic, lessonDescription, language, skillsList }) => `You are an expert educational content creator in EduCore Content Studio.
Objective: Generate a concise, audio-friendly lesson text for ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Language: ${language}
- Skills Focus: ${skillsList}

 CRITICAL CONSTRAINTS:
1. **Maximum Length: 3500 characters** (to fit audio narration limit of 4000 chars)
2. **NO CODE EXAMPLES** - this is pure explanatory text (code has its own format)
3. **NO special symbols or formatting** - plain text only for audio conversion

Structure (keep concise):
- **Introduction** (2-3 sentences): Brief overview of the topic
- **Explanation** (main content): Clear, simple explanation of key concepts
- **Real-world Examples** (2-3 examples): Short, practical examples WITHOUT code
- **Summary** (2-3 sentences): Quick recap of main points

Writing Style:
- Use simple, clear language suitable for audio narration
- Short paragraphs (2-4 sentences each)
- Avoid technical jargon unless necessary
- Write as if speaking to a student
- NO bullet points, NO code blocks, NO markdown

Output only pure, conversational text in ${language}.`,
  code: ({ lessonTopic, lessonDescription, language, skillsList }) => `You are a senior coding mentor in EduCore Content Studio.
 Objective: Generate clean, production-ready code example related to ${lessonTopic}.

Lesson Context:
- Topic: ${lessonTopic}
- Description: ${lessonDescription}
- Skills: ${skillsList}
- Language: ${language}

 CRITICAL REQUIREMENTS:
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
    topicRepository,
  }) {
    this.aiGenerationService = aiGenerationService;
    this.contentRepository = contentRepository;
    this.promptTemplateService = promptTemplateService;
    this.qualityCheckService = qualityCheckService;
    this.topicRepository = topicRepository;
  }

  buildPromptVariables({ lessonTopic, lessonDescription, language, skillsList, transcriptText, trainerRequestText }, contentTypeId) {
    // For avatar video (type 6), only lessonTopic is required (or transcriptText/trainerRequestText)
    // For other types, require all standard fields
    if (contentTypeId !== 6) {
      if (!lessonTopic || !lessonDescription || !language || !skillsList) {
        throw new Error('lessonTopic, lessonDescription, language, and skillsList are required');
      }
    } else {
      // For avatar video, at least one of these must be provided
      if (!lessonTopic && !transcriptText && !trainerRequestText) {
        throw new Error('At least one of lessonTopic, transcriptText, or trainerRequestText is required for avatar video');
      }
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

    const promptVariables = this.buildPromptVariables(generationRequest, generationRequest.content_type_id);

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
    // For audio (type 4), we use transcript (lessonDescription) as prompt directly
    // For mind_map (type 5), we use transcript as prompt directly (like presentation)
    // For avatar_video (type 6), we don't need a prompt builder - we use buildAvatarText() and HeyGen directly
    // For other types (text, code), build prompt if not provided
    if (!prompt && generationRequest.content_type_id !== 3 && generationRequest.content_type_id !== 4 && generationRequest.content_type_id !== 5 && generationRequest.content_type_id !== 6) {
      prompt = this.buildPrompt(generationRequest.content_type_id, promptVariables);
    }

    // For audio (type 4), use transcript (lessonDescription) as prompt if not provided
    if (!prompt && generationRequest.content_type_id === 4) {
      prompt = promptVariables.lessonDescription || promptVariables.transcriptText || '';
    }

    // For mind_map (type 5), use transcript (lessonDescription) as prompt if not provided
    if (!prompt && generationRequest.content_type_id === 5) {
      prompt = promptVariables.lessonDescription || promptVariables.transcriptText || '';
    }

    // Sanitize the final prompt before sending to AI (only if prompt exists)
    // Note: User inputs are already wrapped in delimiters by buildPrompt()
    // For presentation (type 3), prompt is not needed - we use Gamma API directly
    // For avatar_video (type 6), prompt is not needed - we use buildAvatarText() and HeyGen directly
    // For audio (type 4) and mind_map (type 5), sanitize the transcript prompt
    if (prompt && generationRequest.content_type_id !== 3 && generationRequest.content_type_id !== 6) {
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
            // Include file integrity data if available
            sha256Hash: audioData?.sha256Hash || null,
            digitalSignature: audioData?.digitalSignature || null,
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
          
          // NOTE: AI-generated code does NOT need quality check here
          // AI already generates quality content, so we trust it
          // Quality check is only performed for manual content in CreateContentUseCase
          
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

          // IMPORTANT: Quality check for presentations created from manual input (trainerPrompt)
          // If presentation is created from video transcription, the transcript was already checked in VideoToLessonController
          // Only check if presentation is created from trainerPrompt (manual input)
          if (this.qualityCheckService && this.topicRepository && presentationContent.trainerPrompt) {
            try {
              console.log('[GenerateContentUseCase] Starting quality check for presentation from manual input', {
                topic_id: generationRequest.topic_id,
                hasTrainerPrompt: !!presentationContent.trainerPrompt,
                trainerPromptLength: presentationContent.trainerPrompt?.length || 0,
              });

              // Fetch topic and course data for quality check
              const topic = await this.topicRepository.findById(generationRequest.topic_id);
              if (topic) {
                let courseName = null;
                if (topic.course_id && this.courseRepository) {
                  const { RepositoryFactory } = await import('../../infrastructure/database/repositories/RepositoryFactory.js');
                  const courseRepository = await RepositoryFactory.getCourseRepository();
                  const course = await courseRepository.findById(topic.course_id);
                  courseName = course?.course_name || null;
                }

                // Extract skills from topic
                const skills = Array.isArray(topic.skills) ? topic.skills : (topic.skills ? [topic.skills] : []);

                // Perform quality check evaluation on trainerPrompt
                const evaluationResult = await this.qualityCheckService.evaluateContentWithOpenAI({
                  courseName: courseName || 'General Course',
                  topicName: topic.topic_name || promptVariables.lessonTopic || 'Untitled Topic',
                  skills: skills,
                  contentText: presentationContent.trainerPrompt,
                  statusMessages: null, // No status messages for API call
                });

                console.log('[GenerateContentUseCase] Quality check completed for presentation', {
                  topic_id: generationRequest.topic_id,
                  relevance_score: evaluationResult.relevance_score || evaluationResult.relevance,
                  originality_score: evaluationResult.originality_score,
                });

                // Validate scores - reject if relevance < 60 or originality < 75
                const relevanceScore = evaluationResult.relevance_score || evaluationResult.relevance || 100;
                if (relevanceScore < 60) {
                  const errorMsg = `Presentation content failed quality check: Content is not relevant to the lesson topic (Relevance: ${relevanceScore}/100). ${evaluationResult.feedback_summary || 'The content does not match the lesson topic. Please ensure your content is directly related to the topic.'}`;
                  console.warn('[GenerateContentUseCase] Quality check failed - relevance too low', {
                    topic_id: generationRequest.topic_id,
                    relevance_score: relevanceScore,
                  });
                  throw new Error(errorMsg);
                }

                if (evaluationResult.originality_score < 75) {
                  const errorMsg = `Presentation content failed quality check: Content appears to be copied or plagiarized (Originality: ${evaluationResult.originality_score}/100). ${evaluationResult.feedback_summary || 'Please ensure your content is original and not copied from other sources.'}`;
                  console.warn('[GenerateContentUseCase] Quality check failed - originality too low', {
                    topic_id: generationRequest.topic_id,
                    originality_score: evaluationResult.originality_score,
                  });
                  throw new Error(errorMsg);
                }

                console.log('[GenerateContentUseCase] Quality check passed for presentation, proceeding with generation', {
                  topic_id: generationRequest.topic_id,
                  relevance_score: relevanceScore,
                  originality_score: evaluationResult.originality_score,
                });
              } else {
                console.warn('[GenerateContentUseCase] Topic not found for quality check, skipping', {
                  topic_id: generationRequest.topic_id,
                });
              }
            } catch (qualityCheckError) {
              console.error('[GenerateContentUseCase] Quality check failed for presentation', {
                topic_id: generationRequest.topic_id,
                error: qualityCheckError.message,
              });
              // Re-throw to prevent presentation generation
              throw qualityCheckError;
            }
          } else {
            console.log('[GenerateContentUseCase] Quality check skipped for presentation', {
              hasQualityCheckService: !!this.qualityCheckService,
              hasTopicRepository: !!this.topicRepository,
              hasTrainerPrompt: !!presentationContent.trainerPrompt,
              hasTranscriptText: !!presentationContent.transcriptText,
              reason: !presentationContent.trainerPrompt ? 'No trainerPrompt (using transcriptText which was already checked)' : 'Quality check service or topic repository not available',
            });
          }

          const presentation = await this.aiGenerationService.generatePresentation(presentationContent, {
            language: promptVariables.language,
            audience: generationRequest.audience || 'general',
          });
          
          // Build raw content data - MANDATORY structure for presentations
          // presentationUrl MUST be from Supabase Storage, never gammaUrl
          if (presentation.presentationUrl && presentation.presentationUrl.includes('gamma.app')) {
            throw new Error('Invalid presentation URL: External Gamma URL detected. All presentations must be stored in Supabase Storage.');
          }

          if (!presentation.storagePath) {
            throw new Error('Missing storage path. All presentations must be stored in Supabase Storage.');
          }

          const rawContentData = {
            format: presentation.format || 'gamma',
            presentationUrl: presentation.presentationUrl, // Supabase Storage URL only
            storagePath: presentation.storagePath, // Required storage path
            metadata: {
              source: presentation.metadata?.source || (promptVariables.trainerRequestText ? 'prompt' : 'video_transcription'),
              audience: presentation.metadata?.audience || generationRequest.audience || 'general',
              language: presentation.metadata?.language || promptVariables.language,
              generated_at: presentation.metadata?.generated_at || new Date().toISOString(),
              gamma_generation_id: presentation.metadata?.gamma_generation_id,
              gamma_raw_response: presentation.metadata?.gamma_raw_response,
              // DO NOT include presentationUrl or storagePath in metadata - they're top-level fields
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
          // Ensure prompt is not empty - use transcript (lessonDescription) as fallback
          const mindMapPrompt = prompt && prompt.trim().length > 0
            ? prompt
            : promptVariables.lessonDescription || promptVariables.transcriptText || '';
          
          if (!mindMapPrompt || mindMapPrompt.trim().length === 0) {
            throw new Error('Mind map generation requires a prompt or transcript text');
          }

          const mindMap = await this.aiGenerationService.generateMindMap(mindMapPrompt, {
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
          // ⚠️ CRITICAL: Avatar video generation MUST NOT use OpenAI for script generation.
          // The narration must come ONLY from HeyGen using our formatted prompt.
          // 
          // ❌ FORBIDDEN: Do NOT call OpenAI to generate "video script" or "narration text"
          // ✅ REQUIRED: Format our prompt (topic, description, skills, trainer_prompt/transcript) 
          //              and send directly to HeyGen
          //
          // Build lesson data for avatar text generation (NO GPT)
          // Ensure skillsList is an array
          const skillsListArray = Array.isArray(promptVariables.skillsListArray)
            ? promptVariables.skillsListArray
            : Array.isArray(promptVariables.skillsList)
            ? promptVariables.skillsList
            : typeof promptVariables.skillsList === 'string'
            ? promptVariables.skillsList.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          
          // ⚠️ CRITICAL: For avatar video, pass ONLY the trainer's prompt
          // Do NOT modify, rewrite, or add narration text
          // The prompt comes from: generationRequest.prompt (from frontend body.prompt)
          // For VideoToLesson flow, use transcriptText as fallback if no prompt is provided
          const lessonData = {
            prompt: generationRequest.prompt || promptVariables.trainerRequestText || promptVariables.transcriptText || '', // Trainer's exact prompt or transcript
            lessonTopic: promptVariables.lessonTopic, // For fallback only
          };

          // Generate avatar video - NO GPT, uses buildAvatarText()
          // ⚠️ This calls buildAvatarText() which returns the trainer's prompt as-is.
          // No OpenAI script generation occurs in this flow.
          const avatarResult = await this.aiGenerationService.generateAvatarVideo(lessonData, {
            language: promptVariables.language,
            topicName: promptVariables.lessonTopic, // For logging only
          });
          
          // Handle skipped status differently from failed
          if (avatarResult.status === 'skipped') {
            contentData = {
              script: avatarResult.script || null,
              videoUrl: null,
              videoId: null,
              status: 'skipped',
              reason: avatarResult.reason || 'forced_avatar_unavailable',
              // No error fields for skipped status
            };
            // Don't break - continue to save skipped content (not failed)
          } else if (avatarResult.status === 'failed') {
            // Create failed content data structure (without status - removed for consistency)
            const failedMetadata = {};
            if (avatarResult.metadata?.heygen_video_url) {
              failedMetadata.heygen_video_url = avatarResult.metadata.heygen_video_url;
            }
            
            contentData = {
              script: avatarResult.script || null,
              videoUrl: null,
              videoId: avatarResult.videoId || null,
              error: avatarResult.error || avatarResult.errorMessage || 'Avatar video generation failed',
              errorCode: avatarResult.errorCode || 'UNKNOWN_ERROR',
              reason: avatarResult.reason || 'Avatar video failed due to unsupported voice engine. Please choose another voice.',
              // Keep only heygen_video_url in metadata (remove generation_status, storage_fallback)
              metadata: Object.keys(failedMetadata).length > 0 ? failedMetadata : undefined,
            };
            // Don't break - continue to save failed content
          } else {
            // Clean content data: remove redundant topic/skills metadata, status, generation_status, storage_fallback
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
