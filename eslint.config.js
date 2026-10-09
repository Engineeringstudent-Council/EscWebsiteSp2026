import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    // Legacy site scripts (jQuery template, document.write includes) and
    // vendored libraries are out of scope; only modern code is linted.
    ignores: [
      'assets/**',
      '!assets/js/search/**',
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
    files: ['assets/js/search/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
    },
  },
];
