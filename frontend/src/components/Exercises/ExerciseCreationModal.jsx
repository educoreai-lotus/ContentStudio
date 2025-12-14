import React, { useState, useEffect } from 'react';
import { exercisesService } from '../../services/exercises.js';
import { useApp } from '../../context/AppContext.jsx';

/**
 * Exercise Creation Modal
 * Handles both AI and Manual exercise generation
 * If exercises already exist, displays them instead of the creation form
 */
export default function ExerciseCreationModal({ isOpen, onClose, topicId, topicName, topicSkills, topicLanguage }) {
  const { theme, setError } = useApp();
  const [mode, setMode] = useState('ai'); // 'ai' or 'manual'
  const [loading, setLoading] = useState(false);
  const [generatedExercises, setGeneratedExercises] = useState([]);
  const [generatedHints, setGeneratedHints] = useState([]); // Hints from AI generation
  const [successMessage, setSuccessMessage] = useState(null); // Success message from backend
  const [manualExercises, setManualExercises] = useState([]);
  const [hasExistingExercises, setHasExistingExercises] = useState(false); // Flag to check if exercises already exist
  const [loadingExisting, setLoadingExisting] = useState(false); // Loading state for checking existing exercises
  // For manual code exercises: always 4 exercises together
  const [manualExercisesArray, setManualExercisesArray] = useState([
    { question_text: '' },
    { question_text: '' },
    { question_text: '' },
    { question_text: '' },
  ]);
  const [manualProgrammingLanguage, setManualProgrammingLanguage] = useState('');

  // AI Mode state
  const [aiConfig, setAiConfig] = useState({
    question_type: 'code',
    programming_language: '',
    amount: 4,
    theoretical_question_type: 'multiple_choice', // 'multiple_choice' or 'open_ended'
  });

  // Check if exercises already exist when modal opens
  useEffect(() => {
    if (isOpen && topicId) {
      checkExistingExercises();
    } else {
      // Reset when modal closes
      setHasExistingExercises(false);
      setGeneratedExercises([]);
      setGeneratedHints([]);
    }
  }, [isOpen, topicId]);

  const checkExistingExercises = async () => {
    try {
      setLoadingExisting(true);
      const response = await exercisesService.getByTopicId(topicId);
      
      // Check if we got exercises from the response
      // Response format: { success: true, exercises: [...], hints: [...], count: number }
      if (response && Array.isArray(response) && response.length > 0) {
        // Old format: array directly
        setGeneratedExercises(response);
        setHasExistingExercises(true);
        setSuccessMessage('Existing exercises loaded');
      } else if (response && response.exercises && Array.isArray(response.exercises) && response.exercises.length > 0) {
        // New format: { exercises: [...], hints: [...] }
        setGeneratedExercises(response.exercises);
        if (response.hints && Array.isArray(response.hints)) {
          setGeneratedHints(response.hints);
        }
        setHasExistingExercises(true);
        setSuccessMessage('Existing exercises loaded');
      } else {
        // No existing exercises
        setHasExistingExercises(false);
        setGeneratedExercises([]);
        setGeneratedHints([]);
      }
    } catch (error) {
      console.error('[ExerciseCreationModal] Error checking existing exercises:', error);
      // If error, assume no exercises exist and show creation form
      setHasExistingExercises(false);
    } finally {
      setLoadingExisting(false);
    }
  };

  if (!isOpen) return null;

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
        amount: aiConfig.question_type === 'theoretical' ? 4 : aiConfig.amount, // Always 4 for theoretical
        theoretical_question_type: aiConfig.question_type === 'theoretical' ? aiConfig.theoretical_question_type : undefined,
      });

      // Debug logging
      console.log('[ExerciseCreationModal] Response from backend:', {
        success: response?.success,
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response?.data) : [],
        questionsCount: response?.data?.questions?.length || 0,
        hintsCount: response?.data?.hints?.length || 0,
        message: response?.message,
        fullResponse: response,
      });

      // New response format: { success: true, message: "...", data: { questions: [...], hints: [...] } }
      if (response.success === true && response.data) {
        console.log('[ExerciseCreationModal] Setting generated exercises:', {
          questions: response.data.questions,
          hints: response.data.hints,
        });
        setGeneratedExercises(response.data.questions || []);
        setGeneratedHints(response.data.hints || []);
        setSuccessMessage(response.message || 'Questions generated successfully');
      } else if (response.success === false) {
        // Failure response - minimal, no error details
        console.error('[ExerciseCreationModal] Backend returned success: false');
        setError('Failed to generate exercises. Please try again.');
      } else {
        // Fallback for unexpected format
        console.error('[ExerciseCreationModal] Unexpected response format:', response);
        setError('Failed to generate exercises');
      }
    } catch (error) {
      console.error('Error generating AI exercises:', error);
      // Error format from backend: { success: false }
      // Or from apiClient interceptor: { error: { message: "..." } }
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

  const handleManualAdd = async () => {
    // Validate all 4 exercises have question text
    const emptyExercises = manualExercisesArray.filter(ex => !ex.question_text.trim());
    if (emptyExercises.length > 0) {
      setError('All 4 exercises must have question text');
      return;
    }

    if (!manualProgrammingLanguage.trim()) {
      setError('Programming language is required for code exercises');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Send all 4 exercises together
      // DevLab will generate hint and solution automatically
      const response = await exercisesService.createManual({
        topic_id: parseInt(topicId),
        topic_name: topicName,
        skills: topicSkills || [],
        question_type: 'code', // Manual is only for code
        programming_language: manualProgrammingLanguage,
        language: topicLanguage || 'en',
        exercises: manualExercisesArray.map(ex => ({
          question_text: ex.question_text.trim(),
        })),
      });

      // Debug logging
      console.log('[ExerciseCreationModal] Manual exercises response from backend:', {
        success: response?.success,
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response?.data) : [],
        questionsCount: response?.data?.questions?.length || 0,
        hasExercises: !!response?.exercises,
        exercisesCount: response?.exercises?.length || 0,
        message: response?.message,
        fullResponse: response,
      });

      // New response format: { success: true, message: "...", data: { questions: [...], count: 4 } }
      // Old format (backward compatibility): { success: true, exercises: [...] }
      if (response.success === true) {
        // Check new format first
        if (response.data && response.data.questions && Array.isArray(response.data.questions)) {
          console.log('[ExerciseCreationModal] Using new format - data.questions');
          setManualExercises(response.data.questions);
          setSuccessMessage(response.message || 'Exercises created and validated successfully');
        }
        // Fallback to old format
        else if (response.exercises && Array.isArray(response.exercises)) {
          console.log('[ExerciseCreationModal] Using old format - exercises');
          setManualExercises(response.exercises);
          setSuccessMessage('Exercises created and validated successfully');
        } else {
          console.error('[ExerciseCreationModal] Unexpected success response format:', response);
          setError('Exercises created but response format is unexpected');
          return;
        }
        
        // Reset form
        setManualExercisesArray([
          { question_text: '' },
          { question_text: '' },
          { question_text: '' },
          { question_text: '' },
        ]);
        setManualProgrammingLanguage('');
      } else if (response.validation_failed) {
        setError(response.error || response.message || 'Exercise validation failed');
      } else {
        setError('Failed to create exercises');
      }
    } catch (error) {
      console.error('Error creating manual exercises:', error);
      // Error format from backend: { success: false, error: { message: "..." } }
      // Or from apiClient interceptor: { error: { message: "..." } }
      // Or validation_failed: { success: false, error: "...", validation_failed: true }
      const errorMessage = error?.error?.message || error?.message || error?.error || 'Failed to create exercises';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = () => {
    // All exercises are already saved (AI exercises are saved immediately, manual exercises are saved one by one)
    onClose();
    // Optionally refresh the page or trigger a callback
    window.location.reload();
  };

  const handleClose = () => {
    setMode('ai');
    setGeneratedExercises([]);
    setGeneratedHints([]);
    setSuccessMessage(null);
    setManualExercises([]);
    setManualExercisesArray([
      { question_text: '' },
      { question_text: '' },
      { question_text: '' },
      { question_text: '' },
    ]);
    setManualProgrammingLanguage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-[#1e293b] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4 ${theme === 'day-mode' ? 'text-gray-900' : 'text-[#f8fafc]'}`}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#1e293b] border-b border-gray-200 dark:border-[#334155] p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Create DevLab Exercises</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading existing exercises */}
          {loadingExisting && (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-gray-500 dark:text-gray-400"></i>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading existing exercises...</p>
            </div>
          )}

          {/* Show existing exercises if they exist */}
          {!loadingExisting && hasExistingExercises && generatedExercises.length > 0 && (
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <i className="fas fa-check-circle mr-2"></i>
                  <strong>Exercises already exist for this topic.</strong> Viewing {generatedExercises.length} existing {generatedExercises.length === 1 ? 'exercise' : 'exercises'}.
                </p>
              </div>

              {/* Display existing exercises */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Existing Exercises ({generatedExercises.length})</h3>
                <div className="space-y-4">
                  {generatedExercises.map((exercise, index) => (
                    <div
                      key={exercise.exercise_id || index}
                      className="border border-gray-200 dark:border-[#334155] rounded-lg p-4 bg-gray-50 dark:bg-[#0f172a]"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold">Exercise {exercise.order_index || (index + 1)}</span>
                        <div className="flex gap-2">
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                            Existing
                          </span>
                          {exercise.type === 'mcq' && (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                              Multiple Choice
                            </span>
                          )}
                          {exercise.difficulty && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded capitalize">
                              {exercise.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm mb-2 font-medium">{exercise.question_text}</p>
                      
                      {/* Show options for theoretical multiple choice questions */}
                      {exercise.options && Array.isArray(exercise.options) && exercise.options.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Options:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {exercise.options.map((option, optIndex) => (
                              <li key={optIndex} className="text-xs text-gray-600 dark:text-gray-400">
                                {option}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Show explanation for theoretical questions */}
                      {exercise.explanation && (
                        <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">Explanation:</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">{exercise.explanation}</p>
                        </div>
                      )}
                      
                      {/* Show hint for code questions */}
                      {exercise.hint && !exercise.explanation && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <strong>Hint:</strong> {exercise.hint}
                        </p>
                      )}
                      
                      {/* Show hint from hints array if available */}
                      {!exercise.hint && !exercise.explanation && generatedHints.length > 0 && (
                        (() => {
                          const hintForExercise = generatedHints.find(h => h.question_id === exercise.exercise_id);
                          return hintForExercise ? (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              <strong>Hint:</strong> {hintForExercise.hint}
                            </p>
                          ) : null;
                        })()
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold"
              >
                <i className="fas fa-times mr-2"></i>
                Close
              </button>
            </div>
          )}

          {/* Show creation form if no existing exercises */}
          {!loadingExisting && !hasExistingExercises && (
            <>
          {/* Mode Selection */}
          <div className="mb-6">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setMode('ai')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  mode === 'ai'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 dark:bg-[#334155] text-gray-700 dark:text-[#f8fafc] hover:bg-gray-300 dark:hover:bg-[#475569]'
                }`}
              >
                <i className="fas fa-robot mr-2"></i>
                AI Generation
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                  mode === 'manual'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 dark:bg-[#334155] text-gray-700 dark:text-[#f8fafc] hover:bg-gray-300 dark:hover:bg-[#475569]'
                }`}
              >
                <i className="fas fa-edit mr-2"></i>
                Manual Creation
              </button>
            </div>
          </div>

          {/* AI Mode */}
          {mode === 'ai' && (
            <div className="space-y-6">
              {aiConfig.question_type === 'theoretical' && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <p className="text-sm text-purple-800 dark:text-purple-200 font-semibold">
                    <i className="fas fa-exclamation-triangle mr-2"></i>
                    <strong>Important:</strong> Theoretical questions can only be generated using AI. Manual creation is not available for theoretical questions.
                  </p>
                </div>
              )}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <i className="fas fa-info-circle mr-2"></i>
                  AI will generate 4 {aiConfig.question_type} exercises based on the topic: <strong>{topicName}</strong>
                  {aiConfig.question_type === 'theoretical' && (
                    <span> ({aiConfig.theoretical_question_type === 'multiple_choice' ? 'Multiple Choice' : 'Open Ended'})</span>
                  )}
                </p>
              </div>

              {/* AI Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Question Type</label>
                  <select
                    value={aiConfig.question_type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setAiConfig({ 
                        ...aiConfig, 
                        question_type: newType,
                        // Clear programming_language if switching to theoretical
                        programming_language: newType === 'theoretical' ? '' : aiConfig.programming_language,
                        // Always 4 for both code and theoretical
                        amount: 4,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                  >
                    <option value="code">Code</option>
                    <option value="theoretical">Theoretical (AI Only)</option>
                  </select>
                </div>

                {aiConfig.question_type === 'code' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Programming Language *</label>
                    <input
                      type="text"
                      value={aiConfig.programming_language}
                      onChange={(e) => setAiConfig({ ...aiConfig, programming_language: e.target.value })}
                      placeholder="e.g., javascript, python"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                      required
                    />
                  </div>
                )}

                {aiConfig.question_type === 'theoretical' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Question Format *</label>
                    <select
                      value={aiConfig.theoretical_question_type}
                      onChange={(e) => setAiConfig({ ...aiConfig, theoretical_question_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                    >
                      <option value="multiple_choice">Multiple Choice (Closed)</option>
                      <option value="open_ended">Open Ended</option>
                    </select>
                  </div>
                )}

                {aiConfig.question_type === 'code' && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <i className="fas fa-info-circle mr-2"></i>
                      Code questions will generate exactly 4 exercises. Programming language is required.
                    </p>
                  </div>
                )}
                {aiConfig.question_type === 'theoretical' && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <i className="fas fa-info-circle mr-2"></i>
                      Theoretical questions will generate exactly 4 exercises. Select the question format above.
                    </p>
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleAIGenerate}
                disabled={loading || (aiConfig.question_type === 'code' && !aiConfig.programming_language.trim())}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span><i className="fas fa-spinner fa-spin mr-2"></i>Generating...</span>
                ) : (
                  <span><i className="fas fa-magic mr-2"></i>Generate 4 {aiConfig.question_type === 'code' ? 'Code' : 'Theoretical'} Exercises</span>
                )}
              </button>

              {/* Generated Exercises */}
              {generatedExercises.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Generated Exercises ({generatedExercises.length})</h3>
                  <div className="space-y-4">
                    {generatedExercises.map((exercise, index) => (
                      <div
                        key={exercise.exercise_id || index}
                        className="border border-gray-200 dark:border-[#334155] rounded-lg p-4 bg-gray-50 dark:bg-[#0f172a]"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold">Exercise {index + 1}</span>
                          <div className="flex gap-2">
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                              AI Generated
                            </span>
                            {exercise.type === 'mcq' && (
                              <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                                Multiple Choice
                              </span>
                            )}
                            {exercise.difficulty && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded capitalize">
                                {exercise.difficulty}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm mb-2 font-medium">{exercise.question_text}</p>
                        
                        {/* Show options for theoretical multiple choice questions */}
                        {exercise.options && Array.isArray(exercise.options) && exercise.options.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Options:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {exercise.options.map((option, optIndex) => (
                                <li key={optIndex} className="text-xs text-gray-600 dark:text-gray-400">
                                  {option}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Show explanation for theoretical questions */}
                        {exercise.explanation && (
                          <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">Explanation:</p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">{exercise.explanation}</p>
                          </div>
                        )}
                        
                        {/* Show hint for code questions */}
                        {exercise.hint && !exercise.explanation && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <strong>Hint:</strong> {exercise.hint}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleSaveAll}
                    className="mt-4 w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                  >
                    <i className="fas fa-check mr-2"></i>
                    Done - Exercises Saved
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual Mode - Only for Code Questions */}
          {mode === 'manual' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <i className="fas fa-info-circle mr-2"></i>
                  <strong>Manual creation is only available for Code questions.</strong> You must create exactly 4 code exercises at once. All 4 will be validated together by Coordinator before saving.
                </p>
              </div>

              {/* Programming Language (Required for Code) */}
              <div>
                <label className="block text-sm font-medium mb-2">Programming Language *</label>
                <input
                  type="text"
                  value={manualProgrammingLanguage}
                  onChange={(e) => setManualProgrammingLanguage(e.target.value)}
                  placeholder="e.g., javascript, python, java"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                  required
                />
              </div>

              {/* 4 Exercises Form */}
              <div className="space-y-6">
                <h3 className="font-semibold text-lg">Create 4 Code Exercises</h3>
                {manualExercisesArray.map((exercise, index) => (
                  <div key={index} className="border border-gray-200 dark:border-[#334155] rounded-lg p-4 bg-gray-50 dark:bg-[#0f172a]">
                    <h4 className="font-semibold mb-4">Exercise {index + 1} *</h4>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Question Text *</label>
                      <textarea
                        value={exercise.question_text}
                        onChange={(e) => {
                          const newArray = [...manualExercisesArray];
                          newArray[index].question_text = e.target.value;
                          setManualExercisesArray(newArray);
                        }}
                        rows="4"
                        placeholder="Enter the exercise question..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <i className="fas fa-info-circle mr-1"></i>
                        DevLab will automatically generate hint and solution for this exercise.
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleManualAdd}
                disabled={loading || !manualProgrammingLanguage.trim() || manualExercisesArray.some(ex => !ex.question_text.trim())}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span><i className="fas fa-spinner fa-spin mr-2"></i>Validating 4 Exercises...</span>
                ) : (
                  <span><i className="fas fa-check mr-2"></i>Validate & Save All 4 Exercises</span>
                )}
              </button>

              {/* Success Message */}
              {successMessage && mode === 'manual' && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <i className="fas fa-check-circle mr-2"></i>
                    {successMessage}
                  </p>
                </div>
              )}

              {/* Created Exercises List */}
              {manualExercises.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Created Exercises ({manualExercises.length})</h3>
                  <div className="space-y-4">
                    {manualExercises.map((exercise, index) => (
                      <div
                        key={exercise.exercise_id || index}
                        className="border border-gray-200 dark:border-[#334155] rounded-lg p-4 bg-gray-50 dark:bg-[#0f172a]"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold">Exercise {index + 1}</span>
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                            Manual - Approved
                          </span>
                        </div>
                        <p className="text-sm mb-2">{exercise.question_text}</p>
                        {exercise.hint && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <strong>Hint:</strong> {exercise.hint}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleSaveAll}
                    className="mt-4 w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                  >
                    <i className="fas fa-check mr-2"></i>
                    Done - All Exercises Saved
                  </button>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

