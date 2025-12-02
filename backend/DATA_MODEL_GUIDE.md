# מדריך Data Model - Content Studio

## 📋 תוכן עניינים
1. [סקירה כללית](#סקירה-כללית)
2. [טבלאות עיקריות](#טבלאות-עיקריות)
3. [טבלאות Lookup](#טבלאות-lookup)
4. [יחסים בין טבלאות](#יחסים-בין-טבלאות)
5. [Entities](#entities)
6. [דיאגרמת ER](#דיאגרמת-er)

---

## 🎯 סקירה כללית

**מבנה הנתונים:**
- **8 טבלאות עיקריות** - Course, Topic, Content, Template, Exercise, Content History, Language Stats, Migration Log
- **2 טבלאות Lookup** - Content Types, Generation Methods
- **JSONB Fields** - שמירת נתונים גמישים (content_data, format_order, skills)
- **Soft Delete** - מחיקה רכה עם status field
- **Versioning** - היסטוריה מלאה של תוכן

---

## 📊 טבלאות עיקריות

### 1. `trainer_courses` - קורסים

**תיאור:** מאחסן קורסים שנוצרו על ידי מאמנים

**שדות:**
```sql
course_id          SERIAL PRIMARY KEY
course_name        VARCHAR(255) NOT NULL
trainer_id         VARCHAR(50) NOT NULL
description        TEXT
skills             TEXT[]                    -- מערך של כישורים
language           VARCHAR(10) DEFAULT 'en'
status             content_status DEFAULT 'active'  -- 'active', 'archived', 'deleted'
company_logo       VARCHAR(500)
permissions        TEXT                      -- ארגונים מורשים מ-Directory
usage_count        INTEGER DEFAULT 0         -- כמה פעמים נשלף
created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Indexes:**
- `idx_trainer_courses_trainer_id` - חיפוש לפי מאמן
- `idx_trainer_courses_status` - סינון לפי status
- `idx_trainer_courses_created_at` - מיון לפי תאריך
- `idx_trainer_courses_skills` - GIN index למערך skills

**Entity:** `Course.js`

---

### 2. `topics` - שיעורים/נושאים

**תיאור:** שיעורים שיכולים להיות חלק מקורס או standalone

**שדות:**
```sql
topic_id              SERIAL PRIMARY KEY
course_id             INTEGER                    -- NULL = standalone topic
topic_name            VARCHAR(255) NOT NULL
description           TEXT
trainer_id            VARCHAR(50) NOT NULL
language              VARCHAR(10) DEFAULT 'en'   -- חובה אם standalone
status                content_status DEFAULT 'active'
skills                TEXT[]                     -- מערך של כישורים
template_id           INTEGER                    -- FK ל-templates
generation_methods_id INTEGER                    -- FK ל-generation_methods
usage_count           INTEGER DEFAULT 0         -- כמה פעמים נשלף
created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Foreign Keys:**
- `fk_topics_course_id` → `trainer_courses(course_id)` ON DELETE SET NULL
- `fk_topics_template_id` → `templates(template_id)` ON DELETE SET NULL
- `fk_topics_generation_methods_id` → `generation_methods(method_id)` ON DELETE SET NULL

**Indexes:**
- `idx_topics_course_id` - חיפוש לפי קורס
- `idx_topics_trainer_id` - חיפוש לפי מאמן
- `idx_topics_status` - סינון לפי status
- `idx_topics_skills` - GIN index למערך skills

**Entity:** `Topic.js`

**הערות:**
- `course_id = NULL` → standalone topic (חייב language)
- `course_id != NULL` → topic בקורס (language נלקח מהקורס)
- Format flags (`has_text`, `has_code`, וכו') לא נשמרים ב-DB - מחושבים דינמית מה-content

---

### 3. `templates` - תבניות

**תיאור:** תבניות מבניות (format order) לתבניות AI prompts

**שדות:**
```sql
template_id    SERIAL PRIMARY KEY
template_name  VARCHAR(255) NOT NULL
template_type  TemplateType NOT NULL          -- 'ready_template', 'ai_generated', 'manual', 'mixed_ai_manual'
created_by     VARCHAR(50) NOT NULL
created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
format_order   JSONB                          -- מערך של סוגי תוכן: ['text', 'code', 'presentation', 'audio', 'mind_map']
```

**Indexes:**
- `idx_templates_template_type` - סינון לפי סוג תבנית
- `idx_templates_created_by` - חיפוש לפי יוצר
- `idx_templates_format_order` - GIN index ל-JSONB

**Entity:** `Template.js`

**הערות:**
- `format_order` חייב לכלול את כל 5 הפורמטים החובה
- Audio חייב להיות לפני או מיד אחרי Text

---

### 4. `content` - תוכן

**תיאור:** כל פריט תוכן (text, code, presentation, audio, mind_map, avatar_video)

**שדות:**
```sql
content_id            SERIAL PRIMARY KEY
topic_id              INTEGER NOT NULL
content_type_id       INTEGER NOT NULL         -- FK ל-content_types
content_data          JSONB                    -- נתוני התוכן (מבנה שונה לפי סוג)
generation_method_id  INTEGER NOT NULL         -- FK ל-generation_methods
quality_check_data    JSONB                   -- תוצאות בדיקת איכות
quality_check_status  VARCHAR(20)             -- 'pending', 'approved', 'rejected', 'needs_revision'
quality_checked_at    TIMESTAMP
created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Foreign Keys:**
- `fk_content_topic_id` → `topics(topic_id)` ON DELETE RESTRICT
- `fk_content_content_type_id` → `content_types(type_id)` ON DELETE RESTRICT
- `fk_content_generation_method_id` → `generation_methods(method_id)` ON DELETE RESTRICT

**Indexes:**
- `idx_content_topic_id` - חיפוש לפי topic
- `idx_content_content_type_id` - סינון לפי סוג תוכן
- `idx_content_generation_method_id` - סינון לפי שיטת יצירה
- `idx_content_content_data` - GIN index ל-JSONB
- `idx_content_quality_check_status` - סינון לפי סטטוס איכות
- `idx_content_quality_check_data` - GIN index ל-JSONB

**Entity:** `Content.js`

**content_data מבנה לפי סוג:**

**Text (type 1):**
```json
{
  "text": "הטקסט המלא...",
  "audioUrl": "https://...",
  "audioFormat": "mp3",
  "audioDuration": 120,
  "audioVoice": "alloy",
  "sha256Hash": "...",
  "digitalSignature": "..."
}
```

**Code (type 2):**
```json
{
  "code": "function example() {...}",
  "language": "javascript",
  "explanation": "הסבר..."
}
```

**Presentation (type 3):**
```json
{
  "format": "gamma",
  "presentationUrl": "https://supabase...",
  "storagePath": "presentations/...",
  "metadata": {
    "source": "prompt",
    "audience": "general",
    "language": "en"
  }
}
```

**Audio (type 4):**
```json
{
  "audioUrl": "https://supabase...",
  "audioFormat": "mp3",
  "audioDuration": 120,
  "audioVoice": "alloy"
}
```

**Mind Map (type 5):**
```json
{
  "nodes": [...],
  "edges": [...],
  "metadata": {
    "topic_title": "...",
    "skills": [...],
    "language": "en"
  }
}
```

**Avatar Video (type 6):**
```json
{
  "script": "הטקסט...",
  "videoUrl": "https://supabase...",
  "videoId": "heygen_id",
  "metadata": {
    "avatar_id": "...",
    "voice_id": "...",
    "language": "en"
  }
}
```

---

### 5. `content_history` - היסטוריית תוכן

**תיאור:** כל הגרסאות הקודמות של תוכן (לשחזור, audit, analytics)

**שדות:**
```sql
history_id          SERIAL PRIMARY KEY
content_id          INTEGER NOT NULL          -- FK ל-content
topic_id            INTEGER NOT NULL          -- FK ל-topics
content_type_id     INTEGER NOT NULL          -- FK ל-content_types
version_number      INTEGER NOT NULL          -- מספר גרסה (deprecated - משתמשים ב-timestamps)
content_data        JSONB NOT NULL            -- נתוני הגרסה
generation_method_id INTEGER NOT NULL          -- FK ל-generation_methods
created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
deleted_at          TIMESTAMP                 -- soft delete
```

**Foreign Keys:**
- `fk_content_history_content_id` → `content(content_id)` ON DELETE RESTRICT
- `fk_content_history_topic_id` → `topics(topic_id)` ON DELETE RESTRICT
- `fk_content_history_content_type_id` → `content_types(type_id)` ON DELETE RESTRICT
- `fk_content_history_generation_method_id` → `generation_methods(method_id)` ON DELETE RESTRICT

**Indexes:**
- `idx_content_history_content_id` - חיפוש לפי content
- `idx_content_history_topic_id` - חיפוש לפי topic
- `idx_content_history_version_number` - מיון לפי גרסה
- `idx_content_history_content_data` - GIN index ל-JSONB
- `idx_content_history_created_at` - מיון לפי תאריך

**Entity:** `ContentVersion.js`

**הערות:**
- כל שינוי בתוכן יוצר רשומה חדשה ב-history
- `version_number` deprecated - משתמשים ב-`created_at` למיון
- `deleted_at` לניהול soft delete

---

### 6. `exercises` - תרגילים

**תיאור:** תרגילי DevLab/Dabla לשיעורים

**שדות:**
```sql
exercise_id         SERIAL PRIMARY KEY
topic_id            INTEGER NOT NULL
question_text       TEXT NOT NULL
question_type       VARCHAR(50) NOT NULL      -- 'code' או 'theoretical'
programming_language VARCHAR(50)
language            VARCHAR(10) DEFAULT 'en'
skills              TEXT[]                    -- מערך של כישורים
hint                TEXT
solution            TEXT
test_cases          JSONB                    -- מקרי בדיקה
difficulty          VARCHAR(20)
points              INTEGER DEFAULT 10
order_index         INTEGER DEFAULT 0        -- סדר בתוך topic
generation_mode     VARCHAR(20) NOT NULL     -- 'ai' או 'manual'
validation_status   VARCHAR(20) DEFAULT 'pending'  -- 'pending', 'approved', 'rejected'
validation_message  TEXT
devlab_response     JSONB                    -- תשובה מלאה מ-DevLab
created_by          VARCHAR(50) NOT NULL
created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
status              VARCHAR(20) DEFAULT 'active'  -- 'active', 'archived', 'deleted'
```

**Foreign Keys:**
- `fk_exercises_topic_id` → `topics(topic_id)` ON DELETE CASCADE

**Indexes:**
- `idx_exercises_topic_id` - חיפוש לפי topic
- `idx_exercises_question_type` - סינון לפי סוג שאלה
- `idx_exercises_generation_mode` - סינון לפי שיטת יצירה
- `idx_exercises_validation_status` - סינון לפי סטטוס ולידציה
- `idx_exercises_status` - סינון לפי status
- `idx_exercises_skills` - GIN index למערך skills
- `idx_exercises_created_by` - חיפוש לפי יוצר
- `idx_exercises_order_index` - מיון לפי סדר

**Entity:** `Exercise.js`

---

### 7. `language_stats` - סטטיסטיקות שפות

**תיאור:** מעקב אחר שימוש בשפות (למיטוב, cleanup)

**שדות:**
```sql
language_code    VARCHAR(10) PRIMARY KEY
language_name    VARCHAR(100) NOT NULL
total_requests   INT DEFAULT 0
total_lessons    INT DEFAULT 0
last_used        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
is_frequent      BOOLEAN DEFAULT FALSE        -- שפה תדירה (>= 5%)
is_predefined    BOOLEAN DEFAULT FALSE        -- שפה מוגדרת מראש (en, he, ar)
created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Indexes:**
- `idx_language_stats_is_frequent` - סינון לפי תדירות
- `idx_language_stats_total_requests` - מיון לפי שימוש
- `idx_language_stats_last_used` - מיון לפי שימוש אחרון

**Functions:**
- `update_language_stats()` - עדכון סטטיסטיקות
- `recalculate_language_frequency()` - חישוב תדירות
- `get_non_frequent_languages()` - שפות לא תדירות
- `mark_language_for_cleanup()` - סימון לניקוי

**Views:**
- `language_cleanup_candidates` - שפות מועמדות לניקוי

---

### 8. `migration_log` - לוג migrations

**תיאור:** מעקב אחר migrations שבוצעו

**שדות:**
```sql
migration_id    SERIAL PRIMARY KEY
migration_name  VARCHAR(255) NOT NULL UNIQUE
executed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

---

## 🔍 טבלאות Lookup

### 1. `content_types` - סוגי תוכן

**תיאור:** Lookup table לסוגי תוכן

**שדות:**
```sql
type_id       SERIAL PRIMARY KEY
type_name     VARCHAR(50) NOT NULL UNIQUE
display_name  VARCHAR(100) NOT NULL
```

**ערכים:**
- `1` - `text` - Text Content
- `2` - `code` - Code Example
- `3` - `presentation` - Presentation
- `4` - `audio` - Audio Narration
- `5` - `mind_map` - Mind Map
- `6` - `avatar_video` - Avatar Video

---

### 2. `generation_methods` - שיטות יצירה

**תיאור:** Lookup table לשיטות יצירת תוכן

**שדות:**
```sql
method_id     SERIAL PRIMARY KEY
method_name   VARCHAR(50) NOT NULL UNIQUE
display_name  VARCHAR(100) NOT NULL
usage_count   INTEGER DEFAULT 0              -- כמה פעמים שימש
```

**ערכים:**
- `1` - `manual` - Manual Creation
- `2` - `ai_assisted` - AI-Assisted
- `3` - `manual_edited` - AI-Generated & Manually Edited
- `4` - `video_to_lesson` - Video to Lesson

---

## 🔗 יחסים בין טבלאות

### דיאגרמת יחסים:

```
trainer_courses (1) ──< (0..N) topics
                        │
                        ├──< (0..N) content
                        │       │
                        │       └──< (0..N) content_history
                        │
                        └──< (0..N) exercises

templates (1) ──< (0..N) topics

content_types (1) ──< (0..N) content
                      │
                      └──< (0..N) content_history

generation_methods (1) ──< (0..N) content
                          │
                          └──< (0..N) content_history
```

### פירוט יחסים:

1. **Course → Topics** (1:N)
   - קורס יכול להכיל מספר שיעורים
   - `topics.course_id` → `trainer_courses.course_id`
   - ON DELETE SET NULL (אם קורס נמחק, topics הופכים standalone)

2. **Topic → Content** (1:N)
   - שיעור יכול להכיל מספר פריטי תוכן
   - `content.topic_id` → `topics.topic_id`
   - ON DELETE RESTRICT (לא ניתן למחוק topic עם content)

3. **Content → Content History** (1:N)
   - כל תוכן יכול להכיל מספר גרסאות
   - `content_history.content_id` → `content.content_id`
   - ON DELETE RESTRICT

4. **Topic → Exercises** (1:N)
   - שיעור יכול להכיל מספר תרגילים
   - `exercises.topic_id` → `topics.topic_id`
   - ON DELETE CASCADE (אם topic נמחק, תרגילים נמחקים)

5. **Template → Topics** (1:N)
   - תבנית יכולה להיות משויכת למספר שיעורים
   - `topics.template_id` → `templates.template_id`
   - ON DELETE SET NULL

6. **Content Type → Content** (1:N)
   - סוג תוכן יכול להיות משויך למספר פריטי תוכן
   - `content.content_type_id` → `content_types.type_id`
   - ON DELETE RESTRICT

7. **Generation Method → Content** (1:N)
   - שיטת יצירה יכולה להיות משויכת למספר פריטי תוכן
   - `content.generation_method_id` → `generation_methods.method_id`
   - ON DELETE RESTRICT

---

## 🏗️ Entities

### 1. Course Entity
**קובץ:** `backend/src/domain/entities/Course.js`

**שדות:**
- `course_id`, `course_name`, `description`, `trainer_id`
- `skills` (Array), `language`, `status`
- `company_logo`, `permissions`, `usage_count`
- `created_at`, `updated_at`

**מתודות:**
- `validate()` - ולידציה
- `softDelete()`, `archive()`, `activate()` - ניהול status
- `incrementUsageCount()` - עדכון counter

---

### 2. Topic Entity
**קובץ:** `backend/src/domain/entities/Topic.js`

**שדות:**
- `topic_id`, `topic_name`, `description`, `trainer_id`
- `course_id` (nullable), `template_id`, `skills` (Array)
- `language`, `status`, `usage_count`
- `has_text`, `has_code`, `has_presentation`, `has_audio`, `has_mind_map` (calculated)
- `total_content_formats` (calculated)
- `is_standalone` (calculated: `course_id === null`)
- `created_at`, `updated_at`

**מתודות:**
- `validate()` - ולידציה (language חובה אם standalone)
- `hasAllRequiredFormats()` - בדיקה אם כל הפורמטים קיימים
- `getMissingFormats()` - רשימת פורמטים חסרים
- `updateFormatFlags()` - עדכון flags לפי content
- `incrementUsageCount()` - עדכון counter

---

### 3. Content Entity
**קובץ:** `backend/src/domain/entities/Content.js`

**שדות:**
- `content_id`, `topic_id`, `content_type_id`
- `content_data` (Object/JSONB)
- `generation_method_id`
- `quality_check_data`, `quality_check_status`, `quality_checked_at`
- `created_at`, `updated_at`

**מתודות:**
- `validate()` - ולידציה
- `updateQualityCheck()` - עדכון תוצאות איכות
- `needsQualityCheck()` - בדיקה אם צריך quality check (רק manual)
- `softDelete()` - מחיקה רכה

---

### 4. Template Entity
**קובץ:** `backend/src/domain/entities/Template.js`

**שדות:**
- `template_id`, `template_name`, `template_type`
- `format_order` (Array)
- `created_by`, `created_at`

**מתודות:**
- `validate()` - ולידציה (כל הפורמטים חובה, Audio+Text)
- `updateFormatOrder()` - עדכון סדר
- `getNextFormat()` - הפורמט הבא ליצירה
- `isComplete()` - בדיקה אם תבנית מלאה
- `getMissingFormats()` - רשימת פורמטים חסרים

---

### 5. Exercise Entity
**קובץ:** `backend/src/domain/entities/Exercise.js`

**שדות:**
- `exercise_id`, `topic_id`, `question_text`, `question_type`
- `programming_language`, `language`, `skills` (Array)
- `hint`, `solution`, `test_cases` (JSONB)
- `difficulty`, `points`, `order_index`
- `generation_mode`, `validation_status`, `validation_message`
- `devlab_response` (JSONB)
- `created_by`, `created_at`, `updated_at`, `status`

**מתודות:**
- `approve()` - אישור תרגיל
- `reject()` - דחיית תרגיל

---

### 6. ContentVersion Entity
**קובץ:** `backend/src/domain/entities/ContentVersion.js`

**שדות:**
- `version_id`, `content_id`, `topic_id`, `content_type_id`
- `generation_method_id`, `version_number` (deprecated)
- `content_data` (Object/JSONB)
- `created_by`, `is_current_version`
- `change_description`, `parent_version_id`
- `created_at`, `updated_at`, `deleted_at`

**מתודות:**
- `validate()` - ולידציה
- `markAsCurrent()` - סימון כגרסה נוכחית
- `isLatest()` - בדיקה אם זו הגרסה האחרונה
- `getSummary()` - סיכום גרסה

---

### 7. QualityCheck Entity
**קובץ:** `backend/src/domain/entities/QualityCheck.js`

**שדות:**
- `quality_check_id`, `content_id`, `check_type`
- `status`, `results` (Object/JSONB), `score`
- `error_message`, `created_at`, `completed_at`

**מתודות:**
- `validate()` - ולידציה
- `markCompleted()` - סימון כמושלם
- `markFailed()` - סימון ככשל
- `calculateScore()` - חישוב ציון כולל
- `isAcceptable()` - בדיקה אם איכות מקובלת
- `getQualityLevel()` - רמת איכות

**הערה:** QualityCheck לא נשמר בטבלה נפרדת - הנתונים נשמרים ב-`content.quality_check_data` ו-`content.quality_check_status`

---

## 📐 דיאגרמת ER

```
┌─────────────────────┐
│  trainer_courses    │
│─────────────────────│
│ course_id (PK)      │
│ course_name         │
│ trainer_id          │
│ description         │
│ skills[]            │
│ language            │
│ status              │
│ company_logo        │
│ permissions         │
│ usage_count         │
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────┐      ┌──────────────┐
│      topics         │      │   templates  │
│─────────────────────│      │──────────────│
│ topic_id (PK)       │      │ template_id  │
│ course_id (FK) ─────┼──────┤ template_name│
│ topic_name          │      │ template_type│
│ description         │      │ format_order │
│ trainer_id          │      │ created_by   │
│ language            │      └──────────────┘
│ status              │
│ skills[]            │
│ template_id (FK) ───┼──────┐
│ usage_count         │      │
└──────────┬──────────┘      │
           │                 │
           │ 1:N             │
           │                 │
┌──────────▼──────────┐      │
│      content        │      │
│─────────────────────│      │
│ content_id (PK)     │      │
│ topic_id (FK) ──────┼──────┘
│ content_type_id(FK) │
│ content_data (JSONB)│
│ generation_method_id│
│ quality_check_data  │
│ quality_check_status│
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────┐
│  content_history    │
│─────────────────────│
│ history_id (PK)     │
│ content_id (FK)     │
│ topic_id (FK)       │
│ content_type_id(FK) │
│ version_number      │
│ content_data (JSONB)│
│ deleted_at          │
└─────────────────────┘

┌──────────────┐      ┌──────────────┐
│content_types │      │generation_   │
│──────────────│      │  methods     │
│ type_id (PK) │      │──────────────│
│ type_name    │      │ method_id(PK)│
│ display_name │      │ method_name  │
└──────┬───────┘      │ display_name │
       │              │ usage_count  │
       │ 1:N          └──────┬───────┘
       │                    │
       └────────────────────┘
              │
              │ 1:N
              │
       ┌──────▼───────┐
       │   content    │
       └──────────────┘

┌──────────┐
│ topics   │
└────┬─────┘
     │
     │ 1:N
     │
┌────▼──────────┐
│   exercises   │
│───────────────│
│ exercise_id   │
│ topic_id (FK) │
│ question_text │
│ question_type │
│ ...           │
└───────────────┘
```

---

## 🔑 מפתחות וזיהוי

### Primary Keys:
- כל טבלה יש `*_id SERIAL PRIMARY KEY`
- `language_stats` משתמש ב-`language_code` כ-PRIMARY KEY

### Foreign Keys:
- כל FK עם `ON DELETE RESTRICT` או `ON DELETE SET NULL` או `ON DELETE CASCADE`
- `topics.course_id` → `ON DELETE SET NULL` (standalone אם קורס נמחק)
- `exercises.topic_id` → `ON DELETE CASCADE` (תרגילים נמחקים עם topic)

### Indexes:
- כל FK יש index
- JSONB fields יש GIN indexes
- Arrays (TEXT[]) יש GIN indexes
- Status fields יש indexes לסינון

---

## 📝 הערות חשובות

1. **Soft Delete:**
   - `status` field בכל טבלה (לא `deleted_at`)
   - `content_history` יש `deleted_at` (soft delete נפרד)

2. **JSONB Fields:**
   - `content_data` - מבנה שונה לפי סוג תוכן
   - `format_order` - מערך של סוגי תוכן
   - `skills` - מערך של כישורים (TEXT[])
   - `test_cases`, `devlab_response` - JSONB

3. **Calculated Fields:**
   - `topics.has_text`, `has_code`, וכו' - מחושבים דינמית
   - `topics.is_standalone` - `course_id === null`
   - `topics.total_content_formats` - ספירה של content

4. **Versioning:**
   - כל שינוי ב-content יוצר רשומה ב-`content_history`
   - `version_number` deprecated - משתמשים ב-`created_at`

5. **Quality Check:**
   - נשמר ב-`content` table (לא טבלה נפרדת)
   - `quality_check_data` (JSONB) + `quality_check_status` (VARCHAR)

---

**עודכן לאחרונה:** 2025-01-29

