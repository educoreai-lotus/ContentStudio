-- ============================================
-- Content Studio Database Schema Migration
-- PostgreSQL Schema for Content Studio Microservice
-- Initial schema for fresh Supabase database
-- Last Updated: 2025-01-22
-- ============================================

-- ============================================
-- ENUM Types
-- ============================================

-- Content Status Enum
CREATE TYPE content_status AS ENUM ('active', 'archived', 'deleted');

-- Template Type Enum
CREATE TYPE "TemplateType" AS ENUM ('ready_template', 'ai_generated', 'manual', 'mixed_ai_manual');

-- ============================================
-- Table 1: trainer_courses
-- ============================================

CREATE TABLE trainer_courses (
    course_id SERIAL PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    trainer_id VARCHAR(50) NOT NULL,
    description TEXT,
    skills TEXT[],
    language VARCHAR(10) DEFAULT 'en',
    status content_status DEFAULT 'active',
    company_logo VARCHAR(500),
    permissions TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for trainer_courses
CREATE INDEX idx_trainer_courses_trainer_id ON trainer_courses(trainer_id);
CREATE INDEX idx_trainer_courses_status ON trainer_courses(status);
CREATE INDEX idx_trainer_courses_created_at ON trainer_courses(created_at);
CREATE INDEX idx_trainer_courses_skills ON trainer_courses USING GIN (skills);

-- Comments for trainer_courses
COMMENT ON TABLE trainer_courses IS 'Stores course-level data created by trainers';
COMMENT ON COLUMN trainer_courses.permissions IS 'Stores trainer allowed organizations or scopes from Directory microservice';
COMMENT ON COLUMN trainer_courses.usage_count IS 'Counts how many times this course was fetched or served to other microservices';

-- ============================================
-- Table 2: templates
-- ============================================

CREATE TABLE templates (
    template_id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    template_type "TemplateType" NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    format_order JSONB
);

-- Indexes for templates
CREATE INDEX idx_templates_template_type ON templates(template_type);
CREATE INDEX idx_templates_created_by ON templates(created_by);
CREATE INDEX idx_templates_format_order ON templates USING GIN (format_order);

-- Comments for templates
COMMENT ON TABLE templates IS 'Stores both structural templates (format order) and AI prompt templates';

-- ============================================
-- Table 3: content_types (Lookup Table)
-- ============================================

CREATE TABLE content_types (
    type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL
);

-- Indexes for content_types
CREATE INDEX idx_content_types_type_name ON content_types(type_name);

-- Seed Data for content_types
INSERT INTO content_types (type_name, display_name) VALUES
('text', 'Text Content'),
('code', 'Code Example'),
('presentation', 'Presentation'),
('audio', 'Audio Narration'),
('mind_map', 'Mind Map'),
('avatar_video', 'Avatar Video');

-- Comments for content_types
COMMENT ON TABLE content_types IS 'Lookup table for content type metadata and characteristics';

-- ============================================
-- Table 4: generation_methods (Lookup Table)
-- ============================================

CREATE TABLE generation_methods (
    method_id SERIAL PRIMARY KEY,
    method_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0
);

-- Indexes for generation_methods
CREATE INDEX idx_generation_methods_method_name ON generation_methods(method_name);

-- Seed Data for generation_methods
INSERT INTO generation_methods (method_name, display_name) VALUES
('manual', 'Manual Creation'),
('ai_assisted', 'AI-Assisted'),
('manual_edited', 'AI-Generated & Manually Edited'),
('video_to_lesson', 'Video to Lesson');

-- Comments for generation_methods
COMMENT ON TABLE generation_methods IS 'Lookup table for generation method metadata and characteristics';
COMMENT ON COLUMN generation_methods.usage_count IS 'Counts how many times this generation method was used';

-- ============================================
-- Table 5: topics (Lessons)
-- ============================================

CREATE TABLE topics (
    topic_id SERIAL PRIMARY KEY,
    course_id INTEGER,
    topic_name VARCHAR(255) NOT NULL,
    description TEXT,
    trainer_id VARCHAR(50) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    status content_status DEFAULT 'active',
    skills TEXT[],
    template_id INTEGER,
    generation_methods_id INTEGER,
    usage_count INTEGER DEFAULT 0,
    devlab_exercises JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_topics_course_id FOREIGN KEY (course_id) 
        REFERENCES trainer_courses(course_id) ON DELETE SET NULL,
    CONSTRAINT fk_topics_template_id FOREIGN KEY (template_id) 
        REFERENCES templates(template_id) ON DELETE SET NULL,
    CONSTRAINT fk_topics_generation_methods_id FOREIGN KEY (generation_methods_id) 
        REFERENCES generation_methods(method_id) ON DELETE SET NULL
);

-- Indexes for topics
CREATE INDEX idx_topics_course_id ON topics(course_id);
CREATE INDEX idx_topics_trainer_id ON topics(trainer_id);
CREATE INDEX idx_topics_status ON topics(status);
CREATE INDEX idx_topics_generation_methods_id ON topics(generation_methods_id);
CREATE INDEX idx_topics_skills ON topics USING GIN (skills);

-- Comments for topics
COMMENT ON TABLE topics IS 'Represents lessons (topics) - can belong to course or be stand-alone';
COMMENT ON COLUMN topics.course_id IS 'Nullable for stand-alone lessons';
COMMENT ON COLUMN topics.usage_count IS 'Starts at zero, returned to Course Builder when adapted to learner';
COMMENT ON COLUMN topics.devlab_exercises IS 'Stores DevLab exercises as JSONB. Can contain array of exercise objects with question_text, question_type, programming_language, etc.';

-- ============================================
-- Table 6: content
-- ============================================

CREATE TABLE content (
    content_id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL,
    content_type_id INTEGER NOT NULL,
    content_data JSONB,
    generation_method_id INTEGER NOT NULL,
    
    -- Quality check fields (stored in content table)
    quality_check_data JSONB,
    quality_check_status VARCHAR(20),
    quality_checked_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_content_topic_id FOREIGN KEY (topic_id) 
        REFERENCES topics(topic_id) ON DELETE RESTRICT,
    CONSTRAINT fk_content_content_type_id FOREIGN KEY (content_type_id) 
        REFERENCES content_types(type_id) ON DELETE RESTRICT,
    CONSTRAINT fk_content_generation_method_id FOREIGN KEY (generation_method_id) 
        REFERENCES generation_methods(method_id) ON DELETE RESTRICT
);

-- Indexes for content
CREATE INDEX idx_content_topic_id ON content(topic_id);
CREATE INDEX idx_content_content_type_id ON content(content_type_id);
CREATE INDEX idx_content_generation_method_id ON content(generation_method_id);
CREATE INDEX idx_content_content_data ON content USING GIN (content_data);
CREATE INDEX idx_content_quality_check_status ON content(quality_check_status);
CREATE INDEX idx_content_quality_check_data ON content USING GIN (quality_check_data);

-- Comments for content
COMMENT ON TABLE content IS 'Stores each content item (format-specific data) belonging to a topic';
COMMENT ON COLUMN content.quality_check_data IS 'Stores all quality check results (clarity, difficulty, structure, plagiarism)';
COMMENT ON COLUMN content.quality_check_status IS 'Status: pending, passed, failed, flagged';
COMMENT ON COLUMN content.content_type_id IS 'References content_types.type_id (INTEGER)';
COMMENT ON COLUMN content.generation_method_id IS 'References generation_methods.method_id (INTEGER)';

-- ============================================
-- Table 7: content_history
-- ============================================

CREATE TABLE content_history (
    history_id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL,
    content_type_id INTEGER NOT NULL,
    content_data JSONB NOT NULL,
    generation_method_id INTEGER NOT NULL,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_content_history_topic_id FOREIGN KEY (topic_id) 
        REFERENCES topics(topic_id) ON DELETE RESTRICT,
    CONSTRAINT fk_content_history_content_type_id FOREIGN KEY (content_type_id) 
        REFERENCES content_types(type_id) ON DELETE RESTRICT,
    CONSTRAINT fk_content_history_generation_method_id FOREIGN KEY (generation_method_id) 
        REFERENCES generation_methods(method_id) ON DELETE RESTRICT
);

-- Indexes for content_history
CREATE INDEX idx_content_history_topic_id ON content_history(topic_id);
CREATE INDEX idx_content_history_content_data ON content_history USING GIN (content_data);
CREATE INDEX idx_content_history_created_at ON content_history(created_at);
CREATE INDEX idx_content_history_updated_at ON content_history(topic_id, content_type_id, updated_at DESC);

-- Comments for content_history
COMMENT ON TABLE content_history IS 'Stores all version history of content for audit, rollback, and analytics';
COMMENT ON COLUMN content_history.content_type_id IS 'References content_types.type_id (INTEGER)';
COMMENT ON COLUMN content_history.generation_method_id IS 'References generation_methods.method_id (INTEGER)';

-- ============================================
-- Table 8: language_stats
-- ============================================

CREATE TABLE language_stats (
    language_code VARCHAR(10) PRIMARY KEY,
    language_name VARCHAR(100) NOT NULL,
    total_requests INT DEFAULT 0,
    total_lessons INT DEFAULT 0,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_frequent BOOLEAN DEFAULT FALSE,
    is_predefined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for language_stats
CREATE INDEX idx_language_stats_is_frequent ON language_stats(is_frequent);
CREATE INDEX idx_language_stats_total_requests ON language_stats(total_requests DESC);
CREATE INDEX idx_language_stats_last_used ON language_stats(last_used DESC);

-- Insert predefined languages
INSERT INTO language_stats (language_code, language_name, is_frequent, is_predefined)
VALUES 
    ('en', 'English', true, true),
    ('he', 'Hebrew', true, true),
    ('ar', 'Arabic', true, true)
ON CONFLICT (language_code) DO UPDATE SET
    is_frequent = EXCLUDED.is_frequent,
    is_predefined = EXCLUDED.is_predefined;

-- Comments for language_stats
COMMENT ON TABLE language_stats IS 'Tracks language usage statistics and frequency for multilingual content management';

-- ============================================
-- Table 9: migration_log
-- ============================================

CREATE TABLE migration_log (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Indexes for migration_log
CREATE INDEX idx_migration_log_file_name ON migration_log(file_name);
CREATE INDEX idx_migration_log_executed_at ON migration_log(executed_at DESC);

-- ============================================
-- Functions for Language Statistics
-- ============================================

-- Function to update language stats
CREATE OR REPLACE FUNCTION update_language_stats(
    p_language_code VARCHAR(10),
    p_language_name VARCHAR(100) DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO language_stats (language_code, language_name, total_requests, last_used)
    VALUES (p_language_code, COALESCE(p_language_name, p_language_code), 1, CURRENT_TIMESTAMP)
    ON CONFLICT (language_code) DO UPDATE SET
        total_requests = language_stats.total_requests + 1,
        last_used = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to promote/demote languages based on usage
CREATE OR REPLACE FUNCTION recalculate_language_frequency()
RETURNS VOID AS $$
DECLARE
    total_requests_all INT;
    threshold_percentage DECIMAL := 5.0; -- 5% threshold
BEGIN
    -- Get total requests
    SELECT COALESCE(SUM(total_requests), 0) INTO total_requests_all
    FROM language_stats;

    -- Update is_frequent based on threshold
    UPDATE language_stats
    SET is_frequent = (
        (total_requests::DECIMAL / NULLIF(total_requests_all, 0) * 100) >= threshold_percentage
        OR is_predefined = true
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE total_requests > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get non-frequent languages for cleanup
CREATE OR REPLACE FUNCTION get_non_frequent_languages()
RETURNS TABLE (
    language_code VARCHAR(10),
    language_name VARCHAR(100),
    total_requests INT,
    last_used TIMESTAMP,
    total_lessons INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ls.language_code,
        ls.language_name,
        ls.total_requests,
        ls.last_used,
        ls.total_lessons
    FROM language_stats ls
    WHERE ls.is_frequent = false
      AND ls.is_predefined = false
      AND ls.total_requests > 0
    ORDER BY ls.last_used ASC; -- Oldest first
END;
$$ LANGUAGE plpgsql;

-- Function to mark language content for cleanup
CREATE OR REPLACE FUNCTION mark_language_for_cleanup(
    p_language_code VARCHAR(10)
)
RETURNS VOID AS $$
BEGIN
    -- Update language stats to indicate cleanup needed
    UPDATE language_stats
    SET updated_at = CURRENT_TIMESTAMP
    WHERE language_code = p_language_code
      AND is_frequent = false
      AND is_predefined = false;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Views
-- ============================================

-- View for cleanup monitoring
CREATE OR REPLACE VIEW language_cleanup_candidates AS
SELECT 
    language_code,
    language_name,
    total_requests,
    total_lessons,
    last_used,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_used)) / 86400 as days_since_last_use,
    CASE 
        WHEN is_frequent = false AND is_predefined = false THEN true
        ELSE false
    END as should_cleanup
FROM language_stats
WHERE is_frequent = false
  AND is_predefined = false
ORDER BY last_used ASC;

-- ============================================
-- End of Unified Schema
-- ============================================

