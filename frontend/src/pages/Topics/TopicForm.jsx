import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { topicsService } from '../../services/topics.js';
import { useApp } from '../../context/AppContext.jsx';

export const TopicForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { theme } = useApp();
  const [formData, setFormData] = useState({
    topic_name: '',
    description: '',
    course_id: null,
    template_id: null,
    skills: [],
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditing] = useState(!!id);

  useEffect(() => {
    if (isEditing && id) {
      loadTopic();
    }
  }, [id, isEditing]);

  const loadTopic = async () => {
    try {
      const topic = await topicsService.getById(id);
      setFormData({
        topic_name: topic.topic_name || '',
        description: topic.description || '',
        course_id: topic.course_id,
        template_id: topic.template_id || null,
        skills: topic.skills || [],
      });
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to load topic' });
    }
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.topic_name || formData.topic_name.length < 3) {
      newErrors.topic_name = 'Topic name must be at least 3 characters';
    }

    if (formData.topic_name && formData.topic_name.length > 255) {
      newErrors.topic_name = 'Topic name must not exceed 255 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      const topicData = {
        ...formData,
        trainer_id: 'trainer123', // TODO: Get from auth context
      };

      if (isEditing) {
        await topicsService.update(id, topicData);
      } else {
        await topicsService.create(topicData);
      }

      navigate('/topics');
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to save topic' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
      }`}
    >
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {isEditing ? 'Edit Lesson' : 'Create New Lesson'}
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            {isEditing
              ? 'Update lesson information'
              : 'Create a new lesson or stand-alone topic'}
          </p>
        </div>

        <div
          className={`rounded-2xl shadow-lg p-6 ${
            theme === 'day-mode'
              ? 'bg-white border border-gray-200'
              : 'bg-gray-800 border border-gray-700'
          }`}
          style={{
            background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}
                style={{
                  background:
                    theme === 'day-mode'
                      ? undefined
                      : 'var(--gradient-primary)',
                  WebkitBackgroundClip:
                    theme === 'day-mode' ? undefined : 'text',
                  WebkitTextFillColor:
                    theme === 'day-mode' ? undefined : 'transparent',
                  backgroundClip: theme === 'day-mode' ? undefined : 'text',
                }}
              >
                Lesson Name *
              </label>
              <input
                type="text"
                name="topic_name"
                value={formData.topic_name}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                  errors.topic_name
                    ? 'border-red-600'
                    : theme === 'day-mode'
                    ? 'border-gray-300'
                    : 'border-gray-600'
                } ${
                  theme === 'day-mode'
                    ? 'bg-white text-gray-900 placeholder-gray-500'
                    : 'bg-gray-700 text-white placeholder-gray-400'
                }`}
                placeholder="Enter lesson name"
              />
              {errors.topic_name && (
                <p className="mt-1 text-sm text-red-600">{errors.topic_name}</p>
              )}
            </div>

            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}
                style={{
                  background:
                    theme === 'day-mode'
                      ? undefined
                      : 'var(--gradient-primary)',
                  WebkitBackgroundClip:
                    theme === 'day-mode' ? undefined : 'text',
                  WebkitTextFillColor:
                    theme === 'day-mode' ? undefined : 'transparent',
                  backgroundClip: theme === 'day-mode' ? undefined : 'text',
                }}
              >
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-vertical ${
                  errors.description
                    ? 'border-red-600'
                    : theme === 'day-mode'
                    ? 'border-gray-300'
                    : 'border-gray-600'
                } ${
                  theme === 'day-mode'
                    ? 'bg-white text-gray-900 placeholder-gray-500'
                    : 'bg-gray-700 text-white placeholder-gray-400'
                }`}
                placeholder="Enter lesson description (optional)"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                Course Association
              </label>
              <select
                name="course_id"
                value={formData.course_id || ''}
                onChange={e => {
                  const value = e.target.value === '' ? null : parseInt(e.target.value);
                  setFormData(prev => ({ ...prev, course_id: value }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                  theme === 'day-mode'
                    ? 'border-gray-300 bg-white text-gray-900'
                    : 'border-gray-600 bg-gray-700 text-white'
                }`}
              >
                <option value="">None (Stand-alone Lesson)</option>
                {/* TODO: Load courses from API */}
                <option value="1">Course 1</option>
                <option value="2">Course 2</option>
              </select>
              <p
                className={`mt-1 text-xs ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Select a course or leave as stand-alone lesson
              </p>
            </div>

            {errors.submit && (
              <div
                className={`mb-4 border px-4 py-3 rounded-lg ${
                  theme === 'day-mode'
                    ? 'bg-red-100 border-red-400 text-red-700'
                    : 'bg-red-900/20 border-red-500 text-red-300'
                }`}
              >
                {errors.submit}
              </div>
            )}

            <div
              className={`mb-4 p-4 border rounded-lg ${
                theme === 'day-mode'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-blue-900/20 border-blue-500/30 text-blue-300'
              }`}
            >
              <p className="text-sm">
                <strong>Note:</strong> This lesson requires 5 mandatory content
                formats: text, code, presentation, audio, and mind map. You can add
                these after creating the lesson.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/topics')}
                className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                  theme === 'day-mode'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  boxShadow: 'var(--shadow-glow)',
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = 'var(--shadow-hover)';
                  }
                }}
                onMouseLeave={e => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'var(--shadow-glow)';
                  }
                }}
              >
                {loading
                  ? 'Saving...'
                  : isEditing
                  ? 'Update Lesson'
                  : 'Create Lesson'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
