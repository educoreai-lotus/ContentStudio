import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { topicsService } from '../../services/topics.js';
import { useApp } from '../../context/AppContext.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Input } from '../../components/common/Input.jsx';

export const TopicList = ({ courseId = null }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useApp();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Read course_id from query params if provided, otherwise use prop
  const courseIdFromQuery = searchParams.get('course_id');
  const initialCourseId = courseIdFromQuery === 'null' ? null : (courseIdFromQuery ? parseInt(courseIdFromQuery) : courseId);
  
  const [filters, setFilters] = useState({
    trainer_id: 'trainer-maya-levi',
    status: 'active', // Only show active topics by default (exclude deleted)
    course_id: initialCourseId,
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 0,
  });

  useEffect(() => {
    // Update course_id from query params or prop
    const courseIdFromQuery = searchParams.get('course_id');
    const newCourseId = courseIdFromQuery === 'null' ? null : (courseIdFromQuery ? parseInt(courseIdFromQuery) : courseId);
    setFilters(prev => ({ ...prev, course_id: newCourseId }));
  }, [courseId, searchParams]);

  useEffect(() => {
    loadTopics();
  }, [filters, pagination.page]);

  // Listen for restore events to refresh data
  useEffect(() => {
    const handleContentRestored = (event) => {
      const { type, courseId: restoredCourseId } = event.detail;
      // Refresh if a topic was restored (and it matches our filters)
      if (type === 'topics') {
        // If we're showing topics for a specific course, only refresh if that course matches
        if (courseId && restoredCourseId === courseId) {
          console.log('[TopicList] Topic restored in this course, refreshing list');
          loadTopics();
        } else if (!courseId && !restoredCourseId) {
          // If we're showing standalone topics, refresh if restored topic is standalone
          console.log('[TopicList] Standalone topic restored, refreshing list');
          loadTopics();
        }
      }
    };

    window.addEventListener('contentRestored', handleContentRestored);
    return () => {
      window.removeEventListener('contentRestored', handleContentRestored);
    };
  }, [courseId, filters, pagination.page]);

  const loadTopics = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await topicsService.list(filters, {
        page: pagination.page,
        limit: pagination.limit,
      });
      setTopics(result.topics);
      setPagination(prev => ({
        ...prev,
        total: result.pagination.total,
        total_pages: result.pagination.total_pages,
      }));
    } catch (err) {
      setError(err.error?.message || 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = status => {
    setFilters(prev => ({ ...prev, status }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearch = e => {
    const searchValue = e.target.value;
    setFilters(prev => ({ ...prev, search: searchValue }));
    setPagination(prev => ({ ...prev, page: 1 }));

    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      loadTopics();
    }, 300);
  };

  const handleDelete = async topicId => {
    if (!window.confirm('Are you sure you want to delete this topic?')) {
      return;
    }

    try {
      // Find the topic before deletion to get its course_id
      const topic = topics.find(t => t.topic_id === topicId);
      const courseId = topic?.course_id || null; // null for standalone topics
      
      await topicsService.delete(topicId);
      loadTopics();
      
      // Dispatch event to notify SharedSidebar to refresh deleted topics list
      const deleteEvent = new CustomEvent('contentRestored', {
        detail: {
          type: 'topics',
          id: topicId,
          courseId: courseId, // null for standalone topics, course_id for course topics
        }
      });
      window.dispatchEvent(deleteEvent);
      
      console.log(`[TopicList] Topic "${topicId}" deleted successfully`, { courseId });
    } catch (err) {
      setError(err.error?.message || 'Failed to delete topic');
    }
  };

  const getStatusBadgeVariant = status => {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'default';
      case 'deleted':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading && topics.length === 0) {
    return (
      <div
        className={`min-h-screen p-4 sm:p-6 md:p-8 ${
          theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className={`border rounded-lg p-6 h-32 ${
                  theme === 'day-mode'
                    ? 'bg-white border-gray-200'
                    : 'bg-[#1e293b] border-[#334155]'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 md:p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Lessons / Topics
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Manage your lessons and topics
          </p>
        </div>

        {/* Filters */}
        <div
              className={`mb-6 rounded-2xl shadow-lg p-6 ${
                theme === 'day-mode'
                  ? 'bg-white border border-gray-200'
                  : 'bg-[#1e293b] border border-[#334155]'
              }`}
          style={{
            background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search topics..."
                value={filters.search}
                onChange={handleSearch}
              />
            </div>
            <div className="flex gap-2">
              {!courseId && (
                <button
                  onClick={() => setFilters(prev => ({ ...prev, course_id: null }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.course_id === null
                      ? theme === 'day-mode'
                        ? 'bg-emerald-600 text-white shadow-lg'
                        : 'bg-emerald-500 text-white shadow-lg'
                      : theme === 'day-mode'
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-[#334155] text-[#f8fafc] hover:bg-[#475569]'
                  }`}
                >
                  Stand-alone
                </button>
              )}
            </div>
            <button
              onClick={() => navigate('/topics/new')}
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
              Create Lesson
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className={`border px-4 py-3 rounded-lg mb-4 ${
              theme === 'day-mode'
                ? 'bg-red-100 border-red-400 text-red-700'
                : 'bg-red-900/20 border-red-500 text-red-300'
            }`}
          >
            {error}
          </div>
        )}

        {/* Topics List */}
        {topics.length === 0 ? (
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
              No topics found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {topics.map(topic => {
              return (
                <div
                  key={topic.topic_id}
                  className={`rounded-2xl shadow-lg p-6 transition-all cursor-pointer ${
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
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3
                        className={`text-xl font-semibold ${
                          theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                        }`}
                      >
                        {topic.topic_name}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(topic.status)}>
                        {topic.status}
                      </Badge>
                      {topic.is_standalone && (
                        <Badge variant="info">Stand-alone</Badge>
                      )}
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
                      className={`flex items-center gap-4 text-sm ${
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
                  <div className="flex flex-wrap gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/topics/${topic.topic_id}/content`)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        theme === 'day-mode'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/topics/${topic.topic_id}/edit`)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        theme === 'day-mode'
                          ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          : 'bg-[#334155] hover:bg-[#475569] text-[#f8fafc]'
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(topic.topic_id)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        theme === 'day-mode'
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      Delete
                    </button>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pagination.page === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'day-mode'
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-[#334155] hover:bg-[#475569] text-[#f8fafc]'
              }`}
            >
              Previous
            </button>
            <span
              className={`flex items-center px-4 text-sm ${
                theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
              }`}
            >
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button
              disabled={pagination.page === pagination.total_pages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pagination.page === pagination.total_pages
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'day-mode'
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-[#334155] hover:bg-[#475569] text-[#f8fafc]'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

