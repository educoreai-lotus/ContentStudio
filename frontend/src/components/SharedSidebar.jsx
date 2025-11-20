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

// Section definitions (matching ContentHistorySidebar structure)
const SECTION_DEFINITIONS = [
  { id: 'text_audio', label: 'Text & Audio', icon: 'fa-file-audio', typeId: 1 },
  { id: 'code', label: 'Code', icon: 'fa-code', typeId: 2 },
  { id: 'slides', label: 'Slides', icon: 'fa-slideshare', typeId: 3 },
  { id: 'mind_map', label: 'Mind Map', icon: 'fa-project-diagram', typeId: 5 },
  { id: 'avatar_video', label: 'Avatar Video', icon: 'fa-video', typeId: 6 },
];

// VersionRow component (matching ContentHistorySidebar)
const VersionRow = ({
  version,
  isCurrent,
  onPreview,
  onRestore,
  onDelete,
  theme,
}) => {
  const baseClasses = theme === 'day-mode'
    ? 'bg-gray-50 border-gray-200 text-gray-700'
    : 'bg-slate-800/40 border-slate-700 text-slate-200';
  const activeClasses = theme === 'day-mode'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200';

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-3 transition-all ${
        isCurrent ? activeClasses : baseClasses
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {isCurrent ? 'Active Version' : 'Saved Version'}
          </p>
          <p className="text-xs opacity-70">
            Saved on: {new Date(version.updated_at || version.created_at).toLocaleString()}
          </p>
        </div>
        {!isCurrent && (
          <span className={`px-2 py-1 text-xs rounded-full ${
            theme === 'day-mode' ? 'bg-gray-900/20' : 'bg-white/10'
          }`}>
            Historical
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed max-h-16 overflow-hidden">
        {version.preview || 'No preview available'}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPreview(version)}
          className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg ${
            theme === 'day-mode'
              ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          }`}
        >
          <i className="fas fa-eye mr-2"></i>
          Preview
        </button>
        {!isCurrent && (
          <>
            <button
              onClick={() => onRestore(version)}
              className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white`}
            >
              <i className="fas fa-history mr-2"></i>
              Restore
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(version)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg ${
                  theme === 'day-mode'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title="Delete this version"
              >
                <i className="fas fa-trash"></i>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Format preview text for content history (similar to ContentHistorySidebar)
// Accepts either contentTypeId (number) or sectionId (string) for compatibility
const formatPreview = (contentTypeIdOrSectionId, entry) => {
  if (!entry) return '';
  const data = entry.content_data || entry;

  // Map content_type_id to section IDs if needed
  const sectionMap = {
    1: 'text_audio',
    2: 'code',
    3: 'slides',
    5: 'mind_map',
    6: 'avatar_video',
  };
  
  // If it's a number, convert to sectionId; if it's already a string, use it
  const sectionId = typeof contentTypeIdOrSectionId === 'number' 
    ? (sectionMap[contentTypeIdOrSectionId] || 'default')
    : contentTypeIdOrSectionId;

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
  const [openSections, setOpenSections] = useState({});
  const [previewState, setPreviewState] = useState(null);
  const [historyData, setHistoryData] = useState({});
  
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
    
    // Extract topicId from path if not in params
    // Support both /topics/:topicId/content and /topics/1/content patterns
    let topicIdParam = params.topicId || params.id;
    
    // If topicId not in params, try to extract from path
    if (!topicIdParam && path.includes('/topics/') && path.includes('/content')) {
      const match = path.match(/\/topics\/(\d+)\/content/);
      if (match && match[1]) {
        topicIdParam = match[1];
      }
    }
    
    console.log('[SharedSidebar] Determining context:', { 
      path, 
      params, 
      topicIdFromParams: params.topicId, 
      idFromParams: params.id,
      extractedTopicId: topicIdParam 
    });
    
    // Content page (for a topic) - must check this first before other /topics/ routes
    if (path.includes('/topics/') && path.includes('/content') && topicIdParam) {
      const topicId = parseInt(topicIdParam);
      if (!isNaN(topicId) && topicId > 0) {
        console.log('[SharedSidebar] Content context detected:', { topicId, path });
        return {
          type: 'content',
          topicId: topicId,
          title: 'History of Deleted Content',
          icon: 'fa-file-alt',
        };
      } else {
        console.warn('[SharedSidebar] Invalid topicId:', topicIdParam);
      }
    }
    // Inside a course (viewing course detail) - show deleted topics/lessons for this course
    else if (path.startsWith('/courses/') && params.id && !path.includes('/edit') && !path.includes('/new')) {
      const courseId = parseInt(params.id);
      if (!isNaN(courseId) && courseId > 0) {
        return {
          type: 'topics',
          courseId: courseId,
          title: 'History of Deleted Topics',
          icon: 'fa-list',
        };
      }
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
    
    console.log('[SharedSidebar] No context matched, returning null');
    return null;
  }, [location.pathname, params.id, params.topicId]);

  // Load deleted items based on context
  useEffect(() => {
    console.log('[SharedSidebar] useEffect triggered:', { isOpen, context });
    
    // Cleanup function: Clear data when context changes or component unmounts
    let isCancelled = false;
    
    // Immediately clear old data when context changes
    setHistoryData({});
    setDeletedContent([]);
    
    if (!isOpen) {
      console.log('[SharedSidebar] Sidebar is closed, clearing content');
      return () => {
        // Cleanup on unmount or when sidebar closes
        setDeletedContent([]);
        setHistoryData({});
      };
    }
    
    // If no context, don't load content
    if (!context) {
      console.log('[SharedSidebar] No context, clearing content');
      return () => {
        // Cleanup on unmount or when no context
        setDeletedContent([]);
        setHistoryData({});
      };
    }
    
    console.log('[SharedSidebar] Loading content for context:', context);

    const loadDeletedContent = async () => {
      // Don't proceed if component unmounted or context changed
      if (isCancelled) {
        console.log('[SharedSidebar] Load cancelled, context changed');
        return;
      }
      
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
          // Load deleted topics - if courseId is provided, load topics for that course, otherwise standalone topics
          const filters = {
            trainer_id: DEFAULT_TRAINER_ID,
            status: 'deleted',
          };
          
          if (context.courseId) {
            // Load deleted topics for this specific course
            filters.course_id = context.courseId;
          } else {
            // Load deleted standalone topics
            filters.course_id = null;
          }
          
          result = await topicsService.list(filters, { page: 1, limit: 50 });
          setDeletedContent(result.topics || []);
        } else if (context.type === 'content') {
          // Load content history for all content items in the topic
          // Similar to ContentHistorySidebar, we need to load history for each content item
          try {
            console.log('[SharedSidebar] Loading content history for topic:', context.topicId);
            const allContent = await contentService.listByTopic(context.topicId);
            console.log('[SharedSidebar] Loaded content items:', allContent);
            console.log('[SharedSidebar] Number of content items:', allContent?.length || 0);
            
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
                
                // Normalize response structure (same as ContentHistorySidebar)
                // Backend returns: { current: {...}, versions: [...] }
                const normalized = {
                  ...historyResponse,
                  current: historyResponse.current ? {
                    ...historyResponse.current,
                    preview: historyResponse.current.preview || formatPreview(contentItem.content_type_id, {
                      content_data: historyResponse.current.content_data,
                    }),
                  } : null,
                  versions: (historyResponse.versions || []).map(entry => ({
                    ...entry,
                    preview: entry.preview || formatPreview(contentItem.content_type_id, entry),
                  })),
                };
                
                if (!normalized.versions) {
                  console.warn(`[SharedSidebar] No 'versions' field in history response for content ${contentItem.content_id}`, historyResponse);
                  return [];
                }
                
                if (!Array.isArray(normalized.versions)) {
                  console.error(`[SharedSidebar] 'versions' is not an array for content ${contentItem.content_id}:`, typeof normalized.versions);
                  return [];
                }
                
                if (normalized.versions.length === 0) {
                  console.log(`[SharedSidebar] Empty versions array for content ${contentItem.content_id}`);
                  return [];
                }
                
                console.log(`[SharedSidebar] Found ${normalized.versions.length} versions for content ${contentItem.content_id}`);
                
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
                return normalized.versions.map(version => {
                  const historyId = version.history_id || version.version_id;
                  
                  console.log(`[SharedSidebar] Processing version:`, {
                    history_id: historyId,
                    content_id: contentItem.content_id,
                    has_content_data: !!version.content_data,
                    preview_from_backend: version.preview,
                    preview_final: version.preview
                  });
                  
                  return {
                    ...version,
                    history_id: historyId, // Backend uses version_id, we normalize to history_id
                    content_id: contentItem.content_id,
                    content_type_id: contentItem.content_type_id,
                    content_type_name: contentItem.content_type_name || CONTENT_TYPE_NAMES[contentItem.content_type_id] || `Content Type ${contentItem.content_type_id}`,
                    topic_id: context.topicId,
                    preview: version.preview, // Already normalized above
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
            
            // Organize history by content type (section) - similar to ContentHistorySidebar
            const historyBySection = {};
            allContent.forEach(contentItem => {
              const sectionMap = {
                1: 'text_audio',
                2: 'code',
                3: 'slides',
                5: 'mind_map',
                6: 'avatar_video',
              };
              const sectionId = sectionMap[contentItem.content_type_id] || 'default';
              
              if (!historyBySection[sectionId]) {
                historyBySection[sectionId] = {
                  contentItem: contentItem,
                  versions: [],
                };
              }
              
              // Find versions for this content item
              const versionsForThisContent = allHistoryVersions.filter(
                v => v.content_id === contentItem.content_id
              );
              historyBySection[sectionId].versions = versionsForThisContent;
            });
            
            // Store history data organized by section
            setHistoryData(historyBySection);
            
            if (allHistoryVersions.length === 0) {
              console.warn('[SharedSidebar] No history versions found for any content items');
              console.log('[SharedSidebar] Content items checked:', allContent.map(c => ({ id: c.content_id, type: c.content_type_id, name: c.content_type_name })));
            }
            
            // For display, we'll use historyData, but keep deletedContent for other contexts
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
    
    // Cleanup function: Cancel any in-flight requests and clear data when context changes
    return () => {
      isCancelled = true;
      console.log('[SharedSidebar] Cleanup: Clearing data due to context change');
      setHistoryData({});
      setDeletedContent([]);
    };
  }, [context, isOpen]);

  const handleToggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }));
  };

  const renderSectionBody = (section) => {
    const sectionData = historyData[section.id];
    if (!sectionData || !sectionData.versions || sectionData.versions.length === 0) {
      return (
        <p className={`text-sm opacity-70 ${
          theme === 'day-mode' ? 'text-gray-600' : 'text-slate-400'
        }`}>
          No history versions recorded yet.
        </p>
      );
    }

    const entries = sectionData.versions.map(entry => ({ ...entry, isCurrent: false }));

    return (
      <div className="flex flex-col gap-3">
        {entries.map(entry => (
          <VersionRow
            key={`${entry.history_id}`}
            version={{
              ...entry,
              created_at: entry.created_at || entry.updated_at,
            }}
            isCurrent={false}
            onPreview={version =>
              setPreviewState({
                sectionId: section.id,
                sectionLabel: section.label,
                version,
              })
            }
            onRestore={version => handleRestore(version)}
            onDelete={version => handleDeleteVersion(version)}
            theme={theme}
          />
        ))}
      </div>
    );
  };

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
        // Reload deleted topics - if courseId is provided, load topics for that course, otherwise standalone topics
        const filters = {
          trainer_id: DEFAULT_TRAINER_ID,
          status: 'deleted',
        };
        
        if (context.courseId) {
          // Load deleted topics for this specific course
          filters.course_id = context.courseId;
        } else {
          // Load deleted standalone topics
          filters.course_id = null;
        }
        
        result = await topicsService.list(filters, { page: 1, limit: 50 });
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
          const allHistoryVersions = historyArrays.flat().filter(Boolean);
          
          // Reorganize history by section after restore
          const historyBySection = {};
          allContent.forEach(contentItem => {
            const sectionMap = {
              1: 'text_audio',
              2: 'code',
              3: 'slides',
              5: 'mind_map',
              6: 'avatar_video',
            };
            const sectionId = sectionMap[contentItem.content_type_id] || 'default';
            
            if (!historyBySection[sectionId]) {
              historyBySection[sectionId] = {
                contentItem: contentItem,
                versions: [],
              };
            }
            
            const versionsForThisContent = allHistoryVersions.filter(
              v => v.content_id === contentItem.content_id
            );
            historyBySection[sectionId].versions = versionsForThisContent;
          });
          
          setHistoryData(historyBySection);
          console.log('[SharedSidebar] Reloaded history versions after restore:', allHistoryVersions.length);
          setDeletedContent(allHistoryVersions || []);
        } catch (err) {
          console.error('[SharedSidebar] Failed to reload content history after restore:', err);
          setDeletedContent([]);
          setHistoryData({});
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
        isCollapsed ? 'w-16' : 'w-72'
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
            ) : context.type === 'content' && Object.keys(historyData).length > 0 ? (
              // Display history organized by sections (like ContentHistorySidebar)
              <div className="space-y-4">
                {SECTION_DEFINITIONS.map(section => {
                  const sectionData = historyData[section.id];
                  const hasVersions = sectionData && sectionData.versions && sectionData.versions.length > 0;
                  const isOpen = openSections[section.id];

                  if (!hasVersions) return null;

                  return (
                    <div key={section.id} className={`border rounded-2xl overflow-hidden ${
                      theme === 'day-mode' ? 'border-gray-200' : 'border-slate-700'
                    }`}>
                      <button
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all ${
                          theme === 'day-mode'
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                        onClick={() => handleToggleSection(section)}
                      >
                        <div className="flex items-center gap-3">
                          <i className={`fas ${section.icon}`}></i>
                          <span className="font-semibold text-sm uppercase tracking-wide">
                            {section.label}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            theme === 'day-mode' ? 'bg-gray-300 text-gray-700' : 'bg-slate-600 text-slate-200'
                          }`}>
                            {sectionData.versions.length}
                          </span>
                        </div>
                        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
                      </button>

                      {isOpen && (
                        <div className={`px-4 py-4 ${
                          theme === 'day-mode' ? 'bg-black/5' : 'bg-white/5'
                        }`}>
                          {renderSectionBody(section)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Fallback: Display flat list for courses/topics
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className={`max-w-4xl w-full mx-auto my-auto rounded-2xl shadow-2xl border p-6 relative ${
              theme === 'day-mode'
                ? 'bg-white border-gray-200 text-gray-900'
                : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
            style={{ maxHeight: '90vh' }}
          >
            <button
              className="absolute top-4 right-4 text-xl opacity-60 hover:opacity-100"
              onClick={() => setPreviewState(null)}
            >
              <i className="fas fa-times"></i>
            </button>

            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="fas fa-eye"></i>
              {previewState.sectionLabel || 'Version Preview'}
            </h3>

            <div className="max-h-[70vh] overflow-auto pr-1 space-y-4">
              {renderPreviewContent(previewState.sectionId, previewState.version, theme)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Preview content renderer (same as ContentHistorySidebar)
function renderPreviewContent(sectionId, version, theme) {
  const data = version?.content_data || version || {};

  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <p className="text-sm opacity-70">No data available for this version.</p>;
  }

  switch (sectionId) {
    case 'text_audio':
      return (
        <div className="space-y-4">
          {data.text && (
            <div className="whitespace-pre-wrap leading-relaxed text-sm">
              {data.text}
            </div>
          )}
          {data.audioUrl && (
            <div className="space-y-2">
              <audio controls className="w-full" src={data.audioUrl}>
                Your browser does not support the audio element.
              </audio>
              <div className="text-xs opacity-70 flex flex-wrap gap-3">
                {data.audioVoice ? <span>Voice: {data.audioVoice}</span> : null}
                {data.audioDuration ? (
                  <span>Duration: {Math.round(data.audioDuration)}s</span>
                ) : null}
                {data.audioFormat ? <span>Format: {data.audioFormat}</span> : null}
              </div>
            </div>
          )}
        </div>
      );

    case 'slides': {
      const title =
        data.presentation?.title ||
        data.title ||
        data.fileName ||
        'Presentation Deck';
      const slides = data.presentation?.slides || data.slides || [];
      const presentationUrl =
        data.presentationUrl ||
        data.googleSlidesUrl ||
        data.presentation?.publicUrl ||
        data.presentation?.url ||
        data.storageUrl ||
        data.fileUrl;
      
      const gammaUrl = data.metadata?.gamma_raw_response?.result?.gammaUrl || 
                       data.metadata?.gamma_raw_response?.gammaUrl ||
                       data.gamma_raw_response?.result?.gammaUrl ||
                       data.gamma_raw_response?.gammaUrl ||
                       data.gammaUrl;

      const summaryItems = [
        data.slide_count ? `${data.slide_count} total slides` : null,
        data.presentation?.createdBy ? `Author: ${data.presentation.createdBy}` : null,
        data.presentation?.subject ? `Subject: ${data.presentation.subject}` : null,
      ].filter(Boolean);

      return (
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center text-2xl">
                <i className="fas fa-file-powerpoint"></i>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-semibold leading-tight">{title}</h4>
              {summaryItems.length > 0 && (
                <ul className="text-xs opacity-70 space-y-1">
                  {summaryItems.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {(gammaUrl || presentationUrl) && (
                <div className="flex flex-wrap gap-2">
                  {gammaUrl && (
                    <a
                      href={gammaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <i className="fas fa-external-link-alt"></i>
                      View
                    </a>
                  )}
                  {presentationUrl && (
                    <a
                      href={presentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <i className="fas fa-download"></i>
                      Download
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {slides.length > 0 ? (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold opacity-80">Slide Outline</h5>
              <ol className="space-y-2 text-sm">
                {slides.slice(0, 8).map((slide, index) => (
                  <li
                    key={slide.slide_number || index}
                    className="border-l-2 border-purple-400 pl-3"
                  >
                    <p className="font-medium">{slide.title || `Slide ${index + 1}`}</p>
                    {Array.isArray(slide.content) && slide.content.length > 0 && (
                      <ul className="list-disc list-inside opacity-80">
                        {slide.content.slice(0, 4).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                        {slide.content.length > 4 && <li>…</li>}
                      </ul>
                    )}
                  </li>
                ))}
                {slides.length > 8 && (
                  <li className="opacity-60">… {slides.length - 8} more slides</li>
                )}
              </ol>
            </div>
          ) : (
            <div
              className={`p-4 rounded-lg border ${
                theme === 'day-mode'
                  ? 'bg-purple-50 border-purple-200'
                  : 'bg-purple-900/20 border-purple-500/30'
              }`}
            >
              <p className="text-sm opacity-80">
                Slide outline not available for this version, but you can open the deck using the link
                above.
              </p>
            </div>
          )}
        </div>
      );
    }

    case 'mind_map':
      return <p className="text-sm opacity-70">Mind map preview not available in this view.</p>;

    case 'code': {
      const code = data.code || data.snippet || data.text;
      const language = data.language || data.languageLabel || 'code';
      return code ? (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest opacity-60">{language}</div>
          <pre
            className={`rounded-lg p-4 overflow-auto text-sm ${
              theme === 'day-mode'
                ? 'bg-gray-900 text-green-100'
                : 'bg-slate-800 text-emerald-100'
            }`}
          >
            {code}
          </pre>
        </div>
      ) : (
        <p className="text-sm opacity-70">No code snippet available.</p>
      );
    }

    case 'avatar_video': {
      const videoUrl = data.videoUrl || data.storageUrl || data.cloudUrl;
      return videoUrl ? (
        <div className="space-y-3">
          <video
            controls
            src={videoUrl}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700"
          >
            <track kind="captions" />
          </video>
          <div className="text-xs opacity-70">
            <div>Voice: {data.voice || data.audioVoice || 'Unknown'}</div>
            {data.duration && <div>Duration: {Math.round(data.duration)}s</div>}
          </div>
        </div>
      ) : (
        <p className="text-sm opacity-70">Video URL missing for this version.</p>
      );
    }

    default:
      return (
        <pre className="max-h-[60vh] overflow-auto text-sm whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}

export default SharedSidebar;

