import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { templatesService } from '../../services/templates.js';
import { topicsService } from '../../services/topics.js';
import { useApp } from '../../context/AppContext.jsx';
import { useNavigate } from 'react-router-dom';

const FORMAT_LABELS = {
  text: 'Text',
  audio: 'Audio',
  code: 'Code',
  presentation: 'Presentation',
  mind_map: 'Mind Map',
  avatar_video: 'Avatar Video',
};

export function TemplateSelectionModal({
  open,
  onClose,
  topicId,
  onApplied,
  trainerId,
  hasAvatarVideo,
}) {
  const { theme } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await templatesService.getTemplates();
      // Always show all templates - don't filter by hasAvatarVideo
      // Users should be able to see and select any template
      const filtered = result || [];

      setTemplates(filtered);
    } catch (err) {
      setError(err?.error?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async templateId => {
    try {
      setApplying(true);
      await topicsService.applyTemplate(topicId, templateId);
      const template = templates.find(t => t.template_id === templateId);
      if (onApplied) {
        onApplied(templateId, template);
      }
      onClose();
    } catch (err) {
      setError(err?.error?.message || 'Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  const handleGenerateAI = async () => {
    try {
      setAiGenerating(true);
      setError(null);
      setAiFeedback(null);
      const response = await templatesService.generateWithAI({
        topic_id: topicId,
        trainer_id: trainerId,
      });

      // Show AI feedback if available
      if (response.aiFeedback) {
        setAiFeedback(response.aiFeedback);
        // Auto-hide after 10 seconds
        setTimeout(() => {
          setAiFeedback(null);
        }, 10000);
      }

      // Apply template immediately after generation
      await topicsService.applyTemplate(topicId, response.template_id);
      if (onApplied) {
        onApplied(response.template_id, response, response.aiFeedback);
      }
      onClose();
    } catch (err) {
      setError(err?.error?.message || 'Failed to generate template with AI');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreateManual = () => {
    const redirectParam = encodeURIComponent(`/topics/${topicId}/content`);
    navigate(`/templates/new?redirect=${redirectParam}`);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-4xl rounded-2xl shadow-2xl ${
          theme === 'day-mode' ? 'bg-white text-gray-900' : 'bg-slate-900 text-gray-100'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/20">
          <div>
            <h2 className="text-2xl font-semibold">Choose Lesson Template</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select how you want to arrange the five mandatory formats (Text + Audio always together).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200/40 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-200/20 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCreateManual}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
            >
              <i className="fas fa-edit mr-2"></i>
              Create Template Manually
            </button>
            <button
              onClick={handleGenerateAI}
              disabled={aiGenerating}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium transition"
            >
              {aiGenerating ? (
                <span className="flex items-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i> Generating with AI...
                </span>
              ) : (
                <>
                  <i className="fas fa-robot mr-2"></i>
                  Generate Template with AI
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Need a specific structure? Save a custom template and reuse it across lessons.
          </p>
        </div>

        {/* AI Feedback Message */}
        {aiFeedback && (
          <div className="px-6 py-4">
            <div
              className={`relative p-4 rounded-lg border ${
                theme === 'day-mode'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-blue-900/20 border-blue-500/30 text-blue-300'
              }`}
            >
              <button
                onClick={() => setAiFeedback(null)}
                className={`absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition ${
                  theme === 'day-mode' ? 'text-blue-600' : 'text-blue-400'
                }`}
              >
                <i className="fas fa-times text-xs"></i>
              </button>
              <div className="flex items-start gap-3 pr-6">
                <div className={`flex-shrink-0 mt-1 ${
                  theme === 'day-mode' ? 'text-blue-600' : 'text-blue-400'
                }`}>
                  <i className="fas fa-lightbulb text-lg"></i>
                </div>
                <div className="flex-1">
                  <p className="font-semibold mb-1">AI Template Selection Reasoning</p>
                  <p className="text-sm leading-relaxed">{aiFeedback}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div
              className={`mb-4 px-4 py-3 rounded-lg ${
                theme === 'day-mode'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-red-900/20 text-red-300 border border-red-500/30'
              }`}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(item => (
                <div
                  key={item}
                  className={`rounded-xl p-6 animate-pulse ${
                    theme === 'day-mode' ? 'bg-gray-100' : 'bg-slate-800'
                  }`}
                >
                  <div className="h-6 w-1/2 bg-gray-300/60 rounded mb-4"></div>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-3 bg-gray-300/50 rounded"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div
              className={`rounded-xl border-2 border-dashed p-6 text-center ${
                theme === 'day-mode'
                  ? 'border-gray-300 text-gray-500'
                  : 'border-gray-600 text-gray-400'
              }`}
            >
              No templates available yet. Create one manually or generate with AI.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(template => (
                <div
                  key={template.template_id}
                  className={`rounded-2xl border p-5 shadow-sm transition ${
                    theme === 'day-mode'
                      ? 'bg-white border-gray-200 hover:border-emerald-400 hover:shadow-lg'
                      : 'bg-slate-800 border-gray-700 hover:border-emerald-500 hover:shadow-emerald-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">{template.template_name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {template.template_type?.replace(/_/g, ' ') || 'template'}
                      </p>
                    </div>
                    {template.usage_count > 0 && (
                      <span className="text-xs px-2 py-1 bg-emerald-600/20 text-emerald-500 rounded-full">
                        {template.usage_count} uses
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {template.format_order?.map((format, index) => (
                      <span
                        key={`${template.template_id}-${format}`}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-emerald-600/10 text-emerald-500 border border-emerald-500/30"
                      >
                        <span className="text-xs opacity-60">{index + 1}</span>
                        {FORMAT_LABELS[format] || format}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => handleApply(template.template_id)}
                    disabled={applying}
                    className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-60"
                  >
                    {applying ? 'Applying...' : 'Use this template'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

TemplateSelectionModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  topicId: PropTypes.number.isRequired,
  onApplied: PropTypes.func,
  trainerId: PropTypes.string,
  hasAvatarVideo: PropTypes.bool,
};

TemplateSelectionModal.defaultProps = {
  onApplied: null,
  trainerId: undefined,
  hasAvatarVideo: false,
};

