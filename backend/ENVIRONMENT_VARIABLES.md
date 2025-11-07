# Environment Variables Configuration

## Required Environment Variables for Railway Deployment

This document lists all environment variables used by Content Studio and how they are loaded from Railway.

### Currently Used Variables

#### 1. **OPENAI_API_KEY** ✅
- **Used in:**
  - `src/presentation/routes/ai-generation.js` - AI content generation
  - `src/presentation/routes/quality-checks.js` - Quality checks
  - `src/infrastructure/external-apis/openai/OpenAIClient.js` - Text and code generation
  - `src/infrastructure/external-apis/openai/TTSClient.js` - Audio generation (TTS)
- **Status:** ✅ Currently used

#### 2. **GEMINI_API_KEY** ⚠️
- **Used in:**
  - `src/presentation/routes/ai-generation.js` - Mind map generation
  - `src/infrastructure/external-apis/gemini/GeminiClient.js` - Gemini API client
- **Status:** ⚠️ **NOT SET IN RAILWAY** - Needs to be added
- **Action Required:** 
  - Add `GEMINI_API_KEY` to Railway variables
  - Get API key from: https://makersuite.google.com/app/apikey
  - **Note:** Google Generative AI SDK uses API keys, not OAuth credentials
  - The `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID` in Railway are for other Google APIs (like Slides), not for Gemini

### Variables in Railway (Not Yet Used)

#### 3. **DATABASE_URL** ⏳
- **Status:** ⏳ Not yet used (currently using in-memory repositories)
- **Future Use:** PostgreSQL database connection

#### 4. **SUPABASE_URL** ⏳
- **Status:** ⏳ Not yet used
- **Future Use:** Supabase storage for media files

#### 5. **SUPABASE_ANON_KEY** ⏳
- **Status:** ⏳ Not yet used
- **Future Use:** Supabase anonymous key for client-side access

#### 6. **SUPABASE_SERVICE_ROLE_KEY** ⏳
- **Status:** ⏳ Not yet used
- **Future Use:** Supabase service role key for server-side operations

#### 7. **HEYGEN_API_KEY** ⏳
- **Status:** ⏳ Not yet used
- **Future Use:** Avatar video generation (Post-MVP feature)

#### 8. **GOOGLE_CLIENT_ID** ⏳
- **Status:** ⏳ Not yet used
- **Future Use:** Google Slides API authentication

#### 9. **GOOGLE_CLIENT_SECRET** ⏳
- **Status:** ⏳ Not yet used
- **Future Use:** Google Slides API authentication

#### 10. **GOOGLE_PROJECT_ID** ⏳
- **Status:** ⏳ Not yet used
- **Future Use:** Google Slides API project identification

## Current Implementation Status

### ✅ Working
- OpenAI API integration (text, code, audio generation)
- Environment variables loaded via `process.env`

### ⚠️ Needs Update
- **Gemini API:** Currently expects `GEMINI_API_KEY` but Railway provides Google OAuth credentials
  - **Solution:** Update `GeminiClient.js` to use Google API authentication with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID`

### ⏳ Not Yet Implemented
- Database connection (DATABASE_URL)
- Supabase storage integration
- HeyGen avatar video generation
- Google Slides API integration

## How to Fix Gemini API Integration

The current code expects `GEMINI_API_KEY`, but Railway provides Google OAuth credentials. We need to:

1. Update `GeminiClient.js` to use Google API authentication
2. Use `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID` from environment
3. Or use `GEMINI_API_KEY` if available (for backward compatibility)

## Example .env File (Local Development)

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Gemini (for local dev - use API key)
GEMINI_API_KEY=...

# Or Google OAuth (for production)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_PROJECT_ID=...

# Database (future)
DATABASE_URL=postgresql://...

# Supabase (future)
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# HeyGen (future)
HEYGEN_API_KEY=...
```

