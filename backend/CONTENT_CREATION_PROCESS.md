# תהליך יצירת תוכן - תיעוד מפורט

## סקירה כללית

המערכת מבצעת תהליך קפדני של בדיקות לפני שמירת תוכן בבסיס הנתונים. התהליך כולל:
1. **חילוץ טקסט** מקבצים (PDF, PPTX, PPT)
2. **בדיקת שפה** - וידוא שהתוכן בשפה הנכונה
3. **בדיקת איכות ומקוריות** - וידוא שהתוכן רלוונטי, מקורי, ומותאם לרמת הקושי
4. **שמירה בבסיס הנתונים** - רק אם כל הבדיקות עברו
5. **יצירת אודיו** - רק אם התוכן נשמר בהצלחה

---

## 1. חילוץ טקסט מקבצים (FileTextExtractor)

### מטרה
חילוץ טקסט מקבצי מצגות (PDF, PPTX, PPT) לצורך בדיקת שפה ואיכות.

### תהליך

#### 1.1. זיהוי סוג הקובץ
- המערכת מזהה את סוג הקובץ לפי הסיומת (`.pdf`, `.pptx`, `.ppt`)
- אם הקובץ הוא Buffer, הוא נשמר קודם לקובץ זמני

#### 1.2. חילוץ טקסט לפי סוג קובץ

**PDF (.pdf):**
1. ניסיון לטעון את `pdf-parse` (ES module import)
2. אם נכשל בגלל שגיאת test file, ניסיון עם `require` (CommonJS fallback)
3. קריאת הקובץ כ-Buffer
4. חילוץ הטקסט באמצעות `pdf-parse`
5. **Fallback**: אם החילוץ נכשל או מחזיר מעט טקסט (< 10 תווים), ניסיון עם Vision API

**PPTX (.pptx):**
1. שימוש ב-`PptxExtractorPro` (חילוץ מותאם אישית)
2. פתיחת הקובץ כ-ZIP (PPTX הוא קובץ ZIP)
3. קריאת קבצי XML מתוך `ppt/slides/slideX.xml`
4. חילוץ טקסט מכל ה-slides באמצעות `fast-xml-parser`
5. **Fallback**: אם החילוץ נכשל או מחזיר מעט טקסט, ניסיון עם Vision API

**PPT (.ppt):**
1. שימוש ב-`mammoth` לחילוץ טקסט
2. **Fallback**: אם החילוץ נכשל, ניסיון עם קובץ PDF/PPTX חלופי (אם קיים)

#### 1.3. Vision API Fallback
אם החילוץ המקומי נכשל או מחזיר מעט טקסט:

1. **המרת קבצים לתמונות:**
   - **PDF**: שימוש ב-`pdftoppm` (poppler-utils) או ImageMagick
   - **PPTX**: שימוש ב-`libreoffice` או `unoconv`
   - אם הכלים לא מותקנים, Fallback נכשל

2. **שליחה ל-OpenAI Vision API:**
   - כל דף/שקף נשלח כ-base64 image
   - בקשת OCR עם prompt: "Extract all text from this image"
   - איסוף כל הטקסט מכל הדפים

3. **החזרת הטקסט המאוחד**

### קבצים רלוונטיים
- `backend/src/services/FileTextExtractor.js` - שירות מרכזי לחילוץ טקסט
- `backend/src/services/PptxExtractorPro.js` - חילוץ מותאם אישית ל-PPTX
- `backend/src/services/PdfToImageConverter.js` - המרת PDF לתמונות
- `backend/src/services/PptxToImageConverter.js` - המרת PPTX לתמונות

---

## 2. בדיקת שפה (Language Validation)

### מטרה
וידוא שהתוכן בשפה הנכונה לפני ביצוע בדיקת איכות (חוסך tokens).

### תהליך

#### 2.1. קביעת השפה הצפויה
1. קריאת ה-topic מה-DB
2. אם ל-topic יש `language`, משתמשים בו
3. אם לא, בודקים את ה-course (אם קיים) ומשתמשים ב-`course.language`
4. אם אין שפה מוגדרת, מדלגים על בדיקת השפה

#### 2.2. חילוץ טקסט לבדיקת שפה
- **תוכן רגיל**: חילוץ הטקסט המלא
- **קוד (type 2)**: חילוץ רק מה-`explanation` (הקוד עצמו אמור להיות באנגלית)
- **מצגת (type 3)**: חילוץ טקסט מהקובץ (PDF/PPTX/PPT)

#### 2.3. זיהוי שפה (detectContentLanguage)

התהליך מתבצע בשלבים:

**שלב 1: Character Ratio Detection (LanguageRatioDetector)**
- חישוב אחוז התווים לפי שפה:
  - ערבית: `[\u0600-\u06FF]`
  - עברית: `[\u0590-\u05FF]`
  - רוסית: `[\u0400-\u04FF]` (קירילי - כולל גם בולגרית, אוקראינית)
  - פרסית: `[\u06A0-\u06FF]`
  - סינית: `[\u4E00-\u9FFF]`
  - יפנית: `[\u3040-\u309F\u30A0-\u30FF]`
  - קוריאנית: `[\uAC00-\uD7AF]`
- **כלל**: אם ≥ 5% מהתווים בשפה מסוימת, מחזירים את השפה הזו
- **כלל מיוחד**: אם יש ≥ 3 תווים ערביים/עבריים/פרסיים/רוסיים/סיניים/יפניים/קוריאניים, מחזירים את השפה

**⚠️ חשוב להבין**: Character Ratio Detection עובד **רק על שפות עם כתב לא-לטיני** (non-Latin scripts) שניתן לזהות לפי Unicode ranges. 

**למה רק השפות האלה?**
- שפות לטיניות (אנגלית, ספרדית, צרפתית, גרמנית, איטלקית, פורטוגזית, הולנדית, שוודית, נורווגית, דנית, פינית, פולנית, צ'כית, קרואטית, רומנית, הונגרית, טורקית, וכו') משתמשות באותן אותיות (A-Z, a-z), ולכן **אי אפשר לזהות אותן לפי Character Ratio**.
- שפות עם כתב ייחודי (ערבית, עברית, רוסית, סינית, יפנית, קוריאנית, פרסית) יש להן Unicode ranges ייחודיים, ולכן ניתן לזהות אותן לפי אחוז התווים.

**מה קורה לשפות לטיניות?**
- שפות לטיניות מזוהות בשלבים הבאים:
  - **שלב 3**: Heuristic Detection (דפוסים נפוצים)
  - **שלב 4**: AI Detection (OpenAI) - הכי מדויק

**המערכת תומכת בכל השפות** (יותר מ-50 שפות מ-heygen-voices.json), אבל Character Ratio Detection עובד רק על שפות עם כתב לא-לטיני. השפות הלטיניות מזוהות בשלבים הבאים.

**שלב 2: Technical Terms Filtering**
- הסרת מילים טכניות באנגלית (docker, API, React, Python, etc.)
- ניתוח הטקסט המסונן
- אם יש ≥ 1 תו לא-לטיני (ערבי/עברי), מחזירים את השפה עם confidence מינימלי

**שלב 3: Heuristic Detection**
- בדיקת דפוסים נפוצים (עברית, ערבית, רוסית)
- אם מזוהה, מחזירים את השפה

**שלב 4: AI Detection (OpenAI)**
- שליחה ל-OpenAI עם prompt מותאם:
  - התעלמות ממילים טכניות באנגלית
  - התמקדות בשפה הדומיננטית
  - עדיפות לשפות לא-לטיניות
- החזרת קוד שפה (ISO 639-1)

**שלב 5: Default**
- אם כל השלבים נכשלו, מחזירים `'en'` (ברירת מחדל)

#### 2.4. השוואת שפות
1. אם הטקסט קצר מדי (< 10 תווים), מדלגים על בדיקת השפה (כנראה placeholder)
2. אם השפה המזוהה לא תואמת לשפה הצפויה:
   - זריקת שגיאה `LANGUAGE_MISMATCH`
   - **התוכן לא נשמר** - חוסך tokens על בדיקת איכות
3. אם השפה תואמת, ממשיכים לבדיקת איכות

### קבצים רלוונטיים
- `backend/src/application/use-cases/CreateContentUseCase.js` - הלוגיקה הראשית
- `backend/src/application/utils/LanguageRatioDetector.js` - זיהוי שפה לפי אחוז תווים
- `backend/src/application/utils/TechnicalTermsFilter.js` - סינון מילים טכניות

---

## 3. בדיקת איכות ומקוריות (Quality Check)

### מטרה
וידוא שהתוכן:
- **רלוונטי** (Relevance) - קשור לנושא השיעור
- **מקורי** (Originality) - לא מועתק ממקורות אחרים
- **מותאם לרמת קושי** (Difficulty Alignment) - מתאים לרמת המיומנות
- **עקבי** (Consistency) - זרימה לוגית ומבנה ברור

### תהליך

#### 3.1. Pre-Save Validation (validateContentQualityBeforeSave)
**חשוב**: בדיקה זו מתבצעת **לפני** שמירה ב-DB!

1. **חילוץ טקסט מהתוכן:**
   - תוכן רגיל: `content.text` או `content.content_data.text`
   - קוד: רק ה-`explanation`
   - מצגת: חילוץ מהקובץ (PDF/PPTX/PPT)

2. **שליחה ל-OpenAI GPT-4o:**
   - Prompt מפורט עם הקריטריונים
   - בקשה לניקוד (0-100) לכל קריטריון
   - בקשה לסיכום מפורט

3. **פירוש התשובה:**
   - חילוץ הניקודים (relevance_score, originality_score, difficulty_score, consistency_score)
   - שימוש ב-`??` (nullish coalescing) כדי לא לטפל ב-`0` כ-falsy
   - אם ניקוד חסר או `undefined`, זורקים שגיאה

4. **בדיקת סף מינימלי:**
   - Relevance: ≥ 70
   - Originality: ≥ 70
   - Difficulty Alignment: ≥ 60
   - Consistency: ≥ 60

5. **תוצאה:**
   - אם כל הניקודים עוברים: מחזירים `true` + ניקודים + סיכום
   - אם לא: זורקים שגיאה `QUALITY_CHECK_FAILED` עם פרטים

#### 3.2. שמירה ב-DB
רק אם `validateContentQualityBeforeSave` עבר:

1. שמירת התוכן ב-`content` table
2. יצירת רשומת `quality_check` עם הניקודים והסיכום
3. עדכון `quality_check_status` ל-`'approved'`

#### 3.3. Rollback במקרה של כשלון
אם יצירת רשומת `quality_check` נכשלה:
- מחיקת התוכן מה-DB
- זריקת שגיאה

### קבצים רלוונטיים
- `backend/src/infrastructure/ai/QualityCheckService.js` - שירות בדיקת איכות
- `backend/src/application/use-cases/CreateContentUseCase.js` - שימוש בשירות

---

## 4. יצירת אודיו (Audio Generation)

### מטרה
יצירת אודיו אוטומטית לתוכן טקסט שנשמר בהצלחה.

### תהליך

1. **בדיקה אם צריך ליצור אודיו:**
   - התוכן נשמר בהצלחה
   - `quality_check_status === 'approved'`
   - **התוכן הוא מסוג טקסט (type 1)** - לא קוד ולא מצגת
   - הטקסט קיים ולא ריק
   - הטקסט לא עולה על 4000 תווים
   - אין כבר `audioUrl` קיים

2. **יצירת אודיו:**
   - שימוש ב-**OpenAI TTS-1 API** (לא HeyGen)
   - בחירת קול מתאים לפי השפה (`getTTSVoiceForLanguage`)
   - אם הטקסט ארוך מ-4000 תווים, ביצוע סיכום לפני יצירת האודיו
   - יצירת אודיו בפורמט MP3
   - שמירה ב-Supabase Storage עם חתימה דיגיטלית

3. **עדכון התוכן:**
   - עדכון `audioUrl` ב-`content_data`
   - עדכון `audioFormat`, `audioDuration`, `audioVoice`

### חשוב
- **אודיו נוצר רק לתוכן טקסט (type 1)** - לא לקוד (type 2) ולא למצגות (type 3)
- **אודיו נוצר רק אם התוכן נשמר בהצלחה**
- **אודיו לא נוצר אם בדיקת האיכות נכשלה**
- **השימוש הוא ב-OpenAI TTS-1, לא ב-HeyGen** (HeyGen משמש רק ל-avatar videos - type 6)

---

## 5. סדר הפעולות המלא

```
1. קבלת בקשה ליצירת תוכן
   ↓
2. בדיקה אם זה תוכן ידני (manual)
   ↓
3. [אם manual] חילוץ טקסט מהתוכן/קובץ
   ↓
4. [אם manual] בדיקת שפה
   ├─ אם שפה לא תואמת → שגיאה, לא ממשיכים
   └─ אם שפה תואמת → ממשיכים
   ↓
5. [אם manual] בדיקת איכות (Pre-Save Validation)
   ├─ אם נכשל → שגיאה, לא שומרים ב-DB
   └─ אם עבר → ממשיכים
   ↓
6. שמירה ב-DB (content table)
   ↓
7. יצירת רשומת quality_check
   ├─ אם נכשל → מחיקת התוכן, שגיאה
   └─ אם הצליח → ממשיכים
   ↓
8. [אם type 1 - טקסט] יצירת אודיו (OpenAI TTS-1)
   ├─ אם type 2 (קוד) או type 3 (מצגת) → מדלגים
   └─ אם type 1 (טקסט) → יוצרים אודיו
   ↓
9. החזרת תגובה למשתמש
```

---

## 6. טיפול בשגיאות

### שגיאות אפשריות

1. **LANGUAGE_DETECTION_FAILED**
   - **מתי**: לא הצלחנו לחלץ טקסט ממצגת
   - **פעולה**: התוכן לא נשמר, לא נוצר אודיו
   - **הודעה למשתמש**: "Failed to extract text from presentation file. Cannot validate language without text content."

2. **LANGUAGE_MISMATCH**
   - **מתי**: השפה המזוהה לא תואמת לשפה הצפויה
   - **פעולה**: התוכן לא נשמר, לא נוצר אודיו, לא מתבצעת בדיקת איכות (חוסך tokens)
   - **הודעה למשתמש**: "Content language (X) does not match expected language (Y). Please create content in the correct language."

3. **QUALITY_CHECK_FAILED**
   - **מתי**: אחד מהניקודים נמוך מהסף המינימלי
   - **פעולה**: התוכן לא נשמר, לא נוצר אודיו
   - **הודעה למשתמש**: "Content Rejected - Quality Check Failed" + פרטים על הבעיות

4. **PDF_EXTRACTION_FAILED**
   - **מתי**: חילוץ טקסט מ-PDF נכשל (גם עם Vision fallback)
   - **פעולה**: התוכן לא נשמר
   - **הודעה למשתמש**: "Failed to extract text from PDF file."

---

## 7. Fallbacks ו-Resilience

### חילוץ טקסט
1. **PDF**: `pdf-parse` → `require` fallback → Vision API
2. **PPTX**: `PptxExtractorPro` → Vision API
3. **PPT**: `mammoth` → PDF/PPTX fallback → Vision API

### Vision API Fallback
- **דרישות**: `poppler-utils` (למקרה של PDF) או `libreoffice`/`unoconv` (למקרה של PPTX)
- **אם לא מותקן**: Fallback נכשל, אבל המערכת מנסה את השיטות המקומיות קודם

### זיהוי שפה
1. Character Ratio Detection (הכי מהיר)
2. Technical Terms Filtering
3. Heuristic Detection
4. AI Detection (הכי מדויק, אבל יקר)
5. Default to 'en'

---

## 8. דרישות מערכת

### חבילות Node.js
- `pdf-parse` - חילוץ טקסט מ-PDF
- `jszip` + `fast-xml-parser` - חילוץ טקסט מ-PPTX
- `mammoth` - חילוץ טקסט מ-PPT
- `openai` - Vision API, AI detection, ו-TTS-1 (יצירת אודיו)

### כלים חיצוניים (אופציונליים, ל-Vision fallback)
- `poppler-utils` (למקרה של PDF): `sudo apt-get install poppler-utils` (Linux) או `brew install poppler` (Mac)
- `libreoffice` או `unoconv` (למקרה של PPTX): `sudo apt-get install libreoffice` (Linux) או `brew install libreoffice` (Mac)

### משתני סביבה
- `OPENAI_API_KEY` - נדרש ל-AI detection, Vision API, ו-TTS-1 (יצירת אודיו)
- `SUPABASE_URL` + `SUPABASE_KEY` - נדרש לשמירת קבצים
- `HEYGEN_API_KEY` - נדרש רק ל-avatar videos (type 6), לא ליצירת אודיו רגיל

---

## 9. דוגמאות שימוש

### תוכן רגיל (טקסט - type 1)
```
1. חילוץ טקסט: content.text
2. בדיקת שפה: detectContentLanguage(content.text)
3. בדיקת איכות: validateContentQualityBeforeSave(content)
4. שמירה ב-DB
5. יצירת אודיו (OpenAI TTS-1) ✅
```

### קוד (type 2)
```
1. חילוץ טקסט: רק content.content_data.explanation
2. בדיקת שפה: רק על ה-explanation (הקוד עצמו באנגלית)
3. בדיקת איכות: על ה-explanation
4. שמירה ב-DB
5. ❌ אין יצירת אודיו (רק לתוכן טקסט)
```

### מצגת (type 3)
```
1. הורדת הקובץ מ-Supabase Storage
2. חילוץ טקסט: FileTextExtractor.extractTextFromUrl()
   ├─ PDF: pdf-parse → Vision API (אם צריך)
   ├─ PPTX: PptxExtractorPro → Vision API (אם צריך)
   └─ PPT: mammoth → PDF/PPTX fallback → Vision API (אם צריך)
3. בדיקת שפה: detectContentLanguage(extractedText)
   ├─ אם נכשל → LANGUAGE_DETECTION_FAILED
   └─ אם הצליח → ממשיכים
4. בדיקת איכות: validateContentQualityBeforeSave(content)
5. שמירה ב-DB
6. ❌ אין יצירת אודיו (רק לתוכן טקסט)
```

---

## 10. לוגים ודיבוג

### לוגים חשובים
- `[FileTextExtractor]` - חילוץ טקסט
- `[CreateContentUseCase]` - תהליך יצירת תוכן
- `[QualityCheckService]` - בדיקת איכות
- `[LanguageRatioDetector]` - זיהוי שפה לפי אחוז תווים

### נקודות בדיקה
1. האם הטקסט נחלץ בהצלחה?
2. מה השפה המזוהה?
3. מה הניקודים בבדיקת האיכות?
4. האם התוכן נשמר ב-DB?
5. האם האודיו נוצר?

---

## סיכום

המערכת מבצעת תהליך קפדני של בדיקות לפני שמירת תוכן:
1. **חילוץ טקסט** - עם fallbacks מרובים
2. **בדיקת שפה** - לפני בדיקת איכות (חוסך tokens)
3. **בדיקת איכות** - לפני שמירה ב-DB
4. **שמירה ב-DB** - רק אם הכל עבר
5. **יצירת אודיו** - רק אם התוכן נשמר

**עקרונות מרכזיים**:
1. אם בדיקה נכשלה, התוכן **לא נשמר** ולא נוצר אודיו. זה מבטיח שרק תוכן איכותי נשמר במערכת.
2. **אודיו נוצר רק לתוכן טקסט (type 1)** - לא לקוד (type 2) ולא למצגות (type 3).
3. **האודיו נוצר עם OpenAI TTS-1**, לא עם HeyGen (HeyGen משמש רק ל-avatar videos - type 6).

