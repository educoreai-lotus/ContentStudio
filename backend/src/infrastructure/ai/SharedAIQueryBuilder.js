import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { logger } from '../logging/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * SHARED AI Query Builder - Single Source of Truth
 * 
 * This is the ONLY place where AI Query Builder prompts are defined and executed.
 * ALL requests from /api/fill-content-metrics MUST use this shared function.
 * 
 * Architectural Rule:
 * - ONE shared prompt structure
 * - ONE shared execution flow
 * - Services pass ONLY: schema, request body, business rules, task
 * - NO per-service prompt logic
 * - NO custom wording
 * - NO duplicated prompts
 * 
 * @param {Object} params - Parameters for the query builder
 * @param {string} params.schema - Database schema content (from migration file)
 * @param {Object} [params.requestBody] - Original request body (optional, passed as-is)
 * @param {string} params.businessRules - Business rules for the query
 * @param {string} params.task - Task description for the query
 * @returns {Promise<string>} Generated and validated SQL query
 * @throws {Error} If OpenAI is not configured or query generation fails
 */
export async function generateSQLQueryUsingSharedPrompt({ schema, requestBody, businessRules, task }) {
  // Validate required parameters
  if (!schema || typeof schema !== 'string') {
    throw new Error('Schema is required and must be a string');
  }
  if (!businessRules || typeof businessRules !== 'string') {
    throw new Error('Business rules are required and must be a string');
  }
  if (!task || typeof task !== 'string') {
    throw new Error('Task is required and must be a string');
  }

  // Initialize OpenAI client
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openaiClient = new OpenAIClient({ apiKey: openaiApiKey });

  // Build the SHARED prompt structure
  // This is the ONLY place where the prompt template is defined
  let prompt = `You are an AI Query Builder for PostgreSQL. Generate ONLY a SELECT SQL query (no explanations, no markdown).

SCHEMA:
${schema}

BUSINESS RULES:
${businessRules}

`;

  // Add REQUEST section only if requestBody is provided
  if (requestBody && typeof requestBody === 'object') {
    prompt += `REQUEST:
${JSON.stringify(requestBody, null, 2)}

`;
  }

  // Add TASK section
  prompt += `TASK: ${task}

Return ONLY the SQL query, nothing else.`;

  // Generate SQL query using the shared execution flow
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
    throw new Error('AI returned non-SELECT SQL query');
  }

  return sanitizedSql;
}

/**
 * Helper function to load database schema from migration file
 * This is a convenience function - services can also load it themselves
 * 
 * @returns {string} Database schema content
 */
export function loadDatabaseSchema() {
  const migrationPath = join(__dirname, '../../../database/doc_migration_content_studio.sql');
  return readFileSync(migrationPath, 'utf-8');
}

