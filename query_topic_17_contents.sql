-- Query to check all contents for topic_id = 17
-- Run this in Supabase SQL Editor

SELECT 
    t.topic_id,
    t.topic_name,
    t.status AS topic_status,
    t.language AS topic_language,
    t.skills AS topic_skills,
    t.created_at AS topic_created_at,
    c.content_id,
    ct.type_name AS content_type,
    ct.display_name AS content_type_display_name,
    c.content_type_id,
    c.generation_method_id,
    c.created_at AS content_created_at,
    -- Show a preview of content_data (first 100 chars)
    LEFT(c.content_data::text, 100) AS content_data_preview
FROM topics t
LEFT JOIN content c ON t.topic_id = c.topic_id
LEFT JOIN content_types ct ON c.content_type_id = ct.type_id
WHERE t.topic_id = 17
ORDER BY c.content_id;

-- Alternative: Count contents by type
SELECT 
    ct.type_name AS content_type,
    COUNT(c.content_id) AS count
FROM topics t
LEFT JOIN content c ON t.topic_id = c.topic_id
LEFT JOIN content_types ct ON c.content_type_id = ct.type_id
WHERE t.topic_id = 17
GROUP BY ct.type_name
ORDER BY count DESC;

-- Check what content types should exist (all 6 formats)
SELECT 
    type_id,
    type_name,
    display_name
FROM content_types
ORDER BY type_id;






