import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { MindMapViewer } from '../../components/MindMapViewer';

export const ContentViewer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { topicId } = useParams();
  const { theme } = useApp();
  
  const { content } = location.state || {};

  if (!content) {
    return (
      <div
        className={`min-h-screen p-8 ${
          theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
        }`}
      >
        <div className="max-w-4xl mx-auto">
          <div
            className={`p-6 rounded-lg border ${
              theme === 'day-mode'
                ? 'bg-red-50 border-red-200'
                : 'bg-red-900/20 border-red-500/30'
            }`}
          >
            <p
              className={`text-lg ${
                theme === 'day-mode' ? 'text-red-800' : 'text-red-300'
              }`}
            >
              No content to view
            </p>
            <button
              onClick={() => navigate(`/topics/${topicId}/content`)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Content Manager
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getContentTypeName = (typeId) => {
    const types = {
      1: 'Text Content',
      2: 'Code Example',
      3: 'Presentation',
      4: 'Audio Narration',
      5: 'Mind Map',
      6: 'Avatar Video',
    };
    return types[typeId] || 'Content';
  };

  return (
    <div
      className={`min-h-screen p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
      }`}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/topics/${topicId}/content`)}
            className={`mb-4 px-4 py-2 rounded-lg ${
              theme === 'day-mode'
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Back to Content Manager
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
            View {getContentTypeName(content.content_type_id)}
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Read-only view
          </p>
        </div>

        {/* Content Display */}
        <div
          className={`rounded-2xl shadow-lg p-6 mb-6 ${
            theme === 'day-mode'
              ? 'bg-white border border-gray-200'
              : 'bg-gray-800 border border-gray-700'
          }`}
        >
          <h2
            className={`text-xl font-semibold mb-4 ${
              theme === 'day-mode' ? 'text-gray-900' : 'text-white'
            }`}
          >
            {getContentTypeName(content.content_type_id)}
          </h2>

          {/* Text Content */}
          {content.content_type_id === 1 && (
            <div
              className={`p-4 rounded-lg ${
                theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'
              }`}
            >
              <pre
                className={`whitespace-pre-wrap font-sans ${
                  theme === 'day-mode' ? 'text-gray-900' : 'text-gray-100'
                }`}
              >
                {content.content_data?.text}
              </pre>
            </div>
          )}

          {/* Code Example */}
          {content.content_type_id === 2 && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg ${
                  theme === 'day-mode' ? 'bg-gray-900' : 'bg-gray-950'
                }`}
              >
                <pre className="text-green-400 font-mono text-sm overflow-x-auto">
                  {content.content_data?.code}
                </pre>
              </div>
              {content.content_data?.explanation && (
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
                    {content.content_data.explanation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Presentation */}
          {content.content_type_id === 3 && (
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
                  {content.content_data?.fileName || 'Presentation File'}
                </h3>
                {content.content_data?.fileSize && (
                  <p
                    className={`text-sm ${
                      theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    Size: {(content.content_data.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
                {content.content_data?.fileUrl && (
                  <div className="mt-4 space-y-2">
                    <a
                      href={content.content_data.fileUrl}
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
          )}

          {/* Mind Map */}
          {content.content_type_id === 5 && (
            <div className="space-y-6">
              {/* Visual Mind Map */}
              {content.content_data?.nodes && (
                <div>
                  <h4
                    className={`font-semibold mb-4 text-lg ${
                      theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    <i className="fas fa-project-diagram mr-2 text-purple-600"></i>
                    Mind Map Visualization
                  </h4>
                  <MindMapViewer data={content.content_data} />
                </div>
              )}

              {/* Metadata */}
              {content.content_data?.metadata && (
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
                  <div className="space-y-2">
                    {content.content_data.metadata.lessonTopic && (
                      <p
                        className={`text-sm ${
                          theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                        }`}
                      >
                        <strong>Topic:</strong> {content.content_data.metadata.lessonTopic}
                      </p>
                    )}
                    {content.content_data.metadata.language && (
                      <p
                        className={`text-sm ${
                          theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                        }`}
                      >
                        <strong>Language:</strong> {content.content_data.metadata.language}
                      </p>
                    )}
                    {content.content_data.metadata.skillsList && (
                      <p
                        className={`text-sm ${
                          theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                        }`}
                      >
                        <strong>Skills:</strong> {content.content_data.metadata.skillsList.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Image (if available) */}
              {content.content_data?.imageUrl && (
                <div className="text-center">
                  <img
                    src={content.content_data.imageUrl}
                    alt="Mind Map"
                    className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                  />
                </div>
              )}
            </div>
          )}

          {/* Avatar Video */}
          {content.content_type_id === 6 && (
            <div className="space-y-4">
              {/* Script */}
              {content.content_data?.script && (
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
                    {content.content_data.script}
                  </pre>
                </div>
              )}

              {/* Video Player */}
              {content.content_data?.videoUrl && (
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
                      src={content.content_data.videoUrl}
                      controls
                      className="w-full h-auto"
                      style={{ maxHeight: '500px' }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  {content.content_data?.videoId && (
                    <div
                      className={`text-xs text-center ${
                        theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      Video ID: {content.content_data.videoId}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          {content.content_data?.metadata && (
            <div
              className={`mt-6 p-4 rounded-lg border ${
                theme === 'day-mode'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-blue-900/20 border-blue-500/30'
              }`}
            >
              <h3
                className={`font-semibold mb-2 ${
                  theme === 'day-mode' ? 'text-blue-900' : 'text-blue-300'
                }`}
              >
                Metadata
              </h3>
              <div
                className={`text-sm ${
                  theme === 'day-mode' ? 'text-blue-800' : 'text-blue-200'
                }`}
              >
                {content.content_data.metadata.lessonTopic && (
                  <p>
                    <strong>Topic:</strong> {content.content_data.metadata.lessonTopic}
                  </p>
                )}
                {content.content_data.metadata.language && (
                  <p>
                    <strong>Language:</strong> {content.content_data.metadata.language}
                  </p>
                )}
                {content.content_data.metadata.skillsList && (
                  <p>
                    <strong>Skills:</strong>{' '}
                    {content.content_data.metadata.skillsList.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

