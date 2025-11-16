-- ============================================
-- Migration: Create exercises table
-- Purpose: Store DevLab exercises for topics
-- Date: 2025-11-16
-- ============================================

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
    exercise_id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- 'code' or 'theoretical'
    programming_language VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    skills TEXT[],
    hint TEXT,
    solution TEXT,
    test_cases JSONB,
    difficulty VARCHAR(20),
    points INTEGER DEFAULT 10,
    order_index INTEGER DEFAULT 0,
    generation_mode VARCHAR(20) NOT NULL, -- 'ai' or 'manual'
    validation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    validation_message TEXT,
    devlab_response JSONB, -- Store full response from DevLab/Dabla
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived', 'deleted'
    
    -- Foreign Keys
    CONSTRAINT fk_exercises_topic_id FOREIGN KEY (topic_id) 
        REFERENCES topics(topic_id) ON DELETE CASCADE
);

-- Indexes for exercises
CREATE INDEX IF NOT EXISTS idx_exercises_topic_id ON exercises(topic_id);
CREATE INDEX IF NOT EXISTS idx_exercises_question_type ON exercises(question_type);
CREATE INDEX IF NOT EXISTS idx_exercises_generation_mode ON exercises(generation_mode);
CREATE INDEX IF NOT EXISTS idx_exercises_validation_status ON exercises(validation_status);
CREATE INDEX IF NOT EXISTS idx_exercises_status ON exercises(status);
CREATE INDEX IF NOT EXISTS idx_exercises_skills ON exercises USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_exercises_created_by ON exercises(created_by);
CREATE INDEX IF NOT EXISTS idx_exercises_order_index ON exercises(topic_id, order_index);

-- Add comment
COMMENT ON TABLE exercises IS 'Stores DevLab exercises for topics. Supports both AI-generated and manual exercises.';
COMMENT ON COLUMN exercises.generation_mode IS 'ai: AI-generated exercises, manual: trainer-created exercises';
COMMENT ON COLUMN exercises.validation_status IS 'pending: awaiting validation, approved: validated by DevLab, rejected: failed validation';
COMMENT ON COLUMN exercises.devlab_response IS 'Full JSON response from DevLab/Dabla service';

