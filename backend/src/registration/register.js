import axios from 'axios';
import { logger } from '../infrastructure/logging/Logger.js';
import { generateSignature } from '../utils/signature.js';

/**
 * Service Registration Constants
 */
const SERVICE_NAME = process.env.SERVICE_NAME || 'content-studio';
const SERVICE_VERSION = '1.0.0';
const SERVICE_DESCRIPTION = 'Content generation and course-building microservice';

const METADATA = {
  team: 'Content Studio',
  owner: 'system',
  capabilities: [
    'generate_content',
    'course_management',
    'lesson_creation',
  ],
};

/**
 * Exponential backoff delay calculator
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function getBackoffDelay(attempt) {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  return Math.min(1000 * Math.pow(2, attempt), 16000);
}


/**
 * Register service with Coordinator
 * @returns {Promise<{success: boolean, serviceId?: string, status?: string, error?: string}>}
 */
async function registerWithCoordinator() {
  const coordinatorUrl = process.env.COORDINATOR_URL;
  const serviceEndpoint = process.env.SERVICE_ENDPOINT;
  const privateKey = process.env.CS_COORDINATOR_PRIVATE_KEY;

  // Validate required environment variables
  if (!coordinatorUrl) {
    const error = 'COORDINATOR_URL environment variable is required';
    logger.error(`❌ Registration failed: ${error}`);
    return { success: false, error };
  }

  if (!serviceEndpoint) {
    const error = 'SERVICE_ENDPOINT environment variable is required';
    logger.error(`❌ Registration failed: ${error}`);
    return { success: false, error };
  }

  if (!privateKey) {
    const error = 'CS_COORDINATOR_PRIVATE_KEY environment variable is required for ECDSA signing';
    logger.error(`❌ Registration failed: ${error}`);
    return { success: false, error };
  }

  // Clean URLs (remove trailing slashes)
  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');
  const cleanServiceEndpoint = serviceEndpoint.replace(/\/$/, '');

  const registrationUrl = `${cleanCoordinatorUrl}/register`;
  const registrationPayload = {
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    endpoint: cleanServiceEndpoint,
    healthCheck: '/health',
    description: SERVICE_DESCRIPTION,
    metadata: METADATA,
  };

  // Generate ECDSA signature for authentication
  let signature;
  try {
    logger.info('[Registration] Generating signature', {
      serviceName: SERVICE_NAME,
      privateKeyLength: privateKey?.length,
      privateKeyPrefix: privateKey?.substring(0, 50) + '...',
      registrationPayload,
    });
    
    signature = generateSignature(
      SERVICE_NAME,
      privateKey,
      registrationPayload
    );
    
    logger.info('[Registration] Signature generated successfully', {
      signatureLength: signature?.length,
      signaturePrefix: signature?.substring(0, 20) + '...',
    });
  } catch (signatureError) {
    const error = `Failed to generate ECDSA signature: ${signatureError.message}`;
    logger.error(`❌ Registration failed: ${error}`, {
      error: signatureError.message,
      stack: signatureError.stack,
    });
    return { success: false, error };
  }

  logger.info('🔄 Attempting to register with Coordinator...', {
    coordinatorUrl: cleanCoordinatorUrl,
    registrationUrl: registrationUrl,
    serviceEndpoint: cleanServiceEndpoint,
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    hasSignature: !!signature,
  });

  // Retry logic with exponential backoff (up to 5 attempts)
  const maxAttempts = 5;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Service-Name': SERVICE_NAME,
        'X-Signature': signature,
      };

      logger.debug('Sending registration request', {
        url: registrationUrl,
        headers: {
          'Content-Type': requestHeaders['Content-Type'],
          'X-Service-Name': requestHeaders['X-Service-Name'],
          'X-Signature': signature.substring(0, 20) + '...',
        },
        payload: registrationPayload,
      });

      const response = await axios.post(registrationUrl, registrationPayload, {
        headers: requestHeaders,
        timeout: 10000, // 10 seconds timeout
      });

      // Check if registration was successful
      if (response.status >= 200 && response.status < 300) {
        const serviceId = response.data?.serviceId || response.data?.id || 'unknown';
        const status = response.data?.status || 'pending_migration';

        logger.info('✓ Registered with Coordinator', {
          serviceId,
          status,
          attempt: attempt + 1,
        });

        console.log('✓ Registered with Coordinator');
        console.log(`Service ID: ${serviceId}`);
        console.log(`Status: ${status}`);

        return {
          success: true,
          serviceId,
          status,
        };
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    } catch (error) {
      lastError = error;

      // Determine error type and create friendly message
      let errorMessage = 'Unknown error';
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const statusText = error.response.statusText;
        const data = error.response.data;

        if (status === 400) {
          errorMessage = `Bad request: ${data?.message || statusText}`;
        } else if (status === 401) {
          errorMessage = `Unauthorized: Authentication failed. Response: ${JSON.stringify(data || {})}. Please verify CS_COORDINATOR_PRIVATE_KEY is correct.`;
          logger.error('Authentication failed - signature rejected', {
            status,
            responseData: data,
            serviceName: SERVICE_NAME,
            signatureLength: signature?.length,
            signaturePrefix: signature?.substring(0, 20),
          });
        } else if (status === 403) {
          errorMessage = 'Forbidden: Access denied';
        } else if (status === 404) {
          errorMessage = `Not found: Registration endpoint not available at ${registrationUrl}. Please verify COORDINATOR_URL is correct and the Coordinator service has the /register endpoint.`;
        } else if (status >= 500) {
          errorMessage = `Server error: ${statusText}`;
        } else {
          errorMessage = `HTTP ${status}: ${data?.message || statusText}`;
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'No response from Coordinator service';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused: Coordinator service is not reachable';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout: Coordinator service did not respond in time';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Host not found: Invalid Coordinator URL';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }

      // Log attempt
      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) {
        logger.error(`❌ Registration failed after ${maxAttempts} attempts: ${errorMessage}`, {
          attempt: attempt + 1,
          maxAttempts,
          error: error.message,
          coordinatorUrl: cleanCoordinatorUrl,
        });
      } else {
        const delay = getBackoffDelay(attempt);
        logger.warn(`⚠️ Registration attempt ${attempt + 1}/${maxAttempts} failed: ${errorMessage}. Retrying in ${delay}ms...`, {
          attempt: attempt + 1,
          maxAttempts,
          delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  return {
    success: false,
    error: lastError?.message || 'Registration failed after all retry attempts',
  };
}

/**
 * Register service on startup
 * This function is non-blocking and will not crash the service if registration fails
 */
export async function registerService() {
  try {
    const result = await registerWithCoordinator();

    if (!result.success) {
      logger.warn('⚠️ Service registration failed, but continuing startup...', {
        error: result.error,
      });
      console.warn('⚠️ Service registration failed, but continuing startup...');
      console.warn(`Error: ${result.error}`);
    }
  } catch (error) {
    // Catch any unexpected errors to prevent service crash
    logger.error('❌ Unexpected error during service registration', {
      error: error.message,
      stack: error.stack,
    });
    console.error('❌ Unexpected error during service registration:', error.message);
    // Don't throw - allow service to continue
  }
}

