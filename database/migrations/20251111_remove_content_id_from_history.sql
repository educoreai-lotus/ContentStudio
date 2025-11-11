ALTER TABLE public.content_history
DROP CONSTRAINT IF EXISTS fk_content_history_content_id;

ALTER TABLE public.content_history
DROP COLUMN IF EXISTS content_id;

