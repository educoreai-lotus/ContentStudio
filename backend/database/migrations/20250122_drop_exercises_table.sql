-- ============================================
-- Migration: Drop exercises table
-- Purpose: Remove exercises table as exercises will be stored in topics.devlab_exercises
-- Date: 2025-01-22
-- ============================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_exercises_topic_id;
DROP INDEX IF EXISTS idx_exercises_question_type;
DROP INDEX IF EXISTS idx_exercises_generation_mode;
DROP INDEX IF EXISTS idx_exercises_validation_status;
DROP INDEX IF EXISTS idx_exercises_status;
DROP INDEX IF EXISTS idx_exercises_skills;
DROP INDEX IF EXISTS idx_exercises_created_by;
DROP INDEX IF EXISTS idx_exercises_order_index;

-- Drop foreign key constraint
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS fk_exercises_topic_id;

-- Drop the exercises table
DROP TABLE IF EXISTS exercises;

