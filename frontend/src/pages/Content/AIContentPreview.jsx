import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { contentService } from '../../services/content.js';
import { useApp } from '../../context/AppContext.jsx';

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
      className={`min-h-screen p-8 ${
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
              {content.content_type_id === 1 && 'Text Content'}
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
                <p>
                  <strong>Topic:</strong> {content.content_data.metadata.lessonTopic}
                </p>
                <p>
                  <strong>Language:</strong> {content.content_data.metadata.language}
                </p>
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

