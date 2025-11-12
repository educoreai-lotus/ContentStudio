import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { templateApplicationService } from '../../services/template-application';
import { useApp } from '../../context/AppContext';
import { MindMapViewer } from '../../components/MindMapViewer.jsx';

/**
 * Lesson View Component
 * Displays lesson content according to applied template format order
 */
export default function LessonView() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { theme } = useApp();
  const [lessonView, setLessonView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLessonView();
  }, [topicId]);

  const loadLessonView = async () => {
    try {
      setLoading(true);
      setError(null);
      const viewData = await templateApplicationService.getLessonView(topicId);
      setLessonView(viewData);
    } catch (err) {
      console.error('Failed to load lesson view:', err);
      setError(err.response?.data?.error || 'Failed to load lesson view');
    } finally {
      setLoading(false);
    }
  };

  const formatIcons = {
    text: 'fa-file-alt',
    code: 'fa-code',
    presentation: 'fa-presentation',
    audio: 'fa-volume-up',
    mind_map: 'fa-project-diagram',
    avatar_video: 'fa-video',
  };

  const formatLabels = {
    text: 'Text Content',
    code: 'Code Example',
    presentation: 'Presentation',
    audio: 'Audio Narration',
    mind_map: 'Mind Map',
    avatar_video: 'Avatar Video',
  };

  const renderTextContent = (contentData, audioFirst = false) => {
    // Handle case where contentData might be a JSON string or already an object
    let parsedData = contentData;
    
    // If contentData is a string, try to parse it as JSON
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        // If it's not JSON, treat it as plain text
        parsedData = { text: contentData };
      }
    }
    
    // Ensure parsedData is an object
    if (!parsedData || typeof parsedData !== 'object') {
      parsedData = { text: String(contentData || '') };
    }

    // Extract text value - check multiple possible locations
    const textValue = parsedData?.text || parsedData?.content || '';
    const hasAudio = !!parsedData?.audioUrl;

    if (!textValue || textValue.trim() === '') {
      return (
        <div
          className={`p-4 rounded-lg ${
            theme === 'day-mode' ? 'bg-gray-50 border border-gray-200' : 'bg-gray-900 border border-gray-700'
          }`}
        >
          <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>
            No text content available
          </p>
        </div>
      );
    }

    // Render audio section
    const renderAudioSection = () => {
      if (!hasAudio) return null;
      
      return (
        <div
          className={`p-4 rounded-lg ${
            theme === 'day-mode' ? 'bg-blue-50' : 'bg-blue-900/20'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <i className="fas fa-volume-up text-blue-600 text-xl"></i>
            <h4
              className={`font-semibold ${
                theme === 'day-mode' ? 'text-gray-900' : 'text-white'
              }`}
            >
              Audio Narration
            </h4>
            {parsedData?.audioDuration && (
              <span
                className={`text-sm ${
                  theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                ({Math.round(parsedData.audioDuration)}s)
              </span>
            )}
          </div>
          <audio controls className="w-full" style={{ maxWidth: '100%' }}>
            <source
              src={parsedData.audioUrl}
              type={`audio/${parsedData.audioFormat || 'mp3'}`}
            />
            Your browser does not support the audio element.
          </audio>
          {parsedData?.audioVoice && (
            <p
              className={`text-xs mt-2 ${
                theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              Voice: {parsedData.audioVoice}
            </p>
          )}
        </div>
      );
    };

    return (
      <div
        className={`p-4 rounded-lg ${
          theme === 'day-mode' ? 'bg-gray-50 border border-gray-200' : 'bg-gray-900 border border-gray-700'
        }`}
      >
        {/* Show audio first if audioFirst is true */}
        {audioFirst && renderAudioSection()}
        
        {/* Text content */}
        <div
          className={`whitespace-pre-wrap font-sans ${
            theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'
          }`}
        >
          {textValue}
        </div>
        
        {/* Show audio after text if audioFirst is false */}
        {!audioFirst && hasAudio && (
          <div className="mt-4">
            {renderAudioSection()}
          </div>
        )}
      </div>
    );
  };

  const renderCodeContent = contentData => {
    // Handle case where contentData might be a JSON string
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        // If it's not JSON, treat as plain code
        parsedData = { code: contentData };
      }
    }

    const codeValue = parsedData?.code || '';

    return (
      <div className="space-y-4">
        {codeValue ? (
          <div
            className={`p-4 rounded-lg ${
              theme === 'day-mode' ? 'bg-gray-900' : 'bg-gray-950'
            }`}
          >
            <pre className="text-green-400 font-mono text-sm overflow-x-auto">
              {codeValue}
            </pre>
          </div>
        ) : (
          <div
            className={`p-4 rounded-lg ${
              theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'
            }`}
          >
            <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>
              No code content available
            </p>
          </div>
        )}
        {parsedData?.explanation && (
          <div
            className={`p-4 rounded-lg ${
              theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'
            }`}
          >
            <p
              className={`${
                theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'
              }`}
            >
              {parsedData.explanation}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderPresentationContent = contentData => {
    // Handle case where contentData might be a JSON string
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        parsedData = {};
      }
    }

    const googleSlidesUrl = parsedData?.googleSlidesUrl || parsedData?.fileUrl;
    const presentation = parsedData?.presentation;

    return (
      <div
        className={`p-6 rounded-lg border-2 border-dashed ${
          theme === 'day-mode'
            ? 'bg-purple-50 border-purple-300'
            : 'bg-purple-900/20 border-purple-500/30'
        }`}
      >
        <div className="flex items-center justify-center mb-4">
          <i className="fas fa-file-powerpoint text-6xl text-purple-600"></i>
        </div>
        <div className="text-center space-y-2">
          <h3
            className={`text-lg font-semibold ${
              theme === 'day-mode' ? 'text-gray-900' : 'text-white'
            }`}
          >
            {presentation?.title || parsedData?.fileName || 'Presentation File'}
          </h3>
          {parsedData?.slide_count && (
            <p
              className={`text-sm ${
                theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              {parsedData.slide_count} slides
            </p>
          )}
          {googleSlidesUrl && (
            <div className="mt-4 space-y-2">
              <a
                href={googleSlidesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <i className="fas fa-external-link-alt mr-2"></i>
                Open Presentation
              </a>
              <p
                className={`text-xs ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-gray-500'
                }`}
              >
                Opens in a new tab
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAudioContent = contentData => {
    // Handle case where contentData might be a JSON string
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        // If it's not JSON, return empty
        parsedData = {};
      }
    }

    if (!parsedData?.audioUrl) {
      return (
        <div
          className={`p-4 rounded-lg ${
            theme === 'day-mode' ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/20 border border-blue-600/50'
          }`}
        >
          <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>
            No audio content available
          </p>
        </div>
      );
    }

    return (
      <div
        className={`p-4 rounded-lg ${
          theme === 'day-mode' ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/20 border border-blue-600/50'
        }`}
      >
        <h4
          className={`font-semibold mb-2 ${
            theme === 'day-mode' ? 'text-blue-900' : 'text-blue-200'
          }`}
        >
          Audio Narration
        </h4>
        <audio controls className="w-full">
          <source
            src={parsedData.audioUrl}
            type={`audio/${parsedData.audioFormat || 'mp3'}`}
          />
          Your browser does not support the audio element.
        </audio>
        {parsedData?.audioDuration && (
          <p
            className={`text-xs mt-2 ${
              theme === 'day-mode' ? 'text-blue-700' : 'text-blue-300'
            }`}
          >
            Duration: {Math.round(parsedData.audioDuration)}s
          </p>
        )}
        {parsedData?.audioVoice && (
          <p
            className={`text-xs mt-1 ${
              theme === 'day-mode' ? 'text-blue-700' : 'text-blue-300'
            }`}
          >
            Voice: {parsedData.audioVoice}
          </p>
        )}
      </div>
    );
  };

  const renderMindMapContent = contentData => {
    // Handle case where contentData might be a JSON string
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
            <h4
              className={`font-semibold mb-4 text-lg ${
                theme === 'day-mode' ? 'text-gray-900' : 'text-white'
              }`}
            >
              <i className="fas fa-project-diagram mr-2 text-purple-600"></i>
              Mind Map Visualization
            </h4>
            <MindMapViewer data={parsedData} />
          </div>
        ) : (
          <div
            className={`p-4 rounded-lg ${
              theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'
            }`}
          >
            <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>
              No mind map data available
            </p>
          </div>
        )}
        {parsedData?.imageUrl && (
          <div className="text-center">
            <img
              src={parsedData.imageUrl}
              alt="Mind Map"
              className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
            />
          </div>
        )}
      </div>
    );
  };

  const renderAvatarVideoContent = contentData => {
    // Handle case where contentData might be a JSON string
    let parsedData = contentData;
    if (typeof contentData === 'string') {
      try {
        parsedData = JSON.parse(contentData);
      } catch (e) {
        parsedData = {};
      }
    }

    return (
      <div className="space-y-4">
        {parsedData?.script && (
          <div
            className={`p-4 rounded-lg ${
              theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'
            }`}
          >
            <h4
              className={`font-semibold mb-2 ${
                theme === 'day-mode' ? 'text-gray-900' : 'text-white'
              }`}
            >
              Video Script
            </h4>
            <div
              className={`whitespace-pre-wrap font-sans ${
                theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'
              }`}
            >
              {parsedData.script}
            </div>
          </div>
        )}

        {parsedData?.videoUrl ? (
          <div className="space-y-3">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                theme === 'day-mode' ? 'bg-blue-50' : 'bg-blue-900/20'
              }`}
            >
              <i className="fas fa-video text-blue-600"></i>
              <span
                className={`text-sm font-medium ${
                  theme === 'day-mode' ? 'text-blue-900' : 'text-blue-300'
                }`}
              >
                Avatar Video
              </span>
            </div>
            <div className="relative rounded-lg overflow-hidden shadow-2xl bg-black">
              <video
                src={parsedData.videoUrl}
                controls
                className="w-full h-auto"
                style={{ maxHeight: '500px' }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            {parsedData?.videoId && (
              <div
                className={`text-xs text-center ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Video ID: {parsedData.videoId}
              </div>
            )}
            {parsedData?.duration_seconds && (
              <div
                className={`text-xs text-center ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Duration: {Math.round(parsedData.duration_seconds)}s
              </div>
            )}
          </div>
        ) : (
          <div
            className={`p-4 rounded-lg ${
              theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'
            }`}
          >
            <p className={theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}>
              No video content available
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderMetadataFooter = contentData => {
    // Metadata footer removed - redundant metadata (topic, language, skills) is stored in topics table
    // Only essential metadata (like style, generated_at) is kept in content_data.metadata
    return null;
  };

  const renderContentItem = (formatType, contentItem, index, formatItem = null) => {
    // Extract content_data, handling both object and string formats
    let contentData = contentItem.content_data || contentItem;
    
    // Debug logging
    console.log('[LessonView] renderContentItem:', {
      formatType,
      contentItemType: typeof contentItem,
      contentDataType: typeof contentData,
      hasContentData: !!contentItem.content_data,
      contentDataKeys: contentData && typeof contentData === 'object' ? Object.keys(contentData) : null,
    });
    
    // If content_data is a JSON string, parse it
    if (typeof contentData === 'string') {
      try {
        contentData = JSON.parse(contentData);
      } catch (e) {
        // If parsing fails, keep as is
        console.warn('Failed to parse content_data:', e);
      }
    }
    
    // Ensure contentData is an object
    if (!contentData || typeof contentData !== 'object') {
      console.warn('[LessonView] contentData is not an object:', contentData);
      contentData = {};
    }

    switch (formatType) {
      case 'text':
      case 'text_audio':
      case 'text_audio_combined':
        // Check if this is a combined format with audioFirst flag
        const audioFirst = formatItem?.audioFirst || false;
        return (
          <div key={contentItem.content_id || `text-${index}`} className="space-y-4">
            {renderTextContent(contentData, audioFirst)}
            {renderMetadataFooter(contentData)}
          </div>
        );
      case 'audio_text':
        // Audio comes before text in template
        return (
          <div key={contentItem.content_id || `audio-text-${index}`} className="space-y-4">
            {renderTextContent(contentData, true)}
            {renderMetadataFooter(contentData)}
          </div>
        );
      case 'code':
        return (
          <div key={contentItem.content_id || `code-${index}`}>
            {renderCodeContent(contentData)}
            {renderMetadataFooter(contentData)}
          </div>
        );
      case 'presentation':
        return (
          <div key={contentItem.content_id || `presentation-${index}`}>
            {renderPresentationContent(contentData)}
            {renderMetadataFooter(contentData)}
          </div>
        );
      case 'audio':
        return (
          <div key={contentItem.content_id || `audio-${index}`}>
            {renderAudioContent(contentData)}
            {renderMetadataFooter(contentData)}
          </div>
        );
      case 'mind_map':
        return (
          <div key={contentItem.content_id || `mindmap-${index}`}>
            {renderMindMapContent(contentData)}
            {renderMetadataFooter(contentData)}
          </div>
        );
      case 'avatar_video':
        return (
          <div key={contentItem.content_id || `avatar-${index}`}>
            {renderAvatarVideoContent(contentData)}
            {renderMetadataFooter(contentData)}
          </div>
        );
      default:
        // For unknown types, try to render as text if it has text field
        if (contentData && typeof contentData === 'object' && contentData.text) {
          return (
            <div key={contentItem.content_id || `unknown-${index}`} className="space-y-4">
              {renderTextContent(contentData)}
            </div>
          );
        }
        // Otherwise show as JSON
        return (
          <pre
            key={contentItem.content_id || `unknown-${index}`}
            className={`text-sm overflow-x-auto p-4 rounded-lg ${
              theme === 'day-mode' ? 'bg-gray-100 text-gray-700' : 'bg-gray-800 text-gray-200'
            }`}
          >
            {JSON.stringify(contentData, null, 2)}
          </pre>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-300'}>
            Loading lesson view...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`text-center p-8 rounded-lg max-w-md ${
          theme === 'day-mode' ? 'bg-white' : 'bg-gray-800'
        }`}>
          <i className={`fas fa-exclamation-triangle text-4xl mb-4 ${
            theme === 'day-mode' ? 'text-red-500' : 'text-red-400'
          }`}></i>
          <h2 className={`text-xl font-semibold mb-2 ${
            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
          }`}>
            Error Loading Lesson
          </h2>
          <p className={`mb-4 ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
            {error}
          </p>
          <button
            onClick={() => navigate('/lessons')}
            className={`px-4 py-2 rounded-lg ${
              theme === 'day-mode'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            Back to Lessons
          </button>
        </div>
      </div>
    );
  }

  if (!lessonView || !lessonView.formats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`text-center p-8 rounded-lg max-w-md ${
          theme === 'day-mode' ? 'bg-white' : 'bg-gray-800'
        }`}>
          <i className={`fas fa-info-circle text-4xl mb-4 ${
            theme === 'day-mode' ? 'text-blue-500' : 'text-blue-400'
          }`}></i>
          <h2 className={`text-xl font-semibold mb-2 ${
            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
          }`}>
            No Template Applied
          </h2>
          <p className={`mb-4 ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
            Please apply a template to this lesson to view it.
          </p>
          <button
            onClick={() => navigate(`/lessons/${topicId}`)}
            className={`px-4 py-2 rounded-lg ${
              theme === 'day-mode'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            Apply Template
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'}`}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/lessons')}
            className={`mb-4 flex items-center gap-2 ${
              theme === 'day-mode' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 hover:text-white'
            }`}
          >
            <i className="fas fa-arrow-left"></i>
            Back to Lessons
          </button>
          <h1
            className="text-4xl font-bold mb-2"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Lesson View
          </h1>
          <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
            Content organized according to template format order
          </p>
          {lessonView.template && (
            <div
              className={`mt-4 inline-flex flex-wrap items-center gap-2 px-4 py-2 rounded-lg ${
                theme === 'day-mode'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-emerald-900/20 text-emerald-200 border border-emerald-500/30'
              }`}
            >
              <span className="font-semibold">
                Template: {lessonView.template.template_name}
              </span>
              <span className="text-xs uppercase tracking-wide opacity-70">
                {lessonView.template.template_type?.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Lesson Content by Format Order */}
        <div className="space-y-8">
          {(() => {
            // Debug: Log the formats before sorting
            console.log('[LessonView] Formats before sorting:', lessonView.formats.map(f => ({ 
              type: f.type, 
              display_order: f.display_order,
              contentCount: f.content?.length || 0 
            })));
            console.log('[LessonView] Template format_order:', lessonView.template?.format_order);
            
            // Sort by display_order if available, otherwise maintain array order
            const sortedFormats = [...lessonView.formats].sort((a, b) => {
              const orderA = a.display_order !== undefined ? a.display_order : 999;
              const orderB = b.display_order !== undefined ? b.display_order : 999;
              return orderA - orderB;
            });
            
            console.log('[LessonView] Formats after sorting:', sortedFormats.map(f => ({ 
              type: f.type, 
              display_order: f.display_order,
              contentCount: f.content?.length || 0 
            })));
            
            return sortedFormats.map((formatItem, index) => {
              // Skip 'audio' format if it's part of text_audio_combined (to avoid duplicate)
              if (formatItem.type === 'audio' && sortedFormats.some(f => f.type === 'text_audio_combined' || f.type === 'audio_text')) {
                return null;
              }
              
              // Determine display label and icon for combined formats
              const displayType = formatItem.type === 'text_audio_combined' || formatItem.type === 'audio_text' 
                ? 'text' 
                : formatItem.type;
              const displayLabel = formatLabels[displayType] || formatItem.type;
              const displayIcon = formatIcons[displayType] || 'fa-file';
              
              return (
              <div
                key={`${formatItem.type}-${index}`}
                className={`p-6 rounded-lg ${
                  theme === 'day-mode'
                    ? 'bg-white border border-gray-200 shadow-sm'
                    : 'bg-gray-800 border border-gray-700 shadow-lg'
                }`}
              >
                {/* Format Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      theme === 'day-mode'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-emerald-900/30 text-emerald-400'
                    }`}
                  >
                    <i className={`fas ${displayIcon}`}></i>
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${
                      theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                    }`}>
                      {displayLabel}
                    </h3>
                    <p className={`text-sm ${
                      theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      Step {formatItem.display_order + 1} of {lessonView.formats.length}
                    </p>
                  </div>
                </div>

                {/* Content Items */}
                {formatItem.content && formatItem.content.length > 0 ? (
                  <div>
                    {formatItem.content.map((contentItem, itemIndex) =>
                      renderContentItem(formatItem.type, contentItem, itemIndex, formatItem)
                    )}
                  </div>
                ) : (
                  <div className={`text-center py-8 ${
                    theme === 'day-mode' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    <i className={`fas ${displayIcon} text-3xl mb-2`}></i>
                    <p>No {displayLabel} content available</p>
                  </div>
                )}
              </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}



