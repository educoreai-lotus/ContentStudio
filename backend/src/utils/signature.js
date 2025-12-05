import crypto from 'crypto';
import { logger } from '../infrastructure/logging/Logger.js';

/**
 * Build message for ECDSA signing
 * Format: "educoreai-{serviceName}-{payloadHash}"
 * Matches Coordinator specification exactly
 * @param {string} serviceName - Service name (e.g., "content-studio")
 * @param {Object} payload - Payload object to sign (optional)
 * @returns {string} Message string for signing
 */
export function buildMessage(serviceName, payload) {
  // Start with base message
  let message = `educoreai-${serviceName}`;
  
  // If payload exists, add SHA256 hash of the payload
  if (payload) {
    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto.createHash('sha256')
      .update(payloadString)
      .digest('hex');
    message = `${message}-${payloadHash}`;
  }

  logger.info('[Signature] Built message for signing', {
    serviceName,
    message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
    messageLength: message.length,
    hasPayload: !!payload,
    payloadHash: payload ? crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').substring(0, 16) + '...' : null,
  });

  return message;
}

/**
 * Generate ECDSA P-256 signature
 * @param {string} serviceName - Service name (e.g., "content-studio")
 * @param {string} privateKeyPem - Private key in PEM format (from env var)
 * @param {Object} payload - Payload object to sign
 * @returns {string} Base64-encoded signature
 * @throws {Error} If private key is invalid or signing fails
 */
export function generateSignature(serviceName, privateKeyPem, payload) {
  if (!privateKeyPem || typeof privateKeyPem !== 'string') {
    throw new Error('Private key is required and must be a string');
  }

  if (!serviceName || typeof serviceName !== 'string') {
    throw new Error('Service name is required and must be a string');
  }

  try {
    // Build message for signing
    const message = buildMessage(serviceName, payload);
    
    // Create private key object from PEM string
    let privateKey;
    try {
      // Try to create key from PEM format
      privateKey = crypto.createPrivateKey({
        key: privateKeyPem,
        format: 'pem',
      });
    } catch (pemError) {
      // If PEM format fails, try DER format (base64 decoded)
      try {
        const keyBuffer = Buffer.from(privateKeyPem, 'base64');
        privateKey = crypto.createPrivateKey({
          key: keyBuffer,
          format: 'der',
          type: 'pkcs8',
        });
      } catch (derError) {
        throw new Error(`Failed to parse private key: ${pemError.message}`);
      }
    }
    
    // Sign the message using ECDSA P-256
    const signature = crypto.sign('sha256', Buffer.from(message, 'utf8'), {
      key: privateKey,
      dsaEncoding: 'ieee-p1363', // ECDSA P-256 uses IEEE P1363 encoding
    });
    
    // Return Base64-encoded signature
    const base64Signature = signature.toString('base64');
    
    logger.info('[Signature] Generated ECDSA signature', {
      serviceName,
      message,
      signatureLength: base64Signature.length,
      signaturePrefix: base64Signature.substring(0, 20) + '...',
      signatureFull: base64Signature, // Full signature for debugging
    });
    
    return base64Signature;
  } catch (error) {
    logger.error('[Signature] Failed to generate signature', {
      error: error.message,
      stack: error.stack,
      serviceName,
    });
    throw new Error(`Signature generation failed: ${error.message}`);
  }
}

/**
 * Verify ECDSA P-256 signature (optional, for future use)
 * @param {string} serviceName - Service name
 * @param {string} publicKeyPem - Public key in PEM format
 * @param {Object} payload - Payload object that was signed
 * @param {string} signature - Base64-encoded signature to verify
 * @returns {boolean} True if signature is valid
 */
export function verifySignature(serviceName, publicKeyPem, payload, signature) {
  if (!publicKeyPem || !signature) {
    return false;
  }

  try {
    // Build the same message that was signed
    const message = buildMessage(serviceName, payload);
    
    // Create public key object from PEM string
    let publicKey;
    try {
      publicKey = crypto.createPublicKey({
        key: publicKeyPem,
        format: 'pem',
      });
    } catch (pemError) {
      // Try DER format if PEM fails
      try {
        const keyBuffer = Buffer.from(publicKeyPem, 'base64');
        publicKey = crypto.createPublicKey({
          key: keyBuffer,
          format: 'der',
          type: 'spki',
        });
      } catch (derError) {
        logger.error('[Signature] Failed to parse public key for verification', {
          error: pemError.message,
        });
        return false;
      }
    }
    
    // Verify the signature
    const signatureBuffer = Buffer.from(signature, 'base64');
    const isValid = crypto.verify(
      'sha256',
      Buffer.from(message, 'utf8'),
      {
        key: publicKey,
        dsaEncoding: 'ieee-p1363',
      },
      signatureBuffer
    );
    
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

