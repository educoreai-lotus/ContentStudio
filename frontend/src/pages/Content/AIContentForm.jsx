import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { aiGenerationService } from '../../services/ai-generation.js';
import { useApp } from '../../context/AppContext.jsx';

export const AIContentForm = () => {
  const navigate = useNavigate();
  const { topicId } = useParams();
  const { theme } = useApp();
  const [formData, setFormData] = useState({
    topic_id: topicId ? parseInt(topicId) : null,
    content_type_id: 'text',
    prompt: '',
    template_id: null,
    template_variables: {},
    language: 'javascript',
    style: 'educational',
    difficulty: 'intermediate',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(null);

  useEffect(() => {
    if (!topicId) {
      setErrors({ submit: 'Topic ID is required' });
    }
  }, [topicId]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.topic_id) {
      setErrors({ submit: 'Topic ID is required' });
      return;
    }

    if (!formData.prompt && !formData.template_id) {
      setErrors({ prompt: 'Either prompt or template is required' });
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      setGenerationProgress('Generating content...');

      const content = await aiGenerationService.generate({
        topic_id: formData.topic_id,
        content_type_id: formData.content_type_id,
        prompt: formData.prompt || undefined,
        template_id: formData.template_id || undefined,
        template_variables: formData.template_variables,
        language: formData.content_type_id === 'code' ? formData.language : undefined,
        style: formData.style,
        difficulty: formData.difficulty,
      });

      setGenerationProgress('Content generated successfully!');
      setTimeout(() => {
        navigate(`/topics/${formData.topic_id}`);
      }, 1500);
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to generate content' });
      setGenerationProgress(null);
    } finally {
      setLoading(false);
    }
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
            AI-Assisted Content Creation
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Generate content using AI assistance
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
                name="content_type_id"
                value={formData.content_type_id}
                onChange={handleChange}
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

            {formData.content_type_id === 'code' && (
              <div className="mb-6">
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                  }`}
                >
                  Programming Language
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
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
                  <option value="typescript">TypeScript</option>
                </select>
              </div>
            )}

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
                Prompt *
              </label>
              <textarea
                name="prompt"
                value={formData.prompt}
                onChange={handleChange}
                rows={6}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-vertical ${
                  errors.prompt
                    ? 'border-red-600'
                    : theme === 'day-mode'
                    ? 'border-gray-300'
                    : 'border-gray-600'
                } ${
                  theme === 'day-mode'
                    ? 'bg-white text-gray-900 placeholder-gray-500'
                    : 'bg-gray-700 text-white placeholder-gray-400'
                }`}
                placeholder="Describe what you want to generate. For example: 'Generate a lesson about JavaScript closures for intermediate learners'"
              />
              {errors.prompt && (
                <p className="mt-1 text-sm text-red-600">{errors.prompt}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                  }`}
                >
                  Style
                </label>
                <select
                  name="style"
                  value={formData.style}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                    theme === 'day-mode'
                      ? 'border-gray-300 bg-white text-gray-900'
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                >
                  <option value="educational">Educational</option>
                  <option value="conversational">Conversational</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                  }`}
                >
                  Difficulty
                </label>
                <select
                  name="difficulty"
                  value={formData.difficulty}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                    theme === 'day-mode'
                      ? 'border-gray-300 bg-white text-gray-900'
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {generationProgress && (
              <div
                className={`mb-4 p-4 border rounded-lg ${
                  theme === 'day-mode'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-blue-900/20 border-blue-500/30 text-blue-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-sm">{generationProgress}</p>
                </div>
              </div>
            )}

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
                <strong>Note:</strong> AI generation may take a few moments. Quality check
                will be automatically triggered after generation.
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
                {loading ? (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-spinner fa-spin"></i>
                    Generating...
                  </span>
                ) : (
                  <>
                    <i className="fas fa-magic mr-2"></i>
                    Generate Content
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};



