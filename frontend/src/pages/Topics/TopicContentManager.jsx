import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { contentService } from '../../services/content.js';
import { topicsService } from '../../services/topics.js';
import { useApp } from '../../context/AppContext';
import { TemplateSelectionModal } from '../../components/Templates/TemplateSelectionModal.jsx';
import { RegenerateOptionsModal } from '../../components/Content/RegenerateOptionsModal.jsx';
import { ContentHistorySidebar } from '../../components/Content/ContentHistorySidebar.jsx';
import { VideoUploadModal } from '../../components/VideoUploadModal.jsx';

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
  const [videoUploadModalOpen, setVideoUploadModalOpen] = useState(false);

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

  const [contentGenerationLoading, setContentGenerationLoading] = useState(false);
  const [currentGenerationStep, setCurrentGenerationStep] = useState(null);
  const [generationProgress, setGenerationProgress] = useState([]);

  const handleVideoTranscriptionComplete = async ({ transcript, source, videoType, progress_events, content_formats, topic_id }) => {
    // If content generation already completed (content_formats exists), just refresh the content
    if (content_formats && Object.keys(content_formats).length > 0) {
      setContentGenerationLoading(false);
      setCurrentGenerationStep(null);
      setGenerationProgress([]);
      // Refresh content to show newly generated formats
      await fetchContent();
      // Show success message
      alert(`Successfully generated ${Object.keys(content_formats).length} content formats!`);
      return;
    }

    // If transcription only (no content generation), show message and refresh
    if (transcript) {
      setContentGenerationLoading(false);
      setCurrentGenerationStep(null);
      setGenerationProgress([]);
      // Refresh content in case something was generated
      await fetchContent();
      // Show message
      alert('Video transcribed successfully. Content generation may still be in progress.');
      return;
    }

    // If we have progress events but no content yet, show loading state
    if (progress_events && progress_events.length > 0) {
      setContentGenerationLoading(true);
      setGenerationProgress(progress_events);
      const lastEvent = progress_events[progress_events.length - 1];
      setCurrentGenerationStep(lastEvent.message);
      
      // Poll for completion (refresh content periodically)
      const pollInterval = setInterval(async () => {
        try {
          await fetchContent();
          // Check if we have all formats now
          const updatedContent = await contentService.listByTopic(parseInt(topicId));
          if (updatedContent && updatedContent.length >= 6) {
            // All formats generated
            clearInterval(pollInterval);
            setContentGenerationLoading(false);
            setCurrentGenerationStep(null);
            setGenerationProgress([]);
            alert('All content formats generated successfully!');
          }
        } catch (error) {
          console.error('Failed to poll for content:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Clear polling after 2 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        setContentGenerationLoading(false);
        setCurrentGenerationStep(null);
      }, 120000);
    }
  };

  const handleTemplateApplied = async (templateId, templateData) => {
    await fetchTopicDetails();
    await fetchContent();
    setTemplateAppliedMessage(
      `Template "${templateData?.template_name || templateId}" applied successfully.`
    );
  };

  return (
    <div className={`min-h-screen p-6 lg:p-8 ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'}`}>
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

          {/* Topic Information Banner */}
          {topicDetails && (
            <div
              className={`mb-6 p-4 rounded-xl border ${
                theme === 'day-mode'
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-emerald-900/20 border-emerald-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <i className={`fas fa-book text-xl ${
                    theme === 'day-mode' ? 'text-emerald-600' : 'text-emerald-400'
                  }`}></i>
                </div>
                <div className="flex-1">
                  <h2
                    className={`font-bold text-xl mb-1 ${
                      theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    {topicDetails.topic_name || 'Untitled Topic'}
                  </h2>
                  {topicDetails.description && (
                    <p
                      className={`text-sm ${
                        theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                      }`}
                    >
                      {topicDetails.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

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

        {/* Content Generation Loading Spinner */}
        {contentGenerationLoading && (
          <div
            className={`mb-6 p-6 rounded-2xl border-2 ${
              theme === 'day-mode'
                ? 'bg-blue-50 border-blue-200'
                : 'bg-blue-900/20 border-blue-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="relative w-12 h-12 mr-4">
                  <div className={`absolute inset-0 border-4 border-transparent rounded-full animate-spin ${
                    theme === 'day-mode' ? 'border-t-blue-600' : 'border-t-blue-400'
                  }`}></div>
                </div>
                <div>
                  <h3
                    className={`text-lg font-semibold mb-1 ${
                      theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    Generating Content Formats...
                  </h3>
                  {currentGenerationStep && (
                    <p
                      className={`text-sm ${
                        theme === 'day-mode' ? 'text-gray-600' : 'text-gray-300'
                      }`}
                    >
                      {currentGenerationStep}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Progress Events List */}
            {generationProgress.length > 0 && (
              <div className="mt-4 space-y-2">
                {generationProgress.map((event, index) => (
                  <div
                    key={index}
                    className={`flex items-center text-sm ${
                      theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    <i
                      className={`fas mr-2 ${
                        event.status === 'completed'
                          ? 'fa-check-circle text-emerald-600'
                          : event.status === 'failed'
                          ? 'fa-times-circle text-red-600'
                          : 'fa-spinner fa-spin text-blue-600'
                      }`}
                    ></i>
                    <span>{event.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="lg:flex lg:items-start lg:gap-6">
          <div className="mt-8 lg:mt-0 lg:w-[280px] lg:flex-shrink-0 order-2 lg:order-1 lg:sticky lg:top-8">
            <ContentHistorySidebar
              existingContent={existingContent}
              onHistoryChanged={fetchContent}
            />
          </div>

          <div className="flex-1 min-w-0 order-1 lg:order-2 lg:max-w-[calc(100%-304px)]">
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
                        <div className="mt-2 space-y-2 text-xs">
                          <div className={`p-2 rounded ${
                            theme === 'day-mode' ? 'bg-emerald-100' : 'bg-emerald-800/30'
                          }`}>
                            <p className="font-semibold mb-1">
                              <i className="fas fa-check-circle mr-1"></i>
                              Your content is relevant and approved!
                            </p>
                            <p className="text-xs opacity-90">
                              Your content passed all quality checks. Audio has been generated and your content is ready to use.
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className={`p-2 rounded ${
                              theme === 'day-mode' ? 'bg-white' : 'bg-gray-700/50'
                            }`}>
                              <div className="font-medium mb-1">Relevance to Topic</div>
                              <div className="text-lg font-bold">{qualityCheckInfo.scores.relevance || 'N/A'}/100</div>
                              <div className="text-xs opacity-75 mt-1">
                                {qualityCheckInfo.scores.relevance && qualityCheckInfo.scores.relevance >= 80 ? 'Highly relevant' : 
                                 qualityCheckInfo.scores.relevance && qualityCheckInfo.scores.relevance >= 60 ? 'Relevant' : 'Not relevant'}
                              </div>
                            </div>
                            <div className={`p-2 rounded ${
                              theme === 'day-mode' ? 'bg-white' : 'bg-gray-700/50'
                            }`}>
                              <div className="font-medium mb-1">Originality</div>
                              <div className="text-lg font-bold">{qualityCheckInfo.scores.originality}/100</div>
                              <div className="text-xs opacity-75 mt-1">
                                {qualityCheckInfo.scores.originality >= 80 ? 'Excellent - Unique content' : 
                                 qualityCheckInfo.scores.originality >= 60 ? 'Good - Original work' : 'Needs improvement'}
                              </div>
                            </div>
                            <div className={`p-2 rounded ${
                              theme === 'day-mode' ? 'bg-white' : 'bg-gray-700/50'
                            }`}>
                              <div className="font-medium mb-1">Difficulty Match</div>
                              <div className="text-lg font-bold">{qualityCheckInfo.scores.difficultyAlignment}/100</div>
                              <div className="text-xs opacity-75 mt-1">
                                {qualityCheckInfo.scores.difficultyAlignment >= 80 ? 'Perfect match' : 
                                 qualityCheckInfo.scores.difficultyAlignment >= 60 ? 'Good alignment' : 'Needs adjustment'}
                              </div>
                            </div>
                            <div className={`p-2 rounded ${
                              theme === 'day-mode' ? 'bg-white' : 'bg-gray-700/50'
                            }`}>
                              <div className="font-medium mb-1">Consistency</div>
                              <div className="text-lg font-bold">{qualityCheckInfo.scores.consistency}/100</div>
                              <div className="text-xs opacity-75 mt-1">
                                {qualityCheckInfo.scores.consistency >= 80 ? 'Well structured' : 
                                 qualityCheckInfo.scores.consistency >= 60 ? 'Good structure' : 'Needs improvement'}
                              </div>
                            </div>
                            <div className={`p-2 rounded col-span-2 ${
                              theme === 'day-mode' ? 'bg-white' : 'bg-gray-700/50'
                            }`}>
                              <div className="font-medium mb-1">Overall Score</div>
                              <div className="text-lg font-bold">{qualityCheckInfo.scores.overall}/100</div>
                              <div className="text-xs opacity-75 mt-1">
                                {qualityCheckInfo.scores.overall >= 80 ? 'Excellent quality' : 
                                 qualityCheckInfo.scores.overall >= 60 ? 'Good quality' : 'Acceptable'}
                              </div>
                            </div>
                          </div>
                          {qualityCheckInfo.feedback && (
                            <div className={`mt-2 pt-2 border-t ${
                              theme === 'day-mode' ? 'border-emerald-200' : 'border-emerald-500/30'
                            }`}>
                              <span className="font-medium">Detailed Feedback:</span>
                              <p className="mt-1 opacity-90">{qualityCheckInfo.feedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {qualityCheckInfo.status === 'rejected' && qualityCheckInfo.feedback && (
                        <div className="mt-2 space-y-2 text-xs">
                          <div className={`p-3 rounded ${
                            theme === 'day-mode' ? 'bg-red-100 border border-red-300' : 'bg-red-800/30 border border-red-500/40'
                          }`}>
                            <p className="font-semibold mb-2">
                              <i className="fas fa-exclamation-triangle mr-1"></i>
                              Content Rejected - Not Relevant
                            </p>
                            <p className="mb-2">
                              Your content did not meet the quality standards. Please review the feedback below and revise your content.
                            </p>
                            <div className={`p-2 rounded ${
                              theme === 'day-mode' ? 'bg-white' : 'bg-gray-700/50'
                            }`}>
                              <span className="font-medium">Rejection Reason:</span>
                              <p className="mt-1">{qualityCheckInfo.feedback}</p>
                            </div>
                            <p className="mt-2 text-xs opacity-90">
                              <strong>What to do:</strong> Review your content and ensure it is original, matches the difficulty level, and is well-structured. You can edit and resubmit.
                            </p>
                          </div>
                        </div>
                      )}
                      {qualityCheckInfo.status === 'pending' && (
                        <div className="mt-2 space-y-2 text-xs">
                          <div className={`p-3 rounded ${
                            theme === 'day-mode' ? 'bg-yellow-100 border border-yellow-300' : 'bg-yellow-800/30 border border-yellow-500/40'
                          }`}>
                            <p className="font-semibold mb-1">
                              <i className="fas fa-spinner fa-spin mr-1"></i>
                              Quality Check In Progress
                            </p>
                            <p className="opacity-90">
                              {qualityCheckInfo.message || 'Your content is being evaluated for originality, difficulty alignment, and consistency. This may take a few moments...'}
                            </p>
                            <p className="mt-2 text-xs opacity-75">
                              <i className="fas fa-info-circle mr-1"></i>
                              Audio generation will start automatically once quality check passes.
                            </p>
                          </div>
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
                        className="px-3 py-1 rounded-full bg-white/70 text-emerald-700 text-xs font-medium border border-emerald-200 dark:bg-[#334155]/60 dark:text-emerald-300"
                      >
                        <span className="opacity-60 mr-1">{index + 1}.</span>
                        {format.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Video Upload Banner */}
            <div
              className={`mb-8 p-6 rounded-2xl border-2 ${
                theme === 'day-mode'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-blue-900/20 border-blue-500/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <i className="fas fa-video text-2xl mr-3 text-blue-600 dark:text-blue-400"></i>
                    <h3
                      className={`text-xl font-semibold ${
                        theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                      }`}
                    >
                      🎥 Upload a Lesson Video (Optional)
                    </h3>
                  </div>
                  <p
                    className={`text-sm leading-relaxed mb-4 ${
                      theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    You can upload your lesson video (from your computer or a YouTube link), and
                    Content Studio will automatically transcribe it and generate all six lesson
                    formats for you — Text, Audio, Slides, Mind-Map, Code Examples, and Avatar
                    Video.
                  </p>
                  <p
                    className={`text-xs italic ${
                      theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    This step is completely optional. You can still create each content format
                    manually or using AI, just like before.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setVideoUploadModalOpen(true)}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    theme === 'day-mode'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <i className="fas fa-upload mr-2"></i>
                  Upload Video
                </button>
              </div>
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

        <VideoUploadModal
          open={videoUploadModalOpen}
          onClose={() => setVideoUploadModalOpen(false)}
          topicId={parseInt(topicId)}
          theme={theme}
          onTranscriptionComplete={handleVideoTranscriptionComplete}
        />
      </div>
    </div>
  );
}
