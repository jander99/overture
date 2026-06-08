// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.nx/**',
      '**/tmp/**',
      '**/build/**',
      '**/.yarn/**',
      '**/*.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The TypeScript compiler already enforces noUnusedLocals; mirror it
      // at the lint level so unused locals surface in the editor without
      // a separate tsc run.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // Allow leading-underscore on intentionally-discarded values; do
      // not allow underscore-as-prefix on used identifiers.
      '@typescript-eslint/no-unused-expressions': 'error',
      // Prefer `unknown` over `any` for new code; `any` in third-party
      // type definitions is out of scope.
      '@typescript-eslint/no-explicit-any': 'error',
      // Surface any-ts slipping in via cast or generic position.
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
  },
  {
    // Test files: relax type-aware rules that fight with vitest's
    // expect()/vi.mock()/dynamic-import patterns.
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      // The CLI prints ANSI color escape codes; the human-output tests
      // assert against those escape sequences literally. The
      // no-control-regex rule is unhelpful there.
      'no-control-regex': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Build / config / fixture files: not part of the runtime surface.
    files: ['**/scripts/**', '**/verify-*.{js,mjs,cjs}', '**/migrations/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
