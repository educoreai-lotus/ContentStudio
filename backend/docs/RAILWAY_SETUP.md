# Railway Deployment - Environment Variables Setup

## ✅ Currently Used Variables

### 1. OPENAI_API_KEY ✅
- **Status:** ✅ Working
- **Used for:**
  - Text generation
  - Code generation
  - Audio generation (TTS)
  - Quality checks
- **Location in Railway:** Variables → OPENAI_API_KEY

### 2. GEMINI_API_KEY ⚠️
- **Status:** ⚠️ **MISSING IN RAILWAY**
- **Used for:**
  - Mind map generation
- **Action Required:** 
  - **Option 1 (Recommended):** Add `GEMINI_API_KEY` to Railway variables
    - Get API key from: https://makersuite.google.com/app/apikey
    - Add to Railway: Variables → Add Variable → `GEMINI_API_KEY`
  
  - **Option 2:** Use Google OAuth (more complex, requires code changes)
    - Would need to implement OAuth flow for Google Generative AI
    - Not recommended for MVP

## 📝 How to Add GEMINI_API_KEY to Railway

1. Go to your Railway project
2. Click on "Variables" tab
3. Click "New Variable"
4. Name: `GEMINI_API_KEY`
5. Value: Your Gemini API key from https://makersuite.google.com/app/apikey
6. Click "Add"

## ⏳ Future Variables (Not Yet Used)

These variables are in Railway but not yet implemented in code:

- `DATABASE_URL` - Will be used when we switch from in-memory to PostgreSQL
- `SUPABASE_URL` - For media file storage
- `SUPABASE_ANON_KEY` - For Supabase client access
- `SUPABASE_SERVICE_ROLE_KEY` - For Supabase server operations
- `HEYGEN_API_KEY` - For avatar video generation (Post-MVP)
- `GOOGLE_CLIENT_ID` - For Google Slides API (future)
- `GOOGLE_CLIENT_SECRET` - For Google Slides API (future)
- `GOOGLE_PROJECT_ID` - For Google Slides API (future)

## 🔧 Current Code Status

The code currently reads:
- `process.env.OPENAI_API_KEY` ✅ (exists in Railway)
- `process.env.GEMINI_API_KEY` ⚠️ (missing in Railway)

## ✅ Quick Fix

**To make Gemini work in Railway, simply add:**
```
GEMINI_API_KEY=your-api-key-here
```

Get your API key from: https://makersuite.google.com/app/apikey

## 📋 Complete Railway Variables Checklist

- [x] OPENAI_API_KEY ✅
- [ ] GEMINI_API_KEY ⚠️ **ADD THIS**
- [ ] DATABASE_URL (future)
- [ ] SUPABASE_URL (future)
- [ ] SUPABASE_ANON_KEY (future)
- [ ] SUPABASE_SERVICE_ROLE_KEY (future)
- [ ] HEYGEN_API_KEY (future)
- [ ] GOOGLE_CLIENT_ID (future)
- [ ] GOOGLE_CLIENT_SECRET (future)
- [ ] GOOGLE_PROJECT_ID (future)



