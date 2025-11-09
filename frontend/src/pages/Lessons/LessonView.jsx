import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { templateApplicationService } from '../../services/template-application';
import { useApp } from '../../context/AppContext';

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

  const renderContent = (contentItem) => {
    const { content_id, content_data, generation_method } = contentItem;

    return (
      <div
        key={content_id}
        className={`p-4 rounded-lg mb-4 ${
          theme === 'day-mode'
            ? 'bg-gray-50 border border-gray-200'
            : 'bg-gray-700/50 border border-gray-600'
        }`}
      >
        {content_data && (
          <div>
            {typeof content_data === 'string' ? (
              <p className={theme === 'day-mode' ? 'text-gray-900' : 'text-white'}>
                {content_data}
              </p>
            ) : (
              <pre className={`text-sm overflow-x-auto ${
                theme === 'day-mode' ? 'text-gray-800' : 'text-gray-200'
              }`}>
                {JSON.stringify(content_data, null, 2)}
              </pre>
            )}
          </div>
        )}
        <div className="mt-2 text-xs">
          <span className={`px-2 py-1 rounded ${
            theme === 'day-mode'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-blue-900/30 text-blue-300'
          }`}>
            {generation_method}
          </span>
        </div>
      </div>
    );
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
                  {formatItem.content.map((contentItem) => renderContent(contentItem))}
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



