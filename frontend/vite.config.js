import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ensure global is defined before any imports
// This must run BEFORE any module loading, including webidl-conversions
if (typeof global === 'undefined') {
  // eslint-disable-next-line no-global-assign
  global = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
}

// Ensure globalThis has global reference
if (typeof globalThis !== 'undefined' && typeof globalThis.global === 'undefined') {
  Object.defineProperty(globalThis, 'global', {
    value: global,
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

// Polyfill Map and WeakMap for webidl-conversions
if (typeof globalThis !== 'undefined') {
  if (typeof globalThis.Map === 'undefined' && typeof Map !== 'undefined') {
    globalThis.Map = Map;
    if (typeof global !== 'undefined') {
      global.Map = Map;
    }
  }
  if (typeof globalThis.WeakMap === 'undefined' && typeof WeakMap !== 'undefined') {
    globalThis.WeakMap = WeakMap;
    if (typeof global !== 'undefined') {
      global.WeakMap = WeakMap;
    }
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure webidl-conversions and whatwg-url are resolved correctly
    alias: {
      // Don't alias - let them resolve normally but ensure they're external in test
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.config.js',
        '**/setup.js',
      ],
    },
    server: {
      deps: {
        // Don't inline these packages - let them be resolved normally
        // This prevents webidl-conversions from being loaded before setup.js runs
      },
    },
    define: {
      'global': 'globalThis',
    },
  },
  optimizeDeps: {
    // Don't pre-bundle whatwg-url and webidl-conversions
    // Let them be loaded normally after setup.js runs
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: {
    // Ensure environment variables are available at build time
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || ''
    ),
    // Ensure global is defined for webidl-conversions
    'global': 'globalThis',
  },
});

