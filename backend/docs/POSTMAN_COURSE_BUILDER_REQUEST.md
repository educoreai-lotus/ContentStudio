# Postman Request for Course Builder via Coordinator

## Quick Start

1. **Generate Signature:**
   ```bash
   # PowerShell
   $env:CS_COORDINATOR_PRIVATE_KEY = "YOUR_PRIVATE_KEY"
   node scripts/generate-signature.js scripts/test-envelope-course-builder.json
   ```

2. **Copy the signature and headers from the output**

3. **Use in Postman** (see details below)

## Request Details

### URL
```
POST {{COORDINATOR_URL}}/api/fill-content-metrics/
```

**Example:**
```
POST https://coordinator-production-e0a0.up.railway.app/api/fill-content-metrics/
```

### Headers

```json
{
  "Content-Type": "application/json",
  "X-Service-Name": "content-studio",
  "X-Signature": "{{SIGNATURE}}",
  "X-Request-Timeout": "180000"
}
```

### Request Body (Envelope)

```json
{
  "requester_service": "content-studio",
  "payload": {
    "action": "send this trainer course to publish",
    "course_id": "course-123",
    "course_name": "Introduction to JavaScript",
    "course_description": "Learn the fundamentals of JavaScript programming",
    "course_language": "en",
    "trainer_id": "trainer-456",
    "trainer_name": "John Doe",
    "topics": [
      {
        "topic_id": "topic-789",
        "topic_name": "Variables and Data Types",
        "topic_description": "Understanding variables and different data types in JavaScript",
        "topic_language": "en",
        "template_id": "template-001",
        "format_order": ["presentation", "video", "exercises"],
        "contents": [
          {
            "content_id": "content-001",
            "content_type": "presentation",
            "content_data": {
              "file_url": "https://example.com/presentation.pptx",
              "slides_count": 10
            }
          },
          {
            "content_id": "content-002",
            "content_type": "video",
            "content_data": {
              "video_url": "https://example.com/video.mp4",
              "duration": 300
            }
          }
        ],
        "devlab_exercises": "<html><body><h1>Exercise 1</h1><p>Write a function...</p></body></html>"
      }
    ]
  },
  "response": {}
}
```

## Payload Structure

### Top Level
- `requester_service`: Always `"content-studio"`
- `payload`: Contains the course data (nested structure)
- `response`: Empty object `{}`

### Payload Structure
- `action`: Always `"send this trainer course to publish"`
- `course_id`: Unique course identifier
- `course_name`: Course title
- `course_description`: Course description
- `course_language`: Language code (e.g., "en", "he")
- `trainer_id`: Trainer identifier
- `trainer_name`: Trainer name
- `topics`: Array of topic objects

### Topic Object Structure
- `topic_id`: Unique topic identifier
- `topic_name`: Topic title
- `topic_description`: Topic description
- `topic_language`: Language code
- `template_id`: Template identifier
- `format_order`: Array of content format order (e.g., `["presentation", "video", "exercises"]`)
- `contents`: Array of content objects
- `devlab_exercises`: HTML string containing exercise code

### Content Object Structure
- `content_id`: Unique content identifier
- `content_type`: Type of content (e.g., `"presentation"`, `"video"`, `"text"`)
- `content_data`: Object containing content-specific data (e.g., `file_url`, `video_url`, `slides_count`, `duration`)

## How to Generate Signature

The signature is generated using ECDSA P-256 with the following process:

1. **Build Message:**
   ```
   message = "educoreai-{serviceName}-{sha256(JSON.stringify(envelope))}"
   ```
   Where:
   - `serviceName` = "content-studio"
   - `envelope` = the entire request body (the JSON object above)

2. **Sign Message:**
   - Use ECDSA P-256 with SHA256
   - Sign with your private key (`CS_COORDINATOR_PRIVATE_KEY`)
   - Output: Base64-encoded DER signature (no whitespace)

### Example Signature Generation (Node.js)

Use the provided script:
```bash
node scripts/generate-signature.js scripts/test-envelope-course-builder.json
```

## Postman Environment Variables

Set these in Postman:

```
COORDINATOR_URL = https://coordinator-production-e0a0.up.railway.app
SERVICE_NAME = content-studio
CS_COORDINATOR_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

## Expected Response

The Course Builder service typically returns a success response:

```json
{
  "success": true,
  "data": {
    "payload": "{...}"
  },
  "metadata": {
    "routed_to": "course-builder-service",
    "confidence": 0.95,
    "requester": "content-studio",
    "processing_time_ms": 5000
  }
}
```

**Note:** This is a "fire and forget" operation - the response may not contain detailed course information.

## Response Headers

The Coordinator will return these headers:
- `X-Service-Name`: "coordinator"
- `X-Service-Signature`: (ECDSA signature of the response body)

## Troubleshooting

1. **401 Unauthorized**: Check that signature is correct and private key matches
2. **400 Bad Request**: Check that envelope structure matches exactly
3. **502 Bad Gateway**: Coordinator cannot reach Course Builder service (service may be down)
4. **Timeout**: Increase `X-Request-Timeout` header value (default: 180000ms = 3 minutes)

## Example Request (Minimal)

For testing with minimal data:

```json
{
  "requester_service": "content-studio",
  "payload": {
    "action": "send this trainer course to publish",
    "course_id": "test-course-1",
    "course_name": "Test Course",
    "course_description": "Test description",
    "course_language": "en",
    "trainer_id": "test-trainer-1",
    "trainer_name": "Test Trainer",
    "topics": []
  },
  "response": {}
}
```

