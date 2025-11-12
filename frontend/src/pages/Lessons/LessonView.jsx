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

  const renderTextContent = contentData => {
    const textValue =
      typeof contentData === 'string'
        ? contentData
        : contentData?.text || JSON.stringify(contentData, null, 2);

    return (
      <div
        className={`p-4 rounded-lg ${
          theme === 'day-mode' ? 'bg-gray-50 border border-gray-200' : 'bg-gray-900 border border-gray-700'
        }`}
      >
        <pre
          className={`whitespace-pre-wrap font-sans ${
            theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'
          }`}
        >
          {textValue}
        </pre>
        {contentData?.audioUrl && (
          <div
            className={`mt-4 p-4 rounded-lg ${
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
              {contentData?.audioDuration && (
                <span
                  className={`text-sm ${
                    theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  ({Math.round(contentData.audioDuration)}s)
                </span>
              )}
            </div>
            <audio controls className="w-full" style={{ maxWidth: '100%' }}>
              <source
                src={contentData.audioUrl}
                type={`audio/${contentData.audioFormat || 'mp3'}`}
              />
              Your browser does not support the audio element.
            </audio>
            {contentData?.audioVoice && (
              <p
                className={`text-xs mt-2 ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Voice: {contentData.audioVoice}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCodeContent = contentData => (
    <div className="space-y-4">
      <div
        className={`p-4 rounded-lg ${
          theme === 'day-mode' ? 'bg-gray-900' : 'bg-gray-950'
        }`}
      >
        <pre className="text-green-400 font-mono text-sm overflow-x-auto">
          {contentData?.code || JSON.stringify(contentData, null, 2)}
        </pre>
      </div>
      {contentData?.explanation && (
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
            {contentData.explanation}
          </p>
        </div>
      )}
    </div>
  );

  const renderPresentationContent = contentData => (
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
          {contentData?.fileName || 'Presentation File'}
        </h3>
        {contentData?.fileSize && (
          <p
            className={`text-sm ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Size: {(contentData.fileSize / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
        {contentData?.fileUrl && (
          <div className="mt-4 space-y-2">
            <a
              href={contentData.fileUrl}
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

  const renderAudioContent = contentData => (
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
          src={contentData?.audioUrl}
          type={`audio/${contentData?.audioFormat || 'mp3'}`}
        />
        Your browser does not support the audio element.
      </audio>
      {contentData?.audioVoice && (
        <p
          className={`text-xs mt-2 ${
            theme === 'day-mode' ? 'text-blue-700' : 'text-blue-300'
          }`}
        >
          Voice: {contentData.audioVoice}
        </p>
      )}
    </div>
  );

  const renderMindMapContent = contentData => (
    <div className="space-y-6">
      {contentData?.nodes && (
        <div>
          <h4
            className={`font-semibold mb-4 text-lg ${
              theme === 'day-mode' ? 'text-gray-900' : 'text-white'
            }`}
          >
            <i className="fas fa-project-diagram mr-2 text-purple-600"></i>
            Mind Map Visualization
          </h4>
          <MindMapViewer data={contentData} />
        </div>
      )}
      {contentData?.metadata && (
        <div
          className={`p-4 rounded-lg ${
            theme === 'day-mode' ? 'bg-blue-50' : 'bg-blue-900/20'
          }`}
        >
          <h4
            className={`font-semibold mb-3 ${
              theme === 'day-mode' ? 'text-gray-900' : 'text-white'
            }`}
          >
            <i className="fas fa-info-circle mr-2 text-blue-600"></i>
            Lesson Information
          </h4>
          {/* Metadata removed - topic, language, and skills are stored in topics table, not in content_data */}
          <div className="space-y-2 text-sm">
            <p className="text-gray-500 italic">
              Topic information is available in the lesson details.
            </p>
          </div>
        </div>
      )}
      {contentData?.imageUrl && (
        <div className="text-center">
          <img
            src={contentData.imageUrl}
            alt="Mind Map"
            className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
          />
        </div>
      )}
    </div>
  );

  const renderAvatarVideoContent = contentData => (
    <div className="space-y-4">
      {contentData?.script && (
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
          <pre
            className={`whitespace-pre-wrap font-sans ${
              theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'
            }`}
          >
            {contentData.script}
          </pre>
        </div>
      )}

      {contentData?.videoUrl && (
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
              src={contentData.videoUrl}
              controls
              className="w-full h-auto"
              style={{ maxHeight: '500px' }}
            >
              Your browser does not support the video tag.
            </video>
          </div>
          {contentData?.videoId && (
            <div
              className={`text-xs text-center ${
                theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              Video ID: {contentData.videoId}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderMetadataFooter = contentData => {
    // Metadata footer removed - redundant metadata (topic, language, skills) is stored in topics table
    // Only essential metadata (like style, generated_at) is kept in content_data.metadata
    return null;
  };

  const renderContentItem = (formatType, contentItem, index) => {
    const contentData = contentItem.content_data || contentItem;

    switch (formatType) {
      case 'text':
        return (
          <div key={contentItem.content_id || `text-${index}`} className="space-y-4">
            {renderTextContent(contentData)}
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
          {lessonView.formats.map((formatItem, index) => (
            <div
              key={index}
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
                  <i className={`fas ${formatIcons[formatItem.type] || 'fa-file'}`}></i>
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${
                    theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                  }`}>
                    {formatLabels[formatItem.type] || formatItem.type}
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
                    renderContentItem(formatItem.type, contentItem, itemIndex)
                  )}
                </div>
              ) : (
                <div className={`text-center py-8 ${
                  theme === 'day-mode' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  <i className={`fas ${formatIcons[formatItem.type] || 'fa-file'} text-3xl mb-2`}></i>
                  <p>No {formatLabels[formatItem.type]} content available</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



