import React, { useEffect, useRef } from 'react';

/**
 * StatusStream Component
 * Displays real-time status messages during content creation process
 * 
 * @param {Array} messages - Array of status messages with { message, timestamp }
 * @param {string} theme - Theme mode ('day-mode' or 'night-mode')
 */
export const StatusStream = ({ messages = [], theme = 'day-mode' }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!messages || messages.length === 0) {
    return null;
  }

  const getMessageType = (message) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('failed') || lowerMessage.includes('error')) {
      return 'error';
    }
    if (lowerMessage.includes('completed successfully') || lowerMessage.includes('success')) {
      return 'success';
    }
    if (lowerMessage.includes('starting') || lowerMessage.includes('generating') || lowerMessage.includes('checking') || lowerMessage.includes('examining')) {
      return 'info';
    }
    return 'neutral';
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '⚠️';
      case 'info':
        return '⟳';
      default:
        return '•';
    }
  };

  const getMessageColor = (type) => {
    if (theme === 'day-mode') {
      switch (type) {
        case 'success':
          return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'error':
          return 'bg-red-50 text-red-700 border-red-200';
        case 'info':
          return 'bg-blue-50 text-blue-700 border-blue-200';
        default:
          return 'bg-gray-50 text-gray-700 border-gray-200';
      }
    } else {
      switch (type) {
        case 'success':
          return 'bg-emerald-900/20 text-emerald-300 border-emerald-500/40';
        case 'error':
          return 'bg-red-900/20 text-red-300 border-red-500/40';
        case 'info':
          return 'bg-blue-900/20 text-blue-300 border-blue-500/40';
        default:
          return 'bg-gray-800/50 text-gray-300 border-gray-600/40';
      }
    }
  };

  return (
    <div className={`mt-4 space-y-2 max-h-64 overflow-y-auto ${theme === 'day-mode' ? 'bg-white' : 'bg-gray-800/30'} rounded-lg p-3`}>
      <div className={`text-xs font-semibold mb-2 ${theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}`}>
        Status Updates
      </div>
      {messages.map((msg, index) => {
        const type = getMessageType(msg.message);
        const icon = getMessageIcon(type);
        const colorClass = getMessageColor(type);
        
        return (
          <div
            key={index}
            className={`text-xs px-3 py-2 rounded border ${colorClass} flex items-start gap-2`}
          >
            <span className="font-semibold flex-shrink-0">{icon}</span>
            <span className="flex-1">{msg.message}</span>
            {msg.timestamp && (
              <span className={`text-xs flex-shrink-0 ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};

