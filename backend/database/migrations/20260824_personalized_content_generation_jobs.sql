-- ============================================
-- Personalized Content Generation Jobs
-- Additive durable child-job table for Course Builder async generation.
-- Does not alter existing tables.
-- Last Updated: 2026-08-24
-- ============================================

CREATE TABLE IF NOT EXISTS personalized_content_generation_jobs (
    job_id SERIAL PRIMARY KEY,
    parent_course_builder_job_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    request_payload JSONB NOT NULL,
    result_payload JSONB,
    error TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    locked_at TIMESTAMP,
    lease_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT personalized_content_generation_jobs_status_check
      CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT personalized_content_generation_jobs_parent_key
      UNIQUE (parent_course_builder_job_id)
);

COMMENT ON TABLE personalized_content_generation_jobs IS
  'Durable Content Studio child jobs for personalized course-builder-service generation';

CREATE INDEX IF NOT EXISTS idx_pcg_jobs_status
  ON personalized_content_generation_jobs (status);

CREATE INDEX IF NOT EXISTS idx_pcg_jobs_created_at
  ON personalized_content_generation_jobs (created_at);

CREATE INDEX IF NOT EXISTS idx_pcg_jobs_lease
  ON personalized_content_generation_jobs (status, lease_expires_at);
