# Phase 5: UI/UX Design

**Status:** 🚧 IN PROGRESS  
**Created:** 2025-01-04  
**Last Updated:** 2025-01-04

---

## Overview

This document provides comprehensive UI/UX design specifications for Content Studio, including design system, information architecture, wireframes, component library, accessibility, and responsive design. All designs follow Tailwind CSS-only styling with no CSS files.

---

## 5.1 Design System Foundation

### 5.1.1 Color Palette

**Primary Colors:**
- **Primary Blue:** `#3B82F6` (bg-blue-600) - Primary actions, links, active states
- **Primary Blue Dark:** `#2563EB` (bg-blue-700) - Hover states for primary buttons
- **Primary Blue Light:** `#60A5FA` (bg-blue-500) - Secondary actions, disabled states

**Semantic Colors:**
- **Success Green:** `#10B981` (bg-green-600) - Success messages, completed states
- **Warning Yellow:** `#F59E0B` (bg-yellow-500) - Warnings, pending states
- **Error Red:** `#EF4444` (bg-red-600) - Errors, failed states, destructive actions
- **Info Blue:** `#3B82F6` (bg-blue-500) - Informational messages

**Neutral Colors:**
- **Gray Scale:**
  - `#F9FAFB` (bg-gray-50) - Backgrounds
  - `#F3F4F6` (bg-gray-100) - Light backgrounds, borders
  - `#E5E7EB` (bg-gray-200) - Borders, dividers
  - `#D1D5DB` (bg-gray-300) - Disabled states
  - `#9CA3AF` (bg-gray-400) - Placeholder text
  - `#6B7280` (bg-gray-500) - Secondary text
  - `#4B5563` (bg-gray-600) - Body text
  - `#374151` (bg-gray-700) - Headings
  - `#1F2937` (bg-gray-800) - Dark backgrounds
  - `#111827` (bg-gray-900) - Darkest backgrounds

**Status Colors:**
- **Active:** `#10B981` (green-600)
- **Draft:** `#6B7280` (gray-500)
- **Archived:** `#9CA3AF` (gray-400)
- **Deleted:** `#EF4444` (red-600) - Soft delete indicator

**Quality Score Colors:**
- **High (80-100%):** `#10B981` (green-600)
- **Medium (60-79%):** `#F59E0B` (yellow-500)
- **Low (0-59%):** `#EF4444` (red-600)

### 5.1.2 Typography

**Font Family:**
- **Primary:** System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`
- **Code:** `'Courier New', Courier, monospace` (for code examples)

**Font Sizes (Tailwind):**
- **Display (XL):** `text-4xl` (36px) - Page titles, hero sections
- **Heading 1 (H1):** `text-3xl` (30px) - Main section titles
- **Heading 2 (H2):** `text-2xl` (24px) - Section headings
- **Heading 3 (H3):** `text-xl` (20px) - Subsection headings
- **Heading 4 (H4):** `text-lg` (18px) - Card titles
- **Body Large:** `text-base` (16px) - Primary body text
- **Body:** `text-sm` (14px) - Secondary body text, descriptions
- **Small:** `text-xs` (12px) - Labels, captions, timestamps

**Font Weights:**
- **Bold:** `font-bold` (700) - Headings, emphasis
- **Semibold:** `font-semibold` (600) - Subheadings, labels
- **Medium:** `font-medium` (500) - Buttons, important text
- **Regular:** `font-normal` (400) - Body text
- **Light:** `font-light` (300) - Secondary text

**Line Heights:**
- **Tight:** `leading-tight` (1.25) - Headings
- **Normal:** `leading-normal` (1.5) - Body text
- **Relaxed:** `leading-relaxed` (1.75) - Long paragraphs

### 5.1.3 Spacing System

**Tailwind Spacing Scale (4px base):**
- `0` - 0px
- `1` - 4px (0.25rem)
- `2` - 8px (0.5rem)
- `3` - 12px (0.75rem)
- `4` - 16px (1rem)
- `5` - 20px (1.25rem)
- `6` - 24px (1.5rem)
- `8` - 32px (2rem)
- `10` - 40px (2.5rem)
- `12` - 48px (3rem)
- `16` - 64px (4rem)
- `20` - 80px (5rem)

**Component Spacing:**
- **Card Padding:** `p-6` (24px)
- **Form Field Spacing:** `mb-4` (16px) between fields
- **Section Spacing:** `mb-8` (32px) between sections
- **Page Padding:** `p-4 md:p-6 lg:p-8` (responsive)

### 5.1.4 Border Radius

- **None:** `rounded-none` (0px)
- **Small:** `rounded-sm` (2px) - Small elements
- **Base:** `rounded` (4px) - Default buttons, inputs
- **Medium:** `rounded-md` (6px) - Cards, modals
- **Large:** `rounded-lg` (8px) - Large cards, containers
- **XL:** `rounded-xl` (12px) - Hero sections, featured content
- **Full:** `rounded-full` (9999px) - Badges, avatars, pills

### 5.1.5 Shadows

- **None:** `shadow-none`
- **Small:** `shadow-sm` - Subtle elevation
- **Base:** `shadow` - Default cards, buttons on hover
- **Medium:** `shadow-md` - Modals, dropdowns
- **Large:** `shadow-lg` - Large modals, overlays
- **XL:** `shadow-xl` - Hero sections, featured content

### 5.1.6 Buttons

**Primary Button:**
```jsx
<button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
  Primary Action
</button>
```

**Secondary Button:**
```jsx
<button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
  Secondary Action
</button>
```

**Danger Button:**
```jsx
<button className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
  Delete
</button>
```

**Outline Button:**
```jsx
<button className="border border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-2 px-4 rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
  Outline Action
</button>
```

**Button Sizes:**
- **Small:** `py-1 px-2 text-sm`
- **Medium:** `py-2 px-4 text-base` (default)
- **Large:** `py-3 px-6 text-lg`

### 5.1.7 Cards

**Standard Card:**
```jsx
<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
  {/* Card content */}
</div>
```

**Card Variations:**
- **Hoverable:** `hover:shadow-md transition-shadow duration-200 cursor-pointer`
- **Selected:** `border-blue-600 border-2`
- **Loading:** Skeleton loader with `animate-pulse`

### 5.1.8 Form Elements

**Input Field:**
```jsx
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Label <span className="text-red-600">*</span>
  </label>
  <input
    type="text"
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
  />
  <p className="mt-1 text-sm text-red-600">Error message</p>
</div>
```

**Textarea:**
```jsx
<textarea
  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-y"
  rows={4}
/>
```

**Select Dropdown:**
```jsx
<select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent">
  <option>Option 1</option>
</select>
```

**Checkbox:**
```jsx
<label className="flex items-center">
  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-600" />
  <span className="ml-2 text-sm text-gray-700">Checkbox label</span>
</label>
```

**Radio Button:**
```jsx
<label className="flex items-center">
  <input type="radio" className="border-gray-300 text-blue-600 focus:ring-blue-600" />
  <span className="ml-2 text-sm text-gray-700">Radio label</span>
</label>
```

### 5.1.9 Loading States

**Spinner:**
```jsx
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
```

**Skeleton Loader:**
```jsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

**Progress Bar:**
```jsx
<div className="w-full bg-gray-200 rounded-full h-2">
  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
</div>
```

### 5.1.10 Badges & Status Indicators

**Status Badge:**
```jsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Active
</span>
```

**Badge Colors:**
- **Active:** `bg-green-100 text-green-800`
- **Draft:** `bg-gray-100 text-gray-800`
- **Archived:** `bg-yellow-100 text-yellow-800`
- **Deleted:** `bg-red-100 text-red-800`

**Notification Badge:**
```jsx
<span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
  3
</span>
```

### 5.1.11 Icons

**Icon System:**
- Use Heroicons (via `@heroicons/react`) or similar icon library
- Consistent icon sizes: `h-5 w-5` (20px), `h-6 w-6` (24px), `h-8 w-8` (32px)
- Icon colors match text colors: `text-gray-600`, `text-blue-600`, etc.

### 5.1.12 Animations & Transitions

**Hover Effects:**
```jsx
className="transition-all duration-200 hover:shadow-md"
```

**Focus States:**
```jsx
className="focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
```

**Loading Animation:**
```jsx
className="animate-spin"
```

**Fade In:**
```jsx
className="animate-fade-in" // Custom animation (define in Tailwind config if needed)
```

---

## 5.2 Information Architecture

### 5.2.1 Navigation Structure

**Main Navigation (Top Bar):**
```
┌─────────────────────────────────────────────────────────┐
│ [Logo] Content Studio    [Search]  [Notifications] [User] │
└─────────────────────────────────────────────────────────┘
```

**Sidebar Navigation:**
```
┌─────────────────┐
│ 🏠 Dashboard    │
│ 📚 Courses      │
│ 📝 Lessons      │
│ 🎨 Templates    │
│ ➕ Create New   │
│ 🔍 Search       │
│ ⚙️ Settings     │
└─────────────────┘
```

**Page Hierarchy:**
1. **Dashboard** (Home)
   - Overview statistics
   - Recent courses/lessons
   - Quick actions

2. **Courses**
   - Course list
   - Course detail
   - Course editor

3. **Lessons (Topics)**
   - Lesson list
   - Lesson detail
   - Lesson editor
   - Content formats

4. **Templates**
   - Template list
   - Template editor

5. **Create New**
   - Video to Lesson
   - AI-Assisted Creation
   - Manual Creation

6. **Search**
   - Search results
   - Filter options

7. **Settings**
   - Profile settings
   - Preferences

### 5.2.2 Content Organization

**Course Structure:**
- Course → Multiple Lessons → Multiple Content Formats
- Stand-alone Lessons (not tied to course)

**Content Format Hierarchy:**
1. Text (required)
2. Code (required)
3. Presentation (required)
4. Audio (required)
5. Mind Map (required)
6. Avatar Video (optional)

### 5.2.3 User Flow Diagrams

**Primary User Flows:**

1. **Create Course Flow:**
   ```
   Dashboard → Create New → Course → Enter Details → Save → Course List
   ```

2. **Video-to-Lesson Flow:**
   ```
   Create New → Video Upload → Upload Video → Processing → Review Formats → Save
   ```

3. **AI-Assisted Creation Flow:**
   ```
   Create New → AI-Assisted → Enter Topic/Ideas → Select Formats → Generate → Review → Save
   ```

4. **Manual Creation Flow:**
   ```
   Create New → Manual → Select Format → Enter/Upload Content → Quality Check → Save
   ```

5. **Edit Content Flow:**
   ```
   Course/Lesson List → Select Item → View Details → Edit → Save → View History
   ```

---

## 5.3 Wireframe & Prototype Design

### 5.3.1 Dashboard (Home Page)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Content Studio  [Search]  [🔔] [User Profile]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 Statistics Cards (4 cards in row)                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │Total │ │Total │ │AI Gen│ │Manual│                        │
│  │Courses│ │Lessons│ │Count │ │Count │                        │
│  └──────┘ └──────┘ └──────┘ └──────┘                        │
│                                                               │
│  🚀 Quick Actions                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │Video to     │ │AI-Assisted  │ │Manual       │           │
│  │Lesson       │ │Creation     │ │Creation     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                               │
│  📚 Recent Courses                                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Course Card 1                                        │     │
│  │ Course Card 2                                        │     │
│  │ Course Card 3                                        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  📝 Recent Lessons                                           │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Lesson Card 1                                        │     │
│  │ Lesson Card 2                                        │     │
│  │ Lesson Card 3                                        │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Component Specifications:**

**Statistics Cards:**
```jsx
<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-600">Total Courses</p>
      <p className="text-3xl font-bold text-gray-900">42</p>
    </div>
    <div className="bg-blue-100 rounded-full p-3">
      {/* Icon */}
    </div>
  </div>
</div>
```

**Quick Action Cards:**
```jsx
<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
  <div className="text-center">
    <div className="bg-blue-100 rounded-full p-4 inline-block mb-4">
      {/* Icon */}
    </div>
    <h3 className="text-lg font-semibold text-gray-900">Video to Lesson</h3>
    <p className="text-sm text-gray-600 mt-2">Transform video into structured lesson</p>
  </div>
</div>
```

### 5.3.2 Course List Page

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Content Studio  [Search]  [🔔] [User Profile]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  < Back to Dashboard                                          │
│                                                               │
│  📚 Courses                            [+ Create Course]      │
│                                                               │
│  [All] [Active] [Archived] [Deleted]  [Search...] [Filter] │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Course Card 1                          [Active]     │     │
│  │ Course Name: Introduction to React                  │     │
│  │ Description: Learn React fundamentals...             │     │
│  │ Lessons: 12 | Skills: JavaScript, React, UI         │     │
│  │ [View] [Edit] [Archive] [Delete]                   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Course Card 2                          [Active]     │     │
│  │ ...                                                   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  [< Previous] [1] [2] [3] [Next >]                            │
└─────────────────────────────────────────────────────────────┘
```

**Course Card Component:**
```jsx
<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-4">
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xl font-semibold text-gray-900">Course Name</h3>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Active
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">Description...</p>
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>Lessons: 12</span>
        <span>Skills: JavaScript, React, UI</span>
      </div>
    </div>
    <div className="flex gap-2">
      <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        View
      </button>
      <button className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
        Edit
      </button>
    </div>
  </div>
</div>
```

### 5.3.3 Course Creation Form

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Content Studio  [Search]  [🔔] [User Profile]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  < Back to Courses                                            │
│                                                               │
│  Create New Course                                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Course Name *                                       │     │
│  │ [________________________________]                  │     │
│  │                                                      │     │
│  │ Description                                         │     │
│  │ [________________________________]                  │     │
│  │ [________________________________]                  │     │
│  │                                                      │     │
│  │ Skills                                              │     │
│  │ [Multi-select dropdown or tags input]               │     │
│  │                                                      │     │
│  │ Language                                            │     │
│  │ [Select: English ▼]                                  │     │
│  │                                                      │     │
│  │ [Cancel]              [Save Course]                 │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Form Component:**
```jsx
<form className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Course Name <span className="text-red-600">*</span>
    </label>
    <input
      type="text"
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
      placeholder="Enter course name"
    />
  </div>
  
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Description
    </label>
    <textarea
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
      rows={4}
      placeholder="Enter course description"
    />
  </div>
  
  <div className="flex justify-end gap-2">
    <button className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
      Cancel
    </button>
    <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
      Save Course
    </button>
  </div>
</form>
```

### 5.3.4 Video-to-Lesson Upload Page

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Content Studio  [Search]  [🔔] [User Profile]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  < Back to Create New                                         │
│                                                               │
│  🎥 Video to Lesson Transformation                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Step 1: Upload Video                                │     │
│  │                                                      │     │
│  │ [Drag and drop video here or click to browse]      │     │
│  │                                                      │     │
│  │ Supported formats: MP4, MOV, AVI, WebM             │     │
│  │ Maximum size: 500MB                                  │     │
│  │                                                      │     │
│  │ [Upload Video]                                       │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Step 2: Processing                                  │     │
│  │                                                      │     │
│  │ [Progress Bar: 60%]                                 │     │
│  │                                                      │     │
│  │ ✓ Video uploaded                                    │     │
│  │ ✓ Transcription complete                            │     │
│  │ ⏳ Summarizing...                                    │     │
│  │ ⏳ Generating formats...                             │     │
│  │   - Text: Generating... (1/5)                        │     │
│  │   - Code: Pending                                    │     │
│  │   - Presentation: Pending                            │     │
│  │   - Audio: Pending                                  │     │
│  │   - Mind Map: Pending                               │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Step 3: Review & Save                                │     │
│  │                                                      │     │
│  │ [Generated formats preview]                         │     │
│  │                                                      │     │
│  │ [Edit] [Save Lesson]                                 │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Upload Component:**
```jsx
<div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-600 transition-colors">
  <div className="mb-4">
    {/* Upload icon */}
  </div>
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    Drag and drop video here
  </h3>
  <p className="text-sm text-gray-600 mb-4">
    or click to browse
  </p>
  <p className="text-xs text-gray-500">
    Supported formats: MP4, MOV, AVI, WebM | Maximum size: 500MB
  </p>
  <input type="file" accept="video/*" className="hidden" />
</div>
```

**Progress Component:**
```jsx
<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
  <div className="mb-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-gray-700">Processing...</span>
      <span className="text-sm text-gray-600">60%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
    </div>
  </div>
  
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm">
      <span className="text-green-600">✓</span>
      <span className="text-gray-700">Video uploaded</span>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <span className="text-green-600">✓</span>
      <span className="text-gray-700">Transcription complete</span>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      <span className="text-gray-700">Summarizing...</span>
    </div>
  </div>
</div>
```

### 5.3.5 AI-Assisted Content Creation Page

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Content Studio  [Search]  [🔔] [User Profile]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  < Back to Create New                                         │
│                                                               │
│  🤖 AI-Assisted Content Creation                             │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Step 1: Enter Details                              │     │
│  │                                                      │     │
│  │ Topic *                                             │     │
│  │ [________________________________]                  │     │
│  │                                                      │     │
│  │ Key Ideas *                                         │     │
│  │ [________________________________]                  │     │
│  │ [________________________________]                  │     │
│  │                                                      │     │
│  │ Select Formats *                                    │     │
│  │ ☑ Text  ☑ Code  ☑ Presentation  ☐ Audio  ☐ Mind Map│   │
│  │                                                      │     │
│  │ Style Mode                                          │     │
│  │ [Select: Educational ▼]                             │     │
│  │                                                      │     │
│  │ [Cancel]              [Generate Content]             │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Step 2: Generation Status                           │     │
│  │                                                      │     │
│  │ [Spinner] Generating content...                     │     │
│  │ Estimated time: 30-60 seconds                       │     │
│  │                                                      │     │
│  │ Formats:                                            │     │
│  │ ✓ Text: Completed                                   │     │
│  │ ⏳ Code: Generating...                               │     │
│  │ ⏳ Presentation: Generating...                      │     │
│  │ ⏳ Audio: Pending                                   │     │
│  │ ⏳ Mind Map: Pending                                │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Step 3: Review Generated Content                    │     │
│  │                                                      │     │
│  │ [Generated content previews]                        │     │
│  │                                                      │     │
│  │ [Regenerate] [Save Content]                         │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 5.3.6 Lesson Editor Page

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Content Studio  [Search]  [🔔] [User Profile]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  < Back to Lesson List                                        │
│                                                               │
│  📝 Lesson: Introduction to React Components                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Lesson Details                                      │     │
│  │                                                      │     │
│  │ Topic Name: [Introduction to React Components]      │     │
│  │ Description: [________________________________]      │     │
│  │                                                      │     │
│  │ Format Requirements: 5/5 formats required            │     │
│  │ [Progress Bar: 100%]                                │     │
│  │                                                      │     │
│  │ ✓ Text  ✓ Code  ✓ Presentation  ✓ Audio  ✓ Mind Map│   │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Content Formats                                      │     │
│  │                                                      │     │
│  │ 📄 Text                                              │     │
│  │ [Generated text content preview]                    │     │
│  │ [Edit] [Regenerate]                                 │     │
│  │                                                      │     │
│  │ 💻 Code                                              │     │
│  │ [Code editor with syntax highlighting]              │     │
│  │ [Edit] [Regenerate]                                 │     │
│  │                                                      │     │
│  │ 📊 Presentation                                      │     │
│  │ [Presentation preview]                              │     │
│  │ [Open in Google Slides] [Edit] [Regenerate]         │     │
│  │                                                      │     │
│  │ 🎵 Audio                                             │     │
│  │ [Audio player with controls]                        │     │
│  │ [Edit] [Regenerate] [Download]                      │     │
│  │                                                      │     │
│  │ 🗺️ Mind Map                                          │     │
│  │ [Interactive mind map visualization]                │     │
│  │ [Edit] [Regenerate] [Export PNG/SVG]                │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  [Cancel] [Save Lesson]                                       │
└─────────────────────────────────────────────────────────────┘
```

### 5.3.7 Quality Check Display

**Component:**
```jsx
<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Check Results</h3>
  
  <div className="mb-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-gray-700">Overall Score</span>
      <span className="text-lg font-bold text-green-600">85%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div className="bg-green-600 h-3 rounded-full" style={{ width: '85%' }}></div>
    </div>
  </div>
  
  <div className="grid grid-cols-2 gap-4">
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">Clarity</span>
        <span className="text-sm font-medium text-green-600">90%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-green-600 h-2 rounded-full" style={{ width: '90%' }}></div>
      </div>
    </div>
    
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">Difficulty</span>
        <span className="text-sm font-medium text-yellow-600">80%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '80%' }}></div>
      </div>
    </div>
    
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">Structure</span>
        <span className="text-sm font-medium text-green-600">85%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
      </div>
    </div>
    
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">Originality</span>
        <span className="text-sm font-medium text-green-600">85%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
      </div>
    </div>
  </div>
  
  <details className="mt-4">
    <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
      View detailed feedback
    </summary>
    <div className="mt-2 p-4 bg-gray-50 rounded-md">
      <p className="text-sm text-gray-700">Detailed feedback text...</p>
    </div>
  </details>
</div>
```

### 5.3.8 Search & Filter Page

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Content Studio  [Search]  [🔔] [User Profile]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  🔍 Search Content                                           │
│                                                               │
│  [Search input with live search...]                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Filters                                               │   │
│  │                                                       │   │
│  │ Status:                                              │   │
│  │ ☑ All  ☐ Active  ☐ Draft  ☐ Archived               │   │
│  │                                                       │   │
│  │ Generation Method:                                    │   │
│  │ ☑ All  ☐ AI-Assisted  ☐ Manual  ☐ Video-to-Lesson  │   │
│  │                                                       │   │
│  │ Format Type:                                         │   │
│  │ ☑ All  ☐ Text  ☐ Code  ☐ Presentation  ☐ Audio    │   │
│  │                                                       │   │
│  │ [Clear Filters]                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Active Filters: [Status: Active] [Format: Text]           │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Search Results (42 found)                            │   │
│  │                                                       │   │
│  │ Result 1: Lesson - Introduction to React            │   │
│  │ Result 2: Course - JavaScript Fundamentals          │   │
│  │ Result 3: Lesson - React Hooks                       │   │
│  │ ...                                                   │   │
│  │                                                       │   │
│  │ [< Previous] [1] [2] [3] [Next >]                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5.4 Accessibility & Responsive Design

### 5.4.1 Accessibility Requirements (WCAG 2.1 AA)

**Color Contrast:**
- Text on background: Minimum 4.5:1 ratio
- Large text (18px+): Minimum 3:1 ratio
- Interactive elements: Minimum 3:1 ratio

**Keyboard Navigation:**
- All interactive elements must be keyboard accessible
- Focus indicators visible (ring-2 ring-blue-600)
- Tab order logical and intuitive

**Screen Reader Support:**
- Semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`)
- ARIA labels for icons and buttons
- Alt text for images
- Form labels associated with inputs

**Examples:**
```jsx
// Button with aria-label
<button
  aria-label="Close modal"
  className="..."
>
  <XIcon className="h-5 w-5" />
</button>

// Form input with label
<label htmlFor="course-name" className="...">
  Course Name
</label>
<input
  id="course-name"
  type="text"
  aria-required="true"
  className="..."
/>

// Loading state with aria-live
<div aria-live="polite" aria-atomic="true">
  {isLoading && <span>Loading...</span>}
</div>
```

**Error Messages:**
- Error messages associated with form fields (`aria-describedby`)
- Error messages announced to screen readers

```jsx
<input
  id="email"
  type="email"
  aria-invalid={hasError}
  aria-describedby="email-error"
/>
{hasError && (
  <p id="email-error" className="text-red-600 text-sm" role="alert">
    Please enter a valid email address
  </p>
)}
```

### 5.4.2 Responsive Design Breakpoints

**Tailwind Breakpoints:**
- **sm:** 640px - Small tablets, large phones
- **md:** 768px - Tablets
- **lg:** 1024px - Small laptops, desktops
- **xl:** 1280px - Large desktops
- **2xl:** 1536px - Extra large desktops

**Responsive Patterns:**

**Mobile-First Approach:**
```jsx
// Stack on mobile, side-by-side on desktop
<div className="flex flex-col md:flex-row gap-4">
  <div className="w-full md:w-1/2">...</div>
  <div className="w-full md:w-1/2">...</div>
</div>

// Hide on mobile, show on desktop
<div className="hidden md:block">...</div>

// Show on mobile, hide on desktop
<div className="block md:hidden">...</div>

// Responsive text sizes
<h1 className="text-2xl md:text-3xl lg:text-4xl">...</h1>

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">...</div>

// Responsive grid columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">...</div>
```

**Mobile Navigation:**
```jsx
// Hamburger menu for mobile
<div className="md:hidden">
  <button aria-label="Toggle menu">
    <MenuIcon className="h-6 w-6" />
  </button>
</div>

// Sidebar for desktop
<div className="hidden md:block">
  {/* Sidebar content */}
</div>
```

**Responsive Tables:**
```jsx
// Stack table on mobile, show as table on desktop
<div className="overflow-x-auto">
  <table className="w-full">
    {/* Table content */}
  </table>
</div>
```

### 5.4.3 Touch-Friendly Design

**Touch Target Sizes:**
- Minimum 44x44px (11 Tailwind units) for touch targets
- Adequate spacing between interactive elements (minimum 8px)

```jsx
// Touch-friendly button
<button className="px-4 py-3 text-base min-h-[44px]">
  Touch Target
</button>
```

**Gesture Support:**
- Swipe gestures for mobile navigation (future enhancement)
- Pull-to-refresh (future enhancement)

---

## 5.5 Performance Optimization

### 5.5.1 Loading Performance

**Code Splitting:**
- Route-based code splitting with React.lazy()
- Component-level lazy loading for heavy components

```jsx
// Lazy load heavy components
const VideoUpload = React.lazy(() => import('./VideoUpload'));
const MindMapEditor = React.lazy(() => import('./MindMapEditor'));

// Use Suspense
<Suspense fallback={<LoadingSpinner />}>
  <VideoUpload />
</Suspense>
```

**Image Optimization:**
- Lazy loading for images
- Optimized image formats (WebP with fallback)
- Responsive images with srcset

```jsx
<img
  src="image.jpg"
  loading="lazy"
  alt="Description"
  className="w-full h-auto"
/>
```

**Font Optimization:**
- System fonts for fast loading
- Font-display: swap for custom fonts (if used)

### 5.5.2 Rendering Performance

**Virtual Scrolling:**
- Use for long lists (100+ items)
- Implement with react-window or similar

**Memoization:**
- Use React.memo() for expensive components
- useMemo() for expensive calculations
- useCallback() for event handlers passed to children

```jsx
// Memoize expensive component
const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
});

// Memoize expensive calculation
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Memoize callback
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

**Debouncing:**
- Debounce search input (300ms)
- Debounce scroll events
- Debounce resize events

```jsx
// Debounced search
const [searchQuery, setSearchQuery] = useState('');
const debouncedSearch = useDebounce(searchQuery, 300);

useEffect(() => {
  // Perform search with debouncedSearch
}, [debouncedSearch]);
```

### 5.5.3 Bundle Size Optimization

**Tree Shaking:**
- Import only needed functions from libraries
- Use ES modules

```jsx
// Good: Import specific function
import { debounce } from 'lodash-es';

// Bad: Import entire library
import _ from 'lodash';
```

**Dynamic Imports:**
- Lazy load heavy libraries
- Load on demand

```jsx
// Load library on demand
const loadLibrary = async () => {
  const library = await import('heavy-library');
  return library;
};
```

---

## 5.6 Component Library

### 5.6.1 Reusable Components

**Button Component:**
```jsx
const Button = ({ children, variant = 'primary', size = 'medium', disabled, onClick, ...props }) => {
  const baseClasses = 'font-medium rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    outline: 'border border-gray-300 hover:border-gray-400 text-gray-700'
  };
  const sizeClasses = {
    small: 'py-1 px-2 text-sm',
    medium: 'py-2 px-4 text-base',
    large: 'py-3 px-6 text-lg'
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};
```

**Input Component:**
```jsx
const Input = ({ label, error, required, ...props }) => {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-600">*</span>}
        </label>
      )}
      <input
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent ${
          error ? 'border-red-600' : 'border-gray-300'
        }`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

**Card Component:**
```jsx
const Card = ({ children, hoverable, selected, className = '', ...props }) => {
  const baseClasses = 'bg-white border rounded-lg shadow-sm p-6';
  const hoverClasses = hoverable ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : '';
  const selectedClasses = selected ? 'border-blue-600 border-2' : 'border-gray-200';
  
  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${selectedClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
```

**Modal Component:**
```jsx
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <XIcon className="h-6 w-6" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};
```

**Badge Component:**
```jsx
const Badge = ({ children, variant = 'default', size = 'medium' }) => {
  const baseClasses = 'inline-flex items-center rounded-full font-medium';
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800'
  };
  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-2.5 py-0.5 text-xs',
    large: 'px-3 py-1 text-sm'
  };
  
  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}>
      {children}
    </span>
  );
};
```

---

## Validation Gates

### Phase 5 Completion Checklist

- [x] Design system foundation documented
- [x] Color palette defined
- [x] Typography system defined
- [x] Spacing system defined
- [x] Component library documented
- [x] Information architecture defined
- [x] Wireframes created for all major pages
- [x] Accessibility requirements documented (WCAG 2.1 AA)
- [x] Responsive design breakpoints defined
- [x] Performance optimization strategies documented
- [ ] Interactive prototypes created (future)
- [ ] Design review and approval (pending)

**Phase 5 Status:** ✅ COMPLETE (Documentation)

---

## Summary

**Phase 5: UI/UX Design - COMPLETE**

**Key Deliverables:**
- Complete design system (colors, typography, spacing, components)
- Information architecture and navigation structure
- Wireframes for all major pages and features
- Accessibility requirements (WCAG 2.1 AA)
- Responsive design specifications
- Performance optimization strategies
- Reusable component library specifications

**Next Steps:**
- Proceed to Phase 6: Implementation
- Implement design system components
- Build pages according to wireframes
- Ensure accessibility compliance
- Optimize for performance

---

**Document Version:** 1.0 (Complete)  
**Last Updated:** 2025-01-04

