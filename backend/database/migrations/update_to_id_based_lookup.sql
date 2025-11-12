-- ============================================
-- Migration: Update lookup tables to use ID-based foreign keys
-- This migration updates content_type_id and generation_method_id
-- from VARCHAR (referencing type_name/method_name) to INTEGER (referencing type_id/method_id)
-- ============================================

-- Step 1: Add temporary columns for the new ID-based references
ALTER TABLE content ADD COLUMN content_type_id_new INTEGER;
ALTER TABLE content ADD COLUMN generation_method_id_new INTEGER;
ALTER TABLE content_history ADD COLUMN content_type_id_new INTEGER;
ALTER TABLE content_history ADD COLUMN generation_method_id_new INTEGER;
ALTER TABLE topics ADD COLUMN generation_methods_id_new INTEGER;

-- Step 2: Populate the new columns with the corresponding IDs
UPDATE content c
SET content_type_id_new = (
    SELECT type_id FROM content_types WHERE type_name = c.content_type_id
);

UPDATE content c
SET generation_method_id_new = (
    SELECT method_id FROM generation_methods WHERE method_name = c.generation_method_id
);

UPDATE content_history ch
SET content_type_id_new = (
    SELECT type_id FROM content_types WHERE type_name = ch.content_type_id
);

UPDATE content_history ch
SET generation_method_id_new = (
    SELECT method_id FROM generation_methods WHERE method_name = ch.generation_method_id
);

UPDATE topics t
SET generation_methods_id_new = (
    SELECT method_id FROM generation_methods WHERE method_name = t.generation_methods_id
)
WHERE t.generation_methods_id IS NOT NULL;

-- Step 3: Drop old foreign key constraints
ALTER TABLE content DROP CONSTRAINT IF EXISTS fk_content_content_type_id;
ALTER TABLE content DROP CONSTRAINT IF EXISTS fk_content_generation_method_id;
ALTER TABLE content_history DROP CONSTRAINT IF EXISTS fk_content_history_content_type_id;
ALTER TABLE content_history DROP CONSTRAINT IF EXISTS fk_content_history_generation_method_id;
ALTER TABLE topics DROP CONSTRAINT IF EXISTS fk_topics_generation_methods_id;

-- Step 4: Drop old columns
ALTER TABLE content DROP COLUMN content_type_id;
ALTER TABLE content DROP COLUMN generation_method_id;
ALTER TABLE content_history DROP COLUMN content_type_id;
ALTER TABLE content_history DROP COLUMN generation_method_id;
ALTER TABLE topics DROP COLUMN generation_methods_id;

-- Step 5: Rename new columns to original names
ALTER TABLE content RENAME COLUMN content_type_id_new TO content_type_id;
ALTER TABLE content RENAME COLUMN generation_method_id_new TO generation_method_id;
ALTER TABLE content_history RENAME COLUMN content_type_id_new TO content_type_id;
ALTER TABLE content_history RENAME COLUMN generation_method_id_new TO generation_method_id;
ALTER TABLE topics RENAME COLUMN generation_methods_id_new TO generation_methods_id;

-- Step 6: Change column types to INTEGER
ALTER TABLE content ALTER COLUMN content_type_id TYPE INTEGER USING content_type_id::INTEGER;
ALTER TABLE content ALTER COLUMN generation_method_id TYPE INTEGER USING generation_method_id::INTEGER;
ALTER TABLE content_history ALTER COLUMN content_type_id TYPE INTEGER USING content_type_id::INTEGER;
ALTER TABLE content_history ALTER COLUMN generation_method_id TYPE INTEGER USING generation_method_id::INTEGER;
ALTER TABLE topics ALTER COLUMN generation_methods_id TYPE INTEGER USING generation_methods_id::INTEGER;

-- Step 7: Add NOT NULL constraints where needed
ALTER TABLE content ALTER COLUMN content_type_id SET NOT NULL;
ALTER TABLE content ALTER COLUMN generation_method_id SET NOT NULL;
ALTER TABLE content_history ALTER COLUMN content_type_id SET NOT NULL;
ALTER TABLE content_history ALTER COLUMN generation_method_id SET NOT NULL;

-- Step 8: Recreate foreign key constraints with ID references
ALTER TABLE content
    ADD CONSTRAINT fk_content_content_type_id 
    FOREIGN KEY (content_type_id) 
    REFERENCES content_types(type_id) ON DELETE RESTRICT;

ALTER TABLE content
    ADD CONSTRAINT fk_content_generation_method_id 
    FOREIGN KEY (generation_method_id) 
    REFERENCES generation_methods(method_id) ON DELETE RESTRICT;

ALTER TABLE content_history
    ADD CONSTRAINT fk_content_history_content_type_id 
    FOREIGN KEY (content_type_id) 
    REFERENCES content_types(type_id) ON DELETE RESTRICT;

ALTER TABLE content_history
    ADD CONSTRAINT fk_content_history_generation_method_id 
    FOREIGN KEY (generation_method_id) 
    REFERENCES generation_methods(method_id) ON DELETE RESTRICT;

ALTER TABLE topics
    ADD CONSTRAINT fk_topics_generation_methods_id 
    FOREIGN KEY (generation_methods_id) 
    REFERENCES generation_methods(method_id) ON DELETE SET NULL;

-- Step 9: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_content_content_type_id ON content(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_generation_method_id ON content(generation_method_id);
CREATE INDEX IF NOT EXISTS idx_content_history_content_type_id ON content_history(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_history_generation_method_id ON content_history(generation_method_id);
CREATE INDEX IF NOT EXISTS idx_topics_generation_methods_id ON topics(generation_methods_id);

-- Migration complete
COMMENT ON COLUMN content.content_type_id IS 'References content_types.type_id (INTEGER)';
COMMENT ON COLUMN content.generation_method_id IS 'References generation_methods.method_id (INTEGER)';
COMMENT ON COLUMN content_history.content_type_id IS 'References content_types.type_id (INTEGER)';
COMMENT ON COLUMN content_history.generation_method_id IS 'References generation_methods.method_id (INTEGER)';
COMMENT ON COLUMN topics.generation_methods_id IS 'References generation_methods.method_id (INTEGER)';

