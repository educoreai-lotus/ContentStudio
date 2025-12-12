import { verifySignature } from '../../utils/signature.js';

/**
 * Verify Coordinator signature using ECDSA
 * 
 * IMPORTANT: Coordinator signs the payload object (not the raw string) using buildMessage:
 * - Coordinator calls: buildMessage('coordinator', payloadObject)
 * - This creates: "educoreai-coordinator-{sha256(JSON.stringify(payloadObject))}"
 * - Then signs this message
 * 
 * So we MUST:
 * 1. Parse rawBodyString to get the payload object
 * 2. Use verifySignature which calls buildMessage the same way
 * 
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

    // CRITICAL: Coordinator signs the payload OBJECT, not the raw string
    // Coordinator process:
    // 1. Creates response: { success: true, data: {...}, metadata: {...} }
    // 2. Signs it: generateSignature('coordinator', privateKey, data)
    // 3. buildMessage('coordinator', data) → "educoreai-coordinator-{sha256(JSON.stringify(data))}"
    // 4. Signs this message
    //
    // We MUST do the same:
    // 1. Parse rawBodyString to get the exact object Coordinator signed
    // 2. Use verifySignature which calls buildMessage('coordinator', payloadObject) the same way
    let payloadObject;
    try {
      payloadObject = JSON.parse(rawBodyString);
      
      // Log the object we're verifying to ensure it matches what Coordinator signed
      console.log('[verifyCoordinatorSignature] Parsed payload object', {
        hasSuccess: 'success' in payloadObject,
        hasData: 'data' in payloadObject,
        hasMetadata: 'metadata' in payloadObject,
        dataKeys: payloadObject.data ? Object.keys(payloadObject.data) : [],
        metadataKeys: payloadObject.metadata ? Object.keys(payloadObject.metadata) : [],
        // Re-stringify to see if it matches rawBodyString (should be identical)
        reStringifiedLength: JSON.stringify(payloadObject).length,
        rawBodyLength: rawBodyString.length,
      });
    } catch (parseError) {
      console.error('[verifyCoordinatorSignature] Failed to parse rawBodyString as JSON', {
        error: parseError.message,
        rawBodyPreview: rawBodyString?.substring(0, 200) || '',
      });
      return false;
    }

    // Use verifySignature which:
    // 1. Calls buildMessage('coordinator', payloadObject)
    // 2. Builds: "educoreai-coordinator-{sha256(JSON.stringify(payloadObject))}"
    // 3. Verifies signature against this message
    // This matches exactly how Coordinator generates the signature
    // IMPORTANT: Parameter order matches Coordinator: (serviceName, signature, publicKey, payload)
    const isValid = verifySignature('coordinator', signature, publicKey, payloadObject);
    
    console.log('[verifyCoordinatorSignature] Verification result', {
      isValid,
      payloadObjectKeys: payloadObject ? Object.keys(payloadObject) : [],
      signatureLength: signature?.length || 0,
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

