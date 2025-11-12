# Content Data Cleaning Summary

## Overview
This document summarizes all redundant and duplicate fields removed from `content_data` JSON across all content formats in Content Studio.

---

## 🎯 Goal
Remove duplicate and redundant metadata from `content_data` JSON to:
- Eliminate data duplication (e.g., `audioText` identical to `text`)
- Remove redundant metadata already stored in relational tables (topics, skills, etc.)
- Keep only essential fields for display and playback

---

## 📊 Cleaning by Content Type

### 1. Text + Audio (Type ID: 1)

**Removed Fields:**
- ❌ `audioText` - Duplicate of `text` field
- ❌ `metadata.language` - Stored in `topics` table
- ❌ `metadata.skillsList` - Stored in `topic_skills` table
- ❌ `metadata.lessonTopic` - Stored in `topics.topic_name`
- ❌ `metadata.lessonDescription` - Stored in `topics.description`

**Kept Fields:**
- ✅ `text` - Main content text
- ✅ `audioUrl` - URL for audio playback
- ✅ `audioVoice` - Voice used for TTS
- ✅ `audioFormat` - Audio format (mp3, etc.)
- ✅ `audioDuration` - Duration in seconds

**Example:**
```json
// Before
{
  "text": "Welcome to today's lesson...",
  "audioUrl": "https://.../audio.mp3",
  "audioText": "Welcome to today's lesson...",  // ❌ Removed
  "metadata": {  // ❌ Removed
    "language": "English",
    "skillsList": [...],
    "lessonTopic": "...",
    "lessonDescription": "..."
  },
  "audioVoice": "alloy",
  "audioFormat": "mp3",
  "audioDuration": 166.8
}

// After
{
  "text": "Welcome to today's lesson...",
  "audioUrl": "https://.../audio.mp3",
  "audioVoice": "alloy",
  "audioFormat": "mp3",
  "audioDuration": 166.8
}
```

---

### 2. Code (Type ID: 2)

**Removed Fields:**
- ❌ `metadata.language` - Stored in `topics` table
- ❌ `metadata.skillsList` - Stored in `topic_skills` table
- ❌ `metadata.lessonTopic` - Stored in `topics.topic_name`
- ❌ `metadata.lessonDescription` - Stored in `topics.description`

**Kept Fields:**
- ✅ `code` - The code content
- ✅ `language` - Programming language (e.g., "javascript")
- ✅ `explanation` - Code explanation (if available)
- ✅ `metadata.programming_language` - Programming language metadata (essential)

**Example:**
```json
// Before
{
  "code": "function example() {...}",
  "language": "javascript",
  "explanation": "...",
  "metadata": {
    "programming_language": "javascript",
    "language": "English",  // ❌ Removed
    "skillsList": [...],    // ❌ Removed
    "lessonTopic": "...",   // ❌ Removed
    "lessonDescription": "..."  // ❌ Removed
  }
}

// After
{
  "code": "function example() {...}",
  "language": "javascript",
  "explanation": "...",
  "metadata": {
    "programming_language": "javascript"
  }
}
```

---

### 3. Presentation (Type ID: 3)

**Removed Fields:**
- ❌ `metadata.language` - Stored in `topics` table
- ❌ `metadata.skillsList` - Stored in `topic_skills` table
- ❌ `metadata.lessonTopic` - Stored in `topics.topic_name`
- ❌ `metadata.lessonDescription` - Stored in `topics.description`

**Kept Fields:**
- ✅ `presentation` - Presentation data structure
- ✅ `format` - Format type (e.g., "json")
- ✅ `slide_count` - Number of slides
- ✅ `googleSlidesUrl` - URL to Google Slides presentation
- ✅ `metadata.style` - Presentation style
- ✅ `metadata.generated_at` - Generation timestamp
- ✅ `metadata.googleSlidesUrl` - Google Slides URL in metadata

**Example:**
```json
// Before
{
  "presentation": {...},
  "format": "json",
  "slide_count": 10,
  "googleSlidesUrl": "https://...",
  "metadata": {
    "style": "educational",
    "generated_at": "2025-11-12T...",
    "googleSlidesUrl": "https://...",
    "language": "English",  // ❌ Removed
    "skillsList": [...],    // ❌ Removed
    "lessonTopic": "...",   // ❌ Removed
    "lessonDescription": "..."  // ❌ Removed
  }
}

// After
{
  "presentation": {...},
  "format": "json",
  "slide_count": 10,
  "googleSlidesUrl": "https://...",
  "metadata": {
    "style": "educational",
    "generated_at": "2025-11-12T...",
    "googleSlidesUrl": "https://..."
  }
}
```

---

### 4. Audio (Type ID: 4)

**Removed Fields:**
- ❌ `text` - Text that was converted to audio (not needed for playback)
- ❌ `audio` - Audio buffer (not needed, we have URL)
- ❌ `metadata.original_text_length` - Redundant technical info
- ❌ `metadata.converted_text_length` - Redundant technical info
- ❌ `metadata.word_count` - Redundant technical info
- ❌ `metadata.language` - Stored in `topics` table
- ❌ `metadata.skillsList` - Stored in `topic_skills` table

**Kept Fields:**
- ✅ `audioUrl` - URL for audio playback
- ✅ `audioVoice` - Voice used for TTS
- ✅ `audioFormat` - Audio format (mp3, etc.)
- ✅ `audioDuration` - Duration in seconds

**Example:**
```json
// Before
{
  "audioUrl": "https://.../audio.mp3",
  "audioVoice": "alloy",
  "audioFormat": "mp3",
  "audioDuration": 166.8,
  "text": "Welcome to...",  // ❌ Removed
  "audio": <Buffer>,        // ❌ Removed
  "metadata": {             // ❌ Removed
    "original_text_length": 500,
    "converted_text_length": 450,
    "word_count": 75,
    "language": "English"
  }
}

// After
{
  "audioUrl": "https://.../audio.mp3",
  "audioVoice": "alloy",
  "audioFormat": "mp3",
  "audioDuration": 166.8
}
```

---

### 5. Mind Map (Type ID: 5)

**Removed Fields:**
- ❌ `metadata.language` - Stored in `topics` table
- ❌ `metadata.skillsList` - Stored in `topic_skills` table
- ❌ `metadata.lessonTopic` - Stored in `topics.topic_name`
- ❌ `metadata.lessonDescription` - Stored in `topics.description`

**Kept Fields:**
- ✅ `nodes` - Mind map nodes array
- ✅ `edges` - Mind map edges array
- ✅ `root` - Root node (if exists)

**Example:**
```json
// Before
{
  "nodes": [...],
  "edges": [...],
  "root": {...},
  "metadata": {  // ❌ Removed
    "language": "English",
    "skillsList": [...],
    "lessonTopic": "...",
    "lessonDescription": "..."
  }
}

// After
{
  "nodes": [...],
  "edges": [...],
  "root": {...}
}
```

---

### 6. Avatar Video (Type ID: 6)

**Removed Fields:**
- ❌ `language` - Stored in `topics` table
- ❌ `fallback` - Technical flag, not needed for display
- ❌ `metadata.language` - Stored in `topics` table
- ❌ `metadata.error` - Error info (if null or not needed)
- ❌ `metadata.skillsList` - Stored in `topic_skills` table
- ❌ `metadata.lessonTopic` - Stored in `topics.topic_name`
- ❌ `metadata.lessonDescription` - Stored in `topics.description`

**Kept Fields:**
- ✅ `script` - Video script text
- ✅ `videoUrl` - URL for video playback
- ✅ `videoId` - Video ID
- ✅ `duration_seconds` - Video duration
- ✅ `status` - Generation status
- ✅ `metadata.heygen_video_url` - Heygen video URL
- ✅ `metadata.generation_status` - Generation status
- ✅ `metadata.storage_fallback` - Storage fallback flag

**Example:**
```json
// Before
{
  "script": "Welcome to...",
  "videoUrl": "https://.../video.mp4",
  "videoId": "video_123",
  "duration_seconds": 15,
  "status": "completed",
  "language": "en",  // ❌ Removed
  "fallback": false,  // ❌ Removed
  "metadata": {
    "heygen_video_url": "https://...",
    "generation_status": "completed",
    "storage_fallback": false,
    "language": "en",  // ❌ Removed
    "error": null,     // ❌ Removed
    "skillsList": [...],  // ❌ Removed
    "lessonTopic": "...",  // ❌ Removed
    "lessonDescription": "..."  // ❌ Removed
  }
}

// After
{
  "script": "Welcome to...",
  "videoUrl": "https://.../video.mp4",
  "videoId": "video_123",
  "duration_seconds": 15,
  "status": "completed",
  "metadata": {
    "heygen_video_url": "https://...",
    "generation_status": "completed",
    "storage_fallback": false
  }
}
```

---

## 🔧 Implementation

### Files Modified:
1. **`backend/src/application/utils/ContentDataCleaner.js`** (Created)
   - Utility class with cleaning methods for each content type
   - `cleanTextAudioData()` - Cleans text + audio format
   - `cleanCodeData()` - Cleans code format
   - `cleanPresentationData()` - Cleans presentation format
   - `cleanAudioData()` - Cleans audio-only format
   - `cleanMindMapData()` - Cleans mind map format
   - `cleanAvatarVideoData()` - Cleans avatar video format
   - `clean()` - Main method that routes to appropriate cleaner

2. **`backend/src/application/use-cases/GenerateContentUseCase.js`**
   - Updated to clean content_data before creating Content entity
   - Removed unused `metadata` variable

3. **`backend/src/application/use-cases/CreateContentUseCase.js`**
   - Updated to clean content_data when auto-generating audio

4. **`backend/src/application/use-cases/UpdateContentUseCase.js`**
   - Updated to clean content_data before updating

5. **`backend/src/application/services/ContentHistoryService.js`**
   - Updated to clean content_data before saving to history

6. **`backend/src/infrastructure/database/repositories/PostgreSQLContentRepository.js`**
   - Updated `saveRowToHistory()` to clean content_data before saving

---

## ✅ Benefits

1. **Reduced Storage**: Smaller JSON objects = less database storage
2. **No Duplication**: Data stored once in relational tables, not duplicated in JSON
3. **Consistency**: All content_data follows the same clean structure
4. **Maintainability**: Easier to understand and maintain code
5. **Performance**: Smaller JSON = faster queries and transfers

---

## 📝 Notes

- **Backward Compatibility**: Existing content with old structure will be cleaned when updated
- **History Preservation**: History entries are also cleaned to maintain consistency
- **Relational Data**: All topic/skill/language data remains accessible via JOIN queries
- **Essential Metadata**: Only metadata essential for display/playback is kept

---

**Last Updated**: 2025-11-12

