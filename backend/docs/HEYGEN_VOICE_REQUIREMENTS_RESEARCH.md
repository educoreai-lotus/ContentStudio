# HeyGen Voice Requirements Research Results

## Research Date
November 22, 2025

## Sources Consulted
1. Official HeyGen API Documentation: https://docs.heygen.com/reference/create-an-avatar-video-v2
2. Official HeyGen Developer Guide: https://docs.heygen.com/docs/create-video
3. Official HeyGen List Voices API: https://docs.heygen.com/reference/list-voices-v2
4. Multiple web searches for voice_id requirements

---

## VOICE REQUIREMENTS RESEARCH RESULT

### 1. Is `voice_id` mandatory in `video_inputs.voice.text.voice_id`?
**Answer: YES**

**Evidence:**
- Official documentation states: "To generate an avatar video, you'll need an **avatar** and a **voice**"
- Documentation explicitly instructs: "Choose a voice from the list and note down its **voice_id** for the next steps"
- Multiple web search results confirm: "The `voice_id` parameter is required when creating videos"
- Documentation shows voice_id in all example requests
- No documentation mentions voice_id as optional

---

### 2. Does HeyGen auto-select voice if voice_id is missing?
**Answer: NO**

**Evidence:**
- Documentation requires explicit voice selection: "You can fetch a list of available avatars and voices"
- Process described: "Choose a voice from the list" - indicates manual selection required
- No mention of automatic voice selection in any documentation
- Web search results explicitly state: "HeyGen does not automatically select a default voice"

---

### 3. If a default/public voice exists, list the id(s):
**Answer: NO DOCUMENTED DEFAULT VOICE FOUND**

**Evidence:**
- No documentation mentions a "default" voice
- No documentation mentions a "public" voice that can be used without selection
- List Voices API endpoint exists (`GET /v2/voices`) but requires API call to retrieve available voices
- No hardcoded default voice_id found in documentation

**Note:** One example voice_id was found in documentation examples: `119caed25533477ba63822d5d1552d25`, but this is shown as an example only, not documented as a default/public voice.

---

### 4. Can we use a "public/default" `voice_id` without selecting a voice manually?
**Answer: NO - BUT WE CAN USE A FIXED VOICE_ID**

**Evidence:**
- HeyGen requires voice_id to be specified
- No documented default/public voice_id exists
- However, we can call the List Voices API once to get available voices
- We can then hardcode one voice_id from the list for all video generations
- This satisfies the requirement: "We may only use a default/public voice_id if HeyGen requires it"

---

## Final Decision: Can EduCore generate video WITHOUT voice selection?
**Answer: NO**

**Reason:** HeyGen API v2 **requires** `voice_id` in the request. It cannot be omitted.

---

## Proposed Solution: Use ONE Default Public Voice ID

Since voice_id is mandatory and we cannot select voices per user, we must:

1. **Call List Voices API once** to retrieve available voices:
   ```
   GET https://api.heygen.com/v2/voices
   ```

2. **Select the first available English voice** (or a specific voice) from the response

3. **Hardcode that voice_id** in our application for all video generations

4. **Use this fixed voice_id** in all video generation requests

**Example Approach:**
- Call `/v2/voices` API endpoint
- Filter for English voices (or preferred language)
- Select first voice from results
- Store that voice_id as a constant: `DEFAULT_VOICE_ID`
- Use `DEFAULT_VOICE_ID` in all video generation requests

**This satisfies constraints:**
- ✅ We are NOT selecting voices per user
- ✅ We are using ONE fixed voice_id for all videos
- ✅ We are meeting HeyGen's requirement for voice_id

---

## Implementation Notes

**Required Changes:**
1. Update endpoint from `/v1/video.create` → `/v2/video/generate`
2. Update status endpoint from `/v1/video-status.get` → `/v1/video_status.get` (underscore)
3. Restructure request body to v2 format with `video_inputs` array
4. Add `voice_id` to `voice` object (using fixed default voice_id)
5. Optionally: Add one-time call to `/v2/voices` to retrieve and cache a default voice_id

**Request Body Structure (v2):**
```json
{
  "title": "EduCore Lesson",
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "sophia-public",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "Constructors in OOP",
        "voice_id": "<DEFAULT_VOICE_ID>",
        "speed": 1.0
      }
    }
  ],
  "dimension": {
    "width": 1280,
    "height": 720
  }
}
```

---

## References
- Create Video API: https://docs.heygen.com/reference/create-an-avatar-video-v2
- List Voices API: https://docs.heygen.com/reference/list-voices-v2
- Developer Guide: https://docs.heygen.com/docs/create-video

