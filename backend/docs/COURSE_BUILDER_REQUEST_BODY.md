# גוף הבקשה מ-Course Builder ל-Content Studio

## מבנה הבקשה המלא

כאשר Course Builder שולח בקשה ל-Content Studio דרך Coordinator, המבנה הוא:

```json
{
  "requester_service": "course-builder",
  "payload": {
    "learner_id": "learner-123",
    "learner_name": "John Doe",
    "learner_company": "company-456",
    "skills": [
      "JavaScript",
      "React",
      "Node.js"
    ],
    "preferred_language": "en",
    "trainer_id": "trainer-789"
  },
  "response": {}
}
```

## פירוט השדות

### Top Level (Envelope)
- **`requester_service`** (required, string): תמיד `"course-builder"` (או וריאציות: `"course_builder"`, `"CourseBuilder"`, `"Course Builder"`)
- **`payload`** (required, object): מכיל את הנתונים של הבקשה
- **`response`** (required, object): אובייקט ריק `{}` - Content Studio ימלא אותו

### Payload Fields

#### שדות חובה (Required):
- **`learner_id`** (string): מזהה ייחודי של הלומד
- **`learner_company`** (string): מזהה החברה של הלומד
- **`skills`** (array, non-empty): מערך של כישורים/מיומנויות (חייב להכיל לפחות פריט אחד)
- **`preferred_language`** (string): קוד שפה (2-5 תווים, alphanumeric או dash)
  - דוגמאות: `"en"`, `"he"`, `"ar"`, `"en-US"`

#### שדות אופציונליים (Optional):
- **`learner_name`** (string): שם הלומד (ברירת מחדל: `""`)
- **`trainer_id`** (string | null): מזהה המאמן (אופציונלי, למציאת תוכן קיים)

## דוגמה מלאה

```json
{
  "requester_service": "course-builder",
  "payload": {
    "learner_id": "learner-abc123",
    "learner_name": "Sarah Cohen",
    "learner_company": "tech-corp-789",
    "skills": [
      "Python Programming",
      "Data Analysis",
      "Machine Learning"
    ],
    "preferred_language": "he",
    "trainer_id": "trainer-xyz456"
  },
  "response": {}
}
```

## מה Content Studio עושה עם הבקשה?

1. **מאמת את המבנה** - בודק ש-`requester_service === "course-builder"` ושיש `payload` תקין
2. **מפרס את הבקשה** - קורא ל-`parseCourseRequest(requestData)` שמאמת את השדות
3. **מחפש תוכן קיים** - מחפש קורסים ונושאים קיימים לפי:
   - `learner_company` - חיפוש קורסים של החברה
   - `skills` - חיפוש נושאים לפי כישורים
   - `trainer_id` - חיפוש תוכן של המאמן (אם קיים)
4. **מייצר תוכן חסר** - אם לא נמצא תוכן, מייצר תוכן חדש באמצעות AI
5. **מחזיר תשובה** - ממלא את `response.course` עם מערך של קורסים/נושאים

## תשובה (Response)

Content Studio ממלא את `response.course` במערך של אובייקטים:

```json
{
  "requester_service": "course-builder",
  "payload": { ... },
  "response": {
    "course": [
      {
        "course_id": "...",
        "course_name": "...",
        "topics": [ ... ]
      }
    ]
  }
}
```

## Validation Rules

הקוד ב-`parseCourseRequest.js` מאמת:

1. ✅ `payload.learner_id` - חובה, לא ריק
2. ✅ `payload.learner_company` - חובה, לא ריק
3. ✅ `payload.skills` - חובה, מערך לא ריק
4. ✅ `payload.preferred_language` - חובה, מחרוזת תקינה (2-5 תווים)
5. ⚠️ `payload.learner_name` - אופציונלי (ברירת מחדל: `""`)
6. ⚠️ `payload.trainer_id` - אופציונלי (ברירת מחדל: `null`)

## שגיאות אפשריות

אם השדות לא תקינים, Content Studio מחזיר:

```json
{
  "requester_service": "course-builder",
  "payload": { ... },
  "response": {
    "course": []
  }
}
```

(מערך ריק במקרה של שגיאה)

## Endpoint

הבקשה נשלחת ל:
```
POST /api/fill-content-metrics/
```

דרך Coordinator עם:
- Headers: `X-Service-Name`, `X-Signature`, `X-Request-Timeout`
- Body: ה-envelope המלא (JSON stringified)






