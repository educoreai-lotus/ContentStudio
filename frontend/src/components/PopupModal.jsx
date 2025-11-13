import React, { useEffect } from 'react';

/**
 * PopupModal Component
 * Displays important events as centered modal popups
 * 
 * @param {Object} popupData - Popup data with { type, title, message, details }
 * @param {Function} onClose - Close handler
 * @param {string} theme - Theme mode ('day-mode' or 'night-mode')
 * @param {boolean} autoClose - Auto-close after delay (for success messages)
 */
export const PopupModal = ({ popupData, onClose, theme = 'day-mode', autoClose = false }) => {
  useEffect(() => {
    if (autoClose && popupData && popupData.type === 'success') {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoClose, popupData, onClose]);

  if (!popupData) {
    return null;
  }

  const getIcon = () => {
    switch (popupData.type) {
      case 'success':
        return '✓';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getIconColor = () => {
    switch (popupData.type) {
      case 'success':
        return theme === 'day-mode' ? 'text-emerald-600' : 'text-emerald-400';
      case 'error':
        return theme === 'day-mode' ? 'text-red-600' : 'text-red-400';
      case 'warning':
        return theme === 'day-mode' ? 'text-yellow-600' : 'text-yellow-400';
      default:
        return theme === 'day-mode' ? 'text-blue-600' : 'text-blue-400';
    }
  };

  const getGradient = () => {
    switch (popupData.type) {
      case 'success':
        return 'from-emerald-500 to-emerald-600';
      case 'error':
        return 'from-red-500 to-red-600';
      case 'warning':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-blue-500 to-blue-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blurred background */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative rounded-xl shadow-2xl max-w-md w-full mx-4 ${
          theme === 'day-mode'
            ? 'bg-white border border-gray-200'
            : 'bg-gray-800 border border-gray-700'
        }`}
      >
        {/* Icon */}
        <div className={`flex justify-center pt-6 ${getIconColor()}`}>
          <div className="text-5xl font-bold">{getIcon()}</div>
        </div>

        {/* Title with gradient */}
        <div className="px-6 pt-4">
          <h3 className={`text-2xl font-bold text-center bg-gradient-to-r ${getGradient()} bg-clip-text text-transparent`}>
            {popupData.title || popupData.message}
          </h3>
        </div>

        {/* Message */}
        <div className={`px-6 pt-3 pb-2 text-center ${
          theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
        }`}>
          <p className="text-sm font-medium">{popupData.message}</p>
        </div>

        {/* Reason/Error details - Show short reason */}
        {popupData.reason && (
          <div className={`px-6 pt-3 pb-3 ${
            theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-700/50'
          } rounded-lg mx-4 mb-3`}>
            <p className={`text-xs font-semibold mb-2 ${
              theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
            }`}>
              Reason:
            </p>
            <p className={`text-xs leading-relaxed ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              {popupData.reason}
            </p>
          </div>
        )}

        {/* Feedback from AI - Show detailed feedback if available */}
        {popupData.feedback && (
          <div className={`px-6 pt-3 pb-3 ${
            theme === 'day-mode' ? 'bg-blue-50' : 'bg-blue-900/20'
          } rounded-lg mx-4 mb-3`}>
            <p className={`text-xs font-semibold mb-2 ${
              theme === 'day-mode' ? 'text-blue-700' : 'text-blue-300'
            }`}>
              Detailed Feedback:
            </p>
            <p className={`text-xs leading-relaxed ${
              theme === 'day-mode' ? 'text-blue-600' : 'text-blue-400'
            }`}>
              {popupData.feedback}
            </p>
          </div>
        )}

        {/* Guidance - Friendly one-line help */}
        {popupData.guidance && (
          <div className={`px-6 pb-2 text-center ${
            theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
          }`}>
            <p className="text-xs italic">{popupData.guidance}</p>
          </div>
        )}

        {/* OK Button */}
        <div className="px-6 pb-6 flex justify-center">
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              popupData.type === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : popupData.type === 'error'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

