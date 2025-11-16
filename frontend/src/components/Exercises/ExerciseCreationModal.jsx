import React, { useState } from 'react';
import { exercisesService } from '../../services/exercises.js';
import { useApp } from '../../context/AppContext.jsx';

/**
 * Exercise Creation Modal
 * Handles both AI and Manual exercise generation
 */
export default function ExerciseCreationModal({ isOpen, onClose, topicId, topicName, topicSkills, topicLanguage }) {
  const { theme, setError } = useApp();
  const [mode, setMode] = useState('ai'); // 'ai' or 'manual'
  const [loading, setLoading] = useState(false);
  const [generatedExercises, setGeneratedExercises] = useState([]);
  const [manualExercises, setManualExercises] = useState([]);
  const [currentManualExercise, setCurrentManualExercise] = useState({
    question_text: '',
    question_type: 'code',
    programming_language: '',
    hint: '',
    solution: '',
  });

  // AI Mode state
  const [aiConfig, setAiConfig] = useState({
    question_type: 'code',
    programming_language: '',
    amount: 4,
  });

  if (!isOpen) return null;

  const handleAIGenerate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await exercisesService.generateAI({
        topic_id: parseInt(topicId),
        question_type: aiConfig.question_type,
        programming_language: aiConfig.programming_language,
        language: topicLanguage || 'en',
        amount: aiConfig.amount,
      });

      if (response.success && response.exercises) {
        setGeneratedExercises(response.exercises);
      } else {
        setError('Failed to generate exercises');
      }
    } catch (error) {
      console.error('Error generating AI exercises:', error);
      setError(error.response?.data?.error || error.message || 'Failed to generate exercises');
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!currentManualExercise.question_text.trim()) {
      setError('Question text is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await exercisesService.createManual({
        topic_id: parseInt(topicId),
        question_text: currentManualExercise.question_text,
        question_type: currentManualExercise.question_type,
        programming_language: currentManualExercise.programming_language,
        language: topicLanguage || 'en',
        hint: currentManualExercise.hint || null,
        solution: currentManualExercise.solution || null,
      });

      if (response.success && response.exercise) {
        setManualExercises(prev => [...prev, response.exercise]);
        setCurrentManualExercise({
          question_text: '',
          question_type: 'code',
          programming_language: '',
          hint: '',
          solution: '',
        });
      } else if (response.validation_failed) {
        setError(response.error || 'Exercise validation failed');
      } else {
        setError('Failed to create exercise');
      }
    } catch (error) {
      console.error('Error creating manual exercise:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create exercise';
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
    setManualExercises([]);
    setCurrentManualExercise({
      question_text: '',
      question_type: 'code',
      programming_language: '',
      hint: '',
      solution: '',
    });
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
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <i className="fas fa-info-circle mr-2"></i>
                  AI will generate {aiConfig.amount} exercises based on the topic: <strong>{topicName}</strong>
                </p>
              </div>

              {/* AI Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Question Type</label>
                  <select
                    value={aiConfig.question_type}
                    onChange={(e) => setAiConfig({ ...aiConfig, question_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                  >
                    <option value="code">Code</option>
                    <option value="theoretical">Theoretical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Programming Language</label>
                  <input
                    type="text"
                    value={aiConfig.programming_language}
                    onChange={(e) => setAiConfig({ ...aiConfig, programming_language: e.target.value })}
                    placeholder="e.g., javascript, python"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Amount</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={aiConfig.amount}
                    onChange={(e) => setAiConfig({ ...aiConfig, amount: parseInt(e.target.value) || 4 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                  />
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleAIGenerate}
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span><i className="fas fa-spinner fa-spin mr-2"></i>Generating...</span>
                ) : (
                  <span><i className="fas fa-magic mr-2"></i>Generate Exercises</span>
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
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                            AI Generated
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
                    Done - Exercises Saved
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual Mode */}
          {mode === 'manual' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <i className="fas fa-info-circle mr-2"></i>
                  Create exercises manually. Each exercise will be validated by Dabla before saving.
                </p>
              </div>

              {/* Manual Exercise Form */}
              <div className="space-y-4 border border-gray-200 dark:border-[#334155] rounded-lg p-4 bg-gray-50 dark:bg-[#0f172a]">
                <h3 className="font-semibold">New Exercise</h3>

                <div>
                  <label className="block text-sm font-medium mb-2">Question Text *</label>
                  <textarea
                    value={currentManualExercise.question_text}
                    onChange={(e) => setCurrentManualExercise({ ...currentManualExercise, question_text: e.target.value })}
                    rows="4"
                    placeholder="Enter the exercise question..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Question Type</label>
                    <select
                      value={currentManualExercise.question_type}
                      onChange={(e) => setCurrentManualExercise({ ...currentManualExercise, question_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                    >
                      <option value="code">Code</option>
                      <option value="theoretical">Theoretical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Programming Language</label>
                    <input
                      type="text"
                      value={currentManualExercise.programming_language}
                      onChange={(e) => setCurrentManualExercise({ ...currentManualExercise, programming_language: e.target.value })}
                      placeholder="e.g., javascript, python"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Hint (Optional)</label>
                  <textarea
                    value={currentManualExercise.hint}
                    onChange={(e) => setCurrentManualExercise({ ...currentManualExercise, hint: e.target.value })}
                    rows="2"
                    placeholder="Enter a hint for the exercise..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Solution (Optional)</label>
                  <textarea
                    value={currentManualExercise.solution}
                    onChange={(e) => setCurrentManualExercise({ ...currentManualExercise, solution: e.target.value })}
                    rows="3"
                    placeholder="Enter the solution..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1e293b]"
                  />
                </div>

                <button
                  onClick={handleManualAdd}
                  disabled={loading || !currentManualExercise.question_text.trim()}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span><i className="fas fa-spinner fa-spin mr-2"></i>Validating...</span>
                  ) : (
                    <span><i className="fas fa-check mr-2"></i>Validate & Add Exercise</span>
                  )}
                </button>
              </div>

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
        </div>
      </div>
    </div>
  );
}

