# מדריך Testing - Content Studio

## 📋 תוכן עניינים
1. [סקירה כללית](#סקירה-כללית)
2. [סוגי Tests](#סוגי-tests)
3. [Testing Framework](#testing-framework)
4. [מבנה Tests](#מבנה-tests)
5. [Coverage Requirements](#coverage-requirements)
6. [דוגמאות](#דוגמאות)
7. [Best Practices](#best-practices)

---

## 🎯 סקירה כללית

**Testing Stack:**
- **Framework:** Jest
- **API Testing:** Supertest
- **Coverage Tool:** Jest Coverage
- **Test Types:** Unit Tests, Integration Tests, Health Checks

**Coverage Requirements:**
- **Branches:** 80%
- **Functions:** 80%
- **Lines:** 80%
- **Statements:** 80%

---

## 🧪 סוגי Tests

### 1. Unit Tests (בדיקות יחידה)

**מיקום:** `backend/tests/unit/`

**מה בודקים:**
- Entities - ולידציות, לוגיקה עסקית
- Use Cases - לוגיקה עסקית, זרימת עבודה
- Services - לוגיקה של services
- Utilities - פונקציות עזר

**תכונות:**
- ✅ מהירים (milliseconds)
- ✅ מבודדים (isolated)
- ✅ משתמשים ב-Mocks
- ✅ לא דורשים DB או API חיצוניים

**דוגמאות:**
- `tests/unit/domain/entities/Course.test.js` - ולידציות של Course
- `tests/unit/application/use-cases/CreateCourseUseCase.test.js` - לוגיקה של יצירת קורס
- `tests/unit/infrastructure/ai/AIGenerationService.test.js` - לוגיקה של AI Service

---

### 2. Integration Tests (בדיקות אינטגרציה)

**מיקום:** `backend/tests/integration/`

**מה בודקים:**
- API Endpoints - כל ה-endpoints
- Database Operations - CRUD operations
- Service Integration - אינטגרציה בין services

**תכונות:**
- ⚠️ איטיים יותר (seconds)
- ✅ בודקים אינטגרציה אמיתית
- ✅ משתמשים ב-DB אמיתי (test DB)
- ✅ משתמשים ב-Supertest ל-API calls

**קטגוריות:**

#### 2.1. API Integration Tests
**מיקום:** `tests/integration/api/`

**מה בודקים:**
- כל ה-endpoints (GET, POST, PUT, DELETE)
- ולידציות של requests
- Error handling
- Response format

**דוגמאות:**
- `tests/integration/api/courses.test.js` - כל ה-endpoints של courses
- `tests/integration/api/topics.test.js` - כל ה-endpoints של topics
- `tests/integration/api/content.test.js` - כל ה-endpoints של content
- `tests/integration/api/ai-generation.test.js` - AI generation endpoints

#### 2.2. Database Integration Tests
**מיקום:** `tests/integration/database/`

**מה בודקים:**
- CRUD operations
- Foreign Keys
- Constraints
- Transactions

**דוגמאות:**
- `tests/integration/database/postgresql.test.js` - כל ה-repositories

---

### 3. Health Check Tests

**מיקום:** `backend/tests/health.test.js`

**מה בודקים:**
- Health endpoint (`/health`)
- Server status
- Basic connectivity

---

## 🛠️ Testing Framework

### Jest Configuration

**קובץ:** `backend/jest.config.js`

```javascript
export default {
  testEnvironment: 'node',              // Node.js environment
  transform: {},                         // No transformation (ES modules)
  moduleFileExtensions: ['js'],         // Only .js files
  testMatch: ['**/tests/**/*.test.js'], // Test file pattern
  collectCoverageFrom: [
    'src/**/*.js',                      // Collect from src
    '!src/**/*.test.js',                // Exclude test files
    '!src/server.js',                   // Exclude server.js
  ],
  coverageThreshold: {
    global: {
      branches: 80,                      // 80% branch coverage
      functions: 80,                     // 80% function coverage
      lines: 80,                         // 80% line coverage
      statements: 80,                    // 80% statement coverage
    },
  },
  verbose: true,                         // Verbose output
};
```

### Test Scripts

**קובץ:** `backend/package.json`

```json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch",
    "test:coverage": "node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage"
  }
}
```

---

## 📁 מבנה Tests

```
backend/tests/
├── health.test.js                    # Health check
├── unit/                             # Unit tests
│   ├── application/
│   │   └── use-cases/               # Use Case tests
│   │       ├── CreateCourseUseCase.test.js
│   │       ├── CreateContentUseCase.test.js
│   │       ├── GenerateContentUseCase.test.js
│   │       └── ...
│   ├── domain/
│   │   └── entities/                 # Entity tests
│   │       ├── Course.test.js
│   │       ├── Topic.test.js
│   │       ├── Content.test.js
│   │       ├── Template.test.js
│   │       └── ...
│   └── infrastructure/
│       ├── ai/                       # AI Service tests
│       │   ├── AIGenerationService.test.js
│       │   └── ...
│       ├── storage/                  # Storage tests
│       │   └── SupabaseStorageClient.test.js
│       └── external-apis/            # External API tests
│           └── openai/
│               └── WhisperClient.test.js
└── integration/                      # Integration tests
    ├── api/                          # API endpoint tests
    │   ├── courses.test.js
    │   ├── topics.test.js
    │   ├── content.test.js
    │   ├── ai-generation.test.js
    │   └── ...
    └── database/                      # Database tests
        └── postgresql.test.js
```

---

## 📊 Coverage Requirements

### Coverage Thresholds

**מינימום נדרש:**
- **Branches:** 80% - כל ה-if/else, switch cases
- **Functions:** 80% - כל הפונקציות
- **Lines:** 80% - כל השורות
- **Statements:** 80% - כל ה-statements

**מה זה אומר:**
- אם coverage נמוך מ-80% → Tests נכשלים
- CI/CD בודק coverage בכל PR
- Coverage report נוצר ב-`coverage/` directory

### Coverage Exclusions

**לא נכלל ב-coverage:**
- `src/server.js` - Entry point
- `src/**/*.test.js` - Test files עצמם
- Configuration files

---

## 📝 דוגמאות

### 1. Unit Test - Entity Validation

**קובץ:** `tests/unit/domain/entities/Course.test.js`

```javascript
import { Course } from '../../../../src/domain/entities/Course.js';

describe('Course Entity', () => {
  describe('constructor', () => {
    it('should create a course with valid data', () => {
      const courseData = {
        course_id: 1,
        course_name: 'Introduction to React',
        trainer_id: 'trainer123',
      };

      const course = new Course(courseData);

      expect(course.course_id).toBe(1);
      expect(course.course_name).toBe('Introduction to React');
      expect(course.status).toBe('active'); // Default
    });
  });

  describe('validation', () => {
    it('should throw error if course_name is missing', () => {
      expect(() => {
        new Course({ trainer_id: 'trainer123' });
      }).toThrow('Course name is required');
    });

    it('should throw error if course_name is too short', () => {
      expect(() => {
        new Course({ course_name: 'AB', trainer_id: 'trainer123' });
      }).toThrow('Course name must be between 3 and 255 characters');
    });
  });

  describe('softDelete', () => {
    it('should update status to deleted', () => {
      const course = new Course({
        course_name: 'Test Course',
        trainer_id: 'trainer123',
      });

      course.softDelete();

      expect(course.status).toBe('deleted');
    });
  });
});
```

**מה בודק:**
- ✅ יצירת Entity עם נתונים תקינים
- ✅ ולידציות (course_name חובה, אורך)
- ✅ מתודות עסקיות (softDelete)

---

### 2. Unit Test - Use Case

**קובץ:** `tests/unit/application/use-cases/CreateCourseUseCase.test.js`

```javascript
import { jest } from '@jest/globals';
import { CreateCourseUseCase } from '../../../../src/application/use-cases/CreateCourseUseCase.js';
import { Course } from '../../../../src/domain/entities/Course.js';

describe('CreateCourseUseCase', () => {
  let mockCourseRepository;
  let createCourseUseCase;

  beforeEach(() => {
    // Mock repository
    mockCourseRepository = {
      create: jest.fn(),
    };

    createCourseUseCase = new CreateCourseUseCase(mockCourseRepository);
  });

  it('should create a course successfully', async () => {
    const courseData = {
      course_name: 'Introduction to React',
      trainer_id: 'trainer123',
    };

    const createdCourse = new Course({
      ...courseData,
      course_id: 1,
      status: 'active',
    });

    // Mock repository response
    mockCourseRepository.create.mockResolvedValue(createdCourse);

    // Execute use case
    const result = await createCourseUseCase.execute(courseData);

    // Assertions
    expect(result).toEqual(createdCourse);
    expect(mockCourseRepository.create).toHaveBeenCalledWith(expect.any(Course));
    expect(mockCourseRepository.create).toHaveBeenCalledTimes(1);
  });

  it('should throw error if course name is invalid', async () => {
    const courseData = {
      course_name: 'AB', // Too short
      trainer_id: 'trainer123',
    };

    await expect(createCourseUseCase.execute(courseData)).rejects.toThrow(
      'Course name must be between 3 and 255 characters'
    );

    // Repository should not be called if validation fails
    expect(mockCourseRepository.create).not.toHaveBeenCalled();
  });
});
```

**מה בודק:**
- ✅ זרימת עבודה של Use Case
- ✅ קריאה ל-Repository
- ✅ Error handling
- ✅ ולידציות

**Mocking:**
- `mockCourseRepository` - Mock של Repository
- `jest.fn()` - Mock functions
- `mockResolvedValue()` - Mock async responses

---

### 3. Integration Test - API Endpoint

**קובץ:** `tests/integration/api/courses.test.js`

```javascript
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import coursesRouter from '../../../src/presentation/routes/courses.js';
import { errorHandler } from '../../../src/presentation/middleware/errorHandler.js';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/courses', coursesRouter);
  app.use(errorHandler);
  return app;
};

const testApp = createTestApp();

describe('Courses API Integration Tests', () => {
  describe('POST /api/courses', () => {
    it('should create a course with valid data', async () => {
      const courseData = {
        course_name: 'Integration Test Course',
        trainer_id: 'trainer123',
        skills: ['JavaScript', 'React'],
        language: 'en',
      };

      const response = await request(testApp)
        .post('/api/courses')
        .send(courseData)
        .expect(201);

      expect(response.body).toHaveProperty('course_id');
      expect(response.body.course_name).toBe(courseData.course_name);
      expect(response.body.status).toBe('active');
    });

    it('should return 400 if course_name is missing', async () => {
      const courseData = {
        trainer_id: 'trainer123',
      };

      const response = await request(testApp)
        .post('/api/courses')
        .send(courseData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/courses', () => {
    it('should return list of courses', async () => {
      const response = await request(testApp)
        .get('/api/courses')
        .query({ trainer_id: 'trainer123' })
        .expect(200);

      expect(response.body).toHaveProperty('courses');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.courses)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(testApp)
        .get('/api/courses')
        .query({ trainer_id: 'trainer123', page: 1, limit: 10 })
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
  });
});
```

**מה בודק:**
- ✅ API endpoints (POST, GET, PUT, DELETE)
- ✅ Request validation
- ✅ Response format
- ✅ Error handling
- ✅ Pagination
- ✅ Filtering

**Supertest:**
- `request(app)` - יצירת request
- `.post()`, `.get()`, `.put()`, `.delete()` - HTTP methods
- `.send()` - Request body
- `.query()` - Query parameters
- `.expect()` - Status code assertions

---

### 4. Integration Test - Database

**קובץ:** `tests/integration/database/postgresql.test.js`

```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabaseConnection } from '../../../src/infrastructure/database/DatabaseConnection.js';
import { PostgreSQLCourseRepository } from '../../../src/infrastructure/database/repositories/PostgreSQLCourseRepository.js';

describe('PostgreSQL Repository Integration Tests', () => {
  let db;
  let courseRepository;

  beforeAll(async () => {
    // Skip if DATABASE_URL not set
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set, skipping tests');
      return;
    }

    db = DatabaseConnection.getInstance();
    courseRepository = new PostgreSQLCourseRepository();
  });

  afterAll(async () => {
    // Cleanup test data
    if (db && db.isConnected()) {
      await db.query('DELETE FROM trainer_courses WHERE created_by = $1', ['test-user']);
    }
  });

  describe('PostgreSQLCourseRepository', () => {
    it('should create a course', async () => {
      if (!db || !db.isConnected()) {
        console.warn('Skipping: Database not connected');
        return;
      }

      const courseData = {
        course_name: 'Test Course',
        trainer_id: 'test-user',
        description: 'Test description',
      };

      const course = await courseRepository.create(courseData);

      expect(course).toBeDefined();
      expect(course.course_id).toBeDefined();
      expect(course.course_name).toBe(courseData.course_name);
    });

    it('should find course by ID', async () => {
      // Create course first
      const createdCourse = await courseRepository.create({
        course_name: 'Find Test Course',
        trainer_id: 'test-user',
      });

      // Find it
      const foundCourse = await courseRepository.findById(createdCourse.course_id);

      expect(foundCourse).toBeDefined();
      expect(foundCourse.course_id).toBe(createdCourse.course_id);
    });
  });
});
```

**מה בודק:**
- ✅ CRUD operations
- ✅ Database queries
- ✅ Foreign Keys
- ✅ Constraints
- ✅ Transactions

**Setup/Teardown:**
- `beforeAll()` - Setup לפני כל ה-tests
- `afterAll()` - Cleanup אחרי כל ה-tests
- `beforeEach()` - Setup לפני כל test
- `afterEach()` - Cleanup אחרי כל test

---

### 5. Unit Test - Service with Mocks

**קובץ:** `tests/unit/infrastructure/ai/AIGenerationService.test.js`

```javascript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AIGenerationService } from '../../../../src/infrastructure/ai/AIGenerationService.js';

describe('AIGenerationService', () => {
  let service;
  let mockOpenAIClient;
  let mockTTSClient;

  beforeEach(() => {
    // Mock OpenAI client
    mockOpenAIClient = {
      generateText: jest.fn(),
    };

    // Mock TTS client
    mockTTSClient = {
      generateAudioWithMetadata: jest.fn(),
    };

    // Create service
    service = new AIGenerationService({
      openaiApiKey: 'test-key',
    });

    // Replace clients with mocks
    service.openaiClient = mockOpenAIClient;
    service.ttsClient = mockTTSClient;
  });

  describe('generateAudio', () => {
    it('should generate audio from text', async () => {
      const text = 'This is a test text.';
      const audioBuffer = Buffer.from('fake-audio-data');

      // Mock TTS response
      mockTTSClient.generateAudioWithMetadata.mockResolvedValue({
        audio: audioBuffer,
        format: 'mp3',
        duration: 5.0,
        voice: 'alloy',
      });

      // Execute
      const result = await service.generateAudio(text, {
        voice: 'alloy',
        format: 'mp3',
      });

      // Assertions
      expect(result).toHaveProperty('audio');
      expect(result.format).toBe('mp3');
      expect(result.duration).toBe(5.0);
      expect(mockTTSClient.generateAudioWithMetadata).toHaveBeenCalled();
    });

    it('should throw error if TTS client not configured', async () => {
      service.ttsClient = null;

      await expect(service.generateAudio('test')).rejects.toThrow(
        'TTS client not configured'
      );
    });
  });
});
```

**מה בודק:**
- ✅ Service logic
- ✅ External API calls (mocked)
- ✅ Error handling
- ✅ Data transformation

**Mocking External APIs:**
- לא קוראים ל-OpenAI/Gemini/HeyGen אמיתיים
- משתמשים ב-mocks
- מהיר יותר
- לא תלוי ב-API keys

---

## ✅ Best Practices

### 1. Test Structure

**AAA Pattern (Arrange-Act-Assert):**
```javascript
it('should do something', () => {
  // Arrange - הכנת נתונים
  const courseData = { course_name: 'Test', trainer_id: '123' };
  
  // Act - ביצוע הפעולה
  const course = new Course(courseData);
  
  // Assert - בדיקת תוצאות
  expect(course.course_name).toBe('Test');
});
```

### 2. Test Naming

**Format:** `should [expected behavior] when [condition]`

```javascript
it('should throw error when course_name is missing', () => { ... });
it('should create course when data is valid', () => { ... });
it('should return 404 when course not found', () => { ... });
```

### 3. Test Isolation

**כל test עצמאי:**
- לא תלוי ב-tests אחרים
- לא משנה state גלובלי
- משתמש ב-`beforeEach()` ל-setup

### 4. Mocking

**מתי להשתמש ב-Mocks:**
- ✅ External APIs (OpenAI, Gemini, HeyGen)
- ✅ Database (ב-unit tests)
- ✅ File system
- ✅ Network requests

**מתי לא להשתמש ב-Mocks:**
- ❌ ב-integration tests (משתמשים ב-DB אמיתי)
- ❌ ב-API tests (משתמשים ב-endpoints אמיתיים)

### 5. Coverage

**מה לבדוק:**
- ✅ Happy paths (הצלחה)
- ✅ Error cases (שגיאות)
- ✅ Edge cases (מקרי קצה)
- ✅ Validation (ולידציות)

**מה לא צריך לבדוק:**
- ❌ Third-party libraries
- ❌ Framework code
- ❌ Configuration files

### 6. Test Data

**Cleanup:**
- תמיד לנקות test data
- להשתמש ב-`afterAll()` או `afterEach()`
- להשתמש ב-`created_by = 'test-user'` לזיהוי

**Test Data Isolation:**
- כל test עם data משלו
- לא לשתף data בין tests
- להשתמש ב-`beforeEach()` ל-setup

---

## 🚀 הרצת Tests

### כל ה-Tests
```bash
npm test
```

### Watch Mode (לפיתוח)
```bash
npm run test:watch
```

### עם Coverage
```bash
npm run test:coverage
```

### Test ספציפי
```bash
npm test -- Course.test.js
```

### Tests בקטגוריה
```bash
npm test -- unit/          # רק unit tests
npm test -- integration/   # רק integration tests
```

---

## 📊 CI/CD Integration

### GitHub Actions

**קובץ:** `.github/workflows/ci.yml`

```yaml
- name: Run tests
  working-directory: ./backend
  run: npm test
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/content_studio_test

- name: Upload coverage reports
  uses: codecov/codecov-action@v3
  with:
    file: ./backend/coverage/lcov.info
```

**מה קורה:**
1. CI רץ על כל PR
2. מריץ tests
3. בודק coverage (חייב >= 80%)
4. מעלה coverage report ל-Codecov

---

## 📝 סיכום - מה בודקים איפה?

### Unit Tests (`tests/unit/`)
- ✅ **Entities** - ולידציות, לוגיקה עסקית
- ✅ **Use Cases** - זרימת עבודה, error handling
- ✅ **Services** - לוגיקה של services (עם mocks)
- ✅ **Utilities** - פונקציות עזר

### Integration Tests (`tests/integration/`)
- ✅ **API Endpoints** - כל ה-endpoints (Supertest)
- ✅ **Database** - CRUD operations (PostgreSQL)
- ✅ **Service Integration** - אינטגרציה בין services

### Health Checks
- ✅ **Server Status** - `/health` endpoint

---

## ⚠️ הערות חשובות

1. **Unit Tests מהירים** - לא דורשים DB או API
2. **Integration Tests איטיים** - דורשים DB אמיתי
3. **Mocks ב-Unit Tests** - לא ב-Integration Tests
4. **Coverage >= 80%** - CI נכשל אם נמוך יותר
5. **Test Isolation** - כל test עצמאי
6. **Cleanup** - תמיד לנקות test data

---

**עודכן לאחרונה:** 2025-01-29

