-- ============================================
-- Language Statistics Table
-- Tracks language usage and popularity
-- ============================================

CREATE TABLE IF NOT EXISTS language_stats (
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

-- Indexes
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



