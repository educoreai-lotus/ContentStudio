/**
 * Script to generate signature for DevLab request
 * 
 * Usage:
 *   node generate-devlab-signature.js
 * 
 * Requires:
 *   - CS_COORDINATOR_PRIVATE_KEY environment variable
 *   - COORDINATOR_URL environment variable (optional, for display)
 */

import { generateSignature } from '../src/utils/signature.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const SERVICE_NAME = process.env.SERVICE_NAME || 'content-studio';

// Get private key from environment
let privateKeyPem = process.env.CS_COORDINATOR_PRIVATE_KEY;

if (!privateKeyPem) {
  // Try to read from private-key.pem in docs or root
  try {
    privateKeyPem = readFileSync(join(__dirname, 'private-key.pem'), 'utf8');
  } catch (e) {
    try {
      privateKeyPem = readFileSync(join(__dirname, '..', 'private-key.pem'), 'utf8');
    } catch (e2) {
      console.error('❌ Error: CS_COORDINATOR_PRIVATE_KEY environment variable is required');
      console.error('   Set it with: export CS_COORDINATOR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."');
      console.error('   Or create a private-key.pem file in the docs or root directory');
      process.exit(1);
    }
  }
}

// Build the envelope (same structure as devlabClient.js)
const envelope = {
  requester_service: "content-studio",
  payload: {
    action: "generate-questions",
    description: "Generate devlab AI exercises",
    targetService: "devlab-service",
    topic_id: "123",
    topic_name: "Lists (Arrays)",
    question_type: "code",
    skills: [
      "Lists",
      "Indexing",
      "List Methods",
      "Iteration",
      "Mutable Data"
    ],
    humanLanguage: "english",
    amount: 4,
    programming_language: "python"
  },
  response: {
    answer: ""
  }
};

// Generate signature using the same function as the app
try {
  // IMPORTANT: The signature is generated on the ENTIRE ENVELOPE, not just the payload
  // This matches how coordinatorClient.js creates signatures (line 61)
  const signature = generateSignature(SERVICE_NAME, privateKeyPem, envelope);
  
  console.log('\n✅ Signature generated successfully!');
  console.log(`   Length: ${signature.length} characters`);
  console.log(`   Prefix: ${signature.substring(0, 30)}...`);
  
  // Display full request details
  const coordinatorUrl = process.env.COORDINATOR_URL || 'https://coordinator-production.railway.app';
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 POSTMAN REQUEST DETAILS');
  console.log('='.repeat(80));
  
  console.log('\n📍 URL:');
  console.log(`   POST ${coordinatorUrl}/api/fill-content-metrics/`);
  
  console.log('\n📤 Headers:');
  console.log('   Content-Type: application/json');
  console.log(`   X-Service-Name: ${SERVICE_NAME}`);
  console.log(`   X-Signature: ${signature}`);
  console.log('   X-Request-Timeout: 180000');
  
  console.log('\n📦 Body (JSON):');
  console.log(JSON.stringify(envelope, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log('💡 Copy the X-Signature header value above to Postman');
  console.log('='.repeat(80));
  
} catch (error) {
  console.error('\n❌ Error generating signature:');
  console.error(`   ${error.message}`);
  console.error('\n💡 Make sure CS_COORDINATOR_PRIVATE_KEY is a valid ECDSA P-256 private key in PEM format');
  process.exit(1);
}

