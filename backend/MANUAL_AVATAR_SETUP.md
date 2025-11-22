# Manual HeyGen Avatar Setup Guide

## Problem

The HeyGen API endpoint `/v1/avatar.list` returns **403 Forbidden**, meaning avatar listing is not accessible via API.

## Solution: Manual Avatar Configuration

Since the API endpoint is restricted, you need to manually configure an avatar ID.

### Step 1: Get Avatar ID

You can get a public avatar ID from:
- HeyGen Dashboard (if you have access)
- HeyGen Support (contact them for public avatar IDs)
- HeyGen Documentation
- Previous successful video generation (check logs for avatar_id used)

### Step 2: Create Config File

Create `backend/config/heygen-avatar.json` with this structure:

```json
{
  "avatar_id": "YOUR_AVATAR_ID_HERE",
  "name": "Avatar Name",
  "gender": "female",
  "style": "professional",
  "score": 0,
  "selectedAt": "2025-11-22T00:00:00.000Z",
  "source": "manual",
  "criteria": {
    "mustBePublic": true,
    "mustBeFemaleOrNeutral": true,
    "mustBeProfessionalNeutralOrNatural": true,
    "mustNotBeChildCartoonFantasyRobotDramatic": true
  }
}
```

### Step 3: Replace Placeholder

Replace `YOUR_AVATAR_ID_HERE` with an actual public avatar ID from HeyGen.

### Step 4: Commit to Git

```bash
git add backend/config/heygen-avatar.json
git commit -m "Add manual HeyGen avatar configuration"
git push
```

## Testing

After setting up the config file:

1. Restart the backend server
2. Try generating an avatar video
3. If you get `avatar_not_found` error, the avatar ID is invalid
4. Try a different avatar ID

## Note

The system will validate the avatar on startup by checking if it exists in the HeyGen API. If validation fails, avatar generation will return `NO_AVAILABLE_AVATAR` error (but the server won't crash).

