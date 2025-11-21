import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OpenAIClient } from '../../../infrastructure/external-apis/openai/OpenAIClient.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Step 3 - Searches for a suitable course for the learner.
 * Uses AI Query Builder (OpenAI 3.5) to generate SQL queries dynamically.
 * 
 * @param {Object} parsedRequest - Validated object from parseCourseRequest()
 * @param {Object} preferredLanguage - Object with preferred_language
 * @returns {Promise<Object|null>} Full trainer_courses row or null
 */
export async function searchSuitableCourse(parsedRequest, preferredLanguage) {
  // Validate input
  if (!parsedRequest || typeof parsedRequest !== 'object') {
    throw new Error('parsedRequest must be an object');
  }

  if (!preferredLanguage || typeof preferredLanguage !== 'object') {
    throw new Error('preferredLanguage must be an object');
  }

  if (!parsedRequest.learner_company || !Array.isArray(parsedRequest.skills) || !preferredLanguage.preferred_language) {
    throw new Error('parsedRequest.learner_company, parsedRequest.skills, and preferredLanguage.preferred_language are required');
  }

  // Read migration file
  const migrationPath = join(__dirname, '../../../../database/doc_migration_content_studio.sql');
  const migrationContent = readFileSync(migrationPath, 'utf-8');

  // Build request body
  const requestBody = {
    learner_company: parsedRequest.learner_company,
    skills: parsedRequest.skills,
    preferred_language: preferredLanguage.preferred_language,
  };

  // Business rules
  const businessRules = `RULE 1: trainer_courses.status must be 'active'
RULE 2: trainer_courses.language must equal preferred_language
RULE 3: trainer_courses.skills must contain ALL learner skills (skills @> ARRAY[..])
RULE 4: ORGANIZATION course must have permissions containing learner_company
RULE 5: PUBLIC course must have permissions NULL OR '' (meaning available to all)
RULE 6: If multiple matches exist, return the most recent (ORDER BY created_at DESC LIMIT 1)`;

  // Initialize OpenAI client
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    logger.error('[UseCase] OpenAI API key not configured');
    return null;
  }

  const openaiClient = new OpenAIClient({ apiKey: openaiApiKey });

  // Step 1: Search for ORGANIZATION-SPECIFIC course
  try {
    const orgPrompt = `You are an AI Query Builder for PostgreSQL. Generate ONLY a SELECT SQL query (no explanations, no markdown).

SCHEMA:
${migrationContent}

REQUEST:
${JSON.stringify(requestBody, null, 2)}

BUSINESS RULES:
${businessRules}

TASK: Generate a PostgreSQL SELECT query to find an ORGANIZATION-SPECIFIC course from trainer_courses table where:
- permissions contains the learner_company value
- All other rules apply

Return ONLY the SQL query, nothing else.`;

    const orgSql = await Promise.race([
      openaiClient.generateText(orgPrompt, {
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
    const cleanOrgSql = orgSql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
    const sanitizedSql = cleanOrgSql.replace(/;$/, '');

    // Validate SQL is a SELECT query
    if (!sanitizedSql.toLowerCase().startsWith('select')) {
      logger.warn('[UseCase] AI returned non-SELECT SQL for organization search. Skipping.');
    } else {
      // Execute SQL safely
      await db.ready;
      if (db.isConnected()) {
        const orgResult = await db.query(sanitizedSql);
      if (orgResult.rows && orgResult.rows.length > 0) {
        logger.info('[UseCase] Found organization-specific course', {
          course_id: orgResult.rows[0].course_id,
        });
        return orgResult.rows[0];
      }
    }
    }
  } catch (error) {
    logger.warn('[UseCase] Organization-specific course search failed', {
      error: error.message,
    });
  }

  // Step 2: Search for PUBLIC course
  try {
    const publicPrompt = `You are an AI Query Builder for PostgreSQL. Generate ONLY a SELECT SQL query (no explanations, no markdown).

SCHEMA:
${migrationContent}

REQUEST:
${JSON.stringify(requestBody, null, 2)}

BUSINESS RULES:
${businessRules}

TASK: Generate a PostgreSQL SELECT query to find a PUBLIC course from trainer_courses table where:
- permissions is NULL OR permissions = ''
- All other rules apply

Return ONLY the SQL query, nothing else.`;

    const publicSql = await Promise.race([
      openaiClient.generateText(publicPrompt, {
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
    const cleanPublicSql = publicSql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
    const sanitizedPublicSql = cleanPublicSql.replace(/;$/, '');

    // Validate SQL is a SELECT query
    if (!sanitizedPublicSql.toLowerCase().startsWith('select')) {
      logger.warn('[UseCase] AI returned non-SELECT SQL for public search. Skipping.');
    } else {
      // Execute SQL safely
      await db.ready;
      if (db.isConnected()) {
        const publicResult = await db.query(sanitizedPublicSql);
      if (publicResult.rows && publicResult.rows.length > 0) {
        logger.info('[UseCase] Found public course', {
          course_id: publicResult.rows[0].course_id,
        });
        return publicResult.rows[0];
      }
    }
    }
  } catch (error) {
    logger.warn('[UseCase] Public course search failed', {
      error: error.message,
    });
  }

  // No course found
  logger.info('[UseCase] No suitable course found');
  return null;
}

