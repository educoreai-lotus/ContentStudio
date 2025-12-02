// CRITICAL: This file must set up global BEFORE any modules are loaded
// webidl-conversions expects 'global' to exist when it's imported

// Set up global = globalThis immediately (before any imports)
// This must be done synchronously before any module imports
if (typeof global === 'undefined') {
  if (typeof globalThis !== 'undefined') {
    // eslint-disable-next-line no-global-assign
    global = globalThis;
  } else if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-global-assign
    global = window;
  } else {
    // eslint-disable-next-line no-global-assign
    global = {};
  }
}

// Ensure global has required properties
if (typeof global !== 'undefined') {
  // Make sure global.get is available (needed by webidl-conversions)
  if (!global.get) {
    global.get = function(key) {
      return this[key];
    };
  }
}

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
