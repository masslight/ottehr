module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
  },
  ignorePatterns: ['src/scripts/detect-tls.js'],
  rules: {
    // Barrel files were removed from this package deliberately. Two reasons:
    //
    //  1. They create circular dependency chains — module A imports the barrel to reach B, the
    //     barrel re-exports C, and C imports A. These cycles degrade editor responsiveness and
    //     produce confusing partially-initialised modules at runtime.
    //  2. vitest does not bundle, so a single barrel import makes a test file load the ENTIRE
    //     package behind it. Measured on one vertical slice: 1.26s -> 0.073s per test file once
    //     its whole chain was off barrels.
    //
    // Import from the module that declares the symbol instead:
    //   import { checkOrCreateM2MClientToken } from '../../shared/auth';
    //   import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
    //
    // packages/zambdas/scripts/debarrel.ts can do the rewrite for you.
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'utils',
            message:
              "Import from the declaring module instead, e.g. 'utils/lib/types/errors'. Barrel imports create dependency cycles and make every test file load the whole package. See scripts/debarrel.ts.",
          },
        ],
        patterns: [
          {
            group: ['**/shared', '!**/shared/*'],
            message:
              "Import from the declaring module instead, e.g. '../../shared/auth'. Barrel imports create dependency cycles and make every test file load the whole package. See scripts/debarrel.ts.",
          },
        ],
      },
    ],
  },
};
