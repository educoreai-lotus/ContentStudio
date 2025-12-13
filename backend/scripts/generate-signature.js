#!/usr/bin/env node
/**
 * Generate ECDSA signature for Coordinator requests
 * 
 * Usage:
 *   node scripts/generate-signature.js <envelope-json-file>
 *   OR
 *   node scripts/generate-signature.js '{"requester_service":"content-studio",...}'
 * 
 * Environment variables required:
 *   - CS_COORDINATOR_PRIVATE_KEY: Your private key in PEM format
 *   - SERVICE_NAME: Service name (default: "content-studio")
 */

import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVICE_NAME = process.env.SERVICE_NAME || 'content-studio';

function buildMessage(serviceName, payload) {
  const payloadString = JSON.stringify(payload);
  const payloadHash = crypto
    .createHash('sha256')
    .update(payloadString)
    .digest('hex');
  return `educoreai-${serviceName}-${payloadHash}`;
}

function generateSignature(serviceName, privateKeyPem, payload) {
  const message = buildMessage(serviceName, payload);
  
  const signer = crypto.createSign('SHA256');
  signer.update(message, 'utf8');
  signer.end();
  
  const signatureBase64 = signer.sign(privateKeyPem, 'base64');
  return signatureBase64.replace(/\s+/g, '');
}

// Main
const privateKey = process.env.CS_COORDINATOR_PRIVATE_KEY;

if (!privateKey) {
  console.error('❌ Error: CS_COORDINATOR_PRIVATE_KEY environment variable is required');
  console.error('   Set it: export CS_COORDINATOR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
  process.exit(1);
}

// Get envelope from command line argument
const envelopeArg = process.argv[2];

if (!envelopeArg) {
  console.error('❌ Error: Envelope JSON is required');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/generate-signature.js \'{"requester_service":"content-studio",...}\'');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/generate-signature.js \'{"requester_service":"content-studio","payload":{"action":"generate-questions","topic_id":"1","topic_name":"react components","question_type":"theoretical","skills":["react Components"],"humanLanguage":"english","amount":4,"theoretical_question_type":"multiple_choice"},"response":{"answer":""}}\'');
  process.exit(1);
}

let envelope;
try {
  // Try to parse as JSON string
  envelope = JSON.parse(envelopeArg);
} catch (error) {
  // Try to read as file path
  try {
    const fileContent = fs.readFileSync(envelopeArg, 'utf8');
    envelope = JSON.parse(fileContent);
  } catch (fileError) {
    console.error('❌ Error: Invalid JSON or file not found');
    console.error('   JSON parse error:', error.message);
    process.exit(1);
  }
}

// Generate signature
try {
  const signature = generateSignature(SERVICE_NAME, privateKey, envelope);
  
  console.log('');
  console.log('✅ Signature generated successfully!');
  console.log('');
  console.log('Headers for Postman:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`X-Service-Name: ${SERVICE_NAME}`);
  console.log(`X-Signature: ${signature}`);
  console.log('X-Request-Timeout: 180000');
  console.log('Content-Type: application/json');
  console.log('─────────────────────────────────────────────────────────');
  console.log('');
  console.log('Request Body:');
  console.log(JSON.stringify(envelope, null, 2));
  console.log('');
} catch (error) {
  console.error('❌ Error generating signature:', error.message);
  process.exit(1);
}

