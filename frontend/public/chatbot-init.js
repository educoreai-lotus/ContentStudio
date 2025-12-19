/**
 * Chatbot Initialization for Content Studio
 * 
 * This script initializes the RAG chatbot after user authentication.
 * The bot appears as a floating widget on all pages.
 */

(function() {
  'use strict';

  /**
   * Get current authenticated user from localStorage
   * Content Studio uses localStorage for authentication
   */
  function getCurrentUser() {
    // Get auth token from localStorage (used by api.js interceptor)
    const token = localStorage.getItem('auth_token');
    
    // For Content Studio, we can use a default user ID or extract from token
    // Since Content Studio doesn't have explicit user_id in localStorage,
    // we'll use a default or extract from token if available
    let userId = localStorage.getItem('user_id');
    
    // If no user_id in localStorage, try to extract from token or use default
    if (!userId && token) {
      try {
        // Try to decode JWT token to get user ID (if token is JWT)
        const parts = token.split('.');
        if (parts.length === 3) {
          // Looks like JWT
          const payload = JSON.parse(atob(parts[1]));
          userId = payload.user_id || payload.sub || payload.id || 'content-studio-user';
        } else {
          // Not JWT, use default
          userId = 'content-studio-user';
        }
      } catch (e) {
        // If token is not JWT or decode fails, use default
        userId = 'content-studio-user';
      }
    } else if (!userId) {
      // Fallback to default if no token
      userId = 'content-studio-user';
    }
    
    // Get tenant_id if available (optional)
    const tenantId = localStorage.getItem('tenant_id') || 'default';

    // For Content Studio, we can initialize even without token
    // The bot will work with a default user ID
    // If token exists, use it; otherwise use empty string (bot may handle it)
    return { 
      token: token || '', 
      userId: userId || 'content-studio-user', 
      tenantId 
    };
  }

  // Track initialization attempts to prevent infinite loops
  let initAttempts = 0;
  const MAX_INIT_ATTEMPTS = 100; // Max 50 seconds (100 * 500ms)

  /**
   * Initialize chatbot
   */
  function initChatbot() {
    initAttempts++;
    
    // Prevent infinite retry loop
    if (initAttempts > MAX_INIT_ATTEMPTS) {
      console.warn('⚠️ RAG Bot: Max initialization attempts reached. Bot may not be available.');
      return;
    }
    
    const user = getCurrentUser();
    
    // Log debug info every 10 attempts
    if (initAttempts % 10 === 0) {
      console.log('⏳ RAG Bot: Still waiting...', {
        attempt: initAttempts,
        hasToken: !!user.token,
        userId: user.userId,
        containerExists: !!document.querySelector('#edu-bot-container'),
        scriptLoaded: !!window.initializeEducoreBot
      });
    }
    
    // Check if script is loaded
    if (!window.initializeEducoreBot) {
      if (initAttempts === 1) {
        console.log('⏳ RAG Bot: Waiting for script to load...');
      }
      setTimeout(initChatbot, 100); // Retry after 100ms
      return;
    }
    
    // Check if container exists
    const container = document.querySelector('#edu-bot-container');
    if (!container) {
      if (initAttempts === 1) {
        console.log('⏳ RAG Bot: Waiting for container to be created...');
      }
      setTimeout(initChatbot, 100); // Retry after 100ms
      return;
    }
    
    // Initialize even without token (bot may handle it)
    // But log if no token for debugging
    if (!user.token) {
      console.log('ℹ️ RAG Bot: No auth token found, initializing with default user...');
    }
    
    console.log('✅ RAG Bot: Initializing for Content Studio...');
    
    try {
      window.initializeEducoreBot({
        // CRITICAL: Content Studio microservice name
        microservice: "CONTENT_STUDIO",
        
        // User authentication
        userId: user.userId,
        token: user.token,
        tenantId: user.tenantId,
        
        // Optional: Custom container (defaults to "#edu-bot-container")
        // container: "#edu-bot-container"
      });
      
      console.log('✅ RAG Bot: Initialized successfully!');
    } catch (error) {
      console.error('❌ RAG Bot: Initialization failed:', error);
      // Retry after 1 second
      setTimeout(initChatbot, 1000);
    }
  }

  /**
   * Start initialization when DOM is ready
   */
  function startInitialization() {
    // Wait for React app to mount (container might be created by React)
    // Check if container exists, if not wait a bit more
    const container = document.querySelector('#edu-bot-container');
    
    if (container) {
      initChatbot();
    } else {
      // Container not ready yet, wait a bit more
      setTimeout(startInitialization, 200);
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait a bit more for React to mount
      setTimeout(startInitialization, 500);
    });
  } else {
    // DOM already loaded, wait for React
    setTimeout(startInitialization, 500);
  }
  
  /**
   * Debug helper (optional, useful for troubleshooting)
   */
  window.debugRAGBot = function() {
    console.log('🔍 RAG Bot Debug Info:');
    console.log('  Script loaded:', !!window.EDUCORE_BOT_LOADED);
    console.log('  Init function exists:', typeof window.initializeEducoreBot === 'function');
    console.log('  Container exists:', !!document.querySelector('#edu-bot-container'));
    console.log('  Bundle loaded:', !!window.EDUCORE_BOT_BUNDLE_LOADED);
    console.log('  Backend URL:', window.EDUCORE_BACKEND_URL);
    const user = getCurrentUser();
    console.log('  User authenticated:', !!user);
    console.log('  User data:', user ? { userId: user.userId, hasToken: !!user.token, tenantId: user.tenantId } : null);
  };
})();

