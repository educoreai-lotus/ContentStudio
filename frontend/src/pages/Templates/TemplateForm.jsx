import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { templatesService } from '../../services/templates.js';
import { useApp } from '../../context/AppContext.jsx';

const AVAILABLE_FORMATS = [
  { value: 'text_audio', label: 'Text & Audio' },
  { value: 'code', label: 'Code' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'mind_map', label: 'Mind Map' },
  { value: 'avatar_video', label: 'Avatar Video' },
];

export const TemplateForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { theme } = useApp();
  const isEdit = !!id;
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = searchParams.get('redirect');

  const [formData, setFormData] = useState({
    template_name: '',
    format_order: [],
  });
  const [availableFormats, setAvailableFormats] = useState([...AVAILABLE_FORMATS]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const template = await templatesService.getTemplate(parseInt(id));
      setFormData({
        template_name: template.template_name,
        format_order: template.format_order,
      });
      updateAvailableFormats(template.format_order);
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to load template' });
    } finally {
      setLoading(false);
    }
  };

  const updateAvailableFormats = selectedFormats => {
    const usedFormats = new Set(selectedFormats);
    setAvailableFormats(
      AVAILABLE_FORMATS.filter(format => !usedFormats.has(format.value))
    );
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAddFormat = format => {
    const newFormatOrder = [...formData.format_order, format.value];
    setFormData(prev => ({ ...prev, format_order: newFormatOrder }));
    updateAvailableFormats(newFormatOrder);
  };

  const handleRemoveFormat = index => {
    const newFormatOrder = formData.format_order.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, format_order: newFormatOrder }));
    updateAvailableFormats(newFormatOrder);
  };

  const handleMoveFormat = (index, direction) => {
    const newFormatOrder = [...formData.format_order];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= newFormatOrder.length) return;

    [newFormatOrder[index], newFormatOrder[newIndex]] = [
      newFormatOrder[newIndex],
      newFormatOrder[index],
    ];

    setFormData(prev => ({ ...prev, format_order: newFormatOrder }));
  };

  const handleSubmit = async e => {
    e.preventDefault();

    // Validation
    const newErrors = {};
    if (!formData.template_name.trim()) {
      newErrors.template_name = 'Template name is required';
    }
    if (formData.format_order.length === 0) {
      newErrors.format_order = 'At least one format is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      if (isEdit) {
        await templatesService.updateTemplate(parseInt(id), {
          template_name: formData.template_name,
          format_order: formData.format_order,
        });
      } else {
        await templatesService.createTemplate({
          template_name: formData.template_name,
          format_order: formData.format_order,
          created_by: 'trainer123', // TODO: Get from auth
        });
      }

      if (redirectTo) {
        navigate(redirectTo);
      } else {
        navigate('/templates');
      }
    } catch (err) {
      setErrors({ submit: err.error?.message || 'Failed to save template' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <div
        className={`min-h-screen p-4 sm:p-6 md:p-8 ${
          theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
        }`}
      >
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className={`h-32 rounded-lg ${theme === 'day-mode' ? 'bg-white' : 'bg-gray-800'}`}></div>
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
            {isEdit ? 'Edit Template' : 'Create Template'}
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Define the order and structure of content formats
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
                style={{
                  background:
                    theme === 'day-mode' ? undefined : 'var(--gradient-primary)',
                  WebkitBackgroundClip: theme === 'day-mode' ? undefined : 'text',
                  WebkitTextFillColor: theme === 'day-mode' ? undefined : 'transparent',
                  backgroundClip: theme === 'day-mode' ? undefined : 'text',
                }}
              >
                Template Name *
              </label>
              <input
                type="text"
                name="template_name"
                value={formData.template_name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                  errors.template_name
                    ? 'border-red-600'
                    : theme === 'day-mode'
                    ? 'border-gray-300'
                    : 'border-gray-600'
                } ${
                  theme === 'day-mode'
                    ? 'bg-white text-gray-900 placeholder-gray-500'
                    : 'bg-gray-700 text-white placeholder-gray-400'
                }`}
                placeholder="e.g., Standard Lesson Template"
              />
              {errors.template_name && (
                <p className="mt-1 text-sm text-red-600">{errors.template_name}</p>
              )}
            </div>

            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                Format Order * (Drag to reorder)
              </label>
              {errors.format_order && (
                <p className="mb-2 text-sm text-red-600">{errors.format_order}</p>
              )}

              {/* Selected Formats */}
              <div className="space-y-2 mb-4">
                {formData.format_order.map((format, index) => {
                  const formatLabel = AVAILABLE_FORMATS.find(f => f.value === format)?.label || format;
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-3 rounded-lg border ${
                        theme === 'day-mode'
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-gray-700 border-gray-600'
                      }`}
                    >
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          theme === 'day-mode'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-emerald-900/20 text-emerald-400'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={`flex-1 ${
                          theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                        }`}
                      >
                        {formatLabel}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveFormat(index, 'up')}
                          disabled={index === 0}
                          className={`p-1 rounded ${
                            index === 0
                              ? 'opacity-50 cursor-not-allowed'
                              : theme === 'day-mode'
                              ? 'text-gray-600 hover:text-gray-900'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          <i className="fas fa-arrow-up"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveFormat(index, 'down')}
                          disabled={index === formData.format_order.length - 1}
                          className={`p-1 rounded ${
                            index === formData.format_order.length - 1
                              ? 'opacity-50 cursor-not-allowed'
                              : theme === 'day-mode'
                              ? 'text-gray-600 hover:text-gray-900'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          <i className="fas fa-arrow-down"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFormat(index)}
                          className={`p-1 rounded ${
                            theme === 'day-mode'
                              ? 'text-red-600 hover:text-red-700'
                              : 'text-red-400 hover:text-red-300'
                          }`}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Available Formats */}
              {availableFormats.length > 0 && (
                <div>
                  <p
                    className={`text-sm mb-2 ${
                      theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    Add Format:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableFormats.map(format => (
                      <button
                        key={format.value}
                        type="button"
                        onClick={() => handleAddFormat(format)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                          theme === 'day-mode'
                            ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                      >
                        <i className="fas fa-plus mr-1"></i>
                        {format.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-vertical ${
                  theme === 'day-mode'
                    ? 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    : 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                }`}
                placeholder="Additional notes about this template"
              />
            </div>

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

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  // If there's a redirect parameter, go back to it
                  if (redirectTo) {
                    navigate(redirectTo);
                  } else {
                    // Otherwise, go back in history (previous page)
                    navigate(-1);
                  }
                }}
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
                    Saving...
                  </span>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    {isEdit ? 'Update Template' : 'Create Template'}
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



