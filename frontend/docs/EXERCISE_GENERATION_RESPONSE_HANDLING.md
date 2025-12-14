# Exercise Generation Response Handling - Frontend Guide

## Overview
This document explains how the frontend should handle responses from the backend when generating AI exercises.

## Backend Response Format

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
        "test_cases": null,
        "order_index": 0
      },
      ...
    ],
    "hints": [
      {
        "question_id": 1,
        "hint": "Think about how data is stored in memory"
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

**Important:** The failure response contains NO error details, NO messages, and NO explanations.

## Frontend Implementation

### 1. State Management

Add these state variables to `ExerciseCreationModal.jsx`:

```javascript
const [generatedExercises, setGeneratedExercises] = useState([]);
const [generatedHints, setGeneratedHints] = useState([]); // Hints from AI generation
const [successMessage, setSuccessMessage] = useState(null); // Success message from backend
```

### 2. Handling Success Response

```javascript
const handleAIGenerate = async () => {
  try {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setGeneratedExercises([]);
    setGeneratedHints([]);

    const response = await exercisesService.generateAI({
      topic_id: parseInt(topicId),
      question_type: aiConfig.question_type,
      programming_language: aiConfig.programming_language,
      language: topicLanguage || 'en',
      amount: 4,
      theoretical_question_type: aiConfig.question_type === 'theoretical' ? aiConfig.theoretical_question_type : undefined,
    });

    // Handle new response format
    if (response && response.success === true) {
      // Success response
      setSuccessMessage(response.message || 'Questions generated successfully');
      
      // Set exercises from data.questions
      if (response.data && Array.isArray(response.data.questions)) {
        setGeneratedExercises(response.data.questions);
      }
      
      // Set hints from data.hints
      if (response.data && Array.isArray(response.data.hints)) {
        setGeneratedHints(response.data.hints);
      }
    } else {
      // Failure response: { success: false } (no error details)
      setError('Failed to generate exercises. Please try again.');
    }
  } catch (error) {
    console.error('Error generating AI exercises:', error);
    // Handle network errors or API errors
    if (error?.response?.data?.success === false) {
      // Backend returned { success: false } - minimal error
      setError('Failed to generate exercises. Please try again.');
    } else {
      const errorMessage = error?.error?.message || error?.message || 'Failed to generate exercises';
      setError(errorMessage);
    }
  } finally {
    setLoading(false);
  }
};
```

### 3. Displaying Success Message

```jsx
{/* Success Message */}
{successMessage && (
  <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
    <div className="flex items-center">
      <i className="fas fa-check-circle text-green-600 dark:text-green-400 mr-2 text-lg"></i>
      <p className="text-green-800 dark:text-green-200 font-semibold">{successMessage}</p>
    </div>
  </div>
)}
```

### 4. Displaying Questions

```jsx
{/* Generated Questions */}
{generatedExercises.length > 0 && (
  <div className="mt-6">
    <h3 className="text-lg font-semibold mb-4">
      <i className="fas fa-question-circle mr-2"></i>
      Generated Questions ({generatedExercises.length})
    </h3>
    <div className="space-y-4">
      {generatedExercises.map((question, index) => {
        // Find hint for this question (by question_id or order_index)
        const hint = generatedHints.find(h => 
          h.question_id === question.exercise_id || 
          h.question_index === index
        );

        return (
          <div
            key={question.exercise_id || index}
            className="border border-gray-200 dark:border-[#334155] rounded-lg p-4 bg-gray-50 dark:bg-[#0f172a]"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold">Question {index + 1}</span>
              <div className="flex gap-2">
                {question.difficulty && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                    {question.difficulty}
                  </span>
                )}
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  AI Generated
                </span>
              </div>
            </div>
            <p className="text-sm mb-3 text-gray-700 dark:text-gray-300">{question.question_text}</p>
            
            {/* Display hint if available */}
            {hint && hint.hint && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <i className="fas fa-lightbulb mr-1"></i>
                  <strong>Hint:</strong> {hint.hint}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
```

### 5. Displaying Hints Section

```jsx
{/* Display all hints in a separate section if available */}
{generatedHints.length > 0 && (
  <div className="mt-6">
    <h4 className="text-md font-semibold mb-3 flex items-center">
      <i className="fas fa-lightbulb mr-2 text-yellow-500"></i>
      Hints ({generatedHints.length})
    </h4>
    <div className="space-y-2">
      {generatedHints.map((hint, index) => (
        <div
          key={hint.question_id || index}
          className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
        >
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Question {hint.question_id ? `#${hint.question_id}` : index + 1}:</strong> {hint.hint}
          </p>
        </div>
      ))}
    </div>
  </div>
)}
```

### 6. Handling Failure Response

```javascript
// Failure response: { success: false }
// Display a generic error message (no details from backend)
setError('Failed to generate exercises. Please try again.');
```

### 7. Cleanup on Close

```javascript
const handleClose = () => {
  setMode('ai');
  setGeneratedExercises([]);
  setGeneratedHints([]);
  setSuccessMessage(null);
  setManualExercises([]);
  // ... reset other state
  onClose();
};
```

## UI Requirements

### Success Display
- ✅ Show success message in a green banner
- ✅ Display all questions in a structured format
- ✅ Show difficulty badge for each question (if available)
- ✅ Display hints per question (inline)
- ✅ Display all hints in a separate section
- ✅ Show "Done - Questions Saved Successfully" button

### Failure Display
- ✅ Show generic error message: "Failed to generate exercises. Please try again."
- ❌ Do NOT show error details (backend doesn't provide them)
- ❌ Do NOT show partial data
- ❌ Do NOT show explanations

## Important Notes

1. **No Raw HTML**: Never display raw HTML code or internal metadata to the trainer
2. **Structured Format**: Present questions in a clear, structured format
3. **Hints Display**: Display hints per question in a readable and accessible way
4. **Error Handling**: Always show a generic error message for failures (no details)
5. **State Management**: Always reset state variables when closing the modal or starting a new generation
