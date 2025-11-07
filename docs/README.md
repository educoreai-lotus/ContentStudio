# Content Studio - Educore AI Microservice

**Microservice #4** in the Educore AI Learning Management Platform

## Overview

Content Studio is an AI-based content creation environment that enables trainers to create, manage, and store lesson content in multiple formats through various creation methods.

## Tech Stack

### Backend
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Database:** PostgreSQL (Supabase)
- **Storage:** Supabase Storage
- **Queue:** Redis + BullMQ
- **Testing:** Jest
- **Language:** JavaScript ONLY (no TypeScript)

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS ONLY (no CSS files)
- **Testing:** Vitest + React Testing Library
- **Language:** JavaScript ONLY (no TypeScript)

## Architecture

**Onion Architecture (Clean Architecture):**
- Domain Layer (Business Logic)
- Application Layer (Use Cases)
- Infrastructure Layer (External APIs, Database)
- Presentation Layer (API Controllers, Frontend)

## Project Structure

```
Content-Studio/
├── backend/          # Node.js backend
├── frontend/         # React frontend
├── database/         # Database migrations
└── docs/             # Documentation
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (or Supabase)
- Redis (for queue system)

### Environment Variables

**Backend (.env):**
```env
PORT=3000
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_PROJECT_ID=...
REDIS_URL=redis://localhost:6379
```

### Installation

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Testing

**Backend:**
```bash
cd backend
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Frontend:**
```bash
cd frontend
npm test              # Run tests
npm run test:coverage # Coverage report
```

### Code Quality

**Linting:**
```bash
npm run lint          # Check
npm run lint:fix      # Fix
```

**Formatting:**
```bash
npm run format        # Format code
npm run format:check  # Check formatting
```

## Development Standards

### Code Quality Requirements
- ✅ JavaScript ONLY (`.js`, `.jsx` extensions)
- ❌ NO TypeScript (`.ts`, `.tsx` files)
- ✅ Tailwind CSS ONLY (utility classes)
- ❌ NO CSS files (`index.css`, `app.css`, etc.)
- ✅ Minimum 80% test coverage
- ✅ ESLint and Prettier must pass

### TDD Approach
- Write tests first (Red)
- Implement minimal code (Green)
- Refactor while keeping tests green (Refactor)

### Commit Discipline
- Atomic commits (one feature per commit)
- Clear commit messages
- Feature locking when complete

## Features

### MVP Features (Priority Order)
1. **Priority 1 (Foundation):**
   - B1. Course Management
   - B2. Lesson/Topic Management
   - A3. Manual Content Creation
   - C2. Content Search & Filtering

2. **Priority 2 (Core Value):**
   - A2. AI-Assisted Content Creation
   - A4. Format-Specific Generators
   - B3. Template Management

3. **Priority 3 (Advanced):**
   - A1. Video-to-Lesson Transformation
   - C1. Quality & Originality Checks
   - B4. Content Versioning & History

4. **Priority 4 (Integration):**
   - D1. Microservice Integration Layer
   - D2. Notification System

## Documentation

- [Initial Development Setup](Initial_Development_Setup.md)
- [User Dialogue & Requirements](User_Dialogue_And_Requirements.md)
- [Feature Planning](Feature_Planning.md)
- [Design & Architecture](Design_And_Architecture.md)
- [UI/UX Design](UI_UX_Design.md)
- [Implementation Guide](Implementation.md)
- [ROADMAP](ROADMAP.json)
- [Custom Requirements](Custom_Requirements.md)

## License

ISC

