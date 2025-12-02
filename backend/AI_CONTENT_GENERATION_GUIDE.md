# מדריך יצירת תוכן עם AI - Content Studio

## 📋 תוכן עניינים
1. [סקירה כללית](#סקירה-כללית)
2. [זרימת התהליך המלאה](#זרימת-התהליך-המלאה)
3. [קבצים מעורבים](#קבצים-מעורבים)
4. [סוגי תוכן נתמכים](#סוגי-תוכן-נתמכים)
5. [AI Providers](#ai-providers)
6. [פרטים טכניים](#פרטים-טכניים)

---

## 🎯 סקירה כללית

**תהליך יצירת תוכן עם AI:**
1. Frontend שולח בקשה ל-API
2. Route מפנה ל-Controller
3. Controller בונה בקשה ומעביר ל-Use Case
4. Use Case בונה prompt ומעביר ל-AI Service
5. AI Service קורא ל-AI Provider (OpenAI/Gemini/HeyGen/Gamma)
6. התוכן שנוצר נשמר ב-DB דרך CreateContentUseCase

---

## 🔄 זרימת התהליך המלאה

### שלב 1: Request מהמשתמש
```
POST /api/content/generate/text
POST /api/content/generate/code
POST /api/content/generate/presentation
POST /api/content/generate/audio
POST /api/content/generate/mind-map
POST /api/content/generate/avatar-video
```

**Body:**
```json
{
  "topic_id": 123,
  "content_type_id": 1,  // או 'text', 'code', וכו'
  "lessonTopic": "Python Basics",
  "lessonDescription": "Introduction to Python",
  "language": "en",
  "skillsList": ["Python", "Programming"],
  "prompt": "Optional custom prompt",
  "template_id": 456,  // אופציונלי
  "voice": "alloy",  // לאודיו
  "programming_language": "javascript"  // לקוד
}
```

---

### שלב 2: Route - `routes/ai-generation.js`

**תפקיד:**
- מגדיר endpoints לכל סוג תוכן
- מאתחל services (AI, Quality Check, Repositories)
- מפנה ל-Controller

**קבצים:**
- `backend/src/presentation/routes/ai-generation.js`

**Endpoints:**
```javascript
POST /api/content/generate          → controller.generate()
POST /api/content/generate/text      → controller.generateText()
POST /api/content/generate/code      → controller.generateCode()
POST /api/content/generate/presentation → controller.generatePresentation()
POST /api/content/generate/audio    → controller.generateAudio()
POST /api/content/generate/mind-map → controller.generateMindMap()
POST /api/content/generate/avatar-video → controller.generateAvatarVideo()
```

**מה קורה:**
1. מאתחל `AIGenerationService` עם API keys
2. מאתחל `QualityCheckService` (אם OpenAI זמין)
3. מאתחל `PromptTemplateService`
4. יוצר `AIGenerationController`
5. מפנה את הבקשה ל-Controller

---

### שלב 3: Controller - `AIGenerationController.js`

**תפקיד:**
- ולידציה של הבקשה
- בניית בקשה ל-generation
- טיפול בשגיאות
- החזרת תשובה למשתמש

**קובץ:**
- `backend/src/presentation/controllers/AIGenerationController.js`

**מה קורה:**

#### 3.1. ולידציה
```javascript
validateBody(body, contentTypeOverride) {
  if (!body.topic_id) {
    throw new Error('Missing required fields: topic_id');
  }
  if (!body.content_type_id && !contentTypeOverride) {
    throw new Error('Missing required fields: content_type_id');
  }
}
```

#### 3.2. בניית בקשה
```javascript
buildGenerationRequest(req, contentType) {
  // ממיר skillsList למערך
  // בונה lessonTopic, lessonDescription
  // מנרמל language, skills
  // מחזיר אובייקט עם כל הנתונים
}
```

#### 3.3. טיפול בבקשה
```javascript
async handleGeneration(req, res, next, contentTypeOverride) {
  // 1. ולידציה
  this.validateBody(req.body, contentTypeOverride);
  
  // 2. אם חסרים נתונים - טוען מ-topic
  if (!req.body.lessonTopic || !req.body.lessonDescription) {
    const topic = await topicRepository.findById(req.body.topic_id);
    req.body.lessonTopic = topic.topic_name;
    req.body.lessonDescription = topic.description;
    req.body.skillsList = topic.skills;
  }
  
  // 3. בונה בקשה
  const generationRequest = this.buildGenerationRequest(req, contentTypeOverride);
  
  // 4. קורא ל-Use Case
  const content = await this.generateContentUseCase.execute(generationRequest);
  
  // 5. מטפל בשגיאות (בעיקר avatar_video)
  // 6. מחזיר תשובה
  res.status(201).json({
    success: true,
    data: ContentDTO.toContentResponse(content),
  });
}
```

---

### שלב 4: Use Case - `GenerateContentUseCase.js`

**תפקיד:**
- בניית prompt
- קריאה ל-AI Service
- עיבוד התוצאה
- יצירת Content Entity (לא נשמר ב-DB עדיין!)

**קובץ:**
- `backend/src/application/use-cases/GenerateContentUseCase.js`

**מה קורה:**

#### 4.1. ולידציה
```javascript
async execute(generationRequest) {
  // בודק topic_id, content_type_id
  // בודק אם סוג תוכן נתמך
}
```

#### 4.2. בניית prompt variables
```javascript
buildPromptVariables(generationRequest, contentTypeId) {
  // מנקה ומסניטיזר את כל המשתנים
  // ממיר skills למערך
  // מחזיר משתנים נקיים
}
```

#### 4.3. בניית prompt
```javascript
buildPrompt(contentTypeId, variables) {
  // בונה prompt לפי סוג תוכן
  // משתמש ב-PROMPT_BUILDERS
  // מוסיף security instructions
}
```

#### 4.4. טיפול ב-template (אם יש)
```javascript
if (generationRequest.template_id) {
  const template = await this.promptTemplateService.getTemplate(template_id);
  prompt = template.render({ ...promptVariables, ...template_variables });
}
```

#### 4.5. יצירת תוכן לפי סוג

**Text (type 1):**
```javascript
case 1: {
  // 1. יוצר טקסט עם OpenAI
  const text = await this.aiGenerationService.generateText(prompt, {
    language: promptVariables.language,
  });
  
  // 2. יוצר אודיו אוטומטית לטקסט
  const audioData = await this.aiGenerationService.generateAudio(text, {
    voice: 'alloy',
    model: 'tts-1',
    format: 'mp3',
    language: promptVariables.language,
  });
  
  // 3. בונה content_data
  contentData = {
    text,
    audioUrl: audioData.audioUrl,
    audioFormat: audioData.format,
    audioDuration: audioData.duration,
    audioVoice: audioData.voice,
  };
  break;
}
```

**Code (type 2):**
```javascript
case 2: {
  // 1. יוצר קוד עם OpenAI
  const codeResult = await this.aiGenerationService.generateCode(prompt, language, {
    include_comments: generationRequest.include_comments !== false,
  });
  
  // 2. בונה content_data
  contentData = {
    ...codeResult,
    metadata: {
      programming_language: language,
    },
  };
  break;
}
```

**Presentation (type 3):**
```javascript
case 3: {
  // 1. בונה content object ל-Gamma API
  const presentationContent = {
    topicName: promptVariables.lessonTopic,
    topicDescription: promptVariables.lessonDescription,
    skills: promptVariables.skillsListArray,
    trainerPrompt: promptVariables.trainerRequestText,
    transcriptText: promptVariables.transcriptText,
    audience: generationRequest.audience || 'general',
    language: promptVariables.language,
  };
  
  // 2. בדיקת איכות (אם יש trainerPrompt)
  if (this.qualityCheckService && presentationContent.trainerPrompt) {
    const evaluationResult = await this.qualityCheckService.evaluateContentWithOpenAI({
      courseName,
      topicName,
      skills,
      contentText: presentationContent.trainerPrompt,
    });
    
    // בודק relevance >= 60, originality >= 75
    if (relevanceScore < 60 || originalityScore < 75) {
      throw new Error('Quality check failed');
    }
  }
  
  // 3. יוצר מצגת עם Gamma API
  const presentation = await this.aiGenerationService.generatePresentation(presentationContent, {
    language: promptVariables.language,
    audience: generationRequest.audience || 'general',
  });
  
  // 4. בונה content_data
  contentData = {
    format: presentation.format || 'gamma',
    presentationUrl: presentation.presentationUrl,  // Supabase Storage URL
    storagePath: presentation.storagePath,
    metadata: {
      source: presentation.metadata?.source,
      audience: presentation.metadata?.audience,
      language: presentation.metadata?.language,
    },
  };
  break;
}
```

**Audio (type 4):**
```javascript
case 4: {
  // 1. יוצר אודיו עם OpenAI TTS
  const audio = await this.aiGenerationService.generateAudio(prompt, {
    voice: generationRequest.voice || 'alloy',
    model: generationRequest.tts_model || 'tts-1',
    format: generationRequest.audio_format || 'mp3',
    language: promptVariables.language,
  });
  
  // 2. בונה content_data
  contentData = {
    audioUrl: audio.audioUrl,
    audioFormat: audio.format,
    audioDuration: audio.duration,
    audioVoice: audio.voice,
  };
  break;
}
```

**Mind Map (type 5):**
```javascript
case 5: {
  // 1. בונה prompt (משתמש ב-transcript)
  const mindMapPrompt = prompt || promptVariables.lessonDescription || promptVariables.transcriptText;
  
  // 2. יוצר mind map עם OpenAI
  const mindMap = await this.aiGenerationService.generateMindMap(mindMapPrompt, {
    topic_title: promptVariables.lessonTopic,
    skills: promptVariables.skillsListArray,
    trainer_prompt: promptVariables.trainerRequestText,
    language: promptVariables.language,
    lessonDescription: promptVariables.lessonDescription,
  });
  
  // 3. בונה content_data
  contentData = ContentDataCleaner.cleanMindMapData(mindMap);
  break;
}
```

**Avatar Video (type 6):**
```javascript
case 6: {
  // ⚠️ CRITICAL: לא משתמש ב-OpenAI ל-script generation!
  // משתמש רק ב-HeyGen עם ה-prompt של המשתמש
  
  // 1. בונה lesson data
  const lessonData = {
    prompt: generationRequest.prompt || promptVariables.trainerRequestText || promptVariables.transcriptText,
    lessonTopic: promptVariables.lessonTopic,
  };
  
  // 2. יוצר avatar video עם HeyGen
  const avatarResult = await this.aiGenerationService.generateAvatarVideo(lessonData, {
    language: promptVariables.language,
    topicName: promptVariables.lessonTopic,
  });
  
  // 3. מטפל ב-status (skipped, failed, success)
  if (avatarResult.status === 'skipped') {
    contentData = {
      script: avatarResult.script || null,
      videoUrl: null,
      videoId: null,
      status: 'skipped',
      reason: avatarResult.reason || 'forced_avatar_unavailable',
    };
  } else if (avatarResult.status === 'failed') {
    contentData = {
      script: avatarResult.script || null,
      videoUrl: null,
      videoId: avatarResult.videoId || null,
      error: avatarResult.error || 'Avatar video generation failed',
      errorCode: avatarResult.errorCode || 'UNKNOWN_ERROR',
      reason: avatarResult.reason,
    };
  } else {
    contentData = ContentDataCleaner.cleanAvatarVideoData(avatarResult);
  }
  break;
}
```

#### 4.6. ניקוי content_data
```javascript
const cleanedContentData = ContentDataCleaner.clean(contentData, generationRequest.content_type_id);
```

#### 4.7. יצירת Content Entity (לא נשמר!)
```javascript
const content = new Content({
  topic_id: generationRequest.topic_id,
  content_type_id: generationRequest.content_type_id,
  content_data: cleanedContentData,
  generation_method_id: 'ai_assisted',
});

// מחזיר את התוכן ל-preview (לא נשמר ב-DB עדיין!)
return content;
```

---

### שלב 5: AI Service - `AIGenerationService.js`

**תפקיד:**
- ממשק אחיד לכל ה-AI Providers
- מטפל בכל סוגי התוכן
- שומר קבצים ב-Supabase Storage

**קובץ:**
- `backend/src/infrastructure/ai/AIGenerationService.js`

**AI Providers:**
- `OpenAIClient` - GPT-4o, Whisper, TTS
- `GeminiClient` - Gemini Pro
- `HeygenClient` - Avatar videos
- `GammaClient` - Presentations

**מה קורה:**

#### 5.1. generateText()
```javascript
async generateText(prompt, config = {}) {
  // 1. ולידציה של שפה
  const languageValidation = getValidatedLanguage(config.language);
  
  // 2. סניטיזציה של prompt
  const sanitizedPrompt = PromptSanitizer.sanitizePrompt(prompt);
  const wrappedPrompt = PromptSanitizer.wrapUserInput(sanitizedPrompt);
  
  // 3. בניית system prompt
  const systemPrompt = this.buildSystemPrompt('text', config, language);
  const fullPrompt = this.buildTextPrompt(wrappedPrompt, config, language);
  
  // 4. קריאה ל-OpenAI
  return await this.openaiClient.generateText(fullPrompt, {
    systemPrompt,
    temperature: config.temperature || 0.7,
    max_tokens: config.max_tokens || 2000,
  });
}
```

#### 5.2. generateCode()
```javascript
async generateCode(prompt, language = 'javascript', config = {}) {
  // 1. סניטיזציה
  const sanitizedPrompt = PromptSanitizer.sanitizePrompt(prompt);
  const sanitizedLanguage = PromptSanitizer.sanitizeString(language, 'language');
  
  // 2. בניית prompt
  const systemPrompt = `You are an expert ${sanitizedLanguage} programmer...`;
  const fullPrompt = `Generate ${sanitizedLanguage} code...`;
  
  // 3. קריאה ל-OpenAI
  const generatedCode = await this.openaiClient.generateText(fullPrompt, {
    systemPrompt,
    temperature: config.temperature || 0.3,
    max_tokens: config.max_tokens || 3000,
  });
  
  return {
    code: generatedCode,
    language: sanitizedLanguage,
    explanation: config.include_explanation ? ... : null,
  };
}
```

#### 5.3. generatePresentation()
```javascript
async generatePresentation(contentData, config = {}) {
  // 1. בונה prompt ל-Gamma API
  const gammaPrompt = this.buildGammaPrompt(contentData, config);
  
  // 2. קורא ל-Gamma API
  const gammaResult = await this.gammaClient.createPresentation(gammaPrompt);
  
  // 3. מוריד את המצגת מ-Gamma
  const presentationBuffer = await this.downloadPresentation(gammaResult.presentationUrl);
  
  // 4. שומר ב-Supabase Storage
  const storageResult = await this.storageClient.uploadFile(
    presentationBuffer,
    `presentations/${timestamp}-${randomStr}.pdf`,
    'application/pdf'
  );
  
  return {
    format: 'gamma',
    presentationUrl: storageResult.url,  // Supabase URL
    storagePath: storageResult.path,
    metadata: {
      source: contentData.trainerPrompt ? 'prompt' : 'video_transcription',
      audience: config.audience || 'general',
      language: config.language,
      gamma_generation_id: gammaResult.id,
    },
  };
}
```

#### 5.4. generateAudio()
```javascript
async generateAudio(text, config = {}) {
  // 1. ולידציה של שפה וקול
  const language = getValidatedLanguage(config.language);
  const voice = getTTSVoiceForLanguage(language.language, config.voice);
  
  // 2. בניית prompt עם שמירת שפה
  const languageInstruction = buildLanguagePreservationInstruction(language.language);
  const fullText = `${languageInstruction}\n\n${text}`;
  
  // 3. קריאה ל-OpenAI TTS
  const audioBuffer = await this.ttsClient.generateSpeech(fullText, {
    voice: voice.voice_id,
    model: config.model || 'tts-1',
    format: config.format || 'mp3',
  });
  
  // 4. שומר ב-Supabase Storage
  const storageResult = await this.storageClient.uploadFile(
    audioBuffer,
    `audio/${timestamp}-${randomStr}.mp3`,
    'audio/mpeg'
  );
  
  return {
    audioUrl: storageResult.url,
    format: config.format || 'mp3',
    duration: audioBuffer.duration,
    voice: voice.voice_id,
    sha256Hash: storageResult.sha256Hash,
    digitalSignature: storageResult.digitalSignature,
  };
}
```

#### 5.5. generateMindMap()
```javascript
async generateMindMap(prompt, config = {}) {
  // 1. בונה prompt ל-OpenAI
  const systemPrompt = `You are an expert mind map creator...`;
  const fullPrompt = `Create a mind map for: ${prompt}`;
  
  // 2. קריאה ל-OpenAI
  const mindMapText = await this.openaiClient.generateText(fullPrompt, {
    systemPrompt,
    temperature: 0.7,
    max_tokens: 2000,
  });
  
  // 3. ממיר ל-JSON structure
  const mindMapData = this.parseMindMapText(mindMapText);
  
  return {
    nodes: mindMapData.nodes,
    edges: mindMapData.edges,
    metadata: {
      topic_title: config.topic_title,
      skills: config.skills,
      language: config.language,
    },
  };
}
```

#### 5.6. generateAvatarVideo()
```javascript
async generateAvatarVideo(lessonData, config = {}) {
  // ⚠️ CRITICAL: לא משתמש ב-OpenAI!
  // משתמש רק ב-HeyGen עם ה-prompt של המשתמש
  
  // 1. בונה טקסט ל-avatar (לא משנה את ה-prompt!)
  const avatarText = this.buildAvatarText(lessonData.prompt, config);
  
  // 2. ולידציה של avatar ו-voice
  const avatarId = getSafeAvatarId();
  const voiceConfig = getVoiceConfig(config.language);
  
  if (!voiceConfig || !isTTSVoiceAvailable(voiceConfig.voice_id)) {
    return {
      status: 'skipped',
      reason: 'voice_not_available',
      script: avatarText,
    };
  }
  
  // 3. קורא ל-HeyGen API
  const heygenResult = await this.heygenClient.createVideo({
    title: config.topicName || 'Avatar Video',
    prompt: lessonData.prompt,  // ה-prompt המקורי של המשתמש
    video_inputs: [{
      character: avatarId,
      voice: {
        voice_id: voiceConfig.voice_id,
        input_text: avatarText,
      },
    }],
  });
  
  // 4. מוריד את הווידאו מ-HeyGen
  const videoBuffer = await this.downloadVideo(heygenResult.videoUrl);
  
  // 5. שומר ב-Supabase Storage
  const storageResult = await this.storageClient.uploadFile(
    videoBuffer,
    `avatar-videos/${timestamp}-${randomStr}.mp4`,
    'video/mp4'
  );
  
  return {
    script: avatarText,
    videoUrl: storageResult.url,
    videoId: heygenResult.videoId,
    metadata: {
      avatar_id: avatarId,
      voice_id: voiceConfig.voice_id,
      language: config.language,
    },
  };
}
```

---

### שלב 6: AI Clients

#### 6.1. OpenAIClient
**קובץ:** `backend/src/infrastructure/external-apis/openai/OpenAIClient.js`

**תפקיד:**
- תקשורת עם OpenAI API
- GPT-4o ל-text generation
- Whisper ל-transcription
- Vision API ל-OCR

**מתודות:**
- `generateText(prompt, options)` - GPT-4o
- `transcribeAudio(audioFile, options)` - Whisper
- `extractTextFromImage(imageBase64)` - Vision API

#### 6.2. TTSClient
**קובץ:** `backend/src/infrastructure/external-apis/openai/TTSClient.js`

**תפקיד:**
- Text-to-Speech עם OpenAI TTS
- שומר קבצי אודיו ב-Supabase Storage

**מתודות:**
- `generateSpeech(text, options)` - TTS

#### 6.3. GeminiClient
**קובץ:** `backend/src/infrastructure/external-apis/gemini/GeminiClient.js`

**תפקיד:**
- תקשורת עם Google Gemini API
- חלופה ל-OpenAI

#### 6.4. HeygenClient
**קובץ:** `backend/src/infrastructure/ai/HeygenClient.js`

**תפקיד:**
- יצירת avatar videos עם HeyGen API
- ולידציה של avatar ו-voice
- הורדה ושמירה ב-Supabase Storage

**מתודות:**
- `createVideo(videoData)` - יצירת וידאו
- `validateAvatar()` - ולידציה של avatar

#### 6.5. GammaClient
**קובץ:** `backend/src/infrastructure/gamma/GammaClient.js`

**תפקיד:**
- יצירת מצגות עם Gamma API
- הורדה ושמירה ב-Supabase Storage

**מתודות:**
- `createPresentation(prompt)` - יצירת מצגת

---

### שלב 7: שמירה ב-DB - `CreateContentUseCase.js`

**תפקיד:**
- שמירת תוכן ב-DB
- בדיקת איכות (למקרה של manual content)
- ולידציה של שפה
- יצירת היסטוריה

**קובץ:**
- `backend/src/application/use-cases/CreateContentUseCase.js`

**מה קורה:**
1. ולידציה של שפה (למקרה של manual content)
2. בדיקת איכות (למקרה של manual content)
3. שמירה ב-DB
4. יצירת היסטוריה
5. החזרת תוכן

---

## 📁 קבצים מעורבים

### Routes
- `backend/src/presentation/routes/ai-generation.js` - מגדיר endpoints

### Controllers
- `backend/src/presentation/controllers/AIGenerationController.js` - מטפל בבקשות

### Use Cases
- `backend/src/application/use-cases/GenerateContentUseCase.js` - לוגיקה של יצירה
- `backend/src/application/use-cases/CreateContentUseCase.js` - שמירה ב-DB

### Services
- `backend/src/infrastructure/ai/AIGenerationService.js` - ממשק ל-AI Providers
- `backend/src/infrastructure/services/PromptTemplateService.js` - ניהול templates

### AI Clients
- `backend/src/infrastructure/external-apis/openai/OpenAIClient.js` - OpenAI
- `backend/src/infrastructure/external-apis/openai/TTSClient.js` - TTS
- `backend/src/infrastructure/external-apis/gemini/GeminiClient.js` - Gemini
- `backend/src/infrastructure/ai/HeygenClient.js` - HeyGen
- `backend/src/infrastructure/gamma/GammaClient.js` - Gamma

### Utilities
- `backend/src/infrastructure/security/PromptSanitizer.js` - סניטיזציה
- `backend/src/application/utils/ContentDataCleaner.js` - ניקוי נתונים
- `backend/src/infrastructure/ai/LanguageValidator.js` - ולידציה של שפה

### Storage
- `backend/src/infrastructure/storage/SupabaseStorageClient.js` - שמירת קבצים

---

## 🎨 סוגי תוכן נתמכים

| Type | ID | AI Provider | מה נוצר |
|------|-----|-------------|---------|
| Text | 1 | OpenAI GPT-4o | טקסט + אודיו אוטומטי |
| Code | 2 | OpenAI GPT-4o | קוד + הסבר |
| Presentation | 3 | Gamma API | מצגת PDF |
| Audio | 4 | OpenAI TTS | קובץ אודיו MP3 |
| Mind Map | 5 | OpenAI GPT-4o | מפת חשיבה JSON |
| Avatar Video | 6 | HeyGen API | סרטון אווטר MP4 |

---

## 🤖 AI Providers

### OpenAI
- **GPT-4o** - Text, Code, Mind Map
- **Whisper** - Transcription
- **TTS** - Text-to-Speech
- **Vision API** - OCR

### Gemini
- **Gemini Pro** - חלופה ל-OpenAI

### HeyGen
- **Avatar Videos** - סרטוני אווטר

### Gamma
- **Presentations** - מצגות PDF

---

## 🔧 פרטים טכניים

### Prompt Sanitization
- כל ה-prompts עוברים סניטיזציה
- משתמש ב-`PromptSanitizer.sanitizePrompt()`
- מוסיף security instructions

### Language Validation
- כל תוכן עובר ולידציה של שפה
- משתמש ב-`LanguageValidator.getValidatedLanguage()`
- בודק אם voice זמין לשפה

### Content Data Cleaning
- כל `content_data` עובר ניקוי
- משתמש ב-`ContentDataCleaner.clean()`
- מסיר metadata מיותר

### Storage
- כל הקבצים נשמרים ב-Supabase Storage
- כולל hash ו-signature לבדיקת integrity
- URLs תמיד מ-Supabase, לא מ-AI providers

---

## ⚠️ הערות חשובות

1. **Avatar Video לא משתמש ב-OpenAI** - רק HeyGen עם ה-prompt המקורי
2. **Text יוצר אודיו אוטומטית** - לא צריך ליצור אודיו בנפרד
3. **Presentation עובר quality check** - אם יש trainerPrompt
4. **כל הקבצים נשמרים ב-Supabase** - לא משתמשים ב-URLs חיצוניים
5. **Content לא נשמר ב-DB עד approval** - רק preview

---

**עודכן לאחרונה:** 2025-01-29

