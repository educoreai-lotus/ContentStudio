# דוגמאות שימוש באינדקסים בשאילתות

## איך PostgreSQL משתמש באינדקסים?

PostgreSQL **בוחר אוטומטית** להשתמש באינדקס אם הוא חושב שזה מהיר יותר. אתה לא צריך לעשות כלום - זה קורה מאחורי הקלעים!

## איך לבדוק אם אינדקס משמש?

### 1. **EXPLAIN** - לראות את התוכנית
```sql
EXPLAIN SELECT * FROM topics WHERE trainer_id = 'trainer123';
```

### 2. **EXPLAIN ANALYZE** - לראות את התוכנית + זמן ביצוע
```sql
EXPLAIN ANALYZE SELECT * FROM topics WHERE trainer_id = 'trainer123';
```

## דוגמאות מעשיות

### דוגמה 1: חיפוש לפי Foreign Key

#### שאילתה:
```sql
-- מצא את כל התוכן של נושא מסוים
SELECT * FROM content WHERE topic_id = 10;
```

#### עם אינדקס (מהיר):
```
Index Scan using idx_content_topic_id on content
  Index Cond: (topic_id = 10)
  Execution Time: 0.5 ms
```

#### בלי אינדקס (איטי):
```
Seq Scan on content
  Filter: (topic_id = 10)
  Rows Removed by Filter: 9990
  Execution Time: 150 ms
```

**הבדל**: 300 פעמים יותר מהיר! 🚀

---

### דוגמה 2: JOIN בין טבלאות

#### שאילתה:
```sql
-- מצא את כל התוכן עם פרטי הנושא
SELECT 
    c.content_id,
    c.content_data,
    t.topic_name,
    t.description
FROM content c
JOIN topics t ON c.topic_id = t.topic_id
WHERE t.trainer_id = 'trainer123';
```

#### עם אינדקסים:
```
Nested Loop
  -> Index Scan using idx_topics_trainer_id on topics t
       Index Cond: (trainer_id = 'trainer123')
  -> Index Scan using idx_content_topic_id on content c
       Index Cond: (topic_id = t.topic_id)
Execution Time: 2 ms
```

#### בלי אינדקסים:
```
Hash Join
  -> Seq Scan on topics t
       Filter: (trainer_id = 'trainer123')
  -> Seq Scan on content c
Execution Time: 500 ms
```

**הבדל**: 250 פעמים יותר מהיר! 🚀

---

### דוגמה 3: חיפוש במערך (GIN Index)

#### שאילתה:
```sql
-- מצא קורסים עם skill מסוים
SELECT * FROM trainer_courses 
WHERE 'JavaScript' = ANY(skills);
```

#### עם GIN Index:
```
Bitmap Index Scan on idx_trainer_courses_skills
  Index Cond: ('JavaScript' = ANY(skills))
  -> Bitmap Heap Scan on trainer_courses
Execution Time: 1 ms
```

#### בלי GIN Index:
```
Seq Scan on trainer_courses
  Filter: ('JavaScript' = ANY(skills))
  Rows Removed by Filter: 950
Execution Time: 200 ms
```

**הבדל**: 200 פעמים יותר מהיר! 🚀

---

### דוגמה 4: חיפוש ב-JSONB (GIN Index)

#### שאילתה:
```sql
-- מצא תבניות עם format מסוים
SELECT * FROM templates 
WHERE format_order @> '["text", "code"]';
```

#### עם GIN Index:
```
Bitmap Index Scan on idx_templates_format_order
  Index Cond: (format_order @> '["text", "code"]'::jsonb)
  -> Bitmap Heap Scan on templates
Execution Time: 0.8 ms
```

#### בלי GIN Index:
```
Seq Scan on templates
  Filter: (format_order @> '["text", "code"]'::jsonb)
Execution Time: 180 ms
```

**הבדל**: 225 פעמים יותר מהיר! 🚀

---

### דוגמה 5: מיון (ORDER BY)

#### שאילתה:
```sql
-- מצא את הקורסים החדשים ביותר
SELECT * FROM trainer_courses 
ORDER BY created_at DESC 
LIMIT 10;
```

#### עם אינדקס:
```
Index Scan Backward using idx_trainer_courses_created_at on trainer_courses
  Limit: 10
Execution Time: 0.3 ms
```

#### בלי אינדקס:
```
Sort
  Sort Key: created_at DESC
  -> Seq Scan on trainer_courses
Execution Time: 120 ms
```

**הבדל**: 400 פעמים יותר מהיר! 🚀

---

### דוגמה 6: סינון + מיון

#### שאילתה:
```sql
-- מצא את כל הגרסאות של תוכן מסוים, מהחדש לישן
SELECT * FROM content_history 
WHERE content_id = 5 
ORDER BY version_number DESC;
```

#### עם אינדקסים:
```
Index Scan using idx_content_history_content_id on content_history
  Index Cond: (content_id = 5)
  -> Sort
       Sort Key: version_number DESC
       -> Index Scan using idx_content_history_version_number
Execution Time: 1 ms
```

#### בלי אינדקסים:
```
Seq Scan on content_history
  Filter: (content_id = 5)
  -> Sort
       Sort Key: version_number DESC
Execution Time: 250 ms
```

**הבדל**: 250 פעמים יותר מהיר! 🚀

---

## איך לבדוק בפועל?

### שלב 1: הרץ שאילתה עם EXPLAIN ANALYZE
```sql
EXPLAIN ANALYZE 
SELECT * FROM content 
WHERE topic_id = 10;
```

### שלב 2: בדוק את הפלט

#### ✅ **אינדקס משמש** (טוב):
```
Index Scan using idx_content_topic_id on content
  Index Cond: (topic_id = 10)
  Planning Time: 0.1 ms
  Execution Time: 0.5 ms
```

#### ❌ **אינדקס לא משמש** (איטי):
```
Seq Scan on content
  Filter: (topic_id = 10)
  Rows Removed by Filter: 9990
  Planning Time: 0.1 ms
  Execution Time: 150 ms
```

### שלב 3: אם Seq Scan - בדוק למה

**סיבות אפשריות:**
1. **טבלה קטנה** - PostgreSQL חושב ש-Seq Scan מהיר יותר
2. **אינדקס חסר** - צריך ליצור אינדקס
3. **אינדקס לא מעודכן** - צריך לרוץ `ANALYZE`

---

## מתי PostgreSQL לא משתמש באינדקס?

### 1. **טבלה קטנה מאוד**
```sql
-- אם יש רק 10 שורות, Seq Scan מהיר יותר
SELECT * FROM content_types WHERE type_id = 1;
-- PostgreSQL יעדיף Seq Scan (נכון!)
```

### 2. **חיפוש על רוב הטבלה**
```sql
-- אם אתה מחפש 80% מהשורות, Seq Scan מהיר יותר
SELECT * FROM content WHERE status != 'deleted';
-- PostgreSQL יעדיף Seq Scan (נכון!)
```

### 3. **אינדקס לא מעודכן**
```sql
-- צריך לעדכן סטטיסטיקות
ANALYZE content;
```

---

## טיפים לשיפור ביצועים

### 1. **בדוק שאילתות איטיות**
```sql
-- רשום את כל השאילתות האיטיות
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### 2. **הוסף אינדקסים לפי צורך**
```sql
-- אם יש שאילתה איטית, בדוק מה חסר
EXPLAIN ANALYZE [השאילתה שלך];

-- אם רואה Seq Scan, הוסף אינדקס:
CREATE INDEX idx_name ON table(column);
```

### 3. **Composite Index** - אינדקס על מספר עמודות
```sql
-- אם אתה מחפש לפי topic_id + content_type_id יחד
CREATE INDEX idx_content_topic_type 
ON content(topic_id, content_type_id);

-- עכשיו השאילתה הזו תהיה מהירה:
SELECT * FROM content 
WHERE topic_id = 10 AND content_type_id = 1;
```

### 4. **Partial Index** - אינדקס רק על חלק מהנתונים
```sql
-- רק על תוכן פעיל (חוסך מקום)
CREATE INDEX idx_content_active 
ON content(topic_id) 
WHERE status = 'active';
```

---

## סיכום

### ✅ **אינדקסים עובדים אוטומטית**
- PostgreSQL בוחר להשתמש בהם
- אתה לא צריך לעשות כלום
- הם משפרים ביצועים פי 100-1000

### 🔍 **איך לבדוק:**
```sql
EXPLAIN ANALYZE [השאילתה שלך];
```

### 📊 **מה לחפש:**
- ✅ `Index Scan` = אינדקס משמש (טוב!)
- ❌ `Seq Scan` = סריקה מלאה (איטי, אולי צריך אינדקס)

### 🚀 **האינדקסים שלנו כבר מוכנים:**
כל האינדקסים שיצרנו משמשים אוטומטית בכל השאילתות הרלוונטיות!

