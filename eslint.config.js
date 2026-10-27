import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    // Legacy site scripts (jQuery template, document.write includes) and
    // vendored libraries are out of scope; only modern code is linted.
    ignores: [
      'assets/**/*',
      '!assets/js/',
      '!assets/js/search/',
      '!assets/js/search/*.js',
      '!assets/js/site/',
      '!assets/js/site/*.js',
      'assets/js/vendor/**',
      'TableFilter/**',
      '.claude/**',
      'top-bar.js',
      'old_ESC/**',
      'node_modules/**',
      '.lighthouseci/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs}', '*.config.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ['assets/js/search/**/*.js', 'assets/js/site/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
    },
  },
  {
    // Cloudflare Workers run in a service-worker-like runtime (fetch, Request,
    // Response, crypto.subtle), with no Node or DOM globals.
    files: ['workers/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.serviceworker,
    },
  },
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: globals.serviceworker,
    },
  },
];
