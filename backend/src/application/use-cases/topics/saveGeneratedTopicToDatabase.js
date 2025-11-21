import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OpenAIClient } from '../../../infrastructure/external-apis/openai/OpenAIClient.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';
import { ContentDataCleaner } from '../../utils/ContentDataCleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Content type name to ID mapping
const CONTENT_TYPE_MAP = {
  'text_audio': 1,
  'text': 1,
  'code': 2,
  'presentation': 3,
  'audio': 4,
  'mind_map': 5,
  'avatar_video': 6,
};

/**
 * Saves a full AI-generated topic to the database.
 * Uses AI Query Builder pattern to generate INSERT queries dynamically.
 * 
 * @param {Object} generatedTopic - Full topic object from generateAiTopic
 * @param {string} preferredLanguage - Preferred language code
 * @returns {Promise<Object|null>} Response object with saved status or null
 */
export async function saveGeneratedTopicToDatabase(generatedTopic, preferredLanguage) {
  // Validation
  if (!generatedTopic || typeof generatedTopic !== 'object') {
    logger.warn('[UseCase] Invalid generatedTopic provided');
    return null;
  }

  if (!Array.isArray(generatedTopic.contents) || generatedTopic.contents.length < 1) {
    logger.warn('[UseCase] generatedTopic.contents must be a non-empty array');
    return null;
  }

  if (!preferredLanguage || typeof preferredLanguage !== 'string') {
    logger.warn('[UseCase] preferredLanguage is required');
    return null;
  }

  if (!Array.isArray(generatedTopic.skills) || generatedTopic.skills.length === 0) {
    logger.warn('[UseCase] generatedTopic.skills must be a non-empty array');
    return null;
  }

  // Read migration file
  const migrationPath = join(__dirname, '../../../../database/doc_migration_content_studio.sql');
  const migrationContent = readFileSync(migrationPath, 'utf-8');

  // Initialize OpenAI client
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    logger.error('[UseCase] OpenAI API key not configured');
    return null;
  }

  const openaiClient = new OpenAIClient({ apiKey: openaiApiKey });

  // Ensure database is ready
  await db.ready;
  if (!db.isConnected()) {
    logger.error('[UseCase] Database not connected');
    return null;
  }

  try {
    // Step 1: Save topic
    // Convert skills array to PostgreSQL ARRAY format
    const skillsArrayFormat = `{${generatedTopic.skills.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`;
    
    const topicData = {
      topic_name: generatedTopic.topic_name,
      topic_description: generatedTopic.topic_description || '',
      topic_language: generatedTopic.topic_language || preferredLanguage,
      skills: skillsArrayFormat,
      trainer_id: 'system-auto',
      course_id: null,
      template_id: null,
      generation_methods_id: 5,
      status: 'archived',
      devlab_exercises: null,
    };

    const topicBusinessRules = `- INSERT into "topics" table.
- generation_methods_id MUST be 5 (full_ai_generated).
- trainer_id MUST be 'system-auto' (string literal).
- course_id MUST be NULL (AI standalone topic).
- template_id MUST be NULL.
- status MUST be 'archived' (string literal).
- devlab_exercises MUST be NULL.
- skills must be saved as JSONB array using the exact format provided: ${skillsArrayFormat}
- Use the skills value AS-IS in the INSERT query (it's already in PostgreSQL ARRAY format).
- usage_count should default to 0 (will be incremented later).
- Return topic_id using RETURNING clause.`;

    const topicPrompt = `You are an AI Query Builder for PostgreSQL. Generate ONLY an INSERT query (no explanations, no markdown).

SCHEMA:
${migrationContent}

REQUEST DATA:
${JSON.stringify(topicData, null, 2)}

BUSINESS RULES:
${topicBusinessRules}

TASK:
Return only the SQL INSERT query with RETURNING topic_id. Do NOT return any explanations.`;

    const topicSql = await Promise.race([
      openaiClient.generateText(topicPrompt, {
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        max_tokens: 500,
        systemPrompt: 'You are a PostgreSQL query generator. Return only valid SQL INSERT queries, no explanations.',
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI request timeout')), 9000)
      ),
    ]);

    // Clean SQL
    const cleanTopicSql = topicSql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
    const sanitizedTopicSql = cleanTopicSql.replace(/;$/, '');

    // Validate SQL is an INSERT query
    if (!sanitizedTopicSql.toLowerCase().startsWith('insert')) {
      logger.warn('[UseCase] AI returned non-INSERT SQL for topic. Skipping.');
      return null;
    }

    // Check for placeholders
    if (sanitizedTopicSql.includes('$')) {
      logger.warn('[UseCase] AI topic query contains placeholders. Expected literal values.');
    }

    // Execute topic INSERT
    const topicResult = await db.query(sanitizedTopicSql);
    
    if (!topicResult.rows || topicResult.rows.length === 0 || !topicResult.rows[0].topic_id) {
      logger.error('[UseCase] Failed to save topic - no topic_id returned');
      return null;
    }

    const topicId = topicResult.rows[0].topic_id;
    logger.info('[UseCase] Topic saved successfully', { topic_id: topicId });

    // Step 2: Save contents
    let contentsSaved = 0;
    
    for (const content of generatedTopic.contents) {
      try {
        const contentTypeName = content.content_type;
        const contentTypeId = CONTENT_TYPE_MAP[contentTypeName];
        
        if (!contentTypeId) {
          logger.warn('[UseCase] Unknown content_type, skipping', { content_type: contentTypeName });
          continue;
        }

        // Clean content_data before saving
        const rawContentData = content.content_data || {};
        const cleanedContentData = ContentDataCleaner.clean(rawContentData, contentTypeId);

        const contentData = {
          topic_id: topicId,
          content_type_id: contentTypeId,
          content_data: cleanedContentData,
          generation_method_id: 5,
        };

        const contentBusinessRules = `- INSERT into "content" table.
- topic_id must match the saved topic_id (${topicId}).
- content_type_id must be ${contentTypeId} (from content_types lookup).
- content_data must be saved as JSONB.
- generation_method_id MUST be 5 (full_ai_generated).
- quality_check_status should default to NULL.
- quality_check_data should default to NULL.`;

        const contentPrompt = `You are an AI Query Builder for PostgreSQL. Generate ONLY an INSERT query (no explanations, no markdown).

SCHEMA:
${migrationContent}

REQUEST DATA:
${JSON.stringify(contentData, null, 2)}

BUSINESS RULES:
${contentBusinessRules}

TASK:
Return only the SQL INSERT query. Do NOT return any explanations.`;

        const contentSql = await Promise.race([
          openaiClient.generateText(contentPrompt, {
            model: 'gpt-3.5-turbo',
            temperature: 0.1,
            max_tokens: 500,
            systemPrompt: 'You are a PostgreSQL query generator. Return only valid SQL INSERT queries, no explanations.',
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OpenAI request timeout')), 9000)
          ),
        ]);

        // Clean SQL
        const cleanContentSql = contentSql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
        const sanitizedContentSql = cleanContentSql.replace(/;$/, '');

        // Validate SQL is an INSERT query
        if (!sanitizedContentSql.toLowerCase().startsWith('insert')) {
          logger.warn('[UseCase] AI returned non-INSERT SQL for content. Skipping.', {
            content_type: contentTypeName,
          });
          continue;
        }

        // Check for placeholders
        if (sanitizedContentSql.includes('$')) {
          logger.warn('[UseCase] AI content query contains placeholders. Expected literal values.');
        }

        // Execute content INSERT
        await db.query(sanitizedContentSql);
        contentsSaved++;
        logger.info('[UseCase] Content saved successfully', {
          topic_id: topicId,
          content_type: contentTypeName,
        });
      } catch (contentError) {
        logger.warn('[UseCase] Failed to save content, continuing', {
          error: contentError.message,
          content_type: content.content_type,
          topic_id: topicId,
        });
        // Continue with next content (transaction-like logic - log only)
      }
    }

    // Step 3: Update usage counters
    try {
      // Update topic usage_count
      const updateTopicUsageSql = `UPDATE topics SET usage_count = usage_count + 1 WHERE topic_id = ${topicId}`;
      await db.query(updateTopicUsageSql);

      // Update generation_methods usage_count (method_id = 5)
      const updateMethodUsageSql = `UPDATE generation_methods SET usage_count = usage_count + 1 WHERE method_id = 5`;
      await db.query(updateMethodUsageSql);

      logger.info('[UseCase] Usage counters updated', { topic_id: topicId });
    } catch (usageError) {
      logger.warn('[UseCase] Failed to update usage counters', {
        error: usageError.message,
        topic_id: topicId,
      });
      // Don't fail the whole operation if usage counters fail
    }

    // Return response
    return {
      saved: true,
      topic_id: topicId,
      contents_saved: contentsSaved,
      method_id: 5,
    };
  } catch (error) {
    logger.error('[UseCase] Failed to save generated topic to database', {
      error: error.message,
      topic_name: generatedTopic.topic_name,
    });
    return null;
  }
}

