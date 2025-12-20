-- ============================================
-- Add Default System Templates
-- Creates 6 default templates with all 6 formats
-- Note: Uses text_audio (combined) instead of text and audio separately
-- ============================================

-- Insert default system templates only if they don't exist
-- This ensures idempotency (can run multiple times safely)

-- Template 1: Foundational Learning Flow
-- 6 formats: text_audio, audio, presentation, code, mind_map, avatar_video
INSERT INTO templates (template_name, template_type, created_by, format_order, created_at)
SELECT 
    'Foundational Learning Flow',
    'ready_template',
    'system',
    '["text_audio", "audio", "presentation", "code", "mind_map", "avatar_video"]'::jsonb,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM templates WHERE template_name = 'Foundational Learning Flow' AND created_by = 'system'
);

-- Template 2: Hands-On Coding Sprint
-- 6 formats: text_audio, audio, code, presentation, mind_map, avatar_video
INSERT INTO templates (template_name, template_type, created_by, format_order, created_at)
SELECT 
    'Hands-On Coding Sprint',
    'ready_template',
    'system',
    '["text_audio", "audio", "code", "presentation", "mind_map", "avatar_video"]'::jsonb,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM templates WHERE template_name = 'Hands-On Coding Sprint' AND created_by = 'system'
);

-- Template 3: Visual Storytelling Journey
-- 6 formats: text_audio, audio, mind_map, presentation, code, avatar_video
INSERT INTO templates (template_name, template_type, created_by, format_order, created_at)
SELECT 
    'Visual Storytelling Journey',
    'ready_template',
    'system',
    '["text_audio", "audio", "mind_map", "presentation", "code", "avatar_video"]'::jsonb,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM templates WHERE template_name = 'Visual Storytelling Journey' AND created_by = 'system'
);

-- Template 4: Workshop Collaboration Loop
-- 6 formats: text_audio, audio, presentation, mind_map, code, avatar_video
INSERT INTO templates (template_name, template_type, created_by, format_order, created_at)
SELECT 
    'Workshop Collaboration Loop',
    'ready_template',
    'system',
    '["text_audio", "audio", "presentation", "mind_map", "code", "avatar_video"]'::jsonb,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM templates WHERE template_name = 'Workshop Collaboration Loop' AND created_by = 'system'
);

-- Template 5: Assessment Ready Sequence
-- 6 formats: text_audio, audio, code, mind_map, presentation, avatar_video
INSERT INTO templates (template_name, template_type, created_by, format_order, created_at)
SELECT 
    'Assessment Ready Sequence',
    'ready_template',
    'system',
    '["text_audio", "audio", "code", "mind_map", "presentation", "avatar_video"]'::jsonb,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM templates WHERE template_name = 'Assessment Ready Sequence' AND created_by = 'system'
);

-- Template 6: Immersive Video Kickoff
-- 6 formats: text_audio, audio, avatar_video, presentation, code, mind_map
INSERT INTO templates (template_name, template_type, created_by, format_order, created_at)
SELECT 
    'Immersive Video Kickoff',
    'ready_template',
    'system',
    '["text_audio", "audio", "avatar_video", "presentation", "code", "mind_map"]'::jsonb,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM templates WHERE template_name = 'Immersive Video Kickoff' AND created_by = 'system'
);

