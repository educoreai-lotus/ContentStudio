import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { contentService } from '../../services/content.js';
import { useApp } from '../../context/AppContext.jsx';
import { MindMapViewer } from '../../components/MindMapViewer';

export const AIContentPreview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { topicId } = useParams();
  const { theme } = useApp();
  
  const [content, setContent] = useState(location.state?.content || null);
  const [editedContent, setEditedContent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!content) {
      setError('No content to preview. Please generate content first.');
    } else {
      // Initialize edited content with the generated content
      setEditedContent(JSON.parse(JSON.stringify(content.content_data)));
    }
  }, [content]);

  const handleContentChange = (field, value) => {
    setEditedContent(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError(null);

      const wasEdited = JSON.stringify(content.content_data) !== JSON.stringify(editedContent);

      await contentService.approve({
        topic_id: content.topic_id,
        content_type_id: content.content_type_id,
        content_data: editedContent,
        was_edited: wasEdited,
        original_content_data: content.content_data,
      });

      // Navigate back to content manager
      navigate(`/topics/${topicId}/content`, {
        state: { message: 'Content saved successfully!' },
      });
    } catch (err) {
      setError(err.message || 'Failed to save content');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/topics/${topicId}/content`);
  };

  if (!content) {
    return (
      <div
        className={`min-h-screen p-4 sm:p-6 md:p-8 ${
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
              {error || 'No content to preview'}
            </p>
            <button
              onClick={() => navigate(`/topics/${topicId}/content/ai-generate`)}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Generate Content
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 md:p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
      }`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Review AI-Generated Content
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Review, edit if needed, and approve to save
          </p>
        </div>

        {error && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              theme === 'day-mode'
                ? 'bg-red-50 border-red-200'
                : 'bg-red-900/20 border-red-500/30'
            }`}
          >
            <p
              className={`${
                theme === 'day-mode' ? 'text-red-800' : 'text-red-300'
              }`}
            >
              {error}
            </p>
          </div>
        )}

        <div
          className={`rounded-2xl shadow-lg p-6 mb-6 ${
            theme === 'day-mode'
              ? 'bg-white border border-gray-200'
              : 'bg-gray-800 border border-gray-700'
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <h2
              className={`text-xl font-semibold ${
                theme === 'day-mode' ? 'text-gray-900' : 'text-white'
              }`}
            >
              {content.content_type_id === 1 && 'Text & Audio'}
              {content.content_type_id === 2 && 'Code Example'}
              {content.content_type_id === 3 && 'Presentation'}
              {content.content_type_id === 4 && 'Audio Narration'}
              {content.content_type_id === 5 && 'Mind Map'}
              {content.content_type_id === 6 && 'Avatar Video'}
            </h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 rounded-lg ${
                isEditing
                  ? 'bg-gray-500 hover:bg-gray-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white transition-colors`}
            >
              {isEditing ? 'Cancel Edit' : 'Edit Content'}
            </button>
          </div>

          {/* Content Preview/Edit */}
          {content.content_type_id === 1 && (
            <div className="space-y-4">
              {isEditing ? (
                <textarea
                  value={editedContent?.text || ''}
                  onChange={e => handleContentChange('text', e.target.value)}
                  rows={15}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    theme === 'day-mode'
                      ? 'border-gray-300 bg-white text-gray-900'
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                />
              ) : (
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
                    {editedContent?.text || content.content_data?.text}
                  </pre>
                </div>
              )}

              {/* Auto-generated Audio */}
              {(editedContent?.audioUrl || content.content_data?.audioUrl) && (
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
                    {(editedContent?.audioDuration || content.content_data?.audioDuration) && (
                      <span
                        className={`text-sm ${
                          theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                        }`}
                      >
                        ({Math.round(editedContent?.audioDuration || content.content_data?.audioDuration)}s)
                      </span>
                    )}
                  </div>
                  <audio
                    controls
                    className="w-full"
                    style={{ maxWidth: '100%' }}
                  >
                    <source 
                      src={editedContent?.audioUrl || content.content_data?.audioUrl} 
                      type={`audio/${editedContent?.audioFormat || content.content_data?.audioFormat || 'mp3'}`} 
                    />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          )}

          {content.content_type_id === 2 && (
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <textarea
                    value={editedContent?.code || ''}
                    onChange={e => handleContentChange('code', e.target.value)}
                    rows={15}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono ${
                      theme === 'day-mode'
                        ? 'border-gray-300 bg-white text-gray-900'
                        : 'border-gray-600 bg-gray-700 text-white'
                    }`}
                  />
                  <textarea
                    value={editedContent?.explanation || ''}
                    onChange={e =>
                      handleContentChange('explanation', e.target.value)
                    }
                    rows={5}
                    placeholder="Explanation..."
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      theme === 'day-mode'
                        ? 'border-gray-300 bg-white text-gray-900'
                        : 'border-gray-600 bg-gray-700 text-white'
                    }`}
                  />
                </>
              ) : (
                <>
                  <div
                    className={`p-4 rounded-lg ${
                      theme === 'day-mode' ? 'bg-gray-900' : 'bg-gray-950'
                    }`}
                  >
                    <pre className="text-green-400 font-mono text-sm overflow-x-auto">
                      {editedContent?.code || content.content_data?.code}
                    </pre>
                  </div>
                  {(editedContent?.explanation || content.content_data?.explanation) && (
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
                        {editedContent?.explanation || content.content_data?.explanation}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Presentation */}
          {content.content_type_id === 3 && (
            <div className="space-y-4">
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
                    
                    return (gammaUrl || presentationUrl) && (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          {presentationUrl && (
                            <a
                              href={presentationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                              <i className="fas fa-external-link-alt mr-2"></i>
                              View Presentation
                            </a>
                          )}
                          {gammaUrl && !presentationUrl && (
                            <a
                              href={gammaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                              <i className="fas fa-external-link-alt mr-2"></i>
                              View on Gamma
                            </a>
                          )}
                          {presentationUrl && (() => {
                            // Detect file format: check exportFormat field, then URL extension, default to PPTX
                            const exportFormat = content.content_data?.exportFormat || 
                                                 (presentationUrl?.toLowerCase().endsWith('.pdf') ? 'pdf' : null) ||
                                                 (presentationUrl?.toLowerCase().endsWith('.pptx') ? 'pptx' : null) ||
                                                 'pptx'; // Default to PPTX for backward compatibility
                            const fileFormatLabel = exportFormat.toUpperCase();
                            return (
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
                            );
                          })()}
                        </div>
                        <p
                          className={`text-xs ${
                            theme === 'day-mode' ? 'text-gray-500' : 'text-gray-500'
                          }`}
                        >
                          {gammaUrl && presentationUrl 
                            ? (() => {
                                const exportFormat = content.content_data?.exportFormat || 
                                                     (presentationUrl?.toLowerCase().endsWith('.pdf') ? 'pdf' : null) ||
                                                     (presentationUrl?.toLowerCase().endsWith('.pptx') ? 'pptx' : null) ||
                                                     'pptx';
                                return `View online or download ${exportFormat.toUpperCase()} file`;
                              })()
                            : gammaUrl 
                            ? 'Opens in Gamma viewer' 
                            : (() => {
                                const exportFormat = content.content_data?.exportFormat || 
                                                     (presentationUrl?.toLowerCase().endsWith('.pdf') ? 'pdf' : null) ||
                                                     (presentationUrl?.toLowerCase().endsWith('.pptx') ? 'pptx' : null) ||
                                                     'pptx';
                                return `${exportFormat.toUpperCase()} file from Supabase Storage`;
                              })()}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Mind Map */}
          {content.content_type_id === 5 && (
            <div className="space-y-6">
              {/* Visual Mind Map */}
              {(editedContent?.nodes || content.content_data?.nodes) && (
                <div>
                  <h4
                    className={`font-semibold mb-4 text-lg ${
                      theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    <i className="fas fa-project-diagram mr-2 text-purple-600"></i>
                    Mind Map Visualization
                  </h4>
                  <MindMapViewer data={editedContent || content.content_data} />
                </div>
              )}

              {/* Image (if available) */}
              {(editedContent?.imageUrl || content.content_data?.imageUrl) && (
                <div className="text-center">
                  <img
                    src={editedContent?.imageUrl || content.content_data?.imageUrl}
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
              {isEditing ? (
                <textarea
                  value={editedContent?.script || ''}
                  onChange={e => handleContentChange('script', e.target.value)}
                  rows={8}
                  placeholder="Video narration script..."
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    theme === 'day-mode'
                      ? 'border-gray-300 bg-white text-gray-900'
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                />
              ) : (
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
                    {editedContent?.script || content.content_data?.script}
                  </pre>
                </div>
              )}
              {(editedContent?.videoUrl || content.content_data?.videoUrl) && (
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
                      Avatar Video Preview
                    </span>
                  </div>
                  <div className="relative rounded-lg overflow-hidden shadow-2xl bg-black">
                    <video
                      src={editedContent?.videoUrl || content.content_data?.videoUrl}
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
                {/* Metadata removed - topic, language, and skills are stored in topics table, not in content_data */}
                <p className="text-sm italic opacity-70">
                  Topic information is available in the topic details.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleCancel}
            disabled={loading}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              theme === 'day-mode'
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Approve & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

