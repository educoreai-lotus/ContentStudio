import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTemplateMigration() {
  try {
    console.log('🔄 Loading database connection...');
    
    // Import database connection dynamically
    const { db } = await import('../src/infrastructure/database/DatabaseConnection.js');
    
    console.log('⏳ Waiting for database connection...');
    await db.ready;
    
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Database not connected');
    }
    
    console.log('✅ Database connected');
    
    // Read migration file
    const migrationPath = join(__dirname, '../database/migrations/20250122_add_default_templates.sql');
    console.log(`📂 Reading migration file: ${migrationPath}`);
    
    const sql = readFileSync(migrationPath, 'utf-8');
    console.log(`📝 Migration SQL length: ${sql.length} characters`);
    
    if (!sql.trim()) {
      throw new Error('Migration file is empty');
    }
    
    // Execute migration
    console.log('🚀 Executing migration...');
    const result = await db.query(sql);
    
    console.log('✅ Migration executed successfully!');
    console.log(`📊 Rows affected: ${result.rowCount || 'N/A'}`);
    
    // Verify templates were inserted
    console.log('\n🔍 Verifying templates in database...');
    const verifyResult = await db.query(
      "SELECT template_id, template_name, created_by, format_order FROM templates WHERE created_by = 'system' ORDER BY template_id"
    );
    
    console.log(`\n📋 System templates in database: ${verifyResult.rows.length}`);
    if (verifyResult.rows.length === 0) {
      console.warn('⚠️  No system templates found! The migration may not have inserted any rows.');
    } else {
      verifyResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.template_name} (ID: ${row.template_id})`);
        console.log(`     Formats: ${JSON.stringify(row.format_order)}`);
      });
    }
    
    // Mark migration as executed in migration_log
    console.log('\n📝 Marking migration as executed in migration_log...');
    try {
      await db.query(
        `INSERT INTO migration_log (file_name, execution_duration_ms, success, error_message)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (file_name) 
         DO UPDATE SET 
           executed_at = CURRENT_TIMESTAMP,
           execution_duration_ms = $2,
           success = $3,
           error_message = $4`,
        ['20250122_add_default_templates.sql', 0, true, null]
      );
      console.log('✅ Migration marked as executed in migration_log');
    } catch (logError) {
      console.warn('⚠️  Could not mark migration in migration_log (table may not exist):', logError.message);
    }
    
    console.log('\n✅ All done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTemplateMigration();

