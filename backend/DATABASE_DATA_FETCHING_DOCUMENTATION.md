# Database Data Fetching Documentation

## 📋 Overview

This document describes how the Content Studio backend retrieves data from the PostgreSQL database. This is a **read-only documentation** - no code modifications are included.

---

## 🔌 Database Connection Layer

### Database Library
- **Library**: `pg` (node-postgres)
- **Version**: PostgreSQL client for Node.js
- **Connection Type**: Connection Pool (singleton pattern)

### Connection File
**Location**: `backend/src/infrastructure/database/DatabaseConnection.js`

### Connection Initialization

```javascript
import pg from 'pg';
const { Pool } = pg;

// Singleton instance
export const db = new DatabaseConnection();
```

**Connection Method**:
```javascript
this.pool = new Pool({
  host: resolvedHost,           // Resolved IPv4 address
  port: Number(url.port) || 5432,
  user: decodeURIComponent(url.username || ''),
  password: decodeURIComponent(url.password || ''),
  database: (url.pathname || '').replace(/^\//, ''),
  ssl: { rejectUnauthorized: false },
  max: 20,                      // Max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

### Environment Variables

**Primary Connection**:
- `DATABASE_URL` - PostgreSQL connection string (required)
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://postgres:password@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres`

**Development Overrides** (optional):
- `DATABASE_IPV4_HOST` - Force IPv4 host (development only)
- `DATABASE_IPV4_PORT` - Force IPv4 port (development only)

### Connection Features

1. **IPv4 Resolution**: Automatically resolves domain names to IPv4 addresses
2. **Connection Pooling**: Manages up to 20 concurrent connections
3. **Slow Query Logging**: Logs queries taking > 1000ms
4. **Graceful Degradation**: Falls back to in-memory repositories if connection fails

### Query Execution Method

```javascript
async query(text, params) {
  await this.ready;
  const result = await this.pool.query(text, params);
  return result; // { rows: [...], rowCount: N }
}
```

---

## 📚 Repository Pattern

### Repository Factory

**Location**: `backend/src/infrastructure/database/repositories/RepositoryFactory.js`

The factory automatically selects the appropriate repository implementation:

```javascript
// If database is connected → PostgreSQL repositories
// If database is NOT connected → In-memory repositories (fallback)
```

**Available Repositories**:
- `getCourseRepository()` → `PostgreSQLCourseRepository` or `CourseRepository`
- `getTopicRepository()` → `PostgreSQLTopicRepository` or `TopicRepository`
- `getContentRepository()` → `PostgreSQLContentRepository` or `ContentRepository`
- `getTemplateRepository()` → `PostgreSQLTemplateRepository` or `TemplateRepository`
- `getContentVersionRepository()` → `PostgreSQLContentVersionRepository` or `ContentVersionRepository`
- `getQualityCheckRepository()` → `PostgreSQLQualityCheckRepository` or `QualityCheckRepository`

---

## 🔍 Main Data Fetching Methods

### 1. Content Repository

**File**: `backend/src/infrastructure/database/repositories/PostgreSQLContentRepository.js`

#### `findById(contentId)`
```sql
SELECT * FROM content WHERE content_id = $1
```
- **Returns**: Single `Content` entity or `null`
- **Used by**: `ContentController.getById()`

#### `findAllByTopicId(topicId, filters = {})`
```sql
SELECT * FROM content 
WHERE topic_id = $1 
  AND (status IS NULL OR status != 'archived')  -- if status column exists
  AND (quality_check_status IS NULL OR quality_check_status != 'deleted')  -- fallback
  AND content_type_id = $2  -- optional filter
  AND generation_method_id = $3  -- optional filter
ORDER BY created_at DESC
```
- **Returns**: Array of `Content` entities
- **Filters Supported**:
  - `content_type_id` (string or number)
  - `generation_method_id` (string or number)
  - `includeArchived` (boolean)
- **Used by**: `ContentController.list()`

#### `findLatestByTopicAndType(topicId, contentTypeIdOrName)`
```sql
SELECT * FROM content
WHERE topic_id = $1
  AND content_type_id = $2
  AND (status IS NULL OR status != 'archived')
ORDER BY updated_at DESC, created_at DESC
LIMIT 1
```
- **Returns**: Single `Content` entity or `null`
- **Used by**: `ContentHistoryService.restoreVersion()`, `CreateContentUseCase`

#### `getContentTypeId(typeName)`
```sql
SELECT type_id FROM content_types WHERE type_name = $1
```
- **Returns**: Content type ID (number)
- **Used by**: Internal conversion (string → ID)

#### `getContentTypeNamesByIds(typeIds)`
```sql
SELECT type_id, type_name FROM content_types WHERE type_id IN ($1, $2, ...)
```
- **Returns**: Map<number, string> of type IDs to names
- **Used by**: Content type lookups

#### `getGenerationMethodId(methodName)`
```sql
SELECT method_id FROM generation_methods WHERE method_name = $1
```
- **Returns**: Generation method ID (number)
- **Used by**: Internal conversion (string → ID)

---

### 2. Content Version Repository (History)

**File**: `backend/src/infrastructure/database/repositories/PostgreSQLContentVersionRepository.js`

#### `findById(versionId)`
```sql
SELECT * FROM content_history WHERE history_id = $1
```
- **Returns**: Single `ContentVersion` entity or `null`
- **Used by**: `ContentHistoryService.restoreVersion()`

#### `findByTopicAndType(topicId, contentTypeId)`
```sql
SELECT * FROM content_history 
WHERE topic_id = $1
  AND content_type_id = $2
  AND deleted_at IS NULL  -- if deleted_at column exists
ORDER BY updated_at DESC, created_at DESC
```
- **Returns**: Array of `ContentVersion` entities (sorted by timestamp, LIFO)
- **Used by**: `ContentHistoryService.getHistoryByContent()`

#### `findCurrentVersion(topicId, contentTypeId)`
```sql
SELECT * FROM content_history 
WHERE topic_id = $1
  AND content_type_id = $2
  AND deleted_at IS NULL
ORDER BY updated_at DESC, created_at DESC 
LIMIT 1
```
- **Returns**: Single `ContentVersion` entity (most recent) or `null`
- **Used by**: Version tracking logic

---

### 3. Topic Repository

**File**: `backend/src/infrastructure/database/repositories/PostgreSQLTopicRepository.js`

#### `findById(topicId)`
```sql
SELECT * FROM topics WHERE topic_id = $1 AND status != $2
```
- **Parameters**: `[topicId, 'deleted']`
- **Returns**: Single `Topic` entity or `null`
- **Used by**: `TopicController.getById()`, `AIGenerationController`

#### `findAll(filters = {}, pagination = {})`
```sql
SELECT * FROM topics 
WHERE status != $1
  AND trainer_id = $2  -- optional filter
  AND status = $3  -- optional filter
  AND course_id = $4  -- optional filter (or IS NULL)
  AND language = $5  -- optional filter
ORDER BY created_at DESC 
LIMIT $6 OFFSET $7
```
- **Returns**: Array of `Topic` entities
- **Filters Supported**: `trainer_id`, `status`, `course_id`, `language`
- **Pagination**: `page`, `limit`
- **Used by**: `TopicController.list()`

#### `findByTrainer(trainerId, filters = {}, pagination = {})`
```sql
SELECT t.*, COUNT(DISTINCT c.content_type_id) as content_count
FROM topics t
LEFT JOIN content c ON t.topic_id = c.topic_id
WHERE t.trainer_id = $1 AND t.status != $2
GROUP BY t.topic_id
HAVING t.status = $3  -- optional
  AND t.course_id = $4  -- optional
  AND (t.topic_name ILIKE $5 OR t.description ILIKE $5)  -- optional search
ORDER BY created_at DESC
LIMIT $6 OFFSET $7
```
- **Returns**: Object with `topics` array and `total` count
- **Features**: Includes content count per topic, supports search
- **Used by**: `TopicController.getByTrainer()`

#### `findByCourseId(courseId)`
```sql
SELECT * FROM topics WHERE course_id = $1 AND status != $2
```
- **Returns**: Array of `Topic` entities
- **Used by**: Course-topic relationships

---

### 4. Course Repository

**File**: `backend/src/infrastructure/database/repositories/PostgreSQLCourseRepository.js`

#### `findById(courseId)`
```sql
SELECT * FROM trainer_courses WHERE course_id = $1 AND status != $2
```
- **Parameters**: `[courseId, 'deleted']`
- **Returns**: Single `Course` entity or `null`
- **Used by**: `CourseController.getById()`

#### `findAll(filters = {}, pagination = {})`
```sql
SELECT * FROM trainer_courses 
WHERE status != $1
  AND trainer_id = $2  -- optional filter
  AND status = $3  -- optional filter
ORDER BY created_at DESC 
LIMIT $4 OFFSET $5
```
- **Returns**: Array of `Course` entities
- **Used by**: `CourseController.list()`

#### `findByTrainer(trainerId, filters = {}, pagination = {})`
```sql
SELECT * FROM trainer_courses 
WHERE trainer_id = $1 AND status != $2
  AND status = $3  -- optional filter
  AND (course_name ILIKE $4 OR description ILIKE $4)  -- optional search
ORDER BY created_at DESC
LIMIT $5 OFFSET $6
```
- **Returns**: Object with `courses` array and `total` count
- **Used by**: `CourseController.getByTrainer()`

---

### 5. Template Repository

**File**: `backend/src/infrastructure/database/repositories/PostgreSQLTemplateRepository.js`

#### `findById(templateId)`
```sql
SELECT * FROM templates WHERE template_id = $1
```
- **Returns**: Single `Template` entity or `null`
- **Used by**: `TemplateController.getById()`, `TopicController`

#### `findAll(filters = {})`
```sql
SELECT * FROM templates 
WHERE 1=1
  AND template_type = $1  -- optional filter
  AND created_by = $2  -- optional filter
ORDER BY created_at DESC
```
- **Returns**: Array of `Template` entities
- **Used by**: `TemplateController.list()`

---

### 6. Quality Check Repository

**File**: `backend/src/infrastructure/database/repositories/PostgreSQLQualityCheckRepository.js`

#### `findById(qualityCheckId)`
```sql
SELECT * FROM content 
WHERE content_id = $3
  AND quality_check_data IS NOT NULL
```
- **Returns**: Quality check data embedded in `Content` entity
- **Used by**: `QualityCheckController.getById()`

#### `findByContentId(contentId)`
```sql
SELECT * FROM content WHERE content_id = $1
```
- **Returns**: `Content` entity with quality check data
- **Used by**: `QualityCheckController.getByContentId()`

#### `findLatestByContentId(contentId)`
- Calls `findByContentId()` and returns the latest check
- **Used by**: Latest quality check retrieval

#### `findAll(filters = {})`
```sql
SELECT * FROM content 
WHERE quality_check_data IS NOT NULL
  AND content_id = $1  -- optional filter
  AND quality_check_status = $2  -- optional filter
```
- **Returns**: Array of content items with quality checks
- **Used by**: Quality check listings

---

### 7. Language Stats Repository

**File**: `backend/src/infrastructure/database/repositories/LanguageStatsRepository.js`

#### `getLanguageStats(languageCode)`
```sql
SELECT * FROM language_stats WHERE language_code = $1
```
- **Returns**: Language statistics object
- **Used by**: Language statistics dashboard

#### `getFrequentLanguages()`
```sql
SELECT language_code FROM language_stats 
WHERE is_frequent = true 
ORDER BY total_requests DESC
```
- **Returns**: Array of frequent language codes
- **Used by**: Language preloading jobs

#### `getPopularLanguages(limit = 10)`
```sql
SELECT * FROM language_stats 
ORDER BY total_requests DESC 
LIMIT $1
```
- **Returns**: Top N popular languages
- **Used by**: Language popularity rankings

---

## 🎯 Controller → Repository Flow

### Content Controller

**File**: `backend/src/presentation/controllers/ContentController.js`

#### `GET /api/content/:id` → `getById()`
```
Request → ContentController.getById()
  → contentRepository.findById(contentId)
    → SQL: SELECT * FROM content WHERE content_id = $1
  → ContentDTO.toContentResponse(content)
  → JSON Response
```

#### `GET /api/content?topic_id=1` → `list()`
```
Request → ContentController.list()
  → contentRepository.findAllByTopicId(topicId, filters)
    → SQL: SELECT * FROM content WHERE topic_id = $1 ... ORDER BY created_at DESC
  → ContentDTO.toContentListResponse(contents)
  → JSON Response
```

#### `GET /api/content/:id/history` → `history()`
```
Request → ContentController.history()
  → contentHistoryService.getHistoryByContent(contentId)
    → contentRepository.findById(contentId)  -- Get current content
    → contentHistoryRepository.findByTopicAndType(topicId, contentTypeId)  -- Get history
      → SQL: SELECT * FROM content_history WHERE topic_id = $1 AND content_type_id = $2 ...
  → JSON Response with history data
```

---

### Topic Controller

**File**: `backend/src/presentation/controllers/TopicController.js`

#### `GET /api/topics/:id` → `getById()`
```
Request → TopicController.getById()
  → topicRepository.findById(topicId)
    → SQL: SELECT * FROM topics WHERE topic_id = $1 AND status != $2
  → TopicDTO.toTopicResponse(topic)
  → JSON Response
```

#### `GET /api/topics?trainer_id=123` → `getByTrainer()`
```
Request → TopicController.getByTrainer()
  → topicRepository.findByTrainer(trainerId, filters, pagination)
    → SQL: SELECT t.*, COUNT(DISTINCT c.content_type_id) ... GROUP BY t.topic_id ...
  → JSON Response with topics and total count
```

---

### Course Controller

**File**: `backend/src/presentation/controllers/CourseController.js`

#### `GET /api/courses/:id` → `getById()`
```
Request → CourseController.getById()
  → courseRepository.findById(courseId)
    → SQL: SELECT * FROM trainer_courses WHERE course_id = $1 AND status != $2
  → CourseDTO.toCourseResponse(course)
  → JSON Response
```

---

## 🔄 Data Mapping

### Row to Entity Mapping

All PostgreSQL repositories include `mapRowTo*()` methods that convert database rows to domain entities:

#### Content Mapping
```javascript
mapRowToContent(row) {
  return new Content({
    content_id: row.content_id,
    topic_id: row.topic_id,
    content_type_id: row.content_type_id,
    generation_method_id: row.generation_method_id,
    content_data: typeof row.content_data === 'string' 
      ? JSON.parse(row.content_data) 
      : row.content_data,
    quality_check_status: row.quality_check_status,
    quality_check_data: row.quality_check_data 
      ? (typeof row.quality_check_data === 'string'
          ? JSON.parse(row.quality_check_data)
          : row.quality_check_data)
      : null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}
```

#### Content Version Mapping
```javascript
mapRowToContentVersion(row) {
  return new ContentVersion({
    version_id: row.history_id,
    topic_id: row.topic_id,
    content_type_id: row.content_type_id,
    generation_method_id: row.generation_method_id,
    content_data: typeof row.content_data === 'string' 
      ? JSON.parse(row.content_data) 
      : row.content_data,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    deleted_at: row.deleted_at || null,
  });
}
```

---

## 🔍 Search Service

**File**: `backend/src/infrastructure/database/services/SearchService.js`

The search service aggregates data from multiple repositories:

### Search Flow
```
SearchService.search(criteria)
  → courseRepository.findAll()  -- Search courses
  → topicRepository.findAll()   -- Search topics
  → contentRepository.findByTopicId()  -- Search content
  → Filter and rank results
  → Return unified search results
```

**Note**: Currently uses in-memory filtering. Future implementation will use PostgreSQL full-text search (tsvector/tsquery).

---

## 📊 Query Patterns

### Common Patterns

1. **Single Record by ID**:
   ```sql
   SELECT * FROM table WHERE id = $1
   ```

2. **Filtered Lists**:
   ```sql
   SELECT * FROM table 
   WHERE condition1 = $1 
     AND condition2 = $2
   ORDER BY created_at DESC
   ```

3. **Pagination**:
   ```sql
   SELECT * FROM table 
   WHERE conditions
   ORDER BY created_at DESC
   LIMIT $N OFFSET $M
   ```

4. **Soft Delete Filtering**:
   ```sql
   SELECT * FROM table 
   WHERE status != 'deleted'  -- or 'archived'
   ```

5. **JSONB Data**:
   ```sql
   SELECT * FROM table WHERE jsonb_column IS NOT NULL
   -- JSONB columns are automatically parsed in mapRowTo* methods
   ```

6. **Aggregations with JOINs**:
   ```sql
   SELECT t.*, COUNT(DISTINCT c.content_type_id) as content_count
   FROM topics t
   LEFT JOIN content c ON t.topic_id = c.topic_id
   GROUP BY t.topic_id
   ```

---

## 🛡️ Error Handling

### Connection Errors
- If `DATABASE_URL` is not set → Falls back to in-memory repositories
- If connection fails → Logs error, continues without database
- If query fails → Throws error, caught by error handler middleware

### Query Errors
- All queries use parameterized statements (`$1`, `$2`, etc.) to prevent SQL injection
- Errors are logged with query context
- Slow queries (>1000ms) are logged as warnings

---

## 📝 Summary

### Database Access Flow

```
HTTP Request
  ↓
Express Route (content.js, topics.js, etc.)
  ↓
Controller (ContentController, TopicController, etc.)
  ↓
Use Case / Service (optional)
  ↓
Repository (PostgreSQLContentRepository, etc.)
  ↓
DatabaseConnection.query()
  ↓
PostgreSQL Pool
  ↓
PostgreSQL Database
```

### Key Files

1. **Connection**: `backend/src/infrastructure/database/DatabaseConnection.js`
2. **Repositories**: `backend/src/infrastructure/database/repositories/PostgreSQL*.js`
3. **Factory**: `backend/src/infrastructure/database/repositories/RepositoryFactory.js`
4. **Controllers**: `backend/src/presentation/controllers/*.js`
5. **Routes**: `backend/src/presentation/routes/*.js`

### Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `DATABASE_IPV4_HOST` - IPv4 host override (development only)
- `DATABASE_IPV4_PORT` - IPv4 port override (development only)

---

**Last Updated**: 2025-11-12
**Documentation Type**: Read-only analysis

