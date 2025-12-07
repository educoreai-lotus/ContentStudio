# רשימת משתני הסביבה המלאה של Railway

רשימה מקיפה של כל משתני הסביבה (Environment Variables) המשמשים ב-Content Studio Backend ב-Railway.

## 📋 קטגוריות משתני הסביבה

### 🔴 חובה (Required) - ללא אלה השרת לא יעבוד

#### Database
- **`DATABASE_URL`** - כתובת חיבור ל-PostgreSQL
  - דוגמה: `postgresql://user:password@host:5432/database`
  - שימוש: `DatabaseConnection.js`

#### Supabase Storage
- **`SUPABASE_URL`** - כתובת הפרויקט ב-Supabase
  - דוגמה: `https://xxxxx.supabase.co`
  - שימוש: `SupabaseStorageClient.js`, `AvatarVideoStorageService.js`

- **`SUPABASE_SERVICE_ROLE_KEY`** - מפתח Service Role (לפעולות backend)
  - שימוש: `SupabaseStorageClient.js`, `AvatarVideoStorageService.js`

#### Coordinator Integration
- **`COORDINATOR_URL`** - כתובת שירות Coordinator
  - דוגמה: `https://coordinator-production.railway.app`
  - שימוש: `coordinatorClient.js`, `register.js`

- **`SERVICE_ENDPOINT`** - כתובת השירות הנוכחי (Content Studio)
  - דוגמה: `https://content-studio-production.railway.app`
  - שימוש: `register.js` (רישום שירות)

- **`CS_COORDINATOR_PRIVATE_KEY`** - מפתח פרטי ECDSA לחתימת בקשות
  - שימוש: `coordinatorClient.js`, `register.js`
  - נוצר על ידי: `scripts/generate-ecdsa-keys.js`

#### AI Services
- **`OPENAI_API_KEY`** - מפתח API של OpenAI (GPT, Whisper, TTS)
  - שימוש: `OpenAIClient.js`, `TTSClient.js`, `WhisperClient.js`, `AIGenerationService.js`

---

### 🟡 אופציונלי (Optional) - עם fallback או ערכי ברירת מחדל

#### Supabase
- **`SUPABASE_ANON_KEY`** - מפתח Anonymous (fallback)
  - שימוש: `multilingual.js` (fallback)

- **`SUPABASE_BUCKET_NAME`** - שם ה-bucket (ברירת מחדל: `media`)
  - שימוש: `SupabaseStorageClient.js`, `AvatarVideoStorageService.js`
  - ברירת מחדל: `media`

- **`SUPABASE_KEY`** - alias ל-`SUPABASE_SERVICE_ROLE_KEY` (fallback)
  - שימוש: `SupabaseStorageClient.js`

- **`SUPABASE_SECRET_KEY`** - alias ל-`SUPABASE_SERVICE_ROLE_KEY` (fallback)
  - שימוש: `SupabaseStorageClient.js`

#### AI Services - Gemini
- **`GEMINI_API_KEY`** - מפתח API של Gemini (מועדף)
  - שימוש: `GeminiClient.js`, `AIGenerationService.js`
  - fallback: `GOOGLE_API_KEY` או `Gemini_API_Key`

- **`GOOGLE_API_KEY`** - מפתח API של Google (fallback ל-Gemini)
  - שימוש: `GeminiClient.js` (fallback)

- **`Gemini_API_Key`** - alias נוסף ל-Gemini API Key (Railway format)
  - שימוש: `ai-generation.js`, `multilingual.js` (fallback)

#### AI Services - HeyGen
- **`HEYGEN_API_KEY`** - מפתח API של HeyGen (לדור עתידי)
  - שימוש: `HeygenClient.js`, `VideoTranscriptionService.js`

#### Google Services (עתידי)
- **`GOOGLE_CLIENT_ID`** - Google OAuth Client ID (עתידי)
- **`GOOGLE_CLIENT_SECRET`** - Google OAuth Client Secret (עתידי)
- **`GOOGLE_PROJECT_ID`** - Google Cloud Project ID (עתידי)
- **`GOOGLE_SERVICE_ACCOUNT_JSON`** - Service Account JSON (עתידי)
  - שימוש: `debug.js`
- **`GOOGLE_SLIDES_FOLDER_ID`** - Google Slides Folder ID (עתידי)
  - שימוש: `debug.js`

#### Coordinator Integration
- **`SERVICE_ID`** - מזהה השירות (נוצר אוטומטית לאחר רישום)
  - שימוש: `register.js` (דילוג על רישום חוזר)
  - נוצר: אוטומטית על ידי Coordinator

- **`CONTENT_STUDIO_COORDINATOR_PUBLIC_KEY`** - מפתח ציבורי של Coordinator (אופציונלי)
  - שימוש: `coordinatorClient.js` (אימות חתימת תגובה)

- **`SERVICE_NAME`** - שם השירות (ברירת מחדל: `content-studio`)
  - שימוש: `coordinatorClient.js`, `register.js`
  - ברירת מחדל: `content-studio`

#### Microservices URLs (אופציונלי - אם משתמשים באינטגרציות)
- **`DIRECTORY_URL`** - כתובת שירות Directory
  - דוגמה: `https://directory-production.railway.app`
  - שימוש: `DirectoryClient.js` (עתידי)

- **`COURSE_BUILDER_URL`** - כתובת שירות Course Builder
  - דוגמה: `https://course-builder-production.railway.app`
  - שימוש: `CourseBuilderClient.js` (עתידי)

- **`SKILLS_ENGINE_URL`** - כתובת שירות Skills Engine
  - דוגמה: `https://skills-engine-production.railway.app`
  - שימוש: `SkillsEngineClient.js` (עתידי)

- **`DEVLAB_URL`** - כתובת שירות DevLab
  - דוגמה: `https://devlab-production.railway.app`
  - שימוש: `DevLabClient.js` (עתידי)

- **`AUTH_SERVICE_URL`** - כתובת שירות Authentication
  - שימוש: `AuthenticationClient.js`, `authentication.js`

---

### ⚙️ הגדרות שרת (Server Configuration)

#### Network & Port
- **`PORT`** - פורט השרת (ברירת מחדל: `3000`)
  - שימוש: `server.js`
  - ברירת מחדל: `3000`
  - Railway מספק אוטומטית: `process.env.PORT`

#### Environment
- **`NODE_ENV`** - סביבת הרצה (`development` / `production`)
  - שימוש: `server.js`, `errorHandler.js`, `DatabaseConnection.js`
  - Railway מספק אוטומטית: `production`

#### CORS & Security
- **`ALLOWED_ORIGINS`** - רשימת origins מורשים (מופרדים בפסיקים)
  - דוגמה: `https://app1.example.com,https://app2.example.com`
  - שימוש: `server.js` (CORS configuration)

- **`FRONTEND_URL`** - כתובת Frontend (לצורך CORS)
  - דוגמה: `https://content-studio-frontend.vercel.app`
  - שימוש: `server.js` (CORS configuration)

#### Database Configuration
- **`DATABASE_IPV4_PORT`** - פורט IPv4 ספציפי למסד הנתונים (אופציונלי)
  - שימוש: `DatabaseConnection.js` (development)

- **`SKIP_MIGRATIONS`** - דילוג על migrations (אופציונלי)
  - ערכים: `true` / `false`
  - שימוש: `server.js`
  - ברירת מחדל: `false` (מבצע migrations)

#### Background Jobs
- **`ENABLE_BACKGROUND_JOBS`** - הפעלת background jobs
  - ערכים: `true` / `false`
  - שימוש: `server.js`, `JobScheduler.js`
  - ברירת מחדל: `true` (מופעל)

#### Logging
- **`LOG_REQUESTS`** - רישום בקשות (אופציונלי)
  - ערכים: `true` / `false`
  - שימוש: `server.js`
  - ברירת מחדל: `false` (ב-production)

- **`LOG_LEVEL`** - רמת רישום (אופציונלי)
  - ערכים: `DEBUG`, `INFO`, `WARN`, `ERROR`
  - שימוש: `Logger.js`
  - ברירת מחדל: `INFO`

---

## 📝 סיכום לפי סדר עדיפות

### 🔴 חובה להגדרה ב-Railway:
1. `DATABASE_URL`
2. `SUPABASE_URL`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `COORDINATOR_URL`
5. `SERVICE_ENDPOINT`
6. `CS_COORDINATOR_PRIVATE_KEY`
7. `OPENAI_API_KEY`

### 🟡 מומלץ להגדרה:
1. `GEMINI_API_KEY` (או `GOOGLE_API_KEY`)
2. `SUPABASE_BUCKET_NAME` (אם לא `media`)
3. `ALLOWED_ORIGINS` או `FRONTEND_URL` (ל-CORS)
4. `SERVICE_ID` (נוצר אוטומטית לאחר רישום)

### 🟢 אופציונלי (עתידי):
1. `HEYGEN_API_KEY`
2. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID`
3. `DIRECTORY_URL`, `COURSE_BUILDER_URL`, `SKILLS_ENGINE_URL`, `DEVLAB_URL`
4. `AUTH_SERVICE_URL`

### ⚙️ אוטומטי על ידי Railway:
- `PORT` - Railway מספק אוטומטית
- `NODE_ENV` - Railway מגדיר ל-`production`

---

## 🔧 דוגמה להגדרה ב-Railway CLI

```bash
# חובה
railway variables set DATABASE_URL=postgresql://...
railway variables set SUPABASE_URL=https://xxxxx.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=xxxxx
railway variables set COORDINATOR_URL=https://coordinator-production.railway.app
railway variables set SERVICE_ENDPOINT=https://content-studio-production.railway.app
railway variables set CS_COORDINATOR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
railway variables set OPENAI_API_KEY=sk-...

# מומלץ
railway variables set GEMINI_API_KEY=...
railway variables set FRONTEND_URL=https://content-studio-frontend.vercel.app

# אופציונלי
railway variables set ENABLE_BACKGROUND_JOBS=true
railway variables set LOG_LEVEL=INFO
```

---

## 📚 קישורים נוספים

- [RAILWAY_ENV_VARIABLES.md](./RAILWAY_ENV_VARIABLES.md) - תיעוד מקורי
- [RAILWAY_READY.md](./RAILWAY_READY.md) - סטטוס מוכנות
- [registration/README.md](../registration/README.md) - הוראות רישום שירות

---

**עדכון אחרון:** {{ current_date }}

