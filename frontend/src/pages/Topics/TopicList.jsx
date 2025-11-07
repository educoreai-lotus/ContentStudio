import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicsService } from '../../services/topics.js';
import { useApp } from '../../context/AppContext.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Input } from '../../components/common/Input.jsx';

export const TopicList = ({ courseId = null }) => {
  const navigate = useNavigate();
  const { theme } = useApp();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    trainer_id: 'trainer123', // TODO: Get from auth context
    status: 'all',
    course_id: courseId,
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 0,
  });

  useEffect(() => {
    loadTopics();
  }, [filters, pagination.page, courseId]);

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
      await topicsService.delete(topicId);
      loadTopics();
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

  const getFormatProgress = topic => {
    const completed = topic.total_content_formats || 0;
    const required = 5;
    const percentage = (completed / required) * 100;
    return { completed, required, percentage };
  };

  if (loading && topics.length === 0) {
    return (
      <div
        className={`min-h-screen p-8 ${
          theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
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
                    : 'bg-gray-800 border-gray-700'
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
      className={`min-h-screen p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
      }`}
    >
      <div className="max-w-7xl mx-auto">
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
              : 'bg-gray-800 border border-gray-700'
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
              <button
                onClick={() => handleStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filters.status === 'all'
                    ? theme === 'day-mode'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-emerald-500 text-white shadow-lg'
                    : theme === 'day-mode'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleStatusFilter('draft')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filters.status === 'draft'
                    ? theme === 'day-mode'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-emerald-500 text-white shadow-lg'
                    : theme === 'day-mode'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Draft
              </button>
              <button
                onClick={() => handleStatusFilter('published')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filters.status === 'published'
                    ? theme === 'day-mode'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-emerald-500 text-white shadow-lg'
                    : theme === 'day-mode'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Published
              </button>
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
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                : 'bg-gray-800 border border-gray-700'
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
              const formatProgress = getFormatProgress(topic);
              return (
                <div
                  key={topic.topic_id}
                  className={`rounded-2xl shadow-lg p-6 transition-all cursor-pointer ${
                    theme === 'day-mode'
                      ? 'bg-white border border-gray-200 hover:border-emerald-400'
                      : 'bg-gray-800 border border-gray-700 hover:border-emerald-500'
                  }`}
                  style={{
                    background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
                    boxShadow: 'var(--shadow-card)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  }}
                >
                  <div className="flex items-start justify-between">
                  <div className="flex-1">
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

                    {/* Format Requirements Progress */}
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
                          {formatProgress.completed}/{formatProgress.required} formats
                        </span>
                      </div>
                      <div
                        className={`w-full rounded-full h-2 ${
                          theme === 'day-mode' ? 'bg-gray-200' : 'bg-gray-700'
                        }`}
                      >
                        <div
                          className={`h-2 rounded-full ${
                            formatProgress.percentage === 100
                              ? 'bg-emerald-600'
                              : formatProgress.percentage >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${formatProgress.percentage}%` }}
                        ></div>
                      </div>
                      {formatProgress.completed < formatProgress.required && (
                        <p
                          className={`text-xs mt-1 ${
                            theme === 'day-mode' ? 'text-red-600' : 'text-red-400'
                          }`}
                        >
                          Missing: {topic.format_flags
                            ? Object.entries(topic.format_flags)
                                .filter(([_, has]) => !has)
                                .map(([format]) => format.replace('has_', ''))
                                .join(', ')
                            : 'text, code, presentation, audio, mind_map'}
                        </p>
                      )}
                    </div>

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
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        navigate(`/topics/${topic.topic_id}/content/new`)
                      }
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        theme === 'day-mode'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                      title="Add Manual Content"
                    >
                      <i className="fas fa-plus mr-1"></i>
                      Manual
                    </button>
                    <button
                      onClick={() =>
                        navigate(`/topics/${topic.topic_id}/content/ai-generate`)
                      }
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        theme === 'day-mode'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-purple-500 hover:bg-purple-600 text-white'
                      }`}
                      title="Generate with AI"
                    >
                      <i className="fas fa-magic mr-1"></i>
                      AI Generate
                    </button>
                    <button
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
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
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
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
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
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
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

