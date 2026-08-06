module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json', 'tsconfig.vite.json'],
    module: 'ESNext',
    target: 'esnext',
    lib: ['esnext.array', 'dom'],
  },
  ignorePatterns: [
    'build',
    'playwright-report',
    'playwright-report-login',
    'setup-test-deps.js',
    'validate-e2e-intake-user.js',
  ],
};
