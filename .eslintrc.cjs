module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.base.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'simple-import-sort', '@tanstack/query'],
  root: true,
  rules: {
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'prefer-promise-reject-errors': 'error',
    'import/order': 'off',
    'sort-imports': 'off',
    'simple-import-sort/imports': [
      'error',
      {
        groups: [['^\\u0000', '^node:', '^@?\\w', '^', '^\\.']],
      },
    ],
    // No barrel files: import every symbol from the module that declares it.
    //  1. vitest does not bundle, so importing through a re-export makes a test file load the whole
    //     tree behind it. Removing the barrels made unit tests 2-2.6x faster.
    //  2. Barrels are how most of our import cycles formed: A imports the barrel to reach B, the
    //     barrel re-exports C, and C imports A.
    // `npx tsx scripts/debarrel.ts --apply` rewrites importers to the declaring module, and
    // `npm run lint:barrels` also catches the `import { x } from './x'; export { x }` form.
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ExportAllDeclaration',
        message:
          'Do not re-export (`export * from`): import from the declaring module instead. See scripts/debarrel.ts.',
      },
      {
        selector: 'ExportNamedDeclaration[source]',
        message:
          'Do not re-export (`export { … } from`): import from the declaring module instead. See scripts/debarrel.ts.',
      },
    ],
    // The workspace packages have no entry module; import the file that declares the symbol.
    'no-restricted-imports': [
      'error',
      {
        paths: ['utils', 'ui-components', 'test-utils', 'config-types'].map((name) => ({
          name,
          message: `'${name}' has no entry module: import from the file that declares the symbol, e.g. 'utils/lib/types/errors'. See scripts/debarrel.ts.`,
        })),
      },
    ],
  },
  overrides: [
    {
      files: ['apps/intake/tests/**/*.ts', 'apps/ehr/tests/**/*.ts'],
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
          },
        ],
        'prefer-promise-reject-errors': 'error',
      },
    },
    {
      files: ['apps/ehr/src/**/*.{ts,tsx}', 'apps/intake/src/**/*.{ts,tsx}', 'packages/ui-components/**/*.{ts,tsx}'],
      rules: {
        '@tanstack/query/exhaustive-deps': 'error',
        '@tanstack/query/stable-query-client': 'error',
        '@tanstack/query/prefer-query-object-syntax': 'error',
        '@tanstack/query/no-deprecated-options': 'error',
        '@tanstack/query/no-rest-destructuring': 'warn',
      },
    },
    {
      files: ['scripts/**/*.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
