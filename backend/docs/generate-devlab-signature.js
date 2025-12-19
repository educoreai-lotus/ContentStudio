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

const crypto = require('crypto');

// Get private key from environment
const privateKeyPem = process.env.CS_COORDINATOR_PRIVATE_KEY;

if (!privateKeyPem) {
  console.error('❌ Error: CS_COORDINATOR_PRIVATE_KEY environment variable is required');
  console.error('   Set it with: export CS_COORDINATOR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."');
  process.exit(1);
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

// Step 1: Stringify the envelope
const envelopeString = JSON.stringify(envelope);

// Step 2: Create SHA256 hash
const payloadHash = crypto.createHash('sha256')
  .update(envelopeString)
  .digest('hex');

// Step 3: Build message
const message = `educoreai-content-studio-${payloadHash}`;

console.log('📝 Message to sign:');
console.log(`   ${message.substring(0, 80)}...`);
console.log(`   (Full length: ${message.length} characters)`);
console.log(`\n🔑 Payload hash: ${payloadHash.substring(0, 16)}...`);

// Step 4: Sign with ECDSA P-256
try {
  const signer = crypto.createSign('SHA256');
  signer.update(message, 'utf8');
  signer.end();
  
  const signatureBase64 = signer.sign(privateKeyPem, 'base64');
  const cleanSignature = signatureBase64.replace(/\s+/g, '');
  
  console.log('\n✅ Signature generated successfully!');
  console.log(`   Length: ${cleanSignature.length} characters`);
  console.log(`   Prefix: ${cleanSignature.substring(0, 30)}...`);
  
  // Display full request details
  const coordinatorUrl = process.env.COORDINATOR_URL || 'https://coordinator-production.railway.app';
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 POSTMAN REQUEST DETAILS');
  console.log('='.repeat(80));
  
  console.log('\n📍 URL:');
  console.log(`   POST ${coordinatorUrl}/api/fill-content-metrics/`);
  
  console.log('\n📤 Headers:');
  console.log('   Content-Type: application/json');
  console.log('   X-Service-Name: content-studio');
  console.log(`   X-Signature: ${cleanSignature}`);
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

