# API Documentation

## Overview

The Content Studio API provides endpoints for managing courses, topics, content, templates, and multilingual content.

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://api.educore.ai`

## Authentication

Currently, the API does not require authentication. In production, JWT tokens will be required.

**Future:** All endpoints will require a Bearer token:
```
Authorization: Bearer <token>
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Endpoints

### Courses

#### Create Course
```
POST /api/courses
```

**Request Body:**
```json
{
  "course_name": "Introduction to JavaScript",
  "description": "Learn the basics of JavaScript",
  "created_by": "trainer123"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "course_id": 1,
    "course_name": "Introduction to JavaScript",
    "description": "Learn the basics of JavaScript",
    "created_by": "trainer123",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Get Course
```
GET /api/courses/:id
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": { ... }
}
```

#### Update Course
```
PUT /api/courses/:id
```

**Request Body:**
```json
{
  "course_name": "Updated Course Name",
  "description": "Updated description"
}
```

#### Delete Course
```
DELETE /api/courses/:id
```

**Response:** 200 OK

### Topics

#### Create Topic
```
POST /api/topics
```

**Request Body:**
```json
{
  "topic_name": "Variables and Data Types",
  "course_id": 1,
  "description": "Learn about variables",
  "created_by": "trainer123"
}
```

#### Get Topics by Course
```
GET /api/topics?course_id=1
```

### Content

#### Create Content
```
POST /api/content
```

**Request Body:**
```json
{
  "topic_id": 1,
  "content_type_id": "text",
  "content_data": {
    "text": "Content text here"
  },
  "created_by": "trainer123"
}
```

#### Get Content by Topic
```
GET /api/content?topic_id=1
```

#### Update Content
```
PUT /api/content/:id
```

**Request Body:**
```json
{
  "content_data": {
    "text": "Updated content"
  }
}
```

### Templates

#### Create Template
```
POST /api/templates
```

**Request Body:**
```json
{
  "template_name": "Standard Lesson Template",
  "format_order": ["text", "code", "presentation", "audio", "mind_map"],
  "description": "Standard template for lessons",
  "created_by": "trainer123"
}
```

**Note:** Templates must include all 5 mandatory formats: `text`, `code`, `presentation`, `audio`, `mind_map`.

#### Apply Template to Lesson
```
POST /api/templates/:templateId/apply/:topicId
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "template_id": 1,
    "topic_id": 1,
    "applied_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Get Lesson View
```
GET /api/topics/:topicId/view
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "topic_id": 1,
    "template": { ... },
    "content": [
      {
        "format_type": "text",
        "display_order": 0,
        "content": [ ... ]
      }
    ]
  }
}
```

### Multilingual Content

#### Get Lesson by Language
```
GET /api/content/multilingual/lesson?topic_id=1&preferred_language=en
```

**Query Parameters:**
- `topic_id` (required) - Topic/Lesson ID
- `preferred_language` (required) - Language code (en, he, ar, etc.)

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "topic_id": 1,
    "language": "en",
    "content": { ... },
    "source": "cache" // or "translation" or "generation"
  }
}
```

#### Get Language Statistics
```
GET /api/content/multilingual/stats
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "languages": [
      {
        "language_code": "en",
        "total_requests": 150,
        "total_lessons": 25,
        "last_used": "2024-01-15T10:30:00.000Z",
        "is_frequent": true
      }
    ],
    "summary": {
      "total_languages": 12,
      "frequent_languages": 3
    }
  }
}
```

#### Get Language Statistics by Code
```
GET /api/content/multilingual/stats/:languageCode
```

### AI Generation

#### Generate Content
```
POST /api/content/ai/generate
```

**Request Body:**
```json
{
  "topic_id": 1,
  "content_type_id": "text",
  "prompt": "Explain variables in JavaScript",
  "created_by": "trainer123"
}
```

### Video to Lesson

#### Convert Video to Lesson
```
POST /api/video-to-lesson
```

**Request:** Multipart form data with video file

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "topic_id": 1,
    "transcription": "...",
    "content": [ ... ]
  }
}
```

### Background Jobs

#### Get Job Status
```
GET /api/jobs/status
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "jobs": [
      {
        "name": "Language Evaluation",
        "schedule": "0 2 1,15 * *",
        "isActive": true
      }
    ]
  }
}
```

#### Trigger Job Manually
```
POST /api/jobs/trigger/evaluation
```

**Note:** This endpoint should be protected with admin authentication in production.

## Error Codes

- `VALIDATION_ERROR` (400) - Invalid input data
- `NOT_FOUND` (404) - Resource not found
- `DUPLICATE_ENTRY` (409) - Resource already exists
- `FOREIGN_KEY_VIOLATION` (400) - Referenced resource does not exist
- `AI_SERVICE_UNAVAILABLE` (503) - AI service unavailable
- `INTERNAL_ERROR` (500) - Internal server error

## Rate Limiting

**Future:** Rate limiting will be implemented:
- 100 requests per 15 minutes per IP
- 1000 requests per hour per authenticated user

## Swagger UI

**Future:** Swagger UI will be available at:
```
GET /api-docs
```

To enable:
1. Install dependencies: `npm install swagger-ui-express swagger-jsdoc`
2. Uncomment code in `backend/src/presentation/swagger/swagger.js`
3. Add route in `server.js`:
```javascript
import { swaggerUi, swaggerSpec } from './src/presentation/swagger/swagger.js';
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

## Examples

### Complete Lesson Creation Flow

1. **Create Course**
```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "course_name": "JavaScript Basics",
    "description": "Learn JavaScript",
    "created_by": "trainer123"
  }'
```

2. **Create Topic**
```bash
curl -X POST http://localhost:3000/api/topics \
  -H "Content-Type: application/json" \
  -d '{
    "topic_name": "Variables",
    "course_id": 1,
    "description": "Learn about variables",
    "created_by": "trainer123"
  }'
```

3. **Create Content**
```bash
curl -X POST http://localhost:3000/api/content \
  -H "Content-Type: application/json" \
  -d '{
    "topic_id": 1,
    "content_type_id": "text",
    "content_data": {"text": "Variables store data"},
    "created_by": "trainer123"
  }'
```

4. **Apply Template**
```bash
curl -X POST http://localhost:3000/api/templates/1/apply/1
```

5. **View Lesson**
```bash
curl http://localhost:3000/api/topics/1/view
```

## Future Enhancements

1. **OpenAPI Specification** - Full OpenAPI 3.0 spec
2. **Swagger UI** - Interactive API documentation
3. **Postman Collection** - Importable API collection
4. **GraphQL** - GraphQL endpoint (optional)
5. **Webhooks** - Event notifications

