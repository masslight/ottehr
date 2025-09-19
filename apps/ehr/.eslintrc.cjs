module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
  },
  ignorePatterns: [
    'build',
    'playwright-report',
    'playwright-report-login',
    'setup-test-deps.js',
    'validate-e2e-intake-user.js',
    'auth.setup.js',
  ],
};
