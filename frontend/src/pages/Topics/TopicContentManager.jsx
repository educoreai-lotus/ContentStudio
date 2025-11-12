import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { contentService } from '../../services/content.js';
import { topicsService } from '../../services/topics.js';
import { useApp } from '../../context/AppContext';
import { TemplateSelectionModal } from '../../components/Templates/TemplateSelectionModal.jsx';
import { RegenerateOptionsModal } from '../../components/Content/RegenerateOptionsModal.jsx';
import { ContentHistorySidebar } from '../../components/Content/ContentHistorySidebar.jsx';

const CONTENT_TYPES = [
  { id: 'text', name: 'Text & Audio', icon: 'fa-file-alt', color: 'blue', dbId: 1, allowManual: true },
  { id: 'code', name: 'Code Example', icon: 'fa-code', color: 'green', dbId: 2, allowManual: true },
  { id: 'presentation', name: 'Presentation', icon: 'fa-presentation', color: 'purple', dbId: 3, allowManual: true },
  { id: 'mind_map', name: 'Mind Map', icon: 'fa-project-diagram', color: 'yellow', dbId: 5, allowManual: false },
  { id: 'avatar_video', name: 'Avatar Video', icon: 'fa-video', color: 'indigo', dbId: 6, allowManual: false },
];

/**
 * Topic Content Manager
 * Displays existing content and allows creation/editing/deletion
 */
export default function TopicContentManager() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useApp();
  
  const [existingContent, setExistingContent] = useState([]);
  const [topicDetails, setTopicDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateAppliedMessage, setTemplateAppliedMessage] = useState(null);
  const [regenerateTarget, setRegenerateTarget] = useState(null);
  const [qualityCheckInfo, setQualityCheckInfo] = useState(null);

  useEffect(() => {
    fetchContent();
    fetchTopicDetails();
    
    // Check for quality check info from navigation state
    if (location.state?.qualityCheck) {
      setQualityCheckInfo(location.state.qualityCheck);
      // Clear location state to prevent showing again on refresh
      window.history.replaceState({}, document.title);
    }
    if (location.state?.message) {
      setTemplateAppliedMessage(location.state.message);
      // Clear location state to prevent showing again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [topicId, location.state]);

  // Refresh content when returning to this page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchContent();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [topicId]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const content = await contentService.listByTopic(parseInt(topicId));
      setExistingContent(content || []);
    } catch (err) {
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicDetails = async () => {
    try {
      const topic = await topicsService.getById(parseInt(topicId));
      // API returns {success?, data?}. ensure compatibility
      const topicData = topic.topic || topic.data || topic;
      setTopicDetails(topicData);
    } catch (err) {
      console.warn('Failed to fetch topic details', err);
    }
  };

  const handleDelete = async (contentId) => {
    if (!window.confirm('Are you sure you want to delete this content?')) {
      return;
    }

    try {
      await contentService.delete(contentId);
      await fetchContent(); // Refresh list
      setTemplateAppliedMessage('Content removed from active list and archived in history.');
    } catch (err) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Unknown error';
      alert('Failed to delete content: ' + message);
    }
  };

  const handleRegenerate = (type, content) => {
    if (!type.allowManual) {
      navigate(`/topics/${topicId}/content/ai-generate`, {
        state: { contentType: type.id, existingContent: content },
      });
      return;
    }

    setRegenerateTarget({ type, content });
  };

  const handleRegenerateSelection = mode => {
    if (!regenerateTarget || !mode) {
      setRegenerateTarget(null);
      return;
    }

    const { type, content } = regenerateTarget;
    if (mode === 'ai') {
      navigate(`/topics/${topicId}/content/ai-generate`, {
        state: { contentType: type.id, existingContent: content },
      });
    } else if (mode === 'manual') {
      navigate(`/topics/${topicId}/content/manual-create`, {
        state: {
          contentType: type.id,
          contentTypeId: type.dbId,
          existingContent: content,
        },
      });
    }

    setRegenerateTarget(null);
  };

  const getContentByType = (type) => {
    return existingContent.find(c => c.content_type_id === type.dbId);
  };

  const getColorClasses = (color, hasContent) => {
    if (!hasContent) {
      return theme === 'day-mode'
        ? 'bg-gray-100 border-gray-300 text-gray-400'
        : 'bg-gray-800 border-gray-600 text-gray-500';
    }

    const colors = {
      blue: theme === 'day-mode'
        ? 'bg-blue-50 border-blue-300 text-blue-700'
        : 'bg-blue-900/20 border-blue-500/30 text-blue-300',
      green: theme === 'day-mode'
        ? 'bg-green-50 border-green-300 text-green-700'
        : 'bg-green-900/20 border-green-500/30 text-green-300',
      purple: theme === 'day-mode'
        ? 'bg-purple-50 border-purple-300 text-purple-700'
        : 'bg-purple-900/20 border-purple-500/30 text-purple-300',
      red: theme === 'day-mode'
        ? 'bg-red-50 border-red-300 text-red-700'
        : 'bg-red-900/20 border-red-500/30 text-red-300',
      yellow: theme === 'day-mode'
        ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
        : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300',
      indigo: theme === 'day-mode'
        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
        : 'bg-indigo-900/20 border-indigo-500/30 text-indigo-300',
    };

    return colors[color] || colors.blue;
  };

  const trainerId = useMemo(() => {
    if (topicDetails?.trainer_id) return topicDetails.trainer_id;
    return undefined;
  }, [topicDetails]);

  const hasAllFormats = existingContent.length >= 5;
  const hasAvatarVideo = existingContent.some(
    content => content.content_type_id === CONTENT_TYPES.find(t => t.id === 'avatar_video')?.dbId
  );

  const handleTemplateApplied = async (templateId, templateData) => {
    await fetchTopicDetails();
    await fetchContent();
    setTemplateAppliedMessage(
      `Template "${templateData?.template_name || templateId}" applied successfully.`
    );
  };

  return (
    <div className={`min-h-screen p-6 lg:p-8 ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => {
              if (topicDetails?.course_id) {
                navigate(`/courses/${topicDetails.course_id}`);
              } else {
                navigate(-1); // Fallback to previous page if course_id not available
              }
            }}
            className={`mb-4 px-4 py-2 rounded-lg ${
              theme === 'day-mode'
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Back to Course
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
            Manage Lesson Content
          </h1>
          <p className={`text-lg ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
            Create and manage all content formats for this lesson
          </p>
        </div>

        {error && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              theme === 'day-mode'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-red-900/20 border-red-500/30 text-red-300'
            }`}
          >
            {error}
          </div>
        )}

        <div className="lg:flex lg:items-start lg:gap-8 xl:gap-12">
          <div className="flex-1 min-w-0">
            {/* Content Progress */}
            <div
              className={`mb-8 p-6 rounded-2xl shadow-lg ${
                theme === 'day-mode'
                  ? 'bg-white border border-gray-200'
                  : 'bg-gray-800 border border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2
                  className={`text-xl font-semibold ${
                    theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                  }`}
                >
                  Content Progress
                </h2>
                <span
                  className={`text-2xl font-bold ${
                    existingContent.length >= 5
                      ? 'text-emerald-600'
                      : theme === 'day-mode'
                      ? 'text-gray-700'
                      : 'text-gray-300'
                  }`}
                >
                  {Math.min(existingContent.length, 5)}/5
                </span>
              </div>
              <div
                className={`w-full rounded-full h-3 ${
                  theme === 'day-mode' ? 'bg-gray-200' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`h-3 rounded-full transition-all ${
                    existingContent.length >= 5
                      ? 'bg-emerald-600'
                      : existingContent.length >= 3
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(existingContent.length / 5, 1) * 100}%` }}
                />
              </div>
              {templateAppliedMessage && (
                <div
                  className={`mt-4 px-4 py-3 rounded-lg text-sm ${
                    theme === 'day-mode'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-emerald-900/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {templateAppliedMessage}
                </div>
              )}
              {qualityCheckInfo && (
                <div
                  className={`mt-4 px-4 py-3 rounded-lg border ${
                    qualityCheckInfo.status === 'approved'
                      ? theme === 'day-mode'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-emerald-900/20 text-emerald-300 border-emerald-500/40'
                      : qualityCheckInfo.status === 'rejected'
                      ? theme === 'day-mode'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-red-900/20 text-red-300 border-red-500/40'
                      : theme === 'day-mode'
                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      : 'bg-yellow-900/20 text-yellow-300 border-yellow-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <i className={`fas ${
                          qualityCheckInfo.status === 'approved'
                            ? 'fa-check-circle'
                            : qualityCheckInfo.status === 'rejected'
                            ? 'fa-times-circle'
                            : 'fa-clock'
                        } mr-2`}></i>
                        <strong className="text-sm font-semibold">
                          Quality Check {qualityCheckInfo.status === 'approved' ? 'Passed' : qualityCheckInfo.status === 'rejected' ? 'Failed' : 'In Progress'}
                        </strong>
                      </div>
                      {qualityCheckInfo.status === 'approved' && qualityCheckInfo.scores && (
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-medium">Originality:</span> {qualityCheckInfo.scores.originality}/100
                            </div>
                            <div>
                              <span className="font-medium">Difficulty Alignment:</span> {qualityCheckInfo.scores.difficultyAlignment}/100
                            </div>
                            <div>
                              <span className="font-medium">Consistency:</span> {qualityCheckInfo.scores.consistency}/100
                            </div>
                            <div>
                              <span className="font-medium">Overall:</span> {qualityCheckInfo.scores.overall}/100
                            </div>
                          </div>
                          {qualityCheckInfo.feedback && (
                            <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                              <span className="font-medium">Feedback:</span> {qualityCheckInfo.feedback}
                            </div>
                          )}
                        </div>
                      )}
                      {qualityCheckInfo.status === 'rejected' && qualityCheckInfo.feedback && (
                        <div className="mt-2 text-xs">
                          <span className="font-medium">Reason:</span> {qualityCheckInfo.feedback}
                        </div>
                      )}
                      {qualityCheckInfo.status === 'pending' && (
                        <div className="mt-2 text-xs">
                          {qualityCheckInfo.message || 'Quality check is being performed. Please refresh to see results.'}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setQualityCheckInfo(null)}
                      className={`ml-2 text-sm ${
                        theme === 'day-mode' ? 'text-gray-500 hover:text-gray-700' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </div>
              )}
              {topicDetails?.template_id ? (
                <div
                  className={`mt-4 p-4 rounded-lg border ${
                    theme === 'day-mode'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-emerald-500/40 bg-emerald-900/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
                        Template Applied
                      </p>
                      <p className="text-lg font-bold">
                        {topicDetails.template_name || 'Selected Template'}
                      </p>
                    </div>
                    <button
                      onClick={() => setTemplateModalOpen(true)}
                      className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
                    >
                      Change Template
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(topicDetails.template_format_order || []).map((format, index) => (
                      <span
                        key={`${format}-${index}`}
                        className="px-3 py-1 rounded-full bg-white/70 text-emerald-700 text-xs font-medium border border-emerald-200 dark:bg-slate-900/60 dark:text-emerald-300"
                      >
                        <span className="opacity-60 mr-1">{index + 1}.</span>
                        {format.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Content Types Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CONTENT_TYPES.map(type => {
                const content = getContentByType(type);
                const hasContent = !!content;

                return (
                  <div
                    key={type.id}
                    className={`p-6 rounded-2xl shadow-lg border-2 transition-all ${getColorClasses(
                      type.color,
                      hasContent
                    )}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <i className={`fas ${type.icon} text-2xl mr-3`}></i>
                        <h3 className="text-lg font-semibold">{type.name}</h3>
                      </div>
                      {hasContent && (
                        <span className="px-2 py-1 bg-emerald-600 text-white text-xs rounded-full">
                          Created
                        </span>
                      )}
                    </div>

                    {hasContent ? (
                      <div className="space-y-3">
                        <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
                          Created: {new Date(content.created_at).toLocaleDateString()}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/topics/${topicId}/content/view`, {
                              state: { content }
                            })}
                            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                          >
                            <i className="fas fa-eye mr-1"></i>
                            View
                          </button>
                          <button
                            onClick={() => handleRegenerate(type, content)}
                            className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm"
                          >
                            <i className="fas fa-sync mr-1"></i>
                            Regenerate
                          </button>
                          <button
                            onClick={() => handleDelete(content.content_id)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-500'}`}>
                          Not created yet
                        </p>
                        {type.allowManual ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/topics/${topicId}/content/ai-generate`, {
                                state: { contentType: type.id }
                              })}
                              className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                            >
                              <i className="fas fa-robot mr-1"></i>
                              AI
                            </button>
                            <button
                              onClick={() => navigate(`/topics/${topicId}/content/manual-create`, {
                                state: { contentType: type.id, contentTypeId: type.dbId }
                              })}
                              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                            >
                              <i className="fas fa-edit mr-1"></i>
                              Manual
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => navigate(`/topics/${topicId}/content/ai-generate`, {
                              state: { contentType: type.id }
                            })}
                            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                          >
                            <i className="fas fa-robot mr-1"></i>
                            Create with AI
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasAllFormats && !topicDetails?.template_id && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    setTemplateAppliedMessage(null);
                    setTemplateModalOpen(true);
                  }}
                  className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-lg font-semibold shadow-lg"
                >
                  <i className="fas fa-layer-group mr-2"></i>
                  Choose Template
                </button>
              </div>
            )}

            {/* View Lesson Button */}
            {existingContent.length > 0 && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => navigate(`/lessons/${topicId}/view`)}
                  className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-lg font-semibold shadow-lg"
                >
                  <i className="fas fa-eye mr-2"></i>
                  View Complete Lesson
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 lg:mt-0 lg:w-[360px] lg:ml-auto">
            <ContentHistorySidebar
              existingContent={existingContent}
              onHistoryChanged={fetchContent}
            />
          </div>
        </div>

        <TemplateSelectionModal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          topicId={parseInt(topicId)}
          onApplied={handleTemplateApplied}
          trainerId={trainerId}
          hasAvatarVideo={hasAvatarVideo}
        />

        <RegenerateOptionsModal
          open={!!regenerateTarget}
          onClose={() => setRegenerateTarget(null)}
          onSelect={handleRegenerateSelection}
          contentType={regenerateTarget?.type}
        />
      </div>
    </div>
  );
}
