import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../DatabaseConnection.js';
import { logger } from '../../logging/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Migration Runner Service
 * Automatically executes database migrations on application startup
 */
export class MigrationRunner {
  constructor() {
    this.migrationsPath = join(__dirname, '../../../../database/migrations');
  }

  /**
   * Check if migration_log table exists
   */
  async migrationTableExists() {
    if (!db.isConnected()) {
      return false;
    }

    try {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'migration_log'
        );
      `);
      return result.rows[0]?.exists || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get list of already executed migrations
   */
  async getExecutedMigrations() {
    if (!db.isConnected()) {
      return new Set();
    }

    try {
      const result = await db.query(
        'SELECT file_name FROM migration_log WHERE success = true ORDER BY executed_at'
      );
      return new Set(result.rows.map(row => row.file_name));
    } catch (error) {
      logger.error('Failed to fetch executed migrations', { error: error.message });
      // If table doesn't exist yet, return empty set
      if (error.message.includes('does not exist')) {
        return new Set();
      }
      throw error;
    }
  }

  /**
   * Mark a migration as executed
   */
  async markMigrationExecuted(fileName, durationMs, success = true, errorMessage = null) {
    if (!db.isConnected()) {
      return;
    }

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
        [fileName, durationMs, success, errorMessage]
      );
    } catch (error) {
      logger.error(`Failed to mark migration ${fileName} as executed`, { error: error.message });
      // Don't throw - this is just logging
    }
  }

  /**
   * Get all migration files from the migrations directory
   */
  async getMigrationFiles() {
    try {
      const files = await readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort alphabetically (which works for date-prefixed files)
    } catch (error) {
      logger.error('Failed to read migrations directory', { 
        path: this.migrationsPath,
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Execute a single migration file
   */
  async executeMigration(fileName) {
    const filePath = join(this.migrationsPath, fileName);
    const startTime = Date.now();

    try {
      logger.info(`Executing migration: ${fileName}`);
      
      const sql = await readFile(filePath, 'utf-8');
      
      if (!sql.trim()) {
        logger.warn(`Migration file ${fileName} is empty, skipping`);
        await this.markMigrationExecuted(fileName, Date.now() - startTime, true);
        return;
      }

      // Execute the SQL
      await db.query(sql);
      
      const duration = Date.now() - startTime;
      await this.markMigrationExecuted(fileName, duration, true);
      
      logger.info(`✅ Migration ${fileName} executed successfully (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.markMigrationExecuted(fileName, duration, false, error.message);
      
      logger.error(`❌ Migration ${fileName} failed`, { 
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw new Error(`Migration ${fileName} failed: ${error.message}`);
    }
  }

  /**
   * Mark baseline migrations as already executed (for existing databases)
   * These are migrations that were applied manually before the migration system was implemented
   */
  async markBaselineMigrations() {
    if (!db.isConnected()) {
      return;
    }

    // These migrations were applied manually before the migration system was implemented
    // They should be marked as executed without actually running them
    const baselineMigrations = [
      'migration.sql', // Base schema - already exists in production
      'add_ids_to_lookup_tables.sql',
      'fix_enum_to_lookup_tables.sql',
      'update_to_id_based_lookup.sql',
      'add_language_stats.sql',
      'add_cleanup_functions.sql',
      '20251109_add_default_templates.sql',
      '20251111_add_deleted_at_to_content_history.sql',
      '20251111_remove_content_id_from_history.sql',
      // Note: 20251111_remove_version_number_from_history.sql should run automatically
      // if it hasn't been applied yet
    ];

    for (const fileName of baselineMigrations) {
      try {
        // Check if already marked
        const result = await db.query(
          'SELECT file_name FROM migration_log WHERE file_name = $1',
          [fileName]
        );

        if (result.rows.length === 0) {
          // Mark as executed without actually running it
          await db.query(
            `INSERT INTO migration_log (file_name, success, error_message)
             VALUES ($1, true, 'Marked as baseline - already applied manually')
             ON CONFLICT (file_name) DO NOTHING`,
            [fileName]
          );
          logger.info(`✅ Marked baseline migration as executed: ${fileName}`);
        }
      } catch (error) {
        // If migration_log table doesn't exist yet, that's okay - it will be created
        if (!error.message.includes('does not exist')) {
          logger.warn(`Failed to mark baseline migration ${fileName}`, { error: error.message });
        }
      }
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    if (!db.isConnected()) {
      logger.warn('Database not connected, skipping migrations');
      return;
    }

    try {
      // Step 1: Check if migration_log table exists
      const tableExists = await this.migrationTableExists();
      
      // Step 2: If table doesn't exist, we need to create it manually first
      // (before we can track migrations)
      if (!tableExists) {
        logger.info('Migration log table does not exist, creating it...');
        try {
          const createTableQuery = `
            CREATE TABLE migration_log (
              id SERIAL PRIMARY KEY,
              file_name VARCHAR(255) UNIQUE NOT NULL,
              executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              execution_duration_ms INTEGER,
              success BOOLEAN DEFAULT true,
              error_message TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_migration_log_file_name ON migration_log(file_name);
            CREATE INDEX IF NOT EXISTS idx_migration_log_executed_at ON migration_log(executed_at DESC);
          `;
          await db.query(createTableQuery);
          logger.info('✅ Migration log table created successfully');
          
          // Mark the migration file as executed
          await this.markMigrationExecuted('20251111_create_migration_log_table.sql', 0, true, 'Created via ensureMigrationTable');
        } catch (error) {
          logger.error('Failed to create migration_log table', { error: error.message });
          throw error;
        }
      }

      // Step 3: Now run the migration_log table migration if it hasn't been tracked yet
      const migrationLogMigration = '20251111_create_migration_log_table.sql';
      const executedMigrations = await this.getExecutedMigrations();
      
      if (!executedMigrations.has(migrationLogMigration)) {
        // Table exists but migration not tracked - run the migration file
        try {
          await this.executeMigration(migrationLogMigration);
        } catch (error) {
          // If it fails because table/index already exists, that's okay - mark it as executed
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            logger.info('Migration log table/index already exists, marking migration as executed');
            await this.markMigrationExecuted(migrationLogMigration, 0, true, 'Table/index already existed');
          } else {
            throw error;
          }
        }
      }

      // Step 4: Mark baseline migrations (migrations that were applied manually)
      await this.markBaselineMigrations();

      // Step 5: Get all migration files (excluding non-SQL files)
      const migrationFiles = await this.getMigrationFiles();
      
      if (migrationFiles.length === 0) {
        logger.info('No migration files found');
        return;
      }

      // Step 6: Get updated list of executed migrations (after baseline marking)
      const updatedExecutedMigrations = await this.getExecutedMigrations();

      // Step 7: Filter out already executed migrations
      const pendingMigrations = migrationFiles.filter(
        file => !updatedExecutedMigrations.has(file)
      );

      if (pendingMigrations.length === 0) {
        logger.info('✅ All migrations are up to date');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migration(s): ${pendingMigrations.join(', ')}`);

      // Step 8: Execute pending migrations in order
      for (const fileName of pendingMigrations) {
        await this.executeMigration(fileName);
      }

      logger.info(`✅ All ${pendingMigrations.length} migration(s) completed successfully`);
    } catch (error) {
      logger.error('❌ Migration process failed', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner();

