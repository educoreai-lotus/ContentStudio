-- ============================================
-- Migration: Add ID columns to lookup tables
-- ============================================
-- Adds SERIAL id columns to content_types and generation_methods
-- while keeping type_name/method_name as UNIQUE for backward compatibility
-- ============================================

-- Step 1: Add id columns to content_types
ALTER TABLE content_types 
ADD COLUMN type_id SERIAL;

-- Step 2: Add id columns to generation_methods
ALTER TABLE generation_methods 
ADD COLUMN method_id SERIAL;

-- Step 3: Make type_name and method_name UNIQUE (if not already)
ALTER TABLE content_types 
ADD CONSTRAINT unique_content_type_name UNIQUE (type_name);

ALTER TABLE generation_methods 
ADD CONSTRAINT unique_generation_method_name UNIQUE (method_name);

-- Step 4: Set type_id and method_id as PRIMARY KEY
-- First, drop existing primary key constraints
ALTER TABLE content_types 
DROP CONSTRAINT IF EXISTS content_types_pkey;

ALTER TABLE generation_methods 
DROP CONSTRAINT IF EXISTS generation_methods_pkey;

-- Add new primary keys
ALTER TABLE content_types 
ADD PRIMARY KEY (type_id);

ALTER TABLE generation_methods 
ADD PRIMARY KEY (method_id);

-- Step 5: Update foreign keys in content table (if they reference type_name/method_name)
-- Note: If foreign keys already reference type_name/method_name, they will continue to work
-- because type_name/method_name are still UNIQUE

-- Step 6: Add indexes on type_name and method_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_content_types_type_name ON content_types(type_name);
CREATE INDEX IF NOT EXISTS idx_generation_methods_method_name ON generation_methods(method_name);

-- ============================================
-- Migration Complete
-- ============================================
-- Now both tables have:
-- - SERIAL id as PRIMARY KEY
-- - type_name/method_name as UNIQUE (for foreign key references)
-- ============================================

