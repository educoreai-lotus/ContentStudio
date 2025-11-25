-- ============================================
-- Migration: Reset All Usage Counts
-- Date: 2025-01-22
-- Description: 
--   Reset all usage_count values to 0 in topics and trainer_courses tables
--   This migration implements the new behavior where usage_count only increments
--   when content is actually used for learners, not when it's created or fetched.
-- ============================================

-- ============================================
-- 1. Reset topics.usage_count
-- ============================================
UPDATE topics SET usage_count = 0;

-- Add comment for documentation
COMMENT ON COLUMN topics.usage_count IS 'Counts how many times this topic was actually used for learners. Starts at 0, only increments when topic is selected and returned to Course Builder for actual learners.';

-- ============================================
-- 2. Reset trainer_courses.usage_count
-- ============================================
UPDATE trainer_courses SET usage_count = 0;

-- Update comment for documentation
COMMENT ON COLUMN trainer_courses.usage_count IS 'Counts how many times this course was actually delivered/returned to employees of a company. Starts at 0, only increments when course is selected and returned to Course Builder/Directory for actual learners.';

-- ============================================
-- Migration Complete
-- ============================================
-- Note: generation_methods.usage_count is NOT reset (different purpose - tracks generation method usage)

