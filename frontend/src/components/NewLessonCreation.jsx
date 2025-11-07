import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { topicsService } from '../services/topics.js';

export default function NewLessonCreation({
  isOpen,
  onClose,
  onNavigateToContent,
  courseId,
  courseTitle,
}) {
  const { setLessons, setError, theme } = useApp();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    learningOutcomes: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOutcome, setNewOutcome] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const lessonData = {
        topic_name: formData.title,
        description: formData.description,
        course_id: courseId || null,
        trainer_id: 'trainer123', // TODO: Get from auth context
      };

      const result = await topicsService.create(lessonData);
      setLessons(prev => [...prev, result]);

      // Reset form
      setFormData({
        title: '',
        description: '',
        learningOutcomes: [],
      });

      onClose();

      // Navigate to content creation
      if (onNavigateToContent) {
        onNavigateToContent(result);
      }
    } catch (error) {
      console.error('Error creating lesson:', error);
      setError(error.error?.message || 'Failed to create lesson');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = e => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addOutcome = () => {
    if (newOutcome.trim()) {
      setFormData({
        ...formData,
        learningOutcomes: [...formData.learningOutcomes, newOutcome.trim()],
      });
      setNewOutcome('');
    }
  };

  const removeOutcome = index => {
    setFormData({
      ...formData,
      learningOutcomes: formData.learningOutcomes.filter((_, i) => i !== index),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={`rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto ${
          theme === 'day-mode' ? 'bg-white' : 'bg-gray-800'
        }`}
      >
        <div
          className={`flex items-center justify-between p-6 border-b ${
            theme === 'day-mode' ? 'border-gray-200' : 'border-gray-700'
          }`}
        >
          <div className="flex-1">
            <h3
              className="text-lg font-semibold"
              style={{
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Create New Lesson
            </h3>
            {courseTitle && (
              <p
                className={`text-sm mt-1 ${
                  theme === 'day-mode' ? 'text-gray-600' : 'text-white'
                }`}
              >
                Course: {courseTitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'day-mode'
                ? 'text-gray-400 hover:text-gray-600'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div>
            <div className="mb-6">
              <label
                htmlFor="title"
                className="block text-sm font-medium mb-2"
                style={{
                  background: 'var(--gradient-primary)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Lesson Name *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                  theme === 'day-mode'
                    ? 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    : 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                }`}
                placeholder="Enter lesson name"
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-2"
                style={{
                  background: 'var(--gradient-primary)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Lesson Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-vertical ${
                  theme === 'day-mode'
                    ? 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    : 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                }`}
                placeholder="Describe what this lesson covers"
              />
            </div>

            <div className="mb-6">
              <label
                className="block text-sm font-medium mb-2"
                style={{
                  background: 'var(--gradient-primary)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Learning Outcomes
              </label>
              <p
                className={`text-sm mb-4 ${
                  theme === 'day-mode' ? 'text-gray-600' : 'text-white'
                }`}
              >
                Define what students will be able to do after completing this lesson.
              </p>

              <div className="mt-4">
                {formData.learningOutcomes.map((outcome, index) => (
                  <div key={index} className="flex items-center gap-3 mb-3">
                    <div
                      className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                        theme === 'day-mode'
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-gray-700 text-white'
                      }`}
                    >
                      <span>{outcome}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOutcome(index)}
                      className={`p-1 rounded transition-colors ${
                        theme === 'day-mode'
                          ? 'text-red-500 hover:text-red-700'
                          : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}

                <div className="flex gap-3 mt-3">
                  <input
                    type="text"
                    value={newOutcome}
                    onChange={e => setNewOutcome(e.target.value)}
                    onKeyPress={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOutcome();
                      }
                    }}
                    placeholder="Add a learning outcome..."
                    className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                      theme === 'day-mode'
                        ? 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                        : 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={addOutcome}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium ${
                      theme === 'day-mode'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg'
                    }`}
                  >
                    <i className="fas fa-plus"></i>
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                theme === 'day-mode'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30 border border-emerald-500/30'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                theme === 'day-mode'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? 'Creating...' : 'Create Lesson'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


