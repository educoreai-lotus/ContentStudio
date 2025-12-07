export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js'],
  testMatch: ['**/tests/**/*.test.js'],
  globals: {
    'jest': true,
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/server.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  verbose: true,
  testTimeout: 10000, // 10 seconds timeout per test to prevent hanging
  // Force Jest to exit after tests complete to prevent hanging on async operations
  forceExit: true,
  // Set test environment variable so server.js knows it's running in tests
  setupFiles: ['<rootDir>/tests/setup.js'],
};

