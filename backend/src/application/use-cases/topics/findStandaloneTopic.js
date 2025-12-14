import { loadDatabaseSchema, generateSQLQueryUsingSharedPrompt } from '../../../infrastructure/ai/SharedAIQueryBuilder.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Finds a standalone archived topic by skill and preferred language.
 * Uses AI Query Builder (OpenAI 3.5) to generate SQL queries dynamically.
 * 
 * @param {string} skillName - The skill name to search for
 * @param {string} preferredLanguage - The preferred language code
 * @returns {Promise<Object|null>} Topic object with format_order or null
 */
export async function findStandaloneTopic(skillName, preferredLanguage) {
  // Validate input
  if (!skillName || typeof skillName !== 'string') {
    logger.warn('[UseCase] Invalid skillName provided');
    return null;
  }

  if (!preferredLanguage || typeof preferredLanguage !== 'string') {
    logger.warn('[UseCase] Invalid preferredLanguage provided');
    return null;
  }

  // Load database schema using shared function
  const migrationContent = loadDatabaseSchema();

  // Build request body
  const requestBody = {
    preferred_language: preferredLanguage,
    skill: skillName,
  };

  // Business rules
  const businessRules = `- Search in "topics" table.
- Only topics with status = 'archived' are allowed.
- topics.language MUST equal preferred_language.
- topics.skills MUST contain the requested skill (use @> operator).
- topics.course_id MUST be NULL (standalone topic).
- topics.template_id MUST NOT be NULL.
- template.format_order MUST be returned.
- Must JOIN with "templates" table to get format_order.
- MUST return only ONE topic (order by created_at DESC LIMIT 1).
- If multiple matches: newest first.

OUTPUT REQUIREMENTS:
Return ONLY these columns (exact names):
- topic_id
- topic_name
- topic_description
- topic_language
- skills            (from topics)
- template_id       (from topics)
- format_order      (from templates)
- devlab_exercises  (from topics)`;

  // Use the SHARED AI Query Builder prompt
  // Services pass ONLY: schema, request body, business rules, task
  try {
    const sanitizedSql = await generateSQLQueryUsingSharedPrompt({
      schema: migrationContent,
      requestBody: requestBody, // Pass original request body as-is
      businessRules: businessRules,
      task: `Generate a PostgreSQL SELECT query to find a standalone archived topic where:
- topics.status = 'archived'
- topics.language = preferred_language
- topics.skills contains the requested skill (use @> operator)
- topics.course_id IS NULL
- topics.template_id IS NOT NULL
- Must JOIN with templates table to get format_order
- Return only ONE topic (ORDER BY created_at DESC LIMIT 1)`,
    });

    // Check for placeholders (AI should return literal values, not placeholders)
    if (sanitizedSql.includes('$')) {
      logger.warn('[UseCase] AI query contains placeholders. Expected literal values.');
    }

    // Execute SQL safely (no external parameters - AI should embed values directly)
    await db.ready;
    if (!db.isConnected()) {
      logger.error('[UseCase] Database not connected');
      return null;
    }

    const result = await db.query(sanitizedSql);

    if (!result.rows || result.rows.length === 0) {
      logger.info('[UseCase] No standalone topic found', {
        skill: skillName,
        language: preferredLanguage,
      });
      return null;
    }

    // Return the first (and only) topic
    const topic = result.rows[0];
    return {
      topic_id: topic.topic_id,
      topic_name: topic.topic_name,
      topic_description: topic.topic_description || '',
      topic_language: topic.topic_language || preferredLanguage,
      skills: topic.skills || [],
      template_id: topic.template_id,
      format_order: topic.format_order || [],
      devlab_exercises: topic.devlab_exercises || null,
    };
  } catch (error) {
    logger.warn('[UseCase] Failed to find standalone topic', {
      error: error.message,
      skill: skillName,
      language: preferredLanguage,
    });
    return null;
  }
}

