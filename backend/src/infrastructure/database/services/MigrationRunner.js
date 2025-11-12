import { readdir, readFile, access } from 'fs/promises';
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
    // Try multiple possible paths for migrations directory
    // Path 1: Relative to this file (development) - backend/src/infrastructure/database/services -> ../../../../database/migrations
    const relativePath = join(__dirname, '../../../../database/migrations');
    // Path 2: Relative to project root from backend directory (production/Railway)
    const rootPath = join(process.cwd(), 'database/migrations');
    // Path 3: Relative to project root from backend (if cwd is backend)
    const backendRootPath = join(process.cwd(), '../database/migrations');
    // Path 4: Absolute from app root (Railway/Docker)
    const appRootPath = '/app/database/migrations';
    // Path 5: From backend directory (if cwd is /app/backend)
    const backendAppPath = '/app/backend/../database/migrations';
    
    // Use the first path that exists, or default to relative path
    this.migrationsPath = relativePath;
    this.alternativePaths = [rootPath, backendRootPath, appRootPath, backendAppPath];
  }

  /**
   * Get the correct migrations path by checking which one exists
   */
  async getMigrationsPath() {
    // Check if primary path exists
    try {
      await access(this.migrationsPath);
      logger.info(`[MigrationRunner] 📂 Using migrations path: ${this.migrationsPath}`);
      return this.migrationsPath;
    } catch (error) {
      // Try alternative paths
      for (const altPath of this.alternativePaths) {
        try {
          await access(altPath);
          logger.info(`[MigrationRunner] 📂 Using migrations path: ${altPath}`);
          return altPath;
        } catch (err) {
          // Continue to next path
        }
      }
      
      // If none exist, log all attempted paths
      logger.error('[MigrationRunner] ❌ Could not find migrations directory', {
        attemptedPaths: [this.migrationsPath, ...this.alternativePaths],
        cwd: process.cwd(),
        __dirname: __dirname
      });
      throw new Error(`Migrations directory not found. Tried: ${[this.migrationsPath, ...this.alternativePaths].join(', ')}`);
    }
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
      const migrationsPath = await this.getMigrationsPath();
      const files = await readdir(migrationsPath);
      const sqlFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort alphabetically (which works for date-prefixed files)
      
      logger.info(`[MigrationRunner] 📂 Found ${sqlFiles.length} SQL file(s) in ${migrationsPath}`);
      return sqlFiles;
    } catch (error) {
      logger.error('[MigrationRunner] ❌ Failed to read migrations directory', { 
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Execute a single migration file
   */
  async executeMigration(fileName) {
    const migrationsPath = await this.getMigrationsPath();
    const filePath = join(migrationsPath, fileName);
    const startTime = Date.now();

    try {
      logger.info(`[MigrationRunner] 🔄 Executing migration: ${fileName}`);
      
      const sql = await readFile(filePath, 'utf-8');
      
      if (!sql.trim()) {
        logger.warn(`[MigrationRunner] ⚠️ Migration file ${fileName} is empty, skipping`);
        await this.markMigrationExecuted(fileName, Date.now() - startTime, true);
        return;
      }

      logger.info(`[MigrationRunner] 📝 Migration SQL (first 200 chars): ${sql.substring(0, 200)}...`);

      // Execute the SQL
      const result = await db.query(sql);
      
      const duration = Date.now() - startTime;
      await this.markMigrationExecuted(fileName, duration, true);
      
      logger.info(`[MigrationRunner] ✅ Migration ${fileName} executed successfully (${duration}ms)`);
      if (result.rowCount !== undefined) {
        logger.info(`[MigrationRunner] 📊 Rows affected: ${result.rowCount}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.markMigrationExecuted(fileName, duration, false, error.message);
      
      logger.error(`[MigrationRunner] ❌ Migration ${fileName} failed`, { 
        error: error.message,
        stack: error.stack,
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
    logger.info('[MigrationRunner] 🚀 Starting migration process...');
    
    if (!db.isConnected()) {
      logger.warn('[MigrationRunner] ⚠️ Database not connected, skipping migrations');
      logger.warn('[MigrationRunner] 💡 Check DATABASE_URL environment variable');
      return;
    }

    logger.info('[MigrationRunner] ✅ Database connection verified');

    try {
      // Step 1: Check if migration_log table exists
      logger.info('[MigrationRunner] 🔍 Checking for migration_log table...');
      const tableExists = await this.migrationTableExists();
      logger.info(`[MigrationRunner] ${tableExists ? '✅' : '❌'} Migration log table exists: ${tableExists}`);
      
      // Step 2: If table doesn't exist, we need to create it manually first
      // (before we can track migrations)
      if (!tableExists) {
        logger.info('[MigrationRunner] 📝 Migration log table does not exist, creating it...');
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
          logger.info('[MigrationRunner] ✅ Migration log table created successfully');
          
          // Mark the migration file as executed
          await this.markMigrationExecuted('20251111_create_migration_log_table.sql', 0, true, 'Created via ensureMigrationTable');
        } catch (error) {
          logger.error('[MigrationRunner] ❌ Failed to create migration_log table', { error: error.message, stack: error.stack });
          throw error;
        }
      } else {
        logger.info('[MigrationRunner] ✅ Migration log table already exists');
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
      logger.info('[MigrationRunner] 📋 Marking baseline migrations...');
      await this.markBaselineMigrations();
      logger.info('[MigrationRunner] ✅ Baseline migrations marked');

      // Step 5: Get all migration files (excluding non-SQL files)
      logger.info('[MigrationRunner] 📂 Scanning migration files...');
      const migrationFiles = await this.getMigrationFiles();
      logger.info(`[MigrationRunner] 📋 Found ${migrationFiles.length} migration file(s): ${migrationFiles.join(', ')}`);
      
      if (migrationFiles.length === 0) {
        logger.info('[MigrationRunner] ⚠️ No migration files found');
        return;
      }

      // Step 6: Get updated list of executed migrations (after baseline marking)
      logger.info('[MigrationRunner] 📊 Checking executed migrations...');
      const updatedExecutedMigrations = await this.getExecutedMigrations();
      logger.info(`[MigrationRunner] ✅ Found ${updatedExecutedMigrations.size} already executed migration(s)`);

      // Step 7: Filter out already executed migrations
      const pendingMigrations = migrationFiles.filter(
        file => !updatedExecutedMigrations.has(file)
      );

      if (pendingMigrations.length === 0) {
        logger.info('[MigrationRunner] ✅ All migrations are up to date - no pending migrations');
        return;
      }

      logger.info(`[MigrationRunner] 🔄 Found ${pendingMigrations.length} pending migration(s): ${pendingMigrations.join(', ')}`);

      // Step 8: Execute pending migrations in order
      for (const fileName of pendingMigrations) {
        await this.executeMigration(fileName);
      }

      logger.info(`[MigrationRunner] ✅ All ${pendingMigrations.length} migration(s) completed successfully`);
    } catch (error) {
      logger.error('❌ Migration process failed', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner();

