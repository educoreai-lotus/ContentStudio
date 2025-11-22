# HeyGen Avatar Setup Guide

## Overview

The HeyGen avatar system automatically selects and validates avatars to ensure video generation works reliably. The system:

1. Fetches available avatars from HeyGen API
2. Selects a suitable female, natural/neutral/professional, public avatar
3. Saves the selection to `config/heygen-avatar.json`
4. Validates the avatar on server startup
5. Returns structured errors if avatar is unavailable (no crashes)

## Initial Setup

### Step 1: Run Avatar Selection Script

On Railway (Production) or locally with `HEYGEN_API_KEY`:

```bash
node scripts/fetch-heygen-avatar.js
```

This script will:
- Fetch all available avatars from HeyGen API
- Filter for public, female avatars
- Score avatars based on style keywords (natural, neutral, professional)
- Select the best match
- Save to `backend/config/heygen-avatar.json`

### Step 2: Commit Config File

After running the script, commit the generated config file:

```bash
git add config/heygen-avatar.json
git commit -m "Add HeyGen avatar configuration"
git push
```

## Config File Format

The generated `config/heygen-avatar.json` file contains:

```json
{
  "avatar_id": "selected-avatar-id",
  "name": "Avatar Name",
  "gender": "female",
  "style": "natural",
  "selectedAt": "2025-01-01T00:00:00.000Z",
  "source": "HeyGen API v1/avatar.list"
}
```

## Runtime Validation

On server startup, `HeygenClient` automatically:

1. Loads avatar ID from config file
2. Calls `GET /v1/avatar.list` to validate avatar exists
3. If avatar not found:
   - Logs warning: `[HeyGen] Configured avatar not found, skipping avatar generation`
   - Sets `avatarValidated = false`
   - All video generation requests return: `{ status: "failed", error: "NO_AVAILABLE_AVATAR" }`

## Error Handling

### Avatar Not Configured

If `config/heygen-avatar.json` doesn't exist:

```javascript
{
  status: "failed",
  error: "NO_AVAILABLE_AVATAR",
  errorCode: "NO_AVAILABLE_AVATAR",
  errorDetail: "Avatar ID not configured. Please run fetch-heygen-avatar.js script."
}
```

### Avatar Not Found in API

If configured avatar doesn't exist in HeyGen API:

```javascript
{
  status: "failed",
  error: "NO_AVAILABLE_AVATAR",
  errorCode: "NO_AVAILABLE_AVATAR",
  errorDetail: "Configured avatar (avatar-id) not found in HeyGen API"
}
```

**Important**: The backend continues working normally. Only avatar video generation is disabled.

## Re-selecting Avatar

If the current avatar becomes unavailable:

1. Run the selection script again:
   ```bash
   node scripts/fetch-heygen-avatar.js
   ```

2. Commit the updated config:
   ```bash
   git add config/heygen-avatar.json
   git commit -m "Update HeyGen avatar configuration"
   git push
   ```

3. Restart the server (or wait for next deployment)

## Avatar Selection Criteria

The script selects avatars based on:

1. **Public**: Must be public (not premium/private)
2. **Gender**: Prefers female avatars
3. **Style**: Scores based on keywords:
   - `natural` (+2 points)
   - `neutral` (+2 points)
   - `professional` (+2 points)
   - `normal` (+2 points)
   - `standard` (+2 points)
   - Names containing "neutral" or "professional" (+3 points)
   - Names containing "natural" (+2 points)

Highest scored avatar is selected.

## Testing

Run the test suite:

```bash
npm test -- HeygenAvatarValidation.test.js
```

Tests cover:
- Avatar config loading
- Avatar validation on startup
- Error handling for missing/invalid avatars
- Fallback behavior (no crashes)

## Troubleshooting

### "Avatar ID not configured"

**Solution**: Run `node scripts/fetch-heygen-avatar.js` and commit the config file.

### "Configured avatar not found"

**Solution**: 
1. The avatar was deleted from HeyGen
2. Run the selection script again to pick a new avatar
3. Commit and deploy

### Script fails with API error

**Check**:
- `HEYGEN_API_KEY` is set correctly
- API key has permission to list avatars
- Network connectivity to `api.heygen.com`

## Files

- `scripts/fetch-heygen-avatar.js` - Avatar selection script
- `src/infrastructure/ai/heygenAvatarConfig.js` - Config loader
- `src/infrastructure/ai/HeygenClient.js` - Client with validation
- `config/heygen-avatar.json` - Selected avatar config (generated)
- `tests/unit/infrastructure/ai/HeygenAvatarValidation.test.js` - Tests

