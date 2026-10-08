import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.vite/**',
      // Prisma output is generated code and already carries @ts-nocheck.
      '**/generated/prisma/**',
      'apps/web/dev-dist/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Underscore marks a deliberately unused binding (Express error handlers,
      // destructuring throwaways).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // `any` needs a justification, per the quality bar in section 13.
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'object-shorthand': 'error',
      'prefer-const': 'error',
    },
  },

  // Vue single-file components: TypeScript inside <script setup>.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2023,
        sourceType: 'module',
      },
      globals: { ...globals.browser },
    },
    rules: {
      // Pages and layouts are addressed by their folder, not by a compound name.
      'vue/multi-word-component-names': 'off',
    },
  },

  // Browser code.
  {
    files: ['apps/web/**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Operational CLIs: talking to the operator on stdout is the whole point.
  {
    files: ['apps/api/scripts/**/*.ts', 'apps/api/prisma/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Tests.
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Must stay last: turns off everything Prettier already handles.
  prettier,
);
