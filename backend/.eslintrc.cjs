module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  globals: {
    jest: 'readonly',
    expect: 'readonly',
    describe: 'readonly',
    it: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    afterAll: 'readonly',
    beforeAll: 'readonly',
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['node'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': 'warn',
    'no-case-declarations': 'off',
    'no-control-regex': 'warn',
    'no-prototype-builtins': 'warn',
    'prefer-const': 'warn',
    'no-var': 'error',
  },
};

