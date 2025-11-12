-- Migration: Remove version_number from content_history and add updated_at
-- This simplifies version tracking by using timestamps only (LIFO strategy)

-- Add updated_at column if it doesn't exist
ALTER TABLE public.content_history
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to set updated_at = created_at if updated_at is NULL
UPDATE public.content_history
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Drop version_number column
ALTER TABLE public.content_history
DROP COLUMN IF EXISTS version_number;

-- Add index on updated_at for better query performance
CREATE INDEX IF NOT EXISTS idx_content_history_updated_at 
ON public.content_history(topic_id, content_type_id, updated_at DESC);

