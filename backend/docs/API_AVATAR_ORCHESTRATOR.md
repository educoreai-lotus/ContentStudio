# Avatar Orchestrator API

## Overview

The Avatar Orchestrator API endpoint triggers the complete pipeline from Gamma PPTX generation to HeyGen avatar video creation. This endpoint is designed for asynchronous processing and returns immediately with a job ID.

## Endpoint

```
POST /api/ai-generation/generate/avatar-orchestrator
```

## Request Body

```json
{
  "trainer_id": "trainer-123",
  "topic_id": 5,
  "language_code": "he",
  "mode": "avatar",
  "input_text": "This is a presentation about React components and their lifecycle methods.",
  "ai_slide_explanations": [
    "ברוכים הבאים למצגת על רכיבי React.",
    "היום נלמד על רכיבים פונקציונליים.",
    "רכיבים פונקציונליים פשוטים יותר מרכיבי מחלקה."
  ]
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `trainer_id` | string | Yes | Trainer identifier |
| `topic_id` | number | Yes | Topic identifier |
| `language_code` | string | Yes | Language code (e.g., "he", "en", "ar") |
| `mode` | string | Yes | Must be "avatar" to proceed |
| `input_text` | string | Yes (if mode="avatar") | Text content for Gamma presentation generation |
| `ai_slide_explanations` | Array | Yes (if mode="avatar") | AI-generated slide explanations (strings or objects) |

## Response Examples

### Success - Mode is "avatar" (202 Accepted)

The orchestrator starts processing and returns immediately:

```json
{
  "success": true,
  "status": "accepted",
  "message": "Avatar video generation started",
  "video_id": null,
  "jobId": "job-1702473600000-abc123"
}
```

**Status Code:** `202 Accepted`

**Note:** The `video_id` will be `null` initially. The video generation happens asynchronously. Use the `jobId` to track progress (if job tracking is implemented).

### Skipped - Mode is not "avatar" (200 OK)

If `mode` is not "avatar", the request is skipped:

```json
{
  "success": true,
  "status": "skipped",
  "message": "Mode \"presentation\" is not \"avatar\", skipping orchestrator"
}
```

**Status Code:** `200 OK`

### Validation Error (400 Bad Request)

```json
{
  "success": false,
  "error": "Missing or invalid trainer_id"
}
```

**Status Code:** `400 Bad Request`

### Service Not Configured (503 Service Unavailable)

```json
{
  "success": false,
  "error": "Gamma client not configured or disabled"
}
```

**Status Code:** `503 Service Unavailable`

## Pipeline Steps

When `mode === "avatar"`, the orchestrator executes the following steps:

1. **Gamma PPTX Generation** - Generates presentation with max 10 slides
2. **Slide Image Extraction** - Extracts images from PPTX slides (public URLs)
3. **Speech Building** - Builds speaker text from AI explanations
4. **SlidePlan Creation** - Combines images and speeches into structured plan
5. **Voice ID Resolution** - Resolves HeyGen voice_id from language code
6. **Payload Building** - Builds HeyGen template payload
7. **HeyGen Video Generation** - Calls HeyGen template API to generate video

## Error Handling

If any step fails, the orchestrator throws an `OrchestratorStepError` with:
- `step`: The step that failed (e.g., "gamma_generation", "image_extraction")
- `message`: Error message
- `jobId`: Job identifier for tracking

Errors are logged but do not affect the HTTP response (since processing is asynchronous).

## Example: cURL Request

```bash
curl -X POST http://localhost:3000/api/ai-generation/generate/avatar-orchestrator \
  -H "Content-Type: application/json" \
  -d '{
    "trainer_id": "trainer-123",
    "topic_id": 5,
    "language_code": "he",
    "mode": "avatar",
    "input_text": "This is a presentation about React components.",
    "ai_slide_explanations": [
      "ברוכים הבאים למצגת על רכיבי React.",
      "היום נלמד על רכיבים פונקציונליים."
    ]
  }'
```

## Example: JavaScript/TypeScript

```javascript
const response = await fetch('/api/ai-generation/generate/avatar-orchestrator', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    trainer_id: 'trainer-123',
    topic_id: 5,
    language_code: 'he',
    mode: 'avatar',
    input_text: 'This is a presentation about React components.',
    ai_slide_explanations: [
      'ברוכים הבאים למצגת על רכיבי React.',
      'היום נלמד על רכיבים פונקציונליים.',
    ],
  }),
});

const result = await response.json();

if (result.status === 'skipped') {
  console.log('Orchestrator skipped:', result.message);
} else if (result.status === 'accepted') {
  console.log('Job started:', result.jobId);
  // Use jobId to track progress (if tracking is implemented)
}
```

## Notes

- The endpoint returns `202 Accepted` immediately and processes asynchronously
- The `video_id` is not available in the initial response
- Use the `jobId` for tracking (if job tracking endpoints are implemented)
- If `mode !== "avatar"`, the request is skipped with `200 OK`
- All validation errors return `400 Bad Request`
- Service configuration errors return `503 Service Unavailable`

