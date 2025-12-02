// CRITICAL: This file must set up global BEFORE any modules are loaded
// webidl-conversions expects 'global' to exist when it's imported

// Define global immediately at the top level (before any imports)
// This must run synchronously before any module loading
// Use globalThis as the base, which is available in all modern environments
if (typeof global === 'undefined') {
  // eslint-disable-next-line no-global-assign
  global = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
}

// Ensure global is always an object (never undefined or null)
if (!global || typeof global !== 'object') {
  // eslint-disable-next-line no-global-assign
  global = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
}

// CRITICAL: webidl-conversions uses global.get() to access properties
// Make sure global.get is always available as a function
if (typeof global.get !== 'function') {
  // Use Object.defineProperty to ensure it's not enumerable
  Object.defineProperty(global, 'get', {
    value: function(key) {
      return this[key];
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

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
