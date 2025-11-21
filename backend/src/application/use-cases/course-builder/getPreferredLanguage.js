import { fillDirectory } from '../../services/fillers/fillDirectory.js';
import { logger } from '../../../infrastructure/logging/Logger.js';

/**
 * Step 2 - Requests learner's preferred language from Directory.
 * All communication MUST use stringified JSON between microservices.
 * The request must include { response: { preferred_language: "..." } } as template.
 * If Directory is unreachable or returns invalid data, fallback is:
 * { preferred_language: "en" }.
 * 
 * @param {Object} parsedRequest - Validated object from parseCourseRequest()
 * @returns {Promise<Object>} Object with preferred_language
 * @throws {Error} Only if input is invalid, NOT if Directory fails
 */
export async function getPreferredLanguage(parsedRequest) {
  // Validate input
  if (!parsedRequest || typeof parsedRequest !== 'object') {
    throw new Error('parsedRequest must be an object');
  }

  if (!parsedRequest.learner_id) {
    throw new Error('parsedRequest.learner_id is required');
  }

  // Build request with response template
  const directoryRequest = {
    requester_service: 'content_studio',
    payload: {
      learner_id: parsedRequest.learner_id,
    },
    response: {
      preferred_language: '...',
    },
  };

  // Convert to stringified JSON (for external microservice communication protocol)
  const stringifiedRequest = JSON.stringify(directoryRequest);

  try {
    // Send to Directory (internal function can receive object directly)
    const directoryResponse = await fillDirectory(directoryRequest);

    // Parse the response (if it's a string, parse it; if it's already an object, use it)
    let parsedResponse;
    if (typeof directoryResponse === 'string') {
      parsedResponse = JSON.parse(directoryResponse);
    } else {
      parsedResponse = directoryResponse;
    }

    // Extract preferred_language from response
    // Only return if it's a valid language code (not the template "..." value)
    if (
      parsedResponse &&
      parsedResponse.response &&
      parsedResponse.response.preferred_language &&
      parsedResponse.response.preferred_language !== '...'
    ) {
      const language = String(parsedResponse.response.preferred_language).trim();
      // Validate it's a valid language code (2-5 characters, alphanumeric or dash)
      if (language && language.length >= 2 && language.length <= 5 && /^[a-z-]+$/i.test(language)) {
        logger.info('[UseCase] Received preferred language from Directory', {
          learner_id: parsedRequest.learner_id,
          preferred_language: language.toLowerCase(),
        });
        return {
          preferred_language: language.toLowerCase(),
        };
      }
    }

    // Fallback if Directory doesn't return valid preferred_language
    logger.warn('[UseCase] Directory did not return valid preferred_language, using fallback', {
      learner_id: parsedRequest.learner_id,
      returned_value: parsedResponse?.response?.preferred_language || 'missing',
    });
    return {
      preferred_language: 'en',
    };
  } catch (error) {
    // Fallback on any error (Directory unreachable, invalid response, etc.)
    logger.warn('[UseCase] Directory request failed, using fallback language', {
      error: error.message,
      learner_id: parsedRequest.learner_id,
    });
    return {
      preferred_language: 'en',
    };
  }
}

