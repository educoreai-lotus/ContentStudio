# Database Rules Scan Report

## 📋 Executive Summary

This report documents the current state of `trainer_id` and `usage_count` in the Content Studio database, identifies issues, and proposes fixes according to the strict rules provided.

**Status:** ⏳ Waiting for Approval

---

## 1. TRAINER_ID Analysis

### 1.1. Tables with `trainer_id` Column

| Table | Column | Type | NOT NULL | Current Status |
|-------|--------|------|----------|----------------|
| **trainer_courses** | `trainer_id` | VARCHAR(50) | ✅ YES | ✅ PRESERVED |
| **topics** | `trainer_id` | VARCHAR(50) | ✅ YES | ✅ PRESERVED |

### 1.2. INSERT Statements - Courses

#### ✅ PostgreSQLCourseRepository.js (Line 19-36)
**File:** `backend/src/infrastructure/database/repositories/PostgreSQLCourseRepository.js`

```javascript
INSERT INTO trainer_courses (
  course_name, trainer_id, description, skills, language, status, company_logo, permissions, usage_count
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
```

**Status:** ✅ **CORRECT** - `trainer_id` is included (position $2)

**Source:** `course.trainer_id` from Course entity

---

#### ✅ PostgreSQLTopicRepository.js (Line 19-36)
**File:** `backend/src/infrastructure/database/repositories/PostgreSQLTopicRepository.js`

```javascript
INSERT INTO topics (
  topic_name, trainer_id, description, course_id, template_id,
  skills, language, status
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
```

**Status:** ✅ **CORRECT** - `trainer_id` is included (position $2)

**Source:** `topic.trainer_id` from Topic entity

---

#### ⚠️ saveGeneratedTopicToDatabase.js (Line 62-74)
**File:** `backend/src/application/use-cases/topics/saveGeneratedTopicToDatabase.js`

```javascript
INSERT INTO topics (
  topic_name,
  description,
  language,
  skills,
  trainer_id,  // ✅ Included
  course_id,
  template_id,
  generation_methods_id,
  status,
  devlab_exercises,
  usage_count
) VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, 0)
```

**Current Value:** `'system-auto'` (hardcoded, line 85)

**Status:** ⚠️ **NEEDS REVIEW** - Uses hardcoded `'system-auto'` instead of actual trainer_id

**Proposed Fix:**
- Should get `trainer_id` from authenticated context or request
- If no trainer context, use `'system-auto'` as fallback (but log warning)

---

### 1.3. UPDATE Statements - Courses

#### ✅ PostgreSQLCourseRepository.js (Line 151-193)
**File:** `backend/src/infrastructure/database/repositories/PostgreSQLCourseRepository.js`

```javascript
UPDATE trainer_courses
SET ${setClauses.join(', ')}
WHERE course_id = $${paramIndex}
```

**Allowed Fields:** `['course_name', 'description', 'skills', 'language', 'status', 'company_logo', 'permissions']`

**Status:** ✅ **CORRECT** - `trainer_id` is NOT in allowedFields (cannot be updated, which is correct)

---

### 1.4. UPDATE Statements - Topics

#### ✅ PostgreSQLTopicRepository.js (Line 201-252)
**File:** `backend/src/infrastructure/database/repositories/PostgreSQLTopicRepository.js`

```javascript
UPDATE topics
SET ${setClauses.join(', ')}
WHERE topic_id = $${paramIndex}
```

**Allowed Fields:** `['topic_name', 'description', 'course_id', 'template_id', 'skills', 'language', 'status', 'format_flags']`

**Status:** ✅ **CORRECT** - `trainer_id` is NOT in allowedFields (cannot be updated, which is correct)

---

### 1.5. Summary - TRAINER_ID

| Location | Status | Issue | Action Required |
|----------|--------|-------|-----------------|
| **PostgreSQLCourseRepository.create()** | ✅ | None | None |
| **PostgreSQLTopicRepository.create()** | ✅ | None | None |
| **saveGeneratedTopicToDatabase.js** | ⚠️ | Hardcoded `'system-auto'` | Review - may be intentional for AI-generated topics |

**Conclusion:** `trainer_id` is properly preserved in all INSERT/UPDATE statements. The only potential issue is the hardcoded `'system-auto'` in `saveGeneratedTopicToDatabase.js`, which may be intentional for system-generated topics.

---

## 2. USAGE_COUNT Analysis

### 2.1. Tables with `usage_count` Column

| Table | Column | Default | Current Behavior |
|-------|--------|---------|------------------|
| **trainer_courses** | `usage_count` | 0 | ❌ Incremented incorrectly |
| **topics** | `usage_count` | 0 | ❌ Incremented incorrectly |
| **generation_methods** | `usage_count` | 0 | ✅ Correct (not in scope) |

### 2.2. Current Usage Count Updates - Topics

#### ❌ saveGeneratedTopicToDatabase.js (Line 160-161)
**File:** `backend/src/application/use-cases/topics/saveGeneratedTopicToDatabase.js`

```javascript
// ❌ WRONG: Increments when topic is CREATED
const updateTopicUsageSql = `UPDATE topics SET usage_count = usage_count + 1 WHERE topic_id = ${topicId}`;
await db.query(updateTopicUsageSql);
```

**When:** After topic is created and saved to database

**Issue:** ❌ **VIOLATES RULE** - Increments `usage_count` when topic is created, not when it's actually used

**Action:** ❌ **REMOVE** this increment

---

#### ✅ fillCourseBuilder.js (Line 59-60)
**File:** `backend/src/application/services/fillers/fillCourseBuilder.js`

```javascript
// ✅ CORRECT: Increments when topic is SELECTED for a learner
await db.query(
  'UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE topic_id = $1',
  [data.topic_id]
);
```

**When:** When topic is fetched and returned to Course Builder (actual usage)

**Status:** ✅ **CORRECT** - This is valid usage (topic selected for learner)

**Action:** ✅ **KEEP** this increment

---

#### ✅ fillCourseBuilderByCompany.js (Line 151-154)
**File:** `backend/src/application/services/fillers/fillCourseBuilderByCompany.js`

```javascript
// ✅ CORRECT: Increments when topics are SELECTED for employees
await db.query(
  `UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP 
   WHERE topic_id = ANY($1::INTEGER[])`,
  [topicIds]
);
```

**When:** When topics are selected and returned to Course Builder for company employees

**Status:** ✅ **CORRECT** - This is valid usage (topics selected for learners)

**Action:** ✅ **KEEP** this increment

---

#### ❌ fillAnalytics.js (Line 96-98)
**File:** `backend/src/application/services/fillers/fillAnalytics.js`

```javascript
// ❌ WRONG: Increments when ALL topics are fetched (not actual usage)
await db.query(
  `UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE topic_id IN (${placeholders})`,
  topicIds
);
```

**When:** When Analytics service fetches ALL standalone topics (for reporting/analytics)

**Issue:** ❌ **VIOLATES RULE** - Increments `usage_count` just because topics are fetched, not because they're actually used

**Action:** ❌ **REMOVE** this increment

---

### 2.3. Current Usage Count Updates - Courses

#### ✅ fillDirectory.js (Line 44-45)
**File:** `backend/src/application/services/fillers/fillDirectory.js`

```javascript
// ✅ CORRECT: Increments when course is SELECTED for a learner/organization
await db.query(
  'UPDATE trainer_courses SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE course_id = $1',
  [data.course_id]
);
```

**When:** When course is fetched and returned to Directory service (actual usage)

**Status:** ✅ **CORRECT** - This is valid usage (course selected for learner/organization)

**Action:** ✅ **KEEP** this increment

---

#### ❌ fillAnalytics.js (Line 49-50)
**File:** `backend/src/application/services/fillers/fillAnalytics.js`

```javascript
// ❌ WRONG: Increments when ALL courses are fetched (not actual usage)
await db.query(
  `UPDATE trainer_courses SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE course_id IN (${placeholders})`,
  courseIds
);
```

**When:** When Analytics service fetches ALL courses (for reporting/analytics)

**Issue:** ❌ **VIOLATES RULE** - Increments `usage_count` just because courses are fetched, not because they're actually used

**Action:** ❌ **REMOVE** this increment

---

### 2.4. Repository Methods

#### PostgreSQLTopicRepository.incrementUsageCount() (Line 310-323)
**File:** `backend/src/infrastructure/database/repositories/PostgreSQLTopicRepository.js`

```javascript
async incrementUsageCount(topicId) {
  const query = `
    UPDATE topics 
    SET usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE topic_id = $1
  `;
  await this.db.query(query, [topicId]);
}
```

**Status:** ✅ **CORRECT** - This is a utility method, not called incorrectly

**Action:** ✅ **KEEP** - Method is fine, just need to ensure it's only called for actual usage

---

#### PostgreSQLCourseRepository.incrementUsageCount() (Line 219-232)
**File:** `backend/src/infrastructure/database/repositories/PostgreSQLCourseRepository.js`

```javascript
async incrementUsageCount(courseId) {
  const query = `
    UPDATE trainer_courses 
    SET usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE course_id = $1
  `;
  await this.db.query(query, [courseId]);
}
```

**Status:** ✅ **CORRECT** - This is a utility method, not called incorrectly

**Action:** ✅ **KEEP** - Method is fine, just need to ensure it's only called for actual usage

---

### 2.5. Summary - USAGE_COUNT

| Location | When | Status | Action |
|----------|------|--------|--------|
| **saveGeneratedTopicToDatabase.js** | After topic creation | ❌ WRONG | ❌ REMOVE |
| **fillCourseBuilder.js** | Topic selected for learner | ✅ CORRECT | ✅ KEEP |
| **fillCourseBuilderByCompany.js** | Topics selected for employees | ✅ CORRECT | ✅ KEEP |
| **fillAnalytics.js (topics)** | All topics fetched | ❌ WRONG | ❌ REMOVE |
| **fillDirectory.js** | Course selected for learner | ✅ CORRECT | ✅ KEEP |
| **fillAnalytics.js (courses)** | All courses fetched | ❌ WRONG | ❌ REMOVE |

---

## 3. Proposed Changes

### 3.1. Migration: Reset All Usage Counts

**File:** `backend/database/migrations/20250122_reset_usage_counts.sql` (NEW)

```sql
-- ============================================
-- Reset usage_count to 0 for all tables
-- ============================================

-- Reset topics.usage_count
UPDATE topics SET usage_count = 0;

-- Reset trainer_courses.usage_count
UPDATE trainer_courses SET usage_count = 0;

-- Note: generation_methods.usage_count is not reset (different purpose)
```

**Status:** ⏳ Waiting for Approval

---

### 3.2. Code Changes - Remove Invalid Increments

#### Change 1: saveGeneratedTopicToDatabase.js
**File:** `backend/src/application/use-cases/topics/saveGeneratedTopicToDatabase.js`

**Lines to Remove:** 157-174 (entire usage counter update block)

**Current Code:**
```javascript
// Step 3: Update usage counters
try {
  // Update topic usage_count
  const updateTopicUsageSql = `UPDATE topics SET usage_count = usage_count + 1 WHERE topic_id = ${topicId}`;
  await db.query(updateTopicUsageSql);

  // Update generation_methods usage_count (method_id = 5)
  const updateMethodUsageSql = `UPDATE generation_methods SET usage_count = usage_count + 1 WHERE method_id = 5`;
  await db.query(updateMethodUsageSql);

  logger.info('[UseCase] Usage counters updated', { topic_id: topicId });
} catch (usageError) {
  logger.warn('[UseCase] Failed to update usage counters', {
    error: usageError.message,
    topic_id: topicId,
  });
}
```

**Proposed Change:**
```javascript
// Step 3: Update generation_methods usage_count (method_id = 5)
// NOTE: topic usage_count is NOT incremented here - it's only incremented when topic is actually used
try {
  const updateMethodUsageSql = `UPDATE generation_methods SET usage_count = usage_count + 1 WHERE method_id = 5`;
  await db.query(updateMethodUsageSql);

  logger.info('[UseCase] Generation method usage counter updated', { topic_id: topicId });
} catch (usageError) {
  logger.warn('[UseCase] Failed to update generation method usage counter', {
    error: usageError.message,
    topic_id: topicId,
  });
}
```

**Status:** ⏳ Waiting for Approval

---

#### Change 2: fillAnalytics.js - Remove Topics Increment
**File:** `backend/src/application/services/fillers/fillAnalytics.js`

**Lines to Remove:** 90-103 (topic usage_count increment block)

**Current Code:**
```javascript
// Increment usage_count for all fetched topics
const topicIds = topicsResult.rows.map(row => row.topic_id);
if (topicIds.length > 0) {
  try {
    const placeholders = topicIds.map((_, index) => `$${index + 1}`).join(', ');
    await db.query(
      `UPDATE topics SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE topic_id IN (${placeholders})`,
      topicIds
    );
  } catch (error) {
    logger.warn('[fillAnalytics] Failed to increment topics usage count:', error.message);
    // Don't fail the entire operation if usage count increment fails
  }
}
```

**Proposed Change:**
```javascript
// NOTE: usage_count is NOT incremented here - Analytics fetches topics for reporting,
// not for actual learner usage. Usage count is only incremented when topics are
// selected and returned to Course Builder for actual learners.
```

**Status:** ⏳ Waiting for Approval

---

#### Change 3: fillAnalytics.js - Remove Courses Increment
**File:** `backend/src/application/services/fillers/fillAnalytics.js`

**Lines to Remove:** 43-56 (course usage_count increment block)

**Current Code:**
```javascript
// Increment usage_count for all fetched courses
const courseIds = coursesResult.rows.map(row => row.course_id);
if (courseIds.length > 0) {
  try {
    const placeholders = courseIds.map((_, index) => `$${index + 1}`).join(', ');
    await db.query(
      `UPDATE trainer_courses SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE course_id IN (${placeholders})`,
      courseIds
    );
  } catch (error) {
    logger.warn('[fillAnalytics] Failed to increment courses usage count:', error.message);
    // Don't fail the entire operation if usage count increment fails
  }
}
```

**Proposed Change:**
```javascript
// NOTE: usage_count is NOT incremented here - Analytics fetches courses for reporting,
// not for actual learner usage. Usage count is only incremented when courses are
// selected and returned to Directory/Course Builder for actual learners.
```

**Status:** ⏳ Waiting for Approval

---

### 3.3. Code Changes - Keep Valid Increments

#### ✅ fillCourseBuilder.js - KEEP
**File:** `backend/src/application/services/fillers/fillCourseBuilder.js`

**Status:** ✅ **KEEP AS IS** - Correctly increments when topic is selected for learner

---

#### ✅ fillCourseBuilderByCompany.js - KEEP
**File:** `backend/src/application/services/fillers/fillCourseBuilderByCompany.js`

**Status:** ✅ **KEEP AS IS** - Correctly increments when topics are selected for employees

---

#### ✅ fillDirectory.js - KEEP
**File:** `backend/src/application/services/fillers/fillDirectory.js`

**Status:** ✅ **KEEP AS IS** - Correctly increments when course is selected for learner/organization

---

## 4. Files That Will Be Modified

### 4.1. New Migration File

- **File:** `backend/database/migrations/20250122_reset_usage_counts.sql` (NEW)
- **Action:** Reset all `usage_count` values to 0
- **Tables Affected:**
  - `topics.usage_count`
  - `trainer_courses.usage_count`

---

### 4.2. Code Files to Modify

1. **saveGeneratedTopicToDatabase.js**
   - **Action:** Remove topic `usage_count` increment (keep generation_methods increment)
   - **Lines:** 157-174 (modify, don't remove entirely)

2. **fillAnalytics.js**
   - **Action:** Remove both topics and courses `usage_count` increments
   - **Lines:** 43-56 (courses), 90-103 (topics)

---

## 5. Summary of Valid Usage Count Increments

After changes, `usage_count` will ONLY be incremented in these valid scenarios:

### Topics:
1. ✅ **fillCourseBuilder.js** - When topic is selected and returned to Course Builder for a learner
2. ✅ **fillCourseBuilderByCompany.js** - When topics are selected and returned for company employees

### Courses:
1. ✅ **fillDirectory.js** - When course is selected and returned to Directory for a learner/organization

---

## 6. Approval Checklist

- [ ] Review migration SQL for resetting usage counts
- [ ] Approve removal of `usage_count` increment in `saveGeneratedTopicToDatabase.js`
- [ ] Approve removal of `usage_count` increments in `fillAnalytics.js`
- [ ] Confirm that valid increments (fillCourseBuilder, fillCourseBuilderByCompany, fillDirectory) should be kept
- [ ] Approve execution of migration (will reset all usage counts to 0)

---

**Report Generated:** 2025-01-22
**Status:** ⏳ Waiting for Explicit Approval

**⚠️ IMPORTANT:** Do NOT run migrations or modify code until explicit approval is given.

