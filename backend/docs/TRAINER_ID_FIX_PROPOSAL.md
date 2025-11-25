# TRAINER_ID Fix Proposal

## 📋 Summary

Fix the hardcoded `'system-auto'` trainer_id in `saveGeneratedTopicToDatabase.js` to use real trainer_id when available.

---

## Current Issue

**File:** `backend/src/application/use-cases/topics/saveGeneratedTopicToDatabase.js`

**Line 85:** Hardcoded `'system-auto'`
```javascript
'system-auto',  // ❌ Always uses system-auto, even when trainer exists
```

---

## Proposed Changes

### Change 1: Modify Function Signature

**File:** `backend/src/application/use-cases/topics/saveGeneratedTopicToDatabase.js`

**Current:**
```javascript
export async function saveGeneratedTopicToDatabase(generatedTopic, preferredLanguage) {
```

**Proposed:**
```javascript
export async function saveGeneratedTopicToDatabase(generatedTopic, preferredLanguage, trainerId = null) {
```

---

### Change 2: Add Trainer ID Logic

**File:** `backend/src/application/use-cases/topics/saveGeneratedTopicToDatabase.js`

**Location:** Around line 80-85

**Current Code:**
```javascript
const topicResult = await db.query(insertTopicSql, [
  generatedTopic.topic_name || '',
  generatedTopic.topic_description || '', // description field in DB
  topicLanguage, // language field in DB - ensure language is passed correctly
  skillsArray, // PostgreSQL array - pg driver handles conversion automatically
  'system-auto',  // ❌ HARDCODED
  null, // course_id
  null, // template_id
  5, // generation_methods_id
  'archived',
  null, // devlab_exercises
]);
```

**Proposed Code:**
```javascript
// Determine trainer_id: use provided trainerId, or fallback to 'system-auto'
const finalTrainerId = trainerId || 'system-auto';

// Log warning if using fallback
if (!trainerId) {
  logger.warn('[UseCase] Missing trainer_id for generated topic. Using system-auto fallback.', {
    topic_name: generatedTopic.topic_name,
    preferred_language: preferredLanguage,
  });
}

const topicResult = await db.query(insertTopicSql, [
  generatedTopic.topic_name || '',
  generatedTopic.topic_description || '', // description field in DB
  topicLanguage, // language field in DB - ensure language is passed correctly
  skillsArray, // PostgreSQL array - pg driver handles conversion automatically
  finalTrainerId,  // ✅ Use real trainer_id or fallback
  null, // course_id
  null, // template_id
  5, // generation_methods_id
  'archived',
  null, // devlab_exercises
]);
```

---

### Change 3: Update Function Call

**File:** `backend/src/presentation/controllers/ContentMetricsController.js`

**Location:** Line 361-364

**Current Code:**
```javascript
const saveResult = await saveGeneratedTopicToDatabase(
  generatedTopic,
  preferredLanguage.preferred_language
);
```

**Proposed Code:**
```javascript
// Extract trainer_id from request authentication context
const trainerId = req.auth?.trainer?.trainer_id || null;

const saveResult = await saveGeneratedTopicToDatabase(
  generatedTopic,
  preferredLanguage.preferred_language,
  trainerId  // ✅ Pass trainer_id if available
);
```

---

## Files to Modify

1. ✅ **saveGeneratedTopicToDatabase.js**
   - Add `trainerId` parameter (optional, default `null`)
   - Add logic to use `trainerId` or fallback to `'system-auto'`
   - Add warning log when using fallback

2. ✅ **ContentMetricsController.js**
   - Extract `trainer_id` from `req.auth.trainer.trainer_id`
   - Pass `trainer_id` to `saveGeneratedTopicToDatabase`

---

## Expected Behavior

### Scenario 1: Trainer Creates Topic (UI Flow)
- `req.auth.trainer.trainer_id` = `"trainer-123"`
- Function receives: `trainerId = "trainer-123"`
- Database saves: `trainer_id = "trainer-123"`
- ✅ No warning logged

### Scenario 2: Full AI Auto-Generation (No Trainer Context)
- `req.auth.trainer.trainer_id` = `null` or `undefined`
- Function receives: `trainerId = null`
- Database saves: `trainer_id = "system-auto"`
- ⚠️ Warning logged: `"Missing trainer_id for generated topic. Using system-auto fallback."`

---

## Testing Checklist

- [ ] Test with real trainer_id from UI flow
- [ ] Test with null trainer_id (auto-generation)
- [ ] Verify warning is logged when using fallback
- [ ] Verify no warning when trainer_id is provided
- [ ] Verify database saves correct trainer_id

---

**Status:** ⏳ Waiting for Approval

**⚠️ IMPORTANT:** Do NOT commit or push until explicit approval.

