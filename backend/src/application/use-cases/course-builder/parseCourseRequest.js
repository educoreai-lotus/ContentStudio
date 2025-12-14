/**
 * Step 1 - Parses and validates Course Builder request data.
 * This function is only called after the POST /api/fill-content-metrics endpoint
 * receives a request from Course Builder. It is the first step in the workflow.
 * 
 * NOTE: preferred_language is now REQUIRED and always provided by Course Builder.
 * The fallback to Directory has been removed - Course Builder always sends preferred_language.
 * 
 * Next steps will use preferred language from Course Builder,
 * search company courses, search standalone topics, and generate missing content using AI if needed.
 * 
 * @param {Object} requestData - The parsed request data from Course Builder
 * @returns {Object} Clean object with learner_id, learner_name, learner_company, skills, preferred_language (required)
 * @throws {Error} If validation fails (including if preferred_language is missing or invalid)
 */
export function parseCourseRequest(requestData) {
  // Validate that requestData.payload exists and is an object
  if (!requestData || typeof requestData !== 'object') {
    throw new Error('requestData must be an object');
  }

  if (!requestData.payload || typeof requestData.payload !== 'object') {
    throw new Error('requestData.payload is required and must be an object');
  }

  const { payload } = requestData;

  // Validate learner_id
  if (!payload.learner_id) {
    throw new Error('payload.learner_id is required');
  }

  // Validate learner_company
  if (!payload.learner_company) {
    throw new Error('payload.learner_company is required');
  }

  // Validate skills (must be a non-empty array)
  if (!Array.isArray(payload.skills) || payload.skills.length === 0) {
    throw new Error('payload.skills is required and must be a non-empty array');
  }

  // Validate preferred_language (REQUIRED - Course Builder now always sends it)
  if (!payload.preferred_language || typeof payload.preferred_language !== 'string') {
    throw new Error('payload.preferred_language is required and must be a string');
  }

  // Validate preferred_language format (2-5 characters, alphanumeric or dash)
  const language = payload.preferred_language.trim().toLowerCase();
  if (language.length < 2 || language.length > 5 || !/^[a-z-]+$/i.test(language)) {
    throw new Error('payload.preferred_language must be a valid language code (2-5 characters, alphanumeric or dash)');
  }

  // Return clean object without modifying values
  return {
    learner_id: payload.learner_id,
    learner_name: payload.learner_name || '',
    learner_company: payload.learner_company,
    skills: payload.skills,
    trainer_id: payload.trainer_id || null, // Optional: trainer_id for searching existing content
    preferred_language: language, // REQUIRED - Course Builder always sends it (no more Directory fallback)
  };
}

