# גוף הבקשה מ-Course Builder Service ל-Content Studio

## מבנה הבקשה המלא

כאשר Course Builder Service שולח בקשה ל-Content Studio דרך Coordinator, המבנה הוא:

```json
{
  "requester_service": "course-builder-service",
  "payload": {
    "trainer_id": "trainer-123",
    "company_id": "company-456",
    "skills_raw_data": {
      "competency_node": [
        "JavaScript",
        "React",
        "Node.js"
      ]
    },
    "career_learning_paths": [
      {
        "competency_target_name": "Full Stack Developer",
        "learning_path": {
          "path_title": "Full Stack Development Path",
          "learning_modules": [
            {
              "module_name": "Introduction to JavaScript",
              "steps": [
                {
                  "step_name": "Variables and Data Types",
                  "step_description": "Understanding variables and different data types"
                },
                {
                  "step_name": "Functions",
                  "step_description": "Learning how to create and use functions"
                }
              ]
            }
          ]
        }
      }
    ],
    "language": "en"
  },
  "response": {
    "courses": []
  }
}
```

## פירוט השדות

### Top Level (Envelope)
- **`requester_service`** (required, string): תמיד `"course-builder-service"` (case-insensitive)
- **`payload`** (required, object): מכיל את הנתונים של הבקשה
- **`response`** (required, object): אובייקט עם `courses` array - Content Studio ימלא אותו

### Payload Fields

#### שדות אופציונליים (Optional):
- **`trainer_id`** (string | null): מזהה המאמן
  - אם קיים ותקין → מחפש קורס קיים (archived) עם אותו `trainer_id`, `skills_raw_data`, ו-`company_id`
  - אם לא קיים או לא נמצא → מפעיל Full AI Generation
  
- **`company_id`** (string | null): מזהה החברה
  - משמש לחיפוש קורסים קיימים (permissions)
  
- **`skills_raw_data`** (object | null): נתוני כישורים
  - **`competency_node`** (array of strings): מערך של כישורים/מיומנויות
  - משמש לחיפוש קורסים קיימים (skills matching)
  
- **`career_learning_paths`** (array, required for AI generation): מערך של learning paths
  - כל path מייצג קורס אחד
  - **`competency_target_name`** (string): שם הקורס
  - **`learning_path`** (object): נתוני ה-learning path
    - **`path_title`** (string): כותרת ה-path
    - **`learning_modules`** (array): מערך של מודולים
      - **`module_name`** (string): שם המודול
      - **`steps`** (array): מערך של steps
        - כל step הופך ל-Topic אחד
        - **`step_name`** (string): שם ה-Topic
        - **`step_description`** (string): תיאור ה-Topic
  
- **`language`** (string, default: "en"): קוד שפה

## לוגיקת העיבוד

### שלב 1: אימות Trainer ID
```javascript
const hasValidTrainerId = trainer_id && 
                          trainer_id !== null && 
                          trainer_id !== '' && 
                          typeof trainer_id === 'string';
```

### שלב 2: חיפוש קורס קיים (אם יש trainer_id)
אם `trainer_id` תקין, מחפש קורס archived עם:
- `trainer_id` זהה
- `language` זהה
- `skills` מכיל את כל הכישורים מ-`skills_raw_data.competency_node`
- `permissions` מכיל את `company_id` (או `'all'` או `null`)

אם נמצא → מחזיר את הקורס הקיים (read-only, no modifications)

### שלב 3: Full AI Generation (fallback)
אם לא נמצא קורס קיים (או אין `trainer_id`), מפעיל Full AI Generation:
- כל `career_learning_paths` → קורס אחד
- כל `step` בתוך `learning_modules.steps` → Topic אחד
- כל Topic → מייצר 6 פורמטים:
  1. Presentation
  2. Video
  3. Exercises
  4. Mind Map
  5. Summary
  6. Avatar Video

## תשובה (Response)

Content Studio ממלא את `response.courses` במערך של אובייקטי קורס:

```json
{
  "requester_service": "course-builder-service",
  "payload": { ... },
  "response": {
    "courses": [
      {
        "course_id": "course-123",
        "course_name": "Full Stack Developer",
        "course_description": "...",
        "course_language": "en",
        "trainer_id": "trainer-123",
        "trainer_name": "...",
        "topics": [
          {
            "topic_id": "topic-456",
            "topic_name": "Variables and Data Types",
            "topic_description": "...",
            "topic_language": "en",
            "template_id": "...",
            "format_order": ["presentation", "video", "exercises", "mind_map", "summary", "avatar_video"],
            "contents": [
              {
                "content_id": "content-789",
                "content_type": "presentation",
                "content_data": { ... }
              },
              ...
            ],
            "devlab_exercises": "..."
          }
        ]
      }
    ]
  }
}
```

## דוגמה מלאה - בקשה עם Trainer ID

```json
{
  "requester_service": "course-builder-service",
  "payload": {
    "trainer_id": "trainer-abc123",
    "company_id": "company-xyz789",
    "skills_raw_data": {
      "competency_node": [
        "Python",
        "Data Analysis",
        "Machine Learning"
      ]
    },
    "language": "en"
  },
  "response": {
    "courses": []
  }
}
```

**תוצאה**: מחפש קורס archived עם אותם פרמטרים. אם נמצא → מחזיר אותו. אם לא → מחזיר `[]`.

## דוגמה מלאה - בקשה עם AI Generation

```json
{
  "requester_service": "course-builder-service",
  "payload": {
    "trainer_id": null,
    "company_id": "company-xyz789",
    "career_learning_paths": [
      {
        "competency_target_name": "Data Scientist",
        "learning_path": {
          "path_title": "Data Science Path",
          "learning_modules": [
            {
              "module_name": "Python Basics",
              "steps": [
                {
                  "step_name": "Lists and Arrays",
                  "step_description": "Understanding lists and arrays in Python"
                },
                {
                  "step_name": "Dictionaries",
                  "step_description": "Working with dictionaries"
                }
              ]
            }
          ]
        }
      }
    ],
    "language": "en"
  },
  "response": {
    "courses": []
  }
}
```

**תוצאה**: מייצר קורס חדש עם 2 Topics (Lists and Arrays, Dictionaries), כל אחד עם 6 פורמטים.

## Validation Rules

הקוד ב-`fillCourseBuilderService.js` מאמת:

1. ✅ `requestData` - חובה, object
2. ✅ `requestData.payload` - חובה, object
3. ✅ `requestData.response` - אופציונלי (יוצר `{}` אם חסר)
4. ✅ `requestData.response.courses` - אופציונלי (יוצר `[]` אם חסר)
5. ⚠️ `payload.trainer_id` - אופציונלי (string | null)
6. ⚠️ `payload.company_id` - אופציונלי (string | null)
7. ⚠️ `payload.skills_raw_data` - אופציונלי (object | null)
8. ⚠️ `payload.career_learning_paths` - אופציונלי (array, required for AI generation)
9. ⚠️ `payload.language` - אופציונלי (default: "en")

## הערות חשובות

1. **קורסים Archived הם Read-Only**: אם נמצא קורס archived, הוא מוחזר כפי שהוא, ללא שינויים
2. **Skills Matching**: הקוד מחפש קורסים עם `skills @> ARRAY[...]` (PostgreSQL array contains)
3. **Permissions**: הקוד מחפש קורסים עם `permissions` שמכיל את `company_id` או `'all'` או `null`
4. **Full AI Generation**: כל step הופך ל-Topic אחד, כל Topic מקבל 6 פורמטים






