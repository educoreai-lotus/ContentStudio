import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';
import { DevlabClient } from '../../../infrastructure/devlabClient/devlabClient.js';
import { generateDevLabFallback } from '../../utils/generateDevLabFallback.js';
import { postToCoordinator } from '../../../infrastructure/coordinatorClient/coordinatorClient.js';

const PROGRAMMING_LANGUAGES = [
  'javascript', 'js', 'typescript', 'ts', 'python', 'java', 'c', 'cpp', 'c++',
  'csharp', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
  'r', 'matlab', 'perl', 'lua', 'dart', 'haskell', 'clojure', 'erlang',
  'elixir', 'f#', 'vb', 'vbnet', 'objective-c', 'objc', 'sql', 'html', 'css',
  'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'toml', 'markdown', 'shell',
  'bash', 'powershell', 'sh', 'zsh', 'fish', 'batch', 'cmd'
];

function isProgrammingLanguage(skill) {
  if (!skill || typeof skill !== 'string') return false;
  const normalized = skill.toLowerCase().trim();
  return PROGRAMMING_LANGUAGES.includes(normalized);
}

function extractProgrammingLanguage(skills) {
  if (!Array.isArray(skills)) return null;
  for (const skill of skills) {
    if (isProgrammingLanguage(skill)) {
      const normalized = skill.toLowerCase().trim();
      if (normalized === 'js') return 'javascript';
      if (normalized === 'ts') return 'typescript';
      if (normalized === 'c++' || normalized === 'cpp') return 'cpp';
      if (normalized === 'c#' || normalized === 'csharp') return 'csharp';
      if (normalized === 'f#') return 'fsharp';
      if (normalized === 'objc' || normalized === 'objective-c') return 'objective-c';
      return normalized;
    }
  }
  return null;
}

function determineQuestionType(skills) {
  const programmingLang = extractProgrammingLanguage(skills);
  return programmingLang ? 'code' : 'theoretical';
}

export async function generateDevLabExercisesForTopic(topic) {
  if (!topic || typeof topic !== 'object') {
    logger.warn('[UseCase] Invalid topic provided');
    return { topic_id: null, generated: false, exercise_count: 0 };
  }

  if (!topic.topic_id) {
    logger.warn('[UseCase] topic.topic_id is required');
    return { topic_id: null, generated: false, exercise_count: 0 };
  }

  if (topic.devlab_exercises !== null && topic.devlab_exercises !== undefined) {
    logger.info('[UseCase] Topic already has devlab_exercises, skipping', {
      topic_id: topic.topic_id,
    });
    return {
      topic_id: topic.topic_id,
      generated: false,
      exercise_count: Array.isArray(topic.devlab_exercises) ? topic.devlab_exercises.length : 0,
    };
  }

  if (!Array.isArray(topic.skills) || topic.skills.length === 0) {
    logger.warn('[UseCase] Topic has no skills, cannot generate exercises', {
      topic_id: topic.topic_id,
    });
    return { topic_id: topic.topic_id, generated: false, exercise_count: 0 };
  }

  const questionType = determineQuestionType(topic.skills);
  const programmingLanguage = questionType === 'code' ? extractProgrammingLanguage(topic.skills) : null;

  try {
    // Build envelope for Coordinator (standard structure)
    const envelope = {
      requester_service: 'content-studio',
      payload: {
        topic_id: topic.topic_id,
        topic_name: topic.topic_name || '',
        skills: topic.skills,
        question_type: questionType,
        programming_language: programmingLanguage,
        amount: 4,
      },
      response: {
        devlab_exercises: [],
      },
    };

    logger.info('[UseCase] Sending DevLab exercise generation request via Coordinator', {
      topic_id: topic.topic_id,
      question_type: questionType,
      programming_language: programmingLanguage,
      skills_count: topic.skills.length,
    });

    // Send request via Coordinator
    const coordinatorResponse = await postToCoordinator(envelope, {
      endpoint: '/api/fill-content-metrics',
      timeout: 120000, // 2 minutes timeout
    });

    if (!coordinatorResponse || typeof coordinatorResponse !== 'object' || !coordinatorResponse.payload) {
      logger.warn('[UseCase] Invalid response from Coordinator, using fallback', {
        topic_id: topic.topic_id,
      });
      const fallbackResult = generateDevLabFallback(topic.skills);
      await updateTopicDevlabExercises(topic.topic_id, fallbackResult.devlab_exercises);
      topic.devlab_exercises = fallbackResult.devlab_exercises;
      return {
        topic_id: topic.topic_id,
        generated: true,
        exercise_count: fallbackResult.devlab_exercises.length,
      };
    }

    let responsePayload;
    try {
      responsePayload = typeof coordinatorResponse.payload === 'string'
        ? JSON.parse(coordinatorResponse.payload)
        : coordinatorResponse.payload;
    } catch (parseError) {
      logger.warn('[UseCase] Failed to parse Coordinator response, using fallback', {
        topic_id: topic.topic_id,
        error: parseError.message,
      });
      const fallbackResult = generateDevLabFallback(topic.skills);
      await updateTopicDevlabExercises(topic.topic_id, fallbackResult.devlab_exercises);
      topic.devlab_exercises = fallbackResult.devlab_exercises;
      return {
        topic_id: topic.topic_id,
        generated: true,
        exercise_count: fallbackResult.devlab_exercises.length,
      };
    }

    const exercises = responsePayload?.response?.devlab_exercises || responsePayload?.devlab_exercises || [];

    if (!Array.isArray(exercises) || exercises.length === 0) {
      logger.info('[UseCase] DevLab returned empty exercises, using fallback', {
        topic_id: topic.topic_id,
      });
      const fallbackResult = generateDevLabFallback(topic.skills);
      await updateTopicDevlabExercises(topic.topic_id, fallbackResult.devlab_exercises);
      topic.devlab_exercises = fallbackResult.devlab_exercises;
      return {
        topic_id: topic.topic_id,
        generated: true,
        exercise_count: fallbackResult.devlab_exercises.length,
      };
    }

    await updateTopicDevlabExercises(topic.topic_id, exercises);
    topic.devlab_exercises = exercises;

    const generationMethodId = topic.generation_methods_id === 5 ? 5 : null;
    if (generationMethodId === 5) {
      try {
        const updateMethodUsageSql = `UPDATE generation_methods SET usage_count = usage_count + 1 WHERE method_id = 5`;
        await db.query(updateMethodUsageSql);
      } catch (usageError) {
        logger.warn('[UseCase] Failed to update usage counter', {
          error: usageError.message,
        });
      }
    }

    logger.info('[UseCase] Successfully generated and saved DevLab exercises', {
      topic_id: topic.topic_id,
      exercise_count: exercises.length,
    });

    return {
      topic_id: topic.topic_id,
      generated: true,
      exercise_count: exercises.length,
    };
  } catch (error) {
    logger.error('[UseCase] Failed to generate DevLab exercises, using fallback', {
      error: error.message,
      topic_id: topic.topic_id,
    });
    const fallbackResult = generateDevLabFallback(topic.skills);
    await updateTopicDevlabExercises(topic.topic_id, fallbackResult.devlab_exercises);
    topic.devlab_exercises = fallbackResult.devlab_exercises;
    return {
      topic_id: topic.topic_id,
      generated: true,
      exercise_count: fallbackResult.devlab_exercises.length,
    };
  }
}

async function updateTopicDevlabExercises(topicId, exercises) {
  await db.ready;
  if (!db.isConnected()) {
    logger.error('[UseCase] Database not connected');
    return;
  }

  try {
    // Sanitize exercises array
    const sanitizedExercises = Array.isArray(exercises) ? exercises : [];

    // Use parameterized query for JSONB to avoid SQL injection and escaping issues
    const updateSql = `
      UPDATE topics
      SET devlab_exercises = $1::jsonb
      WHERE topic_id = $2
    `;

    // Execute UPDATE with parameterized query
    await db.query(updateSql, [
      JSON.stringify(sanitizedExercises), // Convert array to JSONB
      topicId,
    ]);
    
    logger.info('[UseCase] Updated topic devlab_exercises', { 
      topic_id: topicId,
      exercises_count: sanitizedExercises.length,
    });
  } catch (error) {
    logger.error('[UseCase] Failed to update topic devlab_exercises', {
      error: error.message,
      error_stack: error.stack,
      topic_id: topicId,
    });
    throw error; // Re-throw to let caller handle
  }
}

