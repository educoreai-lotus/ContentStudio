# Presentation Generation Pipeline Refactor Summary

## Overview
Complete refactoring of the presentation generation pipeline to use Gamma API with text prompts, Supabase Storage, and VideoToLesson support.

## Flow: FRONTEND → BACKEND → GAMMA → SUPABASE STORAGE → DB RECORD

### 1. Frontend Request Format
```javascript
{
  topic_name: string,
  topic_description: string,
  skills: string[],
  trainer_prompt: string | null,  // May be NULL in VideoToLesson
  language: string,
  audience: string
}
```

### 2. Backend Processing
- **VideoToLesson Support**: If `trainer_prompt` is null/empty, uses `transcription` text
- **Security**: Applies `PromptSanitizer.sanitizePrompt()` on effective prompt
- **Prompt Building**: Creates text prompt for Gamma API (not JSON structure)

### 3. Gamma API Request
- Sends text prompt (not JSON slide structure)
- Handles file download if Gamma returns file URL/data
- Returns: `fileBuffer`, `presentationUrl`, `deckId`, `embedUrl`, `rawResponse`

### 4. Supabase Storage Upload
- Uploads presentation file to `presentations/` bucket
- Gets public URL
- Stores `storage_path` for database

### 5. Database Save
- Saves `storage_path` in `content_data`
- Stores metadata: `language`, `audience`, `skills`, `source` (prompt/video_transcription), `gamma_raw_response`

### 6. Frontend Response
```javascript
{
  success: true,
  presentation_url: publicUrl,
  storage_path: filePath
}
```

## Files Changed

### ✅ Created/Modified Files

1. **`backend/src/infrastructure/gamma/GammaClient.js`** (COMPLETELY REWRITTEN)
   - ❌ Removed: JSON slide structure building
   - ✅ Added: Text prompt support
   - ✅ Added: File download handling (from Gamma fileUrl or fileData)
   - ✅ Returns: `fileBuffer`, `fileUrl`, `presentationUrl`, `deckId`, `embedUrl`, `rawResponse`

2. **`backend/src/infrastructure/ai/AIGenerationService.js`**
   - 🔄 **Completely refactored `generatePresentation()` method:**
     - ✅ Accepts new data structure: `topic_name`, `topic_description`, `skills`, `trainer_prompt`, `transcription`, `language`, `audience`
     - ✅ **VideoToLesson Support**: Uses `transcription` if `trainer_prompt` is null/empty
     - ✅ **Security**: Sanitizes effective prompt with `PromptSanitizer.sanitizePrompt()`
     - ✅ **Text Prompt Building**: Creates structured text prompt for Gamma
     - ✅ **Supabase Upload**: Uploads file buffer to Supabase Storage
     - ✅ Returns: `presentationUrl`, `storagePath`, `deckId`, `embedUrl`, metadata
   - ✅ Added: `logger` import

3. **`backend/src/application/use-cases/GenerateContentUseCase.js`**
   - 🔄 Updated presentation generation case (case 3):
     - ✅ Extracts `trainer_prompt` and `transcription` from `generationRequest`
     - ✅ Builds content object with correct field names: `topic_name`, `topic_description`, `skills`, `trainer_prompt`, `transcription`, `language`, `audience`
     - ✅ Passes single object to `generatePresentation()` (no config parameter)
     - ✅ Updated response structure to include `storagePath`

4. **`backend/src/application/utils/ContentDataCleaner.js`**
   - 🔄 Updated `cleanPresentationData()` method:
     - ✅ Added: `storagePath` handling
     - ✅ Added: `source` metadata (prompt/video_transcription)
     - ✅ Added: `gamma_raw_response` metadata
     - ✅ Updated JSDoc comments

### ❌ Removed Code
- All Google Slides JSON structure building
- `_formatSlidesForGamma()` method (no longer needed)
- OpenAI prompt generation for slides

### ⚠️ Remaining References (Non-Critical)

1. **`backend/src/presentation/routes/debug.js`**
   - Still contains Google Drive debug endpoint
   - References `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_SLIDES_FOLDER_ID`
   - **Action**: Consider removing or updating to test Gamma API

## Key Changes

### Prompt Format (Before → After)

**Before (JSON Structure):**
```javascript
{
  title: topic,
  description: summary,
  content: {
    slides: [{ type: 'title', title: '...', subtitle: '...' }, ...]
  },
  metadata: { audience, language }
}
```

**After (Text Prompt):**
```
Create a professional presentation.

Topic: {topic_name}
Description: {topic_description}

Key Skills:
- {skill1}
- {skill2}

Trainer Notes / Source Material:
{sanitized_effective_prompt}

Language: {language}
Audience: {audience}

Produce a structured, polished slide deck.
```

### VideoToLesson Support

```javascript
const effectivePrompt = (trainer_prompt && trainer_prompt.trim().length > 0)
  ? trainer_prompt
  : (transcription || '');

// Then sanitize and use in Gamma prompt
const sanitizedPrompt = PromptSanitizer.sanitizePrompt(effectivePrompt);
```

### Storage Flow

1. Gamma returns file (URL or buffer)
2. Download file if URL provided
3. Upload to Supabase: `presentations/presentation_{timestamp}_{random}.pdf`
4. Get public URL
5. Store `storage_path` in database

### Database Schema

Content is saved with:
```javascript
{
  content_type: "presentation",
  content_data: {
    presentationUrl: "...",
    storagePath: "presentations/...",
    deckId: "...",
    embedUrl: "...",
    format: "gamma",
    metadata: {
      generated_at: "...",
      presentationUrl: "...",
      storagePath: "...",
      language: "en",
      audience: "general",
      skills: [...],
      source: "prompt" | "video_transcription",
      gamma_raw_response: {...}
    }
  },
  generation_method: "ai_full"
}
```

## Security

- ✅ All user input sanitized with `PromptSanitizer.sanitizePrompt()`
- ✅ Injection patterns removed
- ✅ Length limits enforced
- ✅ Special tokens removed

## Testing Status

- ✅ Syntax errors fixed
- ✅ No linter errors
- ⚠️ Manual testing required for:
  - Gamma API integration
  - Supabase upload
  - VideoToLesson transcription fallback
  - Frontend response format

## Environment Variables

- ✅ `GAMMA_API` - Required (Gamma API key)
- ✅ `GAMMA_API_URL` - Optional (defaults to `https://api.gamma.app`)
- ✅ `SUPABASE_URL` - Required for storage
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Required for storage
- ✅ `SUPABASE_BUCKET_NAME` - Optional (defaults to `media`, presentations go to `presentations/` subfolder)

## Breaking Changes

1. **API Format**: Changed from JSON structure to text prompt
2. **Input Parameters**: New structure required (`topic_name`, `topic_description`, etc.)
3. **Response Format**: Now includes `storagePath` and different metadata structure
4. **VideoToLesson**: Must pass `transcription` field for fallback

## Next Steps

1. ✅ Set `GAMMA_API` environment variable
2. ⚠️ Test Gamma API integration end-to-end
3. ⚠️ Verify Supabase storage upload works
4. ⚠️ Test VideoToLesson transcription fallback
5. ⚠️ Update frontend to use new response format
6. ⚠️ Update API documentation

## Summary

- **Files Modified**: 4
- **Files Created**: 0 (refactored existing)
- **Lines Removed**: ~150 (JSON structure code)
- **Lines Added**: ~200 (text prompt + storage logic)
- **Breaking Changes**: Yes (API format changed)
- **Security**: Enhanced (prompt sanitization)
- **VideoToLesson**: ✅ Fully supported
