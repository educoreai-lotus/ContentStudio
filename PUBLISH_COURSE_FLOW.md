# Publish Course Flow - Complete Documentation

## 🔄 תהליך מלא: לחיצה על Publish → Validation → Course Builder

---

## 📍 Frontend Flow

### 1. **לחיצה על כפתור "Publish Course"**

**מיקום:** `frontend/src/pages/Courses/CourseDetail.jsx`

**כפתור:**
- מופיע ב-"Quick Actions" section
- Disabled אם: `!isCourseReadyToPublish()` או `publishing === true`
- Tooltip: "Complete all required content and exercises before transferring the course to Course Builder."

**Client-side validation (pre-check):**
```javascript
const isCourseReadyToPublish = () => {
  if (!topics || topics.length === 0) return false;
  // Check if all topics have templates
  return topics.every(topic => topic.template_id);
};
```

---

### 2. **`handlePublishCourse()` Function**

**תהליך:**
1. `setPublishing(true)` - מציג loading state
2. `setPublishError(null)` - מנקה שגיאות קודמות
3. `setPublishSuccess(false)` - מנקה הודעות הצלחה קודמות
4. קורא ל-`coursesService.publish(courseId)`
5. מטפל בתגובה/שגיאה
6. `setPublishing(false)` - מסיים loading

---

### 3. **API Call**

**Service:** `frontend/src/services/courses.js`
```javascript
async publish(courseId) {
  const response = await apiClient.post(`/api/courses/${courseId}/publish`);
  return response.data;
}
```

**Endpoint:** `POST /api/courses/:id/publish`

---

## 🔍 Backend Flow

### 1. **Route Handler**

**מיקום:** `backend/src/presentation/routes/courses.js`
```javascript
router.post('/:id/publish', courseController.publish.bind(courseController));
```

---

### 2. **Controller Method**

**מיקום:** `backend/src/presentation/controllers/CourseController.js`

**`publish()` method:**
1. ממיר `courseId` ל-integer
2. קורא ל-`publishCourseUseCase.execute(courseId)`
3. מחזיר תגובה:
   - **200 OK** - הצלחה: `{ success: true, message: "..." }`
   - **400 Bad Request** - Validation failed: `{ success: false, error: { code: "VALIDATION_FAILED", message: "..." } }`
   - **500 Internal Server Error** - Transfer failed: `{ success: false, error: { code: "TRANSFER_FAILED", message: "..." } }`

---

### 3. **Use Case: `PublishCourseUseCase.execute()`**

**מיקום:** `backend/src/application/use-cases/PublishCourseUseCase.js`

**תהליך:**

#### שלב 1: Validation
```javascript
const validation = await this.validateCourse(courseId);
```

**מה נבדק:**
1. ✅ Course קיים
2. ✅ יש לפחות topic אחד
3. ✅ כל topic יש לו `template_id`
4. ✅ Template קיים ב-DB
5. ✅ Template יש `format_order` (לא ריק)
6. ✅ כל format ב-`format_order` יש content
7. ✅ Content לא ריק
8. ✅ Content לא failed (בדיקה מיוחדת ל-avatar_video: `videoUrl` קיים)

**אם validation נכשל:**
```javascript
throw new Error(`Cannot transfer the course:\n${err.issue} for the lesson: "${err.topic}"`);
```

#### שלב 2: Build Course Object
```javascript
const courseData = await this.buildCourseObject(courseId);
```

**מבנה:**
```json
{
  "course_id": "1",
  "course_name": "JavaScript Fundamentals",
  "course_description": "...",
  "course_language": "en",
  "trainer_id": "trainer-1",
  "trainer_name": "trainer-1",
  "topics": [
    {
      "topic_id": "1",
      "topic_name": "Variables",
      "topic_description": "...",
      "topic_language": "en",
      "template_id": "1",
      "format_order": ["text_audio", "code", "presentation", ...],
      "contents": [
        {
          "content_id": "1",
          "content_type": "text_audio",
          "content_data": { ... }
        }
      ],
      "devlab_exercises": ""
    }
  ]
}
```

#### שלב 3: Send to Course Builder
```javascript
// We do NOT publish the course here.
// We ONLY transfer it to Course Builder, which handles final publishing and visibility.
await sendCourseToCourseBuilder(courseData);
```

**אם נכשל:**
```javascript
throw new Error('Transfer failed — Course Builder could not receive the data. Please try again later.');
```

#### שלב 4: Return Success
```javascript
return {
  success: true,
  message: 'The course has been successfully transferred to Course Builder for publishing.',
};
```

---

### 4. **Course Builder Client**

**מיקום:** `backend/src/infrastructure/courseBuilderClient/courseBuilderClient.js`

**`sendCourseToCourseBuilder(courseData)`:**
1. בודק אם `COURSE_BUILDER_URL` מוגדר
2. בונה `courseObject` בפורמט הנדרש:
   ```json
   {
     "microservice_name": "content_studio",
     "payload": { ... }
   }
   ```
3. Stringify את כל האובייקט
4. שולח `POST` ל-`{COURSE_BUILDER_URL}/api/receive-course`
   - Headers: `Content-Type: application/x-www-form-urlencoded`
   - Body: `serviceName=ContentStudio&payload={STRINGIFIED_JSON}`
5. Fire-and-forget (לא מצפה לתגובה)

**אם נכשל:**
- זורק error → `PublishCourseUseCase` תופס ומחזיר הודעת שגיאה

---

## ✅ Success Flow

### Backend Response:
```json
{
  "success": true,
  "message": "The course has been successfully transferred to Course Builder for publishing."
}
```

### Frontend Display:
- ✅ הודעת הצלחה ירוקה:
  > "The course has been successfully transferred to Course Builder for publishing."
- ✅ הודעה נעלמת אחרי 5 שניות
- ✅ `publishing` = `false`

---

## ❌ Error Flows

### 1. **Validation Failed (400)**

**Backend Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Cannot transfer the course:\nA template has not been selected for the lesson: \"Variables & Data Types\"\n\nCannot transfer the course:\nRequired format 'avatar_video' has not been generated for the lesson: \"Functions\"",
    "timestamp": "2025-01-20T10:00:00.000Z"
  }
}
```

**Frontend Display:**
- ❌ הודעת שגיאה אדומה עם `whitespace-pre-line` (תמיכה ב-`\n`)
- מציג את כל השגיאות עם שורות חדשות

**דוגמאות הודעות:**
- "Cannot transfer the course:\nA template has not been selected for the lesson: \"Variables & Data Types\""
- "Cannot transfer the course:\nRequired format 'avatar_video' has not been generated for the lesson: \"Functions\""
- "Cannot transfer the course:\nContent for format 'code' is empty or incomplete for the lesson: \"Loops\""

---

### 2. **Transfer Failed (500)**

**Backend Response:**
```json
{
  "success": false,
  "error": {
    "code": "TRANSFER_FAILED",
    "message": "Transfer failed — Course Builder could not receive the data. Please try again later.",
    "timestamp": "2025-01-20T10:00:00.000Z"
  }
}
```

**Frontend Display:**
- ❌ הודעת שגיאה אדומה:
  > "Transfer failed — Course Builder could not receive the data. Please try again later."

---

### 3. **Network/Request Error**

**Frontend Catch:**
```javascript
catch (err) {
  // Handles axios errors, network errors, etc.
  const errorMessage = err.response?.data?.error?.message || 
                      err.response?.data?.message ||
                      err.message ||
                      'Transfer failed — Course Builder could not receive the data. Please try again later.';
  setPublishError(errorMessage);
}
```

**Frontend Display:**
- ❌ הודעת שגיאה אדומה עם הודעת השגיאה המתאימה

---

## 🎨 UI States

### 1. **Button Disabled**
- `disabled={publishing || !isCourseReadyToPublish()}`
- `opacity-50 cursor-not-allowed`
- Tooltip: "Complete all required content and exercises before transferring the course to Course Builder."

### 2. **Button Loading**
- `publishing === true`
- מציג: `<i className="fas fa-spinner fa-spin"></i> Transferring...`
- Tooltip: "Transferring the course to Course Builder, please wait..."

### 3. **Button Active**
- `publishing === false` ו-`isCourseReadyToPublish() === true`
- מציג: `<i className="fas fa-paper-plane"></i> Publish Course`
- Tooltip: "Transfer course to Course Builder for publishing"

---

## 📋 Validation Rules (Detailed)

### ✅ כל Topic חייב:
1. **Template נבחר** (`template_id` לא null)
2. **Template קיים** ב-DB
3. **Template יש format_order** (לא ריק)

### ✅ כל Format ב-format_order חייב:
1. **Content קיים** עבור ה-format
2. **Content לא ריק** (בדיקה לפי סוג format)
3. **Content לא failed**:
   - Avatar video: `videoUrl` קיים ו-`!error`
   - אחר: `status !== 'failed'`

### ✅ Content Empty Checks:
- **text/audio**: `!text || text.trim().length === 0`
- **code**: `!code || code.trim().length === 0`
- **presentation**: `!presentationUrl && !fileUrl`
- **mind_map**: `!nodes || nodes.length === 0`
- **avatar_video**: `!videoUrl`

---

## 🔍 Debugging

### Logs to Check:

**Backend:**
- `[PublishCourseUseCase]` - Validation logs
- `[CourseBuilderClient]` - Transfer logs
- `[CourseController]` - Request/response logs

**Frontend:**
- Console errors from `handlePublishCourse`
- Network tab: `POST /api/courses/:id/publish`

---

## 🧪 Testing Checklist

- [ ] כפתור disabled כשאין templates
- [ ] כפתור disabled בזמן publishing
- [ ] Validation errors מוצגים נכון
- [ ] Success message מוצג
- [ ] Network errors מטופלים
- [ ] Course Builder מקבל את הנתונים נכון
- [ ] כל validation rules עובדים

---

## 📝 Notes

- ⚠️ **We do NOT publish the course here.**
- ⚠️ **We ONLY transfer it to Course Builder, which handles final publishing and visibility.**
- Validation הוא strict - כל שגיאה חוסמת את השליחה
- Course Builder הוא fire-and-forget - לא מצפים לתגובה
- אם Course Builder לא זמין, נזרקת שגיאה

