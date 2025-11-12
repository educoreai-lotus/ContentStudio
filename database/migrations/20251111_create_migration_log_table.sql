-- Migration: Create migration_log table for tracking executed migrations
-- This migration should be the first one to run (or be marked as baseline)

CREATE TABLE IF NOT EXISTS migration_log (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_migration_log_file_name ON migration_log(file_name);
CREATE INDEX IF NOT EXISTS idx_migration_log_executed_at ON migration_log(executed_at DESC);

