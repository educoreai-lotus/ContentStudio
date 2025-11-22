# Fetch HeyGen Voices on Railway

## Overview
This guide explains how to run the voice fetching script on Railway production where `HEYGEN_API_KEY` is available.

## Steps

### Option 1: Using Railway CLI (Recommended)

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link to your project**:
   ```bash
   railway link
   ```

4. **Run the script in production**:
   ```bash
   railway run node scripts/fetch-heygen-voices.js
   ```

5. **Download the generated file**:
   ```bash
   railway run cat config/heygen-voices.json > config/heygen-voices.json
   ```
   
   Or use Railway's file download feature from the dashboard.

### Option 2: Using Railway Dashboard

1. **Open Railway Dashboard**:
   - Go to https://railway.app
   - Navigate to your project
   - Select the production service

2. **Open Deploy Logs/Shell**:
   - Click on the service
   - Go to "Deployments" or "Settings"
   - Find "Shell" or "Run Command" option

3. **Run the script**:
   ```bash
   node scripts/fetch-heygen-voices.js
   ```

4. **Download the file**:
   - Use Railway's file browser/download feature
   - Or copy the JSON content from the console output

### Option 3: SSH into Container (If Available)

1. **Get SSH connection details** from Railway dashboard

2. **SSH into container**:
   ```bash
   ssh <railway-ssh-connection-string>
   ```

3. **Run the script**:
   ```bash
   cd /app
   node scripts/fetch-heygen-voices.js
   ```

4. **Copy the generated file**:
   ```bash
   cat config/heygen-voices.json
   ```
   Copy the output and save it locally.

## After Generating the File

1. **Save the file locally**:
   - Create `backend/config/heygen-voices.json` in your local repository
   - Paste the JSON content from Railway

2. **Commit and push**:
   ```bash
   git add backend/config/heygen-voices.json
   git commit -m "chore: add HeyGen default voices configuration"
   git push
   ```

## Verification

After committing, verify the file structure:
```json
{
  "defaultVoices": {
    "en": "voice_id_here",
    "ar": "voice_id_here",
    ...
  },
  "generatedAt": "2025-11-22T...",
  "source": "HeyGen API v2",
  "endpoint": "https://api.heygen.com/v2/voices"
}
```

## Notes

- The script will automatically create the `config/` directory if it doesn't exist
- The generated file should be committed to the repository so it's available in all environments
- If no suitable voices are found for a language, it will be set to `null`
- The script includes detailed logging of selected voices

