import dotenv from 'dotenv';
import { uploadMigration } from '../src/registration/register.js';

// Load environment variables
dotenv.config();

/**
 * Upload migration file to Coordinator
 * This script uploads the migration file to make the service active
 * Uses the uploadMigration function from register.js
 */
async function main() {
  // Validate required environment variables
  const coordinatorUrl = process.env.COORDINATOR_URL;
  const serviceId = process.env.SERVICE_ID;
  const privateKey = process.env.CS_COORDINATOR_PRIVATE_KEY;

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

  console.log('📤 Starting migration upload...');
  console.log(`   COORDINATOR_URL: ${coordinatorUrl}`);
  console.log(`   SERVICE_ID: ${serviceId}`);
  console.log('');

  // Use the uploadMigration function from register.js
  const result = await uploadMigration();

  if (result.success) {
    if (result.skipped) {
      console.log('⏭️  Migration upload skipped (already uploaded or service not registered)');
      process.exit(0);
    } else {
      console.log('✅ Migration upload completed successfully!');
      if (result.status === 'active') {
        console.log('🎉 Service is now ACTIVE and available for AI routing!');
      }
      process.exit(0);
    }
  } else {
    console.error('❌ Migration upload failed');
    if (result.error) {
      console.error(`   Error: ${result.error}`);
    }
    process.exit(1);
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('');
    console.error('❌ Script failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

