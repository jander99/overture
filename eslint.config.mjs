import nx from '@nx/eslint-plugin';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-n';

/**
 * ESLint Configuration for Overture
 *
 * This config explicitly defines all rules to lock in our linting behavior,
 * preventing upstream changes in Nx or typescript-eslint from introducing
 * regressions. Rules are set based on Phase 8 completion state (all warnings
 * resolved as of December 2024).
 *
 * Rule Categories:
 * - 'error': Must be fixed, blocks CI
 * - 'warn': Should be reviewed, does not block CI
 * - 'off': Intentionally disabled with documented reason
 */

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vitest.config.*.timestamp*',
      '**/vite.config.*.timestamp*',
    ],
  },
  // ==========================================================================
  // Core ESLint rules - explicitly set to prevent upstream changes
  // These override defaults from @eslint/js recommended config
  // ==========================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // --- Error-level rules (must be fixed) ---
      'no-var': 'error', // Use let/const instead
      'prefer-const': 'error', // Use const when variable is never reassigned
      'prefer-rest-params': 'error', // Use rest parameters instead of arguments
      'prefer-spread': 'error', // Use spread syntax instead of .apply()
      'no-debugger': 'error', // No debugger statements in production

      // --- Rules turned off (handled by TypeScript or not applicable) ---
      'no-undef': 'off', // TypeScript handles this
      'no-unused-vars': 'off', // Use @typescript-eslint/no-unused-vars instead
      'no-empty-function': 'off', // Use @typescript-eslint/no-empty-function instead
      'no-array-constructor': 'off', // Use @typescript-eslint/no-array-constructor instead
      'no-unused-expressions': 'off', // Use @typescript-eslint/no-unused-expressions instead
    },
  },
  // ==========================================================================
  // TypeScript-ESLint rules - explicitly locked to current working state
  // These override defaults from typescript-eslint/recommended
  // ==========================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // --- Error-level rules (critical, must be fixed) ---
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/ban-ts-comment': 'error', // Prevent @ts-ignore abuse
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',

      // --- Warning-level rules (should be reviewed but don't block CI) ---
      // These are warn because they're common in existing code or have valid exceptions
      '@typescript-eslint/no-explicit-any': 'warn', // Prefer specific types, but sometimes any is needed
      '@typescript-eslint/no-non-null-assertion': 'warn', // Prefer type guards, but sometimes needed
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // --- Rules turned off (intentionally disabled) ---
      '@typescript-eslint/no-require-imports': 'off', // Allow require() for dynamic imports and config files
      '@typescript-eslint/explicit-member-accessibility': 'off', // Not enforced in this codebase
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Too verbose for internal functions
      '@typescript-eslint/explicit-function-return-type': 'off', // TypeScript inference is sufficient
    },
  },
  // ==========================================================================
  // Nx module boundary rules
  // ==========================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            // Allow @overture/utils despite dynamic imports in test mocks
            // This is a valid pattern for Vitest partial mocking
            '@overture/utils',
            '@overture/sync-core',
          ],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  // ==========================================================================
  // Security plugin - eslint-plugin-security
  // Detects common security vulnerabilities in JavaScript/TypeScript code
  // ==========================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      security,
    },
    rules: {
      // --- Error-level (critical security issues) ---
      'security/detect-buffer-noassert': 'error', // Prevents buffer overflows
      'security/detect-disable-mustache-escape': 'error', // Prevents XSS
      'security/detect-eval-with-expression': 'error', // Prevents code injection
      'security/detect-no-csrf-before-method-override': 'error', // CSRF protection
      'security/detect-pseudoRandomBytes': 'error', // Use crypto.randomBytes instead

      // --- Warning-level (review recommended but may have valid use cases) ---
      'security/detect-object-injection': 'warn', // Dynamic property access - documented exceptions exist
      'security/detect-non-literal-fs-filename': 'warn', // Dynamic paths - adapters have exemptions
      'security/detect-unsafe-regex': 'warn', // ReDoS prevention - review without blocking
      'security/detect-child-process': 'warn', // Shell injection prevention
      'security/detect-non-literal-regexp': 'warn', // ReDoS from user input
      'security/detect-non-literal-require': 'warn', // Dynamic require() calls
      'security/detect-possible-timing-attacks': 'warn', // Timing side-channels
    },
  },
  // ==========================================================================
  // SonarJS plugin - code quality and cognitive complexity
  // Phase 8 completed: All cognitive complexity issues resolved
  // ==========================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      sonarjs,
    },
    rules: {
      // --- Cognitive Complexity (LOCKED: Phase 8 achievement) ---
      // All functions now comply with max complexity of 15
      // Changing this to 'error' would enforce the current clean state
      'sonarjs/cognitive-complexity': ['warn', 15],

      // --- Error-level (bugs and logic errors) ---
      'sonarjs/no-collection-size-mischeck': 'error', // arr.length >= 0 is always true
      'sonarjs/no-element-overwrite': 'error', // Overwriting array element in same iteration
      'sonarjs/no-empty-collection': 'error', // Using empty collection
      'sonarjs/no-extra-arguments': 'error', // Too many arguments to function
      'sonarjs/no-identical-conditions': 'error', // Duplicate conditions in if-else
      'sonarjs/no-unused-collection': 'error', // Collection created but never used
      'sonarjs/no-use-of-empty-return-value': 'error', // Using void return value

      // --- Warning-level (code smells, should be reviewed) ---
      'sonarjs/no-duplicate-string': ['warn', { threshold: 3 }], // Magic strings
      'sonarjs/no-identical-functions': 'warn', // Duplicate function bodies
      'sonarjs/no-collapsible-if': 'warn', // if (a) { if (b) {} } => if (a && b) {}
      'sonarjs/no-duplicated-branches': 'warn', // Same code in multiple branches
      'sonarjs/no-inverted-boolean-check': 'warn', // !(a === b) => a !== b
      'sonarjs/no-redundant-boolean': 'warn', // x === true => x
      'sonarjs/prefer-immediate-return': 'warn', // const x = y; return x; => return y;
      'sonarjs/prefer-object-literal': 'warn', // Prefer {} over new Object()
      'sonarjs/prefer-single-boolean-return': 'warn', // if (x) return true; return false;
      'sonarjs/no-nested-functions': 'warn', // Functions inside functions (relaxed in tests)
      'sonarjs/no-identical-expressions': 'warn', // a === a is suspicious
      'sonarjs/no-small-switch': 'warn', // Switch with 1-2 cases => if-else
    },
  },
  // ==========================================================================
  // Import plugin - module import/export hygiene
  // Note: Some rules disabled due to Nx monorepo compatibility issues
  // ==========================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      // --- Error-level (definite bugs) ---
      'import/no-self-import': 'error', // Module importing itself

      // --- Warning-level (style/cleanup) ---
      'import/no-useless-path-segments': 'warn', // ./foo/../bar => ./bar
      'import/no-duplicates': 'warn', // Multiple imports from same module
      'import/first': 'warn', // Imports should be at top
      'import/newline-after-import': 'warn', // Blank line after imports

      // --- Disabled (Nx monorepo compatibility) ---
      'import/no-unresolved': 'off', // Nx handles resolution via tsconfig paths
      'import/no-cycle': 'off', // Too expensive and Nx graph handles this
    },
  },
  // ==========================================================================
  // Node.js plugin - Node.js best practices
  // ==========================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      n: nodePlugin,
    },
    rules: {
      // --- Error-level (deprecated/broken APIs) ---
      'n/no-deprecated-api': 'error', // Don't use deprecated Node.js APIs
      'n/no-exports-assign': 'error', // Use module.exports, not exports = {}

      // --- Warning-level (best practices) ---
      'n/prefer-global/buffer': 'warn', // Use global Buffer
      'n/prefer-global/console': 'warn', // Use global console
      'n/prefer-global/process': 'warn', // Use global process

      // --- Disabled (not applicable to monorepo) ---
      'n/no-missing-import': 'off', // TypeScript/Nx handles this
      'n/no-unpublished-import': 'off', // All deps are in monorepo
      'n/no-unsupported-features/es-syntax': 'off', // We target modern Node.js
    },
  },
  // ==========================================================================
  // TypeScript files - type-aware rules (require parserOptions.projectService)
  // ==========================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // --- Type-aware rules (require type information) ---
      // Warn instead of error to allow gradual adoption
      '@typescript-eslint/no-floating-promises': 'warn', // Unhandled promises
      '@typescript-eslint/no-misused-promises': 'warn', // Promise in wrong context

      // --- Disabled type-aware rules ---
      '@typescript-eslint/require-await': 'off', // Too noisy for test files with async setup
    },
  },
  // ==========================================================================
  // JavaScript files - non-type-aware rules only
  // ==========================================================================
  {
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'warn', // Use import type {} when possible
    },
  },
  // ==========================================================================
  // Test files - relaxed rules for testing patterns
  // ==========================================================================
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      // --- Nx rules ---
      '@nx/enforce-module-boundaries': 'off', // vi.importActual needs cross-boundary imports

      // --- TypeScript rules relaxed for mocking ---
      '@typescript-eslint/no-empty-function': 'off', // Mock implementations often empty
      '@typescript-eslint/no-explicit-any': 'off', // Mocks often need any type
      '@typescript-eslint/no-floating-promises': 'off', // Test assertions handle promises
      '@typescript-eslint/no-non-null-assertion': 'off', // Test assertions guarantee values

      // --- Security rules off in tests ---
      'security/detect-object-injection': 'off', // Test data uses dynamic keys
      'security/detect-non-literal-fs-filename': 'off', // Test fixtures use dynamic paths
      'security/detect-non-literal-require': 'off', // Dynamic test imports

      // --- SonarJS rules relaxed for test patterns ---
      'sonarjs/no-duplicate-string': 'off', // Test descriptions repeat
      'sonarjs/cognitive-complexity': 'off', // Complex test scenarios are fine
      'sonarjs/no-nested-functions': 'off', // describe/it blocks are nested by design
      'sonarjs/no-identical-functions': 'off', // Similar test setups are acceptable
    },
  },
  // ==========================================================================
  // Filesystem adapters - relaxed security rules for expected dynamic paths
  // ==========================================================================
  {
    files: [
      '**/adapters/infrastructure/**/*.ts',
      '**/node-filesystem.adapter.ts',
      '**/process-lock.ts',
    ],
    rules: {
      // File system adapters inherently work with dynamic paths
      // This is the abstraction layer that handles all filesystem operations
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
];
