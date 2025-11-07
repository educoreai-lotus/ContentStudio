-- ============================================
-- Migration: Convert ENUMs to Lookup Tables
-- ============================================
-- This migration converts ContentType and GenerationMethod ENUMs
-- to use the existing lookup tables (content_types, generation_methods)
-- for better flexibility and dynamic management
-- ============================================

-- Step 1: Create new columns with VARCHAR type
ALTER TABLE content 
ADD COLUMN content_type_id_new VARCHAR(50),
ADD COLUMN generation_method_id_new VARCHAR(50);

ALTER TABLE content_history 
ADD COLUMN content_type_id_new VARCHAR(50),
ADD COLUMN generation_method_id_new VARCHAR(50);

-- Step 2: Copy data from ENUM columns to new VARCHAR columns
UPDATE content 
SET content_type_id_new = content_type_id::text,
    generation_method_id_new = generation_method_id::text;

UPDATE content_history 
SET content_type_id_new = content_type_id::text,
    generation_method_id_new = generation_method_id::text;

-- Step 3: Drop old ENUM columns
ALTER TABLE content 
DROP COLUMN content_type_id,
DROP COLUMN generation_method_id;

ALTER TABLE content_history 
DROP COLUMN content_type_id,
DROP COLUMN generation_method_id;

-- Step 4: Rename new columns to original names
ALTER TABLE content 
RENAME COLUMN content_type_id_new TO content_type_id;

ALTER TABLE content 
RENAME COLUMN generation_method_id_new TO generation_method_id;

ALTER TABLE content_history 
RENAME COLUMN content_type_id_new TO content_type_id;

ALTER TABLE content_history 
RENAME COLUMN generation_method_id_new TO generation_method_id;

-- Step 5: Add NOT NULL constraints
ALTER TABLE content 
ALTER COLUMN content_type_id SET NOT NULL,
ALTER COLUMN generation_method_id SET NOT NULL;

ALTER TABLE content_history 
ALTER COLUMN content_type_id SET NOT NULL,
ALTER COLUMN generation_method_id SET NOT NULL;

-- Step 6: Update lookup tables to use VARCHAR instead of ENUM
-- First, create new tables with VARCHAR
CREATE TABLE content_types_new (
    type_name VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT FALSE,
    is_optional BOOLEAN DEFAULT TRUE,
    sort_order INTEGER,
    requires_ai BOOLEAN DEFAULT FALSE,
    requires_external_api BOOLEAN DEFAULT FALSE,
    external_api_provider VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generation_methods_new (
    method_name VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    requires_video_input BOOLEAN DEFAULT FALSE,
    requires_ai BOOLEAN DEFAULT FALSE,
    requires_manual_input BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data
INSERT INTO content_types_new 
SELECT type_name::text, display_name, description, is_mandatory, is_optional, 
       sort_order, requires_ai, requires_external_api, external_api_provider, 
       created_at, updated_at
FROM content_types;

INSERT INTO generation_methods_new 
SELECT method_name::text, display_name, description, requires_video_input, 
       requires_ai, requires_manual_input, is_active, created_at, updated_at
FROM generation_methods;

-- Drop old tables
DROP TABLE content_types;
DROP TABLE generation_methods;

-- Rename new tables
ALTER TABLE content_types_new RENAME TO content_types;
ALTER TABLE generation_methods_new RENAME TO generation_methods;

-- Step 7: Add foreign key constraints
ALTER TABLE content 
ADD CONSTRAINT fk_content_content_type_id 
FOREIGN KEY (content_type_id) 
REFERENCES content_types(type_name) ON DELETE RESTRICT;

ALTER TABLE content 
ADD CONSTRAINT fk_content_generation_method_id 
FOREIGN KEY (generation_method_id) 
REFERENCES generation_methods(method_name) ON DELETE RESTRICT;

ALTER TABLE content_history 
ADD CONSTRAINT fk_content_history_content_type_id 
FOREIGN KEY (content_type_id) 
REFERENCES content_types(type_name) ON DELETE RESTRICT;

ALTER TABLE content_history 
ADD CONSTRAINT fk_content_history_generation_method_id 
FOREIGN KEY (generation_method_id) 
REFERENCES generation_methods(method_name) ON DELETE RESTRICT;

-- Step 8: Drop ENUM types (if no longer used)
-- Check if ENUMs are used elsewhere before dropping
-- DROP TYPE "ContentType";
-- DROP TYPE "GenerationMethod";

-- Step 9: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_content_content_type_id ON content(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_generation_method_id ON content(generation_method_id);
CREATE INDEX IF NOT EXISTS idx_content_types_is_mandatory ON content_types(is_mandatory);
CREATE INDEX IF NOT EXISTS idx_content_types_sort_order ON content_types(sort_order);
CREATE INDEX IF NOT EXISTS idx_generation_methods_is_active ON generation_methods(is_active);

-- ============================================
-- Migration Complete
-- ============================================
-- Now content_type_id and generation_method_id use VARCHAR
-- and reference the lookup tables via foreign keys
-- This allows dynamic addition of new types/methods without schema changes
-- ============================================

