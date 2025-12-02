// CRITICAL: This file must set up global BEFORE any modules are loaded
// webidl-conversions expects 'global' to exist when it's imported

// Set up global = globalThis immediately (before any imports)
if (typeof global === 'undefined' && typeof globalThis !== 'undefined') {
  // eslint-disable-next-line no-global-assign
  global = globalThis;
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
