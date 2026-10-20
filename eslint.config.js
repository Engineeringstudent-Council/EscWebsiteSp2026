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
      '!assets/js/theme/',
      '!assets/js/theme/*.js',
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
    files: [
      'scripts/**/*.{js,mjs}',
      'tests/**/*.{js,mjs}',
      '*.config.{js,mjs}',
      'workers/**/*.{js,mjs}',
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // Classic, render-blocking script (it must run before first paint).
    files: ['assets/js/theme/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: globals.browser,
    },
  },
  {
    files: ['assets/js/search/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
    },
  },
];
