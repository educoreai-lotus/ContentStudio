# Railway Avatar Export Instructions

## Quick Fix for "NO_AVAILABLE_AVATAR" Error

### Step 1: Run Export Script on Railway

SSH into Railway production environment and run:

```bash
railway run node scripts/export-avatar-config.js
```

Or use Railway Dashboard:
1. Go to Railway Dashboard
2. Select your service
3. Open "Deployments" or "Shell"
4. Run: `node scripts/export-avatar-config.js`

### Step 2: Copy the JSON Output

The script will print:
```
=== SELECTED AVATAR CONFIG ===

{
  "avatar_id": "...",
  "name": "...",
  ...
}
```

Copy the entire JSON object.

### Step 3: Create Local File

Create `backend/config/heygen-avatar.json` with the copied JSON.

### Step 4: Commit to Git

```bash
git add backend/config/heygen-avatar.json
git commit -m "Add selected HeyGen avatar configuration"
git push
```

## Alternative: Use fetch-heygen-avatar.js

You can also use the original script:

```bash
railway run node scripts/fetch-heygen-avatar.js
```

This will also create the config file and print the selected avatar.

