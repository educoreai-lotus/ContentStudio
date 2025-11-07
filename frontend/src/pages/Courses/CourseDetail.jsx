import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { coursesService } from '../../services/courses.js';
import { topicsService } from '../../services/topics.js';
import { useApp } from '../../context/AppContext.jsx';
import { Badge } from '../../components/common/Badge.jsx';

const DEFAULT_TRAINER_ID = 'trainer-maya-levi';

export const CourseDetail = () => {
  const { id } = useParams();
  const courseId = useMemo(() => parseInt(id, 10), [id]);
  const navigate = useNavigate();
  const { theme } = useApp();

  const [course, setCourse] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!courseId) {
      setError('Invalid course ID');
      return;
    }

    const fetchCourse = async () => {
      try {
        setLoadingCourse(true);
        const courseData = await coursesService.getById(courseId);
        setCourse(courseData);
      } catch (err) {
        setError(err.error?.message || 'Failed to load course details');
      } finally {
        setLoadingCourse(false);
      }
    };

    const fetchTopics = async () => {
      try {
        setLoadingTopics(true);
        const result = await topicsService.list(
          {
            trainer_id: DEFAULT_TRAINER_ID,
            course_id: courseId,
            status: 'all',
          },
          {
            page: 1,
            limit: 50,
          }
        );
        setTopics(result.topics || []);
      } catch (err) {
        setError(err.error?.message || 'Failed to load course lessons');
      } finally {
        setLoadingTopics(false);
      }
    };

    setError(null);
    fetchCourse();
    fetchTopics();
  }, [courseId]);

  const getStatusBadgeVariant = status => {
    switch (status) {
      case 'active':
        return 'success';
      case 'archived':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getFormatProgress = topic => {
    const completed = topic.total_content_formats || 0;
    const required = 5;
    const percentage = Math.min((completed / required) * 100, 100);
    return { completed, required, percentage };
  };

  const isLoading = loadingCourse || loadingTopics;

  return (
    <div
      className={`min-h-screen p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
      }`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/courses')}
              className={`mb-4 inline-flex items-center text-sm font-medium ${
                theme === 'day-mode'
                  ? 'text-emerald-600 hover:text-emerald-700'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Courses
            </button>
            <h1
              className="text-3xl md:text-4xl font-bold mb-2"
              style={{
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {course?.course_name || 'Course Details'}
            </h1>
            {course?.description && (
              <p
                className={`text-lg ${
                  theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {course.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {course && (
              <Badge variant={getStatusBadgeVariant(course.status)}>
                {course.status}
              </Badge>
            )}
            <button
              onClick={() => navigate(`/topics/new?courseId=${courseId}`)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: 'var(--gradient-primary)',
                color: 'white',
                boxShadow: 'var(--shadow-glow)',
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = 'var(--shadow-hover)';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'var(--shadow-glow)';
              }}
            >
              <i className="fas fa-plus mr-2"></i>
              Add Lesson / Topic
            </button>
          </div>
        </div>

        {error && (
          <div
            className={`border px-4 py-3 rounded-lg mb-6 ${
              theme === 'day-mode'
                ? 'bg-red-100 border-red-400 text-red-700'
                : 'bg-red-900/20 border-red-500 text-red-300'
            }`}
          >
            {error}
          </div>
        )}

        <div
          className={`rounded-2xl shadow-lg p-6 mb-8 ${
            theme === 'day-mode'
              ? 'bg-white border border-gray-200'
              : 'bg-gray-800 border border-gray-700'
          }`}
          style={{
            background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2
                className={`text-lg font-semibold mb-2 ${
                  theme === 'day-mode' ? 'text-gray-800' : 'text-gray-100'
                }`}
              >
                Course Overview
              </h2>
              <ul
                className={`space-y-2 text-sm ${
                  theme === 'day-mode' ? 'text-gray-600' : 'text-gray-300'
                }`}
              >
                <li>
                  <strong>Trainer:</strong>{' '}
                  {course?.trainer_id || DEFAULT_TRAINER_ID}
                </li>
                {course?.skills && course.skills.length > 0 && (
                  <li>
                    <strong>Skills:</strong> {course.skills.join(', ')}
                  </li>
                )}
                {course?.language && (
                  <li>
                    <strong>Language:</strong> {course.language}
                  </li>
                )}
                {course?.created_at && (
                  <li>
                    <strong>Created:</strong>{' '}
                    {new Date(course.created_at).toLocaleString()}
                  </li>
                )}
                {course?.updated_at && (
                  <li>
                    <strong>Updated:</strong>{' '}
                    {new Date(course.updated_at).toLocaleString()}
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h2
                className={`text-lg font-semibold mb-2 ${
                  theme === 'day-mode' ? 'text-gray-800' : 'text-gray-100'
                }`}
              >
                Quick Actions
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/courses/${courseId}/edit`)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    theme === 'day-mode'
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  <i className="fas fa-edit mr-2"></i>
                  Edit Course
                </button>
                <button
                  onClick={() => navigate('/topics/new')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    theme === 'day-mode'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  <i className="fas fa-book-open mr-2"></i>
                  Create Stand-alone Lesson
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2
            className={`text-2xl font-semibold ${
              theme === 'day-mode' ? 'text-gray-900' : 'text-white'
            }`}
          >
            Lessons in this Course
          </h2>
          <span
            className={`text-sm ${
              theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {topics.length} lesson{topics.length === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <div
            className={`rounded-2xl shadow-lg p-8 text-center ${
              theme === 'day-mode'
                ? 'bg-white border border-gray-200'
                : 'bg-gray-800 border border-gray-700'
            }`}
            style={{
              background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
              Loading course lessons...
            </p>
          </div>
        ) : topics.length === 0 ? (
          <div
            className={`rounded-2xl shadow-lg p-8 text-center ${
              theme === 'day-mode'
                ? 'bg-white border border-gray-200'
                : 'bg-gray-800 border border-gray-700'
            }`}
            style={{
              background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
              No lessons found for this course yet.
            </p>
            <button
              onClick={() => navigate(`/topics/new?courseId=${courseId}`)}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: 'var(--gradient-primary)',
                color: 'white',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <i className="fas fa-plus mr-2"></i>
              Create the first lesson
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {topics.map(topic => {
              const progress = getFormatProgress(topic);
              return (
                <div
                  key={topic.topic_id}
                  className={`rounded-2xl shadow-lg p-6 transition-all ${
                    theme === 'day-mode'
                      ? 'bg-white border border-gray-200 hover:border-emerald-400'
                      : 'bg-gray-800 border border-gray-700 hover:border-emerald-500'
                  }`}
                  style={{
                    background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
                    boxShadow: 'var(--shadow-card)',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/topics/${topic.topic_id}/content`)}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3
                          className={`text-xl font-semibold ${
                            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                          }`}
                        >
                          {topic.topic_name}
                        </h3>
                        <Badge variant={topic.status === 'published' ? 'success' : 'warning'}>
                          {topic.status}
                        </Badge>
                      </div>
                      {topic.description && (
                        <p
                          className={`text-sm mb-4 ${
                            theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                          }`}
                        >
                          {topic.description}
                        </p>
                      )}

                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm font-medium ${
                              theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                            }`}
                          >
                            Format Requirements
                          </span>
                          <span
                            className={`text-sm ${
                              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                            }`}
                          >
                            {progress.completed}/{progress.required} formats
                          </span>
                        </div>
                        <div
                          className={`w-full rounded-full h-2 ${
                            theme === 'day-mode' ? 'bg-gray-200' : 'bg-gray-700'
                          }`}
                        >
                          <div
                            className={`h-2 rounded-full ${
                              progress.percentage === 100
                                ? 'bg-emerald-600'
                                : progress.percentage >= 60
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                      </div>

                      <div
                        className={`flex flex-wrap gap-4 text-sm ${
                          theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                        }`}
                      >
                        {topic.skills && topic.skills.length > 0 && (
                          <span>Skills: {topic.skills.join(', ')}</span>
                        )}
                        {topic.usage_count > 0 && (
                          <span>Used: {topic.usage_count} times</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/topics/${topic.topic_id}/edit`);
                        }}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                          theme === 'day-mode'
                            ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/topics/${topic.topic_id}/content`);
                        }}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                          theme === 'day-mode'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        }`}
                      >
                        Manage Content
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseDetail;


