# Phase 1: Initial Development Setup

## Project Context

### Project Overview
**Content Studio** is microservice #4 within **Educore AI**, an AI-powered Learning Management Platform composed of 11 microservices.

### Project Purpose
Content Studio is an AI-based content creation environment that solves the problem of creating educational content in a convenient, organized, reliable, and multi-format way that suits every user.

### Core Responsibilities
- **Creating** lesson content through multiple methods:
  - AI-assisted content creation
  - Video-to-lesson transformation
  - Manually authored content
  - Full AI-generated materials
- **Storing** lesson content
- **Managing** lesson content - ensuring it is structured, user-friendly, and available in multiple formats

### Key Capabilities
- Transformation of video into structured lessons
- Creation of mind maps
- Support for diverse multimedia formats to improve the learning process

### Integration Context
Content Studio is part of the Educore AI ecosystem and must integrate with other microservices (Directory, Marketplace, Course Builder, Assessment, Skills Engine, Learner AI, Learning Analytics, HR & Management Reporting, DevLab, Contextual Corporate Assistant).

---

## Clarification Phase - Documented Responses

### Question 1: Project Purpose
**Response:** Content Studio is microservice #4 in Educore AI, an AI-powered Learning Management Platform. It solves the problem of creating content in a convenient, organized, reliable, and multi-format way. Responsible for creating (AI-assisted, video-to-lesson, manually authored and full AI creation materials), storing, and managing lesson content.

### Question 2: Primary Users
**Response:** Trainers creating courses, lessons, and content with many ways.

**User Type Identified:**
- **Trainers** - Primary users who create courses, lessons, and content through multiple methods

### Question 3: Content Creation Methods
**Response:** Three main lesson creation modes with 6 flexible content formats.

**Environment Variables Required:**
- `DATABASE_URL` → PostgreSQL connection
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → Upload and retrieve media files
- `OPENAI_API_KEY` → GPT-4o-mini (text generation) and Whisper (speech transcription)
- `HEYGEN_API_KEY` → Avatar video generation (AI face + voice, 15 sec for now)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID` → Google Slides API (presentation generation)

**Lesson Creation Modes:**

1. **Video to Lesson**
   - Input: Video file (uploaded by trainer)
   - Flow:
     - Transcribe with Whisper (OpenAI Speech API)
     - Summarize and structure lesson text with GPT-4o-mini
     - Generate 6 lesson formats automatically with AI:
       - Avatar video → via Heygen API
       - Text → GPT-4o-mini
       - Code example → GPT-4o-mini (or manual example later)
       - Presentation → GPT-4o-mini → exported to Google Slides API
       - Audio → Whisper output (from same transcript)
       - Mind map → GPT-4o-mini → Mermaid syntax → sent to Kroki.io or Gamma for image generation
     - Save all results + metadata in Supabase Storage and DB

2. **AI-Assisted Creation**
   - Input: Trainer request (topic, key ideas)
   - Flow:
     - Merge trainer request + predefined prompt template
     - Send to GPT-4o-mini or external generation API
     - Generate only the requested format(s)
     - Store results in `contents` table with generation_method = 'ai_assisted'

3. **Manual Creation**
   - Input: Trainer uploads or writes content manually
   - Flow:
     - Trainer provides text, slides, or code manually
     - Run AI quality & originality check using GPT-4o-mini
     - Store the result and analysis in Supabase

**6 Lesson Formats (Flexible Generation):**
1. Avatar video (Heygen API)
2. Text (GPT-4o-mini)
3. Code example (GPT-4o-mini or manual)
4. Presentation (GPT-4o-mini → Google Slides API)
5. Audio (Whisper output)
6. Mind map (GPT-4o-mini → Mermaid → Kroki.io/Gamma)

**Key Architecture Principle:**
- Each format can be created independently and by a different generation method
- No single "mode" for the lesson - each content format defines its own `generation_method`

### Question 4: Data Entities and Integration Architecture
**Response:** Trainer flow, data entities, microservice integrations, and additional requirements provided.

**Data Entities Identified:**
- `trainer_courses` - Courses created by trainers
- `topics` - Lessons (can be part of a course or stand-alone)
- `templates` - Content templates for generation
- `generation_methods` - Methods for content generation (video_to_lesson, ai_assisted, manual)
- `content_types` - Types of content formats (avatar_video, text, code_example, presentation, audio, mind_map)

**Trainer Flow:**
1. **Create Course → Add Lessons → Add Content Items per Lesson**
2. **Create Stand-alone Lesson** (not tied to any course) for internal training or future reuse

**Integration Architecture:**
- **Directory Service** (Reversed Flow): Directory → Content Studio provides verified trainer info; Content Studio → Directory sends course/lesson updates
- **Skills Engine** (gRPC): Content Studio sends trainer + topic → receives micro-skills, nano-skills, difficulty, validation
- **Course Builder** (gRPC): Two scenarios - Trainer-customized course (Content Studio → Course Builder) and Learner-customized course (Course Builder → Content Studio)
- **DevLab** (gRPC): AI-generated exercises and trainer-created exercises with validation
- **Learning Analytics** (REST): Content Studio sends usage statistics → receives insights and recommendations
- **RAG/Contextual Assistant** (REST): Content Studio sends approved content → receives contextual answers

**Additional Requirements:**
- **Multi-Language Support**: Automatic translation for 10 major languages (text, slides, audio captions)
- **Quality & Originality Checks**: Clarity, complexity, logic, plagiarism verification; originality enforcement for manual uploads

**Communication Details:**
- Detailed field mappings provided for each microservice integration
- DevLab has two modes: AI mode (auto-generate) and Manual mode (trainer creates, validates per question)
- All approved content is indexed in RAG for semantic search

**Database Architecture:**
- Content Studio has its own database
- Integration: gRPC with Course Builder, Skills Engine, Directory, DevLab
- Integration: REST with RAG and Learning Analytics
- External APIs: OpenAI, Heygen, Google Slides, Supabase

---

### Question 5: Data Entity Relationships and Constraints
**Response:** Detailed relationships and constraints provided.

**Course–Lesson Relationship:**
- Each course consists of multiple lessons (one-to-many)
- A lesson (topic) does NOT necessarily belong to a specific course
- Lessons can exist as stand-alone (for specific skill requests)
- Stand-alone lessons are sent directly to learners, not permanently stored as part of course structure

**Templates and Their Role:**
- Templates define the order and structure of content formats inside a lesson
- Example: first show video, then text, then slides, etc.
- Templates describe how formats are organized and presented
- Trainers can create templates manually or generate with AI assistance
- Templates are reusable across multiple lessons or courses

**Lesson and Format Relationship:**
- Each lesson (topic) must include multiple content formats
- Six standard formats: Text, Code, Presentation, Audio, Mind Map, Avatar Video
- Five formats are mandatory (text, code, presentation, audio, mind map)
- Avatar video is optional
- Trainers can decide which formats to include per lesson (may vary across lessons in same course)

**Content and Topic Relationship:**
- Every content item must belong to a specific topic (lesson)
- Content cannot exist without a topic
- Each topic acts as a container for all its formats and related content items

**Course Structure Flexibility:**
- Trainer determines how many lessons each course contains
- Within each lesson, trainer can choose creation method and combination of formats (AI-assisted, manual, or mixed)

**Constraints Summary:**
- A course can have one or many lessons
- A lesson may or may not belong to a course
- A topic (lesson) must include at least five content formats (text, code, presentation, audio, mind map)
- A content item cannot exist without its parent topic
- Templates define structure and order of formats; they are reusable and can be created manually or via AI

**Database Tables Identified:**
- `trainer_courses` - Courses created by trainers
- `topics` - Lessons (can belong to course or stand-alone)
- `methods_of_generation` - Generation methods (video_to_lesson, ai_assisted, manual)
- `content_types` - Content format types (text, code, presentation, audio, mind_map, avatar_video)
- `templates` - Reusable templates defining format order/structure
- `content` - Content items (must belong to a topic)
- `content_history` - Version history for content items

---

## Algorithm Recommendations for Content Studio Architecture

### 1. Event-Driven Architecture (Pub/Sub Pattern)
**Why:** Content generation is asynchronous (video transcription, AI generation, format conversion). Each format can be generated independently.
**Implementation:** Queue system for video processing, AI generation jobs, format conversions
**Benefits:** Scalability, fault tolerance, parallel processing

### 2. Pipeline Pattern for Content Generation
**Why:** Video-to-lesson follows clear pipeline (transcribe → summarize → generate formats). Each stage is independent.
**Implementation:** Chain of responsibility or pipeline processor for each generation method
**Benefits:** Modularity, testability, easy to add new formats

### 3. Strategy Pattern for Generation Methods
**Why:** Multiple generation methods (video_to_lesson, ai_assisted, manual) with different workflows but same interface
**Implementation:** Strategy interface with concrete implementations per method
**Benefits:** Flexibility, easy to add new methods, clean separation of concerns

### 4. Factory Pattern for Content Format Creation
**Why:** 6 different formats (avatar video, text, code, presentation, audio, mind map) with different creation logic
**Implementation:** Format factory creates appropriate generator based on content_type
**Benefits:** Extensibility, single responsibility per format generator

### 5. Repository Pattern for Data Access
**Why:** Clean separation between database operations and business logic, supports multiple data sources (PostgreSQL, Supabase Storage)
**Implementation:** Repository interfaces with concrete implementations
**Benefits:** Testability, maintainability, easy to swap data sources

### 6. Circuit Breaker Pattern for External APIs
**Why:** Multiple external dependencies (OpenAI, Heygen, Google Slides, Supabase, microservices) can fail
**Implementation:** Circuit breaker monitors API health and prevents cascading failures
**Benefits:** Resilience, graceful degradation

### 7. Retry Pattern with Exponential Backoff
**Why:** AI generation and external APIs can have transient failures
**Implementation:** Retry logic with exponential backoff for transient failures
**Benefits:** Improved reliability, handles rate limits

### 8. Version Control Algorithm for Content
**Why:** Content may need versioning, rollback, and approval workflows
**Implementation:** Content versioning system with metadata tracking (content_history table)
**Benefits:** Audit trail, ability to revert changes

### 9. Caching Strategy (LRU/TTL)
**Why:** Frequently accessed content, skill mappings, and templates benefit from caching
**Implementation:** Redis or in-memory cache for templates, skill data, frequently accessed content
**Benefits:** Performance, reduced external API calls

### 10. Content Similarity Algorithm (for Quality Checks)
**Why:** Plagiarism detection and originality checks require similarity comparison
**Implementation:** Vector embeddings (via OpenAI) + cosine similarity for content comparison
**Benefits:** Efficient similarity detection, supports quality validation

---

### Question 6: Feature Breakdown
**Response:** Comprehensive feature breakdown provided with detailed specifications.

**Main Features Identified:**

#### 1. Course Management
- Create, edit, delete courses
- Course structure management
- Integration with Course Builder microservice

#### 2. Lesson/Topic Management
- Create, edit, delete lessons (topics)
- Stand-alone lessons (not tied to courses)
- Lesson-to-course association (optional)
- Lesson structure management

#### 3. Content Generation Methods
- Video-to-lesson transformation
- AI-assisted creation
- Manual creation
- Mixed creation methods

#### 4. Format-Specific Creation Features

**4.1 Text Generation**
- Generates lesson text, summaries, explanations, scenarios
- Supports manual writing and AI enhancement (clarity, grammar, difficulty level)
- Allows multiple style modes (formal, conversational, educational)
- Saves versions in database

**4.2 Code Example Generator**
- Creates code snippets, examples, exercises
- Supports AI generation, GitHub import, or manual entry
- Detects language automatically and adds syntax highlighting
- Integrated with DevLab for code validation and interactivity

**4.3 Presentation Builder**
- Uses OpenAI text-to-slides or Google Slides API
- Supports manual upload and AI-created decks
- Applies predefined or AI-generated templates and brand styles
- Stores presentation files in Supabase or Cloud Storage

**4.4 Audio Creation**
- Generates audio narrations from lesson text using TTS models (OpenAI / Whisper)
- Allows manual upload of recordings
- Supports multilingual audio generation and subtitles
- Saves metadata (duration, speaker, language, format)

**4.5 Mind Map Generator (Updated)**
- Generates interactive mind maps using **Gemini API** (not OpenAI)
- Extracts concepts and relationships from lesson text or AI outline
- Converts Gemini output into Mermaid-compatible JSON structure
- Renders interactive maps in React (React Flow)
- Exports to image or Mermaid format
- Allows manual editing, AI re-generation, trainer adjustments
- Saves both JSON mind map data and Gemini raw response in database
- Supports localization (map labels in selected language)
- **Key Behavior:** Each mind map entry stores: topic_id, language, generation_method, mind_map_json, gemini_response, version_number, created_at
- Regeneration triggers new version in content_history

**4.6 Avatar Video Creation**
- Creates short avatar videos (10-15 seconds) using Heygen API
- Synchronizes with text or transcript from lesson
- Allows voice customization and background selection
- **Optional** (not mandatory format)

#### 5. Template Management
- Create, edit, reuse templates defining format order/structure
- Example: video → text → slides → code
- Templates can be manual or AI-generated
- Stored for reuse across lessons or courses

#### 6. Quality & Originality Checks
- AI-based validation: clarity, difficulty level, logical structure, plagiarism
- Manual uploads trigger automatic originality checks
- Trainers receive feedback or flags for low-quality content

#### 7. Multi-Language Support (Updated)
- AI translation engine converts all lesson formats (text, slides, audio) into up to 10 languages with 95% accuracy
- Supports subtitles and voice localization
- **Full multi-language management at database and AI prompt level**
- Each content item includes language field in database
- Trainers can select target languages from preferences (English, Arabic, Hebrew, Spanish, etc.)
- Content Studio automatically includes language in AI prompts (e.g., "Generate this lesson text in French")
- Same configuration applies to external AI integrations (OpenAI, Gemini, Google Translate API)
- All translations and localized assets stored in Supabase/Cloud storage with language-specific paths
- Trainers can trigger regeneration in multiple languages or update existing ones
- **Key Behavior:**
  - Language column exists in all content-related tables (content, content_history, templates)
  - System automatically applies language filters when fetching or displaying data
  - Translations are version-controlled like any other content

#### 8. Versioning & History
- Every content item version-controlled with timestamps, editors, actions
- Supports rollback, comparison, approval workflows for collaborative editing
- **Soft Delete Implementation:**
  - Content Studio **never performs physical delete operations**
  - Item's status field updated (active, archived, deleted)
  - Full record kept in content_history and versioning tables
  - All previous versions, associated content, templates, generation logs remain accessible
  - Ensures traceability, accountability, data retention compliance
  - Learning Analytics recognizes deleted items as historical records
  - **Status Values:**
    - `status = "active"` → currently in use
    - `status = "archived"` → completed or no longer updated but visible
    - `status = "deleted"` → hidden from UI but preserved for audit trail

#### 9. Integration Management
- gRPC integration with Course Builder, Skills Engine, Directory, DevLab
- REST integration with RAG and Learning Analytics
- External API integration (OpenAI, Heygen, Google Slides, Gemini, Supabase)

#### 10. User Authentication & Authorization
- Handled by Authentication microservice using JWT tokens
- Content Studio validates trainer identity and permissions through JWT verification
- No local user management required inside Content Studio

#### 11. Content Search & Filtering
- Trainers can search lessons, topics, and content items by:
  - Title
  - Skill
  - Status
  - Format type
- Filtering options:
  - Content status: draft, published, archived, deleted
  - Generation method: AI-assisted, manual, video-to-lesson
  - Format type: text, code, presentation, audio, mind_map, avatar_video
- Search supports pagination and partial text matches

#### 12. Notification System
- Real-time or delayed notifications to trainers for:
  - AI content generation completion
  - Translations ready
  - Quality or plagiarism checks finished
  - Errors during content creation or validation
- Notifications displayed in-app (UI banner or bell icon) or sent via email
- Future integration with Directory or Authentication microservice for centralized notifications

**Features NOT Included:**
- **Bulk Operations:** Planned for Phase 2 (not MVP). MVP supports actions per lesson/course only
- **Collaboration:** Not supported. Each course/lesson owned by single trainer. Only assigned trainer can edit/regenerate/delete their content

### Question 8: MVP Prioritization
**Response:** Clear MVP vs Post-MVP breakdown provided.

**MVP Features (Complete Core Content Creation & Management):**

1. **Core Content Creation Methods**
   - Video-to-Lesson (Whisper + OpenAI)
   - AI-Assisted Creation
   - Manual Creation

2. **Format Generation (5 Core Formats)**
   - Text
   - Code
   - Presentation
   - Audio
   - Mind Map (via Gemini)
   - **Avatar video excluded from MVP**

3. **Template Management**
   - Create, edit, and reuse templates
   - Manual or AI-assisted template creation

4. **Quality & Originality Checks**
   - AI-based validation for clarity, structure, and plagiarism
   - Enforced for manual uploads

5. **Versioning & History**
   - Full version control, rollback, and soft-delete system
   - Deleted lessons/courses preserved in database with status updates (active, archived, deleted)

6. **Search & Filtering**
   - Trainers can search/filter lessons and content by name, status, skill, and format

7. **Notification System**
   - Real-time updates (in-app or email) when generation, translation, or checks are completed

8. **Integration Layer**
   - REST + gRPC connections with Course Builder, Directory, Skills Engine, DevLab, and Learning Analytics

**Post-MVP Features (Phase 2 Enhancements):**

1. **Multi-Language Support**
   - AI translation for all content formats
   - Database-level language tracking per content item
   - Trainer can choose which languages to generate

2. **Advanced Analytics Dashboards**
   - Detailed reports and data visualization for trainers/managers
   - Integration with Management Reporting

3. **Multimedia in Supabase Storage**
   - Enhanced storage management

4. **Avatar Video (Heygen Integration)**
   - Short avatar video generation (10–15 sec)
   - Optional advanced media format

5. **Collaboration & Shared Editing**
   - Multi-trainer access for co-editing lessons/courses
   - RBAC-controlled shared permissions

---

## Phase 1.2: Feature Breakdown - Multi-Role Dialogue Phase

### Clarification Phase Status: ✅ COMPLETE

All required information gathered:
- ✅ Project purpose and context
- ✅ Primary users (trainers)
- ✅ Content creation methods and workflows
- ✅ Data entities and relationships
- ✅ Feature breakdown and capabilities
- ✅ MVP vs Post-MVP prioritization
- ✅ Integration requirements
- ✅ Technical constraints and requirements

---

---

## Step 2: Multi-Role Dialogue Phase

### Internal Role-Based Dialogue

**Project Lead:** Looking at the feature breakdown, I see we have 12 main features, with 8 in MVP and 5 deferred to post-MVP. The scope seems comprehensive but manageable. However, I want to ensure we're not missing any critical business features that trainers need to successfully create content.

**System Architect:** From a technical perspective, the feature breakdown aligns well with our microservice architecture. The integration layer with gRPC and REST is clearly defined. However, I'm concerned about feature boundaries - specifically, where does "Template Management" end and "Content Generation" begin? Templates define format order, but do they also include AI prompt templates?

**AI Workflow Designer:** Good point, System Architect. Templates have two aspects: structural (format order) and prompt-based (AI generation templates). I recommend we clarify this boundary. Also, I notice we're using multiple AI providers - OpenAI for most, Gemini for mind maps. We should ensure consistency in error handling and fallback strategies across all AI integrations.

**DevOps Engineer:** I'm concerned about the scalability of the MVP features. Video-to-lesson transformation involves asynchronous processing, multiple AI API calls, and file storage. We need to ensure the infrastructure can handle concurrent video processing jobs. Also, the notification system needs robust queue management to avoid overwhelming trainers.

**Moderator:** Let me synthesize the concerns and propose refinements:

1. **Feature Boundary Clarification Needed:**
   - Templates: Structural templates (format order) vs. Prompt templates (AI generation patterns)
   - Content Generation: Should we separate "Generation Methods" from "Format Creation" as distinct features?

2. **Technical Concerns:**
   - AI provider consistency (OpenAI vs Gemini)
   - Asynchronous processing scalability
   - Notification queue management

3. **Feature Grouping Proposal:**
   - Group 1: Content Creation & Generation (Methods + Formats)
   - Group 2: Content Management (Courses, Lessons, Templates, Versioning)
   - Group 3: Quality & Validation (Quality Checks, Search/Filter)
   - Group 4: Integration & Communication (Integrations, Notifications)

**System Architect:** I agree with the grouping, but I think we should refine the feature structure to be more granular for development planning. Let me propose a refined breakdown:

**Proposed Refined Feature Breakdown:**

**MVP Features (Grouped by Functional Area):**

**A. Content Creation & Generation**
- A1. Video-to-Lesson Transformation
- A2. AI-Assisted Content Creation
- A3. Manual Content Creation
- A4. Format-Specific Generators (Text, Code, Presentation, Audio, Mind Map)

**B. Content Management**
- B1. Course Management
- B2. Lesson/Topic Management (including stand-alone lessons)
- B3. Template Management (structural + prompt templates)
- B4. Content Versioning & History (with soft-delete)

**C. Quality & Validation**
- C1. Quality & Originality Checks
- C2. Content Search & Filtering

**D. Integration & Communication**
- D1. Microservice Integration Layer (gRPC + REST)
- D2. Notification System

**Project Lead:** This refined structure makes more sense from a business perspective. It groups related functionality and makes it easier to prioritize development sprints. However, I want to ensure "Template Management" clearly includes both structural templates (format ordering) and prompt templates (AI generation patterns) as mentioned.

**AI Workflow Designer:** I agree. Template Management should handle both:
- Structural templates: Define format order and presentation structure
- Prompt templates: Reusable AI prompt patterns for consistent generation

**Logger:** Documenting consensus on refined feature structure. All roles agree on the grouping approach. Need to clarify template scope before final approval.

**Moderator:** Consensus reached on refined feature breakdown structure. Key decisions:
1. Feature breakdown organized into 4 functional areas (A-D)
2. Template Management includes both structural and prompt templates
3. MVP features clearly separated from post-MVP
4. Ready for user approval

---

## Step 3: User Approval Phase

### Proposed Feature Breakdown Structure

Based on our internal dialogue, we propose organizing the features into **4 functional areas** with **11 MVP features**:

**MVP Feature Breakdown:**

**A. Content Creation & Generation (4 features)**
- A1. Video-to-Lesson Transformation
- A2. AI-Assisted Content Creation
- A3. Manual Content Creation
- A4. Format-Specific Generators (5 formats: Text, Code, Presentation, Audio, Mind Map)

**B. Content Management (4 features)**
- B1. Course Management
- B2. Lesson/Topic Management (including stand-alone lessons)
- B3. Template Management (structural templates for format order + prompt templates for AI generation)
- B4. Content Versioning & History (with soft-delete)

**C. Quality & Validation (2 features)**
- C1. Quality & Originality Checks
- C2. Content Search & Filtering

**D. Integration & Communication (2 features)**
- D1. Microservice Integration Layer (gRPC + REST)
- D2. Notification System

**Post-MVP Features (5 features):**
- Multi-Language Support
- Advanced Analytics Dashboards
- Multimedia Storage Enhancement
- Avatar Video Generation
- Collaboration & Shared Editing

**Questions for User Approval:**
1. Does this feature grouping and structure work for your development planning?
2. Should Template Management explicitly include both structural templates (format order) and prompt templates (AI generation patterns)?
3. Are there any features we should add, remove, or reorganize?

---

## Step 4: Output Generation Phase - Approved Feature Breakdown

### User Approval Status: ✅ APPROVED

**Approval Date:** [Current Date]
**User Response:** "yes"

---

## Final Approved Feature Breakdown

### MVP Features (11 features organized into 4 functional areas)

#### **A. Content Creation & Generation (4 features)**

**A1. Video-to-Lesson Transformation**
- Input: Video file uploaded by trainer
- Process: Transcribe (Whisper) → Summarize (GPT-4o-mini) → Generate 5 formats
- Output: Complete lesson with all mandatory formats
- Integration: OpenAI APIs (Whisper + GPT-4o-mini)

**A2. AI-Assisted Content Creation**
- Input: Trainer request (topic, key ideas)
- Process: Merge request + prompt template → Generate requested format(s)
- Output: Generated content items with generation_method = 'ai_assisted'
- Integration: OpenAI GPT-4o-mini or external generation API

**A3. Manual Content Creation**
- Input: Trainer uploads or writes content manually
- Process: Store content → Run AI quality & originality check
- Output: Content items with generation_method = 'manual' + quality analysis
- Integration: OpenAI GPT-4o-mini for quality checks

**A4. Format-Specific Generators (5 formats)**
- **A4.1 Text Generation:** GPT-4o-mini, multiple style modes, versioning
- **A4.2 Code Example Generator:** AI generation/GitHub import/manual, DevLab integration
- **A4.3 Presentation Builder:** OpenAI text-to-slides or Google Slides API
- **A4.4 Audio Creation:** TTS models (OpenAI/Whisper), multilingual support
- **A4.5 Mind Map Generator:** Gemini API → Mermaid JSON → React Flow rendering

#### **B. Content Management (4 features)**

**B1. Course Management**
- Create, edit, delete (soft-delete) courses
- Course structure management
- Integration with Course Builder microservice
- Status: active, archived, deleted

**B2. Lesson/Topic Management**
- Create, edit, delete (soft-delete) lessons (topics)
- Support stand-alone lessons (not tied to courses)
- Optional lesson-to-course association
- Each topic must include at least 5 mandatory formats

**B3. Template Management**
- **Structural Templates:** Define format order and presentation structure (e.g., video → text → slides → code)
- **Prompt Templates:** Reusable AI prompt patterns for consistent generation
- Create, edit, reuse templates
- Manual or AI-assisted template creation
- Reusable across lessons/courses

**B4. Content Versioning & History**
- Full version control with timestamps, editors, actions
- Rollback, comparison, approval workflows
- Soft-delete implementation (never physical delete)
- Status tracking: active, archived, deleted
- Complete audit trail in content_history table

#### **C. Quality & Validation (2 features)**

**C1. Quality & Originality Checks**
- AI-based validation: clarity, difficulty level, logical structure, plagiarism
- Automatic checks for manual uploads
- Trainer feedback/flags for low-quality content
- Integration: OpenAI GPT-4o-mini

**C2. Content Search & Filtering**
- Search lessons, topics, content items by: title, skill, status, format type
- Filter by: status (draft, published, archived, deleted), generation method, format type
- Pagination and partial text matches

#### **D. Integration & Communication (2 features)**

**D1. Microservice Integration Layer**
- **gRPC:** Course Builder, Skills Engine, Directory, DevLab
- **REST:** RAG (Contextual Assistant), Learning Analytics
- Field mappings and communication protocols defined per microservice

**D2. Notification System**
- Real-time or delayed notifications
- Events: AI generation completion, translations ready, quality checks finished, errors
- Channels: In-app (UI banner/bell icon) + email
- Future integration with Directory/Authentication microservice

### Post-MVP Features (Phase 2 - 5 features)

1. **Multi-Language Support**
   - AI translation for all content formats (10 languages, 95% accuracy)
   - Database-level language tracking
   - Trainer language selection

2. **Advanced Analytics Dashboards**
   - Detailed reports and data visualization
   - Integration with Management Reporting

3. **Multimedia in Supabase Storage**
   - Enhanced storage management

4. **Avatar Video Generation (Heygen Integration)**
   - Short avatar videos (10-15 sec)
   - Optional advanced media format

5. **Collaboration & Shared Editing**
   - Multi-trainer access for co-editing
   - RBAC-controlled shared permissions

---

## Feature Breakdown Validation

### Decision Rationale
- **Grouping by Functional Area:** Organizes features logically for development sprints and team assignments
- **Template Management Scope:** Includes both structural and prompt templates to support flexible content generation
- **Soft-Delete Requirement:** Ensures data retention, audit compliance, and analytics continuity
- **MVP Focus:** Core content creation and management functionality prioritized for stable foundation

### Traceability
- All features traceable to user requirements gathered in clarification phase
- Each feature has clear boundaries and dependencies
- Integration points clearly defined with other microservices

### Feature Dependencies
- Content Creation features depend on Integration Layer
- Format Generators depend on Content Management
- Quality Checks depend on Content Creation
- Versioning supports all Content Management features

---

---

## Phase 1.3: Environment Setup - Database Schema Clarification

### Database Requirements Summary
- **Database Type:** PostgreSQL (via Supabase)
- **Dynamic Schema:** Must support changes, additions, and modifications over time
- **Primary Keys:** All use SERIAL (auto-incrementing integers)
- **Foreign IDs:** Trainer IDs from Directory service are VARCHAR(50)
- **Soft Delete:** Never physical delete, use status field
- **Analytics Counts:** Stored in columns (not just calculated queries)

### User Clarifications Received
1. Analytics counts should be stored in table columns where applicable
2. Topics → Courses: One-to-many relationship, `course_id` nullable in topics table (no M:N relationship)
3. Course ID is unique within topics and can be null (stand-alone lessons)

---

## Proposed Database Schema Design

### Table 1: `trainer_courses`

**Purpose:** Stores course-level data created by trainers

**Fields:**
```sql
course_id SERIAL PRIMARY KEY,
trainer_id VARCHAR(50) NOT NULL,  -- From Directory service
course_name VARCHAR(255) NOT NULL,
course_description TEXT,
status VARCHAR(20) DEFAULT 'active',  -- active, archived, deleted
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) NOT NULL,  -- Trainer ID
changed_by VARCHAR(50),  -- Trainer ID for last update

-- Analytics counts (stored in table)
total_topics INTEGER DEFAULT 0,  -- Count of topics in this course
ai_generated_topics_count INTEGER DEFAULT 0,
trainer_generated_topics_count INTEGER DEFAULT 0,
collaborative_topics_count INTEGER DEFAULT 0,  -- Future use
total_content_items INTEGER DEFAULT 0,  -- Total content items across all topics

-- Metadata
metadata JSONB,  -- Flexible field for future extensions
```

**Algorithms:**
- **Dynamic Schema Pattern:** Use JSONB `metadata` field for extensibility
- **Count Maintenance:** Update counts via triggers or application logic when topics/content are added/removed
- **Soft Delete:** Update `status` field, never DELETE row

**Indexes:**
- `idx_trainer_courses_trainer_id` ON `trainer_id`
- `idx_trainer_courses_status` ON `status`
- `idx_trainer_courses_created_at` ON `created_at`

---

### Table 2: `topics` (Lessons)

**Purpose:** Represents lessons (topics) - can belong to course or be stand-alone

**Fields:**
```sql
topic_id SERIAL PRIMARY KEY,
course_id INTEGER,  -- NULLABLE for stand-alone lessons, FK to trainer_courses.course_id
trainer_id VARCHAR(50) NOT NULL,  -- From Directory service
topic_name VARCHAR(255) NOT NULL,
topic_description TEXT,
template_id INTEGER,  -- FK to templates.template_id (optional)
status VARCHAR(20) DEFAULT 'draft',  -- draft, published, archived, deleted

-- Generation metadata
generation_method VARCHAR(50),  -- 'video_to_lesson', 'ai_assisted', 'manual', 'mixed'
created_by_type VARCHAR(20) DEFAULT 'trainer',  -- 'trainer', 'ai', 'system'
created_by_id VARCHAR(50),  -- Trainer ID or 'system'

-- Skills (from Skills Engine integration)
micro_skills JSONB,  -- Array of micro-skills
nano_skills JSONB,  -- Array of nano-skills
skills_metadata JSONB,  -- Additional skill data from Skills Engine

-- Analytics counts (stored in table)
total_content_formats INTEGER DEFAULT 0,  -- Count of content items (should be >= 5)
ai_generated_content_count INTEGER DEFAULT 0,
trainer_generated_content_count INTEGER DEFAULT 0,
mixed_content_count INTEGER DEFAULT 0,

-- Content format flags (for quick queries)
has_text BOOLEAN DEFAULT FALSE,
has_code BOOLEAN DEFAULT FALSE,
has_presentation BOOLEAN DEFAULT FALSE,
has_audio BOOLEAN DEFAULT FALSE,
has_mind_map BOOLEAN DEFAULT FALSE,
has_avatar_video BOOLEAN DEFAULT FALSE,  -- Optional format

-- Timestamps
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
changed_by VARCHAR(50),  -- Trainer ID for last update

-- Metadata
metadata JSONB,  -- Flexible field for future extensions
```

**Algorithms:**
- **Flexible Skills Storage:** Use JSONB for skills arrays (allows dynamic skill structure)
- **Format Tracking:** Boolean flags for quick filtering without joins
- **Count Maintenance:** Update content counts via triggers/application logic
- **Stand-alone Lessons:** `course_id` = NULL indicates stand-alone lesson

**Indexes:**
- `idx_topics_course_id` ON `course_id` (nullable index)
- `idx_topics_trainer_id` ON `trainer_id`
- `idx_topics_status` ON `status`
- `idx_topics_generation_method` ON `generation_method`
- `idx_topics_created_at` ON `created_at`

**Constraints:**
- `CHECK (total_content_formats >= 5)` - At least 5 mandatory formats
- `FOREIGN KEY (course_id) REFERENCES trainer_courses(course_id) ON DELETE SET NULL`
- `FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE SET NULL`

---

### Table 3: `content` (Content Items)

**Purpose:** Stores each content item (format-specific data) belonging to a topic

**Fields:**
```sql
content_id SERIAL PRIMARY KEY,
topic_id INTEGER NOT NULL,  -- FK to topics.topic_id
content_type VARCHAR(50) NOT NULL,  -- FK to content_types.type_name
generation_method VARCHAR(50) NOT NULL,  -- 'video_to_lesson', 'ai_assisted', 'manual'

-- Content data
content_data JSONB NOT NULL,  -- Format-specific content (text, code, presentation data, etc.)
content_url TEXT,  -- URL to external file (Supabase Storage, Google Slides, etc.)
content_storage_path VARCHAR(500),  -- Path in Supabase Storage

-- Language support (for future multi-language)
language VARCHAR(10) DEFAULT 'en',  -- ISO 639-1 language code

-- Generation metadata
ai_provider VARCHAR(50),  -- 'openai', 'gemini', 'heygen', 'google_slides'
ai_model VARCHAR(100),  -- 'gpt-4o-mini', 'gemini-pro', etc.
prompt_template_id INTEGER,  -- FK to templates.template_id (if prompt template used)
raw_ai_response JSONB,  -- Store raw AI response for regeneration/audit

-- Quality check results
quality_check_status VARCHAR(20),  -- 'pending', 'passed', 'failed', 'flagged'
quality_check_data JSONB,  -- Clarity, complexity, plagiarism scores, etc.
quality_checked_at TIMESTAMP,
quality_checker_id VARCHAR(50),  -- Trainer ID or 'system'

-- Status
status VARCHAR(20) DEFAULT 'draft',  -- draft, published, archived, deleted
is_active BOOLEAN DEFAULT TRUE,

-- Version tracking
version_number INTEGER DEFAULT 1,
parent_content_id INTEGER,  -- FK to content.content_id (for version chain)
is_current_version BOOLEAN DEFAULT TRUE,

-- Timestamps
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) NOT NULL,  -- Trainer ID or 'system'
changed_by VARCHAR(50),  -- Trainer ID for last update

-- Metadata
metadata JSONB,  -- Flexible field for format-specific metadata
```

**Algorithms:**
- **Format-Specific Storage:** Use JSONB `content_data` for flexible format structures
- **Version Chain:** `parent_content_id` links versions, `is_current_version` marks active version
- **Quality Check Pipeline:** Store quality check results for audit and improvement
- **AI Response Preservation:** Store raw AI responses for regeneration and debugging

**Indexes:**
- `idx_content_topic_id` ON `topic_id`
- `idx_content_content_type` ON `content_type`
- `idx_content_generation_method` ON `generation_method`
- `idx_content_status` ON `status`
- `idx_content_is_current_version` ON `is_current_version`
- `idx_content_language` ON `language`
- `idx_content_created_at` ON `created_at`

**Constraints:**
- `FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE RESTRICT` (prevent delete if content exists)
- `FOREIGN KEY (content_type) REFERENCES content_types(type_name)`
- `FOREIGN KEY (generation_method) REFERENCES generation_methods(method_name)`
- `CHECK (version_number >= 1)`

---

### Table 4: `content_history`

**Purpose:** Stores all version history of content for audit, rollback, and analytics

**Fields:**
```sql
history_id SERIAL PRIMARY KEY,
content_id INTEGER NOT NULL,  -- FK to content.content_id
topic_id INTEGER NOT NULL,  -- FK to topics.topic_id (denormalized for query performance)
content_type VARCHAR(50) NOT NULL,
version_number INTEGER NOT NULL,

-- Content snapshot (full copy at time of change)
content_data_snapshot JSONB NOT NULL,
content_url_snapshot TEXT,
content_storage_path_snapshot VARCHAR(500),

-- Change metadata
change_type VARCHAR(20) NOT NULL,  -- 'created', 'updated', 'deleted', 'restored'
change_description TEXT,
changed_by VARCHAR(50) NOT NULL,  -- Trainer ID or 'system'
changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

-- Action metadata
action_type VARCHAR(50),  -- 'edit', 'regenerate', 'quality_check', 'translate', etc.
action_details JSONB,  -- Additional action-specific data

-- Status at time of change
status_at_change VARCHAR(20),  -- Status when this change occurred

-- Metadata
metadata JSONB,
```

**Algorithms:**
- **Immutable History:** Never update, only insert (append-only pattern)
- **Full Snapshot:** Store complete content data for each version (enables full rollback)
- **Change Tracking:** Record change type and action for audit trail
- **Denormalization:** Store `topic_id` for faster queries without joins

**Indexes:**
- `idx_content_history_content_id` ON `content_id`
- `idx_content_history_topic_id` ON `topic_id`
- `idx_content_history_version_number` ON `version_number`
- `idx_content_history_changed_at` ON `changed_at`
- `idx_content_history_change_type` ON `change_type`

**Constraints:**
- `FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE RESTRICT`
- `FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE RESTRICT`

---

### Table 5: `templates`

**Purpose:** Stores both structural templates (format order) and AI prompt templates

**Fields:**
```sql
template_id SERIAL PRIMARY KEY,
template_name VARCHAR(255) NOT NULL,
template_type VARCHAR(50) NOT NULL,  -- 'structural', 'prompt', 'mixed'
trainer_id VARCHAR(50) NOT NULL,  -- From Directory service
is_system_template BOOLEAN DEFAULT FALSE,  -- System-wide vs trainer-specific

-- Structural template data (format order)
format_order JSONB,  -- Array defining order: ["video", "text", "slides", "code", "audio", "mind_map"]
required_formats JSONB,  -- Array of required format types
optional_formats JSONB,  -- Array of optional format types

-- Prompt template data (AI generation patterns)
prompt_template TEXT,  -- AI prompt template with placeholders
prompt_variables JSONB,  -- Variable definitions for prompt template
ai_provider VARCHAR(50),  -- 'openai', 'gemini', etc.
ai_model VARCHAR(100),  -- Model to use for this template

-- Usage tracking
usage_count INTEGER DEFAULT 0,  -- How many times template used
last_used_at TIMESTAMP,

-- Status
status VARCHAR(20) DEFAULT 'active',  -- active, archived, deleted
is_default BOOLEAN DEFAULT FALSE,  -- Default template for new lessons

-- Timestamps
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) NOT NULL,  -- Trainer ID or 'system'
changed_by VARCHAR(50),

-- Metadata
metadata JSONB,
```

**Algorithms:**
- **Dual Template Support:** Single table handles both structural and prompt templates
- **Flexible Format Order:** JSONB array allows dynamic format sequencing
- **Prompt Variables:** JSONB stores variable definitions for template customization
- **Usage Analytics:** Track template usage for optimization

**Indexes:**
- `idx_templates_trainer_id` ON `trainer_id`
- `idx_templates_template_type` ON `template_type`
- `idx_templates_status` ON `status`
- `idx_templates_is_default` ON `is_default`

**Constraints:**
- `CHECK (template_type IN ('structural', 'prompt', 'mixed'))`

---

### Table 6: `content_types` (Lookup Table)

**Purpose:** Lookup table for the 6 possible content formats

**Fields:**
```sql
type_name VARCHAR(50) PRIMARY KEY,  -- 'text', 'code', 'presentation', 'audio', 'mind_map', 'avatar_video'
display_name VARCHAR(100) NOT NULL,
description TEXT,
is_mandatory BOOLEAN DEFAULT FALSE,  -- Required for topics
is_optional BOOLEAN DEFAULT TRUE,
sort_order INTEGER,  -- For display ordering
requires_ai BOOLEAN DEFAULT FALSE,  -- Can be AI-generated
requires_external_api BOOLEAN DEFAULT FALSE,  -- Requires external API (Heygen, Google Slides, etc.)
external_api_provider VARCHAR(50),  -- 'heygen', 'google_slides', 'gemini', etc.

-- Metadata
metadata JSONB,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
```

**Algorithms:**
- **Static Lookup:** Pre-populated with 6 format types
- **Mandatory Flag:** Identifies required vs optional formats
- **API Integration Info:** Tracks which formats need external APIs

**Seed Data:**
```sql
INSERT INTO content_types (type_name, display_name, is_mandatory, requires_ai, requires_external_api, external_api_provider) VALUES
('text', 'Text', TRUE, TRUE, FALSE, NULL),
('code', 'Code Example', TRUE, TRUE, FALSE, NULL),
('presentation', 'Presentation', TRUE, TRUE, TRUE, 'google_slides'),
('audio', 'Audio', TRUE, TRUE, FALSE, NULL),
('mind_map', 'Mind Map', TRUE, TRUE, TRUE, 'gemini'),
('avatar_video', 'Avatar Video', FALSE, TRUE, TRUE, 'heygen');
```

---

### Table 7: `generation_methods` (Lookup Table)

**Purpose:** Lookup table for generation types

**Fields:**
```sql
method_name VARCHAR(50) PRIMARY KEY,  -- 'video_to_lesson', 'ai_assisted', 'manual', 'mixed'
display_name VARCHAR(100) NOT NULL,
description TEXT,
requires_video_input BOOLEAN DEFAULT FALSE,
requires_ai BOOLEAN DEFAULT FALSE,
requires_manual_input BOOLEAN DEFAULT FALSE,
sort_order INTEGER,
is_active BOOLEAN DEFAULT TRUE,

-- Metadata
metadata JSONB,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
```

**Algorithms:**
- **Static Lookup:** Pre-populated with generation methods
- **Method Characteristics:** Flags indicate what each method requires

**Seed Data:**
```sql
INSERT INTO generation_methods (method_name, display_name, requires_video_input, requires_ai, requires_manual_input) VALUES
('video_to_lesson', 'Video to Lesson', TRUE, TRUE, FALSE),
('ai_assisted', 'AI-Assisted', FALSE, TRUE, FALSE),
('manual', 'Manual', FALSE, FALSE, TRUE),
('mixed', 'Mixed', FALSE, TRUE, TRUE);
```

---

## Database Design Patterns & Algorithms

### 1. Dynamic Schema Pattern
- **JSONB Fields:** Use `metadata JSONB` in all tables for extensibility
- **Flexible Relationships:** JSONB arrays for skills, format orders, etc.
- **Future-Proof:** New fields can be added without schema migrations

### 2. Count Maintenance Algorithm
```sql
-- Trigger function to update counts when content is added/updated/deleted
CREATE OR REPLACE FUNCTION update_topic_content_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update topic counts based on content changes
    UPDATE topics SET
        total_content_formats = (
            SELECT COUNT(*) FROM content 
            WHERE topic_id = NEW.topic_id AND is_current_version = TRUE
        ),
        ai_generated_content_count = (
            SELECT COUNT(*) FROM content 
            WHERE topic_id = NEW.topic_id 
            AND generation_method IN ('video_to_lesson', 'ai_assisted')
            AND is_current_version = TRUE
        ),
        trainer_generated_content_count = (
            SELECT COUNT(*) FROM content 
            WHERE topic_id = NEW.topic_id 
            AND generation_method = 'manual'
            AND is_current_version = TRUE
        ),
        mixed_content_count = (
            SELECT COUNT(*) FROM content 
            WHERE topic_id = NEW.topic_id 
            AND generation_method = 'mixed'
            AND is_current_version = TRUE
        )
    WHERE topic_id = NEW.topic_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. Soft Delete Pattern
- **Status Field:** Always use `status` field (active, archived, deleted)
- **Never DELETE:** All deletes are UPDATE statements
- **History Preservation:** content_history table maintains full audit trail

### 4. Version Control Algorithm
- **Version Chain:** `parent_content_id` links versions
- **Current Version Flag:** `is_current_version` marks active version
- **Immutable History:** content_history never updated, only inserted

### 5. Analytics Count Storage
- **Denormalized Counts:** Store counts in tables for performance
- **Trigger Maintenance:** Use triggers to keep counts accurate
- **Query Optimization:** Avoid expensive COUNT(*) queries

---

---

## Updated Database Schema (Based on User Requirements)

### ENUM Types

```sql
-- Content Status Enum
CREATE TYPE content_status AS ENUM ('active', 'archived', 'deleted');

-- Template Type Enum
CREATE TYPE "TemplateType" AS ENUM ('ready_template', 'ai_generated', 'manual', 'mixed_ai_manual');

-- Content Type Enum
CREATE TYPE "ContentType" AS ENUM ('avatar_video', 'text', 'code', 'presentation', 'audio', 'mind_map');

-- Generation Method Enum
CREATE TYPE "GenerationMethod" AS ENUM ('ai_assisted', 'manual', 'video_to_lesson');
```

---

### Table 1: `trainer_courses`

**Fields:**
```sql
course_id SERIAL PRIMARY KEY,
course_name VARCHAR(255) NOT NULL,
trainer_id VARCHAR(50) NOT NULL,  -- From Directory service
description TEXT,
skills TEXT[],  -- Text array of skills
language VARCHAR(10) DEFAULT 'en',  -- ISO 639-1 language code
status content_status DEFAULT 'active',
company_logo VARCHAR(500),  -- PATH to logo in STORAGE if any
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Indexes:**
- `idx_trainer_courses_trainer_id` ON `trainer_id`
- `idx_trainer_courses_status` ON `status`
- `idx_trainer_courses_created_at` ON `created_at`
- `idx_trainer_courses_skills` USING GIN (`skills`)  -- GIN index for array searches

---

### Table 2: `topics` (Lessons)

**Fields:**
```sql
topic_id SERIAL PRIMARY KEY,
course_id INTEGER,  -- FK to trainer_courses.course_id (nullable for stand-alone)
topic_name VARCHAR(255) NOT NULL,
description TEXT,
trainer_id VARCHAR(50) NOT NULL,  -- From Directory service
language VARCHAR(10) DEFAULT 'en',
status content_status DEFAULT 'active',
skills TEXT[],  -- Skills set (text array)
template_id INTEGER,  -- FK to templates.template_id
generation_methods_id VARCHAR(50),  -- FK to generation_methods (using enum value)
usage_count INTEGER DEFAULT 0,  -- Starts at zero, returned to Course Builder when adapted
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Indexes:**
- `idx_topics_course_id` ON `course_id` (nullable index)
- `idx_topics_trainer_id` ON `trainer_id`
- `idx_topics_status` ON `status`
- `idx_topics_generation_methods_id` ON `generation_methods_id`
- `idx_topics_skills` USING GIN (`skills`)  -- GIN index for array searches

**Constraints:**
- `FOREIGN KEY (course_id) REFERENCES trainer_courses(course_id) ON DELETE SET NULL`
- `FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE SET NULL`

---

### Table 3: `templates`

**Fields:**
```sql
template_id SERIAL PRIMARY KEY,
template_name VARCHAR(255) NOT NULL,
template_type "TemplateType" NOT NULL,  -- Enum: ready_template, ai_generated, manual, mixed_ai_manual
created_by VARCHAR(50) NOT NULL,  -- Template creator ID
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
format_order JSONB  -- Format order (JSON array)
```

**Indexes:**
- `idx_templates_template_type` ON `template_type`
- `idx_templates_created_by` ON `created_by`
- `idx_templates_format_order` USING GIN (`format_order`)  -- GIN index for JSONB searches

---

### Table 4: `content`

**Fields:**
```sql
content_id SERIAL PRIMARY KEY,
topic_id INTEGER NOT NULL,  -- FK to topics.topic_id
content_type_id "ContentType" NOT NULL,  -- Enum: avatar_video, text, code, presentation, audio, mind_map
content_data JSONB,  -- Data itself (text or path)
generation_method_id "GenerationMethod" NOT NULL,  -- Enum: ai_assisted, manual, video_to_lesson

-- Quality check fields (stored in content table)
quality_check_data JSONB,  -- Store all quality check results (clarity, difficulty, structure, plagiarism)
quality_check_status VARCHAR(20),  -- 'pending', 'passed', 'failed', 'flagged'
quality_checked_at TIMESTAMP,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Indexes:**
- `idx_content_topic_id` ON `topic_id`
- `idx_content_content_type_id` ON `content_type_id`
- `idx_content_generation_method_id` ON `generation_method_id`
- `idx_content_content_data` USING GIN (`content_data`)  -- GIN index for JSONB searches

**Constraints:**
- `FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE RESTRICT`

---

### Table 5: `content_history`

**Fields:**
```sql
history_id SERIAL PRIMARY KEY,
content_id INTEGER NOT NULL,  -- History record identifier
topic_id INTEGER NOT NULL,  -- FK to topics.topic_id
content_type_id "ContentType" NOT NULL,  -- FK to content type
version_number INTEGER NOT NULL,
content_data JSONB NOT NULL,  -- Data of that version
generation_method_id "GenerationMethod" NOT NULL,  -- FK to how it was created
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Indexes:**
- `idx_content_history_content_id` ON `content_id`
- `idx_content_history_topic_id` ON `topic_id`
- `idx_content_history_version_number` ON `version_number`
- `idx_content_history_content_data` USING GIN (`content_data`)  -- GIN index for JSONB

**Constraints:**
- `FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE RESTRICT`
- `FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE RESTRICT`

---

## Suggested Additional Tables

Based on the requirements discussed, here are additional tables that may be needed:

### Table 6: `generation_methods` (Lookup/Reference Table)

**Purpose:** Store generation method metadata and characteristics

**Fields:**
```sql
method_name "GenerationMethod" PRIMARY KEY,  -- Enum value as primary key
display_name VARCHAR(100) NOT NULL,
description TEXT,
requires_video_input BOOLEAN DEFAULT FALSE,
requires_ai BOOLEAN DEFAULT FALSE,
requires_manual_input BOOLEAN DEFAULT FALSE,
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Seed Data:**
```sql
INSERT INTO generation_methods (method_name, display_name, requires_video_input, requires_ai, requires_manual_input) VALUES
('video_to_lesson', 'Video to Lesson', TRUE, TRUE, FALSE),
('ai_assisted', 'AI-Assisted', FALSE, TRUE, FALSE),
('manual', 'Manual', FALSE, FALSE, TRUE);
```

---

### Table 7: `content_types` (Lookup/Reference Table)

**Purpose:** Store content type metadata and characteristics

**Fields:**
```sql
type_name "ContentType" PRIMARY KEY,  -- Enum value as primary key
display_name VARCHAR(100) NOT NULL,
description TEXT,
is_mandatory BOOLEAN DEFAULT FALSE,
is_optional BOOLEAN DEFAULT TRUE,
sort_order INTEGER,
requires_ai BOOLEAN DEFAULT FALSE,
requires_external_api BOOLEAN DEFAULT FALSE,
external_api_provider VARCHAR(50),
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Seed Data:**
```sql
INSERT INTO content_types (type_name, display_name, is_mandatory, requires_ai, requires_external_api, external_api_provider) VALUES
('text', 'Text', TRUE, TRUE, FALSE, NULL),
('code', 'Code Example', TRUE, TRUE, FALSE, NULL),
('presentation', 'Presentation', TRUE, TRUE, TRUE, 'google_slides'),
('audio', 'Audio', TRUE, TRUE, FALSE, NULL),
('mind_map', 'Mind Map', TRUE, TRUE, TRUE, 'gemini'),
('avatar_video', 'Avatar Video', FALSE, TRUE, TRUE, 'heygen');
```

---

### Table 8: `notifications` (Optional - Only if persistent notifications needed)

**Purpose:** Store notification records for trainers (ONLY if notifications need to be persisted/historical)

**Decision:** 
- **If notifications are ephemeral (in-app only, no history needed):** Remove this table, handle in application layer
- **If notifications need persistence (read/unread status, history):** Keep this table

**Fields (if kept):**
```sql
notification_id SERIAL PRIMARY KEY,
trainer_id VARCHAR(50) NOT NULL,
notification_type VARCHAR(50) NOT NULL,  -- 'generation_complete', 'translation_ready', 'quality_check', 'error'
title VARCHAR(255) NOT NULL,
message TEXT,
related_content_id INTEGER,  -- FK to content.content_id (if applicable)
related_topic_id INTEGER,  -- FK to topics.topic_id (if applicable)
is_read BOOLEAN DEFAULT FALSE,
read_at TIMESTAMP,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Indexes (if kept):**
- `idx_notifications_trainer_id` ON `trainer_id`
- `idx_notifications_is_read` ON `is_read`
- `idx_notifications_created_at` ON `created_at`

---

### Table 9: `quality_checks` (Optional - Can be stored in content table instead)

**Purpose:** Store quality check results for content

**Decision:** 
- **Option A:** Separate table for quality checks (better for audit trail, multiple checks per content)
- **Option B:** Store quality check data directly in `content` table as JSONB field (simpler, fewer joins)

**Fields (if kept as separate table):**
```sql
quality_check_id SERIAL PRIMARY KEY,
content_id INTEGER NOT NULL,  -- FK to content.content_id
check_type VARCHAR(50) NOT NULL,  -- 'clarity', 'difficulty', 'structure', 'plagiarism'
status VARCHAR(20) NOT NULL,  -- 'pending', 'passed', 'failed', 'flagged'
score DECIMAL(5,2),  -- Score (0-100)
check_data JSONB,  -- Detailed check results
checked_by VARCHAR(50),  -- Trainer ID or 'system'
checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Indexes (if kept):**
- `idx_quality_checks_content_id` ON `content_id`
- `idx_quality_checks_status` ON `status`
- `idx_quality_checks_check_type` ON `check_type`

**Constraints (if kept):**
- `FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE RESTRICT`

**Alternative (if storing in content table):**
Add to `content` table:
```sql
quality_check_data JSONB,  -- Store all quality check results here
quality_check_status VARCHAR(20),  -- 'pending', 'passed', 'failed', 'flagged'
quality_checked_at TIMESTAMP
```

---

## Algorithm Recommendations for Database Operations

### 1. **Hash Table Algorithm** (for Lookups)
**Use Case:** Fast lookups for content_types and generation_methods
- **Implementation:** PostgreSQL's hash indexes on enum values
- **Benefits:** O(1) average lookup time for type/method resolution
- **Tables:** `content_types`, `generation_methods`
- **Index Type:** HASH index on enum primary keys

### 2. **B-Tree Index** (for Range Queries & Sorting)
**Use Case:** Date range queries, sorting by created_at, status filtering
- **Implementation:** PostgreSQL's default B-tree indexes
- **Benefits:** O(log n) search, efficient range queries
- **Tables:** All tables with timestamps, status fields
- **Index Type:** B-tree (default) on created_at, updated_at, status

### 3. **GIN Index** (for Array/JSONB Searches)
**Use Case:** Searching within skills arrays, JSONB content_data queries
- **Implementation:** GIN (Generalized Inverted Index) on TEXT[] and JSONB
- **Benefits:** Fast full-text search within arrays and JSON documents
- **Tables:** `trainer_courses.skills`, `topics.skills`, `content.content_data`, `templates.format_order`
- **Index Type:** GIN index on array/JSONB columns

### 4. **Red-Black Tree** (for Ordered Data Structures)
**Use Case:** Version chain traversal, hierarchical content relationships
- **Implementation:** Application-level data structure for version chains
- **Benefits:** O(log n) insert, delete, search with guaranteed balance
- **Use:** When building content version chains in application memory
- **Note:** PostgreSQL doesn't have native R-B tree, use in application layer

### 5. **Hash Partitioning** (for Large Tables)
**Use Case:** Partitioning content_history by topic_id or date
- **Implementation:** PostgreSQL table partitioning
- **Benefits:** Faster queries on large historical data
- **Tables:** `content_history` (if grows very large)
- **Partition Strategy:** Hash partition by topic_id or range partition by created_at

### 6. **Bloom Filter** (for Fast Membership Tests)
**Use Case:** Quickly check if content exists before querying
- **Implementation:** Application-level bloom filter cache
- **Benefits:** O(1) membership test with minimal memory
- **Use:** Cache layer for checking content existence

### 7. **LRU Cache** (for Frequently Accessed Data)
**Use Case:** Caching templates, content_types, generation_methods lookups
- **Implementation:** Application-level LRU cache (Redis or in-memory)
- **Benefits:** Reduce database queries for frequently accessed lookup data
- **Use:** Cache templates, content types, generation methods

### 8. **Queue Data Structure** (for Async Processing)
**Use Case:** Video-to-lesson processing, AI generation jobs
- **Implementation:** Message queue (Redis, RabbitMQ) or PostgreSQL LISTEN/NOTIFY
- **Benefits:** Asynchronous processing, job queuing
- **Use:** Background jobs for content generation

---

## Database Operation Algorithms by Use Case

### Content Search & Filtering
- **Primary:** B-tree index on status, generation_method, content_type
- **Secondary:** GIN index on skills arrays for skill-based filtering
- **Algorithm:** Index scan + bitmap heap scan for multiple filters

### Version History Retrieval
- **Primary:** B-tree index on (content_id, version_number)
- **Algorithm:** Index scan for version chain, ordered by version_number DESC
- **Optimization:** Use covering index if frequently querying specific fields

### Analytics Count Queries
- **Strategy:** Denormalized counts in parent tables (topics, courses)
- **Maintenance:** Trigger-based updates or application-level updates
- **Algorithm:** Direct column access (O(1)) instead of COUNT(*) aggregation

### Template Format Order Lookup
- **Primary:** GIN index on format_order JSONB
- **Algorithm:** JSONB path queries with GIN index support
- **Optimization:** Store format_order as JSONB array for efficient queries

---

---

## Most Suitable Algorithms for Content Studio Database

Based on your specific requirements and use cases, here are the **TOP 5 MOST SUITABLE** algorithms:

### 🥇 **1. GIN Index (CRITICAL - Highest Priority)**
**Why Most Suitable:**
- You have **TEXT[] arrays** (skills in courses and topics) that need fast searching
- You have **JSONB fields** (content_data, format_order, quality_check_data) that need flexible querying
- Content Studio requires searching within complex JSON structures

**Implementation:**
```sql
-- Already included in migration.sql
CREATE INDEX idx_trainer_courses_skills ON trainer_courses USING GIN (skills);
CREATE INDEX idx_topics_skills ON topics USING GIN (skills);
CREATE INDEX idx_content_content_data ON content USING GIN (content_data);
CREATE INDEX idx_templates_format_order ON templates USING GIN (format_order);
CREATE INDEX idx_content_quality_check_data ON content USING GIN (quality_check_data);
```

**Impact:** Essential for search & filtering by skills, content format queries, and template format order lookups

---

### 🥈 **2. B-Tree Index (ESSENTIAL - Second Priority)**
**Why Most Suitable:**
- You need **frequent filtering by status** (active, archived, deleted)
- **Date range queries** for analytics (created_at, updated_at)
- **Sorting** by creation date, status, and trainer_id
- **Foreign key lookups** for relationships

**Implementation:**
```sql
-- Already included in migration.sql
-- Examples:
CREATE INDEX idx_trainer_courses_status ON trainer_courses(status);
CREATE INDEX idx_topics_trainer_id ON topics(trainer_id);
CREATE INDEX idx_content_topic_id ON content(topic_id);
```

**Impact:** Critical for all filtering, sorting, and relationship queries

---

### 🥉 **3. Queue Data Structure (HIGH PRIORITY - For Async Processing)**
**Why Most Suitable:**
- **Video-to-lesson transformation** is asynchronous (Whisper → GPT-4o-mini → multiple format generation)
- **AI generation jobs** (text, code, presentation, audio, mind map) run asynchronously
- **Quality checks** run in background
- Prevents blocking trainer operations

**Recommended Implementation:**
- **Redis Queue** (recommended) for job processing
- **PostgreSQL LISTEN/NOTIFY** for lightweight notifications
- **BullMQ** or **Bull** (Node.js) for job management

**Use Cases:**
- Video transcription queue
- AI content generation queue
- Quality check queue
- Notification queue

**Impact:** Enables scalable, non-blocking content generation

---

### 🏅 **4. Denormalized Count Storage (HIGH PRIORITY - For Analytics)**
**Why Most Suitable:**
- You explicitly requested **analytics counts stored in columns** (not calculated)
- You need fast analytics queries without expensive COUNT(*) aggregations
- `usage_count` in topics table needs to be returned to Course Builder quickly

**Implementation:**
- Store counts in `topics` table: `ai_generated_content_count`, `trainer_generated_content_count`, `mixed_content_count`
- Store counts in `trainer_courses` table: `total_topics`, `total_content_items`
- Use **triggers** or **application-level updates** to maintain counts

**Algorithm Pattern:**
```sql
-- Trigger-based count maintenance (recommended)
CREATE OR REPLACE FUNCTION update_topic_content_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE topics SET
        ai_generated_content_count = (
            SELECT COUNT(*) FROM content 
            WHERE topic_id = NEW.topic_id 
            AND generation_method_id IN ('video_to_lesson', 'ai_assisted')
        ),
        trainer_generated_content_count = (
            SELECT COUNT(*) FROM content 
            WHERE topic_id = NEW.topic_id 
            AND generation_method_id = 'manual'
        )
    WHERE topic_id = NEW.topic_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Impact:** O(1) analytics queries instead of O(n) aggregations

---

### 🏅 **5. LRU Cache (MEDIUM PRIORITY - For Performance)**
**Why Most Suitable:**
- **Lookup tables** (content_types, generation_methods) are read frequently
- **Templates** are accessed repeatedly
- **Content type metadata** is queried on every content creation

**Recommended Implementation:**
- **Redis** for distributed caching
- **In-memory cache** (Node.js) for single-instance deployments
- Cache TTL: 1-24 hours for lookup tables

**What to Cache:**
- `content_types` table (6 records)
- `generation_methods` table (3 records)
- Frequently used templates (top 20-50)
- Trainer permissions (from Directory service)

**Impact:** Reduces database load by 50-80% for lookup queries

---

## Summary: Priority Ranking

| Priority | Algorithm | Use Case | Impact |
|----------|-----------|----------|--------|
| **1. CRITICAL** | GIN Index | Array/JSONB searches | Essential for search functionality |
| **2. ESSENTIAL** | B-Tree Index | Filtering, sorting, relationships | Core database operations |
| **3. HIGH** | Queue Data Structure | Async content generation | Enables scalability |
| **4. HIGH** | Denormalized Counts | Analytics queries | Fast analytics without aggregation |
| **5. MEDIUM** | LRU Cache | Lookup table caching | Performance optimization |

---

## Algorithms NOT Recommended for MVP

- **Hash Table Index:** PostgreSQL's hash indexes are less efficient than B-tree for most use cases
- **Red-Black Tree:** Not directly applicable to database layer (use for application-level data structures if needed)
- **Hash Partitioning:** Only needed if `content_history` grows to millions of rows (future optimization)
- **Bloom Filter:** Over-engineering for MVP; simple EXISTS queries are sufficient

---

## Recommended Implementation Order

**Phase 1 (MVP - Must Have):**
1. ✅ GIN Indexes (already in migration.sql)
2. ✅ B-Tree Indexes (already in migration.sql)
3. Queue system for async processing
4. Denormalized count maintenance (triggers or app-level)

**Phase 2 (Post-MVP Optimization):**
5. LRU Cache for lookup tables
6. Hash Partitioning (if content_history > 1M rows)
7. Advanced caching strategies

---

## Final Database Schema Status: ✅ APPROVED

### Final Table List (7 tables):
1. `trainer_courses` - Course data
2. `topics` - Lessons/topics
3. `templates` - Structural and prompt templates
4. `content` - Content items (with quality check fields)
5. `content_history` - Version history
6. `generation_methods` - Lookup table
7. `content_types` - Lookup table

### Removed Tables:
- ❌ `notifications` - Removed (handled in application layer)
- ❌ `quality_checks` - Removed (quality check data stored in `content` table)

### Migration File Created:
✅ `database/migrations/migration.sql` - Complete migration with:
- All ENUM types
- All 7 tables with proper fields
- All indexes (B-tree, GIN)
- All foreign key constraints
- Seed data for lookup tables
- Documentation comments

---

## Configuration Files Created

### ✅ ROADMAP.json
- **Location:** `ROADMAP.json` (root directory)
- **Purpose:** Technical roadmap with architecture details, APIs, AI prompts, database schemas
- **Content:** 
  - Project overview and architecture
  - Complete feature breakdown (MVP and post-MVP)
  - Database schema details
  - Algorithm recommendations
  - Integration points with other microservices
- **Status:** Created in Phase 1.2 (after feature breakdown approval)
- **Update Policy:** Must be updated at the end of every phase

### ✅ Custom_Requirements.md
- **Location:** `Custom_Requirements.md` (root directory)
- **Purpose:** Specific, detailed accuracy requirements per feature and general style guidelines
- **Content:**
  - General accuracy requirements (code quality, performance, security)
  - Feature-specific accuracy requirements (detailed UI/UX per feature)
  - Style and consistency requirements
  - Validation protocol
- **Status:** Created in Phase 1.2 (after feature breakdown approval)
- **Update Policy:** Updated only when accuracy requirements change

---

---

## Phase 1.4: Architecture Preparation

### Status: ✅ COMPLETE

### System Structure Definition

**High-Level Architecture:**
- **Frontend:** React (Vite) - Single Page Application deployed on Vercel
- **Backend:** Node.js (Express/NestJS) - RESTful API + gRPC services deployed on Railway
- **Database:** PostgreSQL (Supabase) - Content Studio's own database
- **Storage:** Supabase Storage - Media files and content assets
- **Queue System:** Redis + BullMQ - Async job processing (to be implemented)

**Service Boundaries:**
- **Monolith Backend:** Single Node.js application handling all Content Studio operations
- **Microservice Integration:** gRPC for Course Builder, Skills Engine, Directory, DevLab
- **REST Integration:** RAG and Learning Analytics
- **External APIs:** OpenAI, Gemini, Google Slides, Heygen (Post-MVP)

**Integration Points:**
1. **Directory Service** (Reversed Flow): Validates trainer info, receives course/lesson updates
2. **Skills Engine** (gRPC): Sends trainer + topic → Receives skills mapping
3. **Course Builder** (gRPC): Bidirectional course data exchange
4. **DevLab** (gRPC): Exercise generation and validation
5. **Learning Analytics** (REST): Sends usage statistics → Receives insights
6. **RAG** (REST): Sends approved content → Receives contextual answers

**Data Flow:**
- Trainer → Frontend → Backend API → Database
- Async Processing: Video upload → Queue → AI APIs → Storage → Database
- Microservice Communication: Backend → gRPC/REST → Other microservices

### Technical Constraints Identification

**Performance Requirements:**
- Page load time: Under 2 seconds
- API response time: Under 500ms for standard queries
- Video-to-lesson transformation: Under 5 minutes for 10-minute videos
- Database queries: Under 100ms with proper indexes

**Security Constraints:**
- Authentication: JWT token validation via Authentication microservice
- Authorization: Trainer permissions validated via Directory microservice
- Data encryption: At rest and in transit
- Input validation: All user inputs validated and sanitized
- SQL injection prevention: Parameterized queries only

**Scalability Constraints:**
- Queue system required for async processing (video transcription, AI generation)
- Database indexes required for performance (GIN, B-tree)
- Caching recommended for lookup tables (LRU cache)
- Horizontal scaling possible with stateless backend

**Compliance Requirements:**
- Soft delete: Never physical delete (data retention compliance)
- Audit trail: Complete version history in content_history table
- Data privacy: GDPR/CCPA considerations for user data

**Technical Limitations:**
- JavaScript only (no TypeScript)
- Tailwind CSS only (no CSS files)
- PostgreSQL database (Supabase)
- Node.js runtime (Railway deployment)

**Architectural Decisions:**
- **Dynamic Database Schema:** JSONB fields for extensibility
- **Soft Delete Pattern:** Status field instead of physical delete
- **Version Control:** content_history table for immutable audit trail
- **Async Processing:** Queue system for long-running operations
- **Denormalized Counts:** Analytics counts stored in columns for performance

---

## Phase 1: Initial Development Setup - COMPLETE ✅

### Summary of Completed Work:

**Phase 1.1: Project Initialization** ✅
- Project context and purpose defined
- Stakeholder identification (trainers)
- Workflow establishment

**Phase 1.2: Feature Breakdown Definition** ✅
- Feature breakdown approved (11 MVP features in 4 functional areas)
- Multi-role dialogue completed
- User approval received

**Phase 1.3: Environment Setup** ✅
- Database schema designed and approved (7 tables)
- Migration file created (migration.sql)
- Algorithm recommendations documented
- Directory structure prepared

**Phase 1.4: Architecture Preparation** ✅
- System structure defined
- Technical constraints identified
- Integration points documented
- Architectural decisions documented

**Configuration Files Created:**
- ✅ ROADMAP.json - Technical roadmap with phases and features
- ✅ Custom_Requirements.md - Detailed accuracy requirements

**Deliverables:**
- ✅ Initial_Development_Setup.md (this file)
- ✅ database/migrations/migration.sql
- ✅ ROADMAP.json
- ✅ Custom_Requirements.md

---

## Next Steps
- ✅ Phase 1: Initial Development Setup - COMPLETE
- Proceed to Phase 2: User Dialogue & Requirements Analysis

