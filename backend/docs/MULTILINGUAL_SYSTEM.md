# Multilingual Content Management System

## Overview

Intelligent multilingual content management system that learns language preferences, caches popular languages in Supabase Storage, and generates rare languages on-the-fly using AI.

## Architecture

### Core Components

1. **LanguageStatsRepository** - Tracks language usage and popularity
2. **SupabaseStorageClient** - Manages persistent storage for frequent languages
3. **AITranslationService** - Translates content using OpenAI/Gemini
4. **GetLessonByLanguageUseCase** - Main orchestration logic
5. **LanguageStatsJob** - Background job for frequency recalculation

## Flow Diagram

```
Course Builder Request
    ↓
[preferred_language: "he"]
    ↓
Check Supabase Storage (he)
    ↓
Found? → Return cached content
    ↓
Not Found? → Check fallback languages (en, he, ar)
    ↓
Found? → Translate → Store if frequent → Return
    ↓
Not Found? → Full AI Generation → Return
    ↓
Update Language Stats
```

## Database Schema

### language_stats Table

```sql
CREATE TABLE language_stats (
    language_code VARCHAR(10) PRIMARY KEY,
    language_name VARCHAR(100) NOT NULL,
    total_requests INT DEFAULT 0,
    total_lessons INT DEFAULT 0,
    total_content_items INT DEFAULT 0,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_frequent BOOLEAN DEFAULT FALSE,
    is_predefined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Predefined Languages

- **English (en)** - `is_frequent: true`, `is_predefined: true`
- **Hebrew (he)** - `is_frequent: true`, `is_predefined: true`
- **Arabic (ar)** - `is_frequent: true`, `is_predefined: true`

## API Endpoints

### POST /api/content/multilingual/lesson

Get lesson content in preferred language.

**Request Body:**
```json
{
  "lesson_id": "123",
  "preferred_language": "he",
  "content_type": "text",
  "learner_id": "learner456",
  "course_metadata": {
    "course_id": "course789",
    "course_name": "JavaScript Basics"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lesson_id": "123",
    "language": "he",
    "content": {...},
    "source": "translation",
    "source_language": "en",
    "cached": false,
    "learner_id": "learner456",
    "generated_at": "2024-01-15T10:30:00Z"
  }
}
```

### GET /api/content/multilingual/stats

Get language statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "frequent_languages": ["en", "he", "ar"],
    "total_languages": 10,
    "popular_languages": [...]
  }
}
```

## Storage Strategy

### Frequent Languages (en, he, ar)
- ✅ Always stored in Supabase Storage
- ✅ Fast retrieval
- ✅ Pre-populated on system startup

### Rare Languages
- ⚠️ Generated on-the-fly
- ⚠️ Not stored initially
- ✅ Promoted to frequent if usage > 5% threshold
- ✅ Then stored in Supabase Storage

## Language Promotion/Demotion

### ⚠️ IMPORTANT: Periodic Evaluation (Not Real-Time)

- **Real-time Statistics**: Language usage statistics (`total_requests`, `last_used`) are updated **immediately** on each request.
- **Periodic Evaluation**: Language promotion/demotion happens **periodically** (every 2 weeks or monthly), NOT in real-time.
- This ensures:
  - Data-driven decisions based on collected statistics
  - Stable caching behavior
  - Protection against short-term fluctuations

### Automatic Promotion/Demotion
- Background job runs **every 2 weeks** (1st and 15th of month) or **monthly** (1st of month)
- Recalculates frequency based on collected usage statistics
- Languages with >5% of total requests → `is_frequent = true`
- Languages below threshold → `is_frequent = false` (unless predefined)
- Predefined languages (en, he, ar) always remain frequent

### Storage Behavior
- **Frequent languages**: Store in Supabase immediately
- **Rare languages**: Generate on-the-fly, don't store initially
- **Promoted languages**: Start storing after promotion (during next evaluation)
- **Demoted languages**: Content removed from Supabase during cleanup job

### Cleanup Process
- Runs **immediately after** each evaluation cycle
- Removes outdated content for non-frequent languages from Supabase Storage
- Keeps only recent/most-used content for non-frequent languages
- Optimizes storage space automatically

## Environment Variables

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# AI APIs
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Database
DATABASE_URL=postgresql://...
```

## Usage Examples

### Example 1: English Request (Cached)
```javascript
// Request
POST /api/content/multilingual/lesson
{
  "lesson_id": "123",
  "preferred_language": "en"
}

// Response: Fast retrieval from Supabase
{
  "source": "cache",
  "cached": true
}
```

### Example 2: Hebrew Request (Translation)
```javascript
// Request
POST /api/content/multilingual/lesson
{
  "lesson_id": "123",
  "preferred_language": "he"
}

// Response: Translated from English, stored in Supabase
{
  "source": "translation",
  "source_language": "en",
  "cached": false
}
```

### Example 3: Czech Request (On-the-fly Generation)
```javascript
// Request
POST /api/content/multilingual/lesson
{
  "lesson_id": "123",
  "preferred_language": "cs"
}

// Response: Full AI generation, not stored
{
  "source": "generation",
  "cached": false
}
```

## Integration with Course Builder

Course Builder sends requests with:
- `preferred_language` - Learner's preferred language
- `learner_id` - For tracking
- `course_metadata` - Context for generation

Content Studio responds with:
- Content in preferred language
- Source information (cache/translation/generation)
- Metadata for analytics

## Monitoring

- Track language requests in `language_stats` (real-time updates)
- Monitor translation costs
- Track storage usage in Supabase
- Alert on high generation rates (may indicate missing cache)
- Monitor evaluation cycle execution (every 2 weeks/month)
- Track cleanup job results

## Scheduled Jobs

### Language Evaluation Cycle

**Schedule:** Every 2 weeks (bi-weekly) or monthly

**Process:**
1. **LanguageStatsJob** - Evaluates collected statistics and promotes/demotes languages
2. **LanguageCleanupJob** - Cleans up Supabase Storage for demoted languages

**Execution:**
```javascript
// Every 2 weeks: 1st and 15th of month at 2 AM
cron.schedule('0 2 1,15 * *', async () => {
  await orchestrator.execute();
});

// OR Monthly: 1st of each month at 2 AM
cron.schedule('0 2 1 * *', async () => {
  await orchestrator.execute();
});
```

### Real-Time vs Periodic

| Operation | Frequency | Description |
|-----------|-----------|-------------|
| Statistics Update | Real-time | `total_requests++`, `last_used = NOW()` |
| Frequency Evaluation | Periodic | Recalculate `is_frequent` based on collected stats |
| Promotion/Demotion | Periodic | Change language status during evaluation |
| Storage Cleanup | Periodic | Remove content after demotion |

## Future Enhancements

1. **Batch Translation** - Translate multiple lessons at once
2. **Translation Cache** - Cache translations even for rare languages
3. **Quality Metrics** - Track translation quality scores
4. **Regional Variants** - Support en-US, en-GB, etc.
5. **Auto-Detection** - Detect content language automatically

