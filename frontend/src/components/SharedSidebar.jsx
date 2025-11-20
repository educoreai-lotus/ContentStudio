import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { coursesService } from '../services/courses.js';
import { topicsService } from '../services/topics.js';

const DEFAULT_TRAINER_ID = 'trainer-maya-levi';

/**
 * Global Sidebar Component
 * Displays deleted items (courses/topics) based on current page context
 * - Courses page → shows deleted courses
 * - Course detail page → shows deleted lessons of that course
 * - Standalone topics page → shows deleted topics
 */
export function SharedSidebar({ onRestore }) {
  const { theme, sidebarState, setSidebarState } = useApp();
  const location = useLocation();
  const params = useParams();
  const [deletedItems, setDeletedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { isOpen, isCollapsed } = sidebarState;
  
  const setIsOpen = (value) => {
    setSidebarState(prev => ({ ...prev, isOpen: value }));
  };
  
  const setIsCollapsed = (value) => {
    setSidebarState(prev => ({ ...prev, isCollapsed: value }));
  };

  // Determine context based on current route
  const context = React.useMemo(() => {
    const path = location.pathname;
    
    if (path.startsWith('/courses/') && params.id && !path.includes('/edit')) {
      // Inside a course (viewing lessons)
      return {
        type: 'course-lessons',
        courseId: parseInt(params.id),
        title: 'Deleted Lessons',
        icon: 'fa-book',
      };
    } else if (path === '/courses' || path.startsWith('/courses') && !params.id) {
      // Courses list page
      return {
        type: 'courses',
        title: 'Deleted Courses',
        icon: 'fa-graduation-cap',
      };
    } else if (path === '/topics' || path === '/lessons') {
      // Standalone topics page
      return {
        type: 'topics',
        title: 'Deleted Topics',
        icon: 'fa-list',
      };
    }
    
    return null;
  }, [location.pathname, params.id]);

  // Load deleted items based on context
  useEffect(() => {
    if (!context || !isOpen) {
      setDeletedItems([]);
      return;
    }

    const loadDeletedItems = async () => {
      setLoading(true);
      setError(null);

      try {
        let result;
        
        if (context.type === 'courses') {
          // Load deleted courses
          result = await coursesService.list(
            {
              trainer_id: DEFAULT_TRAINER_ID,
              status: 'deleted',
            },
            { page: 1, limit: 50 }
          );
          setDeletedItems(result.courses || []);
        } else if (context.type === 'course-lessons') {
          // Load deleted lessons of specific course
          result = await topicsService.list(
            {
              trainer_id: DEFAULT_TRAINER_ID,
              course_id: context.courseId,
              status: 'deleted',
            },
            { page: 1, limit: 50 }
          );
          setDeletedItems(result.topics || []);
        } else if (context.type === 'topics') {
          // Load deleted standalone topics
          result = await topicsService.list(
            {
              trainer_id: DEFAULT_TRAINER_ID,
              course_id: null,
              status: 'deleted',
            },
            { page: 1, limit: 50 }
          );
          setDeletedItems(result.topics || []);
        }
      } catch (err) {
        setError(err.error?.message || 'Failed to load deleted items');
        setDeletedItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadDeletedItems();
  }, [context, isOpen]);

  const handleRestore = async (item) => {
    if (!window.confirm(`Restore "${item.course_name || item.topic_name}"?`)) {
      return;
    }

    try {
      if (context.type === 'courses') {
        // Restore course by updating status to 'active'
        await coursesService.update(item.course_id, { status: 'active' });
      } else {
        // Restore topic/lesson by updating status to 'active'
        await topicsService.update(item.topic_id, { status: 'active' });
      }

      // Reload deleted items
      const loadDeletedItems = async () => {
        try {
          let result;
          
          if (context.type === 'courses') {
            result = await coursesService.list(
              {
                trainer_id: DEFAULT_TRAINER_ID,
                status: 'deleted',
              },
              { page: 1, limit: 50 }
            );
            setDeletedItems(result.courses || []);
          } else if (context.type === 'course-lessons') {
            result = await topicsService.list(
              {
                trainer_id: DEFAULT_TRAINER_ID,
                course_id: context.courseId,
                status: 'deleted',
              },
              { page: 1, limit: 50 }
            );
            setDeletedItems(result.topics || []);
          } else if (context.type === 'topics') {
            result = await topicsService.list(
              {
                trainer_id: DEFAULT_TRAINER_ID,
                course_id: null,
                status: 'deleted',
              },
              { page: 1, limit: 50 }
            );
            setDeletedItems(result.topics || []);
          }
        } catch (err) {
          setError(err.error?.message || 'Failed to reload deleted items');
        }
      };

      await loadDeletedItems();

      // Notify parent component if callback provided
      if (onRestore) {
        onRestore(item);
      }
    } catch (err) {
      alert(err.error?.message || 'Failed to restore item');
    }
  };

  // Don't render if context is not recognized
  if (!context) {
    return null;
  }

  return (
    <div
      className={`fixed right-0 top-20 bottom-0 transform transition-all duration-300 z-40 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${
        isCollapsed ? 'w-16' : 'w-96'
      } ${
        theme === 'day-mode'
          ? 'bg-white border-l border-gray-200 shadow-2xl'
          : 'bg-[#1e293b] border-l border-[#334155] shadow-2xl'
      }`}
    >
      {/* Toggle Button (Open/Close) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-10 h-20 rounded-l-lg flex items-center justify-center transition-all ${
          theme === 'day-mode'
            ? 'bg-white border-l border-t border-b border-gray-200 hover:bg-gray-50'
            : 'bg-[#1e293b] border-l border-t border-b border-[#334155] hover:bg-[#334155]'
        }`}
        title={isOpen ? 'Close sidebar' : 'Open deleted items'}
      >
        <i className={`fas ${isOpen ? 'fa-chevron-right' : 'fa-chevron-left'} text-lg transition-transform duration-300`}></i>
        {!isOpen && deletedItems.length > 0 && (
          <span
            className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              theme === 'day-mode' ? 'bg-red-500 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {deletedItems.length}
          </span>
        )}
      </button>

      {/* Sidebar Content */}
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className={`px-4 py-4 border-b flex-shrink-0 ${
            theme === 'day-mode' ? 'border-gray-200' : 'border-[#334155]'
          }`}
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2
                  className={`text-lg font-semibold flex items-center gap-2 ${
                    theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                  }`}
                >
                  <i className={`fas ${context.icon}`}></i>
                  {context.title}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCollapsed(true);
                    }}
                    className={`text-lg transition-all ${
                      theme === 'day-mode' ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-200'
                    }`}
                    title="Collapse sidebar"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className={`text-lg ${
                      theme === 'day-mode' ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-200'
                    }`}
                    title="Close sidebar"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
              {deletedItems.length > 0 && (
                <p
                  className={`text-sm ${
                    theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {deletedItems.length} deleted {context.type === 'courses' ? 'course' : 'item'}
                  {deletedItems.length !== 1 ? 's' : ''}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(false);
                }}
                className={`text-lg transition-all ${
                  theme === 'day-mode' ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Expand sidebar"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <i className={`fas ${context.icon} text-xl ${
                theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
              }`}></i>
              {deletedItems.length > 0 && (
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    theme === 'day-mode' ? 'bg-red-500 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {deletedItems.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <i className="fas fa-circle-notch fa-spin text-2xl opacity-50"></i>
              </div>
            ) : error ? (
              <div
                className={`p-4 rounded-lg ${
                  theme === 'day-mode'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-red-900/20 text-red-300 border border-red-500/30'
                }`}
              >
                <p className="text-sm">{error}</p>
              </div>
            ) : deletedItems.length === 0 ? (
              <div
                className={`text-center py-8 ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                <i className="fas fa-check-circle text-3xl mb-2 opacity-50"></i>
                <p className="text-sm">No deleted items</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deletedItems.map(item => (
                  <div
                    key={item.course_id || item.topic_id}
                    className={`rounded-lg border p-3 ${
                      theme === 'day-mode'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-[#334155] border-[#475569]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`font-semibold text-sm truncate ${
                            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                          }`}
                          title={item.course_name || item.topic_name}
                        >
                          {item.course_name || item.topic_name}
                        </h3>
                        {item.description && (
                          <p
                            className={`text-xs mt-1 line-clamp-2 ${
                              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                            }`}
                          >
                            {item.description}
                          </p>
                        )}
                        <p
                          className={`text-xs mt-1 ${
                            theme === 'day-mode' ? 'text-gray-500' : 'text-gray-500'
                          }`}
                        >
                          Deleted: {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore(item)}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        theme === 'day-mode'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                    >
                      <i className="fas fa-undo mr-2"></i>
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SharedSidebar;

