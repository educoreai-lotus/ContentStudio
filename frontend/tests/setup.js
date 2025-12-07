// CRITICAL: This file must set up global BEFORE any modules are loaded
// webidl-conversions expects 'global' to exist when it's imported

// Define global immediately at the top level (before any imports)
// This must run synchronously before any module loading
// Use globalThis as the base, which is available in all modern environments
(function() {
  'use strict';
  
  // Set up global object
  if (typeof global === 'undefined') {
    // eslint-disable-next-line no-global-assign
    global = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
  }

  // Ensure global is always an object (never undefined or null)
  if (!global || typeof global !== 'object') {
    // eslint-disable-next-line no-global-assign
    global = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
  }

  // Ensure globalThis also has global reference for compatibility
  if (typeof globalThis !== 'undefined' && typeof globalThis.global === 'undefined') {
    Object.defineProperty(globalThis, 'global', {
      value: global,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }

  // Polyfill for webidl-conversions - ensure URL and URLSearchParams exist
  if (typeof globalThis !== 'undefined') {
    if (typeof globalThis.URL === 'undefined' && typeof URL !== 'undefined') {
      globalThis.URL = URL;
      if (typeof global !== 'undefined') {
        global.URL = URL;
      }
    }
    if (typeof globalThis.URLSearchParams === 'undefined' && typeof URLSearchParams !== 'undefined') {
      globalThis.URLSearchParams = URLSearchParams;
      if (typeof global !== 'undefined') {
        global.URLSearchParams = URLSearchParams;
      }
    }
  }

  // Additional polyfill for webidl-conversions - ensure process exists
  if (typeof globalThis !== 'undefined' && typeof globalThis.process === 'undefined') {
    globalThis.process = {
      env: {},
      version: '',
      versions: {},
      platform: 'browser',
      nextTick: (fn) => setTimeout(fn, 0),
    };
    if (typeof global !== 'undefined') {
      global.process = globalThis.process;
    }
  }
})();

// Import polyfills AFTER global is set up
import { TextEncoder, TextDecoder } from 'util';

// Set up TextEncoder and TextDecoder
if (typeof globalThis !== 'undefined') {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
  
  if (typeof global !== 'undefined') {
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
  }
}

// Import testing library after polyfills are set up
import '@testing-library/jest-dom';
