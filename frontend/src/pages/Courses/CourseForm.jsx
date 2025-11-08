import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { coursesService } from '../../services/courses.js';
import { useApp } from '../../context/AppContext.jsx';

export const CourseForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { theme } = useApp();
  const [formData, setFormData] = useState({
    course_name: '',
    description: '',
    skills: [],
    language: 'en',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditing] = useState(!!id);

  useEffect(() => {
    if (isEditing && id) {
      loadCourse();
    }
  }, [id, isEditing]);

  const loadCourse = async () => {
    try {
      const course = await coursesService.getById(id);
      setFormData({
        course_name: course.course_name || '',
        description: course.description || '',
        skills: course.skills || [],
        language: course.language || 'en',
      });
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to load course' });
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

    if (!formData.course_name || formData.course_name.length < 3) {
      newErrors.course_name = 'Course name must be at least 3 characters';
    }

    if (formData.course_name && formData.course_name.length > 255) {
      newErrors.course_name = 'Course name must not exceed 255 characters';
    }

    if (formData.description && formData.description.length > 2000) {
      newErrors.description = 'Description must not exceed 2000 characters';
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
      const courseData = {
        ...formData,
        // trainer_id will be set by backend from req.auth
      };

      if (isEditing) {
        await coursesService.update(id, courseData);
      } else {
        await coursesService.create(courseData);
      }

      navigate('/courses');
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to save course' });
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
            {isEditing ? 'Edit Course' : 'Create New Course'}
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            {isEditing
              ? 'Update course information'
              : 'Create a new course for your lessons'}
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
                Course Name *
              </label>
              <input
                type="text"
                name="course_name"
                value={formData.course_name}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                  errors.course_name
                    ? 'border-red-600'
                    : theme === 'day-mode'
                    ? 'border-gray-300'
                    : 'border-gray-600'
                } ${
                  theme === 'day-mode'
                    ? 'bg-white text-gray-900 placeholder-gray-500'
                    : 'bg-gray-700 text-white placeholder-gray-400'
                }`}
                placeholder="Enter course name"
              />
              {errors.course_name && (
                <p className="mt-1 text-sm text-red-600">{errors.course_name}</p>
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
                placeholder="Enter course description (optional)"
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
                Language
              </label>
              <select
                name="language"
                value={formData.language}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                  theme === 'day-mode'
                    ? 'border-gray-300 bg-white text-gray-900'
                    : 'border-gray-600 bg-gray-700 text-white'
                }`}
              >
                <option value="en">English</option>
                <option value="he">Hebrew</option>
                <option value="ar">Arabic</option>
              </select>
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

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/courses')}
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
                  ? 'Update Course'
                  : 'Create Course'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
