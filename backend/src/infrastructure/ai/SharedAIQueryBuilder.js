import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { logger } from '../logging/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Shared AI Query Builder
 * Centralized service for generating SQL queries using OpenAI
 * This is the SINGLE SOURCE OF TRUTH for AI-generated SQL queries
 * All services MUST use this shared prompt structure
 */

/**
 * Load database schema from migration file
 * @returns {string} Database schema content
 * Note: This function is synchronous for module-level loading
 */
export function loadDatabaseSchema() {
  try {
    // Try multiple possible paths for migration file
    const possiblePaths = [
      // Path 1: Relative to this file (development)
      join(__dirname, '../../../../database/migrations/20250122_initial_schema.sql'),
      // Path 2: From backend directory
      join(process.cwd(), 'database/migrations/20250122_initial_schema.sql'),
      // Path 3: From app root (Railway/Docker)
      '/app/database/migrations/20250122_initial_schema.sql',
      // Path 4: From backend directory in app
      '/app/backend/database/migrations/20250122_initial_schema.sql',
    ];

    // Try to read from first available path (synchronously for module-level loading)
    for (const path of possiblePaths) {
      try {
        const schema = readFileSync(path, 'utf-8');
        logger.info('[SharedAIQueryBuilder] Loaded database schema', {
          path,
          schemaLength: schema.length,
        });
        return schema;
      } catch (error) {
        // Continue to next path
        continue;
      }
    }

    // If all paths failed, return empty string (will cause error in OpenAI call)
    logger.error('[SharedAIQueryBuilder] Failed to load database schema from all possible paths', {
      triedPaths: possiblePaths,
    });
    return '';
  } catch (error) {
    logger.error('[SharedAIQueryBuilder] Error loading database schema', {
      error: error.message,
    });
    return '';
  }
}

/**
 * Generate SQL query using shared OpenAI prompt
 * This is the SINGLE SOURCE OF TRUTH for AI SQL generation
 * All services MUST use this function to ensure consistency
 * 
 * @param {Object} params - Parameters for SQL generation
 * @param {string} params.schema - Database schema content
 * @param {Object} params.requestBody - Request body with data for query
 * @param {string} params.businessRules - Business rules for the query
 * @param {string} params.task - Specific task description for the query
 * @returns {Promise<string>} Generated SQL query
 */
export async function generateSQLQueryUsingSharedPrompt({ schema, requestBody, businessRules, task }) {
  try {
    // Validate inputs
    if (!schema || typeof schema !== 'string') {
      throw new Error('Schema must be a non-empty string');
    }
    if (!requestBody || typeof requestBody !== 'object') {
      throw new Error('requestBody must be an object');
    }
    if (!businessRules || typeof businessRules !== 'string') {
      throw new Error('businessRules must be a non-empty string');
    }
    if (!task || typeof task !== 'string') {
      throw new Error('task must be a non-empty string');
    }

    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Initialize OpenAI client
    const openaiClient = new OpenAIClient({ apiKey });

    // Build the shared prompt structure
    // This is the EXACT prompt structure used by all services
    const systemPrompt = `You are a PostgreSQL database expert. Your task is to generate safe, optimized SQL queries based on the provided database schema, request data, business rules, and task description.

CRITICAL RULES:
1. Generate ONLY valid PostgreSQL SELECT queries
2. NEVER use placeholders ($1, $2, etc.) - embed values directly in the query
3. ALWAYS sanitize string values to prevent SQL injection
4. Follow the business rules EXACTLY
5. Use proper JOINs when accessing related tables
6. Return ONLY the SQL query, no explanations or markdown formatting
7. Ensure the query is optimized and uses proper indexes
8. Handle NULL values correctly
9. Use proper data types and casting when needed
10. Follow PostgreSQL best practices`;

    const userPrompt = `DATABASE SCHEMA:
${schema}

REQUEST BODY:
${JSON.stringify(requestBody, null, 2)}

BUSINESS RULES:
${businessRules}

TASK:
${task}

Generate a PostgreSQL SELECT query that fulfills the task while following all business rules. Return ONLY the SQL query, no explanations.`;

    // Generate SQL query using OpenAI (gpt-3.5-turbo for cost efficiency)
    const generatedSql = await openaiClient.generateText(userPrompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.1, // Low temperature for deterministic SQL generation
      max_tokens: 1000,
      systemPrompt,
    });

    // Clean up the response (remove markdown code blocks if present)
    let cleanedSql = generatedSql.trim();
    
    // Remove markdown code blocks (```sql ... ```)
    if (cleanedSql.startsWith('```')) {
      cleanedSql = cleanedSql.replace(/^```(?:sql|SQL)?\n?/g, '').replace(/\n?```$/g, '');
    }
    
    // Remove leading/trailing whitespace
    cleanedSql = cleanedSql.trim();

    logger.info('[SharedAIQueryBuilder] Generated SQL query', {
      sqlLength: cleanedSql.length,
      sqlPreview: cleanedSql.substring(0, 200),
    });

    return cleanedSql;
  } catch (error) {
    logger.error('[SharedAIQueryBuilder] Failed to generate SQL query', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to generate SQL query: ${error.message}`);
  }
}

