// CRITICAL: Set up global BEFORE any imports that might use it
// This must be done at the very top to ensure webidl-conversions works
if (typeof global === 'undefined' && typeof globalThis !== 'undefined') {
  // eslint-disable-next-line no-global-assign
  global = globalThis;
}

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Node.js environment
// Set up global and globalThis
if (typeof globalThis !== 'undefined') {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
  
  // Make global available for webidl-conversions (used by whatwg-url)
  if (typeof global === 'undefined') {
    // eslint-disable-next-line no-global-assign
    global = globalThis;
  } else {
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
  }
}
