# Template Application Flow

## Overview

The template application system ensures that:
1. **Trainer creates lesson content and exercises first**
2. **Trainer selects a template after content creation**
3. **Trainer sees lesson view according to the template**

## Template Requirements

### Mandatory Formats
All templates **MUST** include all 5 mandatory formats:
- `text` - Text content
- `code` - Code examples
- `presentation` - Presentation slides
- `audio` - Audio narration
- `mind_map` - Mind map visualization

### Audio-Text Relationship
- **Audio must always be with text**
- Text must appear **before audio** OR **immediately after audio** in the format order
- This ensures audio narration is always paired with readable text content

### Optional Formats
- `avatar_video` - Optional avatar video (not mandatory)

## Flow

### Step 1: Create Lesson Content
```
Trainer → Creates lesson (topic)
Trainer → Adds content items (text, code, presentation, audio, mind_map)
Trainer → Adds exercises (via DevLab integration)
```

### Step 2: Select Template
```
Trainer → Reviews available templates
Trainer → Selects template
System → Validates template includes all 5 mandatory formats
System → Validates audio-text relationship
System → Applies template to lesson
```

### Step 3: View Lesson
```
Trainer → Views lesson according to template format order
System → Displays content in template-defined sequence
System → Shows missing formats (if any)
```

## API Endpoints

### Apply Template to Lesson
```http
POST /api/templates/:templateId/apply/:topicId
```

**Request:**
```json
{
  "template_id": 1,
  "topic_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "template": {
      "template_id": 1,
      "template_name": "Standard Lesson Template",
      "format_order": ["text", "code", "presentation", "audio", "mind_map"]
    },
    "lesson": {
      "topic_id": 123,
      "topic_name": "Introduction to JavaScript",
      "template_id": 1
    },
    "ordered_content": [
      {
        "format_type": "text",
        "content": [...]
      },
      {
        "format_type": "code",
        "content": [...]
      }
    ],
    "view_data": {
      "formats": [...]
    }
  }
}
```

### Get Lesson View
```http
GET /api/topics/:topicId/view
```

**Response:**
```json
{
  "success": true,
  "data": {
    "formats": [
      {
        "type": "text",
        "display_order": 0,
        "content": [...]
      },
      {
        "type": "code",
        "display_order": 1,
        "content": [...]
      }
    ]
  }
}
```

## Validation Rules

### Template Creation
1. ✅ Must include all 5 mandatory formats
2. ✅ Audio must be with text (before or immediately after)
3. ✅ Format order must be valid array
4. ✅ Template name is required

### Template Application
1. ✅ Topic/Lesson must exist
2. ✅ Template must exist
3. ✅ Template must be valid (all formats present)
4. ✅ Content is organized according to template order

## Example Template Format Orders

### Valid Examples

**Example 1: Text before Audio**
```json
{
  "format_order": ["text", "code", "presentation", "audio", "mind_map"]
}
```

**Example 2: Text immediately after Audio**
```json
{
  "format_order": ["code", "presentation", "audio", "text", "mind_map"]
}
```

**Example 3: With Optional Avatar Video**
```json
{
  "format_order": ["avatar_video", "text", "code", "presentation", "audio", "mind_map"]
}
```

### Invalid Examples

**Invalid: Missing mandatory format**
```json
{
  "format_order": ["text", "code", "presentation"] // Missing audio and mind_map
}
```

**Invalid: Audio without text nearby**
```json
{
  "format_order": ["code", "audio", "presentation", "mind_map", "text"] // text too far from audio
}
```

## Frontend Integration

### Step 1: Content Creation Page
```jsx
// After trainer creates all content
<TemplateSelector 
  lessonId={lessonId}
  onTemplateSelected={handleTemplateSelected}
/>
```

### Step 2: Template Selection
```jsx
// Show available templates
<TemplateList 
  onSelect={async (templateId) => {
    await applyTemplate(lessonId, templateId);
    navigate(`/lessons/${lessonId}/view`);
  }}
/>
```

### Step 3: Lesson View
```jsx
// Display lesson according to template
<LessonView 
  lessonId={lessonId}
  formatOrder={template.format_order}
  content={orderedContent}
/>
```

## Error Handling

### Common Errors

1. **Template missing mandatory formats**
   - Error: `Template must include all 5 mandatory formats. Missing: audio, mind_map`
   - Solution: Add missing formats to template

2. **Audio not with text**
   - Error: `Audio format must always be with text`
   - Solution: Reorder format_order to place text before or immediately after audio

3. **No template applied**
   - Error: `Template not specified. Please apply a template to this lesson first.`
   - Solution: Apply a template using POST `/api/templates/:templateId/apply/:topicId`

## Testing

Run template validation tests:
```bash
npm test -- tests/unit/domain/entities/TemplateValidation.test.js
```

Run template application tests:
```bash
npm test -- tests/unit/application/use-cases/ApplyTemplateToLessonUseCase.test.js
```



