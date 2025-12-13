# Postman Request for Devlab via Coordinator

## Quick Start

1. **Generate Signature:**
   ```bash
   export CS_COORDINATOR_PRIVATE_KEY="your-private-key"
   node scripts/generate-signature.js '{"requester_service":"content-studio","payload":{"action":"generate-questions","topic_id":"1","topic_name":"react components","question_type":"theoretical","skills":["react Components"],"humanLanguage":"english","amount":4,"theoretical_question_type":"multiple_choice"},"response":{"answer":""}}'
   ```

2. **Copy the signature and headers from the output**

3. **Use in Postman** (see details below)

## Request Details

### URL
```
POST {{COORDINATOR_URL}}/api/fill-content-metrics/
```

**Example:**
```
POST https://coordinator-production-e0a0.up.railway.app/api/fill-content-metrics/
```

### Headers

```json
{
  "Content-Type": "application/json",
  "X-Service-Name": "content-studio",
  "X-Signature": "{{SIGNATURE}}",
  "X-Request-Timeout": "180000"
}
```

### Request Body (Envelope)

```json
{
  "requester_service": "content-studio",
  "payload": {
    "action": "generate-questions",
    "topic_id": "1",
    "topic_name": "react components",
    "question_type": "theoretical",
    "skills": [
      "react Components"
    ],
    "humanLanguage": "english",
    "amount": 4,
    "theoretical_question_type": "multiple_choice"
  },
  "response": {
    "answer": ""
  }
}
```

## How to Generate Signature

The signature is generated using ECDSA P-256 with the following process:

1. **Build Message:**
   ```
   message = "educoreai-{serviceName}-{sha256(JSON.stringify(envelope))}"
   ```
   Where:
   - `serviceName` = "content-studio"
   - `envelope` = the entire request body (the JSON object above)

2. **Sign Message:**
   - Use ECDSA P-256 with SHA256
   - Sign with your private key (`CS_COORDINATOR_PRIVATE_KEY`)
   - Output: Base64-encoded DER signature (no whitespace)

### Example Signature Generation (Node.js)

```javascript
const crypto = require('crypto');

function generateSignature(serviceName, privateKeyPem, payload) {
  // Build message
  const payloadString = JSON.stringify(payload);
  const payloadHash = crypto
    .createHash('sha256')
    .update(payloadString)
    .digest('hex');
  const message = `educoreai-${serviceName}-${payloadHash}`;
  
  // Sign message
  const signer = crypto.createSign('SHA256');
  signer.update(message, 'utf8');
  signer.end();
  const signatureBase64 = signer.sign(privateKeyPem, 'base64');
  
  // Remove whitespace
  return signatureBase64.replace(/\s+/g, '');
}

// Usage
const envelope = {
  "requester_service": "content-studio",
  "payload": {
    "action": "generate-questions",
    "topic_id": "1",
    "topic_name": "react components",
    "question_type": "theoretical",
    "skills": ["react Components"],
    "humanLanguage": "english",
    "amount": 4,
    "theoretical_question_type": "multiple_choice"
  },
  "response": {
    "answer": ""
  }
};

const privateKey = process.env.CS_COORDINATOR_PRIVATE_KEY; // Your private key
const signature = generateSignature('content-studio', privateKey, envelope);
console.log('Signature:', signature);
```

## Postman Pre-request Script

Add this to Postman's **Pre-request Script** tab to auto-generate signature:

```javascript
// Postman Pre-request Script for Devlab Request
const crypto = require('crypto');

// Get environment variables
const serviceName = pm.environment.get('SERVICE_NAME') || 'content-studio';
const privateKey = pm.environment.get('CS_COORDINATOR_PRIVATE_KEY');

if (!privateKey) {
    throw new Error('CS_COORDINATOR_PRIVATE_KEY environment variable is required');
}

// Get request body (envelope)
const envelope = pm.request.body.raw ? JSON.parse(pm.request.body.raw) : {};

// Build message: "educoreai-{serviceName}-{sha256(JSON.stringify(envelope))}"
const payloadString = JSON.stringify(envelope);
const payloadHash = crypto
    .createHash('sha256')
    .update(payloadString)
    .digest('hex');
const message = `educoreai-${serviceName}-${payloadHash}`;

// Sign message with ECDSA P-256
const signer = crypto.createSign('SHA256');
signer.update(message, 'utf8');
signer.end();
const signatureBase64 = signer.sign(privateKey, 'base64');

// Remove whitespace
const signature = signatureBase64.replace(/\s+/g, '');

// Set signature header
pm.request.headers.add({
    key: 'X-Signature',
    value: signature
});

// Set service name header
pm.request.headers.add({
    key: 'X-Service-Name',
    value: serviceName
});

// Set timeout header
pm.request.headers.add({
    key: 'X-Request-Timeout',
    value: '180000'
});

console.log('Signature generated:', signature.substring(0, 50) + '...');
```

## Postman Environment Variables

Set these in Postman:

```
COORDINATOR_URL = https://coordinator-production-e0a0.up.railway.app
SERVICE_NAME = content-studio
CS_COORDINATOR_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

**Important:** For the private key, you need to include the newlines as `\n` in the environment variable, or use the actual newlines if Postman supports it.

## Example Request Body Variations

### For Theoretical Questions (Multiple Choice)
```json
{
  "requester_service": "content-studio",
  "payload": {
    "action": "generate-questions",
    "topic_id": "1",
    "topic_name": "react components",
    "question_type": "theoretical",
    "skills": ["react Components"],
    "humanLanguage": "english",
    "amount": 4,
    "theoretical_question_type": "multiple_choice"
  },
  "response": {
    "answer": ""
  }
}
```

### For Code Questions
```json
{
  "requester_service": "content-studio",
  "payload": {
    "action": "generate-questions",
    "topic_id": "1",
    "topic_name": "javascript functions",
    "question_type": "code",
    "skills": ["JavaScript"],
    "humanLanguage": "english",
    "amount": 4,
    "programming_language": "javascript"
  },
  "response": {
    "answer": ""
  }
}
```

### For Theoretical Questions (Open Ended)
```json
{
  "requester_service": "content-studio",
  "payload": {
    "action": "generate-questions",
    "topic_id": "1",
    "topic_name": "react components",
    "question_type": "theoretical",
    "skills": ["react Components"],
    "humanLanguage": "english",
    "amount": 4,
    "theoretical_question_type": "open_ended"
  },
  "response": {
    "answer": ""
  }
}
```

## Expected Response

```json
{
  "success": true,
  "data": {
    "answer": {
      // Array of questions or nested structure
    }
  },
  "metadata": {
    "routed_to": "assessment-service",
    "confidence": 0.95,
    "requester": "content-studio",
    "processing_time_ms": 10041
  }
}
```

## Response Headers

The Coordinator will return these headers:
- `X-Service-Name`: "coordinator"
- `X-Service-Signature`: (ECDSA signature of the response body)

## Troubleshooting

1. **401 Unauthorized**: Check that signature is correct and private key matches
2. **400 Bad Request**: Check that envelope structure matches exactly
3. **502 Bad Gateway**: Coordinator cannot reach Devlab service (service may be down)
4. **Timeout**: Increase `X-Request-Timeout` header value (default: 180000ms = 3 minutes)

