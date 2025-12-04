import axios from 'axios';
import { logger } from '../logging/Logger.js';
import { generateSignature } from '../../utils/signature.js';

const SERVICE_NAME = 'content-studio';

/**
 * Post request to Coordinator with ECDSA signature
 * All internal microservice calls should use this helper
 * @param {Object} envelope - Request envelope (exactly as it was before)
 * @param {Object} options - Optional configuration
 * @param {string} options.endpoint - Custom endpoint (default: /api/fill-content-metrics)
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @returns {Promise<Object>} Response data from Coordinator
 * @throws {Error} If request fails
 */
export async function postToCoordinator(envelope, options = {}) {
  const coordinatorUrl = process.env.COORDINATOR_URL;
  const privateKey = process.env.CONTENT_STUDIO_PRIVATE_KEY;

  // Validate required environment variables
  if (!coordinatorUrl) {
    throw new Error('COORDINATOR_URL environment variable is required');
  }

  if (!privateKey) {
    throw new Error('CONTENT_STUDIO_PRIVATE_KEY environment variable is required for signing requests');
  }

  // Clean URL (remove trailing slash)
  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');
  
  // Default endpoint is /api/fill-content-metrics (Coordinator proxy endpoint)
  const endpoint = options.endpoint || '/api/fill-content-metrics';
  const registrationUrl = `${cleanCoordinatorUrl}${endpoint}`;
  
  const timeout = options.timeout || 30000;

  try {
    // Generate ECDSA signature for the envelope
    const signature = generateSignature(SERVICE_NAME, privateKey, envelope);

    // Send POST request with signature headers
    const response = await axios.post(registrationUrl, envelope, {
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': SERVICE_NAME,
        'X-Signature': signature,
      },
      timeout,
    });

    logger.debug('[CoordinatorClient] Request successful', {
      endpoint,
      status: response.status,
    });

    return response.data;
  } catch (error) {
    logger.error('[CoordinatorClient] Request failed', {
      endpoint,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
    });

    // Re-throw the error so callers can handle it
    throw error;
  }
}

/**
 * Get Coordinator client instance (for future extensibility)
 * @returns {Object} Coordinator client methods
 */
export function getCoordinatorClient() {
  return {
    post: postToCoordinator,
  };
}

