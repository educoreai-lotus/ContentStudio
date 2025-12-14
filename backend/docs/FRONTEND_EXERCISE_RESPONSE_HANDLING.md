# Frontend Exercise Response Handling Guide

## Overview
This document explains how the frontend should handle responses from the backend when generating AI exercises.

## Response Formats

### Success Response (HTTP 201)
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
        "hint": "Think about storage containers"
      },
      ...
    ]
  }
}
```

### Failure Response (HTTP 200)
```json
{
  "success": false
}
```

**Important**: Failure response contains NO error details, NO explanations, NO partial data.

## Frontend Implementation

### 1. Handling Success Response

```javascript
const handleAIGenerate = async () => {
  try {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setGeneratedExercises([]);

    const response = await exercisesService.generateAI({
      topic_id: parseInt(topicId),
      question_type: aiConfig.question_type,
      programming_language: aiConfig.programming_language,
      language: topicLanguage || 'en',
      amount: 4,
      theoretical_question_type: aiConfig.theoretical_question_type,
    });

    // Check for success
    if (response.success === true && response.data) {
      const { questions, hints } = response.data;
      
      // Combine questions with their hints
      const exercisesWithHints = questions.map(question => {
        const hint = hints.find(h => h.question_id === question.exercise_id);
        return {
          ...question,
          hint: hint?.hint || null,
        };
      });
      
      setGeneratedExercises(exercisesWithHints);
      setSuccessMessage(response.message || 'Questions generated successfully');
    } else if (response.success === false) {
      // Failure - minimal error message
      setError('Failed to generate exercises. Please try again.');
    }
  } catch (error) {
    // Handle network errors or backend { success: false }
    if (error?.response?.data?.success === false || error?.success === false) {
      setError('Failed to generate exercises. Please try again.');
    } else {
      setError('Failed to generate exercises');
    }
  } finally {
    setLoading(false);
  }
};
```

### 2. Displaying Success Message

```jsx
{/* Success Message Banner */}
{successMessage && (
  <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
    <div className="flex items-center">
      <i className="fas fa-check-circle text-green-600 dark:text-green-400 mr-2"></i>
      <p className="text-green-800 dark:text-green-200 font-semibold">
        {successMessage}
      </p>
    </div>
  </div>
)}
```

### 3. Displaying Questions and Hints

```jsx
{/* Generated Questions List */}
{generatedExercises.length > 0 && (
  <div className="mt-6">
    <h3 className="text-lg font-semibold mb-4">
      Generated Questions ({generatedExercises.length})
    </h3>
    <div className="space-y-4">
      {generatedExercises.map((exercise, index) => (
        <div
          key={exercise.exercise_id || index}
          className="border border-gray-200 dark:border-[#334155] rounded-lg p-4 bg-gray-50 dark:bg-[#0f172a]"
        >
          {/* Question Header */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="font-semibold text-base">Question {index + 1}</span>
              {exercise.difficulty && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  ({exercise.difficulty})
                </span>
              )}
              {exercise.language && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  [{exercise.language}]
                </span>
              )}
            </div>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
              AI Generated
            </span>
          </div>

          {/* Question Text */}
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Question:
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {exercise.question_text}
            </p>
          </div>

          {/* Hint (if available) */}
          {exercise.hint && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#334155]">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <i className="fas fa-lightbulb mr-1"></i>
                Hint:
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300 italic">
                {exercise.hint}
              </p>
            </div>
          )}

          {/* Test Cases (if available) */}
          {exercise.test_cases && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#334155]">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <i className="fas fa-vial mr-1"></i>
                Test Cases:
              </p>
              <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#1e293b] p-2 rounded overflow-x-auto">
                {JSON.stringify(exercise.test_cases, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>

    {/* Done Button */}
    <button
      onClick={handleSaveAll}
      className="mt-4 w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
    >
      <i className="fas fa-check mr-2"></i>
      Done - All Questions Saved
    </button>
  </div>
)}
```

### 4. Displaying Failure Message

```jsx
{/* Error is displayed via AppContext.setError() */}
{/* The error message is minimal: "Failed to generate exercises. Please try again." */}
{/* No technical details are shown to the trainer */}
```

## Key Points

1. **Success Response**:
   - Display success message banner
   - Show all questions with their hints
   - Combine hints with questions using `question_id`
   - Display additional metadata (difficulty, language, test_cases) if available

2. **Failure Response**:
   - Show minimal error message: "Failed to generate exercises. Please try again."
   - Do NOT show technical details
   - Do NOT show partial data
   - Do NOT show error codes or stack traces

3. **Data Structure**:
   - `questions` array contains question objects with `exercise_id`, `question_text`, `difficulty`, `language`, etc.
   - `hints` array contains objects with `question_id` and `hint` text
   - Combine them by matching `hint.question_id === question.exercise_id`

4. **UI Requirements**:
   - Present questions in a clear, structured format
   - Display hints per question in a readable and accessible way
   - Do NOT expose raw HTML or internal metadata to the trainer
   - Use appropriate icons and styling for visual clarity

## Example Flow

1. User clicks "Generate 4 Code Exercises"
2. Frontend shows loading state
3. Backend processes request:
   - Parses `response.answer` as JSON
   - Validates required fields
   - Saves to database atomically
   - Returns success/failure response
4. Frontend receives response:
   - **Success**: Display success message + questions + hints
   - **Failure**: Display minimal error message
5. User sees results and can close modal

