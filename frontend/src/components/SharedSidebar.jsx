import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { coursesService } from '../services/courses.js';
import { topicsService } from '../services/topics.js';
import { contentService } from '../services/content.js';

const DEFAULT_TRAINER_ID = 'trainer-maya-levi';

/**
 * Global Shared Sidebar Component
 * Single unified sidebar for the entire application
 * Displays deleted items based on current page context:
 * - Courses List → Deleted Courses
 * - Inside a Course (Viewing Lessons) → Deleted Lessons for that course
 * - Standalone Topics Page → Deleted Topics
 * - Content Page (for a Topic) → Deleted Content items for that topic
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
    
    // Content page (for a topic) - must check this first before other /topics/ routes
    if (path.includes('/topics/') && path.includes('/content') && params.topicId) {
      const topicId = parseInt(params.topicId);
      if (!isNaN(topicId)) {
        return {
          type: 'content',
          topicId: topicId,
          title: 'Deleted Content',
          icon: 'fa-file-alt',
        };
      }
    }
    // Inside a course (viewing lessons) - must exclude /edit routes
    else if (path.startsWith('/courses/') && params.id && !path.includes('/edit') && !path.includes('/new')) {
      const courseId = parseInt(params.id);
      if (!isNaN(courseId)) {
        return {
          type: 'course-lessons',
          courseId: courseId,
          title: 'Deleted Lessons',
          icon: 'fa-book',
        };
      }
    }
    // Courses list page
    else if (path === '/courses' || (path.startsWith('/courses') && !params.id)) {
      return {
        type: 'courses',
        title: 'Deleted Courses',
        icon: 'fa-graduation-cap',
      };
    }
    // Standalone topics page
    else if (path === '/topics' || path === '/lessons') {
      return {
        type: 'topics',
        title: 'Deleted Topics',
        icon: 'fa-list',
      };
    }
    
    return null;
  }, [location.pathname, params.id, params.topicId]);

  // Load deleted items based on context
  useEffect(() => {
    if (!isOpen) {
      setDeletedItems([]);
      return;
    }
    
    // If no context, don't load items
    if (!context) {
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
        } else if (context.type === 'content') {
          // Load deleted content items for specific topic
          // Note: Currently content uses hard delete, so we check content_history for deleted items
          // For now, we'll show an empty list since content is hard-deleted
          // In the future, if soft delete is implemented, we can filter by status
          try {
            const allContent = await contentService.listByTopic(context.topicId);
            // Filter content with deleted status (if soft delete is implemented)
            const deletedContent = allContent.filter(item => 
              item.quality_check_status === 'deleted' || 
              item.status === 'deleted' ||
              (item.content_data && item.content_data.status === 'deleted')
            );
            setDeletedItems(deletedContent || []);
          } catch (err) {
            // If listByTopic fails or returns empty, set empty array
            setDeletedItems([]);
          }
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
    const itemName = item.course_name || item.topic_name || 
                     (item.content_id ? `Content #${item.content_id}` : 'Item');
    
    if (!window.confirm(`Restore "${itemName}"?`)) {
      return;
    }

    try {
      if (!context) {
        alert('Cannot restore: Invalid context');
        return;
      }
      
      setLoading(true);
      
      if (context.type === 'courses') {
        // Restore course by updating status to 'active'
        await coursesService.update(item.course_id, { status: 'active' });
      } else if (context.type === 'content') {
        // Restore content by updating quality_check_status or status
        if (item.content_id) {
          await contentService.update(item.content_id, { 
            quality_check_status: null,
            status: 'active' 
          });
        } else {
          throw new Error('Content ID is missing');
        }
      } else {
        // Restore topic/lesson by updating status to 'active'
        if (item.topic_id) {
          await topicsService.update(item.topic_id, { status: 'active' });
        } else {
          throw new Error('Topic ID is missing');
        }
      }

      // Reload deleted items after restore
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
      } else if (context.type === 'content') {
        try {
          const allContent = await contentService.listByTopic(context.topicId);
          const deletedContent = allContent.filter(contentItem => 
            contentItem.quality_check_status === 'deleted' || 
            contentItem.status === 'deleted' ||
            (contentItem.content_data && contentItem.content_data.status === 'deleted')
          );
          setDeletedItems(deletedContent || []);
        } catch (err) {
          setDeletedItems([]);
        }
      }

      setError(null);

      // Notify parent component if callback provided
      if (onRestore) {
        onRestore(item);
      }
    } catch (err) {
      setError(err.error?.message || err.message || 'Failed to restore item');
      alert(err.error?.message || err.message || 'Failed to restore item');
    } finally {
      setLoading(false);
    }
  };

  // Always render sidebar
  // If no context, show empty state with generic title
  const displayContext = context || {
    type: 'unknown',
    title: 'Deleted Items',
    icon: 'fa-archive',
  };

  return (
    <div
      className={`fixed left-0 top-20 bottom-0 transform transition-all duration-300 z-40 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${
        isCollapsed ? 'w-16' : 'w-96'
      } ${
        theme === 'day-mode'
          ? 'bg-white border-r border-gray-200 shadow-2xl'
          : 'bg-slate-900 border-r border-slate-700 shadow-2xl'
      }`}
    >
      {/* Toggle Button (Open/Close) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute right-0 top-1/2 translate-x-full -translate-y-1/2 w-10 h-20 rounded-r-lg flex items-center justify-center transition-all ${
          theme === 'day-mode'
            ? 'bg-white border-r border-t border-b border-gray-200 hover:bg-gray-50'
            : 'bg-slate-900 border-r border-t border-b border-slate-700 hover:bg-slate-800'
        }`}
        title={isOpen ? 'Close sidebar' : 'Open deleted items'}
      >
        <i className={`fas ${isOpen ? 'fa-chevron-left' : 'fa-chevron-right'} text-lg transition-transform duration-300`}></i>
        {!isOpen && deletedItems.length > 0 && (
          <span
            className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              theme === 'day-mode' ? 'bg-red-500 text-white' : 'bg-red-600 text-white'
            }`}
            title={`${deletedItems.length} deleted item${deletedItems.length !== 1 ? 's' : ''}`}
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
            theme === 'day-mode' ? 'border-gray-200' : 'border-slate-700'
          }`}
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2
                  className={`text-xl font-semibold flex items-center gap-2 ${
                    theme === 'day-mode' ? 'text-gray-900' : 'text-slate-200'
                  }`}
                >
                  <i className={`fas ${displayContext.icon}`}></i>
                  {displayContext.title}
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
                    <i className="fas fa-chevron-left"></i>
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
              <span className={`text-xs uppercase tracking-widest block mb-4 ${
                theme === 'day-mode' ? 'opacity-60 text-gray-600' : 'opacity-60 text-slate-400'
              }`}>
                Content Studio
              </span>
              {deletedItems.length > 0 && (
                <p
                  className={`text-sm ${
                    theme === 'day-mode' ? 'text-gray-600' : 'text-slate-400'
                  }`}
                >
                  {deletedItems.length} deleted {displayContext.type === 'courses' ? 'course' : 'item'}
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
                <i className="fas fa-chevron-right"></i>
              </button>
              <i className={`fas ${displayContext.icon} text-xl ${
                theme === 'day-mode' ? 'text-gray-700' : 'text-slate-300'
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
          <div className="flex-1 overflow-y-auto pr-4 py-4 pl-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <i className="fas fa-circle-notch fa-spin text-xl opacity-70"></i>
                <span className={`text-sm ${
                  theme === 'day-mode' ? 'text-gray-600' : 'text-slate-400'
                }`}>
                  Loading...
                </span>
              </div>
            ) : error ? (
              <div
                className={`p-4 rounded-xl border ${
                  theme === 'day-mode'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-red-900/20 text-red-300 border-red-500/30'
                }`}
              >
                <p className="text-sm">{error}</p>
              </div>
            ) : deletedItems.length === 0 ? (
              <div
                className={`text-center py-8 ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-slate-400'
                }`}
              >
                <i className="fas fa-check-circle text-3xl mb-2 opacity-50"></i>
                <p className="text-sm opacity-70">No deleted items</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deletedItems.map(item => (
                  <div
                    key={item.course_id || item.topic_id || item.content_id}
                    className={`rounded-xl border p-3 flex flex-col gap-3 transition-all ${
                      theme === 'day-mode'
                        ? 'bg-gray-50 border-gray-200 text-gray-700'
                        : 'bg-slate-800/40 border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {item.course_name || item.topic_name || `Content #${item.content_id}`}
                        </p>
                        <p className={`text-xs opacity-70 mt-1`}>
                          Deleted: {new Date(item.updated_at || item.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        theme === 'day-mode'
                          ? 'bg-gray-900/20'
                          : 'bg-white/10'
                      }`}>
                        Deleted
                      </span>
                    </div>

                    {item.description && (
                      <p className={`text-sm leading-relaxed max-h-16 overflow-hidden ${
                        theme === 'day-mode' ? 'text-gray-600' : 'text-slate-300'
                      }`}>
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestore(item)}
                        className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                          theme === 'day-mode'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <i className="fas fa-history mr-2"></i>
                        Restore
                      </button>
                    </div>
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

