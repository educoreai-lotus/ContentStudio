// Polyfills must be set up BEFORE any imports
// This is critical for webidl-conversions which expects 'global' to exist

// Set up global = globalThis if it doesn't exist
if (typeof global === 'undefined') {
  // eslint-disable-next-line no-global-assign
  global = globalThis;
}

// Import polyfills
import { TextEncoder, TextDecoder } from 'util';

// Set up TextEncoder and TextDecoder on both global and globalThis
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
