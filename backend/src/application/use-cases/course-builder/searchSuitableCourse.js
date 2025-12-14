import { loadDatabaseSchema, generateSQLQueryUsingSharedPrompt } from '../../../infrastructure/ai/SharedAIQueryBuilder.js';
import { db } from '../../../infrastructure/database/DatabaseConnection.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

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

  // Load database schema using shared function
  const migrationContent = loadDatabaseSchema();

  // Build request body
  const requestBody = {
    learner_company: parsedRequest.learner_company,
    skills: parsedRequest.skills,
    preferred_language: preferredLanguage.preferred_language,
  };

  // Business rules for Course Builder (default)
  // These rules are used when searching for courses for learners
  const courseBuilderBusinessRules = `RULE 1: trainer_courses.status must be 'active'
RULE 2: trainer_courses.language must equal preferred_language
RULE 3: trainer_courses.skills must contain ALL learner skills (skills @> ARRAY[..])
RULE 4: ORGANIZATION course must have permissions containing learner_company
RULE 5: PUBLIC course must have permissions NULL OR '' (meaning available to all)
RULE 6: If multiple matches exist, return the most recent (ORDER BY created_at DESC LIMIT 1)`;

  // Business rules for LearningAnalytics/ManagementReporting
  // These services need ALL courses and topics with complete data structure
  const learningAnalyticsBusinessRules = `RULE 1: Return ALL courses regardless of status (include 'active', 'archived', exclude only 'deleted')
RULE 2: For each course, include ALL topics (status != 'deleted')
RULE 3: For each topic, include ALL contents (no filtering)
RULE 4: Include nested structure: courses[] -> topics[] -> contents[]
RULE 5: Include standalone topics (course_id IS NULL) in separate array: topics_stand_alone[]
RULE 6: For courses: include course_id, course_name, course_language, trainer_id, trainer_name, permission, total_usage_count, created_at, status
RULE 7: For topics: include topic_id, topic_name, topic_language, skills[], contents[]
RULE 8: For contents: include content_id, content_type (from content_types.type_name), content_data, generation_methods (from generation_methods.method_name), generation_method_id
RULE 9: CRITICAL - Query contents from 'content' table ONLY, NEVER from 'content_history' table
RULE 10: content_history table is for version tracking/audit - LearningAnalytics needs current/live content only
RULE 11: Join content_types table to get type_name (content_type)
RULE 12: Join generation_methods table to get method_name (generation_methods)
RULE 13: permissions field in trainer_courses can be: 'all' (string) OR array of org_uuid strings OR NULL
RULE 14: trainer_name is not stored in Content Studio DB - use trainer_id as placeholder or fetch from Directory microservice
RULE 15: total_usage_count comes from usage_count field in trainer_courses and topics tables
RULE 16: Do NOT filter by learner_company or skills - return everything
RULE 17: Order courses by created_at DESC, topics by created_at DESC, contents by created_at DESC
RULE 18: NEVER use content_history table - only 'content' table contains the current active content`;

  // Use Course Builder rules by default (for backward compatibility)
  // If parsedRequest has businessRules field, use it instead
  const businessRules = parsedRequest.businessRules || courseBuilderBusinessRules;

  // Step 1: Search for ORGANIZATION-SPECIFIC course using SHARED AI Query Builder
  try {
    // Use the SHARED AI Query Builder prompt
    // Services pass ONLY: schema, request body, business rules, task
    const sanitizedSql = await generateSQLQueryUsingSharedPrompt({
      schema: migrationContent,
      requestBody: requestBody, // Pass original request body as-is
      businessRules: businessRules,
      task: `Generate a PostgreSQL SELECT query to find an ORGANIZATION-SPECIFIC course from trainer_courses table where:
- permissions contains the learner_company value
- All other rules apply`,
    });

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
  } catch (error) {
    logger.warn('[UseCase] Organization-specific course search failed', {
      error: error.message,
    });
  }

  // Step 2: Search for PUBLIC course using SHARED AI Query Builder
  try {
    // Use the SHARED AI Query Builder prompt
    // Services pass ONLY: schema, request body, business rules, task
    const sanitizedPublicSql = await generateSQLQueryUsingSharedPrompt({
      schema: migrationContent,
      requestBody: requestBody, // Pass original request body as-is
      businessRules: businessRules,
      task: `Generate a PostgreSQL SELECT query to find a PUBLIC course from trainer_courses table where:
- permissions is NULL OR permissions = ''
- All other rules apply`,
    });

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
  } catch (error) {
    logger.warn('[UseCase] Public course search failed', {
      error: error.message,
    });
  }

  // No course found
  logger.info('[UseCase] No suitable course found');
  return null;
}

