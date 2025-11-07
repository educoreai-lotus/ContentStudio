# 🚀 Next Steps - Deployment Guide

## 📋 Current Status

✅ **Completed:**
- GitHub Secrets configured (6 secrets)
- Supabase migration workflow created
- CORS configuration updated
- Vite configuration created
- GitHub Actions workflow fixed
- Database migrations consolidated

## 🎯 Next Steps (In Order)

### Step 1: Test Supabase Migration Workflow ⭐ (Start Here)

**Goal:** Verify that migrations can be applied automatically

**Action:**
```bash
# Make a small comment change to trigger the workflow
# Edit database/migrations/migration.sql - add a comment at the top
git add database/migrations/migration.sql
git commit -m "test: trigger Supabase migration workflow"
git push origin main
```

**Verify:**
1. Go to GitHub → Actions tab
2. Watch the "Supabase Database Migration" workflow run
3. Check that it completes successfully ✅
4. Go to Supabase Dashboard → Database → Migrations
5. Verify migrations are listed

**Expected Result:** ✅ Workflow runs successfully, migrations appear in Supabase

---

### Step 2: Set Environment Variables in Railway (Backend)

**Goal:** Configure backend to connect to Supabase and other services

**Action:**
1. Go to [Railway Dashboard](https://railway.app)
2. Select your backend service
3. Go to **Variables** tab
4. Add/verify these variables:

```env
# Database (Required)
DATABASE_URL=postgresql://... (from Supabase)

# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET_NAME=media

# CORS (Required - NEW!)
ALLOWED_ORIGINS=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app

# AI Services (Required)
OPENAI_API_KEY=your-openai-key

# Optional
SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-key (optional)
ENABLE_BACKGROUND_JOBS=true
NODE_ENV=production
```

**Verify:**
- All variables are set
- No typos in variable names
- Values are correct

---

### Step 3: Set Environment Variables in Vercel (Frontend)

**Goal:** Configure frontend to connect to backend API

**Action:**
1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Go to **Settings → Environment Variables**
4. Add:

```env
VITE_API_BASE_URL=https://your-backend.railway.app
```

**Important:** Replace `your-backend.railway.app` with your actual Railway backend URL!

**Verify:**
- Variable name is exactly `VITE_API_BASE_URL`
- Value is your Railway backend URL (with `https://`)

---

### Step 4: Run Initial Database Migration

**Goal:** Create all database tables and functions

**Option A: Automatic (Recommended)**
- The workflow from Step 1 should have already done this
- Verify in Supabase Dashboard → Database → Migrations

**Option B: Manual (If workflow didn't run)**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `database/migrations/migration.sql`
3. Paste and run
4. Verify tables were created

**Verify:**
- Go to Supabase Dashboard → Table Editor
- You should see these tables:
  - ✅ trainer_courses
  - ✅ templates
  - ✅ topics
  - ✅ content_types
  - ✅ generation_methods
  - ✅ content
  - ✅ content_history
  - ✅ language_stats

---

### Step 5: Deploy Backend to Railway

**Goal:** Deploy the backend application

**Action:**
1. Railway should auto-deploy on push to `main`
2. Or manually trigger deployment in Railway dashboard
3. Wait for deployment to complete

**Verify:**
1. Check Railway logs for errors
2. Test health endpoint: `https://your-backend.railway.app/health`
3. Should return: `{"status":"ok","timestamp":"..."}`

**If errors:**
- Check Railway logs
- Verify environment variables are set
- Check that `DATABASE_URL` is correct

---

### Step 6: Deploy Frontend to Vercel

**Goal:** Deploy the frontend application

**Action:**
1. Vercel should auto-deploy on push to `main`
2. Or manually trigger deployment in Vercel dashboard
3. Wait for deployment to complete

**Verify:**
1. Visit your Vercel URL
2. Frontend should load
3. Check browser console for errors
4. Test API connection (try to load data)

**If errors:**
- Check that `VITE_API_BASE_URL` is set correctly
- Verify backend is accessible
- Check CORS settings in backend

---

### Step 7: Test Full Integration

**Goal:** Verify everything works together

**Test Checklist:**
- [ ] Frontend loads without errors
- [ ] Backend health check works: `/health`
- [ ] Frontend can call backend API
- [ ] Database queries work (create a test course/topic)
- [ ] Supabase Storage works (if using)
- [ ] CORS allows frontend to access backend

**Test Commands:**
```bash
# Test backend
curl https://your-backend.railway.app/health

# Test frontend
curl https://your-frontend.vercel.app
```

---

## 🚨 Troubleshooting

### Backend won't start
- Check Railway logs
- Verify `DATABASE_URL` is correct
- Check that all required env vars are set

### Frontend can't connect to backend
- Verify `VITE_API_BASE_URL` is set in Vercel
- Check CORS settings in backend
- Verify `ALLOWED_ORIGINS` includes your Vercel URL

### Database connection fails
- Verify `DATABASE_URL` format is correct
- Check Supabase database is accessible
- Verify migrations were applied

### Migration workflow fails
- Check GitHub Actions logs
- Verify `SUPABASE_PROJECT_REF` is correct
- Verify `SUPABASE_ACCESS_TOKEN` has proper permissions

---

## 📊 Deployment Checklist

Before going live, verify:

### Backend (Railway)
- [ ] All environment variables set
- [ ] Health endpoint responds
- [ ] Database connection works
- [ ] CORS configured correctly
- [ ] Logs show no errors

### Frontend (Vercel)
- [ ] `VITE_API_BASE_URL` set correctly
- [ ] Build completes successfully
- [ ] Frontend loads in browser
- [ ] No console errors
- [ ] API calls work

### Database (Supabase)
- [ ] Migrations applied
- [ ] All tables exist
- [ ] Lookup tables have data (content_types, generation_methods)
- [ ] Language stats initialized (en, he, ar)

### GitHub Actions
- [ ] Supabase migration workflow works
- [ ] Deployment workflow works (if using)
- [ ] No workflow errors

---

## 🎯 Quick Start (TL;DR)

1. **Test migration workflow:**
   ```bash
   git commit --allow-empty -m "test: trigger migration"
   git push origin main
   ```

2. **Set Railway env vars:**
   - `ALLOWED_ORIGINS` = your Vercel URL
   - `FRONTEND_URL` = your Vercel URL
   - Verify all other vars are set

3. **Set Vercel env var:**
   - `VITE_API_BASE_URL` = your Railway backend URL

4. **Deploy:**
   - Push to `main` (auto-deploys)
   - Or manually trigger in Railway/Vercel

5. **Test:**
   - Backend: `https://your-backend.railway.app/health`
   - Frontend: Visit your Vercel URL

---

## ✅ Success Criteria

You're ready when:
- ✅ Backend health check returns 200
- ✅ Frontend loads without errors
- ✅ Frontend can fetch data from backend
- ✅ Database tables exist and are accessible
- ✅ No errors in logs

---

**Ready to start? Begin with Step 1!** 🚀

