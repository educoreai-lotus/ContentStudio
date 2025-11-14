# Microservices URLs - Content Studio Backend

רשימה של כל ה-microservice URLs שצריך להגדיר ב-Environment Variables.

## 📋 Environment Variables

| Variable | Microservice | Endpoint | Purpose |
|----------|--------------|----------|---------|
| `DIRECTORY_URL` | Directory | `/api/fill-directory-fields` | Trainer profiles & exercise limits |
| `COURSE_BUILDER_URL` | Course Builder | `/api/fill-course-fields` | Learner information |
| `SKILLS_ENGINE_URL` | Skills Engine | `/api/fill-skills-fields` | Trainer skills |
| `DEVLAB_URL` | DevLab | `/api/check-trainer-question` | Question validation |

## 🔧 הגדרה

### 1. Directory Microservice

**Environment Variable:** `DIRECTORY_URL`

**Endpoint:** `${DIRECTORY_URL}/api/fill-directory-fields`

**Functions:**
- `fetchTrainerProfileFromDirectory(trainerId)` - מביא trainer profile
- `fetchExerciseLimitsFromDirectory(trainerId)` - מביא exercise limits

**Payload Example:**
```json
{
  "trainer_id": "trainer-123",
  "trainer_name": "",
  "company_id": "",
  "ai_enabled": null,
  "can_publish_publicly": null
}
```

**Response Example:**
```json
{
  "trainer_id": "trainer-123",
  "trainer_name": "John Doe",
  "company_id": "company-456",
  "ai_enabled": true,
  "can_publish_publicly": false
}
```

**Rollback Mock Data:**
```json
{
  "trainer_id": "trainer-123",
  "trainer_name": "Unknown Trainer",
  "company_id": "N/A",
  "ai_enabled": false,
  "can_publish_publicly": false
}
```

---

### 2. Course Builder Microservice

**Environment Variable:** `COURSE_BUILDER_URL`

**Endpoint:** `${COURSE_BUILDER_URL}/api/fill-course-fields`

**Functions:**
- `fetchLearnerInfoFromCourseBuilder(learnerId)` - מביא learner information

**Payload Example:**
```json
{
  "learner_id": "learner-123",
  "learner_company": "",
  "skills": []
}
```

**Response Example:**
```json
{
  "learner_id": "learner-123",
  "learner_company": "Google",
  "skills": ["react", "ai", "html"]
}
```

**Rollback Mock Data:**
```json
{
  "learner_id": "learner-123",
  "learner_company": "Unknown",
  "skills": []
}
```

---

### 3. Skills Engine Microservice

**Environment Variable:** `SKILLS_ENGINE_URL`

**Endpoint:** `${SKILLS_ENGINE_URL}/api/fill-skills-fields`

**Functions:**
- `fetchTrainerSkillsFromSkillsEngine(trainerId, topic)` - מביא trainer skills

**Payload Example:**
```json
{
  "trainer_id": "trainer-123",
  "trainer_name": "",
  "topic": "React Basics",
  "skills": []
}
```

**Response Example:**
```json
{
  "trainer_id": "trainer-123",
  "trainer_name": "John Doe",
  "topic": "React Basics",
  "skills": ["react", "javascript", "jsx"]
}
```

**Rollback Mock Data:**
```json
{
  "trainer_id": "trainer-123",
  "trainer_name": "Unknown Trainer",
  "topic": "React Basics",
  "skills": []
}
```

---

### 4. DevLab Microservice

**Environment Variable:** `DEVLAB_URL`

**Endpoint:** `${DEVLAB_URL}/api/check-trainer-question`

**Functions:**
- `validateTrainerQuestion(question, courseId, trainerId)` - בודק שאלה

**Payload Example:**
```json
{
  "question": "What is React?",
  "course_id": "course-123",
  "trainer_id": "trainer-123",
  "valid": null,
  "message": "",
  "ajax": null
}
```

**Response Example (Valid):**
```json
{
  "question": "What is React?",
  "course_id": "course-123",
  "trainer_id": "trainer-123",
  "valid": true,
  "message": "",
  "ajax": {
    "test_cases": [...],
    "hints": [...]
  }
}
```

**Response Example (Invalid):**
```json
{
  "question": "What is React?",
  "course_id": "course-123",
  "trainer_id": "trainer-123",
  "valid": false,
  "message": "שאלה לא רלוונטית לקורס",
  "ajax": null
}
```

**Rollback Mock Data:**
```json
{
  "question": "What is React?",
  "course_id": "course-123",
  "trainer_id": "trainer-123",
  "valid": false,
  "message": "DevLab unavailable – returned rollback",
  "ajax": null
}
```

---

## 🔄 Protocol

כל ה-microservices משתמשים באותו פרוטוקול:

### Request
```
POST /api/{endpoint}
Content-Type: application/x-www-form-urlencoded

serviceName=ContentStudio&payload={JSON.stringify(object)}
```

### Response
```json
{
  "serviceName": "ContentStudio",
  "payload": "<stringified JSON>"
}
```

---

## 🛡️ Rollback Behavior

כל ה-microservice clients משתמשים ב-**rollback mock data** אם:

1. ה-URL לא מוגדר (`process.env.XXX_URL` is undefined)
2. ה-microservice לא זמין (network error)
3. יש timeout (30 seconds)
4. יש parse error
5. יש validation error

**זה אומר שהמערכת תמשיך לעבוד גם אם microservices לא זמינים!**

---

## 📝 דוגמה להגדרה

### ב-Development (.env file)

```bash
# Microservices URLs (Railway)
DIRECTORY_URL=https://directory-production.railway.app
COURSE_BUILDER_URL=https://course-builder-production.railway.app
SKILLS_ENGINE_URL=https://skills-engine-production.railway.app
DEVLAB_URL=https://devlab-production.railway.app
```

### ב-Railway (Environment Variables)

הגדר את כל ה-URLs ב-Railway Dashboard:

1. לך ל-Railway Dashboard
2. בחר את הפרויקט Content Studio
3. לחץ על "Variables" tab
4. הוסף את כל ה-variables:

```bash
DIRECTORY_URL=https://directory-production.railway.app
COURSE_BUILDER_URL=https://course-builder-production.railway.app
SKILLS_ENGINE_URL=https://skills-engine-production.railway.app
DEVLAB_URL=https://devlab-production.railway.app
```

---

## ✅ בדיקת הגדרות

לאחר הגדרת ה-URLs, בדוק שה-microservices עובדים:

### 1. בדוק את ה-Logs

אם ה-microservice לא זמין, תראה:
```
[WARN] [DirectoryClient] DIRECTORY_URL not configured, using rollback mock data
```

אם ה-microservice זמין, תראה:
```
[INFO] [DirectoryClient] Successfully received response from Directory
```

### 2. בדוק את ה-Responses

אם ה-microservice לא זמין:
- תקבל rollback mock data
- המערכת תמשיך לעבוד
- לא יהיו שגיאות

אם ה-microservice זמין:
- תקבל data אמיתי מה-microservice
- המערכת תעבוד עם data אמיתי

---

## 📚 קבצי Client

כל client נמצא בתיקייה `backend/src/infrastructure/`:

- `directoryClient/directoryClient.js` - Directory client
- `courseBuilderClient/courseBuilderClient.js` - Course Builder client
- `skillsEngineClient/skillsEngineClient.js` - Skills Engine client
- `devlabClient/devlabClient.js` - DevLab client

---

## 🔗 קישורים

- [Directory Client](../src/infrastructure/directoryClient/directoryClient.js)
- [Course Builder Client](../src/infrastructure/courseBuilderClient/courseBuilderClient.js)
- [Skills Engine Client](../src/infrastructure/skillsEngineClient/skillsEngineClient.js)
- [DevLab Client](../src/infrastructure/devlabClient/devlabClient.js)

