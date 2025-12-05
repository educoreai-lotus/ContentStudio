# Coordinator Integration Guide - Complete Microservice Registration

## Overview

This guide provides step-by-step instructions for integrating any microservice with the Coordinator service using ECDSA P-256 digital signatures. The Coordinator acts as a central service registry and routing proxy for inter-microservice communication.

---

## Prerequisites

### 1. Cryptographic Keys

**Required:**
- **Private Key (ECDSA P-256)**: Stored securely in your microservice environment
- **Public Key (ECDSA P-256)**: Must be registered with Coordinator before service registration

**Key Format:**
- **Algorithm**: ECDSA P-256 (prime256v1)
- **Format**: PEM (Privacy-Enhanced Mail)
- **Private Key**: `-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----`
- **Public Key**: `-----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----`

**Key Generation (Node.js):**
```javascript
const crypto = require('crypto');
const { generateKeyPairSync } = crypto;

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

console.log('Private Key:', privateKey);
console.log('Public Key:', publicKey);
```

---

## Registration Process

The registration process consists of **3 stages**:

### Stage 0: Public Key Registration (REQUIRED FIRST)

**Endpoint:** `POST /public-keys/:serviceName`

**Purpose:** Register your public key with Coordinator before attempting service registration.

**Headers:**
```
Content-Type: application/json
```

**URL Parameters:**
- `:serviceName` - Your microservice name (e.g., "my-service", "content-studio")

**Request Body:**
```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Public key added for service 'your-service-name'",
  "serviceName": "your-service-name",
  "addedAt": "2025-01-27",
  "nextStep": {
    "action": "Register your service",
    "endpoint": "/register",
    "description": "Now you can register your service..."
  }
}
```

**Important Notes:**
- This step MUST be completed before service registration
- The public key must match the private key you'll use for signing
- Service name must be consistent across all stages

---

### Stage 1: Service Registration

**Endpoint:** `POST /register`

**Purpose:** Register your microservice with Coordinator.

**Headers (REQUIRED):**
```
Content-Type: application/json
X-Service-Name: your-service-name
X-Signature: <base64-encoded-ecdsa-signature>
```

**Request Body - Short Format (Recommended):**
```json
{
  "name": "your-service-name",
  "url": "https://your-service.example.com",
  "grpc": 50052
}
```

**Request Body - Full Format (Alternative):**
```json
{
  "serviceName": "your-service-name",
  "version": "1.0.0",
  "endpoint": "https://your-service.example.com",
  "healthCheck": "/health",
  "description": "Optional description",
  "metadata": {
    "team": "Team name",
    "owner": "Owner name",
    "capabilities": ["capability1", "capability2"]
  }
}
```

**Parameters:**

**Short Format:**
- `name` (string, required): Service name (must match `X-Service-Name` header)
- `url` (string, required): Valid HTTP/HTTPS URL
- `grpc` (number, required): gRPC port (1-65535), or `false` if not supported

**Full Format:**
- `serviceName` (string, required): Service name (must match `X-Service-Name` header)
- `version` (string, required): Semver version format
- `endpoint` (string, required): Valid HTTP/HTTPS URL
- `healthCheck` (string, required): Health check path (e.g., `/health`)
- `description` (string, optional): Service description
- `metadata` (object, optional): Additional metadata

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Service registered",
  "serviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Headers:**
```
X-Service-Name: coordinator
X-Service-Signature: <coordinator-signature>
```

**Status After Registration:**
- Initial status: `pending_migration`
- To become `active`: Complete Stage 2 (Migration File Upload)

---

### Implementation Files for Service Registration

To implement service registration, you need to create the following files:

#### 1. `src/utils/signature.js` - Signature Generation Utility

**Purpose:** Handles ECDSA P-256 signature generation and verification.

**File Structure:**
```javascript
import crypto from 'crypto';
import { logger } from '../infrastructure/logging/Logger.js';

/**
 * Build message for ECDSA signing
 * Format: "educoreai-{serviceName}-{payloadHash}"
 * @param {string} serviceName - Service name
 * @param {Object} payload - Payload object to sign (optional)
 * @returns {string} Message string for signing
 */
export function buildMessage(serviceName, payload) {
  let message = `educoreai-${serviceName}`;
  
  if (payload) {
    // CRITICAL: Use JSON.stringify (not custom stable stringify) to match Coordinator
    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto.createHash('sha256')
      .update(payloadString)
      .digest('hex');
    message = `${message}-${payloadHash}`;
  }
  
  return message;
}

/**
 * Generate ECDSA P-256 signature
 * @param {string} serviceName - Service name
 * @param {string} privateKeyPem - Private key in PEM format
 * @param {Object} payload - Payload object to sign
 * @returns {string} Base64-encoded signature
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
    const privateKey = crypto.createPrivateKey({
      key: privateKeyPem,
      format: 'pem'
    });
    
    // Sign the message using ECDSA P-256
    const signature = crypto.sign('sha256', Buffer.from(message, 'utf8'), {
      key: privateKey,
      dsaEncoding: 'ieee-p1363' // ECDSA P-256 uses IEEE P1363 encoding
    });
    
    // Return Base64-encoded signature
    return signature.toString('base64');
  } catch (error) {
    throw new Error(`Signature generation failed: ${error.message}`);
  }
}

/**
 * Verify ECDSA P-256 signature (optional)
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
    const message = buildMessage(serviceName, payload);
    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem'
    });
    
    const signatureBuffer = Buffer.from(signature, 'base64');
    return crypto.verify(
      'sha256',
      Buffer.from(message, 'utf8'),
      {
        key: publicKey,
        dsaEncoding: 'ieee-p1363'
      },
      signatureBuffer
    );
  } catch (error) {
    return false;
  }
}
```

**Key Points:**
- Uses `JSON.stringify()` directly (matches Coordinator implementation)
- Supports ECDSA P-256 with IEEE P1363 encoding
- Returns Base64-encoded signatures
- Handles PEM format keys

---

#### 2. `src/registration/register.js` - Service Registration

**Purpose:** Handles automatic service registration with Coordinator on startup.

**File Structure:**
```javascript
import axios from 'axios';
import { logger } from '../infrastructure/logging/Logger.js';
import { generateSignature } from '../utils/signature.js';

// Service configuration
const SERVICE_NAME = process.env.SERVICE_NAME || 'your-service-name';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const SERVICE_DESCRIPTION = process.env.SERVICE_DESCRIPTION || 'Your service description';

const METADATA = {
  team: process.env.SERVICE_TEAM || 'Your Team',
  owner: process.env.SERVICE_OWNER || 'system',
  capabilities: process.env.SERVICE_CAPABILITIES 
    ? process.env.SERVICE_CAPABILITIES.split(',')
    : ['default-capability']
};

/**
 * Exponential backoff delay calculator
 */
function getBackoffDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), 16000);
}

/**
 * Register service with Coordinator
 * @returns {Promise<{success: boolean, serviceId?: string, status?: string, error?: string}>}
 */
async function registerWithCoordinator() {
  const coordinatorUrl = process.env.COORDINATOR_URL;
  const serviceEndpoint = process.env.SERVICE_ENDPOINT;
  const privateKey = process.env.COORDINATOR_PRIVATE_KEY; // Or your custom env var name

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
    const error = 'COORDINATOR_PRIVATE_KEY environment variable is required for ECDSA signing';
    logger.error(`❌ Registration failed: ${error}`);
    return { success: false, error };
  }

  // Clean URLs (remove trailing slashes)
  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');
  const cleanServiceEndpoint = serviceEndpoint.replace(/\/$/, '');

  const registrationUrl = `${cleanCoordinatorUrl}/register`;
  
  // Build registration payload (using full format)
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
    signature = generateSignature(
      SERVICE_NAME,
      privateKey,
      registrationPayload
    );
  } catch (signatureError) {
    const error = `Failed to generate ECDSA signature: ${signatureError.message}`;
    logger.error(`❌ Registration failed: ${error}`);
    return { success: false, error };
  }

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
        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
          errorMessage = `Unauthorized: Authentication failed. Please verify COORDINATOR_PRIVATE_KEY is correct.`;
        } else if (status === 404) {
          errorMessage = `Not found: Registration endpoint not available.`;
        } else {
          errorMessage = `HTTP ${status}: ${data?.message || error.response.statusText}`;
        }
      } else if (error.request) {
        errorMessage = 'No response from Coordinator service';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }

      // Log attempt
      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) {
        logger.error(`❌ Registration failed after ${maxAttempts} attempts: ${errorMessage}`);
      } else {
        const delay = getBackoffDelay(attempt);
        logger.warn(`⚠️ Registration attempt ${attempt + 1}/${maxAttempts} failed: ${errorMessage}. Retrying in ${delay}ms...`);
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
    }
  } catch (error) {
    logger.error('❌ Unexpected error during service registration', {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw - allow service to continue
  }
}
```

**Integration in `server.js` or main entry point:**
```javascript
import { registerService } from './src/registration/register.js';

// ... other imports and setup ...

// Register with Coordinator on startup (non-blocking)
registerService().catch(error => {
  console.error('Registration error (non-blocking):', error.message);
});

// Start your server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

**Key Points:**
- Reads configuration from environment variables
- Implements exponential backoff retry logic
- Non-blocking - doesn't crash service if registration fails
- Logs all attempts and errors
- Returns structured result object

---

#### 3. `src/infrastructure/coordinatorClient/coordinatorClient.js` - Coordinator Client

**Purpose:** Centralized client for all outbound requests to other microservices via Coordinator.

**File Structure:**
```javascript
import axios from 'axios';
import { logger } from '../logging/Logger.js';
import { generateSignature, verifySignature } from '../../utils/signature.js';

const SERVICE_NAME = process.env.SERVICE_NAME || 'your-service-name';

/**
 * Post request to Coordinator with ECDSA signature
 * All internal microservice calls should use this helper
 * @param {Object} envelope - Request envelope
 * @param {Object} options - Optional configuration
 * @param {string} options.endpoint - Custom endpoint (default: /api/fill-content-metrics/)
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @returns {Promise<Object>} Response data from Coordinator
 * @throws {Error} If request fails
 */
export async function postToCoordinator(envelope, options = {}) {
  const coordinatorUrl = process.env.COORDINATOR_URL;
  const privateKey = process.env.COORDINATOR_PRIVATE_KEY; // Or your custom env var name
  const coordinatorPublicKey = process.env.COORDINATOR_PUBLIC_KEY || null; // Optional, for response verification

  // Validate required environment variables
  if (!coordinatorUrl) {
    throw new Error('COORDINATOR_URL environment variable is required');
  }

  if (!privateKey) {
    throw new Error('COORDINATOR_PRIVATE_KEY environment variable is required for signing requests');
  }

  // Clean URL (remove trailing slash)
  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');
  
  // Default endpoint is /api/fill-content-metrics/ (Coordinator proxy endpoint)
  let endpoint = options.endpoint || '/api/fill-content-metrics/';
  
  // Normalize endpoint to always end with exactly one slash
  endpoint = endpoint.replace(/\/+$/, '') + '/';
  
  const url = `${cleanCoordinatorUrl}${endpoint}`;
  const timeout = options.timeout || 30000;

  try {
    // Generate ECDSA signature for the entire envelope
    const signature = generateSignature(SERVICE_NAME, privateKey, envelope);

    // Send POST request with signature headers
    const response = await axios.post(url, envelope, {
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Name': SERVICE_NAME,
        'X-Signature': signature,
      },
      timeout,
    });

    // Optional: Verify response signature if Coordinator provides one
    if (coordinatorPublicKey && response.headers['x-service-signature']) {
      const responseSignature = response.headers['x-service-signature'];
      try {
        const isValid = verifySignature(
          'coordinator',
          coordinatorPublicKey,
          response.data,
          responseSignature
        );
        if (!isValid) {
          logger.warn('[CoordinatorClient] Response signature verification failed');
        }
      } catch (verifyError) {
        logger.warn('[CoordinatorClient] Response signature verification error (non-blocking)', {
          error: verifyError.message,
        });
      }
    }

    return response.data;
  } catch (error) {
    logger.error('[CoordinatorClient] Request failed', {
      endpoint,
      error: error.message,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    // Re-throw the error so callers can handle it
    throw error;
  }
}

/**
 * Get Coordinator client instance
 * @returns {Object} Coordinator client methods
 */
export function getCoordinatorClient() {
  return {
    post: postToCoordinator,
  };
}
```

**Usage Example:**
```javascript
import { postToCoordinator } from './src/infrastructure/coordinatorClient/coordinatorClient.js';

// Call another microservice via Coordinator
async function callTargetService() {
  const envelope = {
    requester_service: 'your-service-name',
    payload: {
      action: 'some-action',
      data: {
        param1: 'value1',
        param2: 'value2'
      }
    },
    response: {}
  };

  try {
    const result = await postToCoordinator(envelope);
    return result.response; // Coordinator fills the 'response' field
  } catch (error) {
    console.error('Coordinator request failed:', error.message);
    throw error;
  }
}
```

**Key Points:**
- Centralizes all Coordinator communication
- Signs the entire envelope object
- Optional response signature verification
- Proper error handling and logging
- Configurable timeout and endpoint

---

### Required Environment Variables

**For Registration (`register.js`):**
```bash
COORDINATOR_URL=https://coordinator.example.com
SERVICE_ENDPOINT=https://your-service.example.com
COORDINATOR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
SERVICE_NAME=your-service-name
SERVICE_VERSION=1.0.0
SERVICE_DESCRIPTION="Your service description"
SERVICE_TEAM="Your Team"
SERVICE_OWNER="system"
SERVICE_CAPABILITIES="capability1,capability2"
```

**For Coordinator Client (`coordinatorClient.js`):**
```bash
COORDINATOR_URL=https://coordinator.example.com
COORDINATOR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
COORDINATOR_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"  # Optional, for response verification
SERVICE_NAME=your-service-name
```

**Important Notes:**
- Private key must be in PEM format with actual newlines (`\n`), not escaped `\\n`
- Service name must be consistent across all files and environment variables
- All keys must be ECDSA P-256 (prime256v1)

---

### File Structure Summary

```
your-service/
├── src/
│   ├── utils/
│   │   └── signature.js          # Signature generation/verification
│   ├── registration/
│   │   └── register.js           # Service registration logic
│   └── infrastructure/
│       └── coordinatorClient/
│           └── coordinatorClient.js  # Coordinator client for outbound requests
├── server.js                      # Main entry point (calls registerService)
└── .env                          # Environment variables
```

---

### Stage 2: Migration File Upload (Required for Active Status)

**Endpoint:** `POST /register/:serviceId/migration`

**Purpose:** Upload service metadata and capabilities to Coordinator for AI routing and service discovery.

**Headers (REQUIRED):**
```
Content-Type: application/json
X-Service-Name: your-service-name
X-Signature: <base64-encoded-ecdsa-signature>
```

**URL Parameters:**
- `:serviceId` - Service ID received from Stage 1 registration

**Request Body:**
```json
{
  "migrationFile": {
    "version": "1.0.0",
    "capabilities": [
      "coding exercises",
      "generate exercises",
      "programming challenges"
    ],
    "endpoints": {
      "generate": "/api/exercises/generate",
      "validate": "/api/exercises/validate"
    },
    "description": "Service description for AI routing",
    "api": {
      "endpoints": [
        {
          "path": "/api/exercises/generate",
          "method": "POST",
          "description": "Generate coding exercises",
          "requestSchema": {},
          "responseSchema": {}
        }
      ]
    },
    "database": {
      "tables": [],
      "migrations": []
    },
    "events": {
      "publishes": ["exercise.generated"],
      "subscribes": ["user.requested"]
    },
    "dependencies": ["user-service"]
  }
}
```

**Parameters:**
- `migrationFile` (object, required): Migration file object
  - `version` (string): Service version
  - `capabilities` (array): List of service capabilities (important for AI routing)
  - `endpoints` (object): Endpoint mapping
  - `description` (string): Service description
  - `api` (object, optional): API definition
  - `database` (object, optional): Database schema
  - `events` (object, optional): Event definitions
  - `dependencies` (array, optional): Service dependencies

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Migration file uploaded successfully",
  "serviceId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active"
}
```

**Status After Migration:**
- Status changes to: `active`
- Service is now fully registered and available for routing

---

## Digital Signature Implementation

### Signature Message Format

The message to be signed follows this exact format:

```
educoreai-{serviceName}-{payloadHash}
```

Where:
- `{serviceName}`: Your microservice name (e.g., "my-service")
- `{payloadHash}`: SHA256 hash of the JSON-stringified payload (hex format)

**Important:** Use `JSON.stringify()` directly (NOT a custom stable stringify) to match Coordinator's implementation.

### Signature Generation Algorithm

**Step-by-step:**

1. **Build the message:**
   ```javascript
   let message = `educoreai-${serviceName}`;
   if (payload) {
     const payloadString = JSON.stringify(payload);
     const payloadHash = crypto.createHash('sha256')
       .update(payloadString)
       .digest('hex');
     message = `${message}-${payloadHash}`;
   }
   ```

2. **Sign with ECDSA P-256:**
   ```javascript
   const signature = crypto.sign('sha256', Buffer.from(message, 'utf8'), {
     key: privateKey,
     dsaEncoding: 'ieee-p1363'
   });
   ```

3. **Encode to Base64:**
   ```javascript
   const base64Signature = signature.toString('base64');
   ```

### Complete Signature Function (Node.js)

```javascript
const crypto = require('crypto');

function generateSignature(serviceName, privateKeyPem, payload = null) {
  // Build message
  let message = `educoreai-${serviceName}`;
  
  if (payload) {
    // CRITICAL: Use JSON.stringify (not custom stable stringify)
    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto
      .createHash('sha256')
      .update(payloadString)
      .digest('hex');
    message = `${message}-${payloadHash}`;
  }
  
  // Create private key object
  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem'
  });
  
  // Sign with ECDSA P-256
  const signature = crypto.sign('sha256', Buffer.from(message, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363' // ECDSA P-256 uses IEEE P1363 encoding
  });
  
  // Return Base64-encoded signature
  return signature.toString('base64');
}
```

### Signature Verification (Optional, for Testing)

```javascript
function verifySignature(serviceName, publicKeyPem, payload, signature) {
  // Build the same message
  let message = `educoreai-${serviceName}`;
  if (payload) {
    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto
      .createHash('sha256')
      .update(payloadString)
      .digest('hex');
    message = `${message}-${payloadHash}`;
  }
  
  // Create public key object
  const publicKey = crypto.createPublicKey({
    key: publicKeyPem,
    format: 'pem'
  });
  
  // Verify signature
  const signatureBuffer = Buffer.from(signature, 'base64');
  return crypto.verify(
    'sha256',
    Buffer.from(message, 'utf8'),
    {
      key: publicKey,
      dsaEncoding: 'ieee-p1363'
    },
    signatureBuffer
  );
}
```

---

## Complete Registration Example

### Full Implementation (Node.js)

```javascript
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

// Configuration
const SERVICE_NAME = 'my-service';
const COORDINATOR_URL = 'https://coordinator.example.com';
const SERVICE_ENDPOINT = 'https://my-service.example.com';
const PRIVATE_KEY = process.env.COORDINATOR_PRIVATE_KEY || fs.readFileSync('private-key.pem', 'utf8');
const PUBLIC_KEY = process.env.COORDINATOR_PUBLIC_KEY || fs.readFileSync('public-key.pem', 'utf8');

// Signature generation function
function generateSignature(serviceName, privateKeyPem, payload = null) {
  let message = `educoreai-${serviceName}`;
  
  if (payload) {
    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto
      .createHash('sha256')
      .update(payloadString)
      .digest('hex');
    message = `${message}-${payloadHash}`;
  }
  
  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem'
  });
  
  const signature = crypto.sign('sha256', Buffer.from(message, 'utf8'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363'
  });
  
  return signature.toString('base64');
}

// Stage 0: Submit Public Key
async function submitPublicKey() {
  const payload = { publicKey: PUBLIC_KEY };
  const signature = generateSignature(SERVICE_NAME, PRIVATE_KEY, payload);
  
  try {
    const response = await axios.post(
      `${COORDINATOR_URL}/public-keys/${SERVICE_NAME}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': SERVICE_NAME,
          'X-Signature': signature
        }
      }
    );
    
    console.log('✓ Public key submitted:', response.data);
    return true;
  } catch (error) {
    console.error('✗ Failed to submit public key:', error.response?.data || error.message);
    return false;
  }
}

// Stage 1: Register Service
async function registerService() {
  const payload = {
    name: SERVICE_NAME,
    url: SERVICE_ENDPOINT,
    grpc: 50052 // or false if not supported
  };
  
  const signature = generateSignature(SERVICE_NAME, PRIVATE_KEY, payload);
  
  try {
    const response = await axios.post(
      `${COORDINATOR_URL}/register`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': SERVICE_NAME,
          'X-Signature': signature
        }
      }
    );
    
    console.log('✓ Service registered:', response.data);
    return response.data.serviceId;
  } catch (error) {
    console.error('✗ Registration failed:', error.response?.data || error.message);
    throw error;
  }
}

// Stage 2: Upload Migration File
async function uploadMigration(serviceId) {
  const payload = {
    migrationFile: {
      version: '1.0.0',
      capabilities: ['my-capability'],
      endpoints: {
        main: '/api/endpoint'
      },
      description: 'My service description'
    }
  };
  
  const signature = generateSignature(SERVICE_NAME, PRIVATE_KEY, payload);
  
  try {
    const response = await axios.post(
      `${COORDINATOR_URL}/register/${serviceId}/migration`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': SERVICE_NAME,
          'X-Signature': signature
        }
      }
    );
    
    console.log('✓ Migration uploaded:', response.data);
    return response.data;
  } catch (error) {
    console.error('✗ Migration upload failed:', error.response?.data || error.message);
    throw error;
  }
}

// Main registration flow
async function registerWithCoordinator() {
  try {
    // Stage 0: Submit public key
    console.log('Stage 0: Submitting public key...');
    const keySubmitted = await submitPublicKey();
    if (!keySubmitted) {
      throw new Error('Failed to submit public key');
    }
    
    // Stage 1: Register service
    console.log('Stage 1: Registering service...');
    const serviceId = await registerService();
    
    // Stage 2: Upload migration
    console.log('Stage 2: Uploading migration file...');
    await uploadMigration(serviceId);
    
    console.log('✓ Registration complete!');
  } catch (error) {
    console.error('✗ Registration failed:', error.message);
    throw error;
  }
}

// Run registration
registerWithCoordinator().catch(console.error);
```

---

## Using Coordinator Client for Outbound Requests

After registration, **all inter-microservice communication** must go through Coordinator as a proxy. This ensures proper routing, authentication, and service discovery.

### Coordinator Proxy Endpoint

**Endpoint:** `POST ${COORDINATOR_URL}/api/fill-content-metrics/`

**Important:** Always include trailing slash in the endpoint URL.

### Request Headers (REQUIRED)

```
Content-Type: application/json
X-Service-Name: your-service-name
X-Signature: <base64-encoded-ecdsa-signature>
```

### Request Body (Envelope Format)

All requests must use the envelope format:

```json
{
  "requester_service": "your-service-name",
  "payload": {
    "action": "some-action",
    "data": {}
  },
  "response": {}
}
```

**Envelope Fields:**
- `requester_service` (string, required): Your service name (must match `X-Service-Name` header)
- `payload` (object, required): The actual request data for the target microservice
- `response` (object, optional): Empty object that will be filled by Coordinator with the response

### Signature for Outbound Requests

**Important:** Sign the **entire envelope** object, not just the payload:

```javascript
const signature = generateSignature(SERVICE_NAME, PRIVATE_KEY, envelope);
```

### Complete Coordinator Client Implementation

```javascript
const axios = require('axios');
const crypto = require('crypto');

class CoordinatorClient {
  constructor(config) {
    this.coordinatorUrl = config.coordinatorUrl;
    this.serviceName = config.serviceName;
    this.privateKey = config.privateKey;
    this.endpoint = '/api/fill-content-metrics/';
  }

  /**
   * Send signed request to another microservice via Coordinator
   * @param {Object} envelope - Request envelope
   * @returns {Promise<Object>} Response data
   */
  async postToCoordinator(envelope) {
    // Validate envelope format
    if (!envelope.requester_service || !envelope.payload) {
      throw new Error('Invalid envelope format: requester_service and payload are required');
    }

    // Ensure requester_service matches service name
    envelope.requester_service = this.serviceName;

    // Generate signature for the entire envelope
    const signature = generateSignature(this.serviceName, this.privateKey, envelope);

    // Normalize endpoint (ensure trailing slash)
    const normalizedEndpoint = this.endpoint.endsWith('/') 
      ? this.endpoint 
      : `${this.endpoint}/`;

    const url = `${this.coordinatorUrl}${normalizedEndpoint}`;

    try {
      const response = await axios.post(url, envelope, {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': this.serviceName,
          'X-Signature': signature
        },
        timeout: 60000 // 60 seconds timeout
      });

      // Coordinator returns the envelope with 'response' field filled
      return response.data;
    } catch (error) {
      if (error.response) {
        // Server responded with error
        throw new Error(`Coordinator request failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // Request made but no response
        throw new Error('No response from Coordinator service');
      } else {
        // Error setting up request
        throw new Error(`Coordinator request error: ${error.message}`);
      }
    }
  }

  /**
   * Call another microservice via Coordinator
   * @param {string} targetService - Target service name
   * @param {string} action - Action to perform
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Response data
   */
  async callService(targetService, action, data) {
    const envelope = {
      requester_service: this.serviceName,
      payload: {
        action: action,
        target_service: targetService,
        ...data
      },
      response: {}
    };

    return await this.postToCoordinator(envelope);
  }
}

// Usage example
const client = new CoordinatorClient({
  coordinatorUrl: process.env.COORDINATOR_URL,
  serviceName: process.env.SERVICE_NAME,
  privateKey: process.env.COORDINATOR_PRIVATE_KEY
});

// Call another service
const result = await client.callService('target-service', 'some-action', {
  param1: 'value1',
  param2: 'value2'
});
```

### Response Format

Coordinator returns the envelope with the `response` field filled:

```json
{
  "requester_service": "your-service-name",
  "payload": {
    "action": "some-action",
    "data": {}
  },
  "response": {
    "success": true,
    "data": {
      // Response data from target service
    }
  }
}
```

### Response Signature Verification (Optional)

Coordinator may include a signature in the response header:

```
X-Service-Signature: <coordinator-signature>
```

You can optionally verify this signature:

```javascript
async function postToCoordinator(envelope) {
  // ... send request ...
  
  const response = await axios.post(url, envelope, { headers, timeout: 60000 });
  
  // Optional: Verify response signature
  const coordinatorSignature = response.headers['x-service-signature'];
  if (coordinatorSignature && COORDINATOR_PUBLIC_KEY) {
    const isValid = verifySignature(
      'coordinator',
      COORDINATOR_PUBLIC_KEY,
      response.data,
      coordinatorSignature
    );
    
    if (!isValid) {
      console.warn('Coordinator response signature verification failed');
      // Don't throw - log warning but continue
    }
  }
  
  return response.data;
}
```

### Error Handling

**Common Errors:**

1. **401 Unauthorized**
   - Signature rejected
   - Check: Private key matches registered public key
   - Check: Signature generation uses correct format

2. **404 Not Found**
   - Target service not found
   - Check: Service name is correct
   - Check: Service is registered and active

3. **500 Internal Server Error**
   - Coordinator or target service error
   - Check: Coordinator logs
   - Check: Target service logs

4. **Timeout**
   - Request took too long
   - Increase timeout or check network connectivity

### Best Practices

1. **Centralize Coordinator Client**
   - Create a single `CoordinatorClient` class
   - Reuse across all microservice calls
   - Handle errors consistently

2. **Retry Logic**
   - Implement exponential backoff for transient failures
   - Don't retry on 401/403 errors (authentication issues)

3. **Logging**
   - Log all Coordinator requests
   - Include service name, action, and response status
   - Don't log sensitive data

4. **Error Handling**
   - Preserve original error handling from direct service calls
   - Map Coordinator errors to your existing error types
   - Provide fallback behavior when possible

### Migration from Direct Service Calls

**Before (Direct Call):**
```javascript
const response = await axios.post(
  'https://target-service.example.com/api/endpoint',
  { data: 'value' }
);
```

**After (Via Coordinator):**
```javascript
const envelope = {
  requester_service: 'my-service',
  payload: {
    action: 'endpoint-action',
    data: 'value'
  },
  response: {}
};

const result = await coordinatorClient.postToCoordinator(envelope);
```

**Important:** 
- Keep the same payload structure
- Only change the transport layer (HTTP call)
- Don't modify business logic

---

## Error Handling

### Common Errors

**1. "Authentication required"**
- **Cause**: Missing `X-Service-Name` or `X-Signature` headers
- **Solution**: Ensure both headers are present in the request

**2. "Authentication failed"**
- **Cause**: Public key not registered, or signature doesn't match
- **Solution**: 
  - Verify public key is registered via `/public-keys/:serviceName`
  - Ensure private key matches the registered public key
  - Check that signature generation uses exact same algorithm

**3. "Service with name 'X' already exists"**
- **Cause**: Service name already registered
- **Solution**: Use a different service name or update existing registration

**4. "url must be a valid URL"**
- **Cause**: Invalid URL format
- **Solution**: Ensure URL is valid HTTP/HTTPS format

**5. "grpc must be a valid port number"**
- **Cause**: Invalid gRPC port (must be 1-65535)
- **Solution**: Provide valid port number or `false` if not supported

### Retry Logic

Implement exponential backoff for registration:

```javascript
async function registerWithRetry(maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await registerService();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 16000);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Testing and Validation

### 1. Test Signature Generation

```javascript
// Test payload
const testPayload = {
  name: 'test-service',
  url: 'https://test.example.com',
  grpc: 50052
};

// Generate signature
const signature = generateSignature('test-service', PRIVATE_KEY, testPayload);

// Verify signature
const isValid = verifySignature('test-service', PUBLIC_KEY, testPayload, signature);
console.log('Signature valid:', isValid); // Should be true
```

### 2. Test Message Format

```javascript
// Expected message format
const serviceName = 'test-service';
const payload = { name: 'test-service', url: 'https://test.com', grpc: 50052 };
const payloadHash = crypto.createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');
const expectedMessage = `educoreai-${serviceName}-${payloadHash}`;

console.log('Expected message:', expectedMessage);
```

### 3. Test Key Pair

```javascript
// Verify key pair matches
const testMessage = 'test-message';
const signature = crypto.sign('sha256', Buffer.from(testMessage), {
  key: crypto.createPrivateKey({ key: PRIVATE_KEY, format: 'pem' }),
  dsaEncoding: 'ieee-p1363'
}).toString('base64');

const isValid = crypto.verify(
  'sha256',
  Buffer.from(testMessage),
  {
    key: crypto.createPublicKey({ key: PUBLIC_KEY, format: 'pem' }),
    dsaEncoding: 'ieee-p1363'
  },
  Buffer.from(signature, 'base64')
);

console.log('Key pair valid:', isValid); // Should be true
```

---

## Environment Variables

**Required:**
```bash
COORDINATOR_URL=https://coordinator.example.com
SERVICE_ENDPOINT=https://your-service.example.com
COORDINATOR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
COORDINATOR_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
SERVICE_NAME=your-service-name
```

**Optional:**
```bash
SERVICE_VERSION=1.0.0
SERVICE_DESCRIPTION="Your service description"
```

---

## Security Best Practices

1. **Never commit keys to version control**
   - Use environment variables or secrets management
   - Add `*.pem` to `.gitignore`

2. **Rotate keys periodically**
   - Generate new key pairs
   - Update public key in Coordinator
   - Update private key in service environment

3. **Validate signatures on responses** (optional)
   - Coordinator may include `X-Service-Signature` header
   - Verify response signatures for additional security

4. **Use HTTPS for all Coordinator communication**
   - Never use HTTP in production
   - Validate SSL certificates

5. **Store keys securely**
   - Use secrets management (e.g., Railway, AWS Secrets Manager)
   - Never log private keys
   - Restrict access to key storage

---

## Troubleshooting

### Signature Rejected (401)

**Checklist:**
1. ✓ Public key registered via `/public-keys/:serviceName`
2. ✓ Private key matches registered public key
3. ✓ Using `JSON.stringify()` (not custom stringify)
4. ✓ Service name matches exactly (case-sensitive)
5. ✓ Using ECDSA P-256 with `ieee-p1363` encoding
6. ✓ Base64 encoding correct
7. ✓ Headers present: `X-Service-Name` and `X-Signature`

### Registration Fails (404)

**Checklist:**
1. ✓ Coordinator URL correct
2. ✓ Endpoint exists: `/register`
3. ✓ Network connectivity to Coordinator

### Service Status Stuck at `pending_migration`

**Solution:**
- Complete Stage 2: Upload migration file
- Verify migration file format is correct
- Check Coordinator logs for errors

---

## Summary

**Registration Flow:**
1. **Stage 0**: Submit public key → `/public-keys/:serviceName`
2. **Stage 1**: Register service → `/register` → Get `serviceId`
3. **Stage 2**: Upload migration → `/register/:serviceId/migration` → Status becomes `active`

**Signature Format:**
- Message: `educoreai-{serviceName}-{sha256(JSON.stringify(payload))}`
- Algorithm: ECDSA P-256 (prime256v1)
- Encoding: IEEE P1363
- Output: Base64

**Key Requirements:**
- ECDSA P-256 key pair (PEM format)
- Public key registered before service registration
- Private key stored securely in service environment
- Service name consistent across all stages

**Communication:**
- All outbound requests via Coordinator proxy
- Endpoint: `/api/fill-content-metrics/`
- Headers: `X-Service-Name`, `X-Signature`
- Envelope format for requests

---

## Additional Resources

- Coordinator API Documentation
- ECDSA P-256 Specification
- Node.js Crypto Documentation
- Service Discovery Patterns

---

**Last Updated:** 2025-12-05
**Version:** 1.0.0

