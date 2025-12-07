// Setup file for Vitest with happy-dom
// happy-dom doesn't require webidl-conversions, so we don't need complex polyfills

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
