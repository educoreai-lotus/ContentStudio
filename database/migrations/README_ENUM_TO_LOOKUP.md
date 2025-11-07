# ENUM to Lookup Tables Migration

## Problem

The original migration used ENUMs for `ContentType` and `GenerationMethod`, but also created lookup tables (`content_types` and `generation_methods`). This created redundancy and prevented dynamic addition of new types/methods.

## Solution

Converted from ENUMs to using lookup tables with VARCHAR foreign keys. This allows:
- ✅ Dynamic addition of new content types
- ✅ Dynamic addition of new generation methods
- ✅ Better metadata management in lookup tables
- ✅ No schema changes needed for new types/methods

## Changes Made

### 1. Updated `migration.sql`
- ✅ Removed ENUM type definitions
- ✅ Changed `content.content_type_id` from `"ContentType"` to `VARCHAR(50)`
- ✅ Changed `content.generation_method_id` from `"GenerationMethod"` to `VARCHAR(50)`
- ✅ Changed `content_history` columns similarly
- ✅ Added FOREIGN KEY constraints to lookup tables
- ✅ Moved lookup tables creation before `content` table (for FK dependencies)

### 2. Created `fix_enum_to_lookup_tables.sql`
- Migration script to convert existing databases from ENUMs to lookup tables
- Safe migration with data preservation
- Adds foreign key constraints

## Migration Steps

### For New Databases
Just run the updated `migration.sql` - it's already fixed.

### For Existing Databases
Run the fix migration:
```sql
\i database/migrations/fix_enum_to_lookup_tables.sql
```

## Benefits

1. **Flexibility**: Add new content types/methods without schema changes
2. **Metadata**: Rich metadata in lookup tables (display_name, description, etc.)
3. **Consistency**: Single source of truth in lookup tables
4. **Maintainability**: Easier to manage and update types/methods

## Lookup Tables Structure

### `content_types`
- `type_name` (VARCHAR, PK) - e.g., 'text', 'code', 'presentation'
- `display_name` - Human-readable name
- `is_mandatory` - Whether required in templates
- `requires_ai` - Whether needs AI generation
- `external_api_provider` - Which external API (if any)

### `generation_methods`
- `method_name` (VARCHAR, PK) - e.g., 'manual', 'ai_assisted', 'video_to_lesson'
- `display_name` - Human-readable name
- `requires_video_input` - Whether needs video
- `requires_ai` - Whether needs AI
- `is_active` - Whether currently available

## Usage in Code

The code already uses VARCHAR strings for these fields, so no code changes needed. The foreign key constraints ensure data integrity.

## Example: Adding New Content Type

```sql
-- Add new content type dynamically
INSERT INTO content_types (type_name, display_name, is_mandatory, requires_ai, sort_order) 
VALUES ('interactive_quiz', 'Interactive Quiz', FALSE, TRUE, 7);

-- Now can use it immediately in content table
INSERT INTO content (topic_id, content_type_id, content_data, generation_method_id)
VALUES (1, 'interactive_quiz', '{"questions": [...]}', 'ai_assisted');
```

No schema migration needed! 🎉

