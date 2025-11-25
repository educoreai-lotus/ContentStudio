# Railway Environment Variables Configuration

## ✅ Configured Variables in Railway

Based on your Railway setup, here are all the environment variables:

### Database
- ✅ `DATABASE_URL` - PostgreSQL connection string

### Supabase Storage
- ✅ `SUPABASE_URL` - Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for backend operations)
- ✅ `SUPABASE_ANON_KEY` - Anonymous key (optional, for client-side)
- ✅ **Storage Bucket:** `media` (configured in Supabase)

### AI Services
- ✅ `OPENAI_API_KEY` - OpenAI API key (for GPT, Whisper, TTS)
- ✅ `GOOGLE_CLIENT_ID` - Google OAuth client ID (for future Google APIs)
- ✅ `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (for future Google APIs)
- ✅ `GOOGLE_PROJECT_ID` - Google Cloud project ID (for future Google APIs)

### Future Services
- ✅ `HEYGEN_API_KEY` - HeyGen API key (for avatar video generation - future feature)

## 🔧 Code Configuration

### Supabase Storage Bucket

The code now uses the `media` bucket (as configured in Railway). The bucket name is configurable via:

1. **Environment Variable** (recommended):
   ```env
   SUPABASE_BUCKET_NAME=media
   ```

2. **Constructor Parameter**:
   ```javascript
   new SupabaseStorageClient({
     supabaseUrl: process.env.SUPABASE_URL,
     supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
     bucketName: 'media' // or from env
   });
   ```

3. **Default**: If not specified, defaults to `media`

### Current Usage

#### ✅ Used Variables
- `DATABASE_URL` - ✅ Used in `DatabaseConnection.js`
- `SUPABASE_URL` - ✅ Used in `SupabaseStorageClient.js`
- `SUPABASE_SERVICE_ROLE_KEY` - ✅ Used in `SupabaseStorageClient.js`
- `OPENAI_API_KEY` - ✅ Used in `OpenAIClient.js`, `TTSClient.js`, `WhisperClient.js`

#### ⏳ Future Use (Not Currently Used)
- `SUPABASE_ANON_KEY` - ⏳ Fallback in multilingual routes (not actively used)
- `GOOGLE_CLIENT_ID` - ⏳ For future Google Slides API integration
- `GOOGLE_CLIENT_SECRET` - ⏳ For future Google Slides API integration
- `GOOGLE_PROJECT_ID` - ⏳ For future Google Slides API integration
- `HEYGEN_API_KEY` - ⏳ For future avatar video generation

#### 🔄 Gemini API Key
The code currently uses:
- `GEMINI_API_KEY` (preferred) OR
- `GOOGLE_API_KEY` (fallback)

**Note:** If you have a direct Gemini API key, add it as `GEMINI_API_KEY` in Railway. Otherwise, the code will try to use `GOOGLE_API_KEY` if available.

## 📝 Required vs Optional

### Required for Core Features
- ✅ `DATABASE_URL` - Required for database operations
- ✅ `SUPABASE_URL` - Required for storage
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Required for storage operations
- ✅ `OPENAI_API_KEY` - Required for AI generation

### Optional (Fallback/Graceful Degradation)
- ⚠️ `SUPABASE_ANON_KEY` - Optional, used as fallback
- ⚠️ `GEMINI_API_KEY` or `GOOGLE_API_KEY` - Optional, for Gemini features
- ⚠️ `SUPABASE_BUCKET_NAME` - Optional, defaults to `media`

### Future Features (Not Required Now)
- ⏳ `GOOGLE_CLIENT_ID` - For Google Slides integration
- ⏳ `GOOGLE_CLIENT_SECRET` - For Google Slides integration
- ⏳ `GOOGLE_PROJECT_ID` - For Google Slides integration
- ⏳ `HEYGEN_API_KEY` - For avatar video generation

## ✅ Verification Checklist

- [x] `DATABASE_URL` - Configured ✅
- [x] `SUPABASE_URL` - Configured ✅
- [x] `SUPABASE_SERVICE_ROLE_KEY` - Configured ✅
- [x] `SUPABASE_ANON_KEY` - Configured ✅ (optional)
- [x] `OPENAI_API_KEY` - Configured ✅
- [x] `GOOGLE_CLIENT_ID` - Configured ✅ (future)
- [x] `GOOGLE_CLIENT_SECRET` - Configured ✅ (future)
- [x] `GOOGLE_PROJECT_ID` - Configured ✅ (future)
- [x] `HEYGEN_API_KEY` - Configured ✅ (future)
- [x] Storage Bucket `media` - Created ✅

## 🚀 Next Steps

1. **Add Gemini API Key** (if using Gemini):
   ```env
   GEMINI_API_KEY=your-gemini-api-key
   ```
   OR use `GOOGLE_API_KEY` if you have it

2. **Verify Storage Bucket**:
   - Ensure bucket `media` exists in Supabase
   - Verify bucket permissions allow service role key access

3. **Test Connections**:
   - Database connection
   - Supabase storage access
   - OpenAI API access

## 📊 Status

**All required environment variables are configured in Railway!** ✅

The application should work with your current Railway setup. The optional/future variables are already configured for when those features are implemented.

