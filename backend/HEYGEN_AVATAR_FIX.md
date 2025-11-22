# HeyGen Avatar Fix - 403 Forbidden Solution

## Problem

The HeyGen API endpoint `/v1/avatar.list` returns **403 Forbidden**, preventing automatic avatar selection.

## Solution Options

### Option 1: Manual Avatar Configuration (Recommended)

Since the API endpoint is restricted, manually configure an avatar:

1. **Get Avatar ID from HeyGen:**
   - Contact HeyGen support for a public avatar ID
   - Check HeyGen dashboard (if you have access)
   - Use a known public avatar ID from HeyGen documentation

2. **Create Config File:**
   ```bash
   cp config/heygen-avatar.json.template config/heygen-avatar.json
   ```

3. **Edit the file:**
   Replace `REPLACE_WITH_ACTUAL_AVATAR_ID` with the actual avatar ID.

4. **Commit:**
   ```bash
   git add config/heygen-avatar.json
   git commit -m "Add manual HeyGen avatar configuration"
   git push
   ```

### Option 2: Try Video Generation to Get Valid Avatar ID

If you have a working HeyGen account:

1. Try generating a video with a known avatar ID
2. If it works, use that avatar ID
3. If it fails with `avatar_not_found`, the error message might contain valid avatar IDs

### Option 3: Contact HeyGen Support

Ask HeyGen support for:
- List of currently available public avatars
- Recommended avatar ID for educational content
- API endpoint to list avatars (if available)

## Current System Behavior

The system has been updated to:

1. ✅ Try multiple API endpoints for avatar listing
2. ✅ Handle 403 errors gracefully (allows manual config)
3. ✅ Skip validation if API is restricted (validation happens during video generation)
4. ✅ Return structured error if avatar is invalid (no crash)

## Testing

After setting up `config/heygen-avatar.json`:

1. Restart backend
2. Try generating an avatar video
3. If you get `avatar_not_found` error, try a different avatar ID
4. The system will validate the avatar during the actual video generation request

## Important Notes

- The system **will not crash** if avatar is missing or invalid
- Avatar generation will return `NO_AVAILABLE_AVATAR` error
- All other features continue working normally
- Validation happens during video generation (not blocking startup)

