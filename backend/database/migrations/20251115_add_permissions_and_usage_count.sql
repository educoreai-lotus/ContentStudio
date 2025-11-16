-- ============================================
-- Migration: Add permissions and usage_count columns
-- Date: 2025-11-15
-- Description: 
--   1. Add permissions column to trainer_courses table
--   2. Add usage_count column to trainer_courses table (for courses)
--   3. Add usage_count column to generation_methods table
-- ============================================

-- ============================================
-- 1. Add permissions column to trainer_courses
-- ============================================
ALTER TABLE trainer_courses 
ADD COLUMN IF NOT EXISTS permissions TEXT;

-- Add comment for documentation
COMMENT ON COLUMN trainer_courses.permissions IS 'Stores trainer allowed organizations or scopes from Directory microservice';

-- ============================================
-- 2. Add usage_count column to trainer_courses (courses table)
-- ============================================
ALTER TABLE trainer_courses 
ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN trainer_courses.usage_count IS 'Counts how many times this course was fetched or served to other microservices';

-- ============================================
-- 3. Add usage_count column to generation_methods
-- ============================================
ALTER TABLE generation_methods 
ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN generation_methods.usage_count IS 'Counts how many times this generation method was used';

-- ============================================
-- Note: topics.usage_count already exists in the schema
-- No migration needed for topics table
-- ============================================


