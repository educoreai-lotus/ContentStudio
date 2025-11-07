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
  });
  const [courses, setCourses] = useState([]);
  const [suggestedSkills, setSuggestedSkills] = useState([]);
  const [skillsSource, setSkillsSource] = useState('');
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [customSkill, setCustomSkill] = useState('');
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
        if (!isEditing || formData.skills.length === 0) {
          setFormData(prev => ({ ...prev, skills }));
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestedSkills([]);
          setSkillsSource('');
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

  const handleSkillToggle = skill => {
    setFormData(prev => {
      const hasSkill = prev.skills.includes(skill);
      const updatedSkills = hasSkill
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill];
      return { ...prev, skills: updatedSkills };
    });
  };

  const handleAddCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (!trimmed) return;
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(trimmed) ? prev.skills : [...prev.skills, trimmed],
    }));
    setCustomSkill('');
  };

  const handleRemoveSkill = skill => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill),
    }));
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

            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                Suggested Skills
              </label>
              {skillsLoading ? (
                <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>
                  Loading skill suggestions...
                </p>
              ) : suggestedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {suggestedSkills.map(skill => {
                    const selected = formData.skills.includes(skill);
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => handleSkillToggle(skill)}
                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                          selected
                            ? theme === 'day-mode'
                              ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                              : 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                            : theme === 'day-mode'
                            ? 'bg-white border-gray-300 text-gray-600 hover:border-emerald-400'
                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-emerald-400'
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>
                  Enter a lesson name to receive skill suggestions automatically.
                </p>
              )}
              {skillsSource && suggestedSkills.length > 0 && (
                <p className={`text-xs ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>
                  Skills source: {skillsSource === 'mock' ? 'Mock (fallback)' : 'Skills Engine'}
                </p>
              )}
              {formData.skills.length > 0 && (
                <div className="mt-4">
                  <h4
                    className={`text-sm font-semibold mb-2 ${
                      theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    Selected Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.skills.map(skill => (
                      <span
                        key={skill}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                          theme === 'day-mode'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-emerald-600/20 text-emerald-200'
                        }`}
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className={`text-xs ${
                            theme === 'day-mode' ? 'text-emerald-700' : 'text-emerald-200'
                          }`}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={customSkill}
                  onChange={e => setCustomSkill(e.target.value)}
                  placeholder="Add custom skill"
                  className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                    theme === 'day-mode'
                      ? 'border-gray-300 bg-white text-gray-900'
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleAddCustomSkill}
                  className="px-3 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: 'var(--gradient-primary)',
                    color: 'white',
                    boxShadow: 'var(--shadow-glow)',
                  }}
                >
                  Add
                </button>
              </div>
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
