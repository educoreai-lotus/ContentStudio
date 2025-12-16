import { loadDatabaseSchema, generateSQLQueryUsingSharedPrompt } from '../../../infrastructure/ai/SharedAIQueryBuilder.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';
import { AIGenerationService } from '../../../infrastructure/ai/AIGenerationService.js';
import { ContentDataCleaner } from '../../utils/ContentDataCleaner.js';
import { PromptSanitizer } from '../../../infrastructure/security/PromptSanitizer.js';

/**
 * Fill Course Builder Service request
 * Processes incoming request from course-builder-service
 * 
 * Rules:
 * 1. If trainer_id exists and is valid, search for existing course matching:
 *    - Same trainer_id
 *    - Matching skills_raw_data
 *    - permissions contains company_id
 * 2. If found, reuse it (no AI generation)
 * 3. If not found or no trainer_id, trigger Full AI Generation:
 *    - Each step in learning_modules.steps becomes one Topic
 *    - Generate all 6 formats per topic
 * 
 * @param {Object} requestData - Full request object (new structure: { success, action, data, ... })
 * @returns {Promise<Object>} Same request object with response.courses populated
 */
export async function fillCourseBuilderService(requestData) {
  try {
    // Validate request structure
    if (!requestData || typeof requestData !== 'object') {
      throw new Error('requestData must be an object');
    }

    // Support both new structure (data directly) and old structure (payload.data or payload)
    // New structure: { success, action, data: { ... } }
    // Old structure: { requester_service, payload: { ... }, response: { ... } }
    let dataSource;
    if (requestData.data && typeof requestData.data === 'object') {
      // New structure: data is directly in requestData
      dataSource = requestData.data;
    } else if (requestData.payload?.data && typeof requestData.payload.data === 'object') {
      // Old structure with nested data: payload.data
      dataSource = requestData.payload.data;
    } else if (requestData.payload && typeof requestData.payload === 'object') {
      // Old structure: payload itself is the data
      dataSource = requestData.payload;
    } else {
      throw new Error('requestData.data or requestData.payload is required');
    }

    // Initialize response structure if not present
    if (!requestData.response || typeof requestData.response !== 'object') {
      requestData.response = {};
    }

    // Support both response.courses (plural) and response.course (singular)
    if (!Array.isArray(requestData.response.courses)) {
      requestData.response.courses = [];
    }
    if (!Array.isArray(requestData.response.course)) {
      requestData.response.course = [];
    }

    // Read from structure: company_id from data.company_id (or payload.company_id)
    const company_id = dataSource.company_id || null;

    // Read learners_data array
    const learners_data = Array.isArray(dataSource.learners_data) 
      ? dataSource.learners_data 
      : [];

    if (learners_data.length === 0) {
      logger.warn('[fillCourseBuilderService] No learners_data provided');
      requestData.response.courses = [];
      requestData.response.course = [];
      return requestData;
    }

    // Process each learner (Content Studio operates at single-learner level)
    const allCourses = [];

    for (const learner of learners_data) {
      // Read from new structure: language from learner.preferred_language
      const language = learner.preferred_language || 'en';

      // Read from new structure: career_learning_paths from learner.career_learning_paths
      const career_learning_paths = Array.isArray(learner.career_learning_paths)
        ? learner.career_learning_paths
        : [];

      if (career_learning_paths.length === 0) {
        logger.warn('[fillCourseBuilderService] No career_learning_paths for learner', {
          user_id: learner.user_id,
        });
        continue;
      }

      // Extract skills_raw_data from first career_learning_path (if present)
      // Read from new structure: skills_raw_data from career_learning_path.skills_raw_data
      const firstPath = career_learning_paths[0];
      const skills_raw_data = firstPath?.skills_raw_data || null;

      // trainer_id is not in new structure, so it will be null
      const trainer_id = null;

      // Step 1: Trainer ID Validation
      const hasValidTrainerId = trainer_id && 
                                trainer_id !== null && 
                                trainer_id !== '' && 
                                typeof trainer_id === 'string';

      // Step 2: Course Reuse Logic (if trainer_id exists)
      // Note: Since trainer_id is null in new structure, this will skip to AI generation
      if (hasValidTrainerId) {
        const existingCourse = await searchExistingCourse({
          trainer_id,
          company_id,
          skills_raw_data,
          language: language || 'en',
        });

        if (existingCourse) {
          // Reuse existing archived course (read-only, no modifications)
          // CRITICAL: Archived courses are final and immutable
          // Do NOT activate, duplicate, regenerate, or modify anything
          allCourses.push(existingCourse);
          logger.info('[fillCourseBuilderService] Reused existing archived course', {
            trainer_id,
            course_id: existingCourse.course_id,
            status: 'archived',
            note: 'Course is read-only, no modifications allowed',
          });
          continue;
        }
      }

      // Step 3: Full AI Generation (fallback)
      logger.info('[fillCourseBuilderService] Triggering Full AI Generation', {
        hasTrainerId: hasValidTrainerId,
        careerPathsCount: career_learning_paths?.length || 0,
        user_id: learner.user_id,
      });

      const courses = await generateFullAICourses({
        career_learning_paths,
        trainer_id,
        company_id,
        language: language || 'en',
      });

      allCourses.push(...courses);
    }

    requestData.response.courses = allCourses;
    // Also populate response.course for backward compatibility
    requestData.response.course = allCourses;

    return requestData;
  } catch (error) {
    logger.error('[fillCourseBuilderService] Error processing request', {
      error: error.message,
      stack: error.stack,
    });
    // Return request with empty courses array on error
    if (!requestData.response) {
      requestData.response = {};
    }
    requestData.response.courses = [];
    requestData.response.course = [];
    return requestData;
  }
}

/**
 * Search for existing course matching criteria
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Object|null>} Existing course or null
 */
async function searchExistingCourse({ trainer_id, company_id, skills_raw_data, language }) {
  try {
    await db.ready;
    if (!db.isConnected()) {
      logger.warn('[fillCourseBuilderService] Database not connected, skipping search');
      return null;
    }

    // Extract skills from skills_raw_data
    // New structure: skills_raw_data is an object with competency keys, each containing an array of skills
    // Old structure (backward compatibility): skills_raw_data.competency_node is an array
    let skills = [];
    
    if (skills_raw_data) {
      if (Array.isArray(skills_raw_data.competency_node)) {
        // Old structure: competency_node is an array
        skills = skills_raw_data.competency_node.filter(s => s && s.trim() !== '');
      } else if (typeof skills_raw_data === 'object') {
        // New structure: skills_raw_data is an object with competency keys
        // Extract all skills from all competency keys
        for (const competencyKey in skills_raw_data) {
          if (Array.isArray(skills_raw_data[competencyKey])) {
            const competencySkills = skills_raw_data[competencyKey].filter(s => s && typeof s === 'string' && s.trim() !== '');
            skills.push(...competencySkills);
          }
        }
        // Remove duplicates
        skills = [...new Set(skills)];
      }
    }

    if (skills.length === 0) {
      logger.info('[fillCourseBuilderService] No skills provided, skipping search');
      return null;
    }

    // Load database schema
    const migrationContent = loadDatabaseSchema();

    // Business rules for course search
    // CRITICAL: Only archived courses are reusable. Active courses must be ignored.
    const businessRules = `RULE 1: trainer_courses.status MUST be 'archived' (NOT 'active')
RULE 2: trainer_courses.trainer_id must equal provided trainer_id
RULE 3: trainer_courses.language must equal provided language
RULE 4: trainer_courses.skills must contain ALL provided skills (skills @> ARRAY[...])
RULE 5: trainer_courses.permissions must contain company_id (permissions can be 'all' OR array containing company_id OR NULL)
RULE 6: If multiple matches exist, return the most recent (ORDER BY created_at DESC LIMIT 1)
RULE 7: Include all topics for the course (status != 'deleted')
RULE 8: For each topic, include all contents (status IS NULL OR status != 'deleted')
RULE 9: Join with content_types table to get type_name as content_type
RULE 10: Return flat result set with all course, topic, and content fields in each row
RULE 11: Use LEFT JOIN for topics and contents to include course even if no topics/contents exist
RULE 12: Do NOT filter by status='active' - ONLY 'archived' courses are valid for reuse`;

    const requestBody = {
      trainer_id,
      company_id,
      skills,
      language,
    };

    const task = `Generate a PostgreSQL SELECT query to find an existing ARCHIVED course where:
- trainer_id = '${trainer_id}'
- language = '${language}'
- skills contains all of: ${JSON.stringify(skills)}
- permissions contains '${company_id}' OR permissions = 'all' OR permissions IS NULL
- status = 'archived' (NOT 'active' - active courses must be ignored)
Include all topics and contents for the course.`;

    // Generate SQL query using shared prompt
    const sqlQuery = await generateSQLQueryUsingSharedPrompt({
      schema: migrationContent,
      requestBody,
      businessRules,
      task,
    });

    // Execute query
    const result = await db.query(sqlQuery);

    if (result.rows && result.rows.length > 0) {
      // Map result to course structure
      // CRITICAL: Archived courses are read-only - fetch and return as-is, no modifications
      const courseRow = result.rows[0];
      
      // Verify status is archived (safety check)
      if (courseRow.status !== 'archived') {
        logger.warn('[fillCourseBuilderService] Course found but status is not archived, ignoring', {
          course_id: courseRow.course_id,
          status: courseRow.status,
        });
        return null;
      }
      
      // Group topics and contents (read-only fetch, no modifications)
      const topicsMap = new Map();
      
      for (const row of result.rows) {
        if (row.topic_id && !topicsMap.has(row.topic_id)) {
          // Parse format_order if it's a string
          let formatOrder = row.format_order || [];
          if (typeof formatOrder === 'string') {
            try {
              formatOrder = JSON.parse(formatOrder);
            } catch {
              formatOrder = [];
            }
          }
          
          topicsMap.set(row.topic_id, {
            topic_id: row.topic_id,
            topic_name: row.topic_name || '',
            topic_description: row.description || '',
            topic_language: row.topic_language || language,
            template_id: row.template_id || null,
            format_order: formatOrder,
            contents: [],
            devlab_exercises: row.devlab_exercises || null,
          });
        }
        
        if (row.content_id && row.topic_id) {
          const topic = topicsMap.get(row.topic_id);
          if (topic) {
            let contentData = row.content_data;
            if (typeof contentData === 'string') {
              try {
                contentData = JSON.parse(contentData);
              } catch {
                contentData = {};
              }
            }
            
            topic.contents.push({
              content_id: row.content_id,
              content_type: row.content_type || 'unknown',
              content_data: contentData || {},
            });
          }
        }
      }

      // Return archived course structure (read-only, no modifications)
      return {
        course_id: courseRow.course_id,
        course_name: courseRow.course_name || '',
        course_description: courseRow.description || '',
        course_language: courseRow.course_language || language,
        trainer_id: courseRow.trainer_id,
        trainer_name: courseRow.trainer_name || '',
        topics: Array.from(topicsMap.values()),
      };
    }

    return null;
  } catch (error) {
    logger.error('[fillCourseBuilderService] Error searching for existing course', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Generate full AI courses from learning paths
 * @param {Object} params - Generation parameters
 * @returns {Promise<Array>} Array of courses
 */
async function generateFullAICourses({ career_learning_paths, trainer_id, company_id, language }) {
  if (!career_learning_paths || !Array.isArray(career_learning_paths) || career_learning_paths.length === 0) {
    logger.warn('[fillCourseBuilderService] No career_learning_paths provided');
    return [];
  }

  // Initialize AI Generation Service
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const heygenApiKey = process.env.HEYGEN_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gammaApiKey = process.env.GAMMA_API;

  if (!openaiApiKey) {
    logger.error('[fillCourseBuilderService] OpenAI API key not configured');
    return [];
  }

  const aiGenerationService = new AIGenerationService({
    openaiApiKey,
    geminiApiKey,
    heygenApiKey,
    supabaseUrl,
    supabaseServiceKey,
    gammaApiKey,
  });

  const courses = [];

  // Process each career learning path
  for (const path of career_learning_paths) {
    const courseName = path.competency_target_name || path.learning_path?.path_title || 'Untitled Course';
    const topics = [];

    // Each step becomes one Topic
    if (path.learning_path?.learning_modules && Array.isArray(path.learning_path.learning_modules)) {
      for (const module of path.learning_path.learning_modules) {
        if (module.steps && Array.isArray(module.steps)) {
          for (const step of module.steps) {
            const topic = await generateTopicForStep({
              step,
              language,
              aiGenerationService,
            });

            if (topic) {
              topics.push(topic);
            }
          }
        }
      }
    }

    if (topics.length > 0) {
      courses.push({
        course_id: null,
        course_name: courseName,
        course_description: `AI-generated course: ${courseName}`,
        course_language: language,
        trainer_id: trainer_id || null,
        trainer_name: '',
        topics,
      });
    }
  }

  return courses;
}

/**
 * Extract skills from step (parameter-driven, no inference)
 * Skills come ONLY from step.skills_covered if present
 * If not present, use step.title as minimal fallback
 * NO AI inference, NO global skill gaps, NO parameter expansion
 * @param {Object} step - Step object from request
 * @returns {Array<string>} Skills array (from step only)
 */
function extractSkillsFromStep(step) {
  // If step has explicit skills_covered, use them (from request)
  if (step.skills_covered && Array.isArray(step.skills_covered) && step.skills_covered.length > 0) {
    const filteredSkills = step.skills_covered.filter(s => s && typeof s === 'string' && s.trim() !== '');
    if (filteredSkills.length > 0) {
      logger.info('[fillCourseBuilderService] Using skills_covered from step', {
        stepTitle: step.title,
        skillsCount: filteredSkills.length,
      });
      return filteredSkills;
    }
  }

  // Minimal fallback: use step title as single skill (required for prompts)
  const fallbackSkill = step.title || 'General Learning';
  logger.info('[fillCourseBuilderService] Using step title as skill (no skills_covered provided)', {
    stepTitle: step.title,
    fallbackSkill,
  });
  return [fallbackSkill];
}

/**
 * Generate a topic with all 6 formats for a step
 * Parameter-driven: Only passes parameters from request, no inference or expansion
 * 
 * Parameter Mapping Rules:
 * - topic_name ← step.title
 * - topic_description ← step.description
 * - skills ← step.skills_covered (or step.title as fallback)
 * - language ← request payload language
 * 
 * @param {Object} step - Step object from learning path (from request)
 * @param {string} language - Language code (from request payload)
 * @param {AIGenerationService} aiGenerationService - AI service instance
 * @returns {Promise<Object|null>} Topic object or null
 */
async function generateTopicForStep({ step, language, aiGenerationService }) {
  try {
    // Parameter mapping: topic_name ← step.title
    const lessonTopic = step.title || 'Untitled Topic';
    
    // Parameter mapping: topic_description ← step.description
    const lessonDescription = step.description || `A comprehensive lesson about ${lessonTopic}`;
    
    // Parameter mapping: skills ← step.skills_covered (or step.title as minimal fallback)
    // NO inference, NO global skill gaps, NO AI-based skill extraction
    const skillsForTopic = extractSkillsFromStep(step);
    
    // Ensure we have at least one skill (required for existing prompts)
    const skillsList = skillsForTopic.length > 0 ? skillsForTopic : [lessonTopic];

    // Sanitize inputs
    const sanitizedInput = PromptSanitizer.sanitizeVariables({
      lessonTopic,
      lessonDescription,
      language,
      skillsList: skillsList.join(', '),
    });

    const promptVariables = {
      lessonTopic: sanitizedInput.lessonTopic || lessonTopic.trim(),
      lessonDescription: sanitizedInput.lessonDescription || lessonDescription.trim(),
      language: sanitizedInput.language || language.trim(),
      skillsList: sanitizedInput.skillsList || skillsList.join(', '),
      skillsListArray: skillsList,
    };

    const wrappedVariables = {
      lessonTopic: PromptSanitizer.wrapUserInput(promptVariables.lessonTopic),
      lessonDescription: PromptSanitizer.wrapUserInput(promptVariables.lessonDescription),
      language: PromptSanitizer.wrapUserInput(promptVariables.language),
      skillsList: PromptSanitizer.wrapUserInput(promptVariables.skillsList),
    };

    const securityInstruction = PromptSanitizer.getSystemInstruction();
    const contents = [];
    let text = null;

    // 1. Generate text_audio (type 1)
    try {
      const textPrompt = `You are an expert educational content creator in EduCore Content Studio.
🎯 Objective: Generate a concise, audio-friendly lesson text for ${wrappedVariables.lessonTopic}.

Lesson Context:
- Topic: ${wrappedVariables.lessonTopic}
- Description: ${wrappedVariables.lessonDescription}
- Language: ${wrappedVariables.language}
- Skills Focus: ${wrappedVariables.skillsList}

⚠️ CRITICAL CONSTRAINTS:
1. **Maximum Length: 1200 characters** (strict limit for HeyGen avatar video - 1500 char max)
2. **Keep it SHORT and CONCISE** - focus on key points only
3. **NO CODE EXAMPLES** - this is pure explanatory text (code has its own format)
4. **NO special symbols or formatting** - plain text only for audio conversion
5. **Be brief** - summarize main concepts, not detailed explanations

Output only pure, conversational text in ${wrappedVariables.language}. Keep it under 1200 characters.`;

      const textPromptWithSecurity = `${securityInstruction}\n\n${textPrompt}`;
      text = await aiGenerationService.generateText(textPromptWithSecurity, {
        language: promptVariables.language,
        temperature: 0.7,
        max_tokens: 800, // Reduced from 2000 to ensure text stays under 1500 chars for HeyGen
      });

      if (text && typeof text === 'string') {
        text = PromptSanitizer.removeUserInputMarkers(text);
      }

      let audioData = null;
      try {
        audioData = await aiGenerationService.generateAudio(text, {
          voice: 'alloy',
          model: 'tts-1',
          format: 'mp3',
          language: promptVariables.language,
        });
      } catch (audioError) {
        logger.warn('[fillCourseBuilderService] Failed to generate audio', { error: audioError.message });
      }

      contents.push({
        content_type: 'text',
        content_data: ContentDataCleaner.cleanTextAudioData({
          text,
          audioUrl: audioData?.audioUrl,
          audioFormat: audioData?.format,
          audioDuration: audioData?.duration,
          audioVoice: audioData?.voice,
        }),
      });
    } catch (error) {
      logger.warn('[fillCourseBuilderService] Failed to generate text', { error: error.message });
    }

    // 2. Generate code (type 2)
    try {
      const codePrompt = `You are a senior coding mentor in EduCore Content Studio.
🎯 Objective: Generate clean, production-ready code example related to ${wrappedVariables.lessonTopic}.

Lesson Context:
- Topic: ${wrappedVariables.lessonTopic}
- Description: ${wrappedVariables.lessonDescription}
- Skills: ${wrappedVariables.skillsList}
- Language: ${wrappedVariables.language}

Generate ${wrappedVariables.language} code that demonstrates the concepts clearly.`;

      const codePromptWithSecurity = `${securityInstruction}\n\n${codePrompt}`;
      const codeResult = await aiGenerationService.generateCode(codePromptWithSecurity, 'javascript', {
        include_comments: false,
      });

      contents.push({
        content_type: 'code',
        content_data: ContentDataCleaner.cleanCodeData({
          ...codeResult,
          metadata: { programming_language: 'javascript' },
        }),
      });
    } catch (error) {
      logger.warn('[fillCourseBuilderService] Failed to generate code', { error: error.message });
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

      contents.push({
        content_type: 'presentation',
        content_data: ContentDataCleaner.cleanPresentationData({
          format: presentation.format || 'gamma',
          presentationUrl: presentation.presentationUrl,
          storagePath: presentation.storagePath,
          metadata: {
            source: 'ai_generated',
            audience: 'general',
            language: promptVariables.language,
            generated_at: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      logger.warn('[fillCourseBuilderService] Failed to generate presentation', { error: error.message });
    }

    // 4. Generate mind_map (type 5)
    try {
      const mindMap = await aiGenerationService.generateMindMap(promptVariables.lessonDescription, {
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
    } catch (error) {
      logger.warn('[fillCourseBuilderService] Failed to generate mind_map', { error: error.message });
    }

    // 5. Generate avatar_video (type 6)
    try {
      let trainerPrompt = text?.content || text || promptVariables.lessonDescription;
      if (trainerPrompt && typeof trainerPrompt === 'string') {
        trainerPrompt = PromptSanitizer.removeUserInputMarkers(trainerPrompt);
      }

      const avatarResult = await aiGenerationService.generateAvatarVideo({
        prompt: trainerPrompt,
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
      }
    } catch (error) {
      logger.warn('[fillCourseBuilderService] Failed to generate avatar_video', { error: error.message });
    }

    return {
      topic_id: null,
      topic_name: promptVariables.lessonTopic,
      topic_description: promptVariables.lessonDescription,
      topic_language: language,
      template_id: null,
      format_order: ['text', 'code', 'presentation', 'mind_map', 'avatar_video'],
      contents,
      devlab_exercises: null,
    };
  } catch (error) {
    logger.error('[fillCourseBuilderService] Failed to generate topic for step', {
      error: error.message,
      step: step.title,
    });
    return null;
  }
}

