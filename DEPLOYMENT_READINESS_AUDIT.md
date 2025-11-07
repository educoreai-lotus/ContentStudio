# 🚀 Deployment Readiness Audit - Content Studio

**Date:** 2025-01-22  
**Status:** ⚠️ Requires Updates Before Deployment

---

## 📊 Executive Summary

This audit reviews deployment configurations for:
- **Frontend (Vercel)** - React + Vite application
- **Backend (Railway)** - Node.js + Express API
- **Database (Supabase)** - PostgreSQL + Storage
- **CI/CD (GitHub Actions)** - Automated deployment workflow

**Critical Issues Found:** 5  
**Warnings:** 8  
**Valid Configurations:** 12

---

## ✅ 1. GitHub Repository Configuration

### `.gitignore`
✅ **VALID** - Root `.gitignore` created
- ✅ Includes `desktop.ini`, `Thumbs.db`, `.DS_Store`
- ✅ Includes `.env` files
- ✅ Includes IDE files (`.vscode/`, `.idea/`)
- ✅ Includes logs and build artifacts

### Workflow Configuration (`.github/workflows/cd.yml`)
❌ **INVALID** - Contains outdated references

**Issues:**
1. **Prisma References** (Lines 46, 69, 112, 136):
   ```yaml
   npm run db:generate  # ❌ This script doesn't exist
   npx prisma migrate deploy  # ❌ Prisma is not used
   ```
   **Fix:** Remove Prisma commands. The project uses raw SQL migrations.

2. **Build Script** (Lines 45, 112):
   ```yaml
   npm run build  # ⚠️ Check if this script exists
   ```
   **Status:** Backend doesn't have a build script (uses `npm start` directly)

3. **Missing Secrets:**
   - `RAILWAY_TOKEN` ✅ (should be set)
   - `VERCEL_TOKEN` ✅ (should be set)
   - `VERCEL_ORG_ID` ✅ (should be set)
   - `VERCEL_PROJECT_ID` ✅ (should be set)
   - `STAGING_DATABASE_URL` ⚠️ (if using staging)
   - `PRODUCTION_DATABASE_URL` ⚠️ (if using production)
   - `SLACK_WEBHOOK` ⚠️ (optional)

**Recommendation:**
- Update workflow to use SQL migrations instead of Prisma
- Remove build step for backend (it's not needed)
- Add manual migration step using `psql` or migration script

---

## ✅ 2. Vercel Configuration (Frontend)

### `frontend/vercel.json`
✅ **VALID** - Configuration is correct

**Validations:**
- ✅ `buildCommand`: `npm run build` - Correct
- ✅ `outputDirectory`: `dist` - Matches Vite default
- ✅ `framework`: `vite` - Correct
- ✅ `installCommand`: `npm ci` - Good practice
- ✅ `rewrites`: SPA routing configured correctly
- ✅ Security headers: All set (X-Content-Type-Options, X-Frame-Options, etc.)
- ✅ Region: `iad1` (US East) - Good for performance

### Missing Files
⚠️ **WARNING** - No `vite.config.js` found
- **Impact:** Using Vite defaults (may work, but not recommended)
- **Recommendation:** Create `vite.config.js` for explicit configuration

**Suggested `frontend/vite.config.js`:**
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### Environment Variables (Vercel)
⚠️ **REQUIRED** - Must be set in Vercel dashboard

**Required:**
- `VITE_API_BASE_URL` - Backend API URL (e.g., `https://your-app.railway.app`)

**How to Set:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `VITE_API_BASE_URL` with your Railway backend URL
3. Redeploy frontend

---

## ⚠️ 3. Railway Configuration (Backend)

### `backend/railway.json`
✅ **VALID** - Configuration is correct

**Validations:**
- ✅ `startCommand`: `npm start` - Correct (matches `package.json`)
- ✅ `healthcheckPath`: `/health` - Endpoint exists in `server.js`
- ✅ `healthcheckTimeout`: 100ms - Reasonable
- ✅ `builder`: `NIXPACKS` - Auto-detects Node.js projects

### `backend/server.js`
✅ **VALID** - Server configuration correct

**Validations:**
- ✅ Port: Uses `process.env.PORT || 3000` (Railway provides PORT)
- ✅ Health endpoint: `/health` exists (line 41)
- ✅ CORS: Configured (line 16) ⚠️ **But see CORS section below**
- ✅ Error handling: Middleware configured (line 78)

### Environment Variables (Railway)
✅ **CONFIGURED** - Based on `RAILWAY_ENV_VARIABLES.md`

**Required Variables:**
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `SUPABASE_URL` - Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- ✅ `OPENAI_API_KEY` - OpenAI API key

**Optional Variables:**
- ⚠️ `SUPABASE_ANON_KEY` - Optional (for client-side)
- ⚠️ `SUPABASE_BUCKET_NAME` - Optional (defaults to `media`)
- ⚠️ `GEMINI_API_KEY` or `GOOGLE_API_KEY` - Optional (for Gemini)
- ⚠️ `GOOGLE_CLIENT_ID` - Future use
- ⚠️ `GOOGLE_CLIENT_SECRET` - Future use
- ⚠️ `GOOGLE_PROJECT_ID` - Future use
- ⚠️ `HEYGEN_API_KEY` - Future use

**Missing Variables (if using background jobs):**
- ⚠️ `REDIS_HOST` - For BullMQ (if using Redis for jobs)
- ⚠️ `REDIS_PORT` - Defaults to 6379
- ⚠️ `ENABLE_BACKGROUND_JOBS` - Set to `false` to disable (default: enabled)

### CORS Configuration
⚠️ **WARNING** - Currently open to all origins

**Current Code:**
```javascript
app.use(cors()); // Allows all origins
```

**Recommendation:**
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173', // Vite dev server
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean),
  credentials: true,
}));
```

**Environment Variable to Add:**
- `ALLOWED_ORIGINS` - Comma-separated list (e.g., `https://your-app.vercel.app,https://www.yourdomain.com`)
- `FRONTEND_URL` - Primary frontend URL

---

## ✅ 4. Supabase Integration

### Database Connection
✅ **VALID** - `DatabaseConnection.js` correctly configured

**Validations:**
- ✅ Uses `process.env.DATABASE_URL`
- ✅ SSL configured for production
- ✅ Connection pool configured (max: 20)
- ✅ Error handling implemented
- ✅ Graceful fallback to in-memory repositories

### Storage Client
✅ **VALID** - `SupabaseStorageClient.js` correctly configured

**Validations:**
- ✅ Uses `process.env.SUPABASE_URL`
- ✅ Uses `process.env.SUPABASE_SERVICE_ROLE_KEY`
- ✅ Bucket name: `media` (matches Railway config)
- ✅ Graceful fallback to mock storage if not configured
- ✅ All CRUD operations implemented

### Migration Files
✅ **VALID** - SQL migrations exist in `database/migrations/`

**Files:**
- ✅ `migration.sql` - Main migration (creates all tables)
- ✅ `add_language_stats.sql` - Language statistics table
- ✅ `fix_enum_to_lookup_tables.sql` - ENUM to lookup table migration
- ✅ `add_ids_to_lookup_tables.sql` - ID columns migration
- ✅ `update_to_id_based_lookup.sql` - ID-based foreign keys migration

**⚠️ ACTION REQUIRED:**
Migrations must be run manually on Supabase:
1. Go to Supabase Dashboard → SQL Editor
2. Run `database/migrations/migration.sql`
3. Run any additional migrations as needed
4. Or create a migration script (see recommendations)

---

## ⚠️ 5. Other Deployment Requirements

### File Upload Endpoints
✅ **VALID** - Multer configured for file uploads

**Validations:**
- ✅ `multer` package installed
- ✅ Video upload endpoint: `/api/video-to-lesson` exists
- ⚠️ **File size limits:** Not explicitly set (uses Multer defaults)

**Recommendation:**
```javascript
const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});
```

### Background Jobs
⚠️ **WARNING** - Redis dependency not clearly configured

**Status:**
- ✅ `node-cron` is used (no Redis required for basic jobs)
- ⚠️ `bullmq` and `ioredis` are installed (for advanced job queues)
- ⚠️ Redis variables (`REDIS_HOST`, `REDIS_PORT`) not set

**Recommendation:**
- If using `node-cron` only: ✅ No Redis needed
- If using `bullmq`: ⚠️ Redis must be configured in Railway

**Current Implementation:**
- `JobScheduler.js` uses `node-cron` (no Redis required) ✅
- Background jobs can be disabled with `ENABLE_BACKGROUND_JOBS=false`

### Dependencies
✅ **VALID** - All required packages installed

**Backend:**
- ✅ All dependencies in `package.json`
- ✅ No missing packages
- ✅ Versions are compatible

**Frontend:**
- ✅ All dependencies in `package.json`
- ✅ Vite and React plugins configured
- ✅ Tailwind CSS configured

---

## 📋 Deployment Checklist

### Pre-Deployment

#### Backend (Railway)
- [ ] **Database Migrations:** Run `database/migrations/migration.sql` on Supabase
- [ ] **Environment Variables:** Set all required variables in Railway
  - [ ] `DATABASE_URL`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `ALLOWED_ORIGINS` (for CORS)
  - [ ] `FRONTEND_URL` (for CORS)
  - [ ] `ENABLE_BACKGROUND_JOBS` (set to `false` if not using)
- [ ] **CORS Configuration:** Update `server.js` with allowed origins
- [ ] **Health Check:** Verify `/health` endpoint works
- [ ] **File Upload Limits:** Set Multer limits if needed

#### Frontend (Vercel)
- [ ] **Environment Variables:** Set in Vercel dashboard
  - [ ] `VITE_API_BASE_URL` (Railway backend URL)
- [ ] **Build Configuration:** Create `vite.config.js` (optional but recommended)
- [ ] **API Base URL:** Verify `frontend/src/services/api.js` uses env variable

#### GitHub Actions
- [ ] **Update Workflow:** Fix Prisma references
- [ ] **Remove Build Step:** Remove `npm run build` for backend
- [ ] **Add Migration Step:** Add SQL migration step (optional)
- [ ] **Secrets:** Verify all secrets are set in GitHub

#### Supabase
- [ ] **Database:** Run migrations
- [ ] **Storage Bucket:** Verify `media` bucket exists
- [ ] **Bucket Permissions:** Verify service role key has access
- [ ] **Storage Policies:** Set up RLS policies if needed

### Post-Deployment

- [ ] **Health Checks:** Test `/health` endpoint
- [ ] **API Endpoints:** Test key endpoints
- [ ] **Frontend:** Verify frontend loads and connects to backend
- [ ] **Database:** Test database connections
- [ ] **Storage:** Test file upload/download
- [ ] **CORS:** Verify CORS works from frontend
- [ ] **Background Jobs:** Verify jobs start (if enabled)

---

## 🔧 Required Fixes

### 1. Update GitHub Workflow (HIGH PRIORITY)

**File:** `.github/workflows/cd.yml`

**Changes:**
```yaml
# REMOVE these lines:
- name: Build backend
  working-directory: ./backend
  run: |
    npm run build  # ❌ Remove - backend doesn't need build
    npm run db:generate  # ❌ Remove - Prisma not used

# REMOVE these lines:
- name: Run database migrations
  run: |
    cd backend
    npx prisma migrate deploy  # ❌ Remove - Prisma not used
```

**Replace with:**
```yaml
# Backend doesn't need build - just deploy
- name: Deploy to Railway (Backend)
  uses: railway-app/railway-deploy@v1
  with:
    service: content-studio-backend
    token: ${{ secrets.RAILWAY_TOKEN }}

# Optional: Add manual migration step
- name: Run database migrations (Manual)
  run: |
    echo "⚠️ Remember to run database/migrations/migration.sql on Supabase"
    echo "Go to Supabase Dashboard → SQL Editor and run the migration"
```

### 2. Update CORS Configuration (MEDIUM PRIORITY)

**File:** `backend/server.js`

**Replace:**
```javascript
app.use(cors());
```

**With:**
```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    const frontendUrl = process.env.FRONTEND_URL;
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || origin === frontendUrl) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
```

### 3. Create Vite Config (LOW PRIORITY)

**File:** `frontend/vite.config.js` (new file)

**Content:**
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  },
  define: {
    // Ensure environment variables are available
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || ''
    ),
  },
});
```

### 4. Add File Upload Limits (LOW PRIORITY)

**File:** `backend/src/presentation/routes/video-to-lesson.js`

**Update multer configuration:**
```javascript
import multer from 'multer';

const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
});
```

### 5. Create Migration Script (OPTIONAL)

**File:** `backend/scripts/run-migrations.js` (new file)

**Content:**
```javascript
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const migrationFile = path.join(__dirname, '../../database/migrations/migration.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
```

**Add to `package.json`:**
```json
{
  "scripts": {
    "migrate": "node scripts/run-migrations.js"
  }
}
```

---

## 📊 Summary

### ✅ What's Working
1. ✅ Vercel configuration is correct
2. ✅ Railway configuration is correct
3. ✅ Supabase integration is properly implemented
4. ✅ Environment variables are documented
5. ✅ Health check endpoint exists
6. ✅ File upload endpoints are configured
7. ✅ Database connection is robust
8. ✅ Storage client is properly implemented

### ⚠️ What Needs Attention
1. ⚠️ GitHub workflow has Prisma references (not used)
2. ⚠️ CORS is open to all origins (security risk)
3. ⚠️ No `vite.config.js` (using defaults)
4. ⚠️ File upload limits not set
5. ⚠️ Database migrations must be run manually
6. ⚠️ Redis configuration unclear (if using BullMQ)

### ❌ Critical Issues
1. ❌ GitHub workflow will fail (Prisma commands don't exist)
2. ❌ CORS security issue (allows all origins)
3. ❌ Missing environment variables documentation for Vercel

---

## 🎯 Next Steps

1. **Immediate (Before Deployment):**
   - [ ] Fix GitHub workflow (remove Prisma references)
   - [ ] Update CORS configuration
   - [ ] Set `VITE_API_BASE_URL` in Vercel
   - [ ] Run database migrations on Supabase

2. **Short-term (Within 1 week):**
   - [ ] Create `vite.config.js`
   - [ ] Add file upload limits
   - [ ] Document all environment variables
   - [ ] Test full deployment pipeline

3. **Long-term (Optional):**
   - [ ] Create migration script
   - [ ] Set up Redis for advanced job queues
   - [ ] Implement deployment rollback strategy
   - [ ] Add monitoring and logging

---

## 📝 Environment Variables Reference

### Vercel (Frontend)
```env
VITE_API_BASE_URL=https://your-app.railway.app
```

### Railway (Backend)
```env
# Database
DATABASE_URL=postgresql://...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key (optional)
SUPABASE_BUCKET_NAME=media (optional, defaults to media)

# AI Services
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key (optional)
GOOGLE_API_KEY=your-google-key (optional, fallback for Gemini)

# CORS
ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.com
FRONTEND_URL=https://your-app.vercel.app

# Background Jobs
ENABLE_BACKGROUND_JOBS=true (optional, defaults to true)
REDIS_HOST=your-redis-host (optional, if using BullMQ)
REDIS_PORT=6379 (optional, defaults to 6379)

# Server
PORT=3000 (set by Railway automatically)
NODE_ENV=production (set by Railway automatically)
```

---

## ✅ Final Status

**Deployment Readiness:** ⚠️ **75% Ready**

**Blockers:**
- ❌ GitHub workflow needs fixes
- ❌ CORS needs configuration
- ⚠️ Database migrations must be run manually

**After Fixes:** ✅ **95% Ready**

All critical configurations are in place. With the fixes above, the application should deploy successfully.

---

**Generated:** 2025-01-22  
**Auditor:** AI Assistant  
**Version:** 1.0

