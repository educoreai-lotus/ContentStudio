import { useState, useCallback } from 'react';

/**
 * useStatusStream Hook
 * Manages status messages stream
 * 
 * @returns {Object} { messages, addMessage, clearMessages }
 */
export const useStatusStream = () => {
  const [messages, setMessages] = useState([]);

  const addMessage = useCallback((message) => {
    setMessages((prev) => {
      // Check if message already exists to avoid duplicates
      const messageText = typeof message === 'string' ? message : message.message;
      const isDuplicate = prev.some(
        (msg) => (typeof msg === 'string' ? msg : msg.message) === messageText
      );
      
      if (isDuplicate) {
        return prev;
      }

      // Add new message
      const newMessage = typeof message === 'string' 
        ? { message, timestamp: new Date().toISOString() }
        : { ...message, timestamp: message.timestamp || new Date().toISOString() };
      
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
export const isImportant = (message) => {
  const t = message.toLowerCase();
  return (
    t.includes('passed') ||
    t.includes('failed') ||
    t.includes('success') ||
    t.includes('rejected') ||
    t.includes('error') ||
    t.includes('completed successfully')
  );
};

