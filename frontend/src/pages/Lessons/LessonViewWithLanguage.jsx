import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { multilingualService } from '../../services/multilingual';
import LanguageSelector from '../../components/LanguageSelector';
import { useApp } from '../../context/AppContext';

/**
 * Lesson View with Language Support
 * Displays lesson content in selected language with language switcher
 */
export default function LessonViewWithLanguage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { theme } = useApp();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contentSource, setContentSource] = useState(null); // cache, translation, generation

  useEffect(() => {
    loadContent();
  }, [topicId, selectedLanguage]);

  const loadContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await multilingualService.getLessonByLanguage(
        topicId,
        selectedLanguage,
        'text'
      );
      setContent(response.data);
      setContentSource(response.data.source);
    } catch (err) {
      console.error('Failed to load lesson content:', err);
      setError(err.response?.data?.error || 'Failed to load lesson content');
    } finally {
      setLoading(false);
    }
  };

  const getSourceBadge = () => {
    if (!contentSource) return null;

    const badges = {
      cache: {
        icon: 'fa-database',
        label: 'Cached',
        color: theme === 'day-mode' ? 'bg-green-100 text-green-700' : 'bg-green-900/30 text-green-300',
      },
      translation: {
        icon: 'fa-language',
        label: 'Translated',
        color: theme === 'day-mode' ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/30 text-blue-300',
      },
      generation: {
        icon: 'fa-robot',
        label: 'AI Generated',
        color: theme === 'day-mode' ? 'bg-purple-100 text-purple-700' : 'bg-purple-900/30 text-purple-300',
      },
    };

    const badge = badges[contentSource];
    if (!badge) return null;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <i className={`fas ${badge.icon} mr-1`}></i>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-300'}>
            Loading lesson content...
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
          
          <div className="flex items-center justify-between mb-4">
            <h1
              className="text-4xl font-bold"
              style={{
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Lesson Content
            </h1>
            <div className="flex items-center gap-4">
              {getSourceBadge()}
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                theme={theme}
                showStats={true}
              />
            </div>
          </div>

          {contentSource && contentSource !== 'cache' && (
            <div className={`p-3 rounded-lg mb-4 ${
              theme === 'day-mode' ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/20 border border-blue-700'
            }`}>
              <div className="flex items-start gap-2">
                <i className={`fas fa-info-circle mt-1 ${
                  theme === 'day-mode' ? 'text-blue-600' : 'text-blue-400'
                }`}></i>
                <div>
                  <p className={`text-sm ${
                    theme === 'day-mode' ? 'text-blue-800' : 'text-blue-200'
                  }`}>
                    {contentSource === 'translation' && content?.source_language && (
                      <>This content was translated from {content.source_language.toUpperCase()}</>
                    )}
                    {contentSource === 'generation' && (
                      <>This content was generated on-the-fly using AI</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {content && content.content && (
          <div className={`p-6 rounded-lg ${
            theme === 'day-mode'
              ? 'bg-white border border-gray-200 shadow-sm'
              : 'bg-gray-800 border border-gray-700 shadow-lg'
          }`}>
            {typeof content.content === 'string' ? (
              <div
                className={`prose max-w-none ${
                  theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                }`}
                dangerouslySetInnerHTML={{ __html: content.content }}
              />
            ) : (
              <pre className={`text-sm overflow-x-auto ${
                theme === 'day-mode' ? 'text-gray-800' : 'text-gray-200'
              }`}>
                {JSON.stringify(content.content, null, 2)}
              </pre>
            )}
          </div>
        )}

        {!content && (
          <div className={`text-center py-12 ${
            theme === 'day-mode' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <i className="fas fa-file-alt text-6xl mb-4"></i>
            <p>No content available in {selectedLanguage.toUpperCase()}</p>
          </div>
        )}
      </div>
    </div>
  );
}



