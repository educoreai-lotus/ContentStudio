import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TemplateSelector from '../../components/TemplateSelector';
import { useApp } from '../../context/AppContext';

/**
 * Topic Content Manager
 * Manages content creation and template application for a lesson
 * After content is created, shows template selector
 */
export default function TopicContentManager() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { theme } = useApp();
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [contentCreated, setContentCreated] = useState(false);

  const handleContentCreated = () => {
    setContentCreated(true);
    setShowTemplateSelector(true);
  };

  const handleTemplateApplied = (result) => {
    console.log('Template applied:', result);
    setShowTemplateSelector(false);
    // Navigate to lesson view
    navigate(`/lessons/${topicId}/view`);
  };

  return (
    <div className={`min-h-screen ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1
          className="text-3xl font-bold mb-6"
          style={{
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Manage Lesson Content
        </h1>

        {/* Content Creation Section */}
        <div className={`p-6 rounded-lg mb-6 ${
          theme === 'day-mode'
            ? 'bg-white border border-gray-200'
            : 'bg-gray-800 border border-gray-700'
        }`}>
          <h2 className={`text-xl font-semibold mb-4 ${
            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
          }`}>
            Create Content
          </h2>
          <p className={`mb-4 ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
            Add content items to your lesson (text, code, presentation, audio, mind map)
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/content/manual/${topicId}`)}
              className={`px-4 py-2 rounded-lg ${
                theme === 'day-mode'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              <i className="fas fa-edit mr-2"></i>
              Manual Content
            </button>
            <button
              onClick={() => navigate(`/content/ai/${topicId}`)}
              className={`px-4 py-2 rounded-lg ${
                theme === 'day-mode'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <i className="fas fa-robot mr-2"></i>
              AI Content
            </button>
          </div>
        </div>

        {/* Template Application Section */}
        {contentCreated && (
          <div className={`p-6 rounded-lg ${
            theme === 'day-mode'
              ? 'bg-white border border-gray-200'
              : 'bg-gray-800 border border-gray-700'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 ${
              theme === 'day-mode' ? 'text-gray-900' : 'text-white'
            }`}>
              Apply Template
            </h2>
            <p className={`mb-4 ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
              Select a template to organize your lesson content
            </p>
            <button
              onClick={() => setShowTemplateSelector(true)}
              className={`px-4 py-2 rounded-lg ${
                theme === 'day-mode'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              <i className="fas fa-layer-group mr-2"></i>
              Select Template
            </button>
          </div>
        )}

        {/* View Lesson Button */}
        <div className="mt-6">
          <button
            onClick={() => navigate(`/lessons/${topicId}/view`)}
            className={`px-6 py-3 rounded-lg ${
              theme === 'day-mode'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            <i className="fas fa-eye mr-2"></i>
            View Lesson
          </button>
        </div>
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <TemplateSelector
          lessonId={topicId}
          onTemplateApplied={handleTemplateApplied}
          onClose={() => setShowTemplateSelector(false)}
          theme={theme}
        />
      )}
    </div>
  );
}



