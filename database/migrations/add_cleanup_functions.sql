-- ============================================
-- Cleanup Functions for Language Management
-- ============================================

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



