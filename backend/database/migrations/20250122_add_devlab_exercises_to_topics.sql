-- ============================================
-- Migration: Add devlab_exercises column to topics table
-- Purpose: Store DevLab exercises as JSONB in topics table instead of separate exercises table
-- Date: 2025-01-22
-- ============================================

-- Add devlab_exercises column to topics table (nullable JSONB)
ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS devlab_exercises JSONB;

-- Add comment
COMMENT ON COLUMN topics.devlab_exercises IS 'Stores DevLab exercises as JSONB. Can contain array of exercise objects with question_text, question_type, programming_language, etc.';

