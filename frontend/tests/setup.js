import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Node.js environment
if (typeof global !== 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Fix for webidl-conversions - ensure global is available
if (typeof globalThis !== 'undefined') {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Make global available for webidl-conversions (used by whatwg-url)
// This is needed because webidl-conversions expects 'global' to exist
if (typeof global === 'undefined') {
  // eslint-disable-next-line no-global-assign
  global = globalThis;
}

