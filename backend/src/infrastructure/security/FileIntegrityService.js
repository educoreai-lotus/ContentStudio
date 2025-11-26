import crypto from 'crypto';
import { logger } from '../logging/Logger.js';

/**
 * File Integrity Service
 * Handles file hashing and digital signature generation for media files
 */
export class FileIntegrityService {
  constructor() {
    this.privateKey = process.env.CONTENT_STUDIO_PRIVATE_KEY || null;
    
    if (!this.privateKey) {
      logger.warn('[FileIntegrityService] CONTENT_STUDIO_PRIVATE_KEY not configured. File integrity protection will be disabled.');
    } else {
      // Validate that the private key is in PEM format
      try {
        // Try to create a key object to validate format
        crypto.createPrivateKey(this.privateKey);
        logger.info('[FileIntegrityService] Private key loaded successfully');
      } catch (error) {
        logger.error('[FileIntegrityService] Invalid private key format', {
          error: error.message,
        });
        this.privateKey = null;
      }
    }
  }

  /**
   * Check if file integrity protection is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.privateKey !== null;
  }

  /**
   * Generate SHA-256 hash of file buffer
   * @param {Buffer} fileBuffer - File buffer to hash
   * @returns {string} SHA-256 hash as hex string (64 characters)
   */
  generateFileHash(fileBuffer) {
    if (!fileBuffer || !(fileBuffer instanceof Buffer)) {
      throw new Error('Invalid file buffer provided for hashing');
    }

    if (fileBuffer.length === 0) {
      throw new Error('File buffer is empty');
    }

    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    const sha256Hash = hash.digest('hex');

    logger.debug('[FileIntegrityService] Generated SHA-256 hash', {
      hashLength: sha256Hash.length,
      fileSize: fileBuffer.length,
    });

    return sha256Hash;
  }

  /**
   * Sign a hash using the private key
   * @param {string} hash - SHA-256 hash (hex string)
   * @returns {string} Base64-encoded digital signature
   */
  signHash(hash) {
    if (!this.privateKey) {
      throw new Error('Private key not configured. Cannot generate digital signature.');
    }

    if (!hash || typeof hash !== 'string' || hash.length !== 64) {
      throw new Error('Invalid hash provided. Expected 64-character hex string.');
    }

    try {
      // Sign the hash using RSA-SHA256
      // Note: We sign the hash itself (not the file), as per digital signature best practices
      // Using crypto.sign("sha256", Buffer.from(hash), privateKey) as specified
      const signature = crypto.sign('sha256', Buffer.from(hash, 'hex'), this.privateKey);

      const base64Signature = signature.toString('base64');

      logger.debug('[FileIntegrityService] Generated digital signature', {
        hashLength: hash.length,
        signatureLength: base64Signature.length,
      });

      return base64Signature;
    } catch (error) {
      logger.error('[FileIntegrityService] Failed to sign hash', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to generate digital signature: ${error.message}`);
    }
  }

  /**
   * Generate hash and signature for a file buffer
   * @param {Buffer} fileBuffer - File buffer to process
   * @returns {Object} Hash and signature
   */
  async generateHashAndSignature(fileBuffer) {
    if (!this.isEnabled()) {
      logger.warn('[FileIntegrityService] File integrity protection is disabled (no private key)');
      return {
        sha256Hash: null,
        digitalSignature: null,
      };
    }

    try {
      const sha256Hash = this.generateFileHash(fileBuffer);
      const digitalSignature = this.signHash(sha256Hash);

      return {
        sha256Hash,
        digitalSignature,
      };
    } catch (error) {
      logger.error('[FileIntegrityService] Failed to generate hash and signature', {
        error: error.message,
        stack: error.stack,
      });
      // Don't throw - return null values to allow upload to continue
      // The system can still function without integrity protection
      return {
        sha256Hash: null,
        digitalSignature: null,
      };
    }
  }

  /**
   * Verify a digital signature (for future use in GET endpoints)
   * @param {string} hash - SHA-256 hash (hex string)
   * @param {string} signature - Base64-encoded signature
   * @param {string} publicKey - Public key in PEM format
   * @returns {boolean} True if signature is valid
   * 
   * TODO: Implement this method in download/GET endpoints to verify file integrity
   * TODO: Store CONTENT_STUDIO_PUBLIC_KEY in environment variables
   * TODO: Use this method to verify files before serving them to clients
   */
  static verifySignature(hash, signature, publicKey) {
    if (!hash || !signature || !publicKey) {
      return false;
    }

    try {
      const signatureBuffer = Buffer.from(signature, 'base64');
      const hashBuffer = Buffer.from(hash, 'hex');

      const verified = crypto.verify(
        'sha256',
        hashBuffer,
        publicKey,
        signatureBuffer
      );

      return verified;
    } catch (error) {
      logger.error('[FileIntegrityService] Signature verification failed', {
        error: error.message,
      });
      return false;
    }
  }
}

