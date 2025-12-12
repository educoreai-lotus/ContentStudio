import crypto from 'crypto';
import { logger } from '../infrastructure/logging/Logger.js';

/**
 * Build message for ECDSA 
 * Format: "educoreai-{serviceName}-{payloadHash}"
 * payloadHash = sha256(JSON.stringify(payload)) in hex
 *
 * If payload is null/undefined, we fall back to:
 *   "educoreai-{serviceName}"
 */
export function buildMessage(serviceName, payload) {
  if (!serviceName || typeof serviceName !== 'string') {
    throw new Error('Service name is required and must be a string');
  }

  let message = `educoreai-${serviceName}`;
  let payloadHash = null;

  if (payload !== undefined && payload !== null) {
    const payloadString = JSON.stringify(payload);
    payloadHash = crypto
      .createHash('sha256')
      .update(payloadString)
      .digest('hex');

    message = `${message}-${payloadHash}`;
  }

  logger.info('[Signature] Built message for signing', {
    serviceName,
    message: message.length > 120
      ? message.substring(0, 120) + '...'
      : message,
    messageLength: message.length,
    hasPayload: payload !== undefined && payload !== null,
    payloadHash: payloadHash
      ? payloadHash.substring(0, 16) + '...'
      : null,
  });

  return message;
}

/**
 * Generate ECDSA P-256 signature (DER, Base64)
 *
 * IMPORTANT:
 * - Uses Node's createSign("SHA256") → sign(privateKeyPem, "base64")
 * - Output is DER-encoded ECDSA signature in Base64, with no whitespace.
 * - Message format is: "educoreai-{serviceName}-{sha256(JSON.stringify(payload))}"
 *
 * @param {string} serviceName - Service name (e.g. "content-studio")
 * @param {string} privateKeyPem - Private key in PEM format
 * @param {Object} payload - Payload object to sign (must match the object actually sent)
 * @returns {string} Base64-encoded DER signature (no whitespace)
 */
export function generateSignature(serviceName, privateKeyPem, payload) {
  if (!privateKeyPem || typeof privateKeyPem !== 'string') {
    throw new Error('Private key is required and must be a string');
  }

  if (!serviceName || typeof serviceName !== 'string') {
    throw new Error('Service name is required and must be a string');
  }

  const message = buildMessage(serviceName, payload);

  try {
    // DER-encoded ECDSA via createSign
    const signer = crypto.createSign('SHA256');
    signer.update(message, 'utf8');
    signer.end();

    // Node's default for ECDSA here is DER; we request Base64 string
    const signatureBase64 = signer.sign(privateKeyPem, 'base64');

    // Ensure no whitespace / newlines
    const cleanSignature = signatureBase64.replace(/\s+/g, '');

    logger.info('[Signature] Generated ECDSA signature', {
      serviceName,
      signatureLength: cleanSignature.length,
      signaturePrefix: cleanSignature.substring(0, 20) + '...',
    });

    return cleanSignature;
  } catch (error) {
    logger.error('[Signature] Failed to generate signature', {
      error: error.message,
      serviceName,
    });
    throw new Error(`Signature generation failed: ${error.message}`);
  }
}

/**
 * Verify ECDSA P-256 signature (optional use)
 *
 * NOW also uses DER-compatible verification via createVerify("SHA256")
 * to match the DER encoding used in generateSignature.
 *
 * IMPORTANT: Parameter order matches Coordinator's verifySignature:
 * verifySignature(microserviceName, signature, publicKey, payload = null)
 *
 * @param {string} serviceName - Service name (used in message construction)
 * @param {string} signature - Base64-encoded DER ECDSA signature
 * @param {string} publicKeyPem - Public key in PEM format
 * @param {Object} payload - Payload object that was signed
 * @returns {boolean} True if signature is valid
 */
export function verifySignature(serviceName, signature, publicKeyPem, payload = null) {
  if (!publicKeyPem || !signature) {
    return false;
  }

  try {
    const message = buildMessage(serviceName, payload);

    const verifier = crypto.createVerify('SHA256');
    verifier.update(message, 'utf8');
    verifier.end();

    // Verify against DER Base64 signature
    const isValid = verifier.verify(publicKeyPem, signature, 'base64');

    logger.debug('[Signature] Signature verification result', {
      serviceName,
      isValid,
    });

    return isValid;
  } catch (error) {
    logger.error('[Signature] Signature verification failed', {
      error: error.message,
      serviceName,
    });
    return false;
  }
}
