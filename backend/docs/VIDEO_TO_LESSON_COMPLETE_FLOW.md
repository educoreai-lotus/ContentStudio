# תיעוד מלא: תהליך Video to Lesson - מהעלאת סרטון עד יצירת 6 הפורמטים

## 📋 תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [API Endpoint](#api-endpoint)
3. [שלב 1: העלאת סרטון](#שלב-1-העלאת-סרטון)
4. [שלב 2: טרנסקריפציה](#שלב-2-טרנסקריפציה)
5. [שלב 3: בדיקת איכות (Quality Check)](#שלב-3-בדיקת-איכות-quality-check)
6. [שלב 4: יצירת 6 הפורמטים](#שלב-4-יצירת-6-הפורמטים)
7. [דיאגרמת זרימה](#דיאגרמת-זרימה)
8. [טבלת AI Models](#טבלת-ai-models)

---

## סקירה כללית

התהליך **Video to Lesson** הופך סרטון (YouTube URL או קובץ מועלה) לשיעור מלא עם 6 פורמטים של תוכן:

1. **Text & Audio** - טקסט + אודיו
2. **Code Examples** - דוגמאות קוד
3. **Presentation** - מצגת
4. **Audio** - אודיו בלבד
5. **Mind Map** - מפת מוח
6. **Avatar Video** - וידאו עם אווטאר

---

## API Endpoint

```
POST /api/video/transcribe
```

### Request Body

**אפשרות 1: YouTube URL**
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "topic_id": 123,
  "topic_name": "HTTP Protocol",
  "course_id": 456,
  "trainer_id": "trainer-123"
}
```

**אפשרות 2: File Upload**
```
Content-Type: multipart/form-data

file: [video file]
topic_id: 123
topic_name: "HTTP Protocol"
course_id: 456
trainer_id: "trainer-123"
```

### Response

```json
{
  "success": true,
  "data": {
    "transcript": {
      "text": "Hello, welcome to this lesson...",
      "source": "youtube-captions" | "whisper",
      "videoType": "youtube" | "upload",
      "videoId": "abc123" | null
    },
    "topic_id": 123,
    "content_formats": {
      "text_audio": { "content_id": 1, "generated": true },
      "code_examples": { "content_id": 2, "generated": true },
      "slides": { "content_id": 3, "generated": true },
      "audio": { "content_id": 4, "generated": true },
      "mind_map": { "content_id": 5, "generated": true },
      "avatar_video": { "content_id": 6, "generated": true }
    },
    "progress_events": [
      { "format": "text", "status": "completed", "message": "[AI] Completed: Text & Audio", "timestamp": "..." }
    ]
  },
  "message": "Video transcribed and all lesson formats generated successfully"
}
```

---

## שלב 1: העלאת סרטון

### מיקום: `VideoToLessonController.transcribe()`

**אפשרות A: YouTube URL**

```javascript
// VideoToLessonController.js:135-138
if (youtubeUrl) {
  transcriptionResult = await this.videoTranscriptionService.transcribeYouTube(youtubeUrl);
}
```

**אפשרות B: File Upload**

```javascript
// VideoToLessonController.js:139-145
else if (uploadedFile) {
  transcriptionResult = await this.videoTranscriptionService.transcribeUploadedFile(uploadedFile.path);
}
```

### Validation

- **YouTube URL**: חייבת להיות URL תקין של YouTube
- **File Upload**: 
  - מקסימום 100MB
  - פורמטים מותרים: `mp4, avi, mov, wmv, flv, webm, mkv`
  - שמירה ב-`uploads/videos/`

---

## שלב 2: טרנסקריפציה

### מיקום: `VideoTranscriptionService`

### 2.1. YouTube URL - עדיפות ראשונה: Captions

```javascript
// VideoTranscriptionService.js:346-382
async transcribeYouTube(youtubeUrl) {
  // 1. חילוץ Video ID
  const videoId = this.extractVideoId(youtubeUrl);
  
  // 2. ניסיון למשוך Captions (עדיפות ראשונה)
  // מנסה שפות: en → he → ar → auto
  const captionsResult = await this.fetchYouTubeCaptionsMultiLang(videoId);
  
  if (captionsResult) {
    return {
      transcript: captionsResult.transcript,
      source: 'youtube-captions',
      videoType: 'youtube',
      videoId
    };
  }
  
  // 3. Fallback: Whisper (אם אין captions)
  return await this.transcribeYouTubeWithWhisper(youtubeUrl, videoId);
}
```

**ספרייה:** `youtube-captions-scraper` (Node.js package)
```javascript
import { getSubtitles } from 'youtube-captions-scraper';

const subtitles = await getSubtitles({
  videoID: videoId,
  lang: 'en'
});
```

### 2.2. YouTube URL - Fallback: Whisper

```javascript
// VideoTranscriptionService.js:401-587
async transcribeYouTubeWithWhisper(youtubeUrl, videoId) {
  // 1. הורדת אודיו עם yt-dlp
  const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${youtubeUrl}"`;
  await execAsync(command);
  
  // 2. טרנסקריפציה עם Whisper
  const transcript = await this.transcribeWithWhisper(audioPath, { language: 'en' });
  
  return {
    transcript,
    source: 'whisper',
    videoType: 'youtube',
    videoId
  };
}
```

**כלים:**
- **yt-dlp**: כלי CLI (Python) - הורדת אודיו מ-YouTube
- **OpenAI Whisper API**: טרנסקריפציה של אודיו

### 2.3. Uploaded File

```javascript
// VideoTranscriptionService.js:597-702
async transcribeUploadedFile(videoFilePath) {
  // 1. בדיקת אודיו עם ffprobe
  const hasAudio = await detectAudioTrack(videoFilePath);
  if (!hasAudio) {
    throw new Error('Video has no audio track');
  }
  
  // 2. המרה ל-MP3 עם ffmpeg
  const mp3Path = await convertVideoToMp3(videoFilePath);
  
  // 3. טרנסקריפציה עם Whisper
  const transcript = await this.transcribeWithWhisper(mp3Path, { language: 'en' });
  
  return {
    transcript,
    source: 'whisper',
    videoType: 'upload'
  };
}
```

**כלים:**
- **ffprobe**: בדיקת מידע על קבצי מדיה (חלק מ-FFmpeg)
- **ffmpeg**: המרת וידאו ל-MP3
- **OpenAI Whisper API**: טרנסקריפציה

### 2.4. Whisper Transcription - טיפול בקבצים גדולים

```javascript
// VideoTranscriptionService.js:152-336
async transcribeWithWhisper(audioFilePath, options) {
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
  
  // אם קובץ > 25MB, חותך עם ffmpeg
  if (fileSize > MAX_FILE_SIZE) {
    // חותך ל-20 דקות ראשונות (conservative estimate)
    const command = `ffmpeg -y -i "${inputPath}" -t 1200 -acodec copy "${outputPath}"`;
    await execAsync(command);
    audioFileToUse = tempTrimmedFile;
  }
  
  // טרנסקריפציה עם Whisper
  const transcript = await this.openaiClient.transcribeAudio(fileStream, {
    language: options.language || 'en'
  });
  
  return transcript;
}
```

**הגבלות:**
- Whisper API: מקסימום 25MB
- אם גדול יותר: חיתוך אוטומטי ל-20 דקות ראשונות

---

## שלב 3: בדיקת איכות (Quality Check)

### מיקום: `VideoToLessonController.transcribe()` + `QualityCheckService`

### 3.1. איסוף מידע על Topic

```javascript
// VideoToLessonController.js:186-206
const topic = await this.topicRepository.findById(topic_id);
const course = await this.courseRepository.findById(topic.course_id);
const skills = Array.isArray(topic.skills) ? topic.skills : [topic.skills];
```

### 3.2. הערכת איכות עם GPT-4o

```javascript
// VideoToLessonController.js:209-215
const evaluationResult = await this.qualityCheckService.evaluateContentWithOpenAI({
  courseName: courseName || 'General Course',
  topicName: topic.topic_name || topic_name || 'Untitled Topic',
  skills: skills,
  contentText: transcriptText,
  statusMessages: null
});
```

**AI Model:** `GPT-4o` (לא GPT-4o-mini!)

**מה נבדק:**
1. **Relevance Score** (חייב >= 60)
   - האם התוכן רלוונטי לנושא?
   - האם התוכן תואם למיומנויות?
2. **Originality Score** (חייב >= 75)
   - האם התוכן מקורי?
   - האם יש העתקה/פלגיאט?
3. **Difficulty Alignment Score**
   - האם רמת הקושי תואמת?
4. **Consistency Score**
   - האם התוכן עקבי?

### 3.3. Validation & Rejection

```javascript
// VideoToLessonController.js:226-296
const relevanceScore = evaluationResult.relevance_score || 100;
if (relevanceScore < 60) {
  return res.status(400).json({
    success: false,
    error: 'Content is not relevant to the lesson topic',
    errorCode: 'QUALITY_CHECK_FAILED',
    quality_check: { relevance_score: relevanceScore, ... }
  });
}

if (evaluationResult.originality_score < 75) {
  return res.status(400).json({
    success: false,
    error: 'Content appears to be copied or plagiarized',
    errorCode: 'QUALITY_CHECK_FAILED',
    quality_check: { originality_score: evaluationResult.originality_score, ... }
  });
}
```

**אם נכשל:** התהליך נעצר, מחזיר 400 error

**אם עבר:** ממשיך ליצירת תוכן

---

## שלב 4: יצירת 6 הפורמטים

### מיקום: `ContentGenerationOrchestrator.generateAll()`

### 4.1. נרמול Transcript

```javascript
// ContentGenerationOrchestrator.js:65
const normalizedTranscript = this.normalizeTranscript(transcript);
// מנקה רווחים, תווים מיוחדים, וכו'
```

### 4.2. איסוף Metadata

```javascript
// ContentGenerationOrchestrator.js:72-83
let topicMetadata = await this.getTopicMetadata(topicId);

// אם חסר metadata, מחלץ מ-transcript
if (!topicMetadata.lessonTopic || !topicMetadata.lessonDescription) {
  const extractedMetadata = await this.extractMetadata(normalizedTranscript, options);
  topicMetadata = {
    lessonTopic: topicMetadata.lessonTopic || extractedMetadata.title,
    lessonDescription: normalizedTranscript.substring(0, 500) + '...',
    language: topicMetadata.language || extractedMetadata.language,
    skillsList: topicMetadata.skillsList || extractedMetadata.skills
  };
}
```

### 4.3. יצירת Generation Request

```javascript
// ContentGenerationOrchestrator.js:87-94
const generationRequestBase = {
  topic_id: topicId,
  lessonTopic: topicMetadata.lessonTopic,
  lessonDescription: normalizedTranscript, // TRANSCRIPT מחליף trainer prompt
  language: topicMetadata.language || 'English',
  skillsList: topicMetadata.skillsList || [],
  transcriptText: normalizedTranscript // עבור avatar video
};
```

### 4.4. יצירת 6 הפורמטים (Parallel)

```javascript
// ContentGenerationOrchestrator.js:97-323
const formats = [
  { id: 1, name: 'text', label: 'Text & Audio', contentType: 'text' },
  { id: 2, name: 'code', label: 'Code Examples', contentType: 'code' },
  { id: 3, name: 'presentation', label: 'Presentation Slides', contentType: 'presentation' },
  { id: 4, name: 'audio', label: 'Audio', contentType: 'audio' },
  { id: 5, name: 'mind_map', label: 'Mind Map', contentType: 'mind_map' },
  { id: 6, name: 'avatar_video', label: 'Avatar Video', contentType: 'avatar_video' }
];

// כל הפורמטים נוצרים במקביל (Promise.allSettled)
const progressPromises = formats.map(async (format) => {
  // 1. Emit progress: starting
  onProgress(format.name, 'starting', `[AI] Starting: ${format.label}`);
  
  // 2. Build generation request
  const generationRequest = {
    ...generationRequestBase,
    content_type_id: format.id
  };
  
  // 3. Generate content (עם timeout של 5 דקות)
  const generatedContent = await Promise.race([
    this.generateContentUseCase.execute(generationRequest),
    timeoutPromise // 5 minutes
  ]);
  
  // 4. Save to database
  const savedContent = await this.contentRepository.create(generatedContent);
  
  // 5. Emit progress: completed
  onProgress(format.name, 'completed', `[AI] Completed: ${format.label}`);
  
  return {
    content_id: savedContent.content_id,
    format: format.name,
    generated: true,
    content_data: savedContent.content_data
  };
});

const settledResults = await Promise.allSettled(progressPromises);
```

### 4.5. פירוט כל פורמט

#### פורמט 1: Text & Audio (`content_type_id: 1`)

**AI Model:** `GPT-4o`

**תהליך:**
```javascript
// GenerateContentUseCase.js → AIGenerationService.generateText()
1. יצירת prompt עם Security Instruction
2. קריאה ל-GPT-4o עם:
   - systemPrompt: Security Instruction + Language Preservation
   - userPrompt: Text generation prompt + transcript
3. יצירת אודיו עם TTS (OpenAI TTS-1)
4. העלאה ל-Supabase Storage
5. שמירה ב-database
```

**Output:**
```json
{
  "text": "HTTP, או Hypertext Transfer Protocol...",
  "audio_url": "https://supabase.co/storage/.../audio.mp3",
  "duration": 120,
  "voice": "alloy"
}
```

#### פורמט 2: Code Examples (`content_type_id: 2`)

**AI Model:** `GPT-4o`

**תהליך:**
```javascript
// GenerateContentUseCase.js → AIGenerationService.generateCode()
1. יצירת prompt עם Security Instruction
2. קריאה ל-GPT-4o עם:
   - systemPrompt: Security Instruction + "You are an expert programmer"
   - userPrompt: Code generation prompt + transcript
3. ניקוי ופורמט של הקוד
4. שמירה ב-database
```

**Output:**
```json
{
  "code": "const http = require('http');\nconst server = http.createServer(...);",
  "language": "javascript",
  "explanation": "This code creates an HTTP server..."
}
```

#### פורמט 3: Presentation (`content_type_id: 3`)

**AI Model:** `Gamma API` (לא OpenAI!)

**תהליך:**
```javascript
// GenerateContentUseCase.js → AIGenerationService.generatePresentation()
1. יצירת prompt עם Language Rules
2. קריאה ל-Gamma API עם:
   - inputText: Language Rules + transcript
   - textOptions: { language: 'he', amount: 'detailed', tone: 'professional' }
3. Polling עד שהמצגת מוכנה
4. הורדת PPTX
5. העלאה ל-Supabase Storage
6. שמירה ב-database
```

**Output:**
```json
{
  "presentation_url": "https://gamma.app/...",
  "pptx_url": "https://supabase.co/storage/.../presentation.pptx",
  "slide_count": 12
}
```

#### פורמט 4: Audio (`content_type_id: 4`)

**AI Model:** `OpenAI TTS-1` (לא GPT!)

**תהליך:**
```javascript
// GenerateContentUseCase.js → AIGenerationService.generateAudio()
1. ניקוי transcript (הסרת markers)
2. יצירת אודיו עם TTS-1
3. העלאה ל-Supabase Storage
4. שמירה ב-database
```

**Output:**
```json
{
  "audio_url": "https://supabase.co/storage/.../audio.mp3",
  "duration": 120,
  "voice": "alloy",
  "text": "Hello, welcome to this lesson..."
}
```

#### פורמט 5: Mind Map (`content_type_id: 5`)

**AI Model:** `Gemini Pro` (עדיפות ראשונה) או `GPT-4o` (fallback)

**תהליך:**
```javascript
// GenerateContentUseCase.js → AIGenerationService.generateMindMap()
1. ניסיון עם Gemini Pro ראשון
2. אם נכשל → Fallback ל-GPT-4o
3. יצירת prompt עם Security Instruction + Language Preservation
4. קריאה ל-AI עם:
   - prompt: Mind map generation prompt + transcript
   - temperature: 0.3 (נמוך יותר לדיוק)
5. Parsing JSON response
6. ניקוי ופורמט
7. שמירה ב-database
```

**Output:**
```json
{
  "nodes": [
    {
      "id": "core_http",
      "type": "concept",
      "data": {
        "label": "HTTP",
        "description": "Hypertext Transfer Protocol",
        "group": "core"
      },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "core_http",
      "target": "primary_methods",
      "type": "smoothstep",
      "label": "explains"
    }
  ]
}
```

#### פורמט 6: Avatar Video (`content_type_id: 6`)

**AI Model:** `HeyGen API` (לא OpenAI!)

**תהליך:**
```javascript
// GenerateContentUseCase.js → AIGenerationService.generateAvatarVideo()
1. ניקוי transcript (הסרת markers)
2. בחירת voice_id לפי שפה (מ-config/heygen-voices.json)
3. יצירת prompt (truncated ל-1500 תווים - מניעת 180s limit)
4. קריאה ל-HeyGen API:
   - video_inputs: { character: { avatar_id }, voice: { voice_id, input_text, language_code } }
5. Polling עד שהווידאו מוכן
6. הורדת וידאו מ-HeyGen
7. העלאה ל-Supabase Storage
8. שמירה ב-database
```

**Output:**
```json
{
  "videoUrl": "https://supabase.co/storage/.../avatar_video.mp4",
  "videoId": "abc123",
  "duration_seconds": 15,
  "metadata": {
    "heygen_video_url": "https://app.heygen.com/share/..."
  }
}
```

**הגבלות:**
- מקסימום 1500 תווים (מניעת 180s limit)
- אם avatar לא זמין → skipped
- אם נכשל → failed (אבל נשמר ב-database)

---

## דיאגרמת זרימה

```
┌─────────────────────────────────────────────────────────────┐
│                    POST /api/video/transcribe               │
│  Input: YouTube URL או File Upload + topic_id               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   שלב 1: טרנסקריפציה          │
        └───────────────┬───────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌───────────────┐
│ YouTube URL   │              │ Uploaded File │
└───────┬───────┘              └───────┬───────┘
        │                               │
        ▼                               ▼
┌───────────────────┐          ┌───────────────────┐
│ 1. Captions?      │          │ 1. ffprobe        │
│    ✓ → youtube-   │          │    (check audio)  │
│       captions-   │          │ 2. ffmpeg         │
│       scraper     │          │    (convert MP3)  │
│    ✗ → yt-dlp +  │          │ 3. Whisper        │
│       Whisper     │          │    (transcribe)   │
└─────────┬─────────┘          └─────────┬─────────┘
          │                               │
          └───────────────┬───────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Transcript Text     │
              └───────────┬───────────┘
                          │
                          ▼
        ┌───────────────────────────────┐
        │   שלב 2: Quality Check        │
        │   (GPT-4o)                    │
        └───────────────┬───────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌───────────────┐
│ Relevance < 60│              │ Originality   │
│ או            │              │ < 75          │
│ נכשל          │              │               │
└───────┬───────┘              └───────┬───────┘
        │                               │
        └───────────────┬───────────────┘
                        │
                        ▼
              ┌───────────────────────┐
              │   400 ERROR            │
              │   QUALITY_CHECK_FAILED │
              └───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   שלב 3: יצירת 6 הפורמטים     │
        │   (Parallel - Promise.allSettled)│
        └───────────────┬───────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────────┐          ┌───────────────────┐
│ 1. Text & Audio   │          │ 2. Code Examples  │
│    GPT-4o + TTS-1 │          │    GPT-4o         │
└─────────┬─────────┘          └─────────┬─────────┘
          │                               │
          ▼                               ▼
┌───────────────────┐          ┌───────────────────┐
│ 3. Presentation   │          │ 4. Audio          │
│    Gamma API      │          │    TTS-1          │
└─────────┬─────────┘          └─────────┬─────────┘
          │                               │
          ▼                               ▼
┌───────────────────┐          ┌───────────────────┐
│ 5. Mind Map       │          │ 6. Avatar Video   │
│    Gemini Pro /   │          │    HeyGen API     │
│    GPT-4o         │          │                    │
└─────────┬─────────┘          └─────────┬─────────┘
          │                               │
          └───────────────┬───────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Save to Database    │
              │   (All 6 formats)     │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   200 SUCCESS         │
              │   + content_formats   │
              └───────────────────────┘
```

---

## טבלת AI Models

| פורמט | AI Model / Service | מה עושה | מתי משתמשים |
|------|-------------------|---------|-------------|
| **Text & Audio** | GPT-4o + TTS-1 | יוצר טקסט + אודיו | תמיד |
| **Code Examples** | GPT-4o | יוצר דוגמאות קוד | תמיד |
| **Presentation** | Gamma API | יוצר מצגת | תמיד |
| **Audio** | TTS-1 | יוצר אודיו | תמיד |
| **Mind Map** | Gemini Pro / GPT-4o | יוצר מפת מוח | תמיד (Gemini עדיפות ראשונה) |
| **Avatar Video** | HeyGen API | יוצר וידאו עם אווטאר | תמיד (אם avatar זמין) |
| **Quality Check** | GPT-4o | בודק איכות | לפני יצירת תוכן |

---

## כלים חיצוניים (CLI Tools)

| כלי | תפקיד | מתי משתמשים |
|------|-------|-------------|
| **youtube-captions-scraper** | משיכת כתוביות מ-YouTube | YouTube URL (עדיפות ראשונה) |
| **yt-dlp** | הורדת אודיו מ-YouTube | YouTube URL (fallback) |
| **ffprobe** | בדיקת מידע על קבצים | Uploaded File (בדיקת אודיו) |
| **ffmpeg** | המרה/עריכה של מדיה | Uploaded File (המרה ל-MP3) + חיתוך קבצים גדולים |

---

## שגיאות נפוצות

### 1. Quality Check Failed

**סיבה:** Relevance < 60 או Originality < 75

**פתרון:** 
- ודא שהסרטון רלוונטי לנושא
- ודא שהתוכן מקורי

### 2. File Too Large (413)

**סיבה:** קובץ אודיו > 25MB (גבול Whisper)

**פתרון:** 
- המערכת חותכת אוטומטית ל-20 דקות ראשונות
- אם עדיין גדול, נסה קובץ קטן יותר

### 3. Avatar Video Failed

**סיבה:** Avatar לא זמין או שגיאה ב-HeyGen

**פתרון:**
- המערכת ממשיכה עם שאר הפורמטים
- Avatar Video נשמר כ-"failed" ב-database

### 4. Generation Timeout

**סיבה:** יצירת פורמט לקחה יותר מ-5 דקות

**פתרון:**
- הפורמט נכשל, אבל שאר הפורמטים ממשיכים
- נסה שוב מאוחר יותר

---

## סיכום

התהליך המלא:

1. **העלאת סרטון** → YouTube URL או File Upload
2. **טרנסקריפציה** → Captions (עדיפות) או Whisper (fallback)
3. **Quality Check** → GPT-4o (Relevance >= 60, Originality >= 75)
4. **יצירת 6 פורמטים** → Parallel generation עם timeout של 5 דקות לכל פורמט
5. **שמירה ב-Database** → כל הפורמטים נשמרים (גם אם נכשלו)

**זמן משוער:** 2-10 דקות (תלוי באורך הסרטון ומורכבות התוכן)

---

**עדכון אחרון:** 2025-01-22

