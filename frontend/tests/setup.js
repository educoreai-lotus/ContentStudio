// CRITICAL: This file must set up global BEFORE any modules are loaded
// webidl-conversions expects 'global' to exist when it's imported

// Immediately define global before ANY imports or module loading
// This must be the FIRST thing that runs
(function() {
  'use strict';
  
  // Set up global = globalThis immediately (before any imports)
  if (typeof global === 'undefined') {
    if (typeof globalThis !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      global = globalThis;
    } else if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      global = window;
    } else {
      // Create a proper object with get method
      // eslint-disable-next-line no-global-assign
      global = Object.create(null);
    }
  }

  // Ensure global is an object (not undefined) and has required properties
  if (typeof global === 'undefined' || global === null) {
    // eslint-disable-next-line no-global-assign
    global = Object.create(null);
  }

  // Make sure global.get is available (needed by webidl-conversions)
  // webidl-conversions uses global.get() to access properties
  if (typeof global.get !== 'function') {
    Object.defineProperty(global, 'get', {
      value: function(key) {
        return this[key];
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
})();

// Import polyfills
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
