# Digital Signatures in Content Studio

Content Studio uses **ECDSA P-256** digital signatures to authenticate all outbound requests to the Coordinator microservice. This document describes the signature scheme, implementation, and usage.

## Overview

All internal microservice communication is routed through the Coordinator, which requires ECDSA-signed requests. Content Studio signs every request using its private key, and the Coordinator verifies signatures using the corresponding public key.

## Signature Scheme: ECDSA P-256

### Algorithm Details

- **Curve**: P-256 (secp256r1, prime256v1)
- **Hash Function**: SHA-256
- **Encoding**: IEEE P1363 format
- **Output**: Base64-encoded signature

### Why ECDSA P-256?

- **Security**: Provides 128-bit security level
- **Efficiency**: Smaller signatures than RSA (64 bytes vs 256+ bytes)
- **Standard**: Widely supported, NIST-approved curve
- **Performance**: Fast signing and verification

## Message Construction: `buildMessage()`

Before signing, the payload is transformed into a canonical message string using the pattern:

```
"educoreai-{serviceName}-{payloadSha256}"
```

### Process

1. **Stable JSON Stringification**: The payload object is converted to a JSON string using a deterministic algorithm that:
   - Sorts object keys at all nesting levels
   - Handles arrays recursively
   - Guarantees identical output for semantically equivalent objects

2. **SHA-256 Hashing**: The JSON string is hashed using SHA-256, producing a 64-character hexadecimal string.

3. **Message Assembly**: The final message is constructed as:
   ```
   educoreai-content-studio-a1b2c3d4e5f6...
   ```

### Example

```javascript
// Input payload
const payload = {
  requester_service: 'content-studio',
  payload: { topic_id: '123', skills: ['javascript'] },
  response: {}
};

// Step 1: Stable stringify (keys sorted)
// Result: '{"payload":{"skills":["javascript"],"topic_id":"123"},"requester_service":"content-studio","response":{}}'

// Step 2: SHA-256 hash
// Result: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456'

// Step 3: Build message
// Result: 'educoreai-content-studio-a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456'
```

## Signature Generation

### Function: `generateSignature(serviceName, privateKeyPem, payload)`

**Location**: `src/utils/signature.js`

**Process**:

1. Build the canonical message using `buildMessage()`
2. Parse the private key (supports PEM or Base64-encoded DER)
3. Sign the message using ECDSA P-256 with SHA-256
4. Encode the signature in Base64

**Key Format Support**:
- **PEM**: `-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----`
- **DER (Base64)**: Base64-encoded PKCS#8 format

**Example**:

```javascript
import { generateSignature } from '../utils/signature.js';

const signature = generateSignature(
  'content-studio',
  process.env.CONTENT_STUDIO_PRIVATE_KEY,
  envelope
);
// Returns: "MEUCIQD..." (Base64-encoded signature)
```

## Request Signing: `postToCoordinator()`

### Function: `postToCoordinator(envelope, options)`

**Location**: `src/infrastructure/coordinatorClient/coordinatorClient.js`

**How It Works**:

1. **Envelope Construction**: The caller provides a standard envelope:
   ```javascript
   {
     requester_service: 'content-studio',
     payload: { /* request data */ },
     response: {}
   }
   ```

2. **Signature Generation**: `postToCoordinator()` calls `generateSignature()` with:
   - Service name from `SERVICE_NAME` env var (default: `'content-studio'`)
   - Private key from `CONTENT_STUDIO_PRIVATE_KEY` env var
   - The entire envelope as the payload

3. **Header Attachment**: The signature is attached to the HTTP request:
   ```javascript
   headers: {
     'Content-Type': 'application/json',
     'X-Service-Name': 'content-studio',
     'X-Signature': '<base64-signature>'
   }
   ```

4. **Request Sending**: POST request to Coordinator with signed headers

### Usage Example

```javascript
import { postToCoordinator } from '../infrastructure/coordinatorClient/coordinatorClient.js';

const envelope = {
  requester_service: 'content-studio',
  payload: {
    trainer_id: 'trainer-123',
    topic: 'JavaScript Basics'
  },
  response: {}
};

const response = await postToCoordinator(envelope, {
  endpoint: '/api/fill-content-metrics/',
  timeout: 30000
});
```

## Coordinator Validation

The Coordinator validates incoming requests using the following process:

1. **Extract Headers**: Reads `X-Service-Name` and `X-Signature` from request headers

2. **Lookup Public Key**: Retrieves the public key associated with the service name from its registry

3. **Rebuild Message**: 
   - Reconstructs the canonical message using the same `buildMessage()` pattern
   - Uses the service name from `X-Service-Name` header
   - Uses the request body (envelope) as the payload

4. **Verify Signature**:
   - Decodes the Base64 signature
   - Verifies using ECDSA P-256 with the service's public key
   - Returns `401 Unauthorized` if verification fails

5. **Process Request**: If valid, routes the request to the target microservice

### Validation Flow

```
Request → Extract Headers → Lookup Public Key → Rebuild Message → Verify → Process
   ↓              ↓                ↓                  ↓            ↓         ↓
Envelope    X-Service-Name    Registry        buildMessage()   ECDSA    Route
            X-Signature       (Public Key)     SHA-256          Verify
```

## Required Environment Variables

### `SERVICE_NAME`

- **Type**: String
- **Default**: `'content-studio'`
- **Purpose**: Service identifier for Coordinator registration and request signing
- **Example**: `SERVICE_NAME=content-studio`

### `CONTENT_STUDIO_PRIVATE_KEY`

- **Type**: String (PEM or Base64-encoded DER)
- **Required**: Yes
- **Purpose**: ECDSA P-256 private key for signing all outbound requests
- **Format**: 
  ```
  -----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
  -----END PRIVATE KEY-----
  ```
- **Security**: Must be kept secret, never committed to version control

### `COORDINATOR_URL`

- **Type**: String (URL)
- **Required**: Yes
- **Purpose**: Base URL of the Coordinator microservice
- **Example**: `COORDINATOR_URL=https://coordinator-production.railway.app`

### `COORDINATOR_PUBLIC_KEY` (Optional)

- **Type**: String (PEM or Base64-encoded DER)
- **Required**: No (for future signature verification)
- **Purpose**: Coordinator's public key for verifying signed responses
- **Note**: Currently not used, reserved for future response verification

## Security Considerations

### Key Management

- **Private Key Storage**: Store `CONTENT_STUDIO_PRIVATE_KEY` in secure environment variables (Railway, AWS Secrets Manager, etc.)
- **Key Rotation**: Plan for periodic key rotation without service downtime
- **Key Format**: Supports both PEM and Base64-encoded DER for flexibility

### Signature Replay Protection

- **Nonce/Timestamp**: Consider adding timestamp or nonce to payloads for replay protection
- **Request Expiry**: Coordinator may implement request expiry validation

### Best Practices

1. **Never Log Private Keys**: Ensure logging excludes sensitive key material
2. **Validate Environment Variables**: Always validate required env vars on startup
3. **Error Handling**: Fail gracefully if signature generation fails
4. **Key Rotation**: Have a process for rotating keys without breaking service

## Implementation Files

- **Signature Utilities**: `src/utils/signature.js`
  - `buildMessage()`: Constructs canonical message
  - `generateSignature()`: Creates ECDSA signature
  - `verifySignature()`: Verifies signatures (optional)

- **Coordinator Client**: `src/infrastructure/coordinatorClient/coordinatorClient.js`
  - `postToCoordinator()`: Signs and sends requests

- **Service Registration**: `src/registration/register.js`
  - Uses `generateSignature()` for registration requests

## Troubleshooting

### Common Issues

**"Failed to parse private key"**
- Ensure the key is in valid PEM or Base64 DER format
- Check for extra whitespace or line breaks
- Verify the key is for ECDSA P-256 curve

**"Authentication failed - signature rejected"**
- Verify `CONTENT_STUDIO_PRIVATE_KEY` matches the public key registered with Coordinator
- Ensure `SERVICE_NAME` matches the registered service name
- Check that payload structure matches what Coordinator expects

**"COORDINATOR_URL environment variable is required"**
- Set `COORDINATOR_URL` in your environment
- Verify the URL is accessible from your deployment

## References

- [ECDSA Specification](https://tools.ietf.org/html/rfc6090)
- [IEEE P1363 Encoding](https://ieeexplore.ieee.org/document/4357757)
- [Node.js crypto.sign()](https://nodejs.org/api/crypto.html#crypto_crypto_sign_algorithm_data_keyoptions_callback)

