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
      1: 'Text & Audio',
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
            <div className="space-y-4">
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

              {/* Auto-generated Audio */}
              {content.content_data?.audioUrl && (
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
                    {content.content_data?.audioDuration && (
                      <span
                        className={`text-sm ${
                          theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                        }`}
                      >
                        ({Math.round(content.content_data.audioDuration)}s)
                      </span>
                    )}
                  </div>
                  <audio
                    controls
                    className="w-full"
                    style={{ maxWidth: '100%' }}
                  >
                    <source src={content.content_data.audioUrl} type={`audio/${content.content_data.audioFormat || 'mp3'}`} />
                    Your browser does not support the audio element.
                  </audio>
                  {content.content_data?.audioVoice && (
                    <p
                      className={`text-xs mt-2 ${
                        theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      Voice: {content.content_data.audioVoice}
                    </p>
                  )}
                </div>
              )}
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
                {(() => {
                  const presentationUrl = content.content_data?.presentationUrl || content.content_data?.fileUrl;
                  const gammaUrl = content.content_data?.metadata?.gamma_raw_response?.result?.gammaUrl || 
                                   content.content_data?.metadata?.gamma_raw_response?.gammaUrl ||
                                   content.content_data?.gamma_raw_response?.result?.gammaUrl ||
                                   content.content_data?.gamma_raw_response?.gammaUrl ||
                                   content.content_data?.gammaUrl;
                  
                  // Detect file format: check exportFormat field, then URL extension, default to PPTX
                  const exportFormat = content.content_data?.exportFormat || 
                                       (presentationUrl?.toLowerCase().endsWith('.pdf') ? 'pdf' : null) ||
                                       (presentationUrl?.toLowerCase().endsWith('.pptx') ? 'pptx' : null) ||
                                       'pptx'; // Default to PPTX for backward compatibility
                  const fileFormatLabel = exportFormat.toUpperCase();
                  const fileFormatIcon = exportFormat === 'pdf' ? 'fa-file-pdf' : 'fa-file-powerpoint';
                  
                  return (gammaUrl || presentationUrl) && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        {gammaUrl && (
                          <a
                            href={gammaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <i className="fas fa-external-link-alt mr-2"></i>
                            View Presentation
                          </a>
                        )}
                        {presentationUrl && (
                          <a
                            href={presentationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="inline-block px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                          >
                            <i className="fas fa-download mr-2"></i>
                            Download {fileFormatLabel}
                          </a>
                        )}
                      </div>
                      <p
                        className={`text-xs ${
                          theme === 'day-mode' ? 'text-gray-500' : 'text-gray-500'
                        }`}
                      >
                        {gammaUrl && presentationUrl 
                          ? `View online or download ${fileFormatLabel} file` 
                          : gammaUrl 
                          ? 'Opens in Gamma viewer' 
                          : `${fileFormatLabel} file from Supabase Storage`}
                      </p>
                    </div>
                  );
                })()}
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
                  {/* Metadata removed - topic, language, and skills are stored in topics table, not in content_data */}
                  <div className="space-y-2">
                    <p
                      className={`text-sm ${
                        theme === 'day-mode' ? 'text-gray-500 italic' : 'text-gray-400 italic'
                      }`}
                    >
                      Topic information is available in the topic details.
                    </p>
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

          {/* Metadata section removed - redundant metadata (topic, language, skills) is stored in topics table */}
          {/* Only essential metadata (like style, generated_at) is kept in content_data.metadata */}
        </div>
      </div>
    </div>
  );
};

