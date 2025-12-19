# הסבר על ארכיטקטורת המערכת

## סקירה כללית

המערכת נבנתה לפי **Clean Architecture (Onion Architecture)** - ארכיטקטורה שכבותית המפרידה בין רכיבי המערכת לפי רמת התלות שלהם. הארכיטקטורה מבטיחה שהלוגיקה העסקית (Domain) לא תלויה בפרטי המימוש הטכניים (Infrastructure), מה שמאפשר גמישות, בדיקות קלות ותחזוקה פשוטה.

---

## מבנה השכבות

המערכת מחולקת ל-4 שכבות עיקריות:

```
┌─────────────────────────────────────────┐
│   Presentation Layer (שכבת הצגה)        │
│   - Controllers, Routes, Middleware     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Application Layer (שכבת יישום)        │
│   - Use Cases, DTOs, Services           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Domain Layer (שכבת דומיין)            │
│   - Entities, Repository Interfaces     │
│   - Domain Services                     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Infrastructure Layer (שכבת תשתית)     │
│   - Repository Implementations          │
│   - External APIs, Database             │
└─────────────────────────────────────────┘
```

---

## 1. Domain Layer (שכבת הדומיין)

### תפקיד השכבה
השכבה הפנימית ביותר - מכילה את הלוגיקה העסקית הטהורה של המערכת. שכבה זו **לא תלויה** בשכבות אחרות ומגדירה את החוזים (interfaces) שהשכבות החיצוניות חייבות לממש.

### אחריות:
- **Entities (ישויות)**: אובייקטים עסקיים עם לוגיקת validation
- **Repository Interfaces**: חוזים המגדירים איך לשמור ולשלוף נתונים
- **Domain Services**: שירותים עסקיים טהורים ללא תלות חיצונית

### דוגמאות:

#### דוגמה 1: Content Entity
**מיקום**: `backend/src/domain/entities/Content.js`

```javascript
export class Content {
  constructor({
    content_id,
    topic_id,
    content_type_id,
    content_data,
    generation_method_id,
    // ...
  }) {
    this.content_id = content_id;
    this.topic_id = topic_id;
    this.content_type_id = content_type_id;
    this.content_data = content_data;
    this.generation_method_id = generation_method_id;
    
    this.validate(); // ולידציה עסקית
  }

  validate() {
    // בדיקות עסקיות - למשל:
    if (!this.topic_id || this.topic_id <= 0) {
      throw new Error('topic_id must be a positive integer');
    }
    // ...
  }

  needsQualityCheck() {
    // לוגיקה עסקית: תוכן ידני צריך בדיקת איכות
    return this.generation_method_id === 'manual' || 
           this.generation_method_id === 'manual_edited';
  }
}
```

**מה זה עושה?**
- מגדיר את מבנה הנתונים של תוכן במערכת
- מכיל את כללי הוולידציה העסקיים
- מכיל לוגיקה עסקית (כמו `needsQualityCheck()`)
- **לא תלוי** בבסיס נתונים או ב-API חיצוני

#### דוגמה 2: ContentRepository Interface
**מיקום**: `backend/src/domain/repositories/ContentRepository.js`

```javascript
export class ContentRepository {
  async create(content) {
    throw new Error('ContentRepository.create() must be implemented');
  }

  async findById(contentId) {
    throw new Error('ContentRepository.findById() must be implemented');
  }

  async findByTopicId(topicId, filters = {}) {
    throw new Error('ContentRepository.findByTopicId() must be implemented');
  }

  async update(contentId, updates) {
    throw new Error('ContentRepository.update() must be implemented');
  }

  async delete(contentId, skipHistoryCheck = false) {
    throw new Error('ContentRepository.delete() must be implemented');
  }
}
```

**מה זה עושה?**
- מגדיר **חוזה** (interface) לאיך לשמור ולשלוף תוכן
- לא מכיל מימוש - רק את ההגדרה
- מאפשר לשכבות אחרות לעבוד עם ה-repository בלי לדעת איך הוא מיושם
- המימוש בפועל נמצא ב-Infrastructure Layer

---

## 2. Application Layer (שכבת היישום)

### תפקיד השכבה
מתאמת בין השכבות ומכילה את ה-Use Cases - הפעולות העסקיות שהמערכת יכולה לבצע. שכבה זו משתמשת ב-Domain Entities וב-Repository Interfaces (לא במימושים).

### אחריות:
- **Use Cases**: פעולות עסקיות ספציפיות (כמו "צור תוכן", "עדכן קורס")
- **DTOs (Data Transfer Objects)**: אובייקטים להעברת נתונים בין שכבות
- **Application Services**: שירותים שמתאמים בין מספר Use Cases

### דוגמאות:

#### דוגמה 1: CreateContentUseCase
**מיקום**: `backend/src/application/use-cases/CreateContentUseCase.js`

```javascript
export class CreateContentUseCase {
  constructor({ 
    contentRepository,      // Interface, לא מימוש
    qualityCheckService, 
    aiGenerationService, 
    contentHistoryService,
    topicRepository,
    courseRepository 
  }) {
    this.contentRepository = contentRepository;
    this.qualityCheckService = qualityCheckService;
    // ...
  }

  async execute(contentData) {
    // 1. ולידציה
    if (!contentData.topic_id) {
      throw new Error('topic_id is required');
    }

    // 2. יצירת Entity
    const content = new Content({
      ...contentData,
      generation_method_id: determinedGenerationMethod,
    });

    // 3. בדיקה אם תוכן קיים
    let existingContent = await this.contentRepository.findLatestByTopicAndType(
      content.topic_id,
      content.content_type_id
    );

    // 4. שמירה
    const createdContent = await this.contentRepository.create(content);

    // 5. בדיקת איכות אוטומטית (אם נדרש)
    if (createdContent.needsQualityCheck()) {
      await this.qualityCheckService.triggerQualityCheck(createdContent);
    }

    return createdContent;
  }
}
```

**מה זה עושה?**
- מגדיר את **הזרימה העסקית** של יצירת תוכן
- משתמש ב-Repository Interface (לא יודע איך הוא מיושם)
- מכיל את הלוגיקה של "מה קורה כשיוצרים תוכן"
- יכול להיות נבדק בקלות עם Mock Repositories

#### דוגמה 2: GenerateContentUseCase
**מיקום**: `backend/src/application/use-cases/GenerateContentUseCase.js`

```javascript
export class GenerateContentUseCase {
  constructor({ 
    contentRepository,
    aiGenerationService,
    contentHistoryService,
    topicRepository,
    courseRepository 
  }) {
    this.contentRepository = contentRepository;
    this.aiGenerationService = aiGenerationService;
    // ...
  }

  async execute({ topicId, contentType, language, ...options }) {
    // 1. שליפת מידע על הנושא
    const topic = await this.topicRepository.findById(topicId);
    const course = await this.courseRepository.findById(topic.course_id);

    // 2. בניית prompt ל-AI
    const prompt = this.buildPrompt(topic, course, contentType, language);

    // 3. יצירת תוכן באמצעות AI
    const generatedData = await this.aiGenerationService.generate({
      prompt,
      content_type: contentType,
      language,
      // ...
    });

    // 4. יצירת Entity ושמירה
    const content = new Content({
      topic_id: topicId,
      content_type_id: contentType,
      content_data: generatedData,
      generation_method_id: 'ai_generated',
    });

    return await this.contentRepository.create(content);
  }
}
```

**מה זה עושה?**
- מגדיר את הזרימה של יצירת תוכן באמצעות AI
- מתאם בין מספר שירותים (Repository, AI Service)
- מכיל את הלוגיקה של "איך ליצור תוכן עם AI"
- יכול לעבוד עם כל ספק AI (OpenAI, Gemini) כי הוא משתמש ב-Interface

---

## 3. Infrastructure Layer (שכבת התשתית)

### תפקיד השכבה
מכילה את כל המימושים הטכניים - חיבורים לבסיס נתונים, API חיצוני, אחסון קבצים וכו'. שכבה זו **מממשת** את ה-Interfaces שהוגדרו ב-Domain Layer.

### אחריות:
- **Repository Implementations**: מימוש בפועל של שמירה ושליפה מבסיס נתונים
- **External API Clients**: חיבורים ל-OpenAI, Gemini, HeyGen וכו'
- **Database**: חיבורים ל-PostgreSQL
- **Storage**: חיבורים ל-Supabase Storage

### דוגמאות:

#### דוגמה 1: ContentRepository Implementation (PostgreSQL)
**מיקום**: `backend/src/infrastructure/database/repositories/ContentRepository.js`

```javascript
import { Content } from '../../../domain/entities/Content.js';
import { ContentRepository as IContentRepository } from '../../../domain/repositories/ContentRepository.js';

export class ContentRepository extends IContentRepository {
  constructor({ db }) {
    super();
    this.db = db; // חיבור ל-PostgreSQL
  }

  async create(content) {
    // המרה מ-Entity ל-SQL
    const query = `
      INSERT INTO content (
        topic_id, 
        content_type_id, 
        content_data, 
        generation_method_id
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      content.topic_id,
      content.content_type_id,
      JSON.stringify(content.content_data),
      content.generation_method_id
    ]);

    // המרה מ-SQL ל-Entity
    return this.mapRowToContent(result.rows[0]);
  }

  async findById(contentId) {
    const query = 'SELECT * FROM content WHERE content_id = $1';
    const result = await this.db.query(query, [contentId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToContent(result.rows[0]);
  }

  mapRowToContent(row) {
    // המרה מ-SQL row ל-Content Entity
    return new Content({
      content_id: row.content_id,
      topic_id: row.topic_id,
      content_type_id: row.content_type_id,
      content_data: JSON.parse(row.content_data),
      generation_method_id: row.generation_method_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
```

**מה זה עושה?**
- **מממש** את ה-ContentRepository Interface מה-Domain
- מכיל את כל הפרטים הטכניים של עבודה עם PostgreSQL
- ממיר בין SQL rows ל-Entities
- אם נרצה לעבור ל-MongoDB, נצטרך רק ליצור מימוש חדש - ה-Use Cases לא ישתנו!

#### דוגמה 2: OpenAIClient
**מיקום**: `backend/src/infrastructure/external-apis/openai/OpenAIClient.js`

```javascript
import OpenAI from 'openai';

export class OpenAIClient {
  constructor({ apiKey }) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  async generateText(prompt, options = {}) {
    const model = options.model || 'gpt-4o';
    const temperature = options.temperature ?? 0.25;
    const max_tokens = options.max_tokens ?? 500;

    try {
      const response = await this.client.chat.completions.create({
        model,
        temperature,
        max_tokens,
        messages: [
          {
            role: 'system',
            content: options.systemPrompt || 'You are an AI assistant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      return response.choices?.[0]?.message?.content || '';
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}
```

**מה זה עושה?**
- מכיל את כל הפרטים הטכניים של עבודה עם OpenAI API
- מטפל ב-HTTP requests, errors, authentication
- אם נרצה לעבור ל-Gemini, ניצור GeminiClient דומה - ה-Use Cases לא ישתנו!

---

## 4. Presentation Layer (שכבת הצגה)

### תפקיד השכבה
השכבה החיצונית ביותר - מטפלת בבקשות HTTP ומחזירה תשובות. מתחברת ל-Use Cases ומעבירה נתונים ב-DTOs.

### אחריות:
- **Controllers**: מטפלים בבקשות HTTP ספציפיות
- **Routes**: מגדירים את ה-endpoints של ה-API
- **Middleware**: מטפלים באימות, לוגים, שגיאות וכו'
- **DTOs**: ממירים בין נתוני HTTP ל-Use Case parameters

### דוגמאות:

#### דוגמה 1: ContentController
**מיקום**: `backend/src/presentation/controllers/ContentController.js`

```javascript
import { CreateContentUseCase } from '../../application/use-cases/CreateContentUseCase.js';
import { UpdateContentUseCase } from '../../application/use-cases/UpdateContentUseCase.js';
import { ContentDTO } from '../../application/dtos/ContentDTO.js';

export class ContentController {
  constructor({
    contentRepository,
    qualityCheckService,
    aiGenerationService,
    contentHistoryService,
    // ...
  }) {
    // יצירת Use Cases
    this.createContentUseCase = new CreateContentUseCase({
      contentRepository,
      qualityCheckService,
      aiGenerationService,
      contentHistoryService,
      // ...
    });
    
    this.updateContentUseCase = new UpdateContentUseCase({
      contentRepository,
      contentHistoryService,
      // ...
    });
  }

  /**
   * POST /api/content
   * יצירת תוכן חדש
   */
  async createContent(req, res) {
    try {
      // 1. ולידציה בסיסית של ה-HTTP request
      const { topic_id, content_type_id, content_data } = req.body;
      
      if (!topic_id || !content_type_id || !content_data) {
        return res.status(400).json({ 
          error: 'Missing required fields' 
        });
      }

      // 2. קריאה ל-Use Case
      const content = await this.createContentUseCase.execute({
        topic_id,
        content_type_id,
        content_data,
        generation_method_id: req.body.generation_method_id || 'manual',
      });

      // 3. המרה ל-DTO והחזרת תשובה
      const contentDTO = ContentDTO.fromEntity(content);
      return res.status(201).json(contentDTO);
      
    } catch (error) {
      logger.error('Error creating content:', error);
      return res.status(500).json({ 
        error: error.message 
      });
    }
  }

  /**
   * PUT /api/content/:id
   * עדכון תוכן קיים
   */
  async updateContent(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updatedContent = await this.updateContentUseCase.execute(
        parseInt(id),
        updates
      );

      const contentDTO = ContentDTO.fromEntity(updatedContent);
      return res.status(200).json(contentDTO);
      
    } catch (error) {
      logger.error('Error updating content:', error);
      return res.status(500).json({ 
        error: error.message 
      });
    }
  }
}
```

**מה זה עושה?**
- מקבל בקשות HTTP (POST, PUT, GET וכו')
- ממיר את הנתונים מה-HTTP request לפורמט Use Case מצפה לו
- קורא ל-Use Case המתאים
- ממיר את התוצאה ל-DTO ומחזיר תשובה HTTP
- מטפל בשגיאות HTTP

#### דוגמה 2: Content Routes
**מיקום**: `backend/src/presentation/routes/content.js`

```javascript
import express from 'express';
import { ContentController } from '../controllers/ContentController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { AIGenerationService } from '../../infrastructure/ai/AIGenerationService.js';

const router = express.Router();

// אתחול ה-Controller עם כל התלויות
(async () => {
  const contentRepository = await RepositoryFactory.getContentRepository();
  const aiGenerationService = new AIGenerationService({
    openaiApiKey: process.env.OPENAI_API_KEY,
    // ...
  });

  const contentController = new ContentController({
    contentRepository,
    aiGenerationService,
    // ...
  });

  // הגדרת ה-routes
  router.post('/content', (req, res) => 
    contentController.createContent(req, res)
  );

  router.put('/content/:id', (req, res) => 
    contentController.updateContent(req, res)
  );

  router.get('/content/:id', (req, res) => 
    contentController.getContent(req, res)
  );
})();

export default router;
```

**מה זה עושה?**
- מגדיר את ה-endpoints של ה-API (`POST /api/content`, `GET /api/content/:id` וכו')
- מחבר בין ה-HTTP routes ל-Controllers
- מאתחל את כל התלויות (Repositories, Services) ומעביר אותן ל-Controllers
- אם נרצה להוסיף endpoint חדש, נוסיף route כאן

---

## זרימת נתונים (Data Flow)

### דוגמה: יצירת תוכן חדש

```
1. Client (Frontend)
   ↓ HTTP POST /api/content
   
2. Presentation Layer
   - Route: content.js מזהה את ה-route
   - Controller: ContentController.createContent()
   - ולידציה בסיסית של ה-HTTP request
   ↓
   
3. Application Layer
   - Use Case: CreateContentUseCase.execute()
   - לוגיקה עסקית: בדיקות, יצירת Entity
   ↓
   
4. Domain Layer
   - Entity: Content (validation, business rules)
   ↓
   
5. Application Layer
   - Use Case קורא ל-Repository Interface
   ↓
   
6. Infrastructure Layer
   - Repository Implementation: ContentRepository.create()
   - SQL query לבסיס הנתונים
   ↓
   
7. Database (PostgreSQL)
   - שמירת הנתונים
   ↓
   
8. Infrastructure Layer
   - המרת SQL row ל-Entity
   ↓
   
9. Application Layer
   - Use Case מחזיר Entity
   ↓
   
10. Presentation Layer
    - Controller ממיר ל-DTO
    - HTTP Response 201 עם התוכן החדש
    ↓
    
11. Client (Frontend)
    - מקבל את התוכן החדש
```

---

## יתרונות הארכיטקטורה

### 1. הפרדת אחריות (Separation of Concerns)
כל שכבה אחראית על דבר אחד:
- **Domain**: הלוגיקה העסקית
- **Application**: התיאום בין השכבות
- **Infrastructure**: הפרטים הטכניים
- **Presentation**: תקשורת HTTP

### 2. בדיקות קלות (Testability)
- אפשר לבדוק Use Cases עם Mock Repositories
- אפשר לבדוק Entities בלי בסיס נתונים
- כל שכבה נבדקת בנפרד

### 3. גמישות (Flexibility)
- החלפת בסיס נתונים: רק Infrastructure Layer משתנה
- החלפת ספק AI: רק Infrastructure Layer משתנה
- הוספת endpoint חדש: רק Presentation Layer משתנה

### 4. תחזוקה (Maintainability)
- קל למצוא איפה קוד מסוים נמצא
- שינויים בשכבה אחת לא משפיעים על אחרות
- קוד נקי ומאורגן

---

## סיכום

הארכיטקטורה מאפשרת:
- ✅ **לוגיקה עסקית נקייה** - ב-Domain Layer, ללא תלות חיצונית
- ✅ **מימושים גמישים** - ב-Infrastructure Layer, קל להחליף
- ✅ **תיאום ברור** - ב-Application Layer, Use Cases מובנים
- ✅ **תקשורת פשוטה** - ב-Presentation Layer, HTTP requests/responses

כל שכבה תלויה רק בשכבות הפנימיות לה, מה שיוצר מבנה יציב, גמיש וקל לתחזוקה.

