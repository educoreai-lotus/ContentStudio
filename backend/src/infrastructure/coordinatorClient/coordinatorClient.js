import axios from 'axios';
import { logger } from '../logging/Logger.js';
import { generateSignature, verifySignature } from '../../utils/signature.js';

const SERVICE_NAME = process.env.SERVICE_NAME || 'content-studio';

/**
 * Post request to Coordinator with ECDSA signature
 * All internal microservice calls should use this helper
 * @param {Object} envelope - Request envelope (exactly as it was before)
 * @param {Object} options - Optional configuration
 * @param {string} options.endpoint - Custom endpoint (default: /api/fill-content-metrics)
 * @param {number} options.timeout - Request timeout in ms (default: 1200000 = 20 minutes)
 * @returns {Promise<Object>} Response data from Coordinator
 * @throws {Error} If request fails
 */
export async function postToCoordinator(envelope, options = {}) {
  const coordinatorUrl = process.env.COORDINATOR_URL;
  const privateKey = process.env.CS_COORDINATOR_PRIVATE_KEY;
  const coordinatorPublicKey = process.env.COORDINATOR_PUBLIC_KEY || null;

  // Validate required environment variables
  if (!coordinatorUrl) {
    throw new Error('COORDINATOR_URL environment variable is required');
  }

  if (!privateKey) {
    throw new Error('CS_COORDINATOR_PRIVATE_KEY environment variable is required for signing requests');
  }

  // Clean URL (remove trailing slash)
  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');

  // Default endpoint is /api/fill-content-metrics/ (Coordinator proxy endpoint)
  let endpoint = options.endpoint || '/api/fill-content-metrics/';

  // Normalize endpoint to always end with exactly one slash
  endpoint = endpoint.replace(/\/+$/, '') + '/';

  const registrationUrl = `${cleanCoordinatorUrl}${endpoint}`;

  // Default timeout: 20 minutes (1200000 ms) to match server timeout
  // This is needed for long-running AI content generation requests
  const timeout = options.timeout || 1200000; // 20 minutes default timeout

  try {
    // IMPORTANT: Deep clone envelope before signing to prevent mutations by axios
    // This ensures the object we sign is identical to what we send
    const envelopeToSend = JSON.parse(JSON.stringify(envelope));
    
    // Log the exact envelope structure before signing
    const envelopeStringForSigning = JSON.stringify(envelopeToSend);
    logger.info('[CoordinatorClient] Envelope to sign and send', {
      envelopeString: envelopeStringForSigning.substring(0, 500) + (envelopeStringForSigning.length > 500 ? '...' : ''),
      envelopeStringLength: envelopeStringForSigning.length,
      envelopeKeys: Object.keys(envelopeToSend),
      payloadKeys: envelopeToSend.payload ? Object.keys(envelopeToSend.payload) : [],
      responseKeys: envelopeToSend.response ? Object.keys(envelopeToSend.response) : [],
    });
    
    // IMPORTANT: Sign the FULL envelope (as per POSTMAN_COURSE_BUILDER_REQUEST.md)
    // Message format: "educoreai-{serviceName}-{sha256(JSON.stringify(envelope))}"
    const signature = generateSignature(SERVICE_NAME, privateKey, envelopeToSend);

    // Log what axios will actually send (after serialization)
    const envelopeStringForAxios = JSON.stringify(envelopeToSend);
    const matchesSigned = envelopeStringForSigning === envelopeStringForAxios;
    
    logger.info('[CoordinatorClient] Envelope string that axios will send', {
      envelopeString: envelopeStringForAxios.substring(0, 500) + (envelopeStringForAxios.length > 500 ? '...' : ''),
      envelopeStringLength: envelopeStringForAxios.length,
      matchesSigned,
      signedStringLength: envelopeStringForSigning.length,
    });
    
    // Send POST request with signature headers
    // Use responseType: 'text' to get raw response body for signature verification
    // Use envelopeToSend (cloned) to ensure it matches what we signed
    const response = await axios.post(registrationUrl, envelopeToSend, {
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': SERVICE_NAME,
        'X-Signature': signature,
        'X-Request-Timeout': String(timeout), // Pass timeout to Coordinator so it can use it for downstream requests
      },
      timeout,
      responseType: 'text', // Get raw response as string
    });

    logger.debug('[CoordinatorClient] Request successful', {
      endpoint,
      status: response.status,
    });

    // Get raw response body string (before parsing)
    const rawBodyString = response.data;

    // Parse JSON from raw body
    let parsedData;
    try {
      parsedData = JSON.parse(rawBodyString);
    } catch (parseError) {
      logger.error('[CoordinatorClient] Failed to parse response JSON', {
        endpoint,
        error: parseError.message,
      });
      throw new Error(`Failed to parse Coordinator response: ${parseError.message}`);
    }

    // Return object with raw body, headers, and parsed data
    // This allows clients to verify signature before using parsed data
    return {
      data: parsedData, // Parsed JSON (for backward compatibility)
      rawBodyString: rawBodyString, // Raw response body as string
      headers: response.headers, // Response headers (including X-Service-Name, X-Service-Signature)
    };
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