import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { topicsService } from '../../services/topics.js';
import { coursesService } from '../../services/courses.js';
import { useApp } from '../../context/AppContext.jsx';

const DEFAULT_TRAINER_ID = 'trainer-maya-levi';

export const TopicForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { theme } = useApp();
  const [formData, setFormData] = useState({
    topic_name: '',
    description: '',
    course_id: null,
    template_id: null,
    skills: [],
    language: 'en', // Default to English, but user must select
  });
  const [courses, setCourses] = useState([]);
  const [suggestedSkills, setSuggestedSkills] = useState([]);
  const [skillsSource, setSkillsSource] = useState('');
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isEditing] = useState(!!id);

  useEffect(() => {
    loadCourses();

    if (!isEditing) {
      const courseIdParam = searchParams.get('courseId');
      if (courseIdParam) {
        const parsedId = parseInt(courseIdParam, 10);
        if (!Number.isNaN(parsedId)) {
          setFormData(prev => ({ ...prev, course_id: parsedId }));
        }
      }
    }

    if (isEditing && id) {
      loadTopic();
    }
  }, [id, isEditing, searchParams]);

  const loadTopic = async () => {
    try {
      const topic = await topicsService.getById(id);
      setFormData({
        topic_name: topic.topic_name || '',
        description: topic.description || '',
        course_id: topic.course_id,
        template_id: topic.template_id || null,
        skills: topic.skills || [],
        language: topic.language || 'en',
      });
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to load topic' });
    }
  };

  const loadCourses = async () => {
    try {
      const result = await coursesService.list(
        { trainer_id: DEFAULT_TRAINER_ID, status: 'active' },
        { page: 1, limit: 100 }
      );
      setCourses(result.courses || []);
    } catch (error) {
      // swallow errors, dropdown will fallback
    }
  };

  useEffect(() => {
    const topicName = formData.topic_name?.trim();
    if (!topicName || topicName.length < 3) {
      setSuggestedSkills([]);
      setSkillsSource('');
      return;
    }

    let cancelled = false;
    const debounce = setTimeout(async () => {
      try {
        setSkillsLoading(true);
        const result = await topicsService.suggestSkills({
          topic_name: topicName,
          trainer_id: DEFAULT_TRAINER_ID,
        });
        if (cancelled) return;
        const skills = result.skills || [];
        setSuggestedSkills(skills);
        setSkillsSource(result.source || 'skills-engine');
        // Only set skills if Skills Engine is available (not 'unavailable')
        if (result.source !== 'unavailable' && skills.length > 0) {
          // Automatically set all suggested skills (read-only, from Skills Engine)
          setFormData(prev => ({ ...prev, skills: skills }));
        } else {
          // Skills Engine is not available - clear skills
          setFormData(prev => ({ ...prev, skills: [] }));
        }
        if (false) { // Disabled manual skill selection
          setFormData(prev => ({ ...prev, skills }));
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestedSkills([]);
          // Check if error indicates Skills Engine is unavailable
          if (error.response?.data?.source === 'unavailable' || error.message?.includes('unavailable')) {
            setSkillsSource('unavailable');
          } else {
            setSkillsSource('');
          }
        }
      } finally {
        if (!cancelled) {
          setSkillsLoading(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [formData.topic_name, isEditing]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Skills are now read-only from Skills Engine - no manual editing allowed

  const validate = () => {
    const newErrors = {};

    if (!formData.topic_name || formData.topic_name.length < 3) {
      newErrors.topic_name = 'Topic name must be at least 3 characters';
    }

    if (formData.topic_name && formData.topic_name.length > 255) {
      newErrors.topic_name = 'Topic name must not exceed 255 characters';
    }

    // Validate language - required for standalone topics
    if (!formData.course_id && !formData.language) {
      newErrors.language = 'Language is required for stand-alone lessons';
    }

    if (formData.language && formData.language.length > 10) {
      newErrors.language = 'Language code must not exceed 10 characters';
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
        trainer_id: DEFAULT_TRAINER_ID,
      };

      if (isEditing) {
        await topicsService.update(id, topicData);
      } else {
        await topicsService.create(topicData);
      }

      if (topicData.course_id) {
        navigate(`/courses/${topicData.course_id}`);
      } else {
        navigate('/topics');
      }
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
                {courses.map(course => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.course_name}
                  </option>
                ))}
              </select>
              <p
                className={`mt-1 text-xs ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Select a course or leave as stand-alone lesson
              </p>
            </div>

            {/* Language selection - required for standalone topics */}
            {!formData.course_id && (
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
                  Language * <span className="text-xs opacity-70">(Required for stand-alone lessons)</span>
                </label>
                <select
                  name="language"
                  value={formData.language || 'en'}
                  onChange={handleChange}
                  required={!formData.course_id}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                    errors.language
                      ? 'border-red-600'
                      : theme === 'day-mode'
                      ? 'border-gray-300'
                      : 'border-gray-600'
                  } ${
                    theme === 'day-mode'
                      ? 'border-gray-300 bg-white text-gray-900'
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                >
                  <option value="en">English</option>
                  <option value="he">Hebrew (עברית)</option>
                  <option value="ar">Arabic (العربية)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                  <option value="it">Italian (Italiano)</option>
                  <option value="ja">Japanese (日本語)</option>
                  <option value="zh">Chinese (中文)</option>
                  <option value="ko">Korean (한국어)</option>
                  <option value="pt">Portuguese (Português)</option>
                  <option value="fa">Persian/Farsi (فارسی)</option>
                  <option value="ur">Urdu (اردو)</option>
                  <option value="ru">Russian (Русский)</option>
                </select>
                {errors.language && (
                  <p className="mt-1 text-sm text-red-600">{errors.language}</p>
                )}
                <p
                  className={`mt-1 text-xs ${
                    theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  Select the language for this stand-alone lesson
                </p>
              </div>
            )}

            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                Skills (Auto-generated from Skills Engine)
              </label>
              {skillsLoading ? (
                <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Loading skill suggestions from Skills Engine...
                </p>
              ) : suggestedSkills.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {suggestedSkills.map(skill => (
                      <span
                        key={skill}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          theme === 'day-mode'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-emerald-600/30 text-emerald-200 border border-emerald-400'
                        }`}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <p className={`text-xs ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>
                    <i className="fas fa-info-circle mr-1"></i>
                    Skills source: {
                      skillsSource === 'mock' 
                        ? 'Mock Data (Skills Engine unavailable)' 
                        : skillsSource === 'unavailable'
                        ? 'Skills Engine is not configured or unavailable'
                        : 'Skills Engine'
                    }
                  </p>
                </>
              ) : skillsSource === 'unavailable' ? (
                <p className={`text-sm ${theme === 'day-mode' ? 'text-orange-600' : 'text-orange-400'}`}>
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Skills Engine is not configured or unavailable. Please configure SKILLS_ENGINE_URL to enable skill suggestions.
                </p>
              ) : (
                <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>
                  <i className="fas fa-lightbulb mr-2"></i>
                  Enter a lesson name above to automatically receive relevant skills from Skills Engine.
                </p>
              )}
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
                onClick={() =>
                  formData.course_id
                    ? navigate(`/courses/${formData.course_id}`)
                    : navigate('/topics')
                }
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
