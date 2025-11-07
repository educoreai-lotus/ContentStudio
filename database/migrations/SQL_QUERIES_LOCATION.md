# מיקום כל השאילתות SQL בקוד

## 📍 איפה השאילתות נמצאות?

כל השאילתות SQL נמצאות ב-**Repositories** - שכבת הגישה לנתונים.

## 📂 מבנה הקבצים:

```
backend/src/infrastructure/database/repositories/
├── PostgreSQLContentRepository.js          ← שאילתות על תוכן
├── PostgreSQLTopicRepository.js            ← שאילתות על נושאים/שיעורים
├── PostgreSQLCourseRepository.js           ← שאילתות על קורסים
├── PostgreSQLTemplateRepository.js         ← שאילתות על תבניות
├── PostgreSQLContentVersionRepository.js   ← שאילתות על גרסאות תוכן
├── PostgreSQLQualityCheckRepository.js     ← שאילתות על בדיקות איכות
└── LanguageStatsRepository.js              ← שאילתות על סטטיסטיקות שפות
```

## 🔍 סוגי השאילתות בכל קובץ:

### 1. **PostgreSQLContentRepository.js**
**מיקום**: `backend/src/infrastructure/database/repositories/PostgreSQLContentRepository.js`

**שאילתות:**
- `create()` - יצירת תוכן חדש
  ```sql
  INSERT INTO content (topic_id, content_type_id, content_data, generation_method_id)
  VALUES ($1, $2, $3, $4)
  RETURNING *
  ```

- `findById()` - חיפוש תוכן לפי ID
  ```sql
  SELECT * FROM content WHERE content_id = $1
  ```

- `findByTopicId()` - חיפוש כל התוכן של נושא
  ```sql
  SELECT * FROM content WHERE topic_id = $1
  ```

- `findByTopicIdAndType()` - חיפוש תוכן לפי נושא וסוג
  ```sql
  SELECT * FROM content 
  WHERE topic_id = $1 AND content_type_id = $2
  ```

- `update()` - עדכון תוכן
  ```sql
  UPDATE content 
  SET content_data = $1, updated_at = CURRENT_TIMESTAMP
  WHERE content_id = $2
  RETURNING *
  ```

- `delete()` - מחיקת תוכן
  ```sql
  DELETE FROM content WHERE content_id = $1
  ```

- `findAll()` - חיפוש עם פילטרים
  ```sql
  SELECT * FROM content 
  WHERE topic_id = $1 
  AND content_type_id = $2 
  AND generation_method_id = $3
  ```

---

### 2. **PostgreSQLTopicRepository.js**
**מיקום**: `backend/src/infrastructure/database/repositories/PostgreSQLTopicRepository.js`

**שאילתות:**
- `create()` - יצירת נושא חדש
  ```sql
  INSERT INTO topics (course_id, topic_name, description, trainer_id, language, status, skills, template_id, generation_methods_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING *
  ```

- `findById()` - חיפוש נושא לפי ID
  ```sql
  SELECT * FROM topics WHERE topic_id = $1
  ```

- `findByCourseId()` - חיפוש כל הנושאים של קורס
  ```sql
  SELECT * FROM topics WHERE course_id = $1
  ```

- `findByTrainerId()` - חיפוש כל הנושאים של מאמן
  ```sql
  SELECT * FROM topics WHERE trainer_id = $1
  ```

- `findWithContent()` - חיפוש נושא עם כל התוכן שלו
  ```sql
  SELECT 
    t.*,
    json_agg(
      json_build_object(
        'content_id', c.content_id,
        'content_type_id', c.content_type_id,
        'content_data', c.content_data,
        'generation_method_id', c.generation_method_id
      )
    ) as content
  FROM topics t
  LEFT JOIN content c ON t.topic_id = c.topic_id
  WHERE t.topic_id = $1
  GROUP BY t.topic_id
  ```

- `update()` - עדכון נושא
  ```sql
  UPDATE topics 
  SET topic_name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
  WHERE topic_id = $3
  RETURNING *
  ```

- `delete()` - מחיקת נושא
  ```sql
  DELETE FROM topics WHERE topic_id = $1
  ```

---

### 3. **PostgreSQLCourseRepository.js**
**מיקום**: `backend/src/infrastructure/database/repositories/PostgreSQLCourseRepository.js`

**שאילתות:**
- `create()` - יצירת קורס חדש
  ```sql
  INSERT INTO trainer_courses (course_name, trainer_id, description, skills, language, status, company_logo)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING *
  ```

- `findById()` - חיפוש קורס לפי ID
  ```sql
  SELECT * FROM trainer_courses WHERE course_id = $1
  ```

- `findByTrainerId()` - חיפוש כל הקורסים של מאמן
  ```sql
  SELECT * FROM trainer_courses WHERE trainer_id = $1
  ```

- `findAll()` - חיפוש כל הקורסים
  ```sql
  SELECT * FROM trainer_courses
  ```

- `update()` - עדכון קורס
  ```sql
  UPDATE trainer_courses 
  SET course_name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
  WHERE course_id = $3
  RETURNING *
  ```

- `delete()` - מחיקת קורס
  ```sql
  DELETE FROM trainer_courses WHERE course_id = $1
  ```

---

### 4. **PostgreSQLTemplateRepository.js**
**מיקום**: `backend/src/infrastructure/database/repositories/PostgreSQLTemplateRepository.js`

**שאילתות:**
- `create()` - יצירת תבנית חדשה
  ```sql
  INSERT INTO templates (template_name, template_type, created_by, format_order)
  VALUES ($1, $2, $3, $4)
  RETURNING *
  ```

- `findById()` - חיפוש תבנית לפי ID
  ```sql
  SELECT * FROM templates WHERE template_id = $1
  ```

- `findAll()` - חיפוש כל התבניות
  ```sql
  SELECT * FROM templates
  ```

- `findByCreatedBy()` - חיפוש תבניות של יוצר מסוים
  ```sql
  SELECT * FROM templates WHERE created_by = $1
  ```

- `update()` - עדכון תבנית
  ```sql
  UPDATE templates 
  SET template_name = $1, format_order = $2
  WHERE template_id = $3
  RETURNING *
  ```

- `delete()` - מחיקת תבנית
  ```sql
  DELETE FROM templates WHERE template_id = $1
  ```

---

### 5. **PostgreSQLContentVersionRepository.js**
**מיקום**: `backend/src/infrastructure/database/repositories/PostgreSQLContentVersionRepository.js`

**שאילתות:**
- `createVersion()` - יצירת גרסה חדשה
  ```sql
  INSERT INTO content_history (content_id, topic_id, content_type_id, version_number, content_data, generation_method_id)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *
  ```

- `getVersionsByContentId()` - חיפוש כל הגרסאות של תוכן
  ```sql
  SELECT * FROM content_history 
  WHERE content_id = $1 
  ORDER BY version_number DESC
  ```

- `getVersionByNumber()` - חיפוש גרסה ספציפית
  ```sql
  SELECT * FROM content_history 
  WHERE content_id = $1 AND version_number = $2
  ```

---

### 6. **LanguageStatsRepository.js**
**מיקום**: `backend/src/infrastructure/database/repositories/LanguageStatsRepository.js`

**שאילתות:**
- `incrementRequest()` - עדכון סטטיסטיקות שפה
  ```sql
  INSERT INTO language_stats (language_code, total_requests, last_used)
  VALUES ($1, 1, NOW())
  ON CONFLICT (language_code) 
  DO UPDATE SET 
    total_requests = language_stats.total_requests + 1,
    last_used = NOW()
  ```

- `getAllStats()` - חיפוש כל הסטטיסטיקות
  ```sql
  SELECT * FROM language_stats 
  ORDER BY total_requests DESC
  ```

- `getStatsByLanguage()` - חיפוש סטטיסטיקות של שפה מסוימת
  ```sql
  SELECT * FROM language_stats WHERE language_code = $1
  ```

- `recalculateFrequency()` - חישוב מחדש של תדירות שפות
  ```sql
  UPDATE language_stats 
  SET is_frequent = (
    total_requests::float / (SELECT SUM(total_requests) FROM language_stats) > 0.05
  )
  ```

---

### 7. **PostgreSQLQualityCheckRepository.js**
**מיקום**: `backend/src/infrastructure/database/repositories/PostgreSQLQualityCheckRepository.js`

**שאילתות:**
- `save()` - שמירת תוצאות בדיקת איכות
  ```sql
  UPDATE content 
  SET quality_check_data = $1, 
      quality_check_status = $2, 
      quality_checked_at = NOW()
  WHERE content_id = $3
  RETURNING *
  ```

- `findByContentId()` - חיפוש בדיקת איכות לפי תוכן
  ```sql
  SELECT quality_check_data, quality_check_status, quality_checked_at
  FROM content 
  WHERE content_id = $1
  ```

---

## 🔗 איך השאילתות נקראות?

### זרימת הקריאה:

```
Controller (API Endpoint)
    ↓
Use Case (Business Logic)
    ↓
Repository (SQL Queries) ← כאן השאילתות!
    ↓
Database (PostgreSQL)
```

### דוגמה:

**1. Controller** (`ContentController.js`):
```javascript
async getContent(req, res) {
  const content = await getContentUseCase.execute(req.params.id);
  res.json(content);
}
```

**2. Use Case** (`GetContentUseCase.js`):
```javascript
async execute(contentId) {
  return await this.contentRepository.findById(contentId);
}
```

**3. Repository** (`PostgreSQLContentRepository.js`):
```javascript
async findById(contentId) {
  const query = 'SELECT * FROM content WHERE content_id = $1';
  const result = await this.db.query(query, [contentId]);
  return result.rows[0];
}
```

---

## 📊 סיכום:

| קובץ | סוג שאילתות | כמות משוערת |
|------|-------------|-------------|
| `PostgreSQLContentRepository.js` | CRUD על תוכן | ~8 שאילתות |
| `PostgreSQLTopicRepository.js` | CRUD על נושאים | ~10 שאילתות |
| `PostgreSQLCourseRepository.js` | CRUD על קורסים | ~6 שאילתות |
| `PostgreSQLTemplateRepository.js` | CRUD על תבניות | ~6 שאילתות |
| `PostgreSQLContentVersionRepository.js` | גרסאות תוכן | ~3 שאילתות |
| `LanguageStatsRepository.js` | סטטיסטיקות שפות | ~5 שאילתות |
| `PostgreSQLQualityCheckRepository.js` | בדיקות איכות | ~2 שאילתות |

**סה"כ**: ~40 שאילתות SQL בקוד

---

## 💡 טיפים:

1. **כל השאילתות מרוכזות ב-Repositories** - קל לתחזק ולעדכן
2. **שימוש ב-Parameterized Queries** (`$1, $2`) - מונע SQL Injection
3. **כל Repository מטפל בטבלה אחת** - עקרון Single Responsibility
4. **השאילתות משתמשות באינדקסים** - ביצועים מהירים

---

## 🔍 איך למצוא שאילתה ספציפית?

1. **לפי טבלה**: חפש את שם הטבלה (למשל `content`, `topics`)
2. **לפי פעולה**: חפש `INSERT`, `SELECT`, `UPDATE`, `DELETE`
3. **לפי Repository**: עבור לקובץ ה-Repository המתאים

**דוגמה**: למצוא שאילתה של חיפוש נושא לפי מאמן:
→ `PostgreSQLTopicRepository.js` → `findByTrainerId()`

