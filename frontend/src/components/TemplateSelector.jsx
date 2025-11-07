import React, { useState, useEffect } from 'react';
import { templatesService } from '../services/templates';
import { templateApplicationService } from '../services/template-application';

/**
 * Template Selector Component
 * Displays after lesson content creation, allows trainer to select and apply template
 */
export default function TemplateSelector({ 
  lessonId, 
  onTemplateApplied, 
  onClose,
  theme = 'day-mode' 
}) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const templates = await templatesService.getTemplates();
      setTemplates(templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    try {
      setApplying(true);
      setError(null);
      
      const result = await templateApplicationService.applyTemplate(
        selectedTemplate.template_id,
        lessonId
      );

      if (result.success && onTemplateApplied) {
        onTemplateApplied(result.data);
      }
    } catch (err) {
      console.error('Failed to apply template:', err);
      setError(err.response?.data?.error || 'Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  const formatOrderLabels = {
    text: 'Text',
    code: 'Code',
    presentation: 'Presentation',
    audio: 'Audio',
    mind_map: 'Mind Map',
    avatar_video: 'Avatar Video',
  };

  if (loading) {
    return (
      <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50`}>
        <div className={`rounded-2xl shadow-2xl p-8 ${theme === 'day-mode' ? 'bg-white' : 'bg-gray-800'}`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-300'}>Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50`}>
      <div className={`rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto ${theme === 'day-mode' ? 'bg-white' : 'bg-gray-800'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${theme === 'day-mode' ? 'border-gray-200' : 'border-gray-700'}`}>
          <div>
            <h3 className="text-xl font-semibold" style={{ 
              background: 'var(--gradient-primary)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Select Template for Lesson
            </h3>
            <p className={`text-sm mt-1 ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
              Choose a template to organize your lesson content
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${theme === 'day-mode' ? 'text-gray-400 hover:text-gray-600' : 'text-gray-400 hover:text-gray-300'}`}
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mx-6 mt-4 p-4 rounded-lg ${theme === 'day-mode' ? 'bg-red-50 text-red-700' : 'bg-red-900/20 text-red-300'}`}>
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error}
          </div>
        )}

        {/* Templates Grid */}
        <div className="p-6">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <i className={`fas fa-file-alt text-6xl mb-4 ${theme === 'day-mode' ? 'text-gray-300' : 'text-gray-600'}`}></i>
              <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
                No templates available. Please create a template first.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div
                  key={template.template_id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedTemplate?.template_id === template.template_id
                      ? theme === 'day-mode'
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-emerald-500 bg-emerald-900/20'
                      : theme === 'day-mode'
                      ? 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                      : 'border-gray-700 hover:border-emerald-500 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className={`font-semibold ${theme === 'day-mode' ? 'text-gray-900' : 'text-white'}`}>
                      {template.template_name}
                    </h4>
                    {selectedTemplate?.template_id === template.template_id && (
                      <i className="fas fa-check-circle text-emerald-500"></i>
                    )}
                  </div>

                  {template.description && (
                    <p className={`text-sm mb-3 ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
                      {template.description}
                    </p>
                  )}

                  {/* Format Order */}
                  <div className="mt-3">
                    <p className={`text-xs font-medium mb-2 ${theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'}`}>
                      Format Order:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {template.format_order?.map((format, index) => (
                        <span
                          key={index}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            theme === 'day-mode'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-emerald-900/30 text-emerald-300'
                          }`}
                        >
                          {formatOrderLabels[format] || format}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`flex justify-end gap-3 p-6 border-t ${theme === 'day-mode' ? 'border-gray-200' : 'border-gray-700'}`}>
          {onClose && (
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                theme === 'day-mode'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30 border border-emerald-500/30'
              }`}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate || applying}
            className={`px-6 py-2 rounded-lg transition-colors font-medium ${
              theme === 'day-mode'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg'
            } disabled:bg-gray-400 disabled:cursor-not-allowed`}
          >
            {applying ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Applying...
              </>
            ) : (
              <>
                <i className="fas fa-check mr-2"></i>
                Apply Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

