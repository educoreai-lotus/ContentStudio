import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesService } from '../../services/courses.js';
import { useApp } from '../../context/AppContext.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Input } from '../../components/common/Input.jsx';

const DEFAULT_TRAINER_ID = 'trainer-maya-levi';

export const CourseList = () => {
  const navigate = useNavigate();
  const { theme } = useApp();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    trainer_id: DEFAULT_TRAINER_ID,
    status: 'active', // Only show active courses by default (exclude deleted)
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 0,
  });

  useEffect(() => {
    loadCourses();
  }, [filters, pagination.page]);

  // Listen for restore events to refresh data
  useEffect(() => {
    const handleContentRestored = (event) => {
      const { type } = event.detail;
      // Refresh if a course was restored
      if (type === 'courses') {
        console.log('[CourseList] Course restored, refreshing list');
        loadCourses();
      }
    };

    window.addEventListener('contentRestored', handleContentRestored);
    return () => {
      window.removeEventListener('contentRestored', handleContentRestored);
    };
  }, [filters, pagination.page]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await coursesService.list(filters, {
        page: pagination.page,
        limit: pagination.limit,
      });
      setCourses(result.courses);
      setPagination(prev => ({
        ...prev,
        total: result.pagination.total,
        total_pages: result.pagination.total_pages,
      }));
    } catch (err) {
      setError(err.error?.message || 'Failed to load courses');
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
      loadCourses();
    }, 300);
  };

  const handleDelete = async courseId => {
    if (!window.confirm('Are you sure you want to delete this course?')) {
      return;
    }

    try {
      await coursesService.delete(courseId);
      loadCourses();
      
      // Dispatch event to notify SharedSidebar to refresh deleted courses list
      const deleteEvent = new CustomEvent('contentRestored', {
        detail: {
          type: 'courses',
          id: courseId,
        }
      });
      window.dispatchEvent(deleteEvent);
      
      console.log(`[CourseList] Course "${courseId}" deleted successfully`);
    } catch (err) {
      setError(err.error?.message || 'Failed to delete course');
    }
  };

  const getStatusBadgeVariant = status => {
    switch (status) {
      case 'active':
        return 'success';
      case 'archived':
        return 'warning';
      case 'deleted':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading && courses.length === 0) {
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
            Courses
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Manage your courses and lessons
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
                placeholder="Search courses..."
                value={filters.search}
                onChange={handleSearch}
              />
            </div>
            {/* Status filter removed - only active courses are shown */}
            <button
              onClick={() => navigate('/courses/new')}
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
              Create Course
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

        {/* Courses List */}
        {courses.length === 0 ? (
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
              No courses found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map(course => (
              <div
                key={course.course_id}
                className={`rounded-2xl shadow-lg p-6 transition-all cursor-pointer ${
                  theme === 'day-mode'
                    ? 'bg-white border border-gray-200 hover:border-emerald-400'
                    : 'bg-[#1e293b] border border-[#334155] hover:border-[#0d9488]'
                }`}
                style={{
                  background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
                  boxShadow: 'var(--shadow-card)',
                }}
                onClick={() => navigate(`/courses/${course.course_id}`)}
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
                        {course.course_name}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(course.status)}>
                        {course.status}
                      </Badge>
                    </div>
                    {course.description && (
                      <p
                        className={`text-sm mb-4 ${
                          theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                        }`}
                      >
                        {course.description}
                      </p>
                    )}
                    <div
                      className={`flex items-center gap-4 text-sm ${
                        theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      {course.skills && course.skills.length > 0 && (
                        <span>Skills: {course.skills.join(', ')}</span>
                      )}
                      <span>Language: {course.language}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        theme === 'day-mode'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                      onClick={() => navigate(`/courses/${course.course_id}`)}
                    >
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/courses/${course.course_id}/edit`)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        theme === 'day-mode'
                          ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          : 'bg-[#334155] hover:bg-[#475569] text-[#f8fafc]'
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(course.course_id)}
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
            ))}
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

