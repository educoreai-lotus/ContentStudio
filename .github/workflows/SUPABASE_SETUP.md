# 🚀 Quick Setup Guide - Supabase Migration Workflow

## ✅ What Was Created

1. **`.github/workflows/supabase-deploy.yml`** - Automated migration workflow
2. **`.github/workflows/SUPABASE_DEPLOYMENT.md`** - Full documentation

## 🔑 Required GitHub Secrets (Minimum 2)

Add these in: **GitHub Repository → Settings → Secrets and variables → Actions**

### 1. `SUPABASE_PROJECT_REF` (Required)
- **Where to find:** Supabase Dashboard → Project Settings → General → Reference ID
- **Example:** `abcdefghijklmnop`
- **What it does:** Links your repo to your Supabase project

### 2. `SUPABASE_ACCESS_TOKEN` (Required)
- **Where to get:** https://supabase.com/dashboard/account/tokens
- **Permissions needed:** `projects:read`, `projects:write`
- **What it does:** Authenticates with Supabase API

## 🎯 How It Works

1. **Triggers automatically** when you push changes to `database/**` on `main` branch
2. **Installs Supabase CLI** automatically
3. **Copies migrations** from `database/migrations/` to `supabase/migrations/`
4. **Links to your project** using the secrets
5. **Pushes migrations** with `supabase db push`
6. **Idempotent** - only applies new migrations (Supabase tracks what's already applied)

## 📋 Setup Steps (5 minutes)

### Step 1: Get Your Project Reference
```bash
# Go to: https://supabase.com/dashboard
# Select your project → Settings → General
# Copy the "Reference ID"
```

### Step 2: Generate Access Token
```bash
# Go to: https://supabase.com/dashboard/account/tokens
# Click "Generate new token"
# Name it: "GitHub Actions"
# Copy the token (you won't see it again!)
```

### Step 3: Add Secrets to GitHub
```bash
# Go to: https://github.com/YOUR_USERNAME/Content-Studio/settings/secrets/actions
# Click "New repository secret"
# Add:
#   Name: SUPABASE_PROJECT_REF
#   Value: [your-project-ref]
#
#   Name: SUPABASE_ACCESS_TOKEN  
#   Value: [your-access-token]
```

### Step 4: Test It!
```bash
# Make a small change to database/migrations/migration.sql
git add database/migrations/migration.sql
git commit -m "test: trigger migration workflow"
git push origin main

# Go to: https://github.com/YOUR_USERNAME/Content-Studio/actions
# Watch the workflow run!
```

## ✅ Verification

After the workflow runs:
1. **Check GitHub Actions** - Should show ✅ green checkmark
2. **Check Supabase Dashboard** → Database → Migrations - Should list applied migrations
3. **Verify tables** - Run `SELECT * FROM trainer_courses LIMIT 1;` in SQL Editor

## 🔄 Idempotency Explained

- **First run:** Applies all migrations in `database/migrations/`
- **Second run (no changes):** Does nothing (all migrations already applied)
- **Third run (new migration):** Only applies the new migration

Supabase tracks applied migrations in its internal `supabase_migrations` table.

## ⚠️ Troubleshooting

### "Project not found"
→ Check `SUPABASE_PROJECT_REF` is correct

### "Access denied"  
→ Regenerate `SUPABASE_ACCESS_TOKEN` with correct permissions

### "No migrations to apply"
→ This is normal if all migrations are already applied ✅

### Workflow doesn't trigger
→ Make sure you're pushing to `main` branch and changes are in `database/**`

## 📝 Notes

- The workflow creates a temporary `supabase/` directory (not committed to git)
- Migrations are copied, not moved (original files stay in `database/migrations/`)
- You can still run migrations manually if needed
- The workflow supports both staging and production environments

---

**That's it!** Once secrets are configured, migrations will deploy automatically on every push to `main` with database changes. 🎉

