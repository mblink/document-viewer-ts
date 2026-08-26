import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.example.json', './tests/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      ...tsPlugin.configs['recommended-type-checked'].rules,

      // Carried over from .eslintrc.js. Rules that were "off" there are omitted
      // rather than restated. ban-types, no-empty-interface and no-var-requires
      // are gone from typescript-eslint 8 and are covered by no-empty-object-type,
      // no-unsafe-function-type, no-wrapper-object-types and no-require-imports,
      // all of which recommended-type-checked already enables.
      '@typescript-eslint/adjacent-overload-signatures': 'warn',
      '@typescript-eslint/array-type': ['warn', { default: 'array-simple', readonly: 'generic' }],
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/dot-notation': 'warn',
      '@typescript-eslint/explicit-member-accessibility': ['warn', { accessibility: 'no-public' }],
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-implied-eval': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-misused-new': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-redeclare': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-shadow': ['warn', { ignoreTypeValueShadow: true }],
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-unnecessary-type-arguments': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'warn',
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
      ],
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-function-type': 'warn',
      '@typescript-eslint/prefer-namespace-keyword': 'warn',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/prefer-regexp-exec': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/typedef': ['warn', { parameter: true, propertyDeclaration: true }],
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/unified-signatures': 'warn',
      'camelcase': 'warn',
      'comma-spacing': 'warn',
      'constructor-super': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'guard-for-in': 'warn',
      'id-denylist': [
        'warn',
        'any', 'Number', 'number', 'String', 'string', 'Boolean', 'boolean', 'Undefined', 'undefined',
      ],
      'id-match': 'warn',
      'new-parens': 'warn',
      'no-bitwise': 'warn',
      'no-caller': 'warn',
      'no-console': 'warn',
      'no-debugger': 'warn',
      'no-duplicate-imports': 'warn',
      'no-eval': 'warn',
      'no-extra-bind': 'warn',
      'no-fallthrough': 'off',
      'no-new-wrappers': 'warn',
      'no-redeclare': 'off',
      'no-shadow': 'off',
      'no-throw-literal': 'warn',
      'no-trailing-spaces': 'warn',
      'no-undef-init': 'warn',
      'no-unused-vars': 'off',
      'no-var': 'warn',
      'no-void': ['warn', { allowAsStatement: true }],
      'prefer-const': 'warn',
      'quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'semi': 'warn',
      'sort-imports': 'warn',
      'spaced-comment': ['warn', 'always', { exceptions: ['*-'], markers: ['/'] }],
      'use-isnan': 'warn',
      'valid-typeof': ['warn', { requireStringLiterals: true }],

      // Correctness rules this viewer has actually needed. A discarded render
      // promise is what let the canvas race go unnoticed, and the interleaved
      // await/assign in the render chain is exactly what require-atomic-updates
      // is for.
      '@typescript-eslint/no-floating-promises': 'error',
      'require-atomic-updates': 'error',
      // Cancellation is an AbortSignal rather than a local boolean, so TypeScript
      // cannot narrow it and this rule no longer reports the lifecycle guards as
      // dead code. Reintroducing a mutable flag would put it back to reporting them.
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': ['warn', { considerDefaultExhaustiveForUnions: true }],
      '@typescript-eslint/no-confusing-void-expression': 'warn',
      '@typescript-eslint/no-misused-spread': 'warn',
      '@typescript-eslint/no-unnecessary-template-expression': 'warn',
      '@typescript-eslint/return-await': ['warn', 'always'],
      'array-callback-return': 'warn',
      'no-promise-executor-return': 'warn',
      'no-self-compare': 'warn',
      'no-template-curly-in-string': 'warn',
      'no-unmodified-loop-condition': 'warn',
      'no-unreachable-loop': 'warn',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
