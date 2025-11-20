import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { coursesService } from '../services/courses.js';
import { topicsService } from '../services/topics.js';
import { contentService } from '../services/content.js';

const DEFAULT_TRAINER_ID = 'trainer-maya-levi';

// Content type names mapping
const CONTENT_TYPE_NAMES = {
  1: 'Text & Audio',
  2: 'Code Example',
  3: 'Presentation',
  5: 'Mind Map',
  6: 'Avatar Video',
};

// Format preview text for content history (similar to ContentHistorySidebar)
const formatPreview = (contentTypeId, entry) => {
  if (!entry) return '';
  const data = entry.content_data || entry;

  // Map content_type_id to section IDs
  const sectionMap = {
    1: 'text_audio',
    2: 'code',
    3: 'slides',
    5: 'mind_map',
    6: 'avatar_video',
  };
  
  const sectionId = sectionMap[contentTypeId] || 'default';

  switch (sectionId) {
    case 'text_audio': {
      const text = data.text || data.body || '';
      return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    }
    case 'slides': {
      const title = data.presentation?.title || data.title || 'Slide deck';
      const count = data.slide_count || data.slides?.length;
      return `${title}${count ? ` (${count} slides)` : ''}`;
    }
    case 'mind_map': {
      if (Array.isArray(data.nodes)) {
        return `Mind map with ${data.nodes.length} nodes`;
      }
      return 'Mind map structure';
    }
    case 'code': {
      const snippet = data.code || data.snippet || '';
      return snippet.length > 120 ? `${snippet.slice(0, 117)}...` : snippet;
    }
    case 'avatar_video': {
      return data.videoUrl || data.storageUrl || 'Avatar video';
    }
    default:
      return typeof data === 'string' ? data : JSON.stringify(data).slice(0, 120);
  }
};

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
  const [deletedContent, setDeletedContent] = useState([]);
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
          title: 'History of Deleted Content',
          icon: 'fa-file-alt',
        };
      }
    }
    // Inside a course (viewing course detail) - show deleted courses, not lessons
    else if (path.startsWith('/courses/') && params.id && !path.includes('/edit') && !path.includes('/new')) {
      return {
        type: 'courses',
        title: 'History of Deleted Courses',
        icon: 'fa-graduation-cap',
      };
    }
    // Courses list page
    else if (path === '/courses' || (path.startsWith('/courses') && !params.id)) {
      return {
        type: 'courses',
        title: 'History of Deleted Courses',
        icon: 'fa-graduation-cap',
      };
    }
    // Standalone topics page
    else if (path === '/topics' || path === '/lessons') {
      return {
        type: 'topics',
        title: 'History of Deleted Topics',
        icon: 'fa-list',
      };
    }
    
    return null;
  }, [location.pathname, params.id, params.topicId]);

  // Load deleted items based on context
  useEffect(() => {
    if (!isOpen) {
      setDeletedContent([]);
      return;
    }
    
    // If no context, don't load content
    if (!context) {
      setDeletedContent([]);
      return;
    }

    const loadDeletedContent = async () => {
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
          setDeletedContent(result.courses || []);
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
          setDeletedContent(result.topics || []);
        } else if (context.type === 'content') {
          // Load content history for all content items in the topic
          // Similar to ContentHistorySidebar, we need to load history for each content item
          try {
            const allContent = await contentService.listByTopic(context.topicId);
            console.log('[SharedSidebar] Loaded content items:', allContent);
            
            if (!allContent || allContent.length === 0) {
              setDeletedContent([]);
              return;
            }
            
            const historyPromises = allContent.map(async (contentItem) => {
              try {
                console.log(`[SharedSidebar] Loading history for content ${contentItem.content_id} (type: ${contentItem.content_type_id})`);
                const historyResponse = await contentService.getHistory(contentItem.content_id);
                console.log(`[SharedSidebar] History response for ${contentItem.content_id}:`, JSON.stringify(historyResponse, null, 2));
                
                if (!historyResponse) {
                  console.warn(`[SharedSidebar] No history response for content ${contentItem.content_id}`);
                  return [];
                }
                
                // Check if response has the expected structure
                if (typeof historyResponse !== 'object') {
                  console.error(`[SharedSidebar] Invalid history response type for content ${contentItem.content_id}:`, typeof historyResponse);
                  return [];
                }
                
                if (!historyResponse.versions) {
                  console.warn(`[SharedSidebar] No 'versions' field in history response for content ${contentItem.content_id}`, historyResponse);
                  return [];
                }
                
                if (!Array.isArray(historyResponse.versions)) {
                  console.error(`[SharedSidebar] 'versions' is not an array for content ${contentItem.content_id}:`, typeof historyResponse.versions);
                  return [];
                }
                
                if (historyResponse.versions.length === 0) {
                  console.log(`[SharedSidebar] Empty versions array for content ${contentItem.content_id}`);
                  return [];
                }
                
                console.log(`[SharedSidebar] Found ${historyResponse.versions.length} versions for content ${contentItem.content_id}`);
                
                // Map content_type_id to section ID for formatPreview
                const sectionMap = {
                  1: 'text_audio',
                  2: 'code',
                  3: 'slides',
                  5: 'mind_map',
                  6: 'avatar_video',
                };
                const sectionId = sectionMap[contentItem.content_type_id] || 'default';
                
                // Return history versions (not current, as current is the active content)
                // Backend returns history_id from entry.version_id (see ContentHistoryService.js line 149)
                // Backend also returns preview built by #buildPreview (see ContentHistoryService.js line 152)
                return (historyResponse.versions || []).map(version => {
                  // Use preview from backend (built by #buildPreview) or fallback to formatPreview
                  const preview = version.preview || formatPreview(contentItem.content_type_id, version);
                  const historyId = version.history_id || version.version_id;
                  
                  console.log(`[SharedSidebar] Processing version:`, {
                    history_id: historyId,
                    content_id: contentItem.content_id,
                    has_content_data: !!version.content_data,
                    preview_from_backend: version.preview,
                    preview_final: preview
                  });
                  
                  return {
                    ...version,
                    history_id: historyId, // Backend uses version_id, we normalize to history_id
                    content_id: contentItem.content_id,
                    content_type_id: contentItem.content_type_id,
                    content_type_name: contentItem.content_type_name || CONTENT_TYPE_NAMES[contentItem.content_type_id] || `Content Type ${contentItem.content_type_id}`,
                    topic_id: context.topicId,
                    preview: preview, // Use backend preview (from #buildPreview) or fallback
                    sectionId: sectionId,
                  };
                });
              } catch (err) {
                console.error(`[SharedSidebar] Failed to load history for content ${contentItem.content_id}:`, err);
                return [];
              }
            });
            
            const historyArrays = await Promise.all(historyPromises);
            const allHistoryVersions = historyArrays.flat().filter(Boolean); // Remove any null/undefined content
            console.log('[SharedSidebar] All history versions after processing:', allHistoryVersions);
            console.log('[SharedSidebar] Total history versions count:', allHistoryVersions.length);
            console.log('[SharedSidebar] Sample version structure:', allHistoryVersions[0]);
            
            if (allHistoryVersions.length === 0) {
              console.warn('[SharedSidebar] No history versions found for any content items');
              console.log('[SharedSidebar] Content items checked:', allContent.map(c => ({ id: c.content_id, type: c.content_type_id, name: c.content_type_name })));
              console.log('[SharedSidebar] History responses received:', historyArrays.map((arr, idx) => ({
                content_id: allContent[idx]?.content_id,
                versions_count: arr?.length || 0
              })));
            }
            
            setDeletedContent(allHistoryVersions);
          } catch (err) {
            console.error('[SharedSidebar] Failed to load content history:', err);
            setError(err.error?.message || err.message || 'Failed to load content history');
            setDeletedContent([]);
          }
        }
      } catch (err) {
        setError(err.error?.message || 'Failed to load deleted content');
        setDeletedContent([]);
      } finally {
        setLoading(false);
      }
    };

    loadDeletedContent();
  }, [context, isOpen]);

  const handleDeleteVersion = async (content) => {
    if (!window.confirm(`Delete this version? This action cannot be undone.`)) {
      return;
    }

    try {
      if (!content.history_id) {
        alert('Cannot delete: History ID is missing');
        return;
      }

      setLoading(true);
      await contentService.deleteVersion(content.history_id);

      // Reload content history after delete
      if (context && context.type === 'content') {
        try {
          const allContent = await contentService.listByTopic(context.topicId);
          
          if (!allContent || allContent.length === 0) {
            setDeletedContent([]);
            return;
          }
          
          const historyPromises = allContent.map(async (contentItem) => {
            try {
              const historyResponse = await contentService.getHistory(contentItem.content_id);
              
              if (!historyResponse || !historyResponse.versions) {
                return [];
              }
              
              const sectionMap = {
                1: 'text_audio',
                2: 'code',
                3: 'slides',
                5: 'mind_map',
                6: 'avatar_video',
              };
              const sectionId = sectionMap[contentItem.content_type_id] || 'default';
              
              return (historyResponse.versions || []).map(version => {
                const preview = version.preview || formatPreview(contentItem.content_type_id, version);
                return {
                  ...version,
                  history_id: version.history_id || version.version_id,
                  content_id: contentItem.content_id,
                  content_type_id: contentItem.content_type_id,
                  content_type_name: contentItem.content_type_name || CONTENT_TYPE_NAMES[contentItem.content_type_id] || `Content Type ${contentItem.content_type_id}`,
                  topic_id: context.topicId,
                  preview: preview,
                  sectionId: sectionId,
                };
              });
            } catch (err) {
              console.error(`[SharedSidebar] Failed to reload history for content ${contentItem.content_id}:`, err);
              return [];
            }
          });
          
          const historyArrays = await Promise.all(historyPromises);
          const allHistoryVersions = historyArrays.flat();
          setDeletedContent(allHistoryVersions || []);
        } catch (err) {
          console.error('[SharedSidebar] Failed to reload content history after delete:', err);
          setDeletedContent([]);
        }
      }

      setError(null);
    } catch (err) {
      setError(err.error?.message || err.message || 'Failed to delete version');
      alert(err.error?.message || err.message || 'Failed to delete version');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (content) => {
    const contentName = content.course_name || content.topic_name || 
                     (content.content_id ? `Content #${content.content_id}` : 
                      content.history_id ? `Content Version #${content.history_id}` : 'Content');
    
    if (!window.confirm(`Restore "${contentName}"?`)) {
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
        await coursesService.update(content.course_id, { status: 'active' });
      } else if (context.type === 'content') {
        // Restore content version from history
        if (content.history_id) {
          await contentService.restoreVersion(content.history_id);
        } else {
          throw new Error('History ID is missing');
        }
      } else {
        // Restore topic/lesson by updating status to 'active'
        if (content.topic_id) {
          await topicsService.update(content.topic_id, { status: 'active' });
        } else {
          throw new Error('Topic ID is missing');
        }
      }

      // Reload deleted content after restore
      let result;
      
      if (context.type === 'courses') {
        result = await coursesService.list(
          {
            trainer_id: DEFAULT_TRAINER_ID,
            status: 'deleted',
          },
          { page: 1, limit: 50 }
        );
        setDeletedContent(result.courses || []);
      } else if (context.type === 'topics') {
        result = await topicsService.list(
          {
            trainer_id: DEFAULT_TRAINER_ID,
            course_id: null,
            status: 'deleted',
          },
          { page: 1, limit: 50 }
        );
        setDeletedContent(result.topics || []);
      } else if (context.type === 'content') {
        try {
          const allContent = await contentService.listByTopic(context.topicId);
          console.log('[SharedSidebar] Reloading content history after restore, found content items:', allContent?.length || 0);
          
          if (!allContent || allContent.length === 0) {
            setDeletedContent([]);
            return;
          }
          
          const historyPromises = allContent.map(async (contentItem) => {
            try {
              const historyResponse = await contentService.getHistory(contentItem.content_id);
              
              if (!historyResponse || !historyResponse.versions) {
                return [];
              }
              
              const sectionMap = {
                1: 'text_audio',
                2: 'code',
                3: 'slides',
                5: 'mind_map',
                6: 'avatar_video',
              };
              const sectionId = sectionMap[contentItem.content_type_id] || 'default';
              
              return (historyResponse.versions || []).map(version => {
                // Use preview from backend (built by #buildPreview) or fallback to formatPreview
                const preview = version.preview || formatPreview(contentItem.content_type_id, version);
                return {
                  ...version,
                  history_id: version.history_id || version.version_id, // Support both field names
                  content_id: contentItem.content_id,
                  content_type_id: contentItem.content_type_id,
                  content_type_name: contentItem.content_type_name || CONTENT_TYPE_NAMES[contentItem.content_type_id] || `Content Type ${contentItem.content_type_id}`,
                  topic_id: context.topicId,
                  preview: preview, // Use backend preview (from #buildPreview) or fallback
                  sectionId: sectionId,
                };
              });
            } catch (err) {
              console.error(`[SharedSidebar] Failed to reload history for content ${contentItem.content_id}:`, err);
              return [];
            }
          });
          
          const historyArrays = await Promise.all(historyPromises);
          const allHistoryVersions = historyArrays.flat();
          console.log('[SharedSidebar] Reloaded history versions after restore:', allHistoryVersions.length);
          setDeletedContent(allHistoryVersions || []);
        } catch (err) {
          console.error('[SharedSidebar] Failed to reload content history after restore:', err);
          setDeletedContent([]);
        }
      }

      setError(null);

      // Notify parent component if callback provided
      if (onRestore) {
        onRestore(content);
      }
    } catch (err) {
      setError(err.error?.message || err.message || 'Failed to restore content');
      alert(err.error?.message || err.message || 'Failed to restore content');
    } finally {
      setLoading(false);
    }
  };

  // Always render sidebar
  // If no context, show empty state with generic title
  const displayContext = context || {
    type: 'unknown',
    title: 'History of Deleted Content',
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
        title={isOpen ? 'Close sidebar' : 'Open deleted content'}
      >
        <i className={`fas ${isOpen ? 'fa-chevron-left' : 'fa-chevron-right'} text-lg transition-transform duration-300`}></i>
        {!isOpen && deletedContent.length > 0 && (
          <span
            className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              theme === 'day-mode' ? 'bg-red-500 text-white' : 'bg-red-600 text-white'
            }`}
            title={`${deletedContent.length} deleted content${deletedContent.length !== 1 ? 's' : ''}`}
          >
            {deletedContent.length}
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
              {deletedContent.length > 0 && (
                <p
                  className={`text-sm ${
                    theme === 'day-mode' ? 'text-gray-600' : 'text-slate-400'
                  }`}
                >
                  {deletedContent.length} deleted {displayContext.type === 'courses' ? 'course' : displayContext.type === 'content' ? 'content' : displayContext.type === 'topics' ? 'topic' : 'content'}
                  {deletedContent.length !== 1 ? 's' : ''}
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
              {deletedContent.length > 0 && (
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    theme === 'day-mode' ? 'bg-red-500 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {deletedContent.length}
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
            ) : deletedContent.length === 0 ? (
              <div
                className={`text-center py-8 ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-slate-400'
                }`}
              >
                <i className="fas fa-check-circle text-3xl mb-2 opacity-50"></i>
                <p className="text-sm opacity-70">No deleted {displayContext.type === 'content' ? 'content' : displayContext.type === 'courses' ? 'courses' : displayContext.type === 'topics' ? 'topics' : 'content'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deletedContent.map(content => (
                  <div
                    key={content.course_id || content.topic_id || content.content_id || content.history_id || `content-${Math.random()}`}
                    className={`rounded-xl border p-3 flex flex-col gap-3 transition-all ${
                      theme === 'day-mode'
                        ? 'bg-gray-50 border-gray-200 text-gray-700'
                        : 'bg-slate-800/40 border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {content.course_name || content.topic_name || 
                           (content.content_type_name ? `${content.content_type_name} Version` : 
                            content.content_id ? `Content #${content.content_id}` : 
                            content.history_id ? `Content Version #${content.history_id}` : 'Content')}
                        </p>
                        <p className={`text-xs opacity-70 mt-1`}>
                          {content.updated_at || content.created_at 
                            ? `Saved: ${new Date(content.updated_at || content.created_at).toLocaleString()}`
                            : 'No date available'}
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

                    {(content.description || content.preview) && (
                      <p className={`text-sm leading-relaxed max-h-16 overflow-hidden ${
                        theme === 'day-mode' ? 'text-gray-600' : 'text-slate-300'
                      }`}>
                        {content.preview || content.description || 'No preview available'}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestore(content)}
                        className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                          theme === 'day-mode'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <i className="fas fa-history mr-2"></i>
                        Restore
                      </button>
                      {context.type === 'content' && content.history_id && (
                        <button
                          onClick={() => handleDeleteVersion(content)}
                          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                            theme === 'day-mode'
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                          title="Delete this version"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
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

