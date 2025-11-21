import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OpenAIClient } from '../../../infrastructure/external-apis/openai/OpenAIClient.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  // Read migration file
  const migrationPath = join(__dirname, '../../../../database/doc_migration_content_studio.sql');
  const migrationContent = readFileSync(migrationPath, 'utf-8');

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

  // Initialize OpenAI client
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    logger.error('[UseCase] OpenAI API key not configured');
    return null;
  }

  const openaiClient = new OpenAIClient({ apiKey: openaiApiKey });

  try {
    const prompt = `You are an AI Query Builder for PostgreSQL. Generate ONLY a SELECT query (no explanations, no markdown).

SCHEMA:
${migrationContent}

REQUEST:
${JSON.stringify(requestBody, null, 2)}

BUSINESS RULES:
${businessRules}

TASK:
Return only the SQL SELECT query. Do NOT return any explanations.`;

    const sql = await Promise.race([
      openaiClient.generateText(prompt, {
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        max_tokens: 500,
        systemPrompt: 'You are a PostgreSQL query generator. Return only valid SQL queries, no explanations.',
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI request timeout')), 9000)
      ),
    ]);

    // Clean SQL (remove markdown code blocks if present)
    const cleanSql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
    const sanitizedSql = cleanSql.replace(/;$/, '');

    // Validate SQL is a SELECT query
    if (!sanitizedSql.toLowerCase().startsWith('select')) {
      logger.warn('[UseCase] AI returned non-SELECT SQL. Skipping.');
      return null;
    }

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

