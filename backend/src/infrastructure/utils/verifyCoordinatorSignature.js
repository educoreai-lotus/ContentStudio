import crypto from 'crypto';

/**
 * Verify Coordinator signature using ECDSA
 * @param {string} publicKey - Coordinator public key (PEM format)
 * @param {string} signature - Base64-encoded signature
 * @param {string} rawBodyString - Raw response body as string (before JSON parsing)
 * @returns {boolean} True if signature is valid, false otherwise
 */
export function verifyCoordinatorSignature(publicKey, signature, rawBodyString) {
  try {
    // Log for debugging
    console.log('[verifyCoordinatorSignature] Starting verification', {
      publicKeyLength: publicKey?.length || 0,
      publicKeyPreview: publicKey?.substring(0, 100) || '',
      signatureLength: signature?.length || 0,
      signaturePreview: signature?.substring(0, 50) || '',
      rawBodyLength: rawBodyString?.length || 0,
      rawBodyPreview: rawBodyString?.substring(0, 200) || '',
    });

    // Ensure public key is in PEM format
    let pemKey = publicKey;
    if (!pemKey.includes('-----BEGIN')) {
      // If key doesn't have PEM headers, add them
      pemKey = `-----BEGIN PUBLIC KEY-----\n${pemKey}\n-----END PUBLIC KEY-----`;
    }

    const verifier = crypto.createVerify('SHA256');
    verifier.update(rawBodyString, 'utf8');
    verifier.end();
    
    const signatureBuffer = Buffer.from(signature, 'base64');
    const isValid = verifier.verify(pemKey, signatureBuffer);
    
    console.log('[verifyCoordinatorSignature] Verification result', {
      isValid,
      signatureBufferLength: signatureBuffer.length,
    });
    
    return isValid;
  } catch (err) {
    console.error('[verifyCoordinatorSignature] Signature verification failed:', {
      error: err.message,
      stack: err.stack,
      publicKeyLength: publicKey?.length || 0,
      signatureLength: signature?.length || 0,
      rawBodyLength: rawBodyString?.length || 0,
    });
    return false;
  }
}

