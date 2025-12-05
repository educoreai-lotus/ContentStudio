import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_NAME = 'content-studio';

// Generate ECDSA P-256 key pair
console.log('🔐 Generating ECDSA P-256 (prime256v1) key pair...\n');

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1', // P-256 curve
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// Display keys in terminal
console.log('='.repeat(80));
console.log('PRIVATE KEY (PEM) - Copy this to Railway as CONTENT_STUDIO_PRIVATE_KEY');
console.log('='.repeat(80));
console.log(privateKey);
console.log('\n');

console.log('='.repeat(80));
console.log('PUBLIC KEY (PEM) - Copy this to Railway as COORDINATOR_PUBLIC_KEY (if needed)');
console.log('='.repeat(80));
console.log(publicKey);
console.log('\n');

// Save keys to files (in backend directory, not committed)
const privateKeyPath = path.join(__dirname, '..', `${SERVICE_NAME}-ecdsa-private-key.pem`);
const publicKeyPath = path.join(__dirname, '..', `${SERVICE_NAME}-ecdsa-public-key.pem`);

// Check if files already exist
if (fs.existsSync(privateKeyPath)) {
  console.warn(`⚠️  WARNING: ${privateKeyPath} already exists. Not overwriting.`);
} else {
  fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 }); // Read/write for owner only
  console.log(`✅ Private key saved to: ${privateKeyPath}`);
}

if (fs.existsSync(publicKeyPath)) {
  console.warn(`⚠️  WARNING: ${publicKeyPath} already exists. Not overwriting.`);
} else {
  fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 }); // Read for all, write for owner
  console.log(`✅ Public key saved to: ${publicKeyPath}`);
}

console.log('\n');
console.log('📝 Next steps:');
console.log('1. Copy the PRIVATE KEY above to Railway as CONTENT_STUDIO_PRIVATE_KEY');
console.log('2. Copy the PUBLIC KEY above to Railway as COORDINATOR_PUBLIC_KEY (if needed)');
console.log('3. The key files are saved locally but will NOT be committed to git');
console.log('4. Keep these keys secure and never commit them to version control');

