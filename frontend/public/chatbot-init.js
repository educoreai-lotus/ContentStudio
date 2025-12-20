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
        
        // Start as icon only - user must click to open chat
        autoOpen: false,
        initialMode: 'icon',
      });
      
      console.log('✅ RAG Bot: Initialized successfully!');
      
      // Function to hide chat panel and show only icon
      function hideChatPanel() {
        const container = document.querySelector('#edu-bot-container');
        if (!container) return;
        
        // Find all chat panel elements
        const chatPanel = container.querySelector('[class*="panel"]:not([class*="icon"]):not([class*="fab"])');
        const chatWindow = container.querySelector('[class*="window"]:not([class*="icon"])');
        const chatDialog = container.querySelector('[class*="dialog"]:not([class*="icon"])');
        const chatContainer = container.querySelector('[class*="container"]:not([class*="icon"]):not([class*="fab"])');
        const chatInput = container.querySelector('input[type="text"], textarea');
        const messages = container.querySelector('[class*="messages"], [class*="conversation"]');
        const suggestions = container.querySelector('[class*="suggestions"]');
        const greeting = container.querySelector('[class*="greeting"]');
        const header = container.querySelector('[class*="header"]:not([class*="icon"]):not([class*="fab"])');
        
        // Hide all chat panel elements
        [chatPanel, chatWindow, chatDialog, chatContainer, chatInput?.closest('[class*="panel"], [class*="window"]'), messages?.closest('[class*="panel"], [class*="window"]'), suggestions, greeting, header]
          .filter(Boolean)
          .forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
          });
        
        // Ensure icon button is visible
        const iconButton = container.querySelector('button[class*="icon"], button[class*="fab"], button:first-child');
        if (iconButton) {
          iconButton.style.setProperty('display', 'block', 'important');
          iconButton.style.setProperty('visibility', 'visible', 'important');
          iconButton.style.setProperty('opacity', '1', 'important');
          iconButton.style.setProperty('pointer-events', 'auto', 'important');
        }
        
        console.log('✅ Chat panel hidden, icon visible');
      }
      
      // After initialization, ensure chat panel is hidden and only icon is visible
      setTimeout(() => {
        hideChatPanel();
      }, 1000);
      
      // Set up event listener for close button (X)
      setTimeout(() => {
        const container = document.querySelector('#edu-bot-container');
        if (container) {
          // Find close button - could be button with X, aria-label="close", or class with "close"
          const findCloseButton = () => {
            // Try multiple selectors for close button
            const selectors = [
              'button[aria-label*="close" i]',
              'button[aria-label*="Close" i]',
              'button[class*="close" i]',
              'button[class*="Close" i]',
              'button:has(svg[class*="close"])',
              'button:has(> svg)',
              'button[title*="close" i]',
              'button[title*="Close" i]',
            ];
            
            for (const selector of selectors) {
              try {
                const buttons = Array.from(container.querySelectorAll('button'));
                // Look for button with X icon or close-related attributes
                const closeBtn = buttons.find(btn => {
                  const ariaLabel = btn.getAttribute('aria-label') || '';
                  const title = btn.getAttribute('title') || '';
                  const className = btn.className || '';
                  const text = btn.textContent || '';
                  
                  return (
                    ariaLabel.toLowerCase().includes('close') ||
                    title.toLowerCase().includes('close') ||
                    className.toLowerCase().includes('close') ||
                    text.trim() === '×' ||
                    text.trim() === 'X' ||
                    (btn.querySelector('svg') && className.includes('w-8') && className.includes('h-8'))
                  );
                });
                
                if (closeBtn) return closeBtn;
              } catch (e) {
                // Continue to next selector
              }
            }
            
            // Fallback: find button with small size (usually close button)
            const allButtons = Array.from(container.querySelectorAll('button'));
            return allButtons.find(btn => {
              const className = btn.className || '';
              return className.includes('w-8') && className.includes('h-8') && className.includes('rounded-full');
            }) || allButtons[1]; // Fallback to 2nd button
          };
          
          // Set up click listener for close button
          const setupCloseButtonListener = () => {
            const closeButton = findCloseButton();
            if (closeButton) {
              // Remove any existing listeners
              const newCloseButton = closeButton.cloneNode(true);
              closeButton.parentNode?.replaceChild(newCloseButton, closeButton);
              
              // Add click listener
              newCloseButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Close button clicked, hiding chat panel...');
                hideChatPanel();
              }, true); // Use capture phase to catch early
              
              console.log('✅ Close button listener attached');
            } else {
              // Retry after a delay if button not found yet
              setTimeout(setupCloseButtonListener, 500);
            }
          };
          
          // Try to set up listener immediately
          setupCloseButtonListener();
          
          // Also use MutationObserver to catch when close button is added
          const observer = new MutationObserver(() => {
            const closeButton = findCloseButton();
            if (closeButton && !closeButton.hasAttribute('data-close-listener-attached')) {
              closeButton.setAttribute('data-close-listener-attached', 'true');
              closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Close button clicked (via observer), hiding chat panel...');
                hideChatPanel();
              }, true);
              console.log('✅ Close button listener attached via observer');
            }
          });
          
          observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: false,
          });
          
          // Disconnect observer after 30 seconds to prevent memory leaks
          setTimeout(() => {
            observer.disconnect();
          }, 30000);
        }
      }, 2000);
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

