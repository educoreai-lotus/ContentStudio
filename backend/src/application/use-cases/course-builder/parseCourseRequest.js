/**
 * Step 1 - Parses and validates Course Builder request data.
 * This function is only called after the POST /api/fill-content-metrics endpoint
 * receives a request from Course Builder. It is the first step in the workflow.
 * Next steps will fetch preferred language, search company courses, search
 * standalone topics, and generate missing content using AI if needed.
 * 
 * @param {Object} requestData - The parsed request data from Course Builder
 * @returns {Object} Clean object with learner_id, learner_name, learner_company, skills
 * @throws {Error} If validation fails
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

  // Return clean object without modifying values
  return {
    learner_id: payload.learner_id,
    learner_name: payload.learner_name || '',
    learner_company: payload.learner_company,
    skills: payload.skills,
  };
}

