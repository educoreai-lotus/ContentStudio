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
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  const fetchCourse = React.useCallback(async () => {
    try {
      setLoadingCourse(true);
      const courseData = await coursesService.getById(courseId);
      setCourse(courseData);
    } catch (err) {
      setError(err.error?.message || 'Failed to load course details');
    } finally {
      setLoadingCourse(false);
    }
  }, [courseId]);

  const fetchTopics = React.useCallback(async () => {
    try {
      setLoadingTopics(true);
      const result = await topicsService.list(
        {
          trainer_id: DEFAULT_TRAINER_ID,
          course_id: courseId,
          status: 'active', // Only show active topics (exclude deleted)
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
  }, [courseId]);

  useEffect(() => {
    if (!courseId) {
      setError('Invalid course ID');
      return;
    }

    setError(null);
    fetchCourse();
    fetchTopics();
  }, [courseId, fetchCourse, fetchTopics]);

  // Listen for restore events to refresh data
  useEffect(() => {
    const handleContentRestored = (event) => {
      const { type, id, courseId: restoredCourseId } = event.detail;
      // Refresh if a course was restored (and we're viewing that course)
      if (type === 'courses' && id === courseId) {
        console.log('[CourseDetail] Course restored, refreshing data');
        fetchCourse();
        fetchTopics();
      } else if (type === 'topics' && restoredCourseId === courseId) {
        // Refresh topics if a topic was restored in this course
        console.log('[CourseDetail] Topic restored in this course, refreshing topics');
        fetchTopics();
      }
    };

    window.addEventListener('contentRestored', handleContentRestored);
    return () => {
      window.removeEventListener('contentRestored', handleContentRestored);
    };
  }, [courseId, fetchCourse, fetchTopics]);

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

  /**
   * Check if course is ready to publish (all validations pass)
   * This is a client-side check - backend will do full validation
   * @returns {boolean} True if course appears ready
   */
  const isCourseReadyToPublish = () => {
    if (!topics || topics.length === 0) return false;
    
    // Check if all topics have templates
    return topics.every(topic => topic.template_id);
  };

  /**
   * Handle publish course (transfer to Course Builder)
   * ⚠️ IMPORTANT: We do NOT publish the course here.
   * We ONLY transfer it to Course Builder, which handles final publishing and visibility.
   */
  const handlePublishCourse = async () => {
    setPublishing(true);
    setPublishError(null);
    setPublishSuccess(false);

    try {
      const result = await coursesService.publish(courseId);
      
      if (result.success) {
        setPublishSuccess(true);
        setPublishError(null);
        // Clear success message after 5 seconds
        setTimeout(() => setPublishSuccess(false), 5000);
      } else {
        // Handle case where backend returns success: false
        const errorMessage = result.error?.message || 
                            result.message ||
                            'Failed to transfer course';
        setPublishError(errorMessage);
      }
    } catch (err) {
      // Handle different error types
      let errorMessage = 'Transfer failed — Course Builder could not receive the data. Please try again later.';
      
      if (err.response) {
        // Backend returned an error response
        const errorData = err.response.data;
        
        if (errorData?.error?.message) {
          // Validation errors or specific error messages
          errorMessage = errorData.error.message;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (err.response.status === 400) {
          errorMessage = 'Validation failed. Please check all lessons have templates and required content.';
        } else if (err.response.status === 500) {
          errorMessage = 'Transfer failed — Course Builder could not receive the data. Please try again later.';
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setPublishError(errorMessage);
    } finally {
      setPublishing(false);
    }
  };

  const isLoading = loadingCourse || loadingTopics;

  return (
    <div
      className={`min-h-screen p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'
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

        {publishError && (
          <div
            className={`border px-4 py-3 rounded-lg mb-6 whitespace-pre-line ${
              theme === 'day-mode'
                ? 'bg-red-100 border-red-400 text-red-700'
                : 'bg-red-900/20 border-red-500 text-red-300'
            }`}
          >
            {publishError}
          </div>
        )}

        {publishSuccess && (
          <div
            className={`border px-4 py-3 rounded-lg mb-6 ${
              theme === 'day-mode'
                ? 'bg-green-100 border-green-400 text-green-700'
                : 'bg-green-900/20 border-green-500 text-green-300'
            }`}
          >
            The course has been successfully transferred to Course Builder for publishing.
          </div>
        )}

        <div
          className={`rounded-2xl shadow-lg p-6 mb-8 ${
            theme === 'day-mode'
              ? 'bg-white border border-gray-200'
              : 'bg-[#1e293b] border border-[#334155]'
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
                      : 'bg-[#334155] hover:bg-[#475569] text-[#f8fafc]'
                  }`}
                >
                  <i className="fas fa-edit mr-2"></i>
                  Edit Course
                </button>
                <button
                  onClick={handlePublishCourse}
                  disabled={publishing || !isCourseReadyToPublish()}
                  title={
                    !isCourseReadyToPublish()
                      ? 'Complete all required content and exercises before transferring the course to Course Builder.'
                      : publishing
                      ? 'Transferring the course to Course Builder, please wait...'
                      : 'Transfer course to Course Builder for publishing'
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
                    publishing || !isCourseReadyToPublish()
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  } ${
                    theme === 'day-mode'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}
                >
                  {publishing ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Transferring...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane mr-2"></i>
                      Publish Course
                    </>
                  )}
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
                : 'bg-[#1e293b] border border-[#334155]'
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
                : 'bg-[#1e293b] border border-[#334155]'
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
              return (
                <div
                  key={topic.topic_id}
                  className={`rounded-2xl shadow-lg p-6 transition-all ${
                    theme === 'day-mode'
                      ? 'bg-white border border-gray-200 hover:border-emerald-400'
                      : 'bg-[#1e293b] border border-[#334155] hover:border-[#0d9488]'
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
                            : 'bg-[#334155] hover:bg-[#475569] text-[#f8fafc]'
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


