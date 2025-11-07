# Content Studio - Custom Accuracy Requirements

**Version:** 1.0.0  
**Created:** 2025-01-04  
**Last Updated:** 2025-01-04  
**Project:** Content Studio Microservice (Educore AI)

---

## General Accuracy Requirements

### Code Quality Standards
- **Language:** JavaScript ONLY (.js/.jsx extensions)
- **TypeScript:** NOT ALLOWED - No .ts or .tsx files
- **Code Style:** ESLint + Prettier configured for JS/JSX
- **Compilation:** Babel/SWC compilation must pass with no errors
- **Test Coverage:** Minimum 80% code coverage for MVP
- **Code Review:** All code must pass peer review before merge

### Performance Benchmarks
- **Page Load Time:** Under 2 seconds for initial page load
- **API Response Time:** Under 500ms for standard queries
- **Content Generation:** Video-to-lesson transformation should complete within 5 minutes for 10-minute videos
- **Database Queries:** All queries should execute under 100ms with proper indexes

### Security Compliance
- **Authentication:** JWT token validation via Authentication microservice
- **Authorization:** Trainer permissions validated via Directory microservice
- **Data Encryption:** All sensitive data encrypted at rest and in transit
- **Input Validation:** All user inputs validated and sanitized
- **SQL Injection Prevention:** Parameterized queries only, no raw SQL strings

### Documentation Completeness
- **API Documentation:** All endpoints must have OpenAPI/Swagger documentation
- **Code Comments:** Complex logic must have inline comments
- **README Files:** Each module must have clear README with usage examples

### UI/UX Consistency
- **Styling:** Tailwind CSS utility classes ONLY
- **CSS Files:** NO CSS files allowed (no index.css, app.css, global.css, etc.)
- **Inline Styles:** NOT ALLOWED - Only Tailwind className
- **Responsive Design:** Must work on mobile, tablet, and desktop (breakpoints: sm, md, lg, xl)
- **Accessibility:** WCAG 2.1 AA compliance required

### Error Handling Precision
- **User-Friendly Messages:** All errors must display clear, actionable messages
- **Error Logging:** All errors must be logged with context for debugging
- **Graceful Degradation:** System must handle API failures gracefully

### Data Validation Accuracy
- **Required Fields:** All required fields must be validated before submission
- **Format Validation:** Email, dates, URLs must be validated with proper regex
- **Data Types:** All data types must match database schema exactly

---

## Feature-Specific Accuracy Requirements

### A. Content Creation & Generation

#### A1. Video-to-Lesson Transformation
- **Video Upload:**
  - Accept video formats: MP4, MOV, AVI, WebM
  - Maximum file size: 500MB
  - Upload progress indicator must show percentage
  - Error message if file format/size invalid: "Please upload a valid video file (MP4, MOV, AVI, WebM) under 500MB"

- **Transcription Process:**
  - Show "Transcribing video..." status message
  - Estimated time display based on video length
  - Error handling: If Whisper API fails, show "Transcription failed. Please try again or upload a clearer audio."

- **Format Generation:**
  - Show progress for each format: "Generating [format]... (1/5)"
  - All 5 mandatory formats must be generated successfully
  - If any format fails, show specific error: "Failed to generate [format]. Please try regenerating."

- **Completion:**
  - Success message: "Lesson created successfully! All formats generated."
  - Display all generated formats with preview options
  - "Edit" button must be visible and functional

#### A2. AI-Assisted Content Creation
- **Input Form:**
  - Topic input field: Required, minimum 3 characters, maximum 200 characters
  - Key ideas textarea: Required, minimum 10 characters, maximum 2000 characters
  - Format selection: Checkboxes for each format (at least 1 must be selected)
  - Error message if invalid: "Please provide a topic (3-200 chars) and key ideas (10-2000 chars)"

- **Generation Process:**
  - Show "Generating content..." with spinner
  - Estimated time: "This may take 30-60 seconds"
  - Progress indicator for each selected format

- **Output:**
  - Generated content must be displayed in preview mode
  - "Save" button must be prominent (primary button style)
  - "Regenerate" option must be available

#### A3. Manual Content Creation
- **Manual Input:**
  - Text editor: Rich text editor with formatting options (bold, italic, lists)
  - Code editor: Syntax highlighting for supported languages
  - File upload: Drag-and-drop interface with file type validation
  - Error message if invalid: "Please provide valid content or upload a supported file type"

- **Quality Check:**
  - Automatic quality check runs after content save
  - Show "Running quality check..." status
  - Quality check results displayed in colored badges:
    - Green: "Quality Check Passed"
    - Yellow: "Quality Check Warning"
    - Red: "Quality Check Failed"
  - Detailed feedback must be visible below content

#### A4. Format-Specific Generators

**A4.1 Text Generation:**
- **Style Selection:**
  - Dropdown with options: "Formal", "Conversational", "Educational"
  - Default: "Educational"
  - Style must be applied consistently throughout generated text

- **Output:**
  - Text must be properly formatted with paragraphs
  - Minimum 200 words for generated text
  - "Edit" button must allow inline editing
  - Changes must auto-save with "Saved" indicator

**A4.2 Code Example Generator:**
- **Language Detection:**
  - Automatic detection must be accurate (95%+ accuracy)
  - Manual override option available
  - Language badge displayed: "JavaScript", "Python", etc.

- **Syntax Highlighting:**
  - Code must be properly highlighted according to language
  - Copy button must be functional
  - Line numbers must be visible for code > 10 lines

**A4.3 Presentation Builder:**
- **Slide Generation:**
  - Minimum 5 slides for generated presentations
  - Slide titles must be clear and descriptive
  - Each slide must have relevant content
  - "Preview" button must show full presentation

- **Google Slides Integration:**
  - "Open in Google Slides" button must work
  - Error handling if Google API fails: "Failed to create Google Slides. Please try again."

**A4.4 Audio Creation:**
- **Audio Generation:**
  - Audio must be clear and understandable
  - Playback controls must be functional (play, pause, seek)
  - Duration must be displayed: "Duration: 2:30"
  - Download button must work

- **Subtitles:**
  - Subtitles must be synchronized with audio
  - Subtitle display toggle must work
  - Language indicator must be visible

**A4.5 Mind Map Generator:**
- **Visualization:**
  - Mind map must be interactive (zoom, pan, drag nodes)
  - Nodes must be clearly labeled
  - Connections between nodes must be visible
  - "Export" button must generate PNG or SVG

- **Editing:**
  - Nodes must be editable by clicking
  - "Regenerate" button must regenerate entire map
  - Changes must be saved automatically

### B. Content Management

#### B1. Course Management
- **Course Creation:**
  - Course name: Required, 3-255 characters
  - Description: Optional, maximum 2000 characters
  - Skills input: Multi-select dropdown or tags input
  - Language selector: Dropdown with language options
  - "Create Course" button must be prominent

- **Course List:**
  - Display courses in card grid or table view
  - Each card must show: course name, description preview, skills count, status badge
  - "Edit" and "Delete" buttons must be visible
  - Status filter must work: "All", "Active", "Archived", "Deleted"

- **Course Edit:**
  - All fields must be pre-populated with current values
  - "Save Changes" button must update course
  - "Cancel" button must discard changes
  - Success message: "Course updated successfully"

- **Soft Delete:**
  - Delete button must show confirmation modal: "Are you sure you want to delete this course?"
  - Deleted courses must not appear in default list
  - "Show Deleted" toggle must restore deleted courses in list

#### B2. Lesson/Topic Management
- **Lesson Creation:**
  - Topic name: Required, 3-255 characters
  - Course association: Dropdown with "None (Stand-alone)" option
  - Template selection: Dropdown with template options
  - Generation method: Radio buttons or dropdown
  - "Create Lesson" button must validate: "Lesson must have at least 5 content formats"

- **Format Requirements:**
  - Visual indicator showing: "5/5 formats required"
  - Progress bar showing format completion
  - Missing formats highlighted in red
  - Error message: "Please add all required formats: [list missing formats]"

- **Stand-alone Lessons:**
  - Stand-alone indicator badge: "Stand-alone Lesson"
  - "Add to Course" button must allow course association
  - Usage count must be visible: "Used: 5 times"

#### B3. Template Management
- **Template Creation:**
  - Template name: Required, 3-255 characters
  - Template type: Radio buttons (Structural, Prompt, Mixed)
  - Format order: Drag-and-drop interface for structural templates
  - Prompt template: Textarea with placeholder support for prompt templates
  - "Save Template" button must validate format order

- **Template List:**
  - Display templates in list with type badges
  - "Use Template" button must apply template to lesson
  - "Edit" and "Delete" buttons must be functional

#### B4. Content Versioning & History
- **Version Display:**
  - Version number must be visible: "Version 3"
  - "View History" button must show version timeline
  - Each version must show: timestamp, editor, change description
  - "Restore Version" button must work with confirmation

- **Rollback:**
  - Confirmation modal: "Restore this version? Current changes will be saved as a new version."
  - Success message: "Version restored successfully"
  - Current version must be clearly marked

### C. Quality & Validation

#### C1. Quality & Originality Checks
- **Check Results Display:**
  - Quality score: Progress bar showing percentage (0-100%)
  - Individual scores: Clarity, Complexity, Structure, Originality (each with score)
  - Color coding:
    - Green: 80-100% (Passed)
    - Yellow: 60-79% (Warning)
    - Red: 0-59% (Failed)
  - Detailed feedback must be expandable

- **Plagiarism Check:**
  - Similarity percentage must be displayed
  - If plagiarism detected: "Similarity: 45% - Review recommended"
  - Sources must be listed if available

#### C2. Content Search & Filtering
- **Search Functionality:**
  - Search bar must be visible at top of page
  - Search must work across: title, description, skills
  - Results must update as user types (debounced, 300ms delay)
  - "No results found" message must be clear

- **Filtering:**
  - Filter sidebar or dropdown must be accessible
  - Filters must work in combination (AND logic)
  - Active filters must be displayed as chips/tags
  - "Clear Filters" button must reset all filters

- **Pagination:**
  - Results per page: 10, 25, 50 options
  - Page numbers must be clickable
  - "Previous" and "Next" buttons must be functional
  - Current page must be highlighted

### D. Integration & Communication

#### D1. Microservice Integration
- **API Calls:**
  - Loading states must be shown during API calls
  - Error handling: "Failed to connect to [service]. Please try again."
  - Retry mechanism: "Retry" button after failure
  - Timeout: 30 seconds maximum

- **Data Synchronization:**
  - "Syncing..." indicator during sync operations
  - Success message: "Successfully synced with [service]"
  - Error message: "Sync failed. Data may be out of date."

#### D2. Notification System
- **In-App Notifications:**
  - Notification bell icon must show unread count badge
  - Dropdown must list recent notifications
  - Each notification must be clickable
  - "Mark as read" must work
  - "Clear all" button must clear all notifications

- **Email Notifications:**
  - Email preferences must be configurable
  - Email format must be professional and clear
  - Unsubscribe link must be functional

---

## Style and Consistency Requirements

### Coding Style Guidelines
- **Naming Conventions:**
  - Variables: camelCase (e.g., `topicName`)
  - Functions: camelCase (e.g., `createLesson`)
  - Components: PascalCase (e.g., `LessonCard`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)

- **File Structure:**
  - Components: `components/LessonCard.jsx`
  - Utils: `utils/formatDate.js`
  - Services: `services/api.js`
  - Hooks: `hooks/useContent.js`

### UI/UX Design System Standards
- **Color Palette:**
  - Primary: Blue (#3B82F6) - for primary actions
  - Success: Green (#10B981) - for success states
  - Warning: Yellow (#F59E0B) - for warnings
  - Error: Red (#EF4444) - for errors
  - Background: White (#FFFFFF) or Gray-50 (#F9FAFB)

- **Typography:**
  - Headings: Bold, 24px-32px
  - Body: Regular, 16px
  - Small text: Regular, 14px
  - All text must use Tailwind classes

- **Spacing:**
  - Consistent spacing using Tailwind scale (4px, 8px, 16px, 24px, 32px)
  - Padding: p-4, p-6, p-8
  - Margin: m-4, m-6, m-8

- **Buttons:**
  - Primary: `bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700`
  - Secondary: `bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300`
  - Danger: `bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700`

### Component Consistency Rules
- **Form Components:**
  - All inputs must have labels
  - Error messages must appear below input fields
  - Required fields must be marked with asterisk (*)
  - Submit buttons must be disabled until form is valid

- **Card Components:**
  - Consistent padding: p-6
  - Border: border border-gray-200 rounded-lg
  - Shadow: shadow-sm
  - Hover effect: hover:shadow-md transition-shadow

### Responsive Design Breakpoints
- **Mobile (sm):** 640px and below
- **Tablet (md):** 768px - 1023px
- **Desktop (lg):** 1024px - 1279px
- **Large Desktop (xl):** 1280px and above

### Animation and Interaction Standards
- **Transitions:**
  - All hover effects: `transition-all duration-200`
  - Loading spinners: Smooth rotation animation
  - Modal appearances: Fade-in animation

- **Loading States:**
  - Spinner: `animate-spin` class
  - Skeleton loaders for content areas
  - Progress bars for long operations

---

## Validation Protocol

### AI Validation Process
1. **Before Marking Complete:**
   - AI must validate all implementations against requirements
   - Requirements are versioned and immutable once locked
   - Deviations require approval and documentation in audit log

2. **Version Control:**
   - All requirements changes must be versioned
   - Previous versions must remain accessible
   - Change log must document rationale for changes

3. **Reference:**
   - All generated code must comply with standards in this file
   - Code reviews must reference this file
   - Testing must validate against these requirements

---

**Last Updated:** 2025-01-04  
**Next Review:** After MVP completion

