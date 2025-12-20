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
      
      // Track if chat should be closed (prevents auto-opening)
      let chatShouldBeClosed = true; // Start with chat closed
      
      // Function to hide chat panel and show only icon
      function hideChatPanel() {
        chatShouldBeClosed = true; // Mark that chat should be closed
        const container = document.querySelector('#edu-bot-container');
        if (!container) return;
        
        // Find ALL elements in container (more aggressive approach)
        const allElements = container.querySelectorAll('*');
        
        // Find all chat panel elements with multiple selectors
        const chatPanel = container.querySelector('[class*="panel"]:not([class*="icon"]):not([class*="fab"])');
        const chatWindow = container.querySelector('[class*="window"]:not([class*="icon"])');
        const chatDialog = container.querySelector('[class*="dialog"]:not([class*="icon"])');
        const chatContainer = container.querySelector('[class*="container"]:not([class*="icon"]):not([class*="fab"])');
        const chatInput = container.querySelector('input[type="text"], textarea');
        const messages = container.querySelector('[class*="messages"], [class*="conversation"]');
        const suggestions = container.querySelector('[class*="suggestions"]');
        const greeting = container.querySelector('[class*="greeting"]');
        const header = container.querySelector('[class*="header"]:not([class*="icon"]):not([class*="fab"])');
        
        // Also find elements by common chat widget patterns
        const chatElements = Array.from(allElements).filter(el => {
          const className = el.className || '';
          const tagName = el.tagName || '';
          const id = el.id || '';
          
          // Skip icon/fab buttons
          if (className.includes('icon') || className.includes('fab') || className.includes('Fab')) {
            return false;
          }
          
          // Hide if it's a chat-related element
          return (
            className.includes('panel') ||
            className.includes('window') ||
            className.includes('dialog') ||
            className.includes('chat') ||
            className.includes('message') ||
            className.includes('conversation') ||
            className.includes('suggestion') ||
            className.includes('greeting') ||
            className.includes('header') ||
            tagName === 'INPUT' ||
            tagName === 'TEXTAREA' ||
            id.includes('chat') ||
            id.includes('panel') ||
            id.includes('window')
          );
        });
        
        // Combine all elements to hide
        const elementsToHide = [
          chatPanel, 
          chatWindow, 
          chatDialog, 
          chatContainer, 
          chatInput?.closest('[class*="panel"], [class*="window"]'), 
          messages?.closest('[class*="panel"], [class*="window"]'), 
          suggestions, 
          greeting, 
          header,
          ...chatElements
        ].filter(Boolean);
        
        // Remove duplicates
        const uniqueElements = [...new Set(elementsToHide)];
        
        // Hide all chat panel elements with maximum force
        uniqueElements.forEach(el => {
          // Check if element is actually visible
          const computedStyle = window.getComputedStyle(el);
          const isVisible = computedStyle.display !== 'none' && 
                          computedStyle.visibility !== 'hidden' && 
                          computedStyle.opacity !== '0';
          
          if (isVisible) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.style.setProperty('position', 'absolute', 'important');
            el.style.setProperty('left', '-9999px', 'important');
            el.style.setProperty('width', '0', 'important');
            el.style.setProperty('height', '0', 'important');
            el.style.setProperty('overflow', 'hidden', 'important');
          }
        });
        
        // Ensure icon button is visible (find the first button that's not the close button)
        const allButtons = Array.from(container.querySelectorAll('button'));
        const iconButton = allButtons.find(btn => {
          const className = btn.className || '';
          // Skip close button (usually has w-8 h-8 or close in class)
          if (className.includes('w-8') && className.includes('h-8')) {
            return false;
          }
          return true;
        }) || allButtons[0];
        
        if (iconButton) {
          iconButton.style.setProperty('display', 'block', 'important');
          iconButton.style.setProperty('visibility', 'visible', 'important');
          iconButton.style.setProperty('opacity', '1', 'important');
          iconButton.style.setProperty('pointer-events', 'auto', 'important');
          iconButton.style.setProperty('position', 'relative', 'important');
          iconButton.style.setProperty('z-index', '100000', 'important');
          
          // Add click listener to icon button to allow opening chat
          if (!iconButton.hasAttribute('data-icon-listener-attached')) {
            iconButton.setAttribute('data-icon-listener-attached', 'true');
            iconButton.addEventListener('click', () => {
              chatShouldBeClosed = false; // Allow chat to open when icon is clicked
              console.log('🖱️ Icon button clicked, allowing chat to open...');
            }, true);
          }
        }
        
        console.log('✅ Chat panel hidden, icon visible', {
          hiddenElements: uniqueElements.length,
          iconButtonFound: !!iconButton,
          chatShouldBeClosed
        });
      }
      
      // After initialization, ensure chat panel is hidden and only icon is visible
      setTimeout(() => {
        chatShouldBeClosed = true;
        hideChatPanel();
      }, 1000);
      
      // Set up MutationObserver to keep chat panel hidden if it tries to open
      setTimeout(() => {
        const container = document.querySelector('#edu-bot-container');
        if (container) {
          const keepChatClosedObserver = new MutationObserver(() => {
            // If chat should be closed, hide any visible chat panels
            if (chatShouldBeClosed) {
              const chatInput = container.querySelector('input[type="text"], textarea');
              const chatPanel = container.querySelector('[class*="panel"]:not([class*="icon"]):not([class*="fab"])');
              const chatWindow = container.querySelector('[class*="window"]:not([class*="icon"])');
              const chatDialog = container.querySelector('[class*="dialog"]:not([class*="icon"])');
              const suggestions = container.querySelector('[class*="suggestions"]');
              const greeting = container.querySelector('[class*="greeting"]');
              const header = container.querySelector('[class*="header"]:not([class*="icon"]):not([class*="fab"])');
              
              // Check if any chat element is visible
              const isVisible = [chatInput, chatPanel, chatWindow, chatDialog, suggestions, greeting, header].some(el => {
                if (!el) return false;
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
              });
              
              if (isVisible) {
                console.log('🔒 Chat panel tried to open, forcing it closed...');
                hideChatPanel();
              }
            }
          });
          
          keepChatClosedObserver.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
          });
          
          // Also set up an interval to continuously check and force close if needed
          const forceCloseInterval = setInterval(() => {
            if (chatShouldBeClosed) {
              const chatInput = container.querySelector('input[type="text"], textarea');
              const chatPanel = container.querySelector('[class*="panel"]:not([class*="icon"]):not([class*="fab"])');
              const chatWindow = container.querySelector('[class*="window"]:not([class*="icon"])');
              const chatDialog = container.querySelector('[class*="dialog"]:not([class*="icon"])');
              const suggestions = container.querySelector('[class*="suggestions"]');
              const greeting = container.querySelector('[class*="greeting"]');
              const header = container.querySelector('[class*="header"]:not([class*="icon"]):not([class*="fab"])');
              
              // Check if any chat element is visible
              const isVisible = [chatInput, chatPanel, chatWindow, chatDialog, suggestions, greeting, header].some(el => {
                if (!el) return false;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       rect.width > 0 && 
                       rect.height > 0;
              });
              
              if (isVisible) {
                console.log('🔒 Interval check: Chat panel is visible but should be closed, forcing close...');
                hideChatPanel();
              }
            }
          }, 500); // Check every 500ms
          
          console.log('👁️ MutationObserver and interval set up to keep chat closed');
        }
      }, 2000);
      
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
          
          // Set up click listener for close button using event delegation
          // This is more reliable than trying to find the button directly
          const setupCloseButtonListener = () => {
            // Use event delegation on the container to catch all clicks
            const clickHandler = (e) => {
              const target = e.target;
              const button = target.closest('button');
              
              if (!button) return;
              
              // Check if this is the close button
              const className = button.className || '';
              const ariaLabel = button.getAttribute('aria-label') || '';
              const title = button.getAttribute('title') || '';
              const text = button.textContent || '';
              const isCloseButton = (
                ariaLabel.toLowerCase().includes('close') ||
                title.toLowerCase().includes('close') ||
                className.toLowerCase().includes('close') ||
                text.trim() === '×' ||
                text.trim() === 'X' ||
                (className.includes('w-8') && className.includes('h-8') && className.includes('rounded-full')) ||
                // Check if button is in top-right corner (usually close button)
                (button.querySelector('svg') && button.offsetParent !== null)
              );
              
              if (isCloseButton) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('🖱️ Close button clicked, hiding chat panel...');
                
                // Mark that chat should be closed
                chatShouldBeClosed = true;
                
                // Hide immediately
                hideChatPanel();
                
                // Also hide after short delays to catch any delayed rendering
                setTimeout(() => {
                  chatShouldBeClosed = true;
                  hideChatPanel();
                }, 100);
                setTimeout(() => {
                  chatShouldBeClosed = true;
                  hideChatPanel();
                }, 300);
                setTimeout(() => {
                  chatShouldBeClosed = true;
                  hideChatPanel();
                }, 500);
                setTimeout(() => {
                  chatShouldBeClosed = true;
                  hideChatPanel();
                }, 1000);
                
                return false;
              }
            };
            
            container.addEventListener('click', clickHandler, true); // Use capture phase
            
            console.log('✅ Close button listener attached via event delegation');
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
                e.stopImmediatePropagation();
                console.log('🖱️ Close button clicked (via observer), hiding chat panel...');
                chatShouldBeClosed = true;
                hideChatPanel();
                setTimeout(() => { chatShouldBeClosed = true; hideChatPanel(); }, 100);
                setTimeout(() => { chatShouldBeClosed = true; hideChatPanel(); }, 300);
                setTimeout(() => { chatShouldBeClosed = true; hideChatPanel(); }, 500);
                setTimeout(() => { chatShouldBeClosed = true; hideChatPanel(); }, 1000);
                return false;
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

