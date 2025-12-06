import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSignature } from '../src/utils/signature.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Upload migration file to Coordinator
 * This script uploads the migration file to make the service active
 */
async function uploadMigration() {
  // Read environment variables
  const coordinatorUrl = process.env.COORDINATOR_URL;
  const serviceId = process.env.SERVICE_ID;
  const serviceName = process.env.SERVICE_NAME || 'content-studio';
  const privateKey = process.env.CS_COORDINATOR_PRIVATE_KEY;

  // Validate required environment variables
  if (!coordinatorUrl) {
    console.error('❌ Error: COORDINATOR_URL environment variable is required');
    console.error('   Set it in Railway: railway variables set COORDINATOR_URL=https://coordinator-production-e0a0.up.railway.app');
    process.exit(1);
  }

  if (!serviceId) {
    console.error('❌ Error: SERVICE_ID environment variable is required');
    console.error('   Set it in Railway: railway variables set SERVICE_ID=your-service-id');
    process.exit(1);
  }

  if (!privateKey) {
    console.error('❌ Error: CS_COORDINATOR_PRIVATE_KEY environment variable is required');
    console.error('   Set it in Railway: railway variables set CS_COORDINATOR_PRIVATE_KEY="your-private-key"');
    process.exit(1);
  }

  // Read migration file
  const migrationFilePath = path.join(__dirname, '..', 'migration-content-studio.json');
  let migrationData;
  
  try {
    const migrationFileContent = fs.readFileSync(migrationFilePath, 'utf8');
    migrationData = JSON.parse(migrationFileContent);
  } catch (error) {
    console.error(`❌ Error reading migration file: ${error.message}`);
    console.error(`   File path: ${migrationFilePath}`);
    process.exit(1);
  }

  // Validate migration file structure
  if (!migrationData.migrationFile) {
    console.error('❌ Error: migration file must contain "migrationFile" object');
    process.exit(1);
  }

  if (!migrationData.migrationFile.version) {
    console.error('❌ Error: migrationFile.version is required');
    process.exit(1);
  }

  // Clean coordinator URL (remove trailing slash)
  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');
  const migrationUrl = `${cleanCoordinatorUrl}/register/${serviceId}/migration`;

  // Prepare payload
  const payload = {
    migrationFile: migrationData.migrationFile,
  };

  // Generate signature
  let signature;
  try {
    console.log('🔐 Generating signature...');
    signature = generateSignature(serviceName, privateKey, payload);
    console.log('✓ Signature generated successfully');
  } catch (error) {
    console.error(`❌ Error generating signature: ${error.message}`);
    process.exit(1);
  }

  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    'X-Service-Name': serviceName,
    'X-Signature': signature,
  };

  // Display request info
  console.log('\n📤 Uploading migration file...');
  console.log(`   URL: ${migrationUrl}`);
  console.log(`   Service Name: ${serviceName}`);
  console.log(`   Service ID: ${serviceId}`);
  console.log(`   Version: ${migrationData.migrationFile.version}`);
  console.log(`   Capabilities: ${migrationData.migrationFile.capabilities?.length || 0} capabilities`);
  console.log(`   Endpoints: ${migrationData.migrationFile.api?.endpoints?.length || 0} endpoints`);
  console.log(`   Tables: ${migrationData.migrationFile.tables?.length || 0} tables`);
  console.log('');

  // Send request
  try {
    const response = await axios.post(migrationUrl, payload, {
      headers,
      timeout: 30000, // 30 seconds timeout
    });

    // Check response
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Migration uploaded successfully!');
      console.log('');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      console.log('');
      
      if (response.data.status === 'active') {
        console.log('🎉 Service is now ACTIVE and available for AI routing!');
      } else {
        console.log(`⚠️  Service status: ${response.data.status}`);
      }
      
      return response.data;
    } else {
      console.error(`❌ Unexpected status code: ${response.status}`);
      console.error('Response:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration upload failed:');
    console.error('');
    
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;
      
      console.error(`   Status: ${status}`);
      console.error(`   Message: ${data?.message || 'Unknown error'}`);
      console.error('');
      console.error('   Full response:', JSON.stringify(data, null, 2));
      console.error('');
      
      // Provide helpful error messages
      if (status === 400) {
        console.error('   💡 Check: Ensure migrationFile structure is correct');
      } else if (status === 401) {
        console.error('   💡 Check: Verify CS_COORDINATOR_PRIVATE_KEY is correct');
        console.error('   💡 Check: Ensure SERVICE_NAME matches the registered service name');
      } else if (status === 404) {
        console.error(`   💡 Check: Verify SERVICE_ID is correct: ${serviceId}`);
        console.error('   💡 Check: Ensure service was registered in Stage 1');
      }
    } else if (error.request) {
      console.error('   Error: No response from Coordinator service');
      console.error(`   URL: ${migrationUrl}`);
      console.error('   💡 Check: Verify COORDINATOR_URL is correct and service is reachable');
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Run the script
uploadMigration()
  .then(() => {
    console.log('');
    console.log('✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });

