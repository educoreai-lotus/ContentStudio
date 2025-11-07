# Supabase Database Migration Workflow

## 📋 Overview

This workflow automates database migrations to Supabase when changes are made to the `database/` directory.

## 🔧 Required GitHub Secrets

The workflow requires the following secrets to be configured in GitHub:

### Required Secrets:

1. **`SUPABASE_PROJECT_REF`**
   - Your Supabase project reference ID
   - Found in: Supabase Dashboard → Project Settings → General → Reference ID
   - Example: `abcdefghijklmnop`

2. **`SUPABASE_ACCESS_TOKEN`**
   - Your Supabase access token
   - Generate at: https://supabase.com/dashboard/account/tokens
   - Needs `projects:read` and `projects:write` permissions

### Optional Secrets (for fallback method):

3. **`SUPABASE_DB_PASSWORD`**
   - Database password (if using direct psql connection)
   - Found in: Supabase Dashboard → Project Settings → Database → Connection string

4. **`SUPABASE_DB_URL`**
   - Full database connection URL
   - Format: `postgresql://postgres:[password]@[host]:[port]/postgres`

5. **`SUPABASE_DB_HOST`**
   - Database host (if using direct psql)
   - Found in connection string

6. **`SUPABASE_DB_USER`**
   - Database user (usually `postgres`)
   - Found in connection string

7. **`SUPABASE_DB_NAME`**
   - Database name (usually `postgres`)
   - Found in connection string

8. **`SUPABASE_DB_PORT`**
   - Database port (usually `5432`)
   - Optional, defaults to 5432

## 🚀 How It Works

### Trigger Conditions

The workflow runs when:
- **Push to `main` branch** with changes in:
  - `database/**` (any file in database directory)
  - `.github/workflows/supabase-deploy.yml` (workflow file itself)
- **Manual trigger** via GitHub Actions UI (workflow_dispatch)

### Workflow Steps

1. **Checkout Code** - Gets the latest code
2. **Setup Node.js** - Installs Node.js 18
3. **Install Supabase CLI** - Installs latest Supabase CLI globally
4. **Link to Supabase Project** - Links repository to your Supabase project
5. **Verify Connection** - Tests Supabase connection
6. **Check for Migrations** - Verifies migration files exist
7. **Push Migrations** - Runs `supabase db push` to apply migrations
8. **Verify Migrations** - Lists applied migrations
9. **Fallback Method** - If CLI fails, tries direct SQL execution via psql
10. **Summary** - Creates a summary of the migration process

## 📁 Migration Files

The workflow looks for SQL migration files in:
```
database/migrations/*.sql
```

**Main migration file:**
- `database/migrations/migration.sql` - Complete database schema

**Additional migration files:**
- `database/migrations/add_language_stats.sql`
- `database/migrations/add_cleanup_functions.sql`
- `database/migrations/fix_enum_to_lookup_tables.sql`
- `database/migrations/add_ids_to_lookup_tables.sql`
- `database/migrations/update_to_id_based_lookup.sql`

## ✅ Idempotency

The workflow is **idempotent** (safe to re-run):
- Supabase CLI tracks applied migrations
- Only new/unapplied migrations are executed
- Re-running the workflow won't duplicate migrations
- Uses Supabase's built-in migration tracking system

## 🔐 Security

- All secrets are stored in GitHub Secrets (encrypted)
- Secrets are never exposed in logs
- Access tokens have minimal required permissions
- Database credentials are only used if CLI method fails

## 🛠️ Setup Instructions

### Step 1: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Add each required secret:

```
SUPABASE_PROJECT_REF=your-project-ref-id
SUPABASE_ACCESS_TOKEN=your-access-token
SUPABASE_DB_PASSWORD=your-db-password (optional)
SUPABASE_DB_URL=your-db-url (optional)
SUPABASE_DB_HOST=your-db-host (optional)
SUPABASE_DB_USER=postgres (optional)
SUPABASE_DB_NAME=postgres (optional)
SUPABASE_DB_PORT=5432 (optional)
```

### Step 2: Get Supabase Project Reference

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → General**
4. Copy the **Reference ID** (looks like: `abcdefghijklmnop`)

### Step 3: Generate Access Token

1. Go to [Supabase Account Settings](https://supabase.com/dashboard/account/tokens)
2. Click **Generate new token**
3. Give it a name (e.g., "GitHub Actions")
4. Copy the token (you won't see it again!)

### Step 4: Test the Workflow

1. Make a small change to `database/migrations/migration.sql`
2. Commit and push to `main` branch
3. Go to **Actions** tab in GitHub
4. Watch the workflow run
5. Check Supabase Dashboard to verify migrations applied

## 📊 Monitoring

### Check Workflow Status

- Go to **Actions** tab in GitHub
- Click on the workflow run
- View logs for each step

### Verify Migrations in Supabase

1. Go to Supabase Dashboard
2. Navigate to **Database → Migrations**
3. See all applied migrations with timestamps

### View Migration Logs

The workflow creates a summary in the GitHub Actions UI showing:
- Migration status
- Branch and commit info
- Whether migration files were found
- Any errors encountered

## ⚠️ Troubleshooting

### Issue: "Project not found"

**Solution:**
- Verify `SUPABASE_PROJECT_REF` is correct
- Check that the access token has access to the project

### Issue: "Access denied"

**Solution:**
- Regenerate `SUPABASE_ACCESS_TOKEN`
- Ensure token has `projects:read` and `projects:write` permissions

### Issue: "No migrations to apply"

**Solution:**
- This is normal if all migrations are already applied
- Supabase tracks applied migrations automatically

### Issue: "Migration failed"

**Solution:**
- Check the error logs in GitHub Actions
- Verify SQL syntax in migration files
- Try running migration manually in Supabase SQL Editor

### Issue: "CLI push failed"

**Solution:**
- The workflow automatically tries fallback method (direct psql)
- Ensure optional database secrets are configured
- Check database connection string format

## 🔄 Manual Migration (Alternative)

If the automated workflow fails, you can run migrations manually:

### Option 1: Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `database/migrations/migration.sql`
3. Paste and run

### Option 2: Local CLI
```bash
# Install Supabase CLI
npm install -g supabase@latest

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

### Option 3: Direct SQL
```bash
psql "postgresql://postgres:[password]@[host]:5432/postgres" \
  -f database/migrations/migration.sql
```

## 📝 Notes

- **First Run**: The workflow will apply all migrations in `database/migrations/`
- **Subsequent Runs**: Only new migrations will be applied
- **Rollback**: Supabase doesn't support automatic rollback - use manual SQL if needed
- **Testing**: Test migrations in a staging environment first

## ✅ Checklist

Before deploying:
- [ ] All required secrets are configured in GitHub
- [ ] `SUPABASE_PROJECT_REF` is correct
- [ ] `SUPABASE_ACCESS_TOKEN` has proper permissions
- [ ] Migration files are in `database/migrations/`
- [ ] SQL syntax is valid (test in Supabase SQL Editor)
- [ ] Workflow file is committed to repository

---

**Last Updated:** 2025-01-22  
**Workflow File:** `.github/workflows/supabase-deploy.yml`

