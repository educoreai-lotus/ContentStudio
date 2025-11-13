import { useState, useCallback } from 'react';
import { normalizeStatusMessage, shouldShowPopup } from '../utils/statusMessageNormalizer.js';

/**
 * useStatusStream Hook
 * Manages status messages stream with normalized, user-friendly messages
 * 
 * @returns {Object} { messages, addMessage, clearMessages }
 */
export const useStatusStream = () => {
  const [messages, setMessages] = useState([]);

  const addMessage = useCallback((message) => {
    setMessages((prev) => {
      // Normalize message to be user-friendly
      const messageText = typeof message === 'string' ? message : (message.message || '');
      const normalizedMessage = normalizeStatusMessage(messageText);
      
      // Don't add popup messages to stream (they go to popup only)
      if (shouldShowPopup(normalizedMessage)) {
        return prev;
      }

      // Check if message already exists to avoid duplicates
      const isDuplicate = prev.some(
        (msg) => {
          const msgText = typeof msg === 'string' ? msg : msg.message;
          return msgText === normalizedMessage;
        }
      );
      
      if (isDuplicate) {
        return prev;
      }

      // Add new normalized message
      const newMessage = {
        message: normalizedMessage,
        timestamp: typeof message === 'object' && message.timestamp 
          ? message.timestamp 
          : new Date().toISOString()
      };
      
      return [...prev, newMessage];
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    addMessage,
    clearMessages,
  };
};

/**
 * Helper function to check if a message is important (should show popup)
 * @param {string} message - Message text
 * @returns {boolean} True if message is important
 */
export const isImportant = shouldShowPopup;

