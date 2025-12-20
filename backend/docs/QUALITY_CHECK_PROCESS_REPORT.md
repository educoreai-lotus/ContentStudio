# דוח תהליך בדיקת שפה, מקוריות ואיכות תוכן

## 📋 סיכום התהליך

התהליך של בדיקת שפה, מקוריות ואיכות תוכן **כן מתבצע** ליצירה ידנית של תוכן.

---

## 🔄 זרימת התהליך המלא

### 1. **Frontend - יצירה ידנית**
**קובץ:** `frontend/src/pages/Content/ManualContentForm.jsx`
- **שורה 198**: קורא ל-`contentService.approve()` עם `generation_method_id: 'manual'`
- **שורה 204**: מגדיר `generation_method_id: 'manual'` - זה מה שמפעיל את כל התהליך

### 2. **Backend Controller - נקודת כניסה**
**קובץ:** `backend/src/presentation/controllers/ContentController.js`
- **שורה 120**: `ContentController.approve()` קורא ל-`CreateContentUseCase.execute()`
- **שורה 117**: מעביר את `generation_method_id: 'manual'`

### 3. **CreateContentUseCase - הלוגיקה הראשית**
**קובץ:** `backend/src/application/use-cases/CreateContentUseCase.js`

#### שלב 1: זיהוי תוכן ידני (שורות 86-103)
```javascript
const isManualContent = content.generation_method_id === 'manual' || content.generation_method_id === 'manual_edited';
const needsQualityCheck = isManualContent && this.qualityCheckService;
```
- ✅ בודק אם זה תוכן ידני
- ✅ בודק אם יש `qualityCheckService` זמין
- ❌ **אם אין qualityCheckService - זורק שגיאה** (שורה 91-93)

#### שלב 2: בדיקת שפה (שורות 105-281)
**מיקום:** `CreateContentUseCase.execute()` - לפני שמירה ל-DB

**מה זה עושה:**
1. **שורה 112**: שולף את הטופיק
2. **שורות 114-129**: בודק את השפה הצפויה (מהטופיק או מהקורס)
3. **שורה 134**: מחלץ טקסט מהתוכן (`extractTextForLanguageValidation`)
4. **שורה 169/213**: מזהה את השפה של התוכן (`detectContentLanguage`)
5. **שורות 181-251**: **בודק אם השפה תואמת** - אם לא, **זורק שגיאה ומונע שמירה**

**תוכן ספציפי:**
- **מצגת (type 3)**: מחלץ טקסט מהקובץ - אם נכשל, זורק שגיאה
- **קוד (type 2)**: בודק רק את ההסבר (הקוד עצמו צריך להיות באנגלית)
- **טקסט (type 1)**: בודק את כל הטקסט

**תוצאה:**
- ✅ אם השפה תואמת → ממשיך
- ❌ אם השפה לא תואמת → **זורק שגיאה, התוכן לא נשמר**

#### שלב 3: בדיקת איכות (שורות 450-474)
**מיקום:** `CreateContentUseCase.execute()` - לפני שמירה ל-DB

**מה זה עושה:**
1. **שורה 456**: בודק אם צריך quality check (תוכן ידני + אין status 'approved')
2. **שורה 461**: קורא ל-`qualityCheckService.validateContentQualityBeforeSave()`
3. **שורה 466**: אם עבר → ממשיך
4. **שורה 468-472**: אם נכשל → **זורק שגיאה, התוכן לא נשמר**

### 4. **QualityCheckService - הבדיקות הספציפיות**
**קובץ:** `backend/src/infrastructure/ai/QualityCheckService.js`

#### `validateContentQualityBeforeSave()` (שורות 38-210)

**מה זה עושה:**
1. **שורה 56**: מחלץ טקסט מהתוכן (`extractTextFromContent`)
2. **שורות 74-86**: שולף מידע על הטופיק והקורס
3. **שורה 89**: קורא ל-`evaluateContentWithOpenAI()` - בודק עם GPT-4o

**הבדיקות:**
1. **Relevance (רלוונטיות)** - שורות 103-131
   - **מינימום: 60/100**
   - ✅ אם עבר → ממשיך
   - ❌ אם נכשל → **זורק שגיאה**

2. **Originality (מקוריות)** - שורות 137-149
   - **מינימום: 75/100** (יותר מחמיר!)
   - ✅ אם עבר → ממשיך
   - ❌ אם נכשל → **זורק שגיאה**

3. **Difficulty Alignment** - שורות 153-162
   - **מינימום: 60/100**
   - ✅ אם עבר → ממשיך
   - ❌ אם נכשל → **זורק שגיאה**

4. **Consistency** - שורות 170-179
   - **מינימום: 60/100**
   - ✅ אם עבר → ממשיך
   - ❌ אם נכשל → **זורק שגיאה**

**תוצאה:**
- ✅ אם כל הבדיקות עברו → מחזיר תוצאות
- ❌ אם אחת נכשלה → **זורק שגיאה**

### 5. **שמירה ל-DB (שורות 476-522)**
**רק אם כל הבדיקות עברו:**
- **שורה 477**: שומר תוכן ל-DB
- **שורות 483-521**: יוצר רשומת quality check ומעדכן את התוכן עם התוצאות
- **שורה 498**: מעדכן `quality_check_status: 'approved'`

### 6. **יצירת אודיו (שורות 524-563)**
**רק אם בדיקת האיכות עברה:**
- **שורה 533**: בודק שוב ש-`quality_check_status === 'approved'`
- **שורה 540**: יוצר אודיו רק אם הכל תקין

---

## 🔍 נקודות חיבור ספציפיות

### יצירה ידנית - מצגת
**Frontend:** `ManualContentForm.jsx` (שורה 198)
→ **Backend:** `ContentController.approve()` (שורה 120)
→ **Use Case:** `CreateContentUseCase.execute()` (שורה 20)
→ **Language Check:** שורות 105-281
→ **Quality Check:** שורות 450-474
→ **QualityCheckService:** `validateContentQualityBeforeSave()` (שורה 38)

### יצירה ידנית - טקסט
**Frontend:** `ManualContentForm.jsx` (שורה 198)
→ **Backend:** `ContentController.approve()` (שורה 120)
→ **Use Case:** `CreateContentUseCase.execute()` (שורה 20)
→ **Language Check:** שורות 105-281
→ **Quality Check:** שורות 450-474
→ **QualityCheckService:** `validateContentQualityBeforeSave()` (שורה 38)

### יצירה ידנית - קוד
**Frontend:** `ManualContentForm.jsx` (שורה 198)
→ **Backend:** `ContentController.approve()` (שורה 120)
→ **Use Case:** `CreateContentUseCase.execute()` (שורה 20)
→ **Language Check:** שורות 159-209 (בודק רק את ההסבר)
→ **Quality Check:** שורות 450-474
→ **QualityCheckService:** `validateContentQualityBeforeSave()` (שורה 38)

---

## ⚠️ נקודות קריטיות

1. **אם אין `qualityCheckService`** → התוכן לא נוצר (שורה 91-93)
2. **אם השפה לא תואמת** → התוכן לא נשמר (שורות 181-251)
3. **אם בדיקת האיכות נכשלה** → התוכן לא נשמר (שורות 468-472)
4. **כל הבדיקות מתבצעות לפני שמירה ל-DB** → חוסך משאבים

---

## 📊 סיכום

✅ **התהליך כן מתבצע:**
- ✅ בדיקת שפה - כן (שורות 105-281)
- ✅ בדיקת מקוריות - כן (שורות 137-149)
- ✅ בדיקת איכות - כן (שורות 450-474)

✅ **התהליך מתחבר ליצירה ידנית:**
- ✅ מצגת - כן
- ✅ טקסט - כן
- ✅ קוד - כן

✅ **התהליך מונע שמירה אם נכשל:**
- ✅ אם השפה לא תואמת → לא נשמר
- ✅ אם המקוריות < 75 → לא נשמר
- ✅ אם הרלוונטיות < 60 → לא נשמר
- ✅ אם הקושי < 60 → לא נשמר
- ✅ אם העקביות < 60 → לא נשמר

---

## 🔧 איך לבדוק אם זה עובד

1. **בדוק לוגים:**
   - חפש: `[CreateContentUseCase] Quality check evaluation`
   - חפש: `[CreateContentUseCase] ✅ Validating content quality BEFORE saving to DB`
   - חפש: `[QualityCheckService] 🔍 Validating content quality BEFORE saving to DB`

2. **בדוק שגיאות:**
   - אם יש שגיאת `LANGUAGE_MISMATCH` → בדיקת השפה עובדת
   - אם יש שגיאת `Quality check failed` → בדיקת האיכות עובדת

3. **בדוק ב-DB:**
   - `quality_check_status` צריך להיות `'approved'` אחרי יצירה מוצלחת
   - `quality_check_data` צריך להכיל את התוצאות

---

## 📝 הערות

- התהליך משתמש ב-`GPT-4o` לבדיקות (שורה 18 ב-QualityCheckService)
- כל הבדיקות מתבצעות **לפני שמירה ל-DB** כדי לחסוך משאבים
- אם בדיקה נכשלה, התוכן **לא נשמר כלל**

