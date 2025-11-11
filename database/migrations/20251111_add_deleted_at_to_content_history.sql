ALTER TABLE public.content_history
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
