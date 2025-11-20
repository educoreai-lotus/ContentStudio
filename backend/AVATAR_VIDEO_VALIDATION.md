# Avatar Video Validation - No OpenAI Script Generation

## ⚠️ CRITICAL RULE

**Avatar Video narration MUST NEVER use OpenAI or any LLM for script generation.**

The avatar narration must come **ONLY from HeyGen** using our formatted prompt.

---

## ❌ FORBIDDEN

**Do NOT:**
- Request OpenAI to generate "video script" or "narration text"
- Forward OpenAI text output to HeyGen
- Use any LLM-generated text for avatar narration
- Call `openaiClient.generateText()` before `heygenClient.generateVideo()`
- Summarize, rewrite, or process prompt text with OpenAI before sending to HeyGen

---

## ✅ REQUIRED

**Avatar narration must use ONLY:**
- `topic_name` - Lesson topic
- `lesson_description` - Topic description
- `skills` - List of skills
- `trainer_prompt` OR `transcript_text` - Trainer input or video transcription

**Flow:**
1. Format prompt using `buildAvatarText()` (pure function, no OpenAI)
2. Send formatted text directly to `heygenClient.generateVideo()`
3. HeyGen generates narration independently

---

## 🔐 Validation Safeguards

### 1. Code Structure
- `buildAvatarText()` is a **pure function** - no side effects, no external calls
- `generateAvatarVideo()` calls `buildAvatarText()` then HeyGen directly
- No OpenAI client methods are called in avatar video flow

### 2. Runtime Checks (Development/Test)
- Validation warnings in development mode
- Text component validation (ensures prompt parts are present)
- OpenAICall tracker for test assertions

### 3. Tests
- **`AvatarVideoValidation.test.js`** - Comprehensive test suite
- Tests fail if OpenAI is called before HeyGen
- Tests verify pure function behavior
- Tests ensure formatted text is sent to HeyGen

---

## 📍 Code Locations

### Key Files:
1. **`backend/src/infrastructure/ai/AIGenerationService.js`**
   - `buildAvatarText()` - Pure function that formats prompt (lines 560-621)
   - `generateAvatarVideo()` - Generates video via HeyGen only (lines 643-741)

2. **`backend/src/application/use-cases/GenerateContentUseCase.js`**
   - Case 6 (avatar_video) - Builds lesson data and calls `generateAvatarVideo()` (lines 345-387)

3. **`backend/src/infrastructure/ai/HeygenClient.js`**
   - `generateVideo()` - Receives formatted prompt and sends to HeyGen API (lines 44-200)

### Test Files:
1. **`backend/tests/unit/infrastructure/ai/AvatarVideoValidation.test.js`**
   - Comprehensive validation tests
   - Ensures no OpenAI calls
   - Verifies pure function behavior

2. **`backend/tests/unit/infrastructure/ai/AIGenerationService.test.js`**
   - Avatar video generation tests
   - Validates HeyGen-only flow

---

## 🧪 Running Tests

```bash
# Run all avatar video validation tests
npm test -- AvatarVideoValidation

# Run specific test suite
npm test -- AIGenerationService.generateAvatarVideo

# Run with coverage
npm test -- --coverage AvatarVideoValidation
```

---

## 🚨 What Happens If This Rule Is Violated?

### Tests Will Fail:
```
❌ Avatar Video Validation - No OpenAI Script Generation
  ❌ generateAvatarVideo() - No OpenAI Script Generation
    ❌ should FAIL if OpenAI is called before HeyGen
      Expected: OpenAI not to be called
      Received: OpenAI.generateText was called 1 times
```

### Development Warnings:
- Console warnings if unexpected behavior is detected
- Validation errors in development/test environments

---

## 📝 Implementation Details

### `buildAvatarText()` - Pure Function
```javascript
buildAvatarText(lessonData = {}) {
  // ⚠️ CRITICAL: This function MUST NEVER call OpenAI or any LLM
  // Pure function: formats lesson data into text
  // Returns: formatted text for HeyGen
}
```

**Input:**
- `lessonTopic` - Topic name
- `lessonDescription` - Topic description
- `skillsList` - Array of skills
- `trainerRequestText` - Trainer prompt (if available)
- `transcriptText` - Video transcript (if available, takes priority)

**Output:**
- Formatted text string sent directly to HeyGen

**Logic:**
1. Sanitize input (prevent injection)
2. Format text from available components
3. Prioritize `transcriptText` over `trainerRequestText`
4. Fallback to default welcome message if no data

---

### `generateAvatarVideo()` - HeyGen Only
```javascript
async generateAvatarVideo(prompt, config = {}) {
  // ⚠️ CRITICAL: MUST NEVER call OpenAI for script generation
  // 1. Format prompt using buildAvatarText() (pure function)
  // 2. Send formatted text directly to HeyGen
  // 3. HeyGen generates narration independently
}
```

**Flow:**
1. Extract lesson data from prompt
2. Call `buildAvatarText(lessonData)` - **NO OpenAI**
3. Validate formatted text contains prompt components
4. Call `heygenClient.generateVideo(avatarText, config)` - **Direct HeyGen call**
5. Return video result

**Validation:**
- Checks that OpenAI was not called (development/test)
- Verifies text contains expected prompt components
- Ensures HeyGen receives our formatted prompt

---

## 🔄 Comparison with Other Formats

| Format | OpenAI Usage | HeyGen Usage |
|--------|--------------|--------------|
| **Avatar Video** | ❌ **NEVER** | ✅ **ONLY** |
| Text | ✅ Yes (GPT-4o) | ❌ No |
| Code | ✅ Yes (GPT-4o) | ❌ No |
| Presentation | ✅ Yes (Gamma API) | ❌ No |
| Audio | ✅ Yes (TTS + summarization) | ❌ No |
| Mind Map | ✅ Yes (Gemini/GPT-4o) | ❌ No |

---

## 🛡️ Safeguards for Future Developers

### 1. Clear Documentation
- JSDoc comments with ⚠️ CRITICAL warnings
- ❌ FORBIDDEN and ✅ REQUIRED lists
- This validation document

### 2. Code Structure
- Pure function design (`buildAvatarText`)
- Explicit flow separation
- No OpenAI client in avatar video path

### 3. Tests
- Comprehensive test suite
- Tests that fail if OpenAI is called
- Pure function validation

### 4. Runtime Checks
- Development warnings
- Text component validation
- Call tracking for testing

---

## ✅ Verification Checklist

When working with Avatar Video generation:

- [ ] `buildAvatarText()` does not call `openaiClient.generateText()`
- [ ] `generateAvatarVideo()` does not call `openaiClient.generateText()`
- [ ] Text sent to HeyGen contains `lessonTopic`, `lessonDescription`, `skills`, `trainer_prompt`/`transcript`
- [ ] No OpenAI summarization or rewriting occurs
- [ ] All tests pass (`AvatarVideoValidation.test.js`)
- [ ] Code comments include ⚠️ CRITICAL warnings

---

## 📚 Related Documentation

- **HeyGen API**: `backend/src/infrastructure/ai/HeygenClient.js`
- **Prompt Formatting**: `backend/src/infrastructure/ai/AIGenerationService.js` (buildAvatarText)
- **Content Generation Flow**: `backend/src/application/use-cases/GenerateContentUseCase.js`
- **Security**: `backend/src/infrastructure/security/PromptSanitizer.js`

---

## 🎯 Summary

**Avatar Video narration = HeyGen ONLY**

- ✅ Format our prompt (topic, description, skills, trainer_prompt/transcript)
- ✅ Send directly to HeyGen
- ✅ HeyGen generates narration independently
- ❌ NEVER use OpenAI for script generation
- ❌ NEVER forward OpenAI text to HeyGen

This rule is enforced by:
1. Code structure (pure functions, direct HeyGen calls)
2. Runtime validation (development/test checks)
3. Comprehensive tests (fail if violated)
4. Clear documentation (this document)

