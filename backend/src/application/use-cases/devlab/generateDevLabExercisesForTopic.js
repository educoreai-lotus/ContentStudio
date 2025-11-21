import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OpenAIClient } from '../../../infrastructure/external-apis/openai/OpenAIClient.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';
import { DevlabClient } from '../../../infrastructure/devlabClient/devlabClient.js';
import { generateDevLabFallback } from '../../utils/generateDevLabFallback.js';
import axios from 'axios';
import qs from 'qs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  const devlabClient = new DevlabClient();
  const devlabUrl = process.env.DEVLAB_URL;

  if (!devlabUrl) {
    logger.warn('[UseCase] DevLab URL not configured, using fallback');
    const fallbackResult = generateDevLabFallback(topic.skills);
    await updateTopicDevlabExercises(topic.topic_id, fallbackResult.devlab_exercises);
    topic.devlab_exercises = fallbackResult.devlab_exercises;
    return {
      topic_id: topic.topic_id,
      generated: true,
      exercise_count: fallbackResult.devlab_exercises.length,
    };
  }

  const endpoint = `${devlabUrl.replace(/\/$/, '')}/api/generate-exercises`;

  try {
    const requestPayload = {
      requester_service: 'content_studio',
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

    const payloadString = JSON.stringify(requestPayload);
    const body = qs.stringify({
      serviceName: 'ContentStudio',
      payload: payloadString,
    });

    logger.info('[UseCase] Sending DevLab exercise generation request', {
      topic_id: topic.topic_id,
      question_type: questionType,
      programming_language: programmingLanguage,
      skills_count: topic.skills.length,
    });

    const response = await axios.post(endpoint, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 60000,
    });

    if (!response.data || typeof response.data !== 'object' || !response.data.payload) {
      logger.warn('[UseCase] Invalid response from DevLab, using fallback', {
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
      responsePayload = typeof response.data.payload === 'string'
        ? JSON.parse(response.data.payload)
        : response.data.payload;
    } catch (parseError) {
      logger.warn('[UseCase] Failed to parse DevLab response, using fallback', {
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
  const migrationPath = join(__dirname, '../../../../database/doc_migration_content_studio.sql');
  const migrationContent = readFileSync(migrationPath, 'utf-8');

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    logger.error('[UseCase] OpenAI API key not configured');
    return;
  }

  const openaiClient = new OpenAIClient({ apiKey: openaiApiKey });

  await db.ready;
  if (!db.isConnected()) {
    logger.error('[UseCase] Database not connected');
    return;
  }

  try {
    const sanitizedExercises = JSON.parse(JSON.stringify(exercises));

    const updateData = {
      topic_id: topicId,
      devlab_exercises: sanitizedExercises,
    };

    const businessRules = `- UPDATE "topics" table.
- WHERE topic_id = ${topicId}.
- SET devlab_exercises = the provided JSONB array.
- devlab_exercises must be saved as JSONB.
- Do NOT update any other fields.`;

    const prompt = `You are an AI Query Builder for PostgreSQL. Generate ONLY an UPDATE query (no explanations, no markdown).

SCHEMA:
${migrationContent}

REQUEST DATA:
${JSON.stringify(updateData, null, 2)}

BUSINESS RULES:
${businessRules}

TASK:
Return only the SQL UPDATE query. Do NOT return any explanations.`;

    const sql = await Promise.race([
      openaiClient.generateText(prompt, {
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        max_tokens: 500,
        systemPrompt: 'You are a PostgreSQL query generator. Return only valid SQL UPDATE queries, no explanations.',
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OpenAI request timeout')), 9000)
      ),
    ]);

    const cleanSql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
    const sanitizedSql = cleanSql.replace(/;$/, '');

    if (!sanitizedSql.toLowerCase().startsWith('update')) {
      logger.warn('[UseCase] AI returned non-UPDATE SQL. Skipping.');
      return;
    }

    if (sanitizedSql.includes('$')) {
      logger.warn('[UseCase] AI query contains placeholders. Expected literal values.');
    }

    await db.query(sanitizedSql);
    logger.info('[UseCase] Updated topic devlab_exercises', { topic_id: topicId });
  } catch (error) {
    logger.error('[UseCase] Failed to update topic devlab_exercises', {
      error: error.message,
      topic_id: topicId,
    });
  }
}

