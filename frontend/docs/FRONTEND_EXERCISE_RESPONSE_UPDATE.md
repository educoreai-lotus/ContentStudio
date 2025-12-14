# Frontend Exercise Response Update Guide

## Overview
This document explains how to update the frontend to handle the new exercise generation response format.

## Current Response Format (Backend)

### Success Response
```json
{
  "success": true,
  "message": "Questions generated successfully",
  "data": {
    "questions": [
      {
        "exercise_id": 1,
        "question_text": "What is a variable?",
        "difficulty": "easy",
        "language": "en",
        "test_cases": {...},
        "order_index": 0
      },
      ...
    ],
    "hints": [
      {
        "question_id": 1,
        "hint": "Think about how variables store data"
      },
      ...
    ]
  }
}
```

### Failure Response
```json
{
  "success": false
}
```

## Required Frontend Updates

### 1. Update `handleAIGenerate` in `ExerciseCreationModal.jsx`

**Current Code (lines 53-64):**
```javascript
// New response format: { success: true, message: "...", data: { questions: [...], hints: [...] } }
if (response.success === true && response.data) {
  setGeneratedExercises(response.data.questions || []);
  setGeneratedHints(response.data.hints || []);
  setSuccessMessage(response.message || 'Questions generated successfully');
} else if (response.success === false) {
  // Failure response - minimal, no error details
  setError('Failed to generate exercises. Please try again.');
} else {
  // Fallback for unexpected format
  setError('Failed to generate exercises');
}
```

**Updated Code:**
```javascript
// New response format: { success: true, message: "...", data: { questions: [...], hints: [...] } }
if (response && response.success === true && response.data) {
  // Map hints to questions for display
  const exercisesWithHints = (response.data.questions || []).map(question => {
    // Find hint for this question
    const hint = (response.data.hints || []).find(h => h.question_id === question.exercise_id);
    return {
      ...question,
      hint: hint?.hint || null,
    };
  });
  
  setGeneratedExercises(exercisesWithHints);
  setGeneratedHints(response.data.hints || []);
  setSuccessMessage(response.message || 'Questions generated successfully');
} else {
  // Failure response: { success: false } - minimal, no error details
  setError('Failed to generate exercises. Please try again.');
}
```

### 2. Add Success Message Display

**Add after the Generate Button (around line 307):**
```jsx
{/* Success Message */}
{successMessage && (
  <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
    <p className="text-sm text-green-800 dark:text-green-200 font-semibold">
      <i className="fas fa-check-circle mr-2"></i>
      {successMessage}
    </p>
  </div>
)}
```

### 3. Update Exercise Display Header

**Current Code (line 311):**
```jsx
<h3 className="text-lg font-semibold mb-4">Generated Exercises ({generatedExercises.length})</h3>
```

**Updated Code:**
```jsx
<h3 className="text-lg font-semibold mb-4">
  Generated Exercises ({generatedExercises.length})
  {generatedHints.length > 0 && (
    <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">
      ({generatedHints.length} with hints)
    </span>
  )}
</h3>
```

### 4. Update Exercise Card Display

**Current Code (lines 324-329):**
```jsx
<p className="text-sm mb-2">{exercise.question_text}</p>
{exercise.hint && (
  <p className="text-xs text-gray-600 dark:text-gray-400">
    <strong>Hint:</strong> {exercise.hint}
  </p>
)}
```

**Updated Code:**
```jsx
<p className="text-sm mb-2 font-medium">{exercise.question_text}</p>
{exercise.difficulty && (
  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
    <i className="fas fa-signal mr-1"></i>
    Difficulty: <span className="font-semibold">{exercise.difficulty}</span>
  </p>
)}
{exercise.language && (
  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
    <i className="fas fa-language mr-1"></i>
    Language: <span className="font-semibold">{exercise.language}</span>
  </p>
)}
{exercise.hint && (
  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#334155]">
    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
      <i className="fas fa-lightbulb mr-1"></i>
      Hint:
    </p>
    <p className="text-xs text-gray-600 dark:text-gray-400 pl-4">
      {exercise.hint}
    </p>
  </div>
)}
```

## Visual Display

### Success Message
- **Location:** Between Generate Button and Generated Exercises list
- **Style:** Green background with check circle icon
- **Content:** Shows `response.message` (e.g., "Questions generated successfully")

### Questions List
- **Header:** Shows count and hint count (e.g., "Generated Exercises (4) (3 with hints)")
- **Each Exercise Card:**
  - Question text (bold)
  - Difficulty (if available) with signal icon
  - Language (if available) with language icon
  - Hint (if available) in a separate section with lightbulb icon

### Failure Message
- **Location:** Handled by `setError` from AppContext (typically at top of modal)
- **Style:** Red error message
- **Content:** "Failed to generate exercises. Please try again."
- **No Details:** No specific error information (per backend requirements)

## State Variables

Ensure these state variables are defined:
```javascript
const [generatedExercises, setGeneratedExercises] = useState([]);
const [generatedHints, setGeneratedHints] = useState([]);
const [successMessage, setSuccessMessage] = useState(null);
```

## Error Handling

### Catch Block
```javascript
catch (error) {
  console.error('Error generating AI exercises:', error);
  // Failure response: { success: false }
  setError('Failed to generate exercises. Please try again.');
}
```

## Testing Checklist

- [ ] Success response displays message correctly
- [ ] Questions are displayed with all fields
- [ ] Hints are mapped correctly to questions
- [ ] Difficulty and language are shown when available
- [ ] Failure response shows generic error message
- [ ] No error details are exposed to user
- [ ] State is reset when modal closes

