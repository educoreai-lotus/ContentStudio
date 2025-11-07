import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { contentService } from '../../services/content.js';
import { useApp } from '../../context/AppContext.jsx';

export const ManualContentForm = () => {
  const navigate = useNavigate();
  const { topicId } = useParams();
  const { theme } = useApp();
  const [formData, setFormData] = useState({
    topic_id: topicId ? parseInt(topicId) : null,
    content_type_id: 'text',
    content_data: {},
    generation_method_id: 'manual',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [codeContent, setCodeContent] = useState({ code: '', language: 'javascript' });

  useEffect(() => {
    if (!topicId) {
      setErrors({ submit: 'Topic ID is required' });
    }
  }, [topicId]);

  const handleContentTypeChange = e => {
    const contentType = e.target.value;
    setFormData(prev => ({
      ...prev,
      content_type_id: contentType,
      content_data: {},
    }));

    // Reset content based on type
    if (contentType === 'text') {
      setTextContent('');
    } else if (contentType === 'code') {
      setCodeContent({ code: '', language: 'javascript' });
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.topic_id) {
      setErrors({ submit: 'Topic ID is required' });
      return;
    }

    // Prepare content_data based on type
    let contentData = {};
    if (formData.content_type_id === 'text') {
      if (!textContent.trim()) {
        setErrors({ content: 'Text content is required' });
        return;
      }
      contentData = { text: textContent };
    } else if (formData.content_type_id === 'code') {
      if (!codeContent.code.trim()) {
        setErrors({ content: 'Code content is required' });
        return;
      }
      contentData = codeContent;
    } else {
      setErrors({ content: 'Content data is required' });
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      const content = await contentService.create({
        ...formData,
        content_data: contentData,
      });

      navigate(`/topics/${formData.topic_id}`);
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to create content' });
    } finally {
      setLoading(false);
    }
  };

  const renderContentEditor = () => {
    if (formData.content_type_id === 'text') {
      return (
        <div className="mb-6">
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
            }`}
            style={{
              background:
                theme === 'day-mode' ? undefined : 'var(--gradient-primary)',
              WebkitBackgroundClip: theme === 'day-mode' ? undefined : 'text',
              WebkitTextFillColor: theme === 'day-mode' ? undefined : 'transparent',
              backgroundClip: theme === 'day-mode' ? undefined : 'text',
            }}
          >
            Text Content *
          </label>
          <textarea
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
            rows={12}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-vertical font-mono ${
              errors.content
                ? 'border-red-600'
                : theme === 'day-mode'
                ? 'border-gray-300'
                : 'border-gray-600'
            } ${
              theme === 'day-mode'
                ? 'bg-white text-gray-900 placeholder-gray-500'
                : 'bg-gray-700 text-white placeholder-gray-400'
            }`}
            placeholder="Enter your lesson text content..."
          />
          {errors.content && (
            <p className="mt-1 text-sm text-red-600">{errors.content}</p>
          )}
        </div>
      );
    }

    if (formData.content_type_id === 'code') {
      return (
        <div className="mb-6">
          <div className="mb-4">
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
              }`}
            >
              Programming Language
            </label>
            <select
              value={codeContent.language}
              onChange={e =>
                setCodeContent(prev => ({ ...prev, language: e.target.value }))
              }
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                theme === 'day-mode'
                  ? 'border-gray-300 bg-white text-gray-900'
                  : 'border-gray-600 bg-gray-700 text-white'
              }`}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="typescript">TypeScript</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
            </select>
          </div>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
            }`}
            style={{
              background:
                theme === 'day-mode' ? undefined : 'var(--gradient-primary)',
              WebkitBackgroundClip: theme === 'day-mode' ? undefined : 'text',
              WebkitTextFillColor: theme === 'day-mode' ? undefined : 'transparent',
              backgroundClip: theme === 'day-mode' ? undefined : 'text',
            }}
          >
            Code Content *
          </label>
          <textarea
            value={codeContent.code}
            onChange={e =>
              setCodeContent(prev => ({ ...prev, code: e.target.value }))
            }
            rows={16}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-vertical font-mono text-sm ${
              errors.content
                ? 'border-red-600'
                : theme === 'day-mode'
                ? 'border-gray-300'
                : 'border-gray-600'
            } ${
              theme === 'day-mode'
                ? 'bg-gray-900 text-green-400 placeholder-gray-500'
                : 'bg-gray-800 text-green-400 placeholder-gray-400'
            }`}
            placeholder="Enter your code..."
          />
          {errors.content && (
            <p className="mt-1 text-sm text-red-600">{errors.content}</p>
          )}
        </div>
      );
    }

    return (
      <div
        className={`p-4 rounded-lg border ${
          theme === 'day-mode'
            ? 'bg-blue-50 border-blue-200 text-blue-800'
            : 'bg-blue-900/20 border-blue-500/30 text-blue-300'
        }`}
      >
        <p className="text-sm">
          Support for {formData.content_type_id} content type coming soon.
        </p>
      </div>
    );
  };

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
            Create Manual Content
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Add content to your lesson manually
          </p>
        </div>

        <div
          className={`rounded-2xl shadow-lg p-6 ${
            theme === 'day-mode'
              ? 'bg-white border border-gray-200'
              : 'bg-gray-800 border border-gray-700'
          }`}
          style={{
            background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                Content Type *
              </label>
              <select
                value={formData.content_type_id}
                onChange={handleContentTypeChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                  theme === 'day-mode'
                    ? 'border-gray-300 bg-white text-gray-900'
                    : 'border-gray-600 bg-gray-700 text-white'
                }`}
              >
                <option value="text">Text</option>
                <option value="code">Code</option>
                <option value="presentation" disabled>
                  Presentation (Coming Soon)
                </option>
                <option value="audio" disabled>
                  Audio (Coming Soon)
                </option>
                <option value="mind_map" disabled>
                  Mind Map (Coming Soon)
                </option>
              </select>
            </div>

            {renderContentEditor()}

            {errors.submit && (
              <div
                className={`mb-4 border px-4 py-3 rounded-lg ${
                  theme === 'day-mode'
                    ? 'bg-red-100 border-red-400 text-red-700'
                    : 'bg-red-900/20 border-red-500 text-red-300'
                }`}
              >
                {errors.submit}
              </div>
            )}

            <div
              className={`mb-4 p-4 border rounded-lg ${
                theme === 'day-mode'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-blue-900/20 border-blue-500/30 text-blue-300'
              }`}
            >
              <p className="text-sm">
                <strong>Note:</strong> Quality check will be automatically
                triggered after content creation.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(`/topics/${formData.topic_id}`)}
                className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                  theme === 'day-mode'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  boxShadow: 'var(--shadow-glow)',
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = 'var(--shadow-hover)';
                  }
                }}
                onMouseLeave={e => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'var(--shadow-glow)';
                  }
                }}
              >
                {loading ? 'Creating...' : 'Create Content'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};



