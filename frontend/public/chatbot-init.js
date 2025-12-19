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
    let token = localStorage.getItem('auth_token');
    
    // If no token, check for alternative token keys
    if (!token) {
      token = localStorage.getItem('token') || 
              localStorage.getItem('access_token') ||
              localStorage.getItem('jwt_token');
    }
    
    // Default user ID for Content Studio (same as used in CourseDetail.jsx)
    const DEFAULT_USER_ID = 'trainer-maya-levi';
    
    // Get user_id from localStorage or use default
    let userId = localStorage.getItem('user_id');
    
    // If no user_id in localStorage, try to extract from token or use default
    if (!userId && token) {
      try {
        // Try to decode JWT token to get user ID (if token is JWT)
        const parts = token.split('.');
        if (parts.length === 3) {
          // Looks like JWT
          const payload = JSON.parse(atob(parts[1]));
          userId = payload.user_id || payload.sub || payload.id || DEFAULT_USER_ID;
        } else {
          // Not JWT, use default
          userId = DEFAULT_USER_ID;
        }
      } catch (e) {
        // If token is not JWT or decode fails, use default
        userId = DEFAULT_USER_ID;
      }
    } else if (!userId) {
      // Fallback to default if no token
      userId = DEFAULT_USER_ID;
    }
    
    // Get tenant_id if available (optional)
    const tenantId = localStorage.getItem('tenant_id') || 'default';

    // If no token, use a default token for Content Studio
    // This allows the bot to work even without explicit authentication
    if (!token || token.trim() === '') {
      token = 'content-studio-default-token';
    }

    return { 
      token: token, 
      userId: userId || DEFAULT_USER_ID, 
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
        hasUser: !!user,
        hasToken: !!(user && user.token),
        userId: user ? user.userId : 'N/A',
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
    
    // User should always be available now (we provide defaults)
    if (!user) {
      if (initAttempts === 1) {
        console.log('⏳ RAG Bot: Initializing with default user...');
      }
      setTimeout(initChatbot, 100); // Retry after 100ms
      return;
    }
    
    console.log('✅ RAG Bot: Initializing for Content Studio...');
    
    try {
      window.initializeEducoreBot({
        // CRITICAL: Content Studio microservice name
        microservice: "CONTENT_STUDIO",
        
        // User authentication - token is required
        userId: user.userId,
        token: user.token,
        tenantId: user.tenantId,
        
        // Optional: Custom container (defaults to "#edu-bot-container")
        container: "#edu-bot-container",
        
        // Start collapsed (icon only) - user clicks to open chat
        // Note: The bot script should handle icon mode automatically
        // If these options don't work, the bot may use different parameter names
      });
      
      console.log('✅ RAG Bot: Initialized successfully!');
      
      // Function to collapse the chat widget to icon only
      function collapseChatWidget() {
        const container = document.querySelector('#edu-bot-container');
        if (!container) return;
        
        // Find all buttons - from logs, Element 2 is usually the close button
        const allButtons = Array.from(container.querySelectorAll('button'));
        
        // Element 2 from logs has class "w-8 h-8" - this is likely the close button
        const closeButton = allButtons.find(btn => {
          const classList = btn.className || '';
          // Look for the small rounded button (Element 2 from logs)
          return classList.includes('w-8') && classList.includes('h-8') && classList.includes('rounded-full');
        }) || allButtons[1]; // Fallback to 2nd button
        
        if (closeButton) {
          console.log('🖱️ Clicking close button to collapse widget...', {
            className: closeButton.className,
            index: allButtons.indexOf(closeButton)
          });
          closeButton.click();
          
          // Also hide chat panel with CSS after a short delay
          setTimeout(() => {
            const chatPanel = container.querySelector('[class*="panel"], [class*="window"], [class*="dialog"], [class*="chat"]:not([class*="icon"]):not([class*="fab"])');
            const chatInput = container.querySelector('input[type="text"], textarea, [class*="input"]');
            const messages = container.querySelector('[class*="messages"], [class*="conversation"]');
            
            [chatPanel, chatInput?.closest('[class*="panel"]'), messages?.closest('[class*="panel"]')]
              .filter(Boolean)
              .forEach(el => {
                el.style.setProperty('display', 'none', 'important');
              });
            
            // Ensure icon button (Element 1) is visible
            const iconButton = allButtons[0];
            if (iconButton) {
              iconButton.style.setProperty('display', 'block', 'important');
              iconButton.style.setProperty('visibility', 'visible', 'important');
              iconButton.style.setProperty('opacity', '1', 'important');
              console.log('✅ Icon button should be visible now');
            }
          }, 200);
        } else {
          console.warn('⚠️ Close button not found, trying CSS approach...');
          // Fallback: hide chat panel with CSS
          const chatPanel = container.querySelector('[class*="panel"], [class*="window"], [class*="dialog"]');
          const chatInput = container.querySelector('input[type="text"], textarea');
          if (chatPanel || chatInput) {
            const toHide = chatPanel || chatInput.closest('[class*="panel"], [class*="window"]');
            if (toHide) {
              toHide.style.setProperty('display', 'none', 'important');
            }
          }
        }
      }
      
      // Use MutationObserver to detect when widget opens and close it immediately
      const container = document.querySelector('#edu-bot-container');
      if (container) {
        const observer = new MutationObserver((mutations) => {
          // Check if chat panel appeared
          const chatInput = container.querySelector('input[type="text"], textarea, [class*="input"]');
          const chatPanel = container.querySelector('[class*="panel"], [class*="window"], [class*="dialog"]');
          
          if (chatInput || chatPanel) {
            console.log('🔍 Detected chat widget opened, attempting to close...');
            const closed = collapseChatWidget();
            if (!closed) {
              // Fallback: hide with CSS
              if (chatPanel) {
                chatPanel.style.setProperty('display', 'none', 'important');
              }
              if (chatInput) {
                chatInput.closest('[class*="panel"], [class*="window"]')?.style.setProperty('display', 'none', 'important');
              }
            }
          }
        });
        
        observer.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });
        
        console.log('👁️ MutationObserver set up to watch for widget opening');
      }
      
      // Also try to collapse after delays (in case MutationObserver misses it)
      setTimeout(() => {
        console.log('🔄 Attempting to collapse chat widget (first attempt)...');
        collapseChatWidget();
      }, 2000);
      
      setTimeout(() => {
        console.log('🔄 Attempting to collapse chat widget (second attempt)...');
        collapseChatWidget();
      }, 3500);
      
      setTimeout(() => {
        console.log('🔄 Attempting to collapse chat widget (third attempt)...');
        collapseChatWidget();
      }, 5000);
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

