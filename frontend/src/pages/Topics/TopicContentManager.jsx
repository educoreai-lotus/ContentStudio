import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { contentService } from '../../services/content.js';
import { topicsService } from '../../services/topics.js';
import { useApp } from '../../context/AppContext';
import { TemplateSelectionModal } from '../../components/Templates/TemplateSelectionModal.jsx';
import { RegenerateOptionsModal } from '../../components/Content/RegenerateOptionsModal.jsx';
import { VideoUploadModal } from '../../components/VideoUploadModal.jsx';
import ExerciseCreationModal from '../../components/Exercises/ExerciseCreationModal.jsx';
import { templateApplicationService } from '../../services/template-application';
import { MindMapViewer } from '../../components/MindMapViewer.jsx';

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
  const [aiFeedback, setAiFeedback] = useState(null);
  const [regenerateTarget, setRegenerateTarget] = useState(null);
  const [qualityCheckInfo, setQualityCheckInfo] = useState(null);
  const [videoUploadModalOpen, setVideoUploadModalOpen] = useState(false);
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [lessonView, setLessonView] = useState(null);
  const [loadingLessonView, setLoadingLessonView] = useState(false);

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

  // Listen for restore events to refresh data
  useEffect(() => {
    const handleContentRestored = (event) => {
      const { type, topicId: restoredTopicId, id } = event.detail;
      // Refresh if content was restored for this topic
      if (type === 'content' && restoredTopicId === parseInt(topicId)) {
        console.log('[TopicContentManager] Content restored, refreshing data');
        fetchContent();
        fetchTopicDetails();
      } else if (type === 'topics' && (restoredTopicId === parseInt(topicId) || id === parseInt(topicId))) {
        console.log('[TopicContentManager] Topic restored, refreshing data');
        fetchTopicDetails();
      }
    };

    window.addEventListener('contentRestored', handleContentRestored);
    return () => {
      window.removeEventListener('contentRestored', handleContentRestored);
    };
  }, [topicId]);

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
      const response = await topicsService.getById(parseInt(topicId));
      // API returns TopicResponseDTO directly, or wrapped in {data: ...} or {topic: ...}
      const topicData = response.topic || response.data || response;
      console.log('[TopicContentManager] Fetched topic data:', topicData);
      // Ensure we have the correct structure
      if (topicData && topicData.topic_name) {
        setTopicDetails(topicData);
        
        // If topic is archived, load lesson view for read-only display
        if (topicData.status === 'archived') {
          await loadLessonView();
        }
      } else {
        console.warn('[TopicContentManager] Invalid topic data structure:', topicData);
      }
    } catch (err) {
      console.warn('Failed to fetch topic details', err);
    }
  };

  const loadLessonView = async () => {
    try {
      setLoadingLessonView(true);
      const viewData = await templateApplicationService.getLessonView(topicId);
      setLessonView(viewData);
    } catch (err) {
      console.error('Failed to load lesson view:', err);
      // Don't set error - just log it, as this is optional for archived topics
    } finally {
      setLoadingLessonView(false);
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
        : 'bg-[#1e293b] border-[#334155] text-[#94a3b8]';
    }

    const colors = {
      blue: theme === 'day-mode'
        ? 'bg-blue-50 border-blue-300 text-blue-700'
        : 'bg-[#1e293b] border-[#334155] text-[#f8fafc]',
      green: theme === 'day-mode'
        ? 'bg-green-50 border-green-300 text-green-700'
        : 'bg-[#1e293b] border-[#334155] text-[#f8fafc]',
      purple: theme === 'day-mode'
        ? 'bg-purple-50 border-purple-300 text-purple-700'
        : 'bg-[#1e293b] border-[#334155] text-[#f8fafc]',
      red: theme === 'day-mode'
        ? 'bg-red-50 border-red-300 text-red-700'
        : 'bg-[#1e293b] border-[#334155] text-[#f8fafc]',
      yellow: theme === 'day-mode'
        ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
        : 'bg-[#1e293b] border-[#334155] text-[#f8fafc]',
      indigo: theme === 'day-mode'
        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
        : 'bg-[#1e293b] border-[#334155] text-[#f8fafc]',
    };

    return colors[color] || colors.blue;
  };

  const trainerId = useMemo(() => {
    if (topicDetails?.trainer_id) return topicDetails.trainer_id;
    return undefined;
  }, [topicDetails]);

  // Check if all required formats from template are ready
  const checkAllFormatsReady = useMemo(() => {
    if (!topicDetails?.template_format_order || topicDetails.template_format_order.length === 0) {
      // If no template is applied, check if we have at least 5 formats (legacy check)
      return existingContent.length >= 5;
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
    const requiredFormats = topicDetails.template_format_order || [];
    const readyFormats = requiredFormats.filter(format => {
      const typeId = formatToTypeId[format] || formatToTypeId[format.replace('_', '')];
      return existingContent.some(content => content.content_type_id === typeId);
    });

    return readyFormats.length === requiredFormats.length;
  }, [topicDetails?.template_format_order, existingContent]);

  const hasAllFormats = checkAllFormatsReady;
  const hasAvatarVideo = existingContent.some(
    content => content.content_type_id === CONTENT_TYPES.find(t => t.id === 'avatar_video')?.dbId
  );

  // Check if topic has DevLab exercises
  const hasExercises = useMemo(() => {
    if (!topicDetails?.devlab_exercises) {
      return false;
    }
    // devlab_exercises can be a JSON string or an object with structure: { html: "...", questions: [...], metadata: {...} }
    try {
      const exercises = typeof topicDetails.devlab_exercises === 'string'
        ? JSON.parse(topicDetails.devlab_exercises)
        : topicDetails.devlab_exercises;
      
      // If it's an array (legacy format), check if it has items
      if (Array.isArray(exercises)) {
        return exercises.length > 0;
      }
      
      // If it's an object, check the structure: { html: "...", questions: [...], metadata: {...} }
      if (typeof exercises === 'object' && exercises !== null) {
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
    } catch {
      return false;
    }
  }, [topicDetails?.devlab_exercises]);

  // For standalone lessons: check if ready (all formats + template + exercises)
  const isStandaloneReady = useMemo(() => {
    if (topicDetails?.course_id !== null) {
      return false; // Not a standalone lesson
    }
    return hasAllFormats && topicDetails?.template_id && hasExercises;
  }, [hasAllFormats, topicDetails?.template_id, topicDetails?.course_id, hasExercises]);

  // Get missing formats for display
  const getMissingFormats = useMemo(() => {
    if (!topicDetails?.template_format_order || topicDetails.template_format_order.length === 0) {
      return [];
    }

    const formatToTypeId = {
      'text': 1,
      'text_audio': 1,
      'audio': 1,
      'code': 2,
      'presentation': 3,
      'mind_map': 5,
      'avatar_video': 6,
    };

    const requiredFormats = topicDetails.template_format_order || [];
    return requiredFormats.filter(format => {
      const typeId = formatToTypeId[format] || formatToTypeId[format.replace('_', '')];
      return !existingContent.some(content => content.content_type_id === typeId);
    });
  }, [topicDetails?.template_format_order, existingContent]);

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

  const handleTemplateApplied = async (templateId, templateData, aiFeedbackData) => {
    await fetchTopicDetails();
    await fetchContent();
    setTemplateAppliedMessage(
      `Template "${templateData?.template_name || templateId}" applied successfully.`
    );
    
    // Show AI feedback if available
    if (aiFeedbackData) {
      setAiFeedback(aiFeedbackData);
      // Auto-hide after 10 seconds
      setTimeout(() => {
        setAiFeedback(null);
      }, 10000);
    }
  };

  const handlePublishStandalone = async () => {
    if (!window.confirm('Are you sure you want to mark this lesson as archived?\n\nThe lesson will be available for use in personalized courses when Course Builder requests content.')) {
      return;
    }

    setPublishing(true);
    setPublishError(null);
    setPublishSuccess(false);

    try {
      // Only update status to 'archived' - do NOT send to Course Builder
      // Course Builder will request this lesson when needed through the hierarchical search
      await topicsService.update(parseInt(topicId), { status: 'archived' });
      setPublishSuccess(true);
      
      // Refresh topic details to get updated status
      await fetchTopicDetails();
      
      // Show success message
      setTimeout(() => {
        setPublishSuccess(false);
      }, 5000);
    } catch (err) {
      setPublishError(err.error?.message || err.message || 'Failed to mark lesson as archived');
    } finally {
      setPublishing(false);
    }
  };

  // Render functions for archived lessons (read-only view)
  const renderTextContent = (contentData, audioFirst = false) => {
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        parsedData = { text: contentData };
      }
    }
    if (!parsedData || typeof parsedData !== 'object') {
      parsedData = { text: String(contentData || '') };
    }
    const textValue = parsedData?.text || parsedData?.content || '';
    const hasAudio = !!parsedData?.audioUrl;
    if (!textValue || textValue.trim() === '') {
      return (
        <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-50 border border-gray-200' : 'bg-[#334155] border border-white/10'}`}>
          <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>No text content available</p>
        </div>
      );
    }
    const renderAudioSection = () => {
      if (!hasAudio) return null;
      return (
        <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
          <div className="flex items-center gap-3 mb-3">
            <i className="fas fa-volume-up text-blue-600 text-xl"></i>
            <h4 className={`font-semibold ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>Audio Narration</h4>
            {parsedData?.audioDuration && <span className={`text-sm ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>({Math.round(parsedData.audioDuration)}s)</span>}
          </div>
          <audio controls className="w-full" style={{ maxWidth: '100%' }}>
            <source src={parsedData.audioUrl} type={`audio/${parsedData.audioFormat || 'mp3'}`} />
            Your browser does not support the audio element.
          </audio>
          {parsedData?.audioVoice && <p className={`text-xs mt-2 ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>Voice: {parsedData.audioVoice}</p>}
        </div>
      );
    };
    return (
      <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-50 border border-gray-200' : 'bg-gray-900 border border-gray-700'}`}>
        {audioFirst && renderAudioSection()}
        <div className={`whitespace-pre-wrap font-sans ${theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'}`}>{textValue}</div>
        {!audioFirst && hasAudio && <div className="mt-4">{renderAudioSection()}</div>}
      </div>
    );
  };

  const renderCodeContent = contentData => {
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        parsedData = { code: contentData };
      }
    }
    const codeValue = parsedData?.code || '';
    return (
      <div className="space-y-4">
        {codeValue ? (
          <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-900' : 'bg-[#0f172a]'}`}>
            <pre className="text-green-400 font-mono text-sm overflow-x-auto">{codeValue}</pre>
          </div>
        ) : (
          <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#334155]'}`}>
            <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>No code content available</p>
          </div>
        )}
        {parsedData?.explanation && (
          <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#334155]'}`}>
            <p className={theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'}>{parsedData.explanation}</p>
          </div>
        )}
      </div>
    );
  };

  const renderPresentationContent = contentData => {
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        parsedData = {};
      }
    }
    const presentationUrl = parsedData?.presentationUrl || parsedData?.googleSlidesUrl || parsedData?.fileUrl;
    const presentation = parsedData?.presentation;
    const gammaUrl = parsedData?.metadata?.gamma_raw_response?.result?.gammaUrl || parsedData?.metadata?.gamma_raw_response?.gammaUrl || parsedData?.gamma_raw_response?.result?.gammaUrl || parsedData?.gamma_raw_response?.gammaUrl || parsedData?.gammaUrl;
    
    // Detect file format: check exportFormat field, then URL extension, default to PPTX
    const exportFormat = parsedData?.exportFormat || 
                         (presentationUrl?.toLowerCase().endsWith('.pdf') ? 'pdf' : null) ||
                         (presentationUrl?.toLowerCase().endsWith('.pptx') ? 'pptx' : null) ||
                         'pptx'; // Default to PPTX for backward compatibility
    const fileFormatLabel = exportFormat.toUpperCase();
    const fileFormatIcon = exportFormat === 'pdf' ? 'fa-file-pdf' : 'fa-file-powerpoint';
    
    return (
      <div className={`p-6 rounded-lg border-2 border-dashed ${theme === 'day-mode' ? 'bg-purple-50 border-purple-300' : 'bg-purple-900/20 border-purple-500/30'}`}>
        <div className="flex items-center justify-center mb-4">
          <i className={`fas ${fileFormatIcon} text-6xl ${exportFormat === 'pdf' ? 'text-red-600' : 'text-purple-600'}`}></i>
        </div>
        <div className="text-center space-y-2">
          <h3 className={`text-lg font-semibold ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>{presentation?.title || parsedData?.fileName || 'Presentation File'}</h3>
          {parsedData?.slide_count && <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>{parsedData.slide_count} slides</p>}
          {(gammaUrl || presentationUrl) && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {gammaUrl && (
                  <a href={gammaUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    <i className="fas fa-external-link-alt mr-2"></i>View Presentation
                  </a>
                )}
                {presentationUrl && (
                  <a href={presentationUrl} target="_blank" rel="noopener noreferrer" download className="inline-block px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
                    <i className="fas fa-download mr-2"></i>Download {fileFormatLabel}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMindMapContent = contentData => {
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        parsedData = {};
      }
    }
    return (
      <div className="space-y-6">
        {parsedData?.nodes && parsedData?.edges ? (
          <div>
            <h4 className={`font-semibold mb-4 text-lg ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>
              <i className="fas fa-project-diagram mr-2 text-purple-600"></i>Mind Map Visualization
            </h4>
            <MindMapViewer data={parsedData} />
          </div>
        ) : (
          <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#334155]'}`}>
            <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>No mind map data available</p>
          </div>
        )}
        {parsedData?.imageUrl && (
          <div className="text-center">
            <img src={parsedData.imageUrl} alt="Mind Map" className="max-w-full h-auto rounded-lg shadow-lg mx-auto" />
          </div>
        )}
      </div>
    );
  };

  const renderAvatarVideoContent = contentData => {
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        parsedData = {};
      }
    }
    const videoUrl = parsedData?.videoUrl || parsedData?.storageUrl || parsedData?.metadata?.heygen_video_url || parsedData?.heygen_video_url || parsedData?.metadata?.heygenVideoUrl || parsedData?.heygenVideoUrl;
    return (
      <div className="space-y-4">
        {parsedData?.script && (
          <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#334155]'}`}>
            <h4 className={`font-semibold mb-2 ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>Video Script</h4>
            <div className={`whitespace-pre-wrap font-sans ${theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'}`}>{parsedData.script}</div>
          </div>
        )}
        {videoUrl ? (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${theme === 'day-mode' ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
              <i className="fas fa-video text-blue-600"></i>
              <span className={`text-sm font-medium ${theme === 'day-mode' ? 'text-blue-900' : 'text-blue-300'}`}>Avatar Video</span>
            </div>
            <div className="relative rounded-lg overflow-hidden shadow-2xl bg-black">
              <video src={videoUrl} controls className="w-full h-auto" style={{ maxHeight: '500px' }}>Your browser does not support the video tag.</video>
            </div>
            {parsedData?.videoId && <div className={`text-xs text-center ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>Video ID: {parsedData.videoId}</div>}
            {parsedData?.duration_seconds && <div className={`text-xs text-center ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>Duration: {Math.round(parsedData.duration_seconds)}s</div>}
          </div>
        ) : parsedData?.videoId ? (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${theme === 'day-mode' ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
              <i className="fas fa-video text-blue-600"></i>
              <span className={`text-sm font-medium ${theme === 'day-mode' ? 'text-blue-900' : 'text-blue-300'}`}>Avatar Video</span>
            </div>
            <div className="text-center p-4">
              <a href={`https://app.heygen.com/share/${parsedData.videoId}`} target="_blank" rel="noopener noreferrer" className={`inline-block px-6 py-3 rounded-lg ${theme === 'day-mode' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                <i className="fas fa-external-link-alt mr-2"></i>View Video on Heygen
              </a>
            </div>
          </div>
        ) : (
          <div className={`p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#334155]'}`}>
            <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>No video content available</p>
          </div>
        )}
      </div>
    );
  };

  const renderContentItem = (formatType, contentItem, index, formatItem = null) => {
    let contentData = contentItem.content_data || contentItem;
    if (typeof contentData === 'string') {
      try {
        contentData = JSON.parse(contentData);
      } catch (e) {
        console.warn('Failed to parse content_data:', e);
      }
    }
    if (!contentData || typeof contentData !== 'object') {
      contentData = {};
    }
    switch (formatType) {
      case 'text':
      case 'text_audio':
      case 'text_audio_combined':
        const audioFirst = formatItem?.audioFirst || false;
        return <div key={contentItem.content_id || `text-${index}`} className="space-y-4">{renderTextContent(contentData, audioFirst)}</div>;
      case 'audio_text':
        return <div key={contentItem.content_id || `audio-text-${index}`} className="space-y-4">{renderTextContent(contentData, true)}</div>;
      case 'code':
        return <div key={contentItem.content_id || `code-${index}`}>{renderCodeContent(contentData)}</div>;
      case 'presentation':
        return <div key={contentItem.content_id || `presentation-${index}`}>{renderPresentationContent(contentData)}</div>;
      case 'mind_map':
        return <div key={contentItem.content_id || `mindmap-${index}`}>{renderMindMapContent(contentData)}</div>;
      case 'avatar_video':
        return <div key={contentItem.content_id || `avatar-${index}`}>{renderAvatarVideoContent(contentData)}</div>;
      default:
        if (contentData && typeof contentData === 'object' && contentData.text) {
          return <div key={contentItem.content_id || `unknown-${index}`} className="space-y-4">{renderTextContent(contentData)}</div>;
        }
        return (
          <pre key={contentItem.content_id || `unknown-${index}`} className={`text-sm overflow-x-auto p-4 rounded-lg ${theme === 'day-mode' ? 'bg-gray-100 text-gray-700' : 'bg-gray-800 text-gray-200'}`}>
            {JSON.stringify(contentData, null, 2)}
          </pre>
        );
    }
  };

  // If topic is archived, show read-only view
  if (topicDetails?.status === 'archived') {
    const formatIcons = { text: 'fa-file-alt', code: 'fa-code', presentation: 'fa-presentation', audio: 'fa-volume-up', mind_map: 'fa-project-diagram', avatar_video: 'fa-video' };
    const formatLabels = { text: 'Text & Audio', code: 'Code Example', presentation: 'Presentation', audio: 'Audio Narration', mind_map: 'Mind Map', avatar_video: 'Avatar Video' };
    
    if (loadingLessonView) {
      return (
        <div className={`min-h-screen ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'}`}>
          <div className="max-w-7xl mx-auto p-6 lg:p-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-300'}>Loading archived lesson...</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!lessonView || !lessonView.formats) {
      return (
        <div className={`min-h-screen ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'}`}>
          <div className="max-w-7xl mx-auto p-6 lg:p-8">
            <div className={`mb-6 p-4 rounded-xl border ${theme === 'day-mode' ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-900/20 border-yellow-500/30'}`}>
              <div className="flex items-center gap-3">
                <i className={`fas fa-archive text-xl ${theme === 'day-mode' ? 'text-yellow-600' : 'text-yellow-400'}`}></i>
                <div>
                  <h3 className={`font-semibold ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>This lesson is archived</h3>
                  <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'}`}>Content cannot be edited. This lesson is available for use in personalized courses.</p>
                </div>
              </div>
            </div>
            <div className={`text-center p-8 rounded-lg max-w-md mx-auto ${theme === 'day-mode' ? 'bg-white' : 'bg-gray-800'}`}>
              <i className={`fas fa-info-circle text-4xl mb-4 ${theme === 'day-mode' ? 'text-blue-500' : 'text-blue-400'}`}></i>
              <h2 className={`text-xl font-semibold mb-2 ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>No Template Applied</h2>
              <p className={`mb-4 ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>This archived lesson does not have a template applied.</p>
            </div>
          </div>
        </div>
      );
    }

    const sortedFormats = [...lessonView.formats].sort((a, b) => {
      const orderA = a.display_order !== undefined ? a.display_order : 999;
      const orderB = b.display_order !== undefined ? b.display_order : 999;
      return orderA - orderB;
    });

    const seenContentIds = new Map();
    const deduplicatedFormats = [];
    sortedFormats.forEach((formatItem, formatIndex) => {
      if (formatItem.type === 'audio' && sortedFormats.some(f => f.type === 'text_audio_combined' || f.type === 'audio_text')) {
        return;
      }
      if (!formatItem.content || formatItem.content.length === 0) {
        deduplicatedFormats.push({ ...formatItem, content: [] });
        return;
      }
      const deduplicatedContent = [];
      formatItem.content.forEach(contentItem => {
        const contentId = contentItem.content_id || contentItem.id;
        if (!contentId) {
          deduplicatedContent.push(contentItem);
          return;
        }
        if (seenContentIds.has(contentId)) {
          return;
        }
        seenContentIds.set(contentId, { formatType: formatItem.type, formatIndex, displayOrder: formatItem.display_order ?? formatIndex });
        deduplicatedContent.push(contentItem);
      });
      deduplicatedFormats.push({ ...formatItem, content: deduplicatedContent });
    });

    return (
      <div className={`min-h-screen ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'}`}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-8">
            <button
              onClick={() => {
                if (topicDetails?.course_id) {
                  navigate(`/courses/${topicDetails.course_id}`);
                } else {
                  navigate('/topics?course_id=null');
                }
              }}
              className={`mb-4 flex items-center gap-2 ${theme === 'day-mode' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 hover:text-white'}`}
            >
              <i className="fas fa-arrow-left"></i>
              {topicDetails?.course_id ? 'Back to Course' : 'Back to Standalone Lessons'}
            </button>

            <div className={`mb-6 p-4 rounded-xl border ${theme === 'day-mode' ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-900/20 border-yellow-500/30'}`}>
              <div className="flex items-center gap-3">
                <i className={`fas fa-archive text-xl ${theme === 'day-mode' ? 'text-yellow-600' : 'text-yellow-400'}`}></i>
                <div>
                  <h3 className={`font-semibold ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>This lesson is archived</h3>
                  <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'}`}>Content cannot be edited. This lesson is available for use in personalized courses when Course Builder requests content.</p>
                </div>
              </div>
            </div>

            {lessonView?.topic && (
              <div className={`mb-6 p-4 rounded-xl border ${theme === 'day-mode' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-900/20 border-emerald-500/30'}`}>
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex-shrink-0">
                    <i className={`fas fa-book text-xl ${theme === 'day-mode' ? 'text-emerald-600' : 'text-emerald-400'}`}></i>
                  </div>
                  <div className="flex-1 w-full">
                    <h2 className={`font-bold text-xl mb-1 ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>
                      {lessonView.topic.topic_name || lessonView.topic.name || 'Untitled Topic'}
                    </h2>
                    {(lessonView.topic.description || lessonView.topic.topic_description) && (
                      <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'}`}>
                        {lessonView.topic.description || lessonView.topic.topic_description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <h1 className="text-4xl font-bold mb-2" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Archived Lesson View
            </h1>
            <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>Content organized according to template format order (read-only)</p>
            {lessonView.template && (
              <div className={`mt-4 inline-flex flex-wrap items-center gap-2 px-4 py-2 rounded-lg ${theme === 'day-mode' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-900/20 text-emerald-200 border border-emerald-500/30'}`}>
                <span className="font-semibold">Template: {lessonView.template.template_name}</span>
                <span className="text-xs uppercase tracking-wide opacity-70">{lessonView.template.template_type?.replace(/_/g, ' ')}</span>
              </div>
            )}
          </div>

          <div className="space-y-8">
            {deduplicatedFormats.map((formatItem, index) => {
              if (!formatItem.content || formatItem.content.length === 0) {
                if (formatItem.type === 'audio' && sortedFormats.some(f => f.type === 'text_audio_combined' || f.type === 'audio_text')) {
                  return null;
                }
              }
              const displayType = formatItem.type === 'text_audio_combined' || formatItem.type === 'audio_text' ? 'text' : formatItem.type;
              const displayLabel = formatLabels[displayType] || formatItem.type;
              const displayIcon = formatIcons[displayType] || 'fa-file';
              return (
                <div key={`${formatItem.type}-${index}`} className={`p-6 rounded-lg ${theme === 'day-mode' ? 'bg-white border border-gray-200 shadow-sm' : 'bg-gray-800 border border-gray-700 shadow-lg'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'day-mode' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-900/30 text-emerald-400'}`}>
                      <i className={`fas ${displayIcon}`}></i>
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>{displayLabel}</h3>
                      <p className={`text-sm ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>
                        Step {formatItem.display_order + 1} of {deduplicatedFormats.filter(f => f.content && f.content.length > 0).length}
                      </p>
                    </div>
                  </div>
                  {formatItem.content && formatItem.content.length > 0 ? (
                    <div>{formatItem.content.map((contentItem, itemIndex) => renderContentItem(formatItem.type, contentItem, itemIndex, formatItem))}</div>
                  ) : (
                    <div className={`text-center py-8 ${theme === 'day-mode' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <i className={`fas ${displayIcon} text-3xl mb-2`}></i>
                      <p>No {displayLabel} content available</p>
                    </div>
                  )}
                </div>
              );
            }).filter(item => item !== null)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-[#1e293b]'}`}>
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <button
            onClick={() => {
              if (topicDetails?.course_id) {
                // Topic belongs to a course - navigate back to course
                navigate(`/courses/${topicDetails.course_id}`);
              } else {
                // Standalone topic - navigate back to standalone lessons list
                navigate('/topics?course_id=null');
              }
            }}
            className={`mb-4 px-4 py-2 rounded-lg ${
              theme === 'day-mode'
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            <i className="fas fa-arrow-left mr-2"></i>
            {topicDetails?.course_id ? 'Back to Course' : 'Back to Standalone Lessons'}
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
              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex-shrink-0">
                  <i className={`fas fa-book text-xl ${
                    theme === 'day-mode' ? 'text-emerald-600' : 'text-emerald-400'
                  }`}></i>
                </div>
                <div className="flex-1 w-full">
                  <h2
                    className={`font-bold text-2xl md:text-3xl mb-1 ${
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
              {aiFeedback && (
                <div
                  className={`mt-4 px-4 py-3 rounded-lg border ${
                    theme === 'day-mode'
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-blue-900/20 border-blue-500/30 text-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 mt-1 ${
                      theme === 'day-mode' ? 'text-blue-600' : 'text-blue-400'
                    }`}>
                      <i className="fas fa-lightbulb text-lg"></i>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold mb-1">AI Template Selection Reasoning</p>
                      <p className="text-sm leading-relaxed">{aiFeedback}</p>
                    </div>
                    <button
                      onClick={() => setAiFeedback(null)}
                      className={`flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition ${
                        theme === 'day-mode' ? 'text-blue-600' : 'text-blue-400'
                      }`}
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
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
                    <div className="relative group">
                      <button
                        onClick={() => {
                          if (hasAllFormats) {
                            setTemplateModalOpen(true);
                          }
                        }}
                        disabled={!hasAllFormats}
                        className={`px-3 py-1 text-sm text-white rounded-md transition-all ${
                          !hasAllFormats
                            ? 'opacity-60 cursor-not-allowed bg-gray-400 dark:bg-gray-600'
                            : theme === 'day-mode'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/30'
                        }`}
                        title={!hasAllFormats ? `This button will be active once all content formats are generated. ${getMissingFormats.length > 0 ? `Waiting for: ${getMissingFormats.map(f => f.replace('_', ' ')).join(', ')}` : ''}` : 'Change template'}
                      >
                        Change Template
                      </button>
                      {!hasAllFormats && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 px-3 py-2 text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                          style={{
                            background: theme === 'day-mode' ? '#1f2937' : '#0f172a',
                            color: '#e5e7eb',
                            border: '1px solid rgba(156, 163, 175, 0.3)',
                          }}
                        >
                          This button will be active once all content formats are generated.
                          {getMissingFormats.length > 0 && (
                            <div className="mt-1 text-yellow-300">
                              Waiting for: {getMissingFormats.map(f => f.replace('_', ' ')).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                  className={`px-6 py-3 rounded-lg font-medium text-white transition-all ${
                    theme === 'day-mode'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/30'
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
                        <span className={`px-2 py-1 text-white text-xs rounded-full ${
                          theme === 'day-mode'
                            ? 'bg-emerald-600'
                            : 'bg-gradient-to-r from-[#0d9488] to-[#059669]'
                        }`}>
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
                            className={`flex-1 px-3 py-2 rounded-lg text-sm text-white transition-all ${
                              theme === 'day-mode'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/30'
                            }`}
                          >
                            <i className="fas fa-eye mr-1"></i>
                            View
                          </button>
                          <button
                            onClick={() => handleRegenerate(type, content)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm text-white transition-all ${
                              theme === 'day-mode'
                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/30'
                            }`}
                          >
                            <i className="fas fa-sync mr-1"></i>
                            Regenerate
                          </button>
                          <button
                            onClick={() => handleDelete(content.content_id)}
                            className={`px-3 py-2 rounded-lg text-sm text-white transition-all ${
                              theme === 'day-mode'
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-[#334155] hover:bg-[#475569] border border-[#475569]'
                            }`}
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
                              className={`flex-1 px-3 py-2 text-white rounded-lg text-sm transition-all ${
                                theme === 'day-mode'
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/30'
                              }`}
                            >
                              <i className="fas fa-robot mr-1"></i>
                              AI
                            </button>
                            <button
                              onClick={() => navigate(`/topics/${topicId}/content/manual-create`, {
                                state: { contentType: type.id, contentTypeId: type.dbId }
                              })}
                              className={`flex-1 px-3 py-2 text-white rounded-lg text-sm transition-all ${
                                theme === 'day-mode'
                                  ? 'bg-blue-600 hover:bg-blue-700'
                                  : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/30'
                              }`}
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
                            className={`w-full px-3 py-2 text-white rounded-lg text-sm transition-all ${
                              theme === 'day-mode'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/30'
                            }`}
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

            {/* Template Selection Button - Always visible, disabled until all formats are ready */}
            {!topicDetails?.template_id && (
              <div className="mt-8 text-center">
                <div className="relative inline-block group">
                  <button
                    onClick={() => {
                      if (hasAllFormats) {
                        setTemplateAppliedMessage(null);
                        setTemplateModalOpen(true);
                      }
                    }}
                    disabled={!hasAllFormats}
                    className={`px-8 py-4 text-white rounded-lg text-lg font-semibold transition-all ${
                      hasAllFormats
                        ? theme === 'day-mode'
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg cursor-pointer'
                          : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/40 cursor-pointer'
                        : 'bg-gray-400 dark:bg-gray-600 opacity-60 cursor-not-allowed'
                    }`}
                    title={!hasAllFormats ? `This button will be active once all content formats are generated. ${getMissingFormats.length > 0 ? `Waiting for: ${getMissingFormats.map(f => f.replace('_', ' ')).join(', ')}` : ''}` : 'Choose a template for this lesson'}
                  >
                    <i className="fas fa-layer-group mr-2"></i>
                    Choose Template
                  </button>
                  {!hasAllFormats && (
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 mt-2 w-64 px-3 py-2 text-xs rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10"
                      style={{
                        background: theme === 'day-mode' ? '#1f2937' : '#0f172a',
                        color: '#e5e7eb',
                        border: '1px solid rgba(156, 163, 175, 0.3)',
                      }}
                    >
                      This button will be active once all content formats are generated.
                      {getMissingFormats.length > 0 && (
                        <div className="mt-1 text-yellow-300">
                          Waiting for: {getMissingFormats.map(f => f.replace('_', ' ')).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Create Exercises Button */}
            {hasAllFormats && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setExerciseModalOpen(true)}
                  className={`px-8 py-4 text-white rounded-lg text-lg font-semibold transition-all ${
                    theme === 'day-mode'
                      ? 'bg-purple-600 hover:bg-purple-700 shadow-lg'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-600/40'
                  }`}
                >
                  <i className="fas fa-code mr-2"></i>
                  Create DevLab Exercises
                </button>
              </div>
            )}

            {/* View Lesson Button - Always visible, disabled until all formats are ready AND template is selected */}
            {existingContent.length > 0 && (
              <div className="mt-8 text-center space-y-4">
                <div className="relative inline-block group">
                  <button
                    onClick={() => {
                      if (hasAllFormats && topicDetails?.template_id) {
                        navigate(`/lessons/${topicId}/view`);
                      }
                    }}
                    disabled={!hasAllFormats || !topicDetails?.template_id}
                    className={`px-8 py-4 text-white rounded-lg text-lg font-semibold transition-all ${
                      hasAllFormats && topicDetails?.template_id
                        ? theme === 'day-mode'
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg cursor-pointer'
                          : 'bg-gradient-to-r from-[#0d9488] to-[#059669] hover:from-[#14b8a6] hover:to-[#10b981] shadow-lg shadow-[#0d9488]/40 cursor-pointer'
                        : 'bg-gray-400 dark:bg-gray-600 opacity-60 cursor-not-allowed'
                    }`}
                    title={
                      !hasAllFormats
                        ? `This button will be active once all content formats are generated. ${getMissingFormats.length > 0 ? `Waiting for: ${getMissingFormats.map(f => f.replace('_', ' ')).join(', ')}` : ''}`
                        : !topicDetails?.template_id
                        ? 'This button will be active once a template is selected for this lesson.'
                        : 'View the complete lesson with all content formats'
                    }
                  >
                    <i className="fas fa-eye mr-2"></i>
                    View Complete Lesson
                  </button>
                  {(!hasAllFormats || !topicDetails?.template_id) && (
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 mt-2 w-64 px-3 py-2 text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                      style={{
                        background: theme === 'day-mode' ? '#1f2937' : '#0f172a',
                        color: '#e5e7eb',
                        border: '1px solid rgba(156, 163, 175, 0.3)',
                      }}
                    >
                      {!hasAllFormats ? (
                        <>
                          This button will be active once all content formats are generated.
                          {getMissingFormats.length > 0 && (
                            <div className="mt-1 text-yellow-300">
                              Waiting for: {getMissingFormats.map(f => f.replace('_', ' ')).join(', ')}
                            </div>
                          )}
                        </>
                      ) : !topicDetails?.template_id ? (
                        'This button will be active once a template is selected for this lesson.'
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Save and Finish Lesson Button - Only for standalone lessons */}
                {!topicDetails?.course_id && (
                  <div className="relative inline-block group mt-6">
                    <button
                      onClick={handlePublishStandalone}
                      disabled={publishing || !isStandaloneReady}
                      className={`px-8 py-4 text-white rounded-lg text-lg font-semibold transition-all ${
                        publishing || !isStandaloneReady
                          ? 'bg-gray-400 dark:bg-gray-600 opacity-60 cursor-not-allowed'
                          : theme === 'day-mode'
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-lg cursor-pointer'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/40 cursor-pointer'
                      }`}
                      title={
                        !isStandaloneReady
                          ? `This button will be active once all content formats are generated, a template is selected, and DevLab exercises are created.`
                          : 'Mark this lesson as archived. It will be available for use in personalized courses when Course Builder requests content.'
                      }
                    >
                      {publishing ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-check-circle mr-2"></i>
                          Mark Lesson as Archived
                        </>
                      )}
                    </button>
                    {!isStandaloneReady && (
                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 mt-2 w-64 px-3 py-2 text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                        style={{
                          background: theme === 'day-mode' ? '#1f2937' : '#0f172a',
                          color: '#e5e7eb',
                          border: '1px solid rgba(156, 163, 175, 0.3)',
                        }}
                      >
                        {!hasAllFormats ? (
                          <>
                            All content formats must be generated.
                            {getMissingFormats.length > 0 && (
                              <div className="mt-1 text-yellow-300">
                                Missing: {getMissingFormats.map(f => f.replace('_', ' ')).join(', ')}
                              </div>
                            )}
                          </>
                        ) : !topicDetails?.template_id ? (
                          'A template must be selected.'
                        ) : !hasExercises ? (
                          'DevLab exercises must be created.'
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                {/* Publish Success Message */}
                {publishSuccess && (
                  <div
                    className={`p-4 rounded-lg border ${
                      theme === 'day-mode'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-green-900/20 border-green-500/30 text-green-300'
                    }`}
                  >
                    <i className="fas fa-check-circle mr-2"></i>
                    Lesson saved and sent to Course Builder successfully!
                  </div>
                )}

                {/* Publish Error Message */}
                {publishError && (
                  <div
                    className={`p-4 rounded-lg border ${
                      theme === 'day-mode'
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-red-900/20 border-red-500/30 text-red-300'
                    }`}
                  >
                    <i className="fas fa-exclamation-circle mr-2"></i>
                    {publishError}
                  </div>
                )}
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

        <ExerciseCreationModal
          isOpen={exerciseModalOpen}
          onClose={() => setExerciseModalOpen(false)}
          topicId={parseInt(topicId)}
          topicName={topicDetails?.topic_name || ''}
          topicSkills={topicDetails?.skills || []}
          topicLanguage={topicDetails?.language || 'en'}
        />
      </div>
    </div>
  );
}
