import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { templatesService } from '../../services/templates.js';
import { useApp } from '../../context/AppContext.jsx';

export const TemplateList = () => {
  const navigate = useNavigate();
  const { theme } = useApp();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await templatesService.getTemplates();
      setTemplates(result);
    } catch (err) {
      setError(err.error?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async templateId => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await templatesService.deleteTemplate(templateId);
      loadTemplates();
    } catch (err) {
      setError(err.error?.message || 'Failed to delete template');
    }
  };

  const getFormatBadgeColor = format => {
    const colors = {
      text: 'blue',
      code: 'purple',
      presentation: 'green',
      audio: 'orange',
      mind_map: 'pink',
      avatar_video: 'indigo',
    };
    return colors[format] || 'gray';
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen p-4 sm:p-6 md:p-8 ${
          theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className={`border rounded-lg p-6 h-32 ${
                  theme === 'day-mode'
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-800 border-gray-700'
                }`}
              ></div>
            ))}
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1
              className="text-3xl md:text-4xl font-bold mb-2"
              style={{
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Templates
            </h1>
            <p
              className={`text-lg ${
                theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
              }`}
            >
              Manage your content format templates
            </p>
          </div>
          <button
            onClick={() => navigate('/templates/new')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'var(--gradient-primary)',
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}
            onMouseEnter={e => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = 'var(--shadow-hover)';
            }}
            onMouseLeave={e => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'var(--shadow-glow)';
            }}
          >
            <i className="fas fa-plus mr-2"></i>
            Create Template
          </button>
        </div>

        {error && (
          <div
            className={`border px-4 py-3 rounded-lg mb-4 ${
              theme === 'day-mode'
                ? 'bg-red-100 border-red-400 text-red-700'
                : 'bg-red-900/20 border-red-500 text-red-300'
            }`}
          >
            {error}
          </div>
        )}

        {templates.length === 0 ? (
          <div
            className={`rounded-2xl shadow-lg p-8 text-center ${
              theme === 'day-mode'
                ? 'bg-white border border-gray-200'
                : 'bg-gray-800 border border-gray-700'
            }`}
            style={{
              background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
              No templates found. Create your first template to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <div
                key={template.template_id}
                className={`rounded-2xl shadow-lg p-6 transition-all cursor-pointer ${
                  theme === 'day-mode'
                    ? 'bg-white border border-gray-200 hover:border-emerald-400'
                    : 'bg-gray-800 border border-gray-700 hover:border-emerald-500'
                }`}
                style={{
                  background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
                  boxShadow: 'var(--shadow-card)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3
                    className={`text-xl font-semibold ${
                      theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    {template.template_name}
                  </h3>
                  {template.usage_count > 0 && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        theme === 'day-mode'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-900/20 text-emerald-400'
                      }`}
                    >
                      {template.usage_count} uses
                    </span>
                  )}
                </div>

                {template.description && (
                  <p
                    className={`text-sm mb-4 ${
                      theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {template.description}
                  </p>
                )}

                <div className="mb-4">
                  <p
                    className={`text-xs font-medium mb-2 ${
                      theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    Format Order:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {template.format_order.map((format, index) => (
                      <span
                        key={index}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          theme === 'day-mode'
                            ? `bg-${getFormatBadgeColor(format)}-100 text-${getFormatBadgeColor(format)}-700`
                            : `bg-${getFormatBadgeColor(format)}-900/20 text-${getFormatBadgeColor(format)}-400`
                        }`}
                      >
                        {index + 1}. {format.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => navigate(`/templates/${template.template_id}/edit`)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all flex-1 ${
                      theme === 'day-mode'
                        ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    <i className="fas fa-edit mr-1"></i>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(template.template_id)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                      theme === 'day-mode'
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};



