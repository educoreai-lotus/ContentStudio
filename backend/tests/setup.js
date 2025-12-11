// Jest setup file - runs before all tests
// Set NODE_ENV to 'test' so server.js knows it's running in test environment
process.env.NODE_ENV = 'test';

// Suppress console.warn and console.error during tests to prevent noise from expected warnings
// (e.g., Supabase credentials warnings in test environment)
// This is done at module load time since setupFiles run before each test file
const originalWarn = console.warn;
const originalError = console.error;

// Override console methods to suppress warnings/errors in test environment
// Tests can still use console.log for debugging
console.warn = () => {}; // Suppress warnings in tests
console.error = () => {}; // Suppress errors in tests (actual test failures will still show via Jest)

// Export restore function in case tests need to restore console methods
export const restoreConsole = () => {
  console.warn = originalWarn;
  console.error = originalError;
};

