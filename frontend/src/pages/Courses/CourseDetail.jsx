import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { coursesService } from '../../services/courses.js';
import { topicsService } from '../../services/topics.js';
import { contentService } from '../../services/content.js';
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
  const [topicsContent, setTopicsContent] = useState({}); // { topicId: [content] }
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
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
      // If course not found (404), it might have been deleted
      // Navigate back to courses list
      if (err?.response?.status === 404 || err?.error?.code === 'COURSE_NOT_FOUND') {
        console.warn('[CourseDetail] Course not found (might be deleted), navigating to courses list:', courseId);
        // Navigate back to courses list if course was deleted
        navigate('/courses');
        return;
      } else {
        setError(err.error?.message || 'Failed to load course details');
      }
    } finally {
      setLoadingCourse(false);
    }
  }, [courseId, navigate]);

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
      const topicsList = result.topics || [];
      setTopics(topicsList);
      
      // Fetch content for all topics to check if all formats are ready
      if (topicsList.length > 0) {
        setLoadingContent(true);
        try {
          const contentPromises = topicsList.map(async (topic) => {
            try {
              const content = await contentService.listByTopic(topic.topic_id);
              return { topicId: topic.topic_id, content };
            } catch (err) {
              console.error(`Failed to fetch content for topic ${topic.topic_id}:`, err);
              return { topicId: topic.topic_id, content: [] };
            }
          });
          
          const contentResults = await Promise.all(contentPromises);
          const contentMap = {};
          contentResults.forEach(({ topicId, content }) => {
            contentMap[topicId] = content;
          });
          setTopicsContent(contentMap);
        } catch (err) {
          console.error('Failed to fetch topics content:', err);
        } finally {
          setLoadingContent(false);
        }
      }
    } catch (err) {
      setError(err.error?.message || 'Failed to load course lessons');
    } finally {
      setLoadingTopics(false);
    }
  }, [courseId]);

  const handleDeleteTopic = async (topicId, topicName) => {
    if (!window.confirm(`Are you sure you want to delete "${topicName}"?\n\nThe topic will be moved to the history and can be restored later.`)) {
      return;
    }

    try {
      // Update topic status to 'deleted' (soft delete)
      await topicsService.update(topicId, { status: 'deleted' });
      
      // Refresh topics list to remove the deleted topic
      await fetchTopics();
      
      // Dispatch event to notify other components (including SharedSidebar)
      const deleteEvent = new CustomEvent('contentRestored', {
        detail: {
          type: 'topics',
          id: topicId,
          courseId: courseId,
        }
      });
      window.dispatchEvent(deleteEvent);
      
      console.log(`[CourseDetail] Topic "${topicName}" deleted successfully`);
    } catch (err) {
      const errorMessage = err.error?.message || err.message || 'Failed to delete topic';
      setError(errorMessage);
      console.error('[CourseDetail] Error deleting topic:', err);
    }
  };

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
   * Check if all required formats are created for a topic
   * @param {Object} topic - Topic object
   * @param {Array} content - Content array for the topic
   * @returns {boolean} True if all formats are ready
   */
  const hasAllFormatsForTopic = (topic, content) => {
    if (!topic.template_format_order || topic.template_format_order.length === 0) {
      // If no template is applied, check if we have at least 5 formats (legacy check)
      return content && content.length >= 5;
    }

    // Map format names to content type IDs
    const formatToTypeId = {
      'text': 1,
      'text_audio': 1,
      'audio': 1,
      'code': 2,
      'presentation': 3,
      'mind_map': 5,
      'avatar_video': 6,
    };

    // Check if all formats in template_format_order have corresponding content
    const requiredFormats = topic.template_format_order || [];
    const readyFormats = requiredFormats.filter(format => {
      const typeId = formatToTypeId[format] || formatToTypeId[format.replace('_', '')];
      return content && content.some(c => c.content_type_id === typeId);
    });

    return readyFormats.length === requiredFormats.length;
  };

  /**
   * Check if course is ready to publish (all validations pass)
   * This is a client-side check - backend will do full validation
   * @returns {boolean} True if course appears ready
   */
  const isCourseReadyToPublish = () => {
    if (!topics || topics.length === 0) return false;
    
    // Check if all topics have templates
    const allHaveTemplates = topics.every(topic => topic.template_id);
    if (!allHaveTemplates) return false;
    
    // Check if all topics have all required formats
    const allHaveFormats = topics.every(topic => {
      const content = topicsContent[topic.topic_id] || [];
      return hasAllFormatsForTopic(topic, content);
    });
    if (!allHaveFormats) return false;
    
    // Check if all topics have DevLab exercises
    const allHaveExercises = topics.every(topic => {
      // Helper function to check if devlab_exercises has valid content
      const hasValidExercises = (exercises) => {
        if (!exercises) return false;
        
        // If it's a string, try to parse it
        if (typeof exercises === 'string') {
          try {
            const parsed = JSON.parse(exercises);
            return hasValidExercises(parsed);
          } catch {
            // If parsing fails, check if string is not empty
            return exercises.trim().length > 0;
          }
        }
        
        // If it's an array, check if it has items
        if (Array.isArray(exercises)) {
          return exercises.length > 0;
        }
        
        // If it's an object, check the structure: { html: "...", questions: [...], metadata: {...} }
        if (typeof exercises === 'object') {
          // Check if it has questions array with at least one question
          if (exercises.questions && Array.isArray(exercises.questions) && exercises.questions.length > 0) {
            return true;
          }
          // Check if it has html content
          if (exercises.html && typeof exercises.html === 'string' && exercises.html.trim().length > 0) {
            return true;
          }
          // Fallback: check if object has any meaningful keys (not just metadata)
          const keys = Object.keys(exercises);
          return keys.length > 0 && keys.some(key => key !== 'metadata');
        }
        
        return false;
      };
      
      return hasValidExercises(topic.devlab_exercises);
    });
    
    return allHaveExercises;
  };

  /**
   * Get missing requirements for publishing
   * @returns {Object} Missing requirements details
   */
  const getMissingPublishRequirements = () => {
    const missing = {
      templates: [],
      formats: [],
      exercises: [],
    };
    
    if (!topics || topics.length === 0) {
      return { templates: [], formats: [], exercises: [], message: 'No lessons found in this course.' };
    }
    
    topics.forEach(topic => {
      if (!topic.template_id) {
        missing.templates.push(topic.topic_name || `Lesson ${topic.topic_id}`);
      }
      
      // Check if all formats are ready
      const content = topicsContent[topic.topic_id] || [];
      if (!hasAllFormatsForTopic(topic, content)) {
        missing.formats.push(topic.topic_name || `Lesson ${topic.topic_id}`);
      }
      
      // Helper function to check if devlab_exercises has valid content
      const hasValidExercises = (exercises) => {
        if (!exercises) return false;
        
        // If it's a string, try to parse it
        if (typeof exercises === 'string') {
          try {
            const parsed = JSON.parse(exercises);
            return hasValidExercises(parsed);
          } catch {
            // If parsing fails, check if string is not empty
            return exercises.trim().length > 0;
          }
        }
        
        // If it's an array, check if it has items
        if (Array.isArray(exercises)) {
          return exercises.length > 0;
        }
        
        // If it's an object, check the structure: { html: "...", questions: [...], metadata: {...} }
        if (typeof exercises === 'object') {
          // Check if it has questions array with at least one question
          if (exercises.questions && Array.isArray(exercises.questions) && exercises.questions.length > 0) {
            return true;
          }
          // Check if it has html content
          if (exercises.html && typeof exercises.html === 'string' && exercises.html.trim().length > 0) {
            return true;
          }
          // Fallback: check if object has any meaningful keys (not just metadata)
          const keys = Object.keys(exercises);
          return keys.length > 0 && keys.some(key => key !== 'metadata');
        }
        
        return false;
      };
      
      const hasExercises = hasValidExercises(topic.devlab_exercises);
      
      if (!hasExercises) {
        missing.exercises.push(topic.topic_name || `Lesson ${topic.topic_id}`);
      }
    });
    
    return missing;
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

  const isLoading = loadingCourse || loadingTopics || loadingContent;

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 md:p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'
      }`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
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
                  title={(() => {
                    if (publishing) {
                      return 'Transferring the course to Course Builder, please wait...';
                    }
                    if (!isCourseReadyToPublish()) {
                      const missing = getMissingPublishRequirements();
                      const messages = [];
                      if (missing.templates.length > 0) {
                        messages.push(`Missing templates: ${missing.templates.join(', ')}`);
                      }
                      if (missing.formats.length > 0) {
                        messages.push(`Missing content formats: ${missing.formats.join(', ')}`);
                      }
                      if (missing.exercises.length > 0) {
                        messages.push(`Missing DevLab exercises: ${missing.exercises.join(', ')}`);
                      }
                      return messages.length > 0 
                        ? messages.join('\n')
                        : 'Complete all required content and exercises before transferring the course to Course Builder.';
                    }
                    return 'Transfer course to Course Builder for publishing';
                  })()}
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
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteTopic(topic.topic_id, topic.topic_name);
                        }}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                          theme === 'day-mode'
                            ? 'bg-red-100 hover:bg-red-200 text-red-700'
                            : 'bg-red-900/30 hover:bg-red-900/50 text-red-300'
                        }`}
                        title="Delete topic"
                      >
                        <i className="fas fa-trash mr-1"></i>
                        Delete
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



