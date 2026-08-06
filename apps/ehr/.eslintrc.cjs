module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json', 'tsconfig.vite.json'],
  },
  ignorePatterns: ['build', 'playwright-report', 'playwright-report-login', 'setup-test-deps.js', 'auth.setup.js'],
};
