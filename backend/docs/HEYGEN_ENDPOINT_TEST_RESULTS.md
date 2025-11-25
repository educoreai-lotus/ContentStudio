# HeyGen API Endpoint Test Results

## ⚠️ CRITICAL TEST: Can HeyGen Auto-Select Voice Without voice_id?

### Test Objective
Verify if HeyGen API v2 can automatically select a voice when `voice_id` is NOT provided in the request.

---

## Official HeyGen API Endpoints (Confirmed)

### 1. Video Creation Endpoint
- **Full Path:** `POST https://api.heygen.com/v2/video/generate`
- **Method:** POST
- **Headers:**
  - `X-Api-Key: <your-api-key>`
  - `Content-Type: application/json`

### 2. Video Status Endpoint
- **Full Path:** `GET https://api.heygen.com/v1/video_status.get?video_id={video_id}`
- **Method:** GET
- **Query Parameter:** `video_id` (required, string)
- **Note:** Uses **underscore** `_` not hyphen `-` in `video_status.get`

---

## Test Request #1: Minimal Payload (NO voice_id, NO video_inputs structure)

### Request Structure
```http
POST https://api.heygen.com/v2/video/generate
Content-Type: application/json
X-Api-Key: <your-api-key>

{
  "title": "EduCore Lesson",
  "prompt": "Constructors in OOP",
  "avatar_id": "sophia-public"
}
```

### Expected Behavior
- **If SUCCESS (200):** HeyGen accepts minimal payload and auto-selects voice
- **If FAILURE (400/404):** HeyGen requires `video_inputs` structure

### Test Status
⚠️ **NOT YET EXECUTED** - Requires `HEYGEN_API_KEY` environment variable

---

## Test Request #2: v2 Format WITHOUT voice_id in voice object

### Request Structure
```http
POST https://api.heygen.com/v2/video/generate
Content-Type: application/json
X-Api-Key: <your-api-key>

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
        "speed": 1.0
        // ⚠️ NO voice_id - testing if HeyGen auto-selects
      }
    }
  ],
  "dimension": {
    "width": 1280,
    "height": 720
  }
}
```

### Expected Behavior
- **If SUCCESS (200):** HeyGen auto-selects voice when `voice_id` is omitted
- **If FAILURE (400):** HeyGen requires `voice_id` in `voice` object

### Test Status
⚠️ **NOT YET EXECUTED** - Requires `HEYGEN_API_KEY` environment variable

---

## Test Request #3: v2 Format WITH voice_id (Control Test)

### Request Structure
```http
POST https://api.heygen.com/v2/video/generate
Content-Type: application/json
X-Api-Key: <your-api-key>

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
        "voice_id": "<some-default-voice-id>",
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

### Expected Behavior
- **If SUCCESS (200):** Confirms v2 format works with voice_id
- **Response:** Returns `video_id` for status polling

### Test Status
⚠️ **NOT YET EXECUTED** - Requires `HEYGEN_API_KEY` environment variable

---

## Current Code Issues

### Issue 1: Wrong Endpoint Version
- **Current Code:** `POST /v1/video.create` ❌ (Returns 404)
- **Should Be:** `POST /v2/video/generate` ✅

### Issue 2: Wrong Status Endpoint Format
- **Current Code:** `GET /v1/video-status.get` ❌ (Hyphen `-`)
- **Should Be:** `GET /v1/video_status.get` ✅ (Underscore `_`)

### Issue 3: Request Body Format Mismatch
- **Current Code Sends:**
  ```json
  {
    "title": "EduCore Lesson",
    "prompt": "Constructors in OOP",
    "avatar_id": "sophia-public"
  }
  ```
- **v2 API Requires:**
  ```json
  {
    "video_inputs": [{
      "character": { "avatar_id": "..." },
      "voice": { "input_text": "...", "voice_id": "..." }
    }]
  }
  ```

---

## Next Steps

1. **Execute Test Requests** (requires `HEYGEN_API_KEY`):
   ```bash
   cd backend
   node test-heygen-endpoint.js
   ```

2. **Capture Results:**
   - Status code (200, 400, 404, etc.)
   - Response body (success or error message)
   - Error details if failed

3. **Decision Point:**
   - **If Test #2 SUCCEEDS:** HeyGen auto-selects voice → Update code to v2 format without voice_id
   - **If Test #2 FAILS:** HeyGen requires voice_id → Need to use a default/public voice_id

---

## Test Script Location
`backend/test-heygen-endpoint.js`

## How to Run
1. Set `HEYGEN_API_KEY` in `.env` file or environment
2. Run: `node backend/test-heygen-endpoint.js`
3. Review console output for test results

---

## Documentation References
- Official API Docs: https://docs.heygen.com/reference/create-an-avatar-video-v2
- Video Status: https://docs.heygen.com/reference/video-status

